import type {
  OutputFile,
  ProcessResult,
  Warning,
} from '@js-template-engine/types';

import type { ResolvedProcessingOptions } from '../extension';
import type { NormalizedComponent } from '../normalize';
import {
  discriminatedSurfaceOf,
  flattenDiscriminatedProps,
} from '../passthrough';
import { routedElementOf } from '../passthrough-routing';
import { declaredIdsOf, idComment, RestIdCounter } from '../declared-ids';
import { derivedComment, derivedValuesOf } from '../derived-values';
import {
  relayedBindingsOf,
  relayedComment,
  twoWayBindingsOf,
  twoWayComment,
} from '../two-way-bindings';
import { renderMarkup } from './markup';
import { printNodes } from './serialize';
import { collectCss, stylesheetFiles } from './styles';
import { planTargets } from './targeting';

/**
 * Renders a component to an annotated HTML reference and its CSS.
 *
 * This is the engine's foundational rendering path: zero-dependency markup
 * a person copies into any framework, server template or static page and
 * adapts from there. It contains no script - no rendering logic, no
 * reactivity, no event wiring. Everything plain HTML cannot express is
 * written as a comment where it sits, and expressions as `{{ expression }}`
 * placeholders. A two-way prop's value (its `bindable` object's `current`)
 * is introduced by a comment at the head of the markup naming the prop and
 * its fallback. A declared id takes the value `prefix-1` here, written
 * wherever an expression reads only ids, with a comment at the head naming
 * it.
 *
 * With the default `in-file` stylesheet placement the result is a single
 * `.html` file containing a `<style>` block and the markup. The
 * `separate-file` placement moves styles into a `.css` file (`.scss` under
 * the `scss` styling language) linked from the markup - `styling.
 * stylesheetLink: 'none'` emits the stylesheet without the `<link>`; the
 * `inline` placement renders styles as `style` attributes where possible
 * (nested style selectors still require a `<style>` block).
 */
export function renderHtml(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions
): ProcessResult {
  const placement = options.styling.placement;
  const styleExtension = options.styling.language === 'scss' ? 'scss' : 'css';
  const warnings: Warning[] = [];

  const plan = planTargets(
    component.children,
    placement,
    undefined,
    component.selectorClasses,
    component.name
  );
  const css = collectCss(
    component,
    plan,
    placement,
    options.styling.language,
    options.styling.layer
  );
  // Each declared id takes its first value at rest, `prefix-1`, so the
  // markup's id wiring works as written.
  const counter = new RestIdCounter();
  const ids = declaredIdsOf(component).map((id) => ({
    id,
    value: counter.next(id.prefix),
  }));
  const surface = discriminatedSurfaceOf(component.children);
  const markup = renderMarkup(component.children, {
    plan,
    stylingInline: placement === 'inline',
    warnings,
    routed: routedElementOf(component.children),
    declaredNames: new Set(
      Object.keys(
        surface === undefined
          ? component.props
          : flattenDiscriminatedProps(
              component.props,
              surface.branches.map((entry) => entry.branch.props ?? {})
            )
      )
    ),
    ids: new Map(ids.map(({ id, value }) => [id.name, value])),
  });

  const sections: string[] = [];
  const files: OutputFile[] = [];

  if (css !== '') {
    if (placement === 'separate-file') {
      // Under `stylesheetLink: 'none'` the stylesheet is still emitted below;
      // the document just does not link it, leaving that to the consumer.
      if (options.styling.stylesheetLink === 'component') {
        sections.push(
          `<link rel="stylesheet" href="${component.name}.${styleExtension}">`
        );
      }
    } else {
      sections.push(`<style>\n${css}\n</style>`);
    }
  }

  // A two-way prop's value is read under a name the markup cannot declare;
  // a comment at the head says where it comes from, and for a relayed
  // value what reports it.
  const bindingComments = [
    ...twoWayBindingsOf(component.props).map((binding) =>
      printNodes([
        {
          kind: 'comment',
          text: twoWayComment(binding, (value) =>
            typeof value === 'string'
              ? `'${value.replace(/'/g, "\\'")}'`
              : JSON.stringify(value)
          ),
        },
      ])
    ),
    ...relayedBindingsOf(component.props).map((binding) =>
      printNodes([{ kind: 'comment', text: relayedComment(binding) }])
    ),
  ];
  // A derived value is read by its name too; its comment says what it is
  // computed from.
  const derivedComments = derivedValuesOf(component).map((value) =>
    printNodes([{ kind: 'comment', text: derivedComment(value) }])
  );
  // A declared id is read by its name; its comment gives the value it takes
  // here, which the markup writes wherever an expression reads only ids.
  const idComments = ids.map(({ id, value }) =>
    printNodes([{ kind: 'comment', text: idComment(id, value) }])
  );
  sections.push(
    [...bindingComments, ...idComments, ...derivedComments, markup].join('\n')
  );

  files.push({
    path: `${component.name}.html`,
    content: `${sections.join('\n\n')}\n`,
  });
  if (css !== '' && placement === 'separate-file') {
    files.push(...stylesheetFiles(component.name, css, options.styling));
  }

  return { files, warnings };
}
