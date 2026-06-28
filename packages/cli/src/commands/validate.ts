import { validateTemplate } from '@js-template-engine/core';

import { formatError, sourceLabel } from '../reporting';
import { loadTemplate, resolveTemplateSources } from '../template-sources';

/**
 * Validates one template file, or every template in a directory.
 *
 * Each valid template is confirmed on stdout; each invalid one is reported
 * on stderr with the offending node path. The command exits non-zero when
 * any template fails to load or validate.
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

  let failed = false;
  for (const filePath of sources) {
    const label = sourceLabel(filePath);
    try {
      const template = await loadTemplate(filePath);
      validateTemplate(template);
      console.log(`${label}: valid`);
    } catch (error) {
      failed = true;
      console.error(`${label}: invalid - ${formatError(error)}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}
