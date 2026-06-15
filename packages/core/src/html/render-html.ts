import type {
  OutputFile,
  ProcessResult,
  Warning,
} from '@js-template-engine/types';

import type { ResolvedProcessingOptions } from '../extension';
import type { NormalizedComponent } from '../normalize';
import { renderMarkup } from './markup';
import { buildScript } from './scripts';
import { collectCss } from './styles';
import { planTargets } from './targeting';

/**
 * Renders a component to static HTML, CSS, and JavaScript.
 *
 * This is the engine's foundational rendering path: a zero-dependency
 * static preview. The engine generates no rendering logic, no reactivity,
 * and no DOM manipulation code; dynamic concepts render as placeholders
 * and debug comments.
 *
 * With the default `in-file` strategies the result is a single `.html`
 * file containing a `<style>` block, the markup, and a `<script>` block.
 * The `separate-file` strategies move styles and scripts into `.css` and
 * `.js` files referenced from the markup (`.scss` / `.ts` under the `scss`
 * styling and `typescript` scripting languages); the `inline` strategies render
 * styles as `style` attributes and event handlers as `on*` attributes
 * where possible (nested style selectors and component script content
 * still require their blocks).
 */
export function renderHtml(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions
): ProcessResult {
  const stylingStrategy = options.styling.outputStrategy;
  const scriptingStrategy = options.scripting.outputStrategy;
  const styleExtension = options.styling.language === 'scss' ? 'scss' : 'css';
  const scriptExtension =
    options.scripting.language === 'typescript' ? 'ts' : 'js';
  const warnings: Warning[] = [];

  const plan = planTargets(
    component.children,
    stylingStrategy,
    scriptingStrategy,
    component.selectorClasses
  );
  const css = collectCss(component, plan, stylingStrategy, options.styling.language);
  const markup = renderMarkup(component.children, {
    plan,
    stylingInline: stylingStrategy === 'inline',
    scriptingInline: scriptingStrategy === 'inline',
    warnings,
  });
  const script = buildScript(
    component,
    plan,
    scriptingStrategy,
    options.scripting.language,
    warnings
  );

  const sections: string[] = [];
  const files: OutputFile[] = [];

  if (css !== '') {
    if (stylingStrategy === 'separate-file') {
      sections.push(
        `<link rel="stylesheet" href="${component.name}.${styleExtension}">`
      );
    } else {
      sections.push(`<style>\n${css}\n</style>`);
    }
  }

  sections.push(markup);

  if (script !== '') {
    if (scriptingStrategy === 'separate-file') {
      sections.push(
        `<script src="${component.name}.${scriptExtension}"></script>`
      );
    } else {
      sections.push(`<script>\n${script}\n</script>`);
    }
  }

  files.push({
    path: `${component.name}.html`,
    content: `${sections.join('\n\n')}\n`,
  });
  if (css !== '' && stylingStrategy === 'separate-file') {
    files.push({
      path: `${component.name}.${styleExtension}`,
      content: `${css}\n`,
    });
  }
  if (script !== '' && scriptingStrategy === 'separate-file') {
    files.push({
      path: `${component.name}.${scriptExtension}`,
      content: `${script}\n`,
    });
  }

  return { files, warnings };
}
