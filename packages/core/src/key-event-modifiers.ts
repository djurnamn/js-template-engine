import type {
  EventModifier,
  KeyEventModifier,
} from '@js-template-engine/types';

/**
 * The `KeyboardEvent.key` value each key-guard modifier filters on.
 */
export const KEY_EVENT_MODIFIER_KEYS: Record<KeyEventModifier, string> = {
  enter: 'Enter',
  escape: 'Escape',
  tab: 'Tab',
  space: ' ',
  backspace: 'Backspace',
  delete: 'Delete',
  'arrow-up': 'ArrowUp',
  'arrow-down': 'ArrowDown',
  'arrow-left': 'ArrowLeft',
  'arrow-right': 'ArrowRight',
};

/**
 * The modifiers that are not key guards, keyed so the compiler holds the
 * list to the {@link EventModifier} union.
 */
const NON_KEY_EVENT_MODIFIERS: Record<
  Exclude<EventModifier, KeyEventModifier>,
  true
> = {
  prevent: true,
  stop: true,
  once: true,
  self: true,
  capture: true,
  passive: true,
};

/**
 * Every supported event modifier, in the order a validation error lists
 * them: `prevent`, `stop`, `once`, `self`, `capture`, `passive`, then the
 * key guards.
 */
export const EVENT_MODIFIERS: readonly EventModifier[] = [
  ...(Object.keys(NON_KEY_EVENT_MODIFIERS) as EventModifier[]),
  ...(Object.keys(KEY_EVENT_MODIFIER_KEYS) as KeyEventModifier[]),
];

/**
 * Returns true when a value is a supported event modifier.
 *
 * @param modifier - The value to test.
 * @returns `true` for one of {@link EVENT_MODIFIERS}.
 * @example
 * isEventModifier('prevent'); // true
 * isEventModifier('home'); // false
 */
export function isEventModifier(modifier: unknown): modifier is EventModifier {
  return (
    typeof modifier === 'string' &&
    (EVENT_MODIFIERS as readonly string[]).includes(modifier)
  );
}

/** Returns true when an event modifier is a key-guard modifier. */
export function isKeyEventModifier(
  modifier: EventModifier
): modifier is KeyEventModifier {
  return modifier in KEY_EVENT_MODIFIER_KEYS;
}

/**
 * The generated guard statement for a key-guard modifier:
 * `if (event.key !== 'Enter') return;`. Shared by every target that wraps
 * key guards in handler code (React, Svelte).
 */
export function keyGuardStatement(modifier: KeyEventModifier): string {
  return `if (event.key !== '${KEY_EVENT_MODIFIER_KEYS[modifier]}') return;`;
}
