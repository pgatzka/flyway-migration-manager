import type { FlywayFileName } from '../../../shared/types.js';
import { ImportParseError } from '../errors/index.js';

/**
 * Parses a Flyway-convention filename into version and description.
 * Expected format: V{version}__{description}.sql
 * Example: V3__Create_users_table.sql → { version: 3, description: "Create users table" }
 * @param fileName - The file name to parse
 * @returns Parsed version number and description
 * @throws ImportParseError if the file name doesn't match the convention
 */
export function parseFlywayFileName(fileName: string): FlywayFileName {
  const match = fileName.match(/^V(\d+)__(.+)\.sql$/i);
  if (!match) {
    throw new ImportParseError(fileName);
  }

  const version = parseInt(match[1], 10);
  // Replace underscores with spaces for a human-readable description
  const description = match[2].replace(/_/g, ' ');

  return { version, description };
}

/**
 * Generates a Flyway-convention filename from version and description.
 * Example: (3, "Create users table") → "V3__Create_users_table.sql"
 * @param version - Migration version number
 * @param description - Human-readable description
 * @returns Formatted Flyway filename
 */
export function generateFlywayFileName(version: number, description: string): string {
  // Replace spaces with underscores for the filename
  const sanitized = description.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  return `V${version}__${sanitized}.sql`;
}
