import type { Extension, Warning } from '@js-template-engine/types';

import { isTargetExtension } from './extension';
import type { NormalizedComponent } from './normalize';
import { visitNodes } from './traverse';

/**
 * The keys of the component-level override every target extension reads
 * through `resolveComponentOverrides`: the component's script, imports,
 * style and props, and how each combines with the base value.
 */
export const COMPONENT_OVERRIDE_KEYS: readonly string[] = Object.freeze([
  'script',
  'scriptStrategy',
  'imports',
  'importsStrategy',
  'style',
  'styleStrategy',
  'props',
  'propsStrategy',
]);

/**
 * The keys of an element's override every target extension reads: the
 * `tag` replacing the element, the `attributes` merged over the node's and
 * the `events` replacing them. On a fragment the same keys name the wrapper
 * the target renders around its children.
 */
export const TARGET_NODE_OVERRIDE_KEYS: readonly string[] = Object.freeze([
  'tag',
  'attributes',
  'events',
]);

/**
 * Warns about each key of an extension's override block that the extension
 * does not read, for every extension in the build that declares its
 * `overrideKeys`: a misspelled or invented key (`omitProps`) would
 * otherwise have no effect and no trace. Blocks of extensions outside the
 * build stay inert and unchecked.
 *
 * @param component - The normalized component.
 * @param extensions - The extensions of the build.
 * @param rootPath - The path of the component's children: `children`, or
 *   `''` for a node-array template.
 * @returns One warning per unread key, its path naming the key.
 *
 * @example
 * // extensions: { vue: { omitProps: ['open'] } } on the component, built with vue()
 * collectOverrideKeyWarnings(component, [vue()], 'children');
 * // → [{ message: "The vue override has no 'omitProps' key; ...", nodePath: 'extensions.vue.omitProps' }]
 */
export function collectOverrideKeyWarnings(
  component: NormalizedComponent,
  extensions: readonly Extension[],
  rootPath: string
): Warning[] {
  const warnings: Warning[] = [];
  for (const extension of extensions) {
    const keys = extension.overrideKeys;
    if (keys === undefined) {
      continue;
    }
    if (keys.component !== undefined) {
      warnings.push(
        ...unreadKeys(
          component.extensions[extension.key],
          extension.key,
          keys.component,
          'extensions',
          'on a component'
        )
      );
    }
    const nodeKeys = keys.node;
    if (nodeKeys !== undefined) {
      // On a fragment a target extension reads the wrapper's keys, and
      // any other extension nothing: a fragment renders no element to style.
      const fragmentKeys = isTargetExtension(extension)
        ? TARGET_NODE_OVERRIDE_KEYS
        : [];
      visitNodes(component.children, rootPath, (node, path) => {
        const overrides = (node as { extensions?: Record<string, unknown> })
          .extensions;
        const fragment = node.type === 'fragment';
        warnings.push(
          ...unreadKeys(
            overrides?.[extension.key],
            extension.key,
            fragment ? fragmentKeys : nodeKeys,
            `${path}.extensions`,
            fragment ? 'on a fragment' : 'on an element',
            !fragment && isTargetExtension(extension)
          )
        );
      });
    }
  }
  return warnings;
}

/** The warnings for one override block's keys outside `known`. */
function unreadKeys(
  override: unknown,
  extensionKey: string,
  known: readonly string[],
  path: string,
  place: string,
  namesWrapperReplacement = false
): Warning[] {
  if (
    typeof override !== 'object' ||
    override === null ||
    Array.isArray(override)
  ) {
    return [];
  }
  return Object.keys(override)
    .filter((key) => !known.includes(key))
    .map((key) => ({
      message:
        namesWrapperReplacement && key === 'unwrap'
          ? `The ${extensionKey} override has no 'unwrap' key, so it has no effect. ` +
            `For a wrapper only some targets render, make the node a fragment and give those targets its tag: ` +
            `{ type: 'fragment', extensions: { ${extensionKey}: { tag: 'div' } }, children: [...] }; ` +
            `every other target renders the children alone`
          : `The ${extensionKey} override has no '${key}' key, so it has no effect; ` +
            `${place} the ${extensionKey} extension reads ${known.length === 0 ? 'nothing' : known.join(', ')}`,
      nodePath: `${path}.${extensionKey}.${key}`,
    }));
}
