import {
  normalizeClassList,
  type BemRuntimeCall,
  type CollapseVocabulary,
  type StylingContext,
  type StylingExtension,
  type StylingRuntime,
} from '@js-template-engine/core';
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
   * {@link importSource} - for framework targets, while HTML mode and the
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
    const block = nonEmpty(override.block) ?? inheritedBlock(context.ancestorElements);
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
   * framework targets need to emit the helper import and setup line. The
   * literal classes are unaffected (`contributeClasses` still runs), so HTML
   * mode and stylesheet targeting see the same output as literal mode.
   */
  const runtime: StylingRuntime = {
    importSource,
    elementSeparator,
    modifierSeparator,
    call(element: ElementNode, context: StylingContext): BemRuntimeCall | undefined {
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
      // are left for ordinary conditional rendering.
      const foldedModifiers: { modifier: string; condition: string }[] = [];
      const foldedConditionalClasses: string[] = [];
      const prefix = `${base}${modifierSeparator}`;
      for (const conditional of element.conditionalAttributes ?? []) {
        for (const className of normalizeClassList(conditional.attributes.class)) {
          if (className.startsWith(prefix) && className.length > prefix.length) {
            foldedModifiers.push({
              modifier: className.slice(prefix.length),
              condition: conditional.condition,
            });
            foldedConditionalClasses.push(className);
          }
        }
      }

      return {
        block,
        declaresBlock: declaredBlock !== undefined,
        expression: buildCallExpression(
          elementName,
          staticModifiers,
          foldedModifiers
        ),
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
        ...modifiers.map((modifier) => `${base}${modifierSeparator}${modifier}`),
      ];
    },
    collapseVocabulary(
      element: ElementNode,
      context: StylingContext
    ): CollapseVocabulary | undefined {
      const base = effectiveBase(element, context, false);
      return base === undefined
        ? undefined
        : { baseClass: base, modifierSeparator };
    },
  };
}

/**
 * Builds the `bem(...)` call expression for one element. The element name is
 * the first argument (`undefined` when block-level with modifiers, omitted
 * when block-level with none); the modifiers form the second argument.
 */
function buildCallExpression(
  elementName: string | undefined,
  staticModifiers: readonly string[],
  foldedModifiers: readonly { modifier: string; condition: string }[]
): string {
  const modifierArgument = buildModifierArgument(staticModifiers, foldedModifiers);
  if (modifierArgument === undefined) {
    return elementName === undefined ? 'bem()' : `bem(${quote(elementName)})`;
  }
  const elementArgument =
    elementName === undefined ? 'undefined' : quote(elementName);
  return `bem(${elementArgument}, ${modifierArgument})`;
}

/**
 * Builds the modifier argument: a record when any modifier is conditional
 * (static entries keyed to `true`, folded entries to their condition), a bare
 * string or array for static-only modifiers, or `undefined` when there are
 * none.
 */
function buildModifierArgument(
  staticModifiers: readonly string[],
  foldedModifiers: readonly { modifier: string; condition: string }[]
): string | undefined {
  if (foldedModifiers.length > 0) {
    const entries = [
      ...staticModifiers.map((modifier) => `${objectKey(modifier)}: true`),
      ...foldedModifiers.map(
        ({ modifier, condition }) => `${objectKey(modifier)}: ${condition}`
      ),
    ];
    return `{ ${entries.join(', ')} }`;
  }
  if (staticModifiers.length === 0) {
    return undefined;
  }
  if (staticModifiers.length === 1) {
    return quote(staticModifiers[0]);
  }
  return `[${staticModifiers.map(quote).join(', ')}]`;
}

/** Single-quotes a string literal for emission. */
function quote(value: string): string {
  return `'${value}'`;
}

/** Returns a record key: a bare identifier where valid, otherwise quoted. */
function objectKey(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : quote(value);
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
