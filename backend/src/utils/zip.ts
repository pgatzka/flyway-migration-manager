import archiver from 'archiver';
import { PassThrough } from 'stream';

/** Entry for a file to include in a ZIP archive */
export interface ZipEntry {
  name: string;
  content: string;
}

/**
 * Creates a ZIP archive in memory from an array of file entries.
 * Returns a readable stream that can be piped to the HTTP response.
 * @param entries - Array of file name/content pairs to include in the archive
 * @returns A PassThrough stream containing the ZIP data
 */
export function createZipStream(entries: ZipEntry[]): PassThrough {
  const passThrough = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(passThrough);

  for (const entry of entries) {
    archive.append(entry.content, { name: entry.name });
  }

  archive.finalize();

  return passThrough;
}
