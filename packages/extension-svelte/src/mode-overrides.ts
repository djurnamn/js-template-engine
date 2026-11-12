import {
  resolveComponentOverrides,
  type NormalizedComponent,
} from '@js-template-engine/core';
import {
  applyComponentOverride,
  COMPONENT_OVERRIDE_KEYS,
  validateComponentOverride,
} from '@js-template-engine/core/emitter';
import type {
  ComponentExtensionOverride,
  Warning,
} from '@js-template-engine/types';

import type { SvelteComponentOverride } from './overrides';
import type { SvelteMode } from './svelte-extension';

/**
 * The keys of the Svelte component override holding a per-mode override
 * block, one per Svelte mode.
 */
export const SVELTE_MODE_OVERRIDE_KEYS: readonly SvelteMode[] = Object.freeze([
  'legacy',
  'runes',
]);

/**
 * Applies the component's Svelte override for the emitted mode: the shared
 * keys of `extensions.svelte` first, then the block for the mode
 * (`extensions.svelte.legacy` or `extensions.svelte.runes`) on the result,
 * each field per its strategy.
 *
 * Both mode blocks are checked whichever mode is emitted, so a malformed
 * block fails every Svelte build: a block of the wrong shape is a
 * `TemplateError` naming its path, and a key the block does not read is a
 * warning, as on the override itself.
 *
 * @param component - The normalized component.
 * @param mode - The emitted Svelte mode.
 * @param warnings - Receives a warning per unread key in a mode block.
 * @returns The component with the overrides for the mode applied.
 */
export function resolveSvelteOverrides(
  component: NormalizedComponent,
  mode: SvelteMode,
  warnings: Warning[]
): NormalizedComponent {
  const resolved = resolveComponentOverrides(component, 'svelte');
  const override = component.extensions.svelte;
  if (!isRecord(override)) {
    return resolved;
  }
  for (const key of SVELTE_MODE_OVERRIDE_KEYS) {
    const block = override[key];
    if (block === undefined) {
      continue;
    }
    const path = `extensions.svelte.${key}`;
    validateComponentOverride(block, path);
    for (const unread of Object.keys(block as object).filter(
      (blockKey) => !COMPONENT_OVERRIDE_KEYS.includes(blockKey)
    )) {
      warnings.push({
        message:
          `The svelte ${key} override has no '${unread}' key, so it has no effect; ` +
          `a mode block reads ${COMPONENT_OVERRIDE_KEYS.join(', ')}`,
        nodePath: `${path}.${unread}`,
      });
    }
  }
  return applyComponentOverride(
    resolved,
    (override as SvelteComponentOverride)[mode] as
      | ComponentExtensionOverride
      | undefined
  );
}

/** Whether a value is a plain record: an object, not null or an array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
