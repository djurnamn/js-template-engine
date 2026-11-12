import {
  type RelayedBinding,
  type TwoWayBinding,
} from '@js-template-engine/core';
import {
  echoGuardName,
  relayedReportLines,
  twoWayCurrentType,
  twoWaySeed,
  twoWaySetterLines,
} from '@js-template-engine/core/emitter';
import type { PropDefinition } from '@js-template-engine/types';

import { serializeJavaScriptValue } from './literals';

/**
 * The script statements that give each two-way prop its value and setter
 * in a Svelte component. The value reads the given prop when it is not
 * `undefined` and the default prop otherwise - a `$derived` in runes mode, a
 * `$:` declaration in legacy mode - and the setter assigns the prop, which
 * keeps a consumer's `bind:` in step and holds the value locally when
 * nothing is bound, then calls the change prop. The legacy setter reads
 * the value from the props each time, since its `$:` declaration updates
 * only after the handler returns; a runes `$derived` is current at once.
 *
 * @param bindings - The component's two-way bindings.
 * @param props - The component's props, as declared.
 * @param local - A prop's local name (its alias, when it has one).
 * @param mode - The Svelte dialect.
 * @returns The statements, one list of lines per binding.
 * @example
 * // const isPressed = $derived(pressed !== undefined ? pressed : defaultPressed);
 * // function setPressed(next: boolean | ((current: boolean) => boolean)) { ... }
 */
export function twoWayStatements(
  bindings: readonly TwoWayBinding[],
  props: Readonly<Record<string, PropDefinition>>,
  local: (name: string) => string,
  mode: 'legacy' | 'runes'
): string[][] {
  return bindings.map((binding) => {
    const seed = twoWaySeed(binding, props, local, serializeJavaScriptValue);
    const currentType = twoWayCurrentType(binding, seed);
    const name = local(binding.prop);
    const value = `${name} !== undefined ? ${name} : ${seed.expression}`;
    return [
      mode === 'runes'
        ? `const ${binding.current} = $derived(${value});`
        : `$: ${binding.current} = ${value};`,
      ...twoWaySetterLines({
        binding,
        currentType,
        // Legacy reads the value afresh: a `$:` declaration updates only
        // after the handler, so a second call would read the first's input.
        currentRead: mode === 'runes' ? binding.current : value,
        keep: (next) => [`${name} = ${next};`],
        changeCall:
          binding.changeProp === undefined
            ? undefined
            : local(binding.changeProp),
        declared: Object.keys(props).map(local),
        reads: [
          name,
          ...(binding.changeProp === undefined
            ? []
            : [local(binding.changeProp)]),
        ],
      }),
    ];
  });
}

/**
 * The script statements that give each relayed two-way prop its given
 * value and report function in a Svelte component. Svelte cannot tell a
 * bound prop from a plain one: the report function assigns the prop, which
 * a consumer's `bind:` follows, and with nothing bound the assignment stays
 * in the component as its own copy. Handed to the value's owner, that copy
 * would turn an owner that keeps its own state into a controlled one. So the
 * given value passes through an echo guard, one per binding: it is
 * `undefined` while the prop holds only values the component reported
 * itself (`Object.is` against the last reported one), and every value from
 * the first one the consumer gives on, as a controlled owner takes it. The
 * guard is a `$derived` in runes mode and a `$:` statement in legacy mode.
 * The report function assigns the prop first, records the value for the
 * guard, then calls the change prop: a consumer that writes the reported
 * value back from the change prop then writes after the component's own
 * copy and replaces it.
 *
 * @param bindings - The component's relayed bindings.
 * @param props - The component's props, as declared.
 * @param local - A prop's local name (its alias, when it has one).
 * @param mode - The Svelte dialect.
 * @returns The statements, one list of lines per binding.
 * @example
 * // const valueEcho = { recorded: false, last: undefined as string | undefined, controlled: false };
 * // const givenValue = $derived.by(() => { ... });
 * // function reportValue(next: string) { value = next; ...; onValueChange?.(next); }
 */
export function relayedStatements(
  bindings: readonly RelayedBinding[],
  props: Readonly<Record<string, PropDefinition>>,
  local: (name: string) => string,
  mode: 'legacy' | 'runes'
): string[][] {
  return bindings.map((binding) => {
    const name = local(binding.prop);
    const echo = echoGuardName(name);
    const type = binding.definition.type.trim();
    const lastType = /\?|=>/.test(type) ? `(${type})` : type;
    const echoed = `!${echo}.controlled && (${name} === undefined || (${echo}.recorded && Object.is(${name}, ${echo}.last)))`;
    const guard =
      mode === 'runes'
        ? [
            `const ${binding.given} = $derived.by(() => {`,
            `  if (${echoed}) {`,
            '    return undefined;',
            '  }',
            `  ${echo}.controlled = true;`,
            `  return ${name};`,
            '});',
          ]
        : [
            `let ${binding.given}: ${lastType} | undefined;`,
            `$: if (${echoed}) {`,
            `  ${binding.given} = undefined;`,
            '} else {',
            `  ${echo}.controlled = true;`,
            `  ${binding.given} = ${name};`,
            '}',
          ];
    const changeCall =
      binding.changeProp === undefined ? undefined : local(binding.changeProp);
    return [
      `const ${echo} = { recorded: false, last: undefined as ${lastType} | undefined, controlled: false };`,
      ...guard,
      ...relayedReportLines({
        binding,
        before: (value) => [
          `${name} = ${value};`,
          `${echo}.recorded = true;`,
          `${echo}.last = ${value};`,
        ],
        changeCall,
        declared: Object.keys(props).map(local),
        reads: [name, echo, ...(changeCall === undefined ? [] : [changeCall])],
      }),
    ];
  });
}
