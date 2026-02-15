import type {
  Project,
  ProjectWithStats,
  Migration,
  ValidationResult,
  SchemaSnapshot,
  SchemaSnapshotSummary,
  SchemaDiff,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateMigrationRequest,
  UpdateMigrationRequest,
  Annotation,
  CreateAnnotationRequest,
  WebhookConfig,
  UpsertWebhookRequest,
  WebhookDelivery,
  ApiErrorResponse,
} from '@shared/types';

/** Base URL for API requests — empty string uses the same origin */
const BASE_URL = '';

/**
 * Custom error class for API responses with status codes.
 */
export class ApiError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Makes an HTTP request to the API and handles error responses.
 * @param url - API endpoint path
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws ApiError on non-OK responses
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody: ApiErrorResponse = await response.json();
      errorMessage = errorBody.message || errorMessage;
    } catch {
      // Response body wasn't JSON, use default message
    }
    throw new ApiError(errorMessage, response.status);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ---- Projects ----

/** Fetches all projects with dashboard statistics */
export async function listProjects(): Promise<ProjectWithStats[]> {
  return request<ProjectWithStats[]>('/api/projects');
}

/** Creates a new project */
export async function createProject(data: CreateProjectRequest): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Fetches a single project by ID */
export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/api/projects/${id}`);
}

/** Updates a project's name */
export async function updateProject(id: string, data: UpdateProjectRequest): Promise<Project> {
  return request<Project>(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Deletes a project */
export async function deleteProject(id: string): Promise<void> {
  return request<void>(`/api/projects/${id}`, { method: 'DELETE' });
}

/** Clones a project with all its migrations */
export async function cloneProject(id: string, name: string): Promise<Project> {
  return request<Project>(`/api/projects/${id}/clone`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// ---- Migrations ----

/** Fetches all migrations for a project */
export async function listMigrations(projectId: string): Promise<Migration[]> {
  return request<Migration[]>(`/api/projects/${projectId}/migrations`);
}

/** Fetches a single migration by ID */
export async function getMigration(id: string): Promise<Migration> {
  return request<Migration>(`/api/migrations/${id}`);
}

/** Creates a new migration with auto-generated version */
export async function createMigration(
  projectId: string,
  data: CreateMigrationRequest
): Promise<Migration> {
  return request<Migration>(`/api/projects/${projectId}/migrations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Inserts a migration at a specific version, shifting others up */
export async function insertMigration(
  projectId: string,
  version: number,
  data: CreateMigrationRequest
): Promise<Migration> {
  return request<Migration>(`/api/projects/${projectId}/migrations/insert/${version}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Updates a migration */
export async function updateMigration(
  id: string,
  data: UpdateMigrationRequest
): Promise<Migration> {
  return request<Migration>(`/api/migrations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Deletes a migration */
export async function deleteMigration(id: string): Promise<void> {
  return request<void>(`/api/migrations/${id}`, { method: 'DELETE' });
}

/** Renumbers all migrations in a project sequentially */
export async function renumberMigrations(projectId: string): Promise<Migration[]> {
  return request<Migration[]>(`/api/projects/${projectId}/migrations/renumber`, {
    method: 'POST',
  });
}

// ---- Import / Export ----

/** Imports .sql files into a project via multipart upload */
export async function importMigrations(projectId: string, files: File[]): Promise<Migration[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  const response = await fetch(`${BASE_URL}/api/projects/${projectId}/import`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = `Import failed with status ${response.status}`;
    try {
      const errorBody: ApiErrorResponse = await response.json();
      errorMessage = errorBody.message || errorMessage;
    } catch {
      // not JSON
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

/** Returns the URL for downloading a project's migrations as ZIP */
export function getExportZipUrl(projectId: string): string {
  return `${BASE_URL}/api/projects/${projectId}/export`;
}

/** Returns the URL for downloading a single migration as .sql */
export function getExportMigrationUrl(migrationId: string): string {
  return `${BASE_URL}/api/migrations/${migrationId}/export`;
}

// ---- Validation ----

/**
 * Starts a validation run and returns an EventSource for SSE streaming.
 * Uses POST via fetch with SSE parsing since EventSource only supports GET.
 * @param projectId - UUID of the project to validate
 * @param onEvent - Callback for each SSE event
 * @param onError - Callback for errors
 * @returns AbortController to cancel the stream
 */
export function startValidation(
  projectId: string,
  onEvent: (event: any) => void,
  onError: (error: string) => void
): AbortController {
  const controller = new AbortController();

  fetch(`${BASE_URL}/api/projects/${projectId}/validate`, {
    method: 'POST',
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        onError(`Validation request failed with status ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE data lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(data);
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Validation stream failed');
      }
    });

  return controller;
}

/** Fetches past validation results for a project */
export async function listValidations(projectId: string): Promise<ValidationResult[]> {
  return request<ValidationResult[]>(`/api/projects/${projectId}/validations`);
}

/** Fetches the latest schema snapshot for a project (for ERD) */
export async function getSchemaSnapshot(projectId: string): Promise<SchemaSnapshot | null> {
  try {
    return await request<SchemaSnapshot>(`/api/projects/${projectId}/schema`);
  } catch (err: any) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

/** Lists all schema snapshots for a project (summaries) */
export async function listSchemaSnapshots(projectId: string): Promise<SchemaSnapshotSummary[]> {
  return request<SchemaSnapshotSummary[]>(`/api/projects/${projectId}/schemas`);
}

/** Fetches a specific schema snapshot by ID */
export async function getSchemaSnapshotById(snapshotId: string): Promise<SchemaSnapshot> {
  return request<SchemaSnapshot>(`/api/schemas/${snapshotId}`);
}

/** Compares two schema snapshots and returns the diff */
export async function compareSchemaSnapshots(beforeId: string, afterId: string): Promise<SchemaDiff> {
  return request<SchemaDiff>(`/api/schemas/${beforeId}/compare/${afterId}`);
}

// ---- Annotations ----

/** Lists annotations for a migration */
export async function listAnnotations(migrationId: string): Promise<Annotation[]> {
  return request<Annotation[]>(`/api/migrations/${migrationId}/annotations`);
}

/** Creates an annotation on a migration */
export async function createAnnotation(migrationId: string, data: CreateAnnotationRequest): Promise<Annotation> {
  return request<Annotation>(`/api/migrations/${migrationId}/annotations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Deletes an annotation */
export async function deleteAnnotation(id: string): Promise<void> {
  return request<void>(`/api/annotations/${id}`, { method: 'DELETE' });
}

// ---- Webhooks ----

/** Gets webhook config for a project */
export async function getWebhook(projectId: string): Promise<WebhookConfig | null> {
  return request<WebhookConfig | null>(`/api/projects/${projectId}/webhook`);
}

/** Creates or updates webhook config */
export async function upsertWebhook(projectId: string, data: UpsertWebhookRequest): Promise<WebhookConfig> {
  return request<WebhookConfig>(`/api/projects/${projectId}/webhook`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Deletes webhook config */
export async function deleteWebhook(projectId: string): Promise<void> {
  return request<void>(`/api/projects/${projectId}/webhook`, { method: 'DELETE' });
}

/** Lists recent webhook deliveries */
export async function listWebhookDeliveries(projectId: string): Promise<WebhookDelivery[]> {
  return request<WebhookDelivery[]>(`/api/projects/${projectId}/webhook/deliveries`);
}
