import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { OutputFile } from '@js-template-engine/types';

/**
 * Writes generated output files under the output directory.
 *
 * Directories are created as needed; existing files are overwritten.
 *
 * @param files - The files a `process()` call produced.
 * @param outputDirectory - The directory the files are written into.
 * @returns The written file paths.
 */
export function writeOutputFiles(
  files: OutputFile[],
  outputDirectory: string
): string[] {
  return files.map((file) => {
    const filePath = join(outputDirectory, file.path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, file.content);
    return filePath;
  });
}
