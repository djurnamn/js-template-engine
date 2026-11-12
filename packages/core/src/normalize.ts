import type {
  Attributes,
  ComponentExtensionOverrides,
  DeclaredId,
  ElementNode,
  PropDefinition,
  RestDefinition,
  Template,
  TemplateNode,
} from '@js-template-engine/types';

import type { BemConditionalModifier } from './bem-call';
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
  /**
   * The node's BEM block, e.g. `'card'`, given with {@link elementSeparator}
   * when the node can carry no class of another element of its block. A
   * self-compound selector naming a modifier of another element of the
   * block (`&.card__footer--wide` on the `card__body` node) can then never
   * match the node, and the serializers drop it.
   */
  block?: string;
  /** The BEM element separator, e.g. `'__'`, given with {@link block}. */
  elementSeparator?: string;
}

/**
 * Component-level binding for BEM runtime mode, declared by a styling
 * extension (BEM) when it renders classes as `bem(...)` calls instead of
 * literal strings. Scripted targets use it to emit the helper import and
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
 * One element's BEM runtime call, for scripted targets in runtime mode. The
 * statically-determinable literal classes stay on the element's `class`
 * attribute (so the html target and stylesheet targeting are unaffected); a
 * target renderer instead suppresses {@link contributedClasses} from its
 * static class output and emits {@link expression} in their place.
 */
export interface BemRuntimeCall {
  /** The effective block this call binds to (declared or inherited). */
  block: string;
  /** Whether this element declares the block (vs. inheriting it). */
  declaresBlock: boolean;
  /**
   * The BEM element name passed as the call's first argument, or `undefined`
   * for a block-level call.
   */
  elementName?: string;
  /** Unconditional modifier names for the call's record/array argument. */
  staticModifiers: readonly string[];
  /**
   * Condition-gated modifiers folded into the call's record argument. The
   * conditions are authored expression text: a target renderer rewrites
   * any named-slot reference inside each one to its own presence form
   * (`!icon` -> `!$$slots.icon`) before formatting the call with
   * {@link formatBemCall}. Building the call in the target renderer - rather
   * than baking a single cross-target string here - is what lets each target
   * resolve slot references differently.
   */
  conditionalModifiers: readonly BemConditionalModifier[];
  /**
   * The literal BEM classes this call replaces - a target renderer drops
   * these from its static class output (they remain on `class` for HTML and
   * stylesheet targeting).
   */
  contributedClasses: readonly string[];
  /**
   * `conditionalAttributes` classes folded into the call's record argument -
   * a target renderer omits these from its conditional class output.
   */
  foldedConditionalClasses: readonly string[];
}

/**
 * A template reduced to a uniform component shape: the root component
 * wrapper unwrapped (or synthesized from the component name option), ready
 * for rendering.
 */
/** A type parameter in its object form. */
export interface NormalizedTypeParameter {
  name: string;
  constraint?: string;
  default?: string;
}

/**
 * A component's type parameters as a TypeScript declaration list -
 * `<Item extends object = Record<string, unknown>>` - or `''` when it has none.
 *
 * @param parameters - The normalized type parameters.
 * @returns The declaration list, angle brackets included.
 */
export function typeParameterDeclarations(
  parameters: readonly NormalizedTypeParameter[] = []
): string {
  if (parameters.length === 0) {
    return '';
  }
  return `<${parameters.map(typeParameterDeclaration).join(', ')}>`;
}

/**
 * The same list without angle brackets, as Vue's `generic` and Svelte's
 * `generics` attributes take it.
 *
 * @param parameters - The normalized type parameters.
 * @returns The comma-separated declarations, or `''`.
 */
export function typeParameterAttribute(
  parameters: readonly NormalizedTypeParameter[] = []
): string {
  return parameters.map(typeParameterDeclaration).join(', ');
}

/**
 * The type parameters as arguments - `<Item>` - to pass a generic type on,
 * or `''` when there are none.
 *
 * @param parameters - The normalized type parameters.
 * @returns The argument list, angle brackets included.
 */
export function typeParameterArguments(
  parameters: readonly NormalizedTypeParameter[] = []
): string {
  if (parameters.length === 0) {
    return '';
  }
  return `<${parameters.map((parameter) => parameter.name).join(', ')}>`;
}

/**
 * The type parameters as an attribute of a script tag - ` generic="Item"` -
 * quoted with single quotes when a constraint or default holds a double
 * quote, or `''` when there are none.
 *
 * @param name - The attribute's name: Vue's `generic`, Svelte's `generics`.
 * @param parameters - The normalized type parameters.
 * @returns The attribute with its leading space, or `''`.
 */
export function typeParameterScriptAttribute(
  name: string,
  parameters: readonly NormalizedTypeParameter[] = []
): string {
  const value = typeParameterAttribute(parameters);
  if (value === '') {
    return '';
  }
  const quote = value.includes('"') ? "'" : '"';
  return ` ${name}=${quote}${value}${quote}`;
}

function typeParameterDeclaration(parameter: NormalizedTypeParameter): string {
  return [
    parameter.name,
    parameter.constraint === undefined
      ? ''
      : ` extends ${parameter.constraint}`,
    parameter.default === undefined ? '' : ` = ${parameter.default}`,
  ].join('');
}

export interface NormalizedComponent {
  name: string;
  /** What the component is, written as its doc comment; markdown allowed. */
  description?: string;
  props: Record<string, PropDefinition>;
  /** Verbatim import statements. */
  imports: string[];
  /** Framework-agnostic JavaScript (handlers, utilities). */
  script?: string;
  /**
   * The component's derived values, each name with its expression, in
   * declaration order; absent when it declares none.
   */
  derived?: Record<string, string>;
  /**
   * The component's per-instance ids, each name with its prefix or
   * `{ prefix, prop }`, in declaration order; absent when it declares none.
   */
  ids?: Record<string, string | DeclaredId>;
  /** Component-level CSS. */
  style?: string;
  children: TemplateNode[];
  /** Component-level per-extension overrides, keyed by extension name. */
  extensions: ComponentExtensionOverrides;
  /** Where the consumer's leftover attributes land, when the component declares it. */
  rest?: RestDefinition;
  /** The component's type parameters, each in its object form, in order. */
  typeParameters?: NormalizedTypeParameter[];
  /**
   * The names the build's extensions declare in every component
   * (`Extension.reservedNames`), present once processing has set it. Prop
   * aliases steer clear of them, so an alias never meets a name the output
   * declares itself.
   */
  reservedNames?: ReadonlySet<string>;
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
   * CSS styling extensions add once to the component's stylesheet
   * (`StylingExtension.contributeComponentCss`), present once styling
   * extensions have been applied and one adds any. Emitted after the
   * component's rules, outside its cascade layer.
   */
  contributedCss?: string;
  /**
   * Component-level BEM runtime binding, present once styling extensions have
   * been applied and a styling extension is in runtime mode with at least one
   * BEM-bearing element. Scripted targets emit the helper import and setup
   * line from it; the html target ignores it and renders the literal classes.
   */
  bemRuntime?: BemRuntimeBinding;
  /**
   * Per-element BEM runtime calls, present alongside {@link bemRuntime}. A
   * target renderer consults it to emit `bem(...)` calls; an element absent
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
    ...(template.description !== undefined
      ? { description: template.description }
      : {}),
    props: template.props ?? {},
    imports: template.imports ?? [],
    script: template.script,
    ...(template.derived !== undefined &&
    Object.keys(template.derived).length > 0
      ? { derived: template.derived }
      : {}),
    ...(template.ids !== undefined && Object.keys(template.ids).length > 0
      ? { ids: template.ids }
      : {}),
    style: template.style,
    children: template.children,
    extensions: template.extensions ?? {},
    ...(template.rest !== undefined ? { rest: template.rest } : {}),
    ...(template.typeParameters !== undefined
      ? {
          typeParameters: template.typeParameters.map((parameter) =>
            typeof parameter === 'string' ? { name: parameter } : parameter
          ),
        }
      : {}),
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
