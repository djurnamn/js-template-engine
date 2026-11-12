import type { JsonValue } from './json-value';

/**
 * A component prop definition.
 *
 * Rendered as a generated props interface with destructured defaults in
 * React, `defineProps` in Vue, and `export let` declarations in Svelte. HTML
 * mode has no props: their values appear as `{{ expression }}`
 * placeholders.
 *
 * A prop sets at most one of `default` and `documentedDefault`.
 *
 * @example
 * const variant: PropDefinition = {
 *   type: "'primary' | 'secondary'",
 *   default: 'primary',
 * };
 *
 * @if {"required": ["default"]}
 * @then {"not": {"required": ["documentedDefault"]}}
 */
export interface PropDefinition {
  /** A TypeScript type expression: `"'primary' | 'secondary'"`, `'boolean'`. */
  type: string;
  /** Whether the prop is required. Defaults to `false`. */
  required?: boolean;
  /** A JSON-serializable default value. */
  default?: JsonValue;
  /**
   * A default the component applies without declaring it, such as an absent
   * value its conditionals treat as `'start'`: the code a consumer reads, as
   * a string (`"'start'"`). Documentation only: it is written as the prop's
   * `@defaultValue` exactly as a declared `default` is, and leaves the
   * generated code as it would be without it. Not combined with `default`.
   *
   * @minLength 1
   */
  documentedDefault?: string;
  /**
   * What the prop is for, written as a TSDoc comment on the generated prop in
   * every target (with a `@defaultValue` from `default` or
   * `documentedDefault`), so a consumer's editor shows it on hover, and
   * readable here by tooling such as a kit's docs. Markdown is allowed.
   */
  description?: string;
  /**
   * The prop is two-way: a consumer may bind it and follow the component's
   * changes. Defaults to `false`.
   *
   * `true` declares the binding only: Svelte in runes mode destructures the
   * prop as `$bindable(<default>)`, so `bind:value` compiles; legacy Svelte
   * binds every prop already, and React and Vue ignore the flag. The
   * component's own scripts change the value.
   *
   * An object (`BindableDefinition`) also has every scripted target
   * generate the two-way plumbing, in one of two forms. The copy form
   * (`current` and `setter`) keeps the controlled and uncontrolled value in
   * the component: it reads the given value, or its own copy when the prop
   * is not given, under `current`, and changes it through the generated
   * `setter`. The relayed form (`given` and `report`) keeps no copy: the
   * value's owner, such as a state machine or a native input, holds it, and
   * the component forwards the given value as `given` and reports the
   * owner's changes through `report`.
   */
  bindable?: boolean | BindableDefinition;
}

/**
 * The two-way value a component generates for a bindable prop, in one of
 * two forms: the copy form (`CopiedBindableDefinition`), where the
 * component keeps the value, or the relayed form
 * (`RelayedBindableDefinition`), where the value's owner keeps it.
 * Either way the template reads and changes the value by names that are the
 * same text in every target, and a consumer's `v-model` (Vue) or `bind:`
 * (Svelte) follows it.
 */
export type BindableDefinition =
  | CopiedBindableDefinition
  | RelayedBindableDefinition;

/**
 * The copy form of a two-way value. The template reads the value under
 * `current` and changes it only by calling `setter`, the same text in every
 * target.
 *
 * When the consumer gives the prop (anything but `undefined`, `null`
 * included), the component shows that value and only reports changes. When
 * the prop is not given, the component keeps its own copy, starting from
 * `defaultProp` (or the prop's own `default`). Every change calls
 * `changeProp` with the new value, and a consumer's `v-model` (Vue) or
 * `bind:` (Svelte) follows it.
 *
 * @example
 * const pressed: PropDefinition = {
 *   type: 'boolean',
 *   bindable: {
 *     current: 'isPressed',
 *     setter: 'setPressed',
 *     defaultProp: 'defaultPressed',
 *     changeProp: 'onPressedChange',
 *   },
 * };
 */
export interface CopiedBindableDefinition {
  /**
   * The name the template's expressions and the component script read the
   * value by: the given prop when it is not `undefined`, otherwise the
   * component's own copy. An identifier no prop, slot or script takes.
   *
   * @minLength 1
   */
  current: string;
  /**
   * The name of the function the component generates to change the value,
   * called from handlers with the next value or an updater,
   * `(current) => next`. An unchanged value (`Object.is`) is skipped.
   *
   * @minLength 1
   */
  setter: string;
  /**
   * The declared prop whose value the component's own copy starts from when
   * the prop is not given. Without it, the prop's own `default` seeds it.
   *
   * @minLength 1
   */
  defaultProp?: string;
  /**
   * The declared event prop, a function returning `void`, called with each
   * new value in every target (before Vue's `update:` emit).
   *
   * @minLength 1
   */
  changeProp?: string;
}

/**
 * The relayed form of a two-way value, for a value whose owner holds it: a
 * state machine driver or a native input, which handles being controlled or
 * uncontrolled itself. The component keeps no copy. The template forwards
 * the value the consumer gives under `given` and hands the owner `report`
 * to call with each change, the same text in every target. A relayed prop
 * declares no `default` of its own: what the owner starts from when the
 * prop is not given is an ordinary prop the template forwards to it.
 *
 * In React, `given` is the prop. In Vue it is a `computed` reading
 * `modelValue` first when `extensions.vue.model` names the prop. In Svelte
 * it passes through a generated echo guard: `undefined` while the prop holds
 * only values the component reported itself, then every value once the
 * consumer gives one, so with nothing given and nothing bound the owner
 * keeps its own state. `report` calls `changeProp` with the new value in
 * every target; Vue then emits `update:<prop>` (and `update:modelValue` with
 * a model), and Svelte assigns the prop first, so a consumer's `bind:`
 * follows it. Every call passes through, an unchanged value included.
 *
 * @example
 * const value: PropDefinition = {
 *   type: 'string',
 *   bindable: {
 *     given: 'givenValue',
 *     report: 'reportValue',
 *     changeProp: 'onValueChange',
 *   },
 * };
 */
export interface RelayedBindableDefinition {
  /**
   * The name the template's expressions and the component script read the
   * value by, as the consumer gives it, which the template forwards to the
   * value's owner. An identifier no prop, slot or script takes.
   *
   * @minLength 1
   */
  given: string;
  /**
   * The name of the function the component generates for the owner to
   * report each new value through, called with the new value. The value is
   * typed as `changeProp`'s first parameter when its type states one, and
   * as the prop otherwise.
   *
   * @minLength 1
   */
  report: string;
  /**
   * The declared event prop, a function returning `void`, called with each
   * reported value in every target (before Vue's `update:` emit).
   *
   * @minLength 1
   */
  changeProp?: string;
}
