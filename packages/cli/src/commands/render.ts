import { relative, resolve } from 'node:path';

import { process as processTemplate } from '@js-template-engine/core';
import type { OutputStrategy } from '@js-template-engine/types';

import { componentNameFromFilePath } from '../component-name';
import {
  buildExtensions,
  type FrameworkName,
  type StylingName,
} from '../extensions';
import { writeOutputFiles } from '../output';
import { formatError, sourceLabel } from '../reporting';
import { loadTemplate, resolveTemplateSources } from '../template-sources';

/** The `render` command's parsed options. */
export interface RenderCommandOptions {
  framework?: FrameworkName;
  styling: StylingName[];
  outputDirectory: string;
  componentName?: string;
  stylingStrategy: OutputStrategy;
  stylingLanguage: 'css' | 'scss';
  loadPath: string[];
  scriptingStrategy: OutputStrategy;
  scriptingLanguage: 'javascript' | 'typescript';
  bemElementSeparator?: string;
  bemModifierSeparator?: string;
  bemMode?: 'literal' | 'runtime';
  bemImportSource?: string;
  tailwindOutput?: 'classes' | 'styles';
  tailwindConvertStyles?: boolean;
}

/**
 * Renders one template file, or every template in a directory, and writes
 * the generated files under the output directory.
 *
 * Warnings go to stderr; written files are listed on stdout. A template
 * that fails to load or process is reported and does not stop the
 * remaining templates; any failure makes the command exit non-zero.
 *
 * @param source - A template file or a directory of template files.
 * @param options - The parsed command-line options.
 */
export async function renderCommand(
  source: string,
  options: RenderCommandOptions
): Promise<void> {
  let sources: string[];
  try {
    sources = resolveTemplateSources(source);
  } catch (error) {
    console.error(`error: ${formatError(error)}`);
    process.exitCode = 1;
    return;
  }

  let failed = false;
  for (const filePath of sources) {
    const label = sourceLabel(filePath);
    try {
      const template = await loadTemplate(filePath);
      const result = processTemplate(template, {
        componentName:
          options.componentName ?? componentNameFromFilePath(filePath),
        extensions: buildExtensions(
          options.framework,
          options.styling,
          {
            elementSeparator: options.bemElementSeparator,
            modifierSeparator: options.bemModifierSeparator,
            mode: options.bemMode,
            importSource: options.bemImportSource,
          },
          {
            output: options.tailwindOutput,
            convertStyles: options.tailwindConvertStyles,
          }
        ),
        styling: {
          outputStrategy: options.stylingStrategy,
          language: options.stylingLanguage,
          loadPaths: options.loadPath.map((path) => resolve(path)),
        },
        scripting: {
          outputStrategy: options.scriptingStrategy,
          language: options.scriptingLanguage,
        },
      });

      for (const warning of result.warnings) {
        const location =
          warning.nodePath === undefined || warning.nodePath === ''
            ? ''
            : ` (at ${warning.nodePath})`;
        console.error(`${label}: warning: ${warning.message}${location}`);
      }

      for (const writtenPath of writeOutputFiles(
        result.files,
        options.outputDirectory
      )) {
        console.log(`wrote ${relative(process.cwd(), writtenPath)}`);
      }
    } catch (error) {
      failed = true;
      console.error(`${label}: error: ${formatError(error)}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}
