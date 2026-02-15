import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projects, migrations, validationResults } from '../db/schema.js';
import { NotFoundError, ProjectConflictError } from '../errors/index.js';
import type { Project, ProjectWithStats } from '../../../shared/types.js';
import pino from 'pino';

const logger = pino({ name: 'project-service' });

/**
 * Retrieves all projects with dashboard statistics including migration count,
 * total SQL line count, last modified date, and validation summary.
 * @returns Array of projects with computed statistics
 */
export async function listProjectsWithStats(): Promise<ProjectWithStats[]> {
  logger.info('Listing all projects with stats');

  const allProjects = await db.select().from(projects).orderBy(projects.name);

  const result: ProjectWithStats[] = [];

  for (const project of allProjects) {
    const stats = await getProjectStats(project.id);
    result.push({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      ...stats,
    });
  }

  logger.info({ count: result.length }, 'Listed projects with stats');
  return result;
}

/**
 * Computes dashboard statistics for a single project.
 * @param projectId - UUID of the project
 * @returns Statistics object with migration count, line count, validation info
 */
async function getProjectStats(projectId: string) {
  // Get migration count and total line count
  const migrationRows = await db
    .select({
      sqlContent: migrations.sqlContent,
      updatedAt: migrations.updatedAt,
    })
    .from(migrations)
    .where(eq(migrations.projectId, projectId));

  const migrationCount = migrationRows.length;
  const totalSqlLineCount = migrationRows.reduce(
    (acc, m) => acc + m.sqlContent.split('\n').length,
    0
  );
  const lastModified =
    migrationRows.length > 0
      ? migrationRows
          .map((m) => m.updatedAt)
          .sort((a, b) => b.getTime() - a.getTime())[0]
          .toISOString()
      : null;

  // Get validation stats
  const validations = await db
    .select({
      id: validationResults.id,
      status: validationResults.status,
      executedAt: validationResults.executedAt,
    })
    .from(validationResults)
    .where(eq(validationResults.projectId, projectId))
    .orderBy(desc(validationResults.executedAt));

  const lastValidation =
    validations.length > 0
      ? {
          id: validations[0].id,
          status: validations[0].status as 'pass' | 'fail',
          executedAt: validations[0].executedAt.toISOString(),
        }
      : null;

  const validationPassCount = validations.filter((v) => v.status === 'pass').length;
  const validationFailCount = validations.filter((v) => v.status === 'fail').length;

  return {
    migrationCount,
    totalSqlLineCount,
    lastModified,
    lastValidation,
    validationPassCount,
    validationFailCount,
  };
}

/**
 * Creates a new project with the given name.
 * @param name - Unique project name
 * @returns The created project record
 * @throws ProjectConflictError if a project with the same name already exists
 */
export async function createProject(name: string): Promise<Project> {
  logger.info({ name }, 'Creating new project');

  // Check for name conflict
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, name))
    .limit(1);

  if (existing.length > 0) {
    logger.warn({ name }, 'Project name already exists');
    throw new ProjectConflictError(name);
  }

  const [created] = await db
    .insert(projects)
    .values({ name })
    .returning();

  logger.info({ projectId: created.id, name }, 'Project created');
  return {
    id: created.id,
    name: created.name,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

/**
 * Retrieves a single project by ID.
 * @param id - UUID of the project
 * @returns The project record
 * @throws NotFoundError if the project does not exist
 */
export async function getProject(id: string): Promise<Project> {
  logger.info({ projectId: id }, 'Fetching project');

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) {
    logger.warn({ projectId: id }, 'Project not found');
    throw new NotFoundError('Project', id);
  }

  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

/**
 * Updates a project's name.
 * @param id - UUID of the project to update
 * @param name - New project name
 * @returns The updated project record
 * @throws NotFoundError if the project does not exist
 * @throws ProjectConflictError if the new name conflicts with an existing project
 */
export async function updateProject(id: string, name: string): Promise<Project> {
  logger.info({ projectId: id, name }, 'Updating project');

  // Check the project exists
  await getProject(id);

  // Check for name conflict with a different project
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, name))
    .limit(1);

  if (existing.length > 0 && existing[0].id !== id) {
    logger.warn({ name }, 'Project name conflict on update');
    throw new ProjectConflictError(name);
  }

  const [updated] = await db
    .update(projects)
    .set({ name, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  logger.info({ projectId: id, name }, 'Project updated');
  return {
    id: updated.id,
    name: updated.name,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Clones a project and all its migrations into a new project.
 * @param sourceId - UUID of the project to clone
 * @param newName - Name for the cloned project
 * @returns The newly created project record
 * @throws NotFoundError if the source project does not exist
 * @throws ProjectConflictError if the new name conflicts with an existing project
 */
export async function cloneProject(sourceId: string, newName: string): Promise<Project> {
  logger.info({ sourceId, newName }, 'Cloning project');

  // Verify source exists
  await getProject(sourceId);

  // Check name conflict
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, newName))
    .limit(1);

  if (existing.length > 0) {
    throw new ProjectConflictError(newName);
  }

  // Create new project
  const [newProject] = await db
    .insert(projects)
    .values({ name: newName })
    .returning();

  // Copy all migrations from source
  const sourceMigrations = await db
    .select()
    .from(migrations)
    .where(eq(migrations.projectId, sourceId))
    .orderBy(migrations.version);

  if (sourceMigrations.length > 0) {
    await db.insert(migrations).values(
      sourceMigrations.map((m) => ({
        projectId: newProject.id,
        version: m.version,
        description: m.description,
        sqlContent: m.sqlContent,
        downSqlContent: m.downSqlContent,
      }))
    );
  }

  logger.info({ sourceId, newProjectId: newProject.id, newName, migrationsCopied: sourceMigrations.length }, 'Project cloned');
  return {
    id: newProject.id,
    name: newProject.name,
    createdAt: newProject.createdAt.toISOString(),
    updatedAt: newProject.updatedAt.toISOString(),
  };
}

/**
 * Deletes a project and all its associated migrations and validation results (cascade).
 * @param id - UUID of the project to delete
 * @throws NotFoundError if the project does not exist
 */
export async function deleteProject(id: string): Promise<void> {
  logger.info({ projectId: id }, 'Deleting project');

  // Verify it exists first
  await getProject(id);

  await db.delete(projects).where(eq(projects.id, id));
  logger.info({ projectId: id }, 'Project deleted');
}
