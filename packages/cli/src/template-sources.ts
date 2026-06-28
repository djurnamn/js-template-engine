import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

import type { Template } from '@js-template-engine/types';
import { createJiti } from 'jiti';

/** The file extensions recognized as template sources. */
const templateFileExtensions = ['.json', '.ts', '.js', '.mjs', '.cjs'];

const jiti = createJiti(__filename, { interopDefault: true });

/**
 * Resolves a source argument to the template files it names.
 *
 * A file path resolves to itself; a directory resolves to every template
 * file directly inside it (`.json`, `.ts`, `.js`, `.mjs`, `.cjs`), sorted
 * by name. Subdirectories are not searched.
 *
 * @param source - A template file or a directory of template files.
 * @returns Absolute paths of the template files to process.
 */
export function resolveTemplateSources(source: string): string[] {
  const absolute = resolve(source);
  if (!existsSync(absolute)) {
    throw new Error(`Template source '${source}' does not exist`);
  }
  if (statSync(absolute).isFile()) {
    return [absolute];
  }

  const files = readdirSync(absolute, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        templateFileExtensions.includes(extname(entry.name)) &&
        !entry.name.endsWith('.d.ts')
    )
    .map((entry) => join(absolute, entry.name))
    .sort();

  if (files.length === 0) {
    throw new Error(`No template files found in '${source}'`);
  }
  return files;
}

/**
 * Loads a template from a file.
 *
 * `.json` files are parsed as JSON. `.ts`, `.js`, `.mjs`, and `.cjs` files
 * are loaded as modules and must default-export the template.
 *
 * @param filePath - Absolute path of the template file.
 * @returns The template the file defines.
 */
export async function loadTemplate(filePath: string): Promise<Template> {
  if (extname(filePath) === '.json') {
    return JSON.parse(readFileSync(filePath, 'utf8')) as Template;
  }

  const template = await jiti.import(filePath, { default: true });
  if (!isTemplateShaped(template)) {
    throw new Error(`'${filePath}' does not default-export a template`);
  }
  return template as Template;
}

/**
 * Whether a module's default export has a template's root shape - a node
 * array or a node object. Modules without a default export resolve to
 * their namespace object, which this rules out.
 */
function isTemplateShaped(value: unknown): boolean {
  if (Array.isArray(value)) {
    return true;
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}
