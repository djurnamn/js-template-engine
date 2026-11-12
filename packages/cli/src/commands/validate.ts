import { validateTemplate } from '@js-template-engine/core';

import { everyTargetExtension } from '../extensions';
import { errorLines, formatError, sourceLabel } from '../reporting';
import { loadTemplate, resolveTemplateSources } from '../template-sources';

/**
 * Validates one template file, or every template in a directory.
 *
 * Each valid template is confirmed on stdout; each invalid one is reported
 * on stderr, one line per violation with its node path. The command exits
 * non-zero when any template fails to load or validate. A template is
 * validated for every target the CLI renders with, so a name any of
 * their outputs declares is reserved.
 *
 * @param source - A template file or a directory of template files.
 */
export async function validateCommand(source: string): Promise<void> {
  let sources: string[];
  try {
    sources = resolveTemplateSources(source);
  } catch (error) {
    console.error(`error: ${formatError(error)}`);
    process.exitCode = 1;
    return;
  }

  const extensions = everyTargetExtension();
  let failed = false;
  for (const filePath of sources) {
    const label = sourceLabel(filePath);
    try {
      const template = await loadTemplate(filePath);
      validateTemplate(template, { extensions });
      console.log(`${label}: valid`);
    } catch (error) {
      failed = true;
      for (const line of errorLines(error)) {
        console.error(`${label}: invalid - ${line}`);
      }
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}
