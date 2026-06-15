/**
 * A key-guard event modifier: the handler only runs when the corresponding
 * `KeyboardEvent.key` value matches (`'Enter'`, `'Escape'`, `'Tab'`, `' '`,
 * `'Backspace'`, `'Delete'`, `'ArrowUp'`, ...).
 *
 * At most one key modifier is allowed per event definition — chained key
 * guards filter on a single `event.key` and could never pass together;
 * multiple accepted keys are written as separate event entries.
 */
export type KeyEventModifier =
  | 'enter'
  | 'escape'
  | 'tab'
  | 'space'
  | 'backspace'
  | 'delete'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-right';

/**
 * An event modifier.
 *
 * Modifiers map natively where the target framework supports them
 * (Vue `@click.prevent`, Svelte `on:click|preventDefault`) and are wrapped
 * in generated handler code where it doesn't (React, HTML mode). Key-guard
 * modifiers map natively in Vue (`@keyup.enter`) and wrap the handler in a
 * generated `event.key` guard everywhere else.
 */
export type EventModifier =
  | 'prevent'
  | 'stop'
  | 'once'
  | 'self'
  | 'capture'
  | 'passive'
  | KeyEventModifier;

/**
 * An event bound to an element.
 *
 * The name is the generic DOM event name; framework extensions transform it
 * into their own syntax (`onClick={...}`, `@click="..."`, `on:click={...}`).
 *
 * @example
 * const event: EventDefinition = { name: 'click', handler: 'handleClick' };
 * @example
 * const keyed: EventDefinition = {
 *   name: 'keyup',
 *   handler: 'submitSearch',
 *   modifiers: ['enter'],
 * };
 */
export interface EventDefinition {
  /** Generic DOM event name: `'click'`, `'input'`, `'submit'`, ... */
  name: string;
  /** An identifier (`'handleClick'`) or inline JS (`'() => save()'`). */
  handler: string;
  /**
   * Optional modifiers, applied in order. At most one key modifier per
   * event definition.
   */
  modifiers?: EventModifier[];
}
