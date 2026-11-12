import * as sass from 'sass';

import type {
  NestedSelectorBlock,
  NestedStyleObject,
  Warning,
} from '@js-template-engine/types';

import type { ResolvedStylingOptions } from '../extension';
import { isExpressionBinding } from '../expression-binding';
import { normalizeClassList, type NormalizedComponent } from '../normalize';
import { TemplateError } from '../TemplateError';
import { visitElements, visitNodes } from '../traverse';
import { serializeRulesScss } from './styles';

/** A selector extending `&` with a name, as `&--brand` or `&__title` do. */
const SELECTOR_SUFFIX = /&[-_A-Za-z0-9]/;

/**
 * The placeholder root each node's style is compiled under. Sass expands `&`
 * (and `#{&}` interpolations) against it; the compiled selectors are then
 * re-relativized back to `&` so the result is node-selector-agnostic and can
 * re-enter the engine's nested-`&` style IR unchanged. A class selector
 * survives interpolation cleanly (`#{&}--soft` → `....--soft`) and cannot occur
 * in real authored CSS.
 */
const PLACEHOLDER = '.JTE_SASS_ROOT_PLACEHOLDER';

/** What every compile of a component's Sass resolves loads against. */
interface SassCompiler {
  loadPaths: string[];
  importers: sass.Options<'sync'>['importers'];
}

/**
 * Warns about each selector still holding Sass interpolation (`#{&}--dense`)
 * in a component whose styles no Sass compile reads: the selector reaches
 * the stylesheet as written and matches nothing. Silent under
 * `styling.language: 'scss'`, where the consumer's Sass build resolves it,
 * and after {@link resolveSassStyles} has resolved it.
 *
 * @param component - The component, its Sass already resolved.
 * @param language - The stylesheet language.
 * @param rootPath - The path of the component's children.
 * @returns One warning per selector, its path naming the node's style.
 *
 * @example
 * // style: { '&:not(#{&}--dense)': { gap: '1rem' } }, language: 'css'
 * collectUnresolvedSassWarnings(component, 'css', 'children');
 */
export function collectUnresolvedSassWarnings(
  component: NormalizedComponent,
  language: 'css' | 'scss',
  rootPath: string
): Warning[] {
  if (language === 'scss') {
    return [];
  }
  const warnings: Warning[] = [];
  const visitStyle = (
    style: unknown,
    path: string,
    hasClass: boolean
  ): void => {
    if (typeof style !== 'object' || style === null || Array.isArray(style)) {
      return;
    }
    for (const [key, value] of Object.entries(style)) {
      if (key.includes('#{')) {
        warnings.push({
          message:
            `The selector '${key}' holds Sass interpolation, and these styles are not compiled through Sass, ` +
            `so it is written to the stylesheet as it stands and matches nothing. ` +
            (hasClass
              ? `Set the styling language to 'scss', or write the selector without #{...}`
              : `The element has no class for Sass to build on, so the 'scss' language would not help: ` +
                `give the element a class, or write the selector without #{...}`),
          nodePath: path,
        });
      } else if (!hasClass && SELECTOR_SUFFIX.test(key)) {
        warnings.push({
          message:
            `The selector '${key}' adds a suffix to '&', but the element has no class, so it is addressed by an ` +
            `attribute selector the suffix cannot extend: the rule is written as it stands and matches nothing. ` +
            `Give the element a class, or write the selector as a pseudo-class or an attribute`,
          nodePath: path,
        });
      }
      visitStyle(value, path, hasClass);
    }
  };
  visitNodes(component.children, rootPath, (node, path) => {
    if (node.type !== 'element') {
      return;
    }
    const hasClass =
      (
        component.selectorClasses?.get(node) ??
        normalizeClassList(node.attributes?.class)
      ).length > 0;
    visitStyle(node.attributes?.style, `${path}.attributes.style`, hasClass);
    (node.conditionalAttributes ?? []).forEach((conditional, index) => {
      visitStyle(
        conditional.attributes.style,
        `${path}.conditionalAttributes[${index}].attributes.style`,
        hasClass
      );
    });
  });
  return warnings;
}

/** A `@use`, `@forward` or `@import` of a `pkg:` URL in a preamble. */
const PACKAGE_URL_LOAD = /@(?:use|forward|import)\s+["']pkg:/;

/**
 * Resolves Sass source in a component's styles to flat CSS, for consumers
 * choosing `css` output or the `inline` placement.
 *
 * Under `styling.language: 'scss'` the engine passes Sass source through
 * verbatim (the consumer's own sass build resolves it); under `'css'` there
 * is no downstream sass build, so the engine resolves it here - expanding
 * `@include` mixins, functions, and `$variables` against `styling.loadPaths`
 * via Dart Sass. The result re-enters the normal pipeline as ordinary
 * nested-`&` style objects, so `collectCss` / `serializeInlineStyle` (and the
 * `inline` plain/nested split) run unchanged.
 *
 * A no-op when the language is `'scss'`, or when nothing requests resolution
 * (no load paths configured, no node carries an include, and the preamble
 * loads no `pkg:` URL). Never mutates
 * the input component - when resolution runs, it operates on a deep clone of
 * the children so a template shared across `process()` calls is untouched.
 *
 * @param component - The normalized component, before styling extensions.
 * @param styling - The resolved styling options (language, load paths).
 * @returns The component with Sass resolved, or the input unchanged.
 */
export function resolveSassStyles(
  component: NormalizedComponent,
  styling: ResolvedStylingOptions
): NormalizedComponent {
  if (styling.language === 'scss') {
    return component;
  }
  const preamble = component.style?.trim() ?? '';
  if (
    styling.loadPaths.length === 0 &&
    !componentHasInclude(component) &&
    !PACKAGE_URL_LOAD.test(preamble)
  ) {
    return component;
  }

  const compiler: SassCompiler = {
    loadPaths: styling.loadPaths,
    importers: styling.sassImporters as sass.Options<'sync'>['importers'],
  };

  const children = structuredClone(
    component.children
  ) as typeof component.children;
  visitElements(children, (element) => {
    const style = element.attributes?.style;
    // `resolveStyleObject` splits off any `$expression` (whole-object and
    // per-property) before compiling and merges them back, so a mixed node
    // and a pure whole-object expression are both handled here.
    if (style !== undefined) {
      element.attributes!.style = resolveStyleObject(style, preamble, compiler);
    }
    for (const conditional of element.conditionalAttributes ?? []) {
      const conditionalStyle = conditional.attributes.style;
      if (conditionalStyle !== undefined) {
        conditional.attributes.style = resolveStyleObject(
          conditionalStyle,
          preamble,
          compiler
        );
      }
    }
  });

  return {
    ...component,
    children,
    // The component-level style is the Sass preamble (`@use`, `$variables`,
    // mixins); its definitions emit no CSS. Whatever it does emit on its own
    // (e.g. `@keyframes`) becomes the resolved component style.
    style: emptyToUndefined(compilePreamble(preamble, compiler)),
  };
}

/**
 * Resolves one static style object to its flat-CSS nested-`&` form.
 *
 * Splits off `$expression`-valued top-level properties (runtime values, never
 * Sass), compiles the static remainder under {@link PLACEHOLDER} with the
 * preamble in scope, reconstructs the flat CSS into a nested-`&` style object,
 * then merges the dynamic properties back. A style with no static content
 * (only expression properties) is returned unchanged.
 */
function resolveStyleObject(
  style: NestedStyleObject,
  preamble: string,
  compiler: SassCompiler
): NestedStyleObject {
  const dynamic: NestedStyleObject = {};
  const staticStyle: NestedStyleObject = {};
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined) {
      continue;
    }
    // The whole-object `$expression` (a string) and per-property expression
    // values are runtime values, never Sass - split them off and merge back.
    if (key === '$expression' || isExpressionBinding(value)) {
      dynamic[key] = value;
    } else {
      staticStyle[key] = value;
    }
  }

  if (Object.keys(staticStyle).length === 0) {
    return style;
  }

  const block = serializeRulesScss(PLACEHOLDER, staticStyle);
  const source = preamble === '' ? block : `${preamble}\n${block}`;
  const css = compile(source, compiler);
  const resolved = reconstruct(parseCss(css));

  return { ...resolved, ...dynamic };
}

/** Compiles the preamble alone, returning the CSS its own rules emit. */
function compilePreamble(preamble: string, compiler: SassCompiler): string {
  if (preamble === '') {
    return '';
  }
  return compile(preamble, compiler).trim();
}

/** Runs Dart Sass, wrapping a compile failure as a `TemplateError`. */
function compile(
  source: string,
  { loadPaths, importers }: SassCompiler
): string {
  try {
    return sass.compileString(source, {
      loadPaths,
      importers,
      style: 'expanded',
    }).css;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new TemplateError(
      `Sass resolution failed (styling.language: 'css'): ${detail}`
    );
  }
}

/**
 * Reconstructs compiled CSS into a node's nested-`&` style object. The rule
 * matching the placeholder root exactly contributes its declarations as
 * top-level plain properties (so they inline under the `inline` placement);
 * every other placeholder-rooted rule becomes a nested-`&` key (so it routes
 * to a stylesheet). Rules with no placeholder reference (preamble output, e.g.
 * keyframes) are dropped - the preamble is compiled separately.
 */
function reconstruct(nodes: CssNode[]): NestedStyleObject {
  const style: NestedStyleObject = {};
  for (const node of nodes) {
    if (node.type === 'atRule') {
      // Sass emits a separate at-rule block per source branch, so the same
      // `@media ...` appears more than once; merge their inner rules under one
      // key (object keys are unique, and one combined block is equivalent).
      const existing = style[node.name];
      const inner: NestedSelectorBlock =
        typeof existing === 'object' &&
        existing !== null &&
        !Array.isArray(existing)
          ? (existing as NestedSelectorBlock)
          : {};
      for (const rule of node.nodes) {
        if (rule.type === 'rule' && referencesPlaceholder(rule.selector)) {
          inner[relativize(rule.selector)] = declarationsToStyle(
            rule.declarations
          );
        }
      }
      if (Object.keys(inner).length > 0) {
        style[node.name] = inner;
      }
      continue;
    }
    if (!referencesPlaceholder(node.selector)) {
      continue;
    }
    const declarations = declarationsToStyle(node.declarations);
    if (isPlaceholderRoot(node.selector)) {
      Object.assign(style, declarations);
    } else {
      style[relativize(node.selector)] = declarations;
    }
  }
  return style;
}

function declarationsToStyle(declarations: Declaration[]): NestedSelectorBlock {
  const style: NestedSelectorBlock = {};
  for (const { property, value } of declarations) {
    style[property] = value;
  }
  return style;
}

function referencesPlaceholder(selector: string): boolean {
  return selector.includes(PLACEHOLDER);
}

/** True when the selector is the placeholder root alone (the node itself). */
function isPlaceholderRoot(selector: string): boolean {
  return selector.trim() === PLACEHOLDER;
}

/** Re-relativizes a compiled selector: the placeholder root becomes `&`. */
function relativize(selector: string): string {
  return selector.split(PLACEHOLDER).join('&').trim();
}

function emptyToUndefined(value: string): string | undefined {
  return value === '' ? undefined : value;
}

interface Declaration {
  property: string;
  value: string;
}

type CssNode =
  | { type: 'rule'; selector: string; declarations: Declaration[] }
  | { type: 'atRule'; name: string; nodes: CssNode[] };

/**
 * A minimal parser for the regular, expanded CSS Dart Sass emits: style rules
 * (`selector { prop: value; ... }`) and nested at-rules (`@media ... { ... }`).
 * Declarations split on top-level semicolons (paren-aware, so `rgb(a, b)` and
 * `calc(... )` values stay intact). Sufficient for compiled Sass output; not a
 * general CSS parser.
 */
function parseCss(css: string): CssNode[] {
  const nodes: CssNode[] = [];
  let index = 0;

  const parseBlock = (): CssNode[] => {
    const result: CssNode[] = [];
    let prelude = '';
    while (index < css.length) {
      const char = css[index];
      if (char === '}') {
        index += 1;
        break;
      }
      if (char === '{') {
        index += 1;
        const head = prelude.trim();
        prelude = '';
        if (head.startsWith('@')) {
          result.push({ type: 'atRule', name: head, nodes: parseBlock() });
        } else {
          result.push({
            type: 'rule',
            selector: head,
            declarations: parseDeclarations(),
          });
        }
        continue;
      }
      prelude += char;
      index += 1;
    }
    return result;
  };

  // Parse declarations of a style rule, stopping at the closing brace. A
  // nested block would mean an at-rule inside a style rule (not emitted for
  // these inputs); declarations are split on paren-aware top-level `;`.
  const parseDeclarations = (): Declaration[] => {
    let body = '';
    while (index < css.length && css[index] !== '}') {
      body += css[index];
      index += 1;
    }
    index += 1; // consume '}'
    return splitDeclarations(body);
  };

  while (index < css.length) {
    const before = index;
    nodes.push(...parseBlock());
    if (index === before) {
      index += 1;
    }
  }
  return nodes;
}

function splitDeclarations(body: string): Declaration[] {
  const declarations: Declaration[] = [];
  let depth = 0;
  let current = '';
  const flush = (): void => {
    const trimmed = current.trim();
    current = '';
    if (trimmed === '') {
      return;
    }
    const colon = trimmed.indexOf(':');
    if (colon === -1) {
      return;
    }
    declarations.push({
      property: trimmed.slice(0, colon).trim(),
      value: trimmed.slice(colon + 1).trim(),
    });
  };
  for (const char of body) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }
    if (char === ';' && depth === 0) {
      flush();
      continue;
    }
    current += char;
  }
  flush();
  return declarations;
}

/** Whether any node in the component carries a `$include` in its styles. */
function componentHasInclude(component: NormalizedComponent): boolean {
  let found = false;
  visitElements(component.children, (element) => {
    if (styleHasInclude(element.attributes?.style)) {
      found = true;
    }
    for (const conditional of element.conditionalAttributes ?? []) {
      if (styleHasInclude(conditional.attributes.style)) {
        found = true;
      }
    }
  });
  return found;
}

function styleHasInclude(style: NestedStyleObject | undefined): boolean {
  if (style === undefined) {
    return false;
  }
  // `objectHasInclude` skips the string-valued `$expression` key, so a mixed
  // whole-object node is still gated in for resolution by its `@include` keys.
  return objectHasInclude(style);
}

function objectHasInclude(style: NestedStyleObject): boolean {
  for (const [key, value] of Object.entries(style)) {
    // The `$include` leaf key (no-content includes) or an `@include ...`
    // at-rule key (content-bearing includes) - either form is Sass source
    // that needs resolution under `css`/`inline`.
    if (key === '$include' || key.startsWith('@include')) {
      return true;
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isExpressionBinding(value) &&
      objectHasInclude(value as NestedStyleObject)
    ) {
      return true;
    }
  }
  return false;
}
