import { echoGuardName } from '@js-template-engine/core/emitter';
import type {
  ReservedName,
  ReservedNameContext,
} from '@js-template-engine/types';

/**
 * The names a Svelte component declares itself in its `<script>`, in
 * either mode: the BEM runtime import, the style helpers and the runes
 * rest, whatever the template; the once-event helper and its merged record
 * only where an event uses the `once` modifier, the event import where one
 * uses `passive`, and an attached listener's element where one uses either.
 */
export const SVELTE_RESERVED_NAMES: readonly ReservedName[] = Object.freeze([
  { name: 'createBem', description: "Vue's and Svelte's BEM runtime import" },
  { name: 'serializeStyleObject', description: "Svelte's style helper" },
  {
    name: 'consumerStyleValue',
    description: "Svelte's consumer style helper",
  },
  { name: 'restProperties', description: "Svelte's rest" },
  {
    name: 'once',
    description: "Svelte's once-event helper",
    when: { eventModifiers: ['once'] },
  },
  {
    name: 'on',
    description: "Svelte's event import",
    when: { eventModifiers: ['passive'] },
  },
  {
    name: 'onceRan',
    description: "Svelte's merged one-shot listener record",
    when: { eventModifiers: ['once'] },
  },
  {
    name: 'listenerElement',
    description: "Svelte's attached-listener element",
    when: { eventModifiers: ['passive', 'once'] },
  },
]);

/**
 * The names a Svelte component declares itself: those of every component
 * ({@link SVELTE_RESERVED_NAMES}) and each relayed two-way prop's echo
 * guard (`<prop>Echo`), which tells the values the component reported
 * itself from the ones the consumer gives.
 *
 * @param context - The template and its two-way props.
 * @returns The reserved names.
 * @example
 * svelteReservedNames({ template, twoWayProps: [{ name: 'value', local: 'value', relayed: true }] });
 * // [..., { name: 'valueEcho', description: "Svelte's echo guard of 'value'", when: 'twoWay', ... }]
 */
export function svelteReservedNames(
  context: ReservedNameContext
): ReservedName[] {
  const names: ReservedName[] = [...SVELTE_RESERVED_NAMES];
  for (const { name, local, relayed } of context.twoWayProps) {
    if (relayed !== true) continue;
    names.push({
      name: echoGuardName(local),
      description: `Svelte's echo guard of the relayed prop '${name}'`,
      when: 'twoWay',
      readable: false,
      path: `props.${name}`,
    });
  }
  return names;
}
