import type { EventDefinition } from '@js-template-engine/types';

import { bindingExpression } from './literals';

/**
 * Vue event modifiers. Every modifier in the template format's set - 
 * including the key-guard modifiers, which Vue accepts as kebab-cased
 * `KeyboardEvent.key` names (`@keyup.enter`, `@keyup.arrow-up`) - maps to
 * a native Vue modifier, so the Vue extension never synthesizes handler
 * wrappers.
 */
const NATIVE_MODIFIERS = [
  'stop',
  'prevent',
  'self',
  'capture',
  'once',
  'passive',
  'enter',
  'escape',
  'tab',
  'space',
  'backspace',
  'delete',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
] as const;

/**
 * Renders an event definition as a Vue event binding attribute:
 * `@click="handleClick"`, with modifiers appended to the event name in
 * declared order (`@submit.prevent`, `@click.stop.once`, `@keyup.enter`).
 *
 * The handler is emitted verbatim - a method name (`handleClick`) or an
 * inline expression (`() => save()`) - letting Vue pass the native event
 * to method references automatically.
 */
export function eventAttribute(event: EventDefinition): string {
  const modifiers = (event.modifiers ?? []).filter((modifier) =>
    (NATIVE_MODIFIERS as readonly string[]).includes(modifier)
  );
  const suffix = modifiers.map((modifier) => `.${modifier}`).join('');
  return `@${event.name}${suffix}="${bindingExpression(event.handler)}"`;
}
