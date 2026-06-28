import type {
  Attributes,
  ComponentExtensionOverrides,
  ElementNode,
  PropDefinition,
  Template,
  TemplateNode,
} from '@js-template-engine/types';

import { isExpressionBinding } from './expression-binding';

/**
 * One element's collapsible BEM vocabulary, declared by a styling extension
 * (BEM) so the stylesheet serializers can collapse a self-compound nested
 * selector (`&.{baseClass}{modifierSeparator}{suffix}`) to its single-class
 * form, restoring hand-written specificity. Never inferred by core - an
 * extension supplies it (`StylingExtension.collapseVocabulary`).
 */
export interface CollapseVocabulary {
  /** The node's effective BEM base class, e.g. `'card'`. */
  baseClass: string;
  /** The BEM modifier separator, e.g. `'--'`. */
  modifierSeparator: string;
}

/**
 * Component-level binding for BEM runtime mode, declared by a styling
 * extension (BEM) when it renders classes as `bem(...)` calls instead of
 * literal strings. Framework targets use it to emit the helper import and
 * the single `const bem = createBem('block')` / `useBem('block')` setup line;
 * the per-element {@link BemRuntimeCall} entries supply the call expressions.
 * Absent when no component uses runtime mode. Never inferred by core - an
 * extension supplies it (`StylingExtension.runtime`).
 */
export interface BemRuntimeBinding {
  /** The component's single BEM block, e.g. `'DjuiBadge'`. */
  block: string;
  /** The element separator the helper must be configured with. */
  elementSeparator: string;
  /** The modifier separator the helper must be configured with. */
  modifierSeparator: string;
  /** The package the helper is imported from, e.g. `'use-bem'`. */
  importSource: string;
}

/**
 * One element's BEM runtime call, for framework targets in runtime mode. The
 * statically-determinable literal classes stay on the element's `class`
 * attribute (so HTML mode and stylesheet targeting are unaffected); a
 * framework renderer instead suppresses {@link contributedClasses} from its
 * static class output and emits {@link expression} in their place.
 */
export interface BemRuntimeCall {
  /** The effective block this call binds to (declared or inherited). */
  block: string;
  /** Whether this element declares the block (vs. inheriting it). */
  declaresBlock: boolean;
  /**
   * The call expression text, identical across framework targets, e.g.
   * `"bem('icon', { large: true, solid: isSolid })"`.
   */
  expression: string;
  /**
   * The literal BEM classes this call replaces - a framework renderer drops
   * these from its static class output (they remain on `class` for HTML and
   * stylesheet targeting).
   */
  contributedClasses: readonly string[];
  /**
   * `conditionalAttributes` classes folded into the call's record argument - 
   * a framework renderer omits these from its conditional class output.
   */
  foldedConditionalClasses: readonly string[];
}

/**
 * A template reduced to a uniform component shape: the root component
 * wrapper unwrapped (or synthesized from the component name option), ready
 * for rendering.
 */
export interface NormalizedComponent {
  name: string;
  props: Record<string, PropDefinition>;
  /** Verbatim import statements. */
  imports: string[];
  /** Framework-agnostic JavaScript (handlers, utilities). */
  script?: string;
  /** Component-level CSS. */
  style?: string;
  children: TemplateNode[];
  /** Component-level per-extension overrides, keyed by extension name. */
  extensions: ComponentExtensionOverrides;
  /**
   * Per-element selector-eligible classes, present once styling extensions
   * have been applied: the element's static classes followed by classes
   * contributed by semantic styling extensions. CSS targeting uses the
   * first entry; utility-extension classes are never used as selectors.
   */
  selectorClasses?: ReadonlyMap<ElementNode, readonly string[]>;
  /**
   * Per-element collapsible BEM vocabularies, present once styling
   * extensions have been applied. The stylesheet serializers consult it to
   * collapse self-compound BEM modifier selectors; an element absent from
   * the map (or an empty entry) collapses nothing.
   */
  collapseVocabulary?: ReadonlyMap<ElementNode, readonly CollapseVocabulary[]>;
  /**
   * Component-level BEM runtime binding, present once styling extensions have
   * been applied and a styling extension is in runtime mode with at least one
   * BEM-bearing element. Framework targets emit the helper import and setup
   * line from it; HTML mode ignores it and renders the literal classes.
   */
  bemRuntime?: BemRuntimeBinding;
  /**
   * Per-element BEM runtime calls, present alongside {@link bemRuntime}. A
   * framework renderer consults it to emit `bem(...)` calls; an element absent
   * from the map renders its classes literally.
   */
  bemRuntimeCalls?: ReadonlyMap<ElementNode, BemRuntimeCall>;
}

/**
 * Unwraps a template's root component node, or synthesizes a component
 * around a bare node array using the given name.
 */
export function normalizeTemplate(
  template: Template,
  componentName: string
): NormalizedComponent {
  if (Array.isArray(template)) {
    return {
      name: componentName,
      props: {},
      imports: [],
      children: template,
      extensions: {},
    };
  }
  return {
    name: template.name,
    props: template.props ?? {},
    imports: template.imports ?? [],
    script: template.script,
    style: template.style,
    children: template.children,
    extensions: template.extensions ?? {},
  };
}

/**
 * Normalizes a `class` attribute value to the canonical array of literal
 * class names, dropping duplicates (the first occurrence wins) and empty
 * entries. Expression entries are runtime values and are excluded - 
 * codegen-time deduplication covers literals only; `classExpressions`
 * collects the expression entries.
 */
export function normalizeClassList(
  value: Attributes['class'] | undefined
): string[] {
  if (value === undefined || isExpressionBinding(value)) {
    return [];
  }
  const classes = Array.isArray(value) ? value : value.split(/\s+/);
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const className of classes) {
    if (
      typeof className === 'string' &&
      className !== '' &&
      !seen.has(className)
    ) {
      seen.add(className);
      normalized.push(className);
    }
  }
  return normalized;
}

/**
 * Collects the `$expression` entries of a `class` attribute value - the
 * sole-value form or expression entries of the array form - as trimmed
 * expression strings in authored order. Expression classes render after
 * every other class source and are never deduplicated at codegen time.
 */
export function classExpressions(
  value: Attributes['class'] | undefined
): string[] {
  if (value === undefined || typeof value === 'string') {
    return [];
  }
  if (isExpressionBinding(value)) {
    return [value.$expression.trim()];
  }
  return value
    .filter(isExpressionBinding)
    .map((entry) => entry.$expression.trim());
}
