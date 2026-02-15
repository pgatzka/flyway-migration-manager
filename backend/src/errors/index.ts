/** Base class for application-specific errors with HTTP status codes */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

/** Thrown when a requested resource (project, migration) is not found */
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 404);
  }
}

/** Thrown when a migration version conflict occurs (duplicate version) */
export class MigrationConflictError extends AppError {
  constructor(projectId: string, version: number) {
    super(`Migration version ${version} already exists in project '${projectId}'`, 409);
  }
}

/** Thrown when a project name already exists */
export class ProjectConflictError extends AppError {
  constructor(name: string) {
    super(`Project with name '${name}' already exists`, 409);
  }
}

/** Thrown when validation of migrations fails */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

/** Thrown when an imported file does not match Flyway naming convention */
export class ImportParseError extends AppError {
  constructor(fileName: string) {
    super(`File '${fileName}' does not match Flyway naming convention V{version}__{description}.sql`, 400);
  }
}

/** Thrown when request input is invalid */
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
