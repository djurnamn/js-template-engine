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

/**
 * The events Svelte attaches passively by default, where the `passive`
 * modifier is already satisfied by the plain event attribute.
 */
const PASSIVE_BY_DEFAULT_EVENTS = new Set(['touchstart', 'touchmove']);

/** Matches an identifier or a dot-separated member path: `handlers.save`. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/**
 * The handler statements a modifier list contributes to a generated wrapper,
 * in declared order: the `self` target guard, `preventDefault`/
 * `stopPropagation` calls, and key guards.
 */
function handlerStatementGuards(modifiers: EventModifier[]): string[] {
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
  return guards;
}

/**
 * The handler expression with the guard statements applied: the handler
 * verbatim when there are none, otherwise a generated arrow wrapper running
 * the guards before the handler call. An inline handler expression is
 * parenthesized so it stays a single call target.
 */
function wrappedHandler(event: EventDefinition, guards: string[]): string {
  const handler = expression(event.handler);
  if (guards.length === 0) {
    return handler;
  }
  const call = IDENTIFIER_PATH.test(handler)
    ? `${handler}(event);`
    : `(${handler})(event);`;
  return `(event) => { ${[...guards, call].join(' ')} }`;
}

/**
 * Renders an event definition as a Svelte event binding attribute:
 * `on:click={handleClick}`, with modifiers appended to the event name in
 * declared order (`on:submit|preventDefault`, `on:click|stopPropagation|once`).
 *
 * Svelte's native modifier set has no key filters, so a key-guard modifier
 * wraps the handler in a generated arrow function; the `self`, `prevent`,
 * and `stop` modifiers move into the wrapper with it, applied in declared
 * order, while `once`, `capture`, and `passive` - listener options rather
 * than handler statements - stay native pipe modifiers.
 *
 * Without a key-guard modifier the handler is emitted verbatim - a method
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

  return `on:${event.name}${suffix}={${wrappedHandler(
    event,
    handlerStatementGuards(modifiers)
  )}}`;
}

/** The name of the generated one-shot handler helper. */
export const ONCE_HELPER_NAME = 'once';

/** The name of the generated handler-composition helper. */
export const COMPOSE_HELPER_NAME = 'composeEventHandlers';

/**
 * A read of one event attribute off the passthrough rest object, as the
 * property access the composition helper receives:
 * `restProperties.onclick`, or the indexed form when the attribute name is
 * not a valid identifier (an event name is author space).
 */
function restHandlerAccess(
  restIdentifier: string,
  attributeName: string
): string {
  return /^[A-Za-z_$][\w$]*$/.test(attributeName)
    ? `${restIdentifier}.${attributeName}`
    : `${restIdentifier}[${JSON.stringify(attributeName)}]`;
}

/**
 * The attribute value for an event binding on a node that also spreads the
 * consumer's undeclared props - a passthrough surface root: the declared
 * handler **composed with** whatever handler the spread carries for the
 * same attribute, rather than overwriting it.
 *
 * Both land in one attribute object (`{...restProperties, onclick: ... }`),
 * so the later key wins outright - an unset optional handler prop would
 * erase a consumer's handler, and a set one would replace it. Legacy mode
 * has no such collision, since its `on:` directives attach as their own
 * listeners beside the spread; this gives runes attributes the same
 * composing behavior. `restIdentifier` is `undefined` on every other node,
 * where the value renders bare.
 */
function composedAttributeValue(
  value: string,
  attributeName: string,
  restIdentifier: string | undefined
): { value: string; usesComposeHelper: boolean } {
  if (restIdentifier === undefined) {
    return { value, usesComposeHelper: false };
  }
  return {
    value: `${COMPOSE_HELPER_NAME}(${value}, ${restHandlerAccess(
      restIdentifier,
      attributeName
    )})`,
    usesComposeHelper: true,
  };
}

/** A rendered runes event binding, with the script needs it introduces. */
export interface RunesEventEmission {
  /** The markup part: an event attribute or an `{@attach}` listener. */
  part: string;
  /**
   * True when the binding applies the generated `once(...)` helper; the
   * component builder then declares it in `<script>`.
   */
  usesOnceHelper: boolean;
  /**
   * True when the binding attaches through `on` from `svelte/events`
   * (a passive listener); the component builder then emits the import.
   */
  usesPassiveAttachment: boolean;
  /**
   * True when the binding composes with the passthrough spread through the
   * generated `composeEventHandlers(...)` helper; the component builder then
   * declares it in `<script>`.
   */
  usesComposeHelper: boolean;
}

/**
 * Renders an event definition as a Svelte runes event attribute:
 * `onclick={handleClick}`. Event attributes have no modifier syntax, so the
 * modifiers render as generated code instead, in declared order:
 *
 * - `self`, `prevent`, `stop`, and key guards become statements in a
 *   generated arrow wrapper.
 * - `capture` renders as the capture attribute form (`onclickcapture`).
 * - `once` applies the generated `once(...)` helper inline at the attribute,
 *   so the one-shot state is per rendered element.
 * - `passive` on `touchstart`/`touchmove` drops - those listeners are
 *   passive by default. On any other event the binding renders as an
 *   `{@attach}` listener through `on` from `svelte/events` with
 *   `{ passive: true }`; a `once` on such a binding rides the same options
 *   object natively instead of the helper.
 */
export function runesEventAttribute(
  event: EventDefinition,
  restIdentifier?: string
): RunesEventEmission {
  const modifiers = event.modifiers ?? [];
  const capture = modifiers.includes('capture');
  const once = modifiers.includes('once');
  const passive =
    modifiers.includes('passive') && !PASSIVE_BY_DEFAULT_EVENTS.has(event.name);

  const handler = wrappedHandler(event, handlerStatementGuards(modifiers));

  if (passive) {
    // An `{@attach}` listener attaches on its own, beside the spread rather
    // than into it, so it never collides and never composes.
    return {
      part: attachedListener(event, handler, { passive: true, capture, once }),
      usesOnceHelper: false,
      usesPassiveAttachment: true,
      usesComposeHelper: false,
    };
  }

  const attributeName = capture ? `on${event.name}capture` : `on${event.name}`;
  const bound = once ? `${ONCE_HELPER_NAME}(${handler})` : handler;
  const composed = composedAttributeValue(bound, attributeName, restIdentifier);
  return {
    part: `${attributeName}={${composed.value}}`,
    usesOnceHelper: once,
    usesPassiveAttachment: false,
    usesComposeHelper: composed.usesComposeHelper,
  };
}

/**
 * Renders a node's events as runes event bindings, one per distinct event
 * attribute.
 *
 * Two events resolving to the same event attribute (two `keydown` handlers
 * → `onkeydown`, but not `keydown` vs a captured `keydown`) cannot both be
 * spelled as attributes - Svelte rejects the duplicate - so they merge into
 * one handler that invokes each in declared order, exactly as the React
 * extension merges same-name event props: a handler with an early-returning
 * guard (`self` or a key modifier) is isolated in its own arrow so its
 * `return` cannot skip the handlers that follow it. A `once` handler cannot
 * join a merged attribute (its one-shot state must persist per element, and
 * an inline `once(...)` inside the merged wrapper would be recreated on
 * every dispatch), so it renders as an `{@attach}` listener with the native
 * `{ once: true }` option instead. Passive bindings already attach as
 * independent listeners and never collide.
 *
 * On a passthrough surface root the caller passes the rest identifier
 * (`restProperties`), and every attribute-form binding composes with the
 * handler the spread carries for the same attribute instead of overwriting
 * it - see {@link composedAttributeValue}.
 */
export function runesEventAttributes(
  events: EventDefinition[],
  restIdentifier?: string
): RunesEventEmission[] {
  const attributeNameOf = (event: EventDefinition): string | undefined => {
    const modifiers = event.modifiers ?? [];
    const passive =
      modifiers.includes('passive') &&
      !PASSIVE_BY_DEFAULT_EVENTS.has(event.name);
    if (passive) {
      return undefined;
    }
    return modifiers.includes('capture')
      ? `on${event.name}capture`
      : `on${event.name}`;
  };

  const groups = new Map<string, EventDefinition[]>();
  for (const event of events) {
    const attributeName = attributeNameOf(event);
    if (attributeName === undefined) {
      continue;
    }
    const group = groups.get(attributeName);
    if (group === undefined) {
      groups.set(attributeName, [event]);
    } else {
      group.push(event);
    }
  }

  const emissions: RunesEventEmission[] = [];
  const emitted = new Set<string>();
  for (const event of events) {
    const attributeName = attributeNameOf(event);
    if (attributeName === undefined) {
      emissions.push(runesEventAttribute(event, restIdentifier));
      continue;
    }
    if (emitted.has(attributeName)) {
      continue;
    }
    emitted.add(attributeName);

    const group = groups.get(attributeName)!;
    if (group.length === 1) {
      emissions.push(runesEventAttribute(event, restIdentifier));
      continue;
    }

    const bodies: string[] = [];
    const onceAttachments: RunesEventEmission[] = [];
    for (const member of group) {
      const modifiers = member.modifiers ?? [];
      if (modifiers.includes('once')) {
        onceAttachments.push({
          part: attachedListener(
            member,
            wrappedHandler(member, handlerStatementGuards(modifiers)),
            {
              passive: false,
              capture: modifiers.includes('capture'),
              once: true,
            }
          ),
          usesOnceHelper: false,
          usesPassiveAttachment: true,
          usesComposeHelper: false,
        });
        continue;
      }
      const statements = runesEventStatements(member).join(' ');
      bodies.push(
        needsIsolation(member)
          ? `((event) => { ${statements} })(event);`
          : statements
      );
    }
    if (bodies.length > 0) {
      const composed = composedAttributeValue(
        `(event) => { ${bodies.join(' ')} }`,
        attributeName,
        restIdentifier
      );
      emissions.push({
        part: `${attributeName}={${composed.value}}`,
        usesOnceHelper: false,
        usesPassiveAttachment: false,
        usesComposeHelper: composed.usesComposeHelper,
      });
    }
    emissions.push(...onceAttachments);
  }
  return emissions;
}

/** The guard statements plus the handler invocation, in declared order. */
function runesEventStatements(event: EventDefinition): string[] {
  const handler = expression(event.handler);
  const call = IDENTIFIER_PATH.test(handler)
    ? `${handler}(event);`
    : `(${handler})(event);`;
  return [...handlerStatementGuards(event.modifiers ?? []), call];
}

/**
 * Whether the event's guards include an early `return` (the `self` and
 * key-guard modifiers) - such a handler must be isolated when merged so its
 * `return` does not skip later same-name handlers.
 */
function needsIsolation(event: EventDefinition): boolean {
  return (event.modifiers ?? []).some(
    (modifier) => modifier === 'self' || isKeyEventModifier(modifier)
  );
}

/**
 * An `{@attach}` listener through `on` from `svelte/events`, carrying the
 * listener options an event attribute cannot express (`passive`, a
 * persistent one-shot `once`), with `capture` folded into the options.
 */
function attachedListener(
  event: EventDefinition,
  handler: string,
  options: { passive: boolean; capture: boolean; once: boolean }
): string {
  const entries: string[] = [];
  if (options.passive) {
    entries.push('passive: true');
  }
  if (options.capture) {
    entries.push('capture: true');
  }
  if (options.once) {
    entries.push('once: true');
  }
  return `{@attach (node) => on(node, '${event.name}', ${handler}, { ${entries.join(', ')} })}`;
}

/**
 * The generated handler-composition helper: returns one handler invoking
 * each supplied handler in order, skipping those that are absent, and
 * `undefined` when none is supplied - so an element whose declared handler
 * prop and consumer spread are both empty attaches no listener at all.
 *
 * The event parameter is `any` because the two sides are typed
 * independently: the declared handler by its authored prop type, the
 * spread's by `SvelteHTMLElements[tag]`. The returned handler stays
 * assignable to either.
 */
export function composeEventHandlersDeclaration(): string {
  return [
    'type ComposableEventHandler = (event: any) => void;',
    '',
    `function ${COMPOSE_HELPER_NAME}(`,
    '  ...handlers: (ComposableEventHandler | undefined | null)[]',
    '): ComposableEventHandler | undefined {',
    '  const active = handlers.filter(',
    '    (handler): handler is ComposableEventHandler =>',
    "      typeof handler === 'function'",
    '  );',
    '  if (active.length === 0) {',
    '    return undefined;',
    '  }',
    '  return (event) => {',
    '    for (const handler of active) {',
    '      handler(event);',
    '    }',
    '  };',
    '}',
  ].join('\n');
}

/**
 * The generated one-shot handler helper: wraps a handler so only its first
 * call runs. Applied inline at each event attribute, so the one-shot state
 * is scoped to the rendered element - matching a per-element listener even
 * inside an `{#each}` block.
 */
export function onceHelperDeclaration(): string {
  return [
    'function once<EventType extends Event>(',
    '  handler: (event: EventType) => void',
    '): (event: EventType) => void {',
    '  let fired = false;',
    '  return (event) => {',
    '    if (fired) {',
    '      return;',
    '    }',
    '    fired = true;',
    '    handler(event);',
    '  };',
    '}',
  ].join('\n');
}
