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

/** Returns true when an event modifier is a key-guard modifier. */
export function isKeyEventModifier(
  modifier: EventModifier
): modifier is KeyEventModifier {
  return modifier in KEY_EVENT_MODIFIER_KEYS;
}

/**
 * The generated guard statement for a key-guard modifier:
 * `if (event.key !== 'Enter') return;`. Shared by every target that wraps
 * key guards in handler code (React, HTML mode, Svelte).
 */
export function keyGuardStatement(modifier: KeyEventModifier): string {
  return `if (event.key !== '${KEY_EVENT_MODIFIER_KEYS[modifier]}') return;`;
}
