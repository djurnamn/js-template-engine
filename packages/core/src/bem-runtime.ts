import type { ElementNode } from '@js-template-engine/types';

import type { BemRuntimeCall, NormalizedComponent } from './normalize';

/**
 * The component a scripted target renders in BEM runtime mode, without the
 * `bem(...)` calls of the elements whose class it removes (a `null` class in
 * the target's attributes override). When that leaves no call, the
 * component-level binding goes too, so the target emits no helper import or
 * setup line that nothing would use. The decision is the target's own: the
 * caller says which elements lose their class there.
 *
 * @param component - The component, styling extensions applied.
 * @param removesClass - Whether the target renders the element with no class.
 * @returns The component itself when nothing is removed, otherwise a copy
 *   with the remaining calls, and with no binding when none remain.
 *
 * @example
 * withoutRemovedBemRuntimeCalls(
 *   component,
 *   (element) =>
 *     (element.extensions?.example as { attributes?: { class?: unknown } })
 *       ?.attributes?.class === null
 * );
 */
export function withoutRemovedBemRuntimeCalls(
  component: NormalizedComponent,
  removesClass: (element: ElementNode) => boolean
): NormalizedComponent {
  const calls = component.bemRuntimeCalls;
  if (calls === undefined) {
    return component;
  }
  const kept = new Map<ElementNode, BemRuntimeCall>();
  for (const [element, call] of calls) {
    if (!removesClass(element)) {
      kept.set(element, call);
    }
  }
  if (kept.size === calls.size) {
    return component;
  }
  if (kept.size > 0) {
    return { ...component, bemRuntimeCalls: kept };
  }
  const { bemRuntime: _binding, bemRuntimeCalls: _calls, ...rest } = component;
  return rest;
}
