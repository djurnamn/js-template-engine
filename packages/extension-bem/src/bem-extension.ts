import type {
  CollapseVocabulary,
  StylingContext,
  StylingExtension,
} from '@js-template-engine/core';
import type { ElementNode } from '@js-template-engine/types';

import type { BemNodeOverrides } from './overrides';

/** Options for the BEM extension. */
export interface BemOptions {
  /** Separator between block and element. Defaults to `'__'`. */
  elementSeparator?: string;
  /** Separator between base class and modifier. Defaults to `'--'`. */
  modifierSeparator?: string;
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
 * classes. BEM classes are semantic — generated CSS may use them as
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

  /**
   * The node's effective base class (`block`, or `block__element`), or
   * `undefined` when no block is declared or inherited. `warnOnOrphan`
   * emits the no-effective-block warning — done once, from
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

  return {
    key: 'bem',
    kind: 'styling',
    classKind: 'semantic',
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
