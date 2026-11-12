import { relative, resolve } from 'node:path';

import { process as processTemplate } from '@js-template-engine/core';
import { isDarkSelector } from '@js-template-engine/extension-tailwind';
import type {
  StylesheetLink,
  StylesheetPlacement,
} from '@js-template-engine/types';

import { componentNameFromFilePath } from '../component-name';
import {
  buildExtensions,
  everyTargetExtension,
  type FrameworkName,
  type StylingName,
  type TargetName,
} from '../extensions';
import { writeOutputFiles } from '../output';
import { errorLines, formatError, sourceLabel } from '../reporting';
import { loadTemplate, resolveTemplateSources } from '../template-sources';

/** The `render` command's parsed options. */
export interface RenderCommandOptions {
  /** The target to render to; omitted or `html` renders HTML. */
  target?: TargetName;
  /**
   * @deprecated Use `target` instead. `framework` is kept as an alias until
   * the next major version.
   */
  framework?: FrameworkName;
  styling: StylingName[];
  outputDirectory: string;
  componentName?: string;
  /** Where the component's styles go; defaults to `'in-file'`. */
  stylesheetPlacement?: StylesheetPlacement;
  /**
   * @deprecated Use `stylesheetPlacement` instead. `stylingStrategy` is kept
   * as an alias until the next major version.
   */
  stylingStrategy?: StylesheetPlacement;
  stylingLanguage: 'css' | 'scss';
  stylesheetLink: StylesheetLink;
  stylingLayer?: string;
  stylingLayerOrder: string[];
  loadPath: string[];
  /** @deprecated Has no effect; accepted with a warning. */
  scriptingStrategy?: StylesheetPlacement;
  /** @deprecated Has no effect; accepted with a warning. */
  scriptingLanguage?: 'javascript' | 'typescript';
  bemElementSeparator?: string;
  bemModifierSeparator?: string;
  bemMode?: 'literal' | 'runtime';
  bemImportSource?: string;
  tailwindOutput?: 'classes' | 'styles';
  tailwindDarkSelector?: string;
  tailwindConvertStyles?: boolean;
  svelteMode?: 'legacy' | 'runes';
}

/** Printed once when a deprecated scripting flag is passed. */
const SCRIPTING_DEPRECATION =
  'warning: --scripting-strategy and --scripting-language are deprecated, have no effect ' +
  'and will be removed in 3.0.0; the html target writes events as comments and emits no script.';

/**
 * Resolves a flag that has a deprecated alias: the current flag's value, or
 * the alias's with a warning on stderr. Both given with different values is
 * an error, reported on stderr.
 *
 * @param current - The current flag's name and value.
 * @param alias - The deprecated alias's name and value.
 * @returns The resolved value, or `{ error: true }` when the two disagree.
 */
function resolveAliasedFlag<Value>(
  current: { flag: string; value: Value | undefined },
  alias: { flag: string; value: Value | undefined }
): { value: Value | undefined } | { error: true } {
  if (alias.value === undefined) {
    return { value: current.value };
  }
  if (current.value !== undefined && current.value !== alias.value) {
    console.error(
      `error: ${alias.flag} ${String(alias.value)} and ${current.flag} ${String(current.value)} disagree; pass ${current.flag} alone`
    );
    return { error: true };
  }
  console.error(
    `warning: ${alias.flag} is deprecated and will be removed in 3.0.0; use ${current.flag}`
  );
  return { value: alias.value };
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

  if (
    options.tailwindDarkSelector !== undefined &&
    !isDarkSelector(options.tailwindDarkSelector)
  ) {
    console.error(
      `error: --tailwind-dark-selector takes a selector, such as '[data-mode="dark"]' or ':root[data-mode="dark"] &', with & in every member of a list or in none; received ${JSON.stringify(options.tailwindDarkSelector)}`
    );
    process.exitCode = 1;
    return;
  }

  const target = resolveAliasedFlag<TargetName>(
    { flag: '--target', value: options.target },
    { flag: '--framework', value: options.framework }
  );
  const placement = resolveAliasedFlag<StylesheetPlacement>(
    { flag: '--stylesheet-placement', value: options.stylesheetPlacement },
    { flag: '--styling-strategy', value: options.stylingStrategy }
  );
  if ('error' in target || 'error' in placement) {
    process.exitCode = 1;
    return;
  }

  if (
    options.scriptingStrategy !== undefined ||
    options.scriptingLanguage !== undefined
  ) {
    console.error(SCRIPTING_DEPRECATION);
  }

  let failed = false;
  for (const filePath of sources) {
    const label = sourceLabel(filePath);
    try {
      const template = await loadTemplate(filePath);
      const result = processTemplate(template, {
        componentName:
          options.componentName ?? componentNameFromFilePath(filePath),
        // Every target's names stay reserved, as `validate` reserves them,
        // so a prop's alias is the same whichever target renders.
        reserveNamesOf: everyTargetExtension(),
        extensions: buildExtensions(
          target.value,
          options.styling,
          {
            elementSeparator: options.bemElementSeparator,
            modifierSeparator: options.bemModifierSeparator,
            mode: options.bemMode,
            importSource: options.bemImportSource,
          },
          {
            output: options.tailwindOutput,
            darkSelector: options.tailwindDarkSelector,
            convertStyles: options.tailwindConvertStyles,
          },
          {
            mode: options.svelteMode,
          }
        ),
        styling: {
          placement: placement.value ?? 'in-file',
          language: options.stylingLanguage,
          stylesheetLink: options.stylesheetLink,
          loadPaths: options.loadPath.map((path) => resolve(path)),
          layer:
            options.stylingLayer === undefined
              ? undefined
              : {
                  name: options.stylingLayer,
                  order:
                    options.stylingLayerOrder.length > 0
                      ? options.stylingLayerOrder
                      : undefined,
                },
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
      for (const line of errorLines(error)) {
        console.error(`${label}: error: ${line}`);
      }
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}
