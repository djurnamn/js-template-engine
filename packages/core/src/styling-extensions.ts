import type {
  ElementNode,
  Extension,
  NestedStyleObject,
  TemplateNode,
  Warning,
} from '@js-template-engine/types';

import { isExpressionBinding } from './expression-binding';
import { layerStyleObjects, mergeStyleObjects } from './merge-styles';
import { normalizeNamedSlots } from './slots';
import {
  classExpressions,
  normalizeClassList,
  type BemRuntimeBinding,
  type BemRuntimeCall,
  type CollapseVocabulary,
  type NormalizedComponent,
} from './normalize';
import {
  TemplateError,
  throwTemplateErrors,
  type TemplateErrorDetail,
} from './TemplateError';

/**
 * What a styling extension sees when contributing to one element.
 */
export interface StylingContext {
  /** The element's ancestor element nodes, outermost first. */
  readonly ancestorElements: readonly ElementNode[];
  /** Records a non-fatal notice on the processing result. */
  warn(message: string): void;
  /**
   * Records a processing error carrying the element's node path and lets
   * styling carry on, so one run reports every such error: processing
   * fails once every element has been visited, with all of them in its
   * message. Always present on the contexts core passes; optional so a
   * context built by hand, in a test, need not supply it.
   */
  error?(message: string): void;
  /** Throws a processing error carrying the element's node path. */
  fail(message: string): never;
}

/**
 * A styling extension: contributes classes or styles to element nodes.
 *
 * Contributions are unconditional, in one of two forms. Classes are
 * appended after the element's static classes, in the order the extensions
 * appear in `ProcessingOptions.extensions`; duplicates are dropped, the
 * first occurrence winning. Styles - for extensions offering a conversion
 * mode - are nested style objects merged beneath the element's authored
 * `style`: authored properties win, recursively inside matching nested
 * blocks, and the merged result rides the normal styling pipeline.
 *
 * `classKind` declares whether the contributed classes may be used as
 * generated CSS selectors: `'semantic'` classes (BEM) identify their node
 * and are selector-eligible, while `'utility'` classes (Tailwind) are
 * shared across nodes by design and are never used as selectors.
 */
export interface StylingExtension extends Extension {
  readonly kind: 'styling';
  readonly classKind: 'semantic' | 'utility';
  /**
   * Returns the classes this extension contributes to an element, usually
   * derived from the element's `extensions.<key>` override block.
   */
  contributeClasses(
    element: ElementNode,
    context: StylingContext
  ): readonly string[];
  /**
   * Returns the styles this extension contributes to an element, merged
   * beneath the element's authored `style` (authored properties win).
   * Contributed values are static - expression bindings have no defined
   * dynamic rendering for extension-contributed styles.
   */
  contributeStyles?(
    element: ElementNode,
    context: StylingContext
  ): NestedStyleObject | undefined;
  /**
   * Returns CSS this extension adds once to the component's stylesheet,
   * given every style it contributed to the component's elements through
   * {@link contributeStyles}, in document order - top-level rules its
   * contributed styles rely on, such as `@property` registrations. The CSS
   * is emitted after the component's rules, outside any cascade layer, and
   * is left out under the `inline` placement. Only at-rules that hold no
   * selectors (`@property`, `@font-face`, `@keyframes`) are safe in every
   * target: a selector would bypass the targeting rules and be rescoped by
   * Svelte or Vue's scoped CSS. Returns `undefined`, or an empty string, to
   * add nothing.
   *
   * @example
   * contributeComponentCss: (styles) =>
   *   styles.length > 0 ? '@property --x { syntax: "*"; inherits: false; }' : undefined
   */
  contributeComponentCss?(
    contributedStyles: readonly NestedStyleObject[]
  ): string | undefined;
  /**
   * Converts the element's authored `style` into classes this extension
   * contributes, returning those classes and the style that remains (the
   * portion that could not be expressed as classes - e.g. per-property
   * `$expression` values). The remaining style replaces the element's
   * authored `style`; an absent remainder removes it. Returning
   * `undefined` leaves the authored `style` untouched.
   *
   * This is the inverse of `contributeStyles`: where that merges classes'
   * meaning beneath the authored style, this lifts the authored style up
   * into classes.
   */
  convertStyleToClasses?(
    element: ElementNode,
    context: StylingContext
  ):
    | { classes: readonly string[]; remainingStyle?: NestedStyleObject }
    | undefined;
  /**
   * Returns the element's collapsible BEM vocabulary - its effective base
   * class and modifier separator - letting the stylesheet serializers
   * collapse a self-compound modifier selector
   * (`&.{baseClass}{modifierSeparator}{suffix}`) to its single-class form,
   * restoring hand-written specificity. Returns `undefined` for an element
   * with no effective vocabulary. Keeps BEM knowledge in the extension; the
   * collapse is never a core heuristic.
   */
  collapseVocabulary?(
    element: ElementNode,
    context: StylingContext
  ): CollapseVocabulary | undefined;
  /**
   * When present, the extension renders its classes as runtime helper calls
   * (e.g. `bem('icon', { large: true })`) for scripted targets instead of
   * literal strings. The literal classes still flow through
   * `contributeClasses` unchanged, so the html target and stylesheet targeting are
   * unaffected - runtime emission is scripted-target-only.
   */
  readonly runtime?: StylingRuntime;
}

/**
 * A styling extension's runtime-mode binding. The constant fields configure
 * the per-component helper import and setup line; `call` computes one
 * element's runtime call (or `undefined` when the element contributes none).
 */
export interface StylingRuntime {
  /** The package the runtime helper is imported from, e.g. `'use-bem'`. */
  readonly importSource: string;
  /** The element separator the helper is configured with. */
  readonly elementSeparator: string;
  /** The modifier separator the helper is configured with. */
  readonly modifierSeparator: string;
  /**
   * Returns the element's runtime call, or `undefined` when it contributes no
   * runtime classes (no effective block).
   */
  call(
    element: ElementNode,
    context: StylingContext
  ): BemRuntimeCall | undefined;
}

/** Returns true when an extension is a styling extension. */
export function isStylingExtension(
  extension: Extension
): extension is StylingExtension {
  return (
    (extension as StylingExtension).kind === 'styling' &&
    typeof (extension as StylingExtension).contributeClasses === 'function'
  );
}

/** The outcome of applying styling extensions to a component. */
export interface StylingApplication {
  component: NormalizedComponent;
  warnings: Warning[];
}

/**
 * Applies styling extensions to a component's element nodes.
 *
 * Returns the component untouched when no styling extension is passed.
 * Otherwise returns a copy whose element nodes carry their merged class
 * lists - static classes first, then each extension's contribution in
 * extension order - and whose `selectorClasses` map records each element's
 * selector-eligible classes (static and semantic-extension classes) for
 * CSS targeting. The input template nodes are never mutated.
 *
 * Errors an extension records through `context.error` are thrown together
 * as one `TemplateError` once every element has been visited, or with the
 * error of a later `context.fail`.
 */
export function applyStylingExtensions(
  component: NormalizedComponent,
  extensions: Extension[]
): StylingApplication {
  const stylingExtensions = extensions.filter(isStylingExtension);
  if (stylingExtensions.length === 0) {
    return { component, warnings: [] };
  }

  const children = structuredClone(component.children);
  const selectorClasses = new Map<ElementNode, readonly string[]>();
  const collapseVocabulary = new Map<
    ElementNode,
    readonly CollapseVocabulary[]
  >();
  const warnings: Warning[] = [];
  const errors: TemplateErrorDetail[] = [];

  const runtimeExtension = stylingExtensions.find(
    (extension) => extension.runtime !== undefined
  );
  const bemRuntimeCalls = new Map<ElementNode, BemRuntimeCall>();
  let componentBlock: string | undefined;
  const contributedStyles = new Map<StylingExtension, NestedStyleObject[]>();

  function applyToElement(
    element: ElementNode,
    nodePath: string,
    ancestorElements: readonly ElementNode[]
  ): void {
    const staticClasses = normalizeClassList(element.attributes?.class);
    const contributed: string[] = [];
    const eligible = [...staticClasses];
    const context: StylingContext = {
      ancestorElements,
      warn(message) {
        warnings.push({ message, nodePath });
      },
      error(message) {
        errors.push({ message, nodePath });
      },
      fail(message) {
        if (errors.length === 0) {
          throw new TemplateError(message, nodePath);
        }
        throwTemplateErrors([...errors, { message, nodePath }], 'styling');
      },
    };

    let contributedStyle: NestedStyleObject | undefined;
    const vocabularies: CollapseVocabulary[] = [];
    for (const extension of stylingExtensions) {
      const classes = extension.contributeClasses(element, context);
      contributed.push(...classes);
      if (extension.classKind === 'semantic') {
        eligible.push(...classes);
      }
      const vocabulary = extension.collapseVocabulary?.(element, context);
      if (vocabulary !== undefined) {
        vocabularies.push(vocabulary);
      }
      const conversion = extension.convertStyleToClasses?.(element, context);
      if (conversion !== undefined) {
        contributed.push(...conversion.classes);
        if (extension.classKind === 'semantic') {
          eligible.push(...conversion.classes);
        }
        const { style: _replaced, ...rest } = element.attributes ?? {};
        element.attributes =
          conversion.remainingStyle === undefined
            ? rest
            : { ...rest, style: conversion.remainingStyle };
      }
      const style = extension.contributeStyles?.(element, context);
      if (style !== undefined && Object.keys(style).length > 0) {
        contributedStyles.set(extension, [
          ...(contributedStyles.get(extension) ?? []),
          style,
        ]);
        contributedStyle =
          contributedStyle === undefined
            ? style
            : mergeStyleObjects(contributedStyle, style);
      }
    }

    selectorClasses.set(element, normalizeClassList(eligible));
    if (vocabularies.length > 0) {
      collapseVocabulary.set(element, vocabularies);
    }

    const runtimeCall = runtimeExtension?.runtime?.call(element, context);
    if (runtimeCall !== undefined) {
      if (runtimeCall.declaresBlock) {
        if (componentBlock === undefined) {
          componentBlock = runtimeCall.block;
        } else if (componentBlock !== runtimeCall.block) {
          context.fail(
            `BEM runtime mode supports one block per component, but a second ` +
              `block "${runtimeCall.block}" is declared (the component block ` +
              `is "${componentBlock}")`
          );
        }
      }
      bemRuntimeCalls.set(element, runtimeCall);
    }
    if (contributed.length > 0) {
      // Expression entries render after every literal class source. The
      // class leads the attributes, where hand-written markup puts it, unless
      // the author placed a literal class elsewhere, which keeps its place.
      const expressions = classExpressions(element.attributes?.class);
      const classes = [
        ...normalizeClassList([...staticClasses, ...contributed]),
        ...expressions.map((expression) => ({ $expression: expression })),
      ];
      element.attributes = { class: classes, ...element.attributes };
      element.attributes.class = classes;
    }

    if (contributedStyle !== undefined) {
      const authoredStyle = element.attributes?.style;
      // A *pure* whole-object expression has no static object to merge
      // contributed styles into. A mixed node (whole-object expression beside
      // static / nested keys) does: `layerStyleObjects` carries the
      // `$expression` key through untouched while resolving the static part.
      if (
        authoredStyle !== undefined &&
        isExpressionBinding(authoredStyle) &&
        Object.keys(authoredStyle).length === 1
      ) {
        context.fail(
          'Extension-contributed styles cannot merge into a whole-object ' +
            "expression 'style' - there is no authored object to resolve " +
            'property conflicts against'
        );
      }
      element.attributes = {
        ...element.attributes,
        style:
          authoredStyle === undefined
            ? contributedStyle
            : layerStyleObjects(contributedStyle, authoredStyle),
      };
    }
  }

  function applyToNodes(
    nodes: TemplateNode[],
    path: string,
    ancestorElements: readonly ElementNode[]
  ): void {
    nodes.forEach((node, index) => {
      const nodePath = `${path}[${index}]`;
      switch (node.type) {
        case 'element':
          applyToElement(node, nodePath, ancestorElements);
          if (node.children) {
            applyToNodes(node.children, `${nodePath}.children`, [
              ...ancestorElements,
              node,
            ]);
          }
          for (const named of normalizeNamedSlots(node.slots)) {
            applyToNodes(named.content, `${nodePath}.slots.${named.name}`, [
              ...ancestorElements,
              node,
            ]);
          }
          break;
        case 'fragment':
          applyToNodes(node.children, `${nodePath}.children`, ancestorElements);
          break;
        case 'slot':
          if (node.fallback) {
            applyToNodes(
              node.fallback,
              `${nodePath}.fallback`,
              ancestorElements
            );
          }
          break;
        case 'conditional':
          node.conditions.forEach((branch, branchIndex) => {
            applyToNodes(
              branch.children,
              `${nodePath}.conditions[${branchIndex}].children`,
              ancestorElements
            );
          });
          break;
        case 'iteration':
          applyToNodes(node.children, `${nodePath}.children`, ancestorElements);
          break;
        default:
          break;
      }
    });
  }

  applyToNodes(children, 'children', []);
  if (errors.length > 0) {
    throwTemplateErrors(errors, 'styling');
  }

  const contributedCss = stylingExtensions
    .map((extension) =>
      extension.contributeComponentCss?.(contributedStyles.get(extension) ?? [])
    )
    .filter((css): css is string => css !== undefined && css.trim() !== '')
    .map((css) => css.trim());

  const normalizedComponent: NormalizedComponent = {
    ...component,
    children,
    selectorClasses,
    collapseVocabulary,
    ...(contributedCss.length > 0
      ? { contributedCss: contributedCss.join('\n\n') }
      : {}),
  };
  if (
    runtimeExtension?.runtime !== undefined &&
    componentBlock !== undefined &&
    bemRuntimeCalls.size > 0
  ) {
    normalizedComponent.bemRuntime = {
      block: componentBlock,
      elementSeparator: runtimeExtension.runtime.elementSeparator,
      modifierSeparator: runtimeExtension.runtime.modifierSeparator,
      importSource: runtimeExtension.runtime.importSource,
    };
    normalizedComponent.bemRuntimeCalls = bemRuntimeCalls;
  }

  return { component: normalizedComponent, warnings };
}
