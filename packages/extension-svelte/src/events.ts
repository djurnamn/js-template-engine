import {
  isKeyEventModifier,
  KEY_EVENT_MODIFIER_KEYS,
  keyGuardStatement,
} from '@js-template-engine/core';
import { handlerCallStatement } from '@js-template-engine/core/emitter';
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

/**
 * The handler statements a modifier list contributes to a generated wrapper:
 * the key guard first, so `preventDefault`/`stopPropagation` apply only to
 * the guarded key (as Vue's native key modifiers do), then the `self` target
 * guard and the `preventDefault`/`stopPropagation` calls in declared order.
 */
function handlerStatementGuards(modifiers: EventModifier[]): string[] {
  const guards: string[] = [];
  for (const modifier of modifiers) {
    if (isKeyEventModifier(modifier)) {
      guards.push(keyGuardStatement(modifier));
    }
  }
  for (const modifier of modifiers) {
    if (modifier === 'self') {
      guards.push('if (event.target !== event.currentTarget) return;');
    } else if (modifier === 'prevent') {
      guards.push('event.preventDefault();');
    } else if (modifier === 'stop') {
      guards.push('event.stopPropagation();');
    }
  }
  return guards;
}

/** How a node's events render. */
export interface EventRenderingOptions {
  /**
   * Whether a generated wrapper annotates its `event` parameter with the
   * DOM event type (`HTMLElementEventMap['keydown']`). A legacy dynamic tag
   * needs it, since nothing gives the parameter a contextual type: a
   * `<svelte:element>` whose tag is a union of tag names types no event,
   * and a component-valued root's component arm composes with
   * `$$restProps`, which is untyped.
   */
  typedEventParameter?: boolean;
}

/**
 * The parameter list of a generated wrapper: `event`, annotated with the
 * DOM event type when the options ask for it.
 */
function wrapperParameter(
  event: EventDefinition,
  options: EventRenderingOptions
): string {
  return options.typedEventParameter === true
    ? `(event: HTMLElementEventMap['${event.name}'])`
    : '(event)';
}

/**
 * The handler expression with the guard statements applied: the handler
 * verbatim when there are none, otherwise a generated arrow wrapper running
 * the guards before the handler call. An inline handler expression is
 * parenthesized so it stays a single call target.
 */
function wrappedHandler(
  event: EventDefinition,
  guards: string[],
  options: EventRenderingOptions = {}
): string {
  const handler = expression(event.handler);
  if (guards.length === 0) {
    return handler;
  }
  return `${wrapperParameter(event, options)} => { ${[...guards, handlerCallStatement(handler)].join(' ')} }`;
}

/**
 * Renders an event definition as a Svelte event binding attribute:
 * `on:click={handleClick}`, with modifiers appended to the event name in
 * declared order (`on:submit|preventDefault`, `on:click|stopPropagation|once`).
 *
 * Svelte's native modifier set has no key filters, so a key-guard modifier
 * wraps the handler in a generated arrow function; the `self`, `prevent`,
 * and `stop` modifiers move into the wrapper with it, applied in declared
 * order after the key guard, while `once`, `capture`, and `passive` - listener options rather
 * than handler statements - stay native pipe modifiers.
 *
 * Without a key-guard modifier the handler is emitted verbatim - a method
 * name (`handleClick`) or an inline expression (`() => save()`).
 */
export function eventAttribute(
  event: EventDefinition,
  options: EventRenderingOptions = {}
): string {
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
    handlerStatementGuards(modifiers),
    options
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
 * consumer's undeclared props - a passthrough surface root, or a node that
 * spreads `rest`: the declared handler **composed with** whatever handler the
 * spread carries for the same attribute, rather than overwriting it. The
 * consumer's handler runs first, and the declared one only when the consumer
 * did not prevent the default.
 *
 * Both land in one attribute object (`{...restProperties, onclick: ... }`),
 * so the later key wins outright - an unset optional handler prop would
 * erase a consumer's handler, and a set one would replace it. Legacy mode
 * has no such collision, since its `on:` directives attach as their own
 * listeners beside the spread; this gives runes attributes the same
 * composing behavior. `restIdentifier` is `undefined` on every other node,
 * where the value renders bare, as it does for an attribute named in
 * `declaredNames`: a declared prop of that name is destructured out of the
 * rest, so the rest never carries it.
 */
function composedAttributeValue(
  value: string,
  attributeName: string,
  restIdentifier: string | undefined,
  declaredNames: Pick<ReadonlySet<string>, 'has'>
): { value: string; usesComposeHelper: boolean } {
  if (restIdentifier === undefined || declaredNames.has(attributeName)) {
    return { value, usesComposeHelper: false };
  }
  return {
    value: `${COMPOSE_HELPER_NAME}(${restHandlerAccess(
      restIdentifier,
      attributeName
    )}, ${value})`,
    usesComposeHelper: true,
  };
}

/** An event's runes attribute name: `onclick`, or `onclickcapture`. */
function eventAttributeName(event: EventDefinition): string {
  return (event.modifiers ?? []).includes('capture')
    ? `on${event.name}capture`
    : `on${event.name}`;
}

/**
 * Whether an event attribute stands beside a spread that may carry the
 * consumer's handler for it - the test {@link composedAttributeValue}
 * applies.
 */
function composesWithSpread(
  attributeName: string,
  restIdentifier: string | undefined,
  declaredNames: Pick<ReadonlySet<string>, 'has'>
): boolean {
  return restIdentifier !== undefined && !declaredNames.has(attributeName);
}

/**
 * Whether a `passive` event renders as an `{@attach}` listener: not on
 * `touchstart`/`touchmove`, passive by default, and not where it composes
 * with the consumer's handler. Svelte runs a delegated attribute handler on
 * the element itself after an attached listener, so an attachment could
 * neither follow the consumer's handler nor be canceled by it; such a
 * binding renders in attribute form and composes instead. Its listener is
 * then not passive: the consumer's handler, which runs first in it, may
 * prevent the default.
 */
function attachesPassive(
  event: EventDefinition,
  restIdentifier: string | undefined,
  declaredNames: Pick<ReadonlySet<string>, 'has'>
): boolean {
  return (
    (event.modifiers ?? []).includes('passive') &&
    !PASSIVE_BY_DEFAULT_EVENTS.has(event.name) &&
    !composesWithSpread(
      eventAttributeName(event),
      restIdentifier,
      declaredNames
    )
  );
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
 * - Key guards, `self`, `prevent`, and `stop` become statements in a
 *   generated arrow wrapper, the key guard first.
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
  restIdentifier?: string,
  declaredNames: Pick<ReadonlySet<string>, 'has'> = new Set(),
  options: EventRenderingOptions = {}
): RunesEventEmission {
  const modifiers = event.modifiers ?? [];
  const capture = modifiers.includes('capture');
  const once = modifiers.includes('once');
  const passive = attachesPassive(event, restIdentifier, declaredNames);

  const handler = wrappedHandler(
    event,
    handlerStatementGuards(modifiers),
    options
  );

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
  // A one-shot binding checks its key before it is used up, as Vue's native
  // key modifier does: the key goes to the helper, and the wrapper keeps
  // only the other statements.
  const onceKey = modifiers.find(isKeyEventModifier);
  const bound = once
    ? onceKey === undefined
      ? `${ONCE_HELPER_NAME}(${handler})`
      : `${ONCE_HELPER_NAME}(${wrappedHandler(
          event,
          handlerStatementGuards(
            modifiers.filter((modifier) => !isKeyEventModifier(modifier))
          ),
          options
        )}, '${KEY_EVENT_MODIFIER_KEYS[onceKey]}')`
    : handler;
  const composed = composedAttributeValue(
    bound,
    attributeName,
    restIdentifier,
    declaredNames
  );
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
 * On a passthrough surface root, or a node that spreads `rest`, the caller
 * passes the rest identifier (`restProperties`, `rest`), and every
 * attribute-form binding composes with the handler the spread carries for the
 * same attribute instead of overwriting it, except one named in
 * `declaredNames` - see {@link composedAttributeValue}.
 */
export function runesEventAttributes(
  events: EventDefinition[],
  restIdentifier?: string,
  declaredNames: Pick<ReadonlySet<string>, 'has'> = new Set(),
  options: EventRenderingOptions = {}
): RunesEventEmission[] {
  const attributeNameOf = (event: EventDefinition): string | undefined =>
    attachesPassive(event, restIdentifier, declaredNames)
      ? undefined
      : eventAttributeName(event);

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
      emissions.push(
        runesEventAttribute(event, restIdentifier, declaredNames, options)
      );
      continue;
    }
    if (emitted.has(attributeName)) {
      continue;
    }
    emitted.add(attributeName);

    const group = groups.get(attributeName)!;
    if (group.length === 1) {
      emissions.push(
        runesEventAttribute(event, restIdentifier, declaredNames, options)
      );
      continue;
    }

    const bodies: string[] = [];
    const onceAttachments: RunesEventEmission[] = [];
    // Beside a spread that may carry the consumer's handler, a `once` member
    // stays in the composed attribute, its one-shot state an `onceRan` array
    // closed over outside the merged handler so it persists between
    // dispatches: an attached listener would run before the consumer's
    // delegated handler on the element itself, so the consumer could not
    // cancel it.
    const composesMerged = composesWithSpread(
      attributeName,
      restIdentifier,
      declaredNames
    );
    let onceCount = 0;
    for (const member of group) {
      const modifiers = member.modifiers ?? [];
      if (modifiers.includes('once')) {
        const handler = wrappedHandler(
          member,
          handlerStatementGuards(modifiers),
          options
        );
        if (composesMerged) {
          // The key guard runs before the one-shot check, so another key
          // does not use it up, as with Vue's native key modifiers.
          const index = onceCount;
          onceCount += 1;
          const keyGuards = modifiers
            .filter(isKeyEventModifier)
            .map((modifier) => keyGuardStatement(modifier));
          const rest = runesEventStatements({
            ...member,
            modifiers: modifiers.filter(
              (modifier) => !isKeyEventModifier(modifier)
            ),
          });
          bodies.push(
            `((event) => { ${[
              ...keyGuards,
              `if (onceRan[${index}]) return;`,
              `onceRan[${index}] = true;`,
              ...rest,
            ].join(' ')} })(event);`
          );
          continue;
        }
        onceAttachments.push({
          part: attachedListener(member, handler, {
            passive: false,
            capture: modifiers.includes('capture'),
            once: true,
          }),
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
      const merged = `${wrapperParameter(event, options)} => { ${bodies.join(' ')} }`;
      const composed = composedAttributeValue(
        onceCount === 0
          ? merged
          : `((onceRan) => ${merged})([${Array(onceCount).fill('false').join(', ')}])`,
        attributeName,
        restIdentifier,
        declaredNames
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
  return [
    ...handlerStatementGuards(event.modifiers ?? []),
    handlerCallStatement(handler),
  ];
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
  return `{@attach (listenerElement) => on(listenerElement, '${event.name}', ${handler}, { ${entries.join(', ')} })}`;
}

/**
 * The generated handler-composition helper: composes the consumer's handler
 * for an event with the template's. The consumer's runs first, and the
 * template's runs only when the consumer did not call `preventDefault()` -
 * an event without `defaultPrevented` (a component's payload) always runs
 * it. Either side alone is returned as it is, and `undefined` when neither
 * is supplied, so an element whose declared handler prop and consumer
 * spread are both empty attaches no listener at all.
 *
 * The helper is generic over the event, inferred from the consumer's
 * handler type (`SvelteHTMLElements[tag]`), so an inline template handler
 * keeps that type. A second overload takes a template handler typed
 * independently of the element - a prop declared once for every target - as
 * it is.
 */
export function composeEventHandlersDeclaration(): string {
  return [
    `function ${COMPOSE_HELPER_NAME}<EventType>(`,
    '  consumerHandler: ((event: EventType) => void) | undefined | null,',
    '  templateHandler: ((event: EventType) => void) | undefined | null',
    '): ((event: EventType) => void) | undefined;',
    `function ${COMPOSE_HELPER_NAME}<EventType>(`,
    '  consumerHandler: ((event: EventType) => void) | undefined | null,',
    '  templateHandler: ((event: any) => void) | undefined | null',
    '): ((event: EventType) => void) | undefined;',
    `function ${COMPOSE_HELPER_NAME}<EventType>(`,
    '  consumerHandler: ((event: EventType) => void) | undefined | null,',
    '  templateHandler: ((event: EventType) => void) | undefined | null',
    '): ((event: EventType) => void) | undefined {',
    "  if (typeof consumerHandler !== 'function') {",
    '    return templateHandler ?? undefined;',
    '  }',
    "  if (typeof templateHandler !== 'function') {",
    '    return consumerHandler;',
    '  }',
    '  return (event) => {',
    '    consumerHandler(event);',
    '    if (!(event as { defaultPrevented?: unknown } | null)?.defaultPrevented) {',
    '      templateHandler(event);',
    '    }',
    '  };',
    '}',
  ].join('\n');
}

/**
 * The generated one-shot handler helper: wraps a handler so only its first
 * call runs. Applied inline at each event attribute, so the one-shot state
 * is scoped to the rendered element - matching a per-element listener even
 * inside an `{#each}` block. With a `key` it ignores events for other keys
 * without being used up, as Vue's native key modifier runs before `.once`.
 * An absent handler (an unset optional prop) uses it up and does nothing.
 */
export function onceHelperDeclaration(): string {
  return [
    'function once<EventType extends Event>(',
    '  handler: ((event: EventType) => void) | undefined | null,',
    '  key?: string',
    '): (event: EventType) => void {',
    '  let fired = false;',
    '  return (event) => {',
    '    if (key !== undefined && (event as Event & { key?: unknown }).key !== key) {',
    '      return;',
    '    }',
    '    if (fired) {',
    '      return;',
    '    }',
    '    fired = true;',
    '    handler?.(event);',
    '  };',
    '}',
  ].join('\n');
}
