import {
  normalizeClassList,
  type BemConditionalModifier,
  type BemRuntimeCall,
  type CollapseVocabulary,
  type StylingContext,
  type StylingExtension,
  type StylingRuntime,
} from '@js-template-engine/core';
import { joinConditions } from '@js-template-engine/core/emitter';
import type { ElementNode } from '@js-template-engine/types';

import type { BemNodeOverrides } from './overrides';

/** Options for the BEM extension. */
export interface BemOptions {
  /** Separator between block and element. Defaults to `'__'`. */
  elementSeparator?: string;
  /** Separator between base class and modifier. Defaults to `'--'`. */
  modifierSeparator?: string;
  /**
   * How BEM classes are rendered. `'literal'` (default) emits class name
   * strings. `'runtime'` emits `bem(...)` calls - `createBem`/`useBem` from
   * {@link importSource} - for scripted targets, while HTML mode and the
   * stylesheet keep the identical literal classes.
   */
  mode?: 'literal' | 'runtime';
  /**
   * The package the runtime helper is imported from in `'runtime'` mode.
   * Defaults to `'use-bem'`. Ignored in `'literal'` mode.
   */
  importSource?: string;
}

/** The BEM styling extension. */
export interface BemExtension extends StylingExtension {
  readonly key: 'bem';
}

/**
 * Creates the BEM styling extension.
 *
 * Contributes BEM classes to element nodes from their `extensions.bem`
 * override: the base class (`block`, or `block__element`) followed by one
 * class per modifier (`base--modifier`), appended after the node's static
 * classes. BEM classes are semantic - generated CSS may use them as
 * selectors.
 *
 * A node without its own `block` uses the nearest ancestor element's
 * declared `block`, so a component usually declares its block once at the
 * root and its descendants declare only `element`. An override whose
 * `element` or `modifiers` has no effective block contributes nothing and
 * emits a warning.
 *
 * Block, element, and modifier names are author space: the extension joins
 * them with the configured separators and never validates naming.
 *
 * @example
 * const result = process(template, { extensions: [bem()] });
 */
export function bem(options: BemOptions = {}): BemExtension {
  const elementSeparator = options.elementSeparator ?? '__';
  const modifierSeparator = options.modifierSeparator ?? '--';
  const mode = options.mode ?? 'literal';
  const importSource = options.importSource ?? 'use-bem';

  /**
   * The node's effective base class (`block`, or `block__element`), or
   * `undefined` when no block is declared or inherited. `warnOnOrphan`
   * emits the no-effective-block warning - done once, from
   * `contributeClasses`.
   */
  function effectiveBase(
    element: ElementNode,
    context: StylingContext,
    warnOnOrphan: boolean
  ): string | undefined {
    const override = element.extensions?.bem;
    if (override === undefined) {
      return undefined;
    }
    const block =
      nonEmpty(override.block) ?? inheritedBlock(context.ancestorElements);
    const elementName = nonEmpty(override.element);
    if (block === undefined) {
      const hasModifiers = (override.modifiers ?? []).some(
        (modifier) => nonEmpty(modifier) !== undefined
      );
      if (warnOnOrphan && (elementName !== undefined || hasModifiers)) {
        context.warn(
          "The 'bem' override has no effective block: none is declared on the node or inherited from an ancestor element"
        );
      }
      return undefined;
    }
    return elementName === undefined
      ? block
      : `${block}${elementSeparator}${elementName}`;
  }

  /**
   * Runtime-mode binding: per-element `bem(...)` calls plus the constants the
   * scripted targets need to emit the helper import and setup line. The
   * literal classes are unaffected (`contributeClasses` still runs), so HTML
   * mode and stylesheet targeting see the same output as literal mode.
   */
  const runtime: StylingRuntime = {
    importSource,
    elementSeparator,
    modifierSeparator,
    call(
      element: ElementNode,
      context: StylingContext
    ): BemRuntimeCall | undefined {
      const override = element.extensions?.bem;
      if (override === undefined) {
        return undefined;
      }
      const declaredBlock = nonEmpty(override.block);
      const block = declaredBlock ?? inheritedBlock(context.ancestorElements);
      if (block === undefined) {
        return undefined;
      }
      const elementName = nonEmpty(override.element);
      const base =
        elementName === undefined
          ? block
          : `${block}${elementSeparator}${elementName}`;
      const staticModifiers = (override.modifiers ?? []).filter(
        (modifier): modifier is string => nonEmpty(modifier) !== undefined
      );

      // Fold a conditional class that parses as `{base}{separator}{modifier}`
      // into the call's record argument; out-of-vocabulary conditional classes
      // are left for ordinary conditional rendering. A modifier already
      // static needs no condition, and one repeated across conditional
      // entries is one record key whose conditions are joined, so it applies
      // whenever any of them holds.
      const prefix = `${base}${modifierSeparator}`;
      const conditionsByModifier = new Map<string, string[]>();
      const foldedConditionalClasses: string[] = [];
      for (const conditional of element.conditionalAttributes ?? []) {
        for (const className of normalizeClassList(
          conditional.attributes.class
        )) {
          if (
            !className.startsWith(prefix) ||
            className.length <= prefix.length
          ) {
            continue;
          }
          const modifier = className.slice(prefix.length);
          if (!foldedConditionalClasses.includes(className)) {
            foldedConditionalClasses.push(className);
          }
          if (staticModifiers.includes(modifier)) {
            continue;
          }
          const conditions = conditionsByModifier.get(modifier);
          if (conditions === undefined) {
            conditionsByModifier.set(modifier, [conditional.condition]);
          } else if (!conditions.includes(conditional.condition)) {
            conditions.push(conditional.condition);
          }
        }
      }
      const foldedModifiers: BemConditionalModifier[] = [
        ...conditionsByModifier,
      ].map(([modifier, conditions]) => ({
        modifier,
        condition: joinConditions(conditions),
      }));

      return {
        block,
        declaresBlock: declaredBlock !== undefined,
        elementName,
        staticModifiers,
        conditionalModifiers: foldedModifiers,
        contributedClasses: [
          base,
          ...staticModifiers.map(
            (modifier) => `${base}${modifierSeparator}${modifier}`
          ),
        ],
        foldedConditionalClasses,
      };
    },
  };

  return {
    key: 'bem',
    kind: 'styling',
    overrideKeys: { node: ['block', 'element', 'modifiers'] },
    classKind: 'semantic',
    ...(mode === 'runtime' ? { runtime } : {}),
    contributeClasses(
      element: ElementNode,
      context: StylingContext
    ): readonly string[] {
      const base = effectiveBase(element, context, true);
      if (base === undefined) {
        return [];
      }
      const modifiers = (element.extensions?.bem?.modifiers ?? []).filter(
        (modifier) => nonEmpty(modifier) !== undefined
      );
      return [
        base,
        ...modifiers.map(
          (modifier) => `${base}${modifierSeparator}${modifier}`
        ),
      ];
    },
    collapseVocabulary(
      element: ElementNode,
      context: StylingContext
    ): CollapseVocabulary | undefined {
      const base = effectiveBase(element, context, false);
      if (base === undefined) {
        return undefined;
      }
      const block =
        nonEmpty(element.extensions?.bem?.block) ??
        inheritedBlock(context.ancestorElements);
      return block !== undefined &&
        carriesOnlyOwnElement(
          element,
          `${block}${elementSeparator}`,
          base,
          modifierSeparator
        )
        ? { baseClass: base, modifierSeparator, block, elementSeparator }
        : { baseClass: base, modifierSeparator };
    },
  };
}

/**
 * Whether a node surely carries no class of another element of its block:
 * its literal classes, unconditional and conditional, name no element of
 * the block but its own base, no class of it is an expression, and no
 * per-target `attributes` override sets its `class` or `className`, whose
 * values nothing here reads.
 */
function carriesOnlyOwnElement(
  element: ElementNode,
  elementPrefix: string,
  base: string,
  modifierSeparator: string
): boolean {
  const overrides = Object.values(element.extensions ?? {}) as unknown[];
  const overridesClass = overrides.some((override) => {
    const attributes = (override as { attributes?: unknown } | null)
      ?.attributes;
    return (
      typeof attributes === 'object' &&
      attributes !== null &&
      ('class' in attributes || 'className' in attributes)
    );
  });
  const classValue = element.attributes?.class;
  const hasExpression = (
    Array.isArray(classValue) ? classValue : [classValue]
  ).some((entry) => typeof entry === 'object' && entry !== null);
  if (overridesClass || hasExpression) {
    return false;
  }
  const classValues = [
    element.attributes?.class,
    ...(element.conditionalAttributes ?? []).map(
      (conditional) => conditional.attributes.class
    ),
  ];
  return classValues
    .flatMap((value) => normalizeClassList(value))
    .every(
      (className) =>
        !className.startsWith(elementPrefix) ||
        className === base ||
        className.startsWith(`${base}${modifierSeparator}`)
    );
}

/** Returns the nearest ancestor element's declared block, if any. */
function inheritedBlock(
  ancestorElements: readonly ElementNode[]
): string | undefined {
  for (let index = ancestorElements.length - 1; index >= 0; index -= 1) {
    const block = nonEmpty(ancestorElements[index].extensions?.bem?.block);
    if (block !== undefined) {
      return block;
    }
  }
  return undefined;
}

function nonEmpty(value: string | undefined): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}
