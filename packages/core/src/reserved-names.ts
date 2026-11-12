import type {
  Extension,
  ReservedName,
  ReservedNameContext,
} from '@js-template-engine/types';

/**
 * The names the engine's own generated code declares in a component's scope:
 * the BEM runtime's `bem`, the locals a dynamic tag renders through (`RootTag`,
 * `Tag`, and `Tag2`, `Tag3`, ...) and the surface and event helpers whose
 * code the engine writes. Reserved in every build; the names only one
 * target's output declares come from that target's extension
 * ({@link Extension.reservedNames}).
 */
const ENGINE_RESERVED_NAMES: readonly ReservedName[] = [
  { name: 'bem', description: 'the BEM runtime the scripted targets set up' },
  {
    name: 'RootTag',
    description: 'the local a dynamic root tag renders through',
  },
  { name: 'Tag', description: 'the local a dynamic tag renders through' },
  {
    name: 'authoredOrConsumer',
    description: "the surface's attribute helper",
  },
  {
    name: 'authoredAndConsumer',
    description: "the routed element's id-list helper",
  },
  {
    name: 'composeEventHandlers',
    description: "the surface's event helper",
  },
  {
    name: 'consumerAttributes',
    description: "the surface's routing helper",
  },
  {
    name: 'invokeHandler',
    description: "the generated event wrappers' handler helper",
  },
];

/** A numbered dynamic-tag local, which the `Tag` entry stands for. */
const NUMBERED_TAG = /^Tag\d+$/;

/** The engine's own reserved names, as a set. */
const ENGINE_NAMES: ReadonlySet<string> = new Set(
  ENGINE_RESERVED_NAMES.map(({ name }) => name)
);

/**
 * Every name reserved in a component: the engine's own, then each
 * extension's in the order given, a function-valued declaration called with
 * the context.
 *
 * @param extensions - The extensions of the build.
 * @param context - The component and its two-way props.
 * @returns The reserved names, the engine's first; a name may appear more
 *   than once, and the first entry describes it.
 * @example
 * resolveReservedNames([vue()], { template, twoWayProps: [] });
 * // [{ name: 'bem', ... }, ..., { name: 'useAttrs', description: "Vue's attributes import" }, ...]
 */
export function resolveReservedNames(
  extensions: readonly Extension[],
  context: ReservedNameContext
): ReservedName[] {
  const names: ReservedName[] = [...ENGINE_RESERVED_NAMES];
  for (const extension of extensions) {
    const declared = extension.reservedNames;
    if (declared === undefined) continue;
    names.push(
      ...(typeof declared === 'function' ? declared(context) : declared)
    );
  }
  return names;
}

/**
 * What declares a reserved name in every component, or `undefined` for a
 * name nothing declares there. A numbered dynamic-tag local such as `Tag2`
 * counts, and a name declared for an event modifier counts when the
 * component's events use one.
 *
 * @param names - The reserved names ({@link resolveReservedNames}).
 * @param name - The name to look up.
 * @param eventModifiers - The modifiers the component's events use; names
 *   declared for a modifier count only when one is in it.
 * @returns A short description of the binding, for an error message.
 * @example
 * reservedBindingOf(names, 'bem'); // 'the BEM runtime the scripted targets set up'
 * reservedBindingOf(names, 'Tag2'); // 'the local a dynamic tag renders through'
 */
export function reservedBindingOf(
  names: readonly ReservedName[],
  name: string,
  eventModifiers: ReadonlySet<string> = new Set()
): string | undefined {
  const lookup = NUMBERED_TAG.test(name) ? 'Tag' : name;
  for (const entry of names) {
    if (entry.name !== lookup) continue;
    const when = entry.when;
    if (when === undefined) return entry.description;
    if (
      typeof when === 'object' &&
      when.eventModifiers.some((modifier) => eventModifiers.has(modifier))
    ) {
      return entry.description;
    }
  }
  return undefined;
}

/**
 * The names declared in every component or for an event modifier, whatever
 * the component's events: the names a prop alias steers clear of.
 *
 * @param names - The reserved names ({@link resolveReservedNames}).
 * @returns The names.
 */
export function reservedBindingNames(
  names: readonly ReservedName[]
): Set<string> {
  return new Set(
    names
      .filter(({ when }) => when === undefined || typeof when === 'object')
      .map(({ name }) => name)
  );
}

/**
 * Whether the engine's own generated code may declare a name: one of its
 * reserved names or a numbered dynamic-tag local such as `Tag2`.
 *
 * @param name - The name to test.
 * @returns `true` for a name the engine reserves in every build.
 * @example
 * isEngineReservedName('bem'); // true
 * isEngineReservedName('Tag3'); // true
 * isEngineReservedName('label'); // false
 */
export function isEngineReservedName(name: string): boolean {
  return ENGINE_NAMES.has(name) || NUMBERED_TAG.test(name);
}
