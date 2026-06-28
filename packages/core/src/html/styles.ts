import type { NestedStyleObject } from '@js-template-engine/types';

import { isExpressionBinding } from '../expression-binding';
import type { CollapseVocabulary, NormalizedComponent } from '../normalize';
import { normalizeClassList } from '../normalize';
import { visitElements } from '../traverse';
import { hasIncludes, hasNestedSelectors, type TargetPlan } from './targeting';

/**
 * Collects all stylesheet CSS for a component: the component-level style
 * block first, then element style rules in document order, then rules
 * carried by conditional attributes (hung on their first conditional
 * class). Returns an empty string when there is nothing to emit.
 *
 * Under the `inline` styling strategy, element styles consisting solely of
 * plain properties render as `style` attributes instead and are skipped
 * here; styles with nested selectors always require a stylesheet.
 */
export function collectCss(
  component: NormalizedComponent,
  plan: TargetPlan,
  stylingStrategy: string,
  language: 'css' | 'scss' = 'css'
): string {
  const chunks: string[] = [];

  const serialize = (
    selector: string,
    style: NestedStyleObject,
    collapse?: readonly CollapseVocabulary[]
  ): string[] =>
    language === 'scss'
      ? [serializeRulesScss(selector, style, collapse)].filter(
          (block) => block !== ''
        )
      : serializeRules(selector, style, collapse);

  // Under language: 'scss' the component-level style string is the
  // file-scope preamble (@use / $variables / mixins / @keyframes), emitted
  // verbatim ahead of every node-derived rule (sass requires @use at the
  // top); under 'css' it is opaque component CSS in the same position.
  if (component.style !== undefined && component.style.trim() !== '') {
    chunks.push(component.style.trim());
  }

  visitElements(component.children, (element) => {
    const style = element.attributes?.style;
    // A whole-object `$expression` may sit beside static / nested / include
    // keys; the serializer skips the `$expression` key, so a mixed node still
    // emits its stylesheet rule and a pure whole-object expression emits
    // nothing (it has no selector planned, so `target` is undefined below).
    if (style !== undefined) {
      const stylesheetBound =
        stylingStrategy !== 'inline' ||
        hasNestedSelectors(style) ||
        hasIncludes(style);
      const target = plan.get(element);
      if (stylesheetBound && target) {
        chunks.push(
          ...serialize(
            target.selector,
            style,
            component.collapseVocabulary?.get(element)
          )
        );
      }
    }

    for (const conditional of element.conditionalAttributes ?? []) {
      const conditionalStyle = conditional.attributes.style;
      if (conditionalStyle === undefined || isExpressionBinding(conditionalStyle)) {
        continue;
      }
      const conditionalClasses = normalizeClassList(
        conditional.attributes.class
      );
      if (conditionalClasses.length > 0) {
        chunks.push(...serialize(`.${conditionalClasses[0]}`, conditionalStyle));
      }
    }
  });

  return chunks.join('\n\n');
}

/**
 * Serializes a nested style object into CSS rule blocks for a selector.
 * Pseudo-selector keys append to the selector, keys containing `&`
 * substitute it, and at-rule keys (`@media ...`) wrap their rules; the
 * shapes compose recursively, at-rules wrapping outermost. Expression
 * values are runtime values and never enter generated CSS.
 */
export function serializeRules(
  selector: string,
  style: NestedStyleObject,
  collapse?: readonly CollapseVocabulary[]
): string[] {
  const rules: string[] = [];
  const declarations: string[] = [];

  for (const [key, value] of Object.entries(style)) {
    // Sass source keys (`$include`, `@include ...`) never enter flattened CSS - 
    // resolution consumes them ahead of this serializer under language: 'css'.
    // The whole-object `$expression` is a runtime value (dynamic mechanism),
    // never a stylesheet declaration. Array and boolean values belong to the
    // Sass keys; skip any other to stay defensive.
    if (
      key === '$expression' ||
      key === '$include' ||
      key.startsWith('@include') ||
      value === undefined
    ) {
      continue;
    }
    if (typeof value === 'object' || typeof value === 'boolean') {
      continue;
    }
    declarations.push(`  ${toKebabCaseProperty(key)}: ${value};`);
  }

  if (declarations.length > 0) {
    rules.push(`${selector} {\n${declarations.join('\n')}\n}`);
  }

  for (const [key, value] of Object.entries(style)) {
    if (
      key === '$include' ||
      key.startsWith('@include') ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      isExpressionBinding(value)
    ) {
      continue;
    }
    if (key.startsWith('@')) {
      const wrapped = serializeRules(selector, value, collapse)
        .join('\n\n')
        .split('\n')
        .map((line) => (line === '' ? line : `  ${line}`))
        .join('\n');
      rules.push(`${key} {\n${wrapped}\n}`);
    } else {
      const matched = collapseMatch(key, selector, collapse);
      rules.push(
        ...serializeRules(resolveSelector(key, selector, matched), value, collapse)
      );
    }
  }

  return rules;
}

/**
 * Serializes a nested style object into a single nested SCSS rule block for
 * a selector - the `styling.language: 'scss'` counterpart of
 * `serializeRules`. Plain declarations come first, then each nested key as a
 * nested block: pseudo-selector keys become `&:hover`, parent-modifier keys
 * (`.ancestor &`) and at-rule keys (`@media ...`) nest verbatim, composing
 * recursively. Sass resolves the result to the same selectors and cascade
 * the flat CSS path emits by hand. Expression values never enter the
 * stylesheet.
 */
export function serializeRulesScss(
  selector: string,
  style: NestedStyleObject,
  collapse?: readonly CollapseVocabulary[]
): string {
  return serializeScssBlock(selector, style, 0, selector, collapse);
}

/**
 * @param ampSelector - The absolute selector `&` resolves to at this nesting
 *   level (the node selector at the top, unchanged through at-rules). Drives
 *   the BEM vocabulary collapse, which fires only where `&` is the node's
 *   own base class.
 */
function serializeScssBlock(
  selector: string,
  style: NestedStyleObject,
  depth: number,
  ampSelector: string,
  collapse: readonly CollapseVocabulary[] | undefined
): string {
  const indent = '  '.repeat(depth);
  const inner = '  '.repeat(depth + 1);
  const declarations: string[] = [];
  const nested: string[] = [];

  for (const [key, value] of Object.entries(style)) {
    if (key === '$include') {
      for (const statement of includeStatements(value)) {
        declarations.push(`${inner}@include ${statement};`);
      }
      continue;
    }
    if (key.startsWith('@include')) {
      // The `@include ...` at-rule key is itself the statement (mixin name plus
      // any arguments). A non-empty object value is a content block - 
      // `@include name { ... }` - emitted in authored order alongside sibling
      // declarations so include-then-override cascades as written. `true` or
      // an empty object is a no-content `@include name;` statement: Dart Sass
      // rejects `@include name {}` for a content-free mixin, so no braces.
      if (isIncludeContent(value)) {
        declarations.push(
          serializeScssBlock(key, value, depth + 1, ampSelector, collapse)
        );
      } else {
        declarations.push(`${inner}${key};`);
      }
      continue;
    }
    if (
      key === '$expression' ||
      value === undefined ||
      typeof value === 'object' ||
      typeof value === 'boolean'
    ) {
      continue;
    }
    declarations.push(`${inner}${toKebabCaseProperty(key)}: ${value};`);
  }

  for (const [key, value] of Object.entries(style)) {
    if (
      key === '$include' ||
      key.startsWith('@include') ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      isExpressionBinding(value)
    ) {
      continue;
    }
    const matched = collapseMatch(key, ampSelector, collapse);
    const nestedSelector = matched
      ? key.replace(`.${matched.baseClass}`, '') // &.card--featured → &--featured
      : scssNestedSelector(key);
    // What `&` resolves to inside the child block: unchanged through
    // at-rules, otherwise the child's own resolved selector.
    const childAmp = key.startsWith('@')
      ? ampSelector
      : resolveSelector(key, ampSelector, matched);
    const block = serializeScssBlock(
      nestedSelector,
      value,
      depth + 1,
      childAmp,
      collapse
    );
    if (block !== '') {
      nested.push(block);
    }
  }

  // A blank line separates the declaration group from each nested block,
  // matching idiomatic (prettier-style) SCSS. An empty block emits nothing,
  // mirroring the flat CSS path.
  const groups: string[] = [];
  if (declarations.length > 0) {
    groups.push(declarations.join('\n'));
  }
  groups.push(...nested);
  if (groups.length === 0) {
    return '';
  }
  return `${indent}${selector} {\n${groups.join('\n\n')}\n${indent}}`;
}

/**
 * The selector a nested style key takes inside a parent SCSS block. At-rules
 * (`@media ...`) and keys carrying an explicit parent reference (`.x &`)
 * nest verbatim; a bare pseudo/attribute key is prefixed with `&` so it
 * attaches to the parent (`:hover` → `&:hover`).
 */
function scssNestedSelector(key: string): string {
  if (key.startsWith('@') || key.includes('&')) {
    return key;
  }
  return `&${key}`;
}

/**
 * Resolves a nested style key (other than an at-rule) to its absolute
 * selector against the selector `&` currently denotes. A matched BEM
 * vocabulary collapse drops the duplicated base class (`&.Block--mod` →
 * `.Block--mod`); otherwise `&` substitutes and a bare pseudo/attribute key
 * appends.
 */
function resolveSelector(
  key: string,
  ampSelector: string,
  matched: CollapseVocabulary | undefined
): string {
  if (matched !== undefined) {
    return key.replace(/&/g, '');
  }
  if (key.includes('&')) {
    return key.replace(/&/g, ampSelector);
  }
  return `${ampSelector}${key}`;
}

/**
 * Finds the BEM vocabulary a self-compound nested key collapses against:
 * the key compounds a modifier of the node's own base class
 * (`&.{baseClass}{modifierSeparator}...`) and `&` currently denotes that base
 * (`.{baseClass}`). Returns `undefined` when no vocabulary matches - 
 * out-of-vocabulary compounds (`&.is-open`) and runs without `bem()` emit
 * the compound as written.
 */
function collapseMatch(
  key: string,
  ampSelector: string,
  collapse: readonly CollapseVocabulary[] | undefined
): CollapseVocabulary | undefined {
  if (collapse === undefined || !key.startsWith('&.')) {
    return undefined;
  }
  return collapse.find(
    ({ baseClass, modifierSeparator }) =>
      ampSelector === `.${baseClass}` &&
      key.startsWith(`&.${baseClass}${modifierSeparator}`)
  );
}

/** Normalizes a `$include` value to its list of `@include` statements. */
function includeStatements(value: unknown): string[] {
  const statements = Array.isArray(value) ? value : [value];
  return statements.filter(
    (statement): statement is string => typeof statement === 'string'
  );
}

/**
 * Whether an `@include ...` at-rule key's value is a content block: a non-empty
 * plain object. `true`, an empty object, an array, and an expression binding
 * are all no-content (the include emits as a bare `@include name;` statement).
 */
function isIncludeContent(value: unknown): value is NestedStyleObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isExpressionBinding(value) &&
    Object.keys(value).length > 0
  );
}

/**
 * Serializes static plain style properties as an inline `style` attribute
 * value. Nested selector blocks belong to a stylesheet and expression
 * values to the target's dynamic style mechanism; both are ignored here.
 */
export function serializeInlineStyle(style: NestedStyleObject): string {
  const declarations: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (
      key === '$expression' ||
      key === '$include' ||
      key.startsWith('@include')
    ) {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      declarations.push(`${toKebabCaseProperty(key)}: ${value}`);
    }
  }
  return declarations.join('; ');
}

/**
 * Converts a camelCase CSS property name to its kebab-case form. CSS custom
 * properties (`--badge-size`) contain no uppercase letters and pass through
 * unchanged.
 */
export function toKebabCaseProperty(propertyName: string): string {
  return propertyName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
