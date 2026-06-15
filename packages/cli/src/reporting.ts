import { relative } from 'node:path';

/**
 * The label a source file is reported under: its path relative to the
 * working directory, falling back to the absolute path outside of it.
 *
 * @param filePath - Absolute path of the source file.
 * @returns The display label.
 */
export function sourceLabel(filePath: string): string {
  const relativePath = relative(process.cwd(), filePath);
  return relativePath === '' || relativePath.startsWith('..')
    ? filePath
    : relativePath;
}

/**
 * Formats a thrown value for the error stream.
 *
 * @param error - The thrown value.
 * @returns Its message.
 */
export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
