import {
  isKeyEventModifier,
  keyGuardStatement,
} from '@js-template-engine/core';
import type {
  EventDefinition,
  EventModifier,
  KeyEventModifier,
} from '@js-template-engine/types';

import { expression } from './literals';

type NativeModifier = Exclude<EventModifier, KeyEventModifier>;

/**
 * The template format's non-key event modifiers mapped to their native
 * Svelte event modifiers.
 */
const NATIVE_MODIFIERS: Record<NativeModifier, string> = {
  prevent: 'preventDefault',
  stop: 'stopPropagation',
  self: 'self',
  once: 'once',
  capture: 'capture',
  passive: 'passive',
};

/**
 * The modifiers that stay native pipe modifiers alongside a generated
 * wrapper: listener options rather than handler statements.
 */
const LISTENER_OPTION_MODIFIERS = new Set<EventModifier>([
  'once',
  'capture',
  'passive',
]);

/** Matches an identifier or a dot-separated member path: `handlers.save`. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/**
 * Renders an event definition as a Svelte event binding attribute:
 * `on:click={handleClick}`, with modifiers appended to the event name in
 * declared order (`on:submit|preventDefault`, `on:click|stopPropagation|once`).
 *
 * Svelte's native modifier set has no key filters, so a key-guard modifier
 * wraps the handler in a generated arrow function; the `self`, `prevent`,
 * and `stop` modifiers move into the wrapper with it, applied in declared
 * order, while `once`, `capture`, and `passive` — listener options rather
 * than handler statements — stay native pipe modifiers.
 *
 * Without a key-guard modifier the handler is emitted verbatim — a method
 * name (`handleClick`) or an inline expression (`() => save()`).
 */
export function eventAttribute(event: EventDefinition): string {
  const modifiers = event.modifiers ?? [];

  if (!modifiers.some(isKeyEventModifier)) {
    const suffix = modifiers
      .map((modifier) => `|${NATIVE_MODIFIERS[modifier as NativeModifier]}`)
      .join('');
    return `on:${event.name}${suffix}={${expression(event.handler)}}`;
  }

  const suffix = modifiers
    .filter((modifier) => LISTENER_OPTION_MODIFIERS.has(modifier))
    .map((modifier) => `|${NATIVE_MODIFIERS[modifier as NativeModifier]}`)
    .join('');

  const guards: string[] = [];
  for (const modifier of modifiers) {
    if (modifier === 'self') {
      guards.push('if (event.target !== event.currentTarget) return;');
    } else if (modifier === 'prevent') {
      guards.push('event.preventDefault();');
    } else if (modifier === 'stop') {
      guards.push('event.stopPropagation();');
    } else if (isKeyEventModifier(modifier)) {
      guards.push(keyGuardStatement(modifier));
    }
  }

  const handler = expression(event.handler);
  const call = IDENTIFIER_PATH.test(handler)
    ? `${handler}(event);`
    : `(${handler})(event);`;
  const wrapper = `(event) => { ${[...guards, call].join(' ')} }`;
  return `on:${event.name}${suffix}={${wrapper}}`;
}
