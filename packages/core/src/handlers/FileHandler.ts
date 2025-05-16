import fs from 'fs';
import path from 'path';
import type { TemplateNode, RenderOptions, Extension } from '@js-template-engine/types';
import type { TemplateOptions } from '../types';
import { createLogger } from '../helpers/createLogger';
import { TemplateEngine } from '../engine/TemplateEngine';

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

export function writeOutputFile(template: string, outputPath: string, verbose = false): void {
  const logger = createLogger(verbose, 'writeOutputFile');
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    logger.info(`Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, template, 'utf8');
}

export async function getSourcePathType(sourcePath: string): Promise<'directory' | 'file' | undefined> {
  const stats = fs.statSync(sourcePath);

  if (stats.isDirectory()) {
    return 'directory';
  }

  if (stats.isFile()) {
    return 'file';
  }

  return undefined;
}

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
    logger.error(`Error processing file ${sourcePath}: ${(error as Error).message}`);
  }
}

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