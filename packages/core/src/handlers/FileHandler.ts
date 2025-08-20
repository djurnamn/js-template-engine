import fs from 'fs';
import path from 'path';
import type { TemplateNode, Extension } from '@js-template-engine/types';
import { createLogger } from '../utils/logger';
import { TemplateEngine } from '../engine/TemplateEngine';

/**
 * Reads and parses a JSON file containing template nodes.
 * @param sourcePath - The path to the JSON file to read.
 * @returns An array of template nodes.
 * @throws Error if the file cannot be read, contains invalid JSON, or the data is not an array.
 */
export function readJsonFile(sourcePath: string): TemplateNode[] {
  try {
    const fileContent = fs.readFileSync(sourcePath, 'utf8');
    const data = JSON.parse(fileContent);

    if (!Array.isArray(data)) {
      throw new Error('Template data must be an array of nodes');
    }

    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file ${sourcePath}: ${error.message}`);
    }
    if (error instanceof Error) {
      throw new Error(`Error reading file ${sourcePath}: ${error.message}`);
    }
    throw new Error(`Unknown error reading file ${sourcePath}`);
  }
}

/**
 * Writes template output to a file.
 * Creates the output directory if it doesn't exist.
 * @param template - The template string to write.
 * @param outputPath - The path where the file should be written.
 * @param verbose - Whether to enable verbose logging.
 */
export function writeOutputFile(
  template: string,
  outputPath: string,
  verbose = false
): void {
  const logger = createLogger(verbose, 'writeOutputFile');
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    logger.info(`Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, template, 'utf8');
}

/**
 * Determines the type of a source path (file, directory, or undefined).
 * @param sourcePath - The path to check.
 * @returns A promise that resolves to the type of the path.
 */
export async function getSourcePathType(
  sourcePath: string
): Promise<'directory' | 'file' | undefined> {
  const stats = fs.statSync(sourcePath);

  if (stats.isDirectory()) {
    return 'directory';
  }

  if (stats.isFile()) {
    return 'file';
  }

  return undefined;
}

/**
 * Processes a single JSON file containing template data.
 * Renders the template and writes the output to the specified directory.
 * @param sourcePath - The path to the source JSON file.
 * @param outputDir - The directory where output files should be written.
 * @param extensions - Array of extensions to use for rendering.
 * @param templateEngine - The template engine instance to use.
 * @param name - Optional name for the template.
 * @param componentName - Optional component name for framework-specific templates.
 * @param verbose - Whether to enable verbose logging.
 * @returns A promise that resolves when processing is complete.
 */
export async function processFile(
  sourcePath: string,
  outputDir: string,
  extensions: Extension[],
  templateEngine: TemplateEngine,
  name?: string,
  componentName?: string,
  verbose = false
): Promise<void> {
  const logger = createLogger(verbose, 'processFile');
  logger.info(`Processing file: ${sourcePath}`);

  const templateData = readJsonFile(sourcePath);
  const filenameWithoutExtension = path.basename(sourcePath, '.json');

  try {
    await templateEngine.render(templateData, {
      name: name ?? filenameWithoutExtension,
      componentName,
      outputDir,
      extensions,
      writeOutputFile: true,
      verbose,
    });
    logger.success(`Successfully processed file: ${sourcePath}`);
  } catch (error) {
    logger.error(
      `Error processing file ${sourcePath}: ${(error as Error).message}`
    );
  }
}

/**
 * Processes all JSON files in a directory recursively.
 * Renders each template and writes outputs to the corresponding output directory.
 * @param sourceDir - The source directory containing JSON files.
 * @param outputDir - The output directory where rendered files should be written.
 * @param extensions - Array of extensions to use for rendering.
 * @param templateEngine - The template engine instance to use.
 * @param verbose - Whether to enable verbose logging.
 * @returns A promise that resolves when all files have been processed.
 */
export async function processDirectory(
  sourceDir: string,
  outputDir: string,
  extensions: Extension[],
  templateEngine: TemplateEngine,
  verbose = false
): Promise<void> {
  const logger = createLogger(verbose, 'processDirectory');
  logger.info(`Processing directory: ${sourceDir}`);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntryPath = path.join(sourceDir, entry.name);
    const outputEntryPath = path.join(outputDir ?? 'dist', entry.name);

    if (entry.isDirectory()) {
      logger.info(`Entering directory: ${entry.name}`);
      await processDirectory(
        sourceEntryPath,
        outputEntryPath,
        extensions,
        templateEngine,
        verbose
      );
    } else if (entry.isFile() && path.extname(entry.name) === '.json') {
      logger.info(`Found JSON file: ${entry.name}`);
      const templateData = readJsonFile(sourceEntryPath);
      const filenameWithoutExtension = path.basename(entry.name, '.json');

      await templateEngine.render(templateData, {
        name: filenameWithoutExtension,
        outputDir,
        extensions,
        writeOutputFile: true,
        verbose,
      });
    }
  }
}
