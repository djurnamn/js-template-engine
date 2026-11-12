import { isKeyEventModifier } from '@js-template-engine/core';
import {
  boundHandler,
  camelizePropName,
  handlerCallStatement,
  INVOKE_HANDLER,
} from '@js-template-engine/core/emitter';
import type { EventDefinition } from '@js-template-engine/types';

import { directiveValue } from './literals';

/**
 * Vue event modifiers. Every modifier in the template format's set -
 * including the key-guard modifiers, which Vue accepts as kebab-cased
 * `KeyboardEvent.key` names (`@keyup.enter`, `@keyup.arrow-up`) - maps to
 * a native Vue modifier. A binding that composes with the consumer's
 * handler moves its statement modifiers into generated code instead (see
 * {@link STATEMENT_MODIFIERS}).
 */
const NATIVE_MODIFIERS = [
  'stop',
  'prevent',
  'self',
  'capture',
  'once',
  'passive',
  'enter',
  'escape',
  'tab',
  'space',
  'backspace',
  'delete',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
] as const;

/**
 * The modifiers that run as statements inside the handler. On a binding that
 * composes with the consumer's handler they render as generated code after
 * the `defaultPrevented` check, in declared order, rather than natively: a
 * native `.prevent` would prevent the default before the check reads it, so
 * the template's handler would never run.
 */
const STATEMENT_MODIFIERS: Readonly<Record<string, string>> = {
  prevent: 'event.preventDefault();',
  stop: 'event.stopPropagation();',
  self: 'if (event.target !== event.currentTarget) return;',
};

/** The name of the generated helper a composing binding calls. */
export const UNLESS_DEFAULT_PREVENTED = 'unlessDefaultPrevented';

/**
 * The name of the per-instance record of which composing one-shot listeners
 * have run the template's handler, keyed by the element they are on.
 */
export const USED_ONCE_LISTENERS = 'usedOnceListeners';

/** The name of the generated helper a composing one-shot listener calls. */
export const CLAIM_ONCE_LISTENER = 'claimOnceListener';

/**
 * The generated helper a composing binding calls with every argument the
 * listener receives: runs the template's handler with them unless the
 * consumer's, which runs before it, called `preventDefault()` on the first.
 * A first argument without `defaultPrevented` (a component's payload)
 * always runs it, and an absent handler does nothing. Generic over the
 * arguments, inferred from those the listener receives only (the handler's
 * parameter type defers inference), so an inline handler is typed by the
 * element's event and a handler taking fewer arguments is accepted.
 */
export function unlessDefaultPreventedDeclaration(): string {
  return [
    `function ${UNLESS_DEFAULT_PREVENTED}<Arguments extends unknown[]>(`,
    '  handler:',
    '    | ((...args: [Arguments][Arguments extends unknown ? 0 : never]) => void)',
    '    | undefined',
    '    | null,',
    '  ...args: Arguments',
    '): void {',
    '  if (!(args[0] as { defaultPrevented?: unknown } | null)?.defaultPrevented) {',
    '    handler?.(...args);',
    '  }',
    '}',
  ].join('\n');
}

/**
 * The record a composing one-shot listener claims itself in once the
 * template's handler runs, and the helper that claims it, as
 * `<script setup>` declares them. A listener is keyed by its element, the
 * event's `currentTarget`, so each element rendered by a `v-for` has its own
 * one-shot state; an event without an object `currentTarget` (a
 * component's payload) is keyed by the component instance, so on a
 * component tag the state is shared per instance. The helper returns `false` when the listener
 * already ran for that element.
 */
export function usedOnceListenersDeclaration(): string {
  return [
    `const ${USED_ONCE_LISTENERS} = new WeakMap<object, Set<number>>();`,
    '',
    `function ${CLAIM_ONCE_LISTENER}(event: unknown, key: number): boolean {`,
    '  const target = (event as { currentTarget?: unknown } | null)?.currentTarget;',
    '  const element =',
    "    typeof target === 'object' && target !== null",
    '      ? target',
    `      : ${USED_ONCE_LISTENERS};`,
    `  const claimed = ${USED_ONCE_LISTENERS}.get(element) ?? new Set<number>();`,
    '  if (claimed.has(key)) {',
    '    return false;',
    '  }',
    '  claimed.add(key);',
    `  ${USED_ONCE_LISTENERS}.set(element, claimed);`,
    '  return true;',
    '}',
  ].join('\n');
}

/**
 * The events Vue types a listener for on an HTML or SVG element, by name:
 * `@click` binds its `onClick`, typed `MouseEvent`, so the listener's
 * parameters take their type from the binding. Vue types no other event
 * (`@my-event`, `@custom`), and a listener bound to one has no contextual
 * type, so its generated parameters are annotated.
 */
const TYPED_ELEMENT_EVENTS = new Set([
  'copy',
  'cut',
  'paste',
  'compositionend',
  'compositionstart',
  'compositionupdate',
  'drag',
  'dragend',
  'dragenter',
  'dragexit',
  'dragleave',
  'dragover',
  'dragstart',
  'drop',
  'focus',
  'focusin',
  'focusout',
  'blur',
  'change',
  'beforeinput',
  'formdata',
  'input',
  'reset',
  'submit',
  'invalid',
  'fullscreenchange',
  'fullscreenerror',
  'load',
  'error',
  'keydown',
  'keypress',
  'keyup',
  'dblclick',
  'mousedown',
  'mouseenter',
  'mouseleave',
  'mousemove',
  'mouseout',
  'mouseover',
  'mouseup',
  'abort',
  'canplay',
  'canplaythrough',
  'durationchange',
  'emptied',
  'encrypted',
  'ended',
  'loadeddata',
  'loadedmetadata',
  'loadstart',
  'pause',
  'play',
  'playing',
  'progress',
  'ratechange',
  'seeked',
  'seeking',
  'stalled',
  'suspend',
  'timeupdate',
  'volumechange',
  'waiting',
  'select',
  'scroll',
  'scrollend',
  'touchcancel',
  'touchend',
  'touchmove',
  'touchstart',
  'auxclick',
  'click',
  'contextmenu',
  'gotpointercapture',
  'lostpointercapture',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'pointerenter',
  'pointerleave',
  'pointerover',
  'pointerout',
  'beforetoggle',
  'toggle',
  'wheel',
  'animationcancel',
  'animationstart',
  'animationend',
  'animationiteration',
  'securitypolicyviolation',
  'transitioncancel',
  'transitionend',
  'transitionrun',
  'transitionstart',
]);

/**
 * Whether Vue types a listener for an event on an HTML or SVG element, so a
 * generated listener bound to it takes its parameters' type from Vue.
 *
 * @example
 * isTypedElementEvent({ name: 'click', handler: 'save' }); // true
 * isTypedElementEvent({ name: 'my-event', handler: 'save' }); // false
 *
 * @param event - The event.
 * @returns `true` when Vue types the event's listener.
 */
export function isTypedElementEvent(event: EventDefinition): boolean {
  return TYPED_ELEMENT_EVENTS.has(event.name);
}

/** A member path Vue binds as a handler: `handleClick`, `handlers.save`. */
const MEMBER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/** A function literal Vue binds as a handler (the test Vue's compiler applies). */
const FUNCTION_LITERAL =
  /^\s*(async\s*)?(\([^)]*?\)|[\w$_]+)\s*(:[^=]+)?=>|^\s*(async\s+)?function(?:\s+[\w$]+)?\s*\(/;

/**
 * The handler as Vue binds it. Vue treats a member path or a function
 * literal as the handler and anything else as an inline statement, so any
 * other expression yielding a handler (`onChange ? (event) => ... :
 * undefined`) is invoked with the event - optionally, since it may yield
 * none.
 */
function handlerExpression(
  handler: string,
  keyGuarded = false,
  untyped = false
): string {
  const trimmed = handler.trim();
  // Vue's key guard (`withKeys`) reads its handler while rendering, and
  // throws on an unset one wherever Vue's compiler leaves the handler
  // unwrapped (one reading a `v-for` or slot variable, or on a component),
  // so a guarded handler is bound through a function that is always there,
  // a member path bound to its object. A function literal: Vue runs any
  // other expression as a statement.
  const parameters = `(...args${untyped ? ': any[]' : ''})`;
  if (keyGuarded && MEMBER_PATH.test(trimmed)) {
    return `${parameters} => ${INVOKE_HANDLER}(${boundHandler(trimmed)}, ...args)`;
  }
  if (MEMBER_PATH.test(trimmed) || FUNCTION_LITERAL.test(trimmed)) {
    return trimmed;
  }
  // Behind a key guard any other expression goes through the helper too,
  // typed by the listener as a path is.
  if (keyGuarded) {
    return `${parameters} => ${INVOKE_HANDLER}((${trimmed}), ...args)`;
  }
  return `(${trimmed})?.($event)`;
}

/**
 * Renders an event definition as a Vue event binding attribute:
 * `@click="handleClick"`, with modifiers appended to the event name in
 * declared order (`@submit.prevent`, `@click.stop.once`, `@keyup.enter`).
 *
 * A method name (`handleClick`) or a function literal (`() => save()`) is
 * emitted verbatim, letting Vue pass the native event to it; any other
 * expression yielding a handler is called with `$event`. A method name
 * behind a key modifier, which Vue's key guard would read while it is unset,
 * is bound through the generated `invokeHandler`:
 * `@keyup.enter="(...args) => invokeHandler(submit, ...args)"`.
 */
export function eventAttribute(
  event: EventDefinition,
  untyped = false
): string {
  const keyGuarded = (event.modifiers ?? []).some(isKeyEventModifier);
  return `${eventAttributeName(event)}=${directiveValue(handlerExpression(event.handler, keyGuarded, untyped))}`;
}

/**
 * The binding's attribute name: `@` + the event + its native modifiers. A
 * composing binding leaves out its statement modifiers and `once`, which its
 * generated code applies.
 */
function eventAttributeName(event: EventDefinition, composes = false): string {
  const modifiers = (event.modifiers ?? []).filter(
    (modifier) =>
      (NATIVE_MODIFIERS as readonly string[]).includes(modifier) &&
      !(composes && (modifier in STATEMENT_MODIFIERS || modifier === 'once'))
  );
  return `@${event.name}${modifiers.map((modifier) => `.${modifier}`).join('')}`;
}

/**
 * A composing event's handler as the helper receives it: the authored
 * expression, or, with statement modifiers or `once`, a generated arrow
 * applying them in declared order before calling it. A one-shot listener
 * claims `onceKey` for its element through the generated helper and returns
 * early once claimed, so it is used up only when the template's handler
 * runs, not when the consumer prevented the default.
 */
function composedHandler(event: EventDefinition, onceKey?: number): string {
  const statements = [
    ...(onceKey === undefined
      ? []
      : [`if (!${CLAIM_ONCE_LISTENER}(event, ${onceKey})) return;`]),
    ...(event.modifiers ?? [])
      .map((modifier) => STATEMENT_MODIFIERS[modifier])
      .filter((statement): statement is string => statement !== undefined),
  ];
  if (statements.length === 0) {
    return event.handler.trim();
  }
  return `(event) => { ${[...statements, handlerCallStatement(event.handler)].join(' ')} }`;
}

/**
 * The binding of events that compose with the consumer's handler for the
 * same event: the consumer's runs first (it binds ahead of these), and the
 * template's through the generated helper, which receives every argument the
 * listener does and skips the handler when the consumer prevented the
 * default. Several events merge into one handler invoking each in declared
 * order, a guarded one isolated in its own arrow so its `return` cannot skip
 * the rest. Where the element types no listener (`untyped`), the listener's
 * rest parameter is typed `any[]`, as Vue leaves it there; elsewhere it is
 * left to Vue's contextual type, so the element's event types the handler.
 */
function composedEventAttribute(
  name: string,
  group: EventDefinition[],
  onceKey: (event: EventDefinition) => number | undefined,
  untyped: boolean
): string {
  const handler =
    group.length === 1
      ? composedHandler(group[0], onceKey(group[0]))
      : `(event) => { ${group
          .map((event) =>
            handlerCallStatement(composedHandler(event, onceKey(event)))
          )
          .join(' ')} }`;
  return `${name}=${directiveValue(
    `(...args${untyped ? ': any[]' : ''}) => ${UNLESS_DEFAULT_PREVENTED}(${handler}, ...args)`
  )}`;
}

/**
 * A statement invoking one handler with the event, for a merged binding: a
 * name or any expression other than a function literal is called through the
 * generated `invokeHandler`, so an unset optional handler prop does nothing
 * and one declaring fewer parameters type-checks.
 */
function handlerCall(handler: string): string {
  const trimmed = handler.trim();
  if (MEMBER_PATH.test(trimmed)) {
    return `${INVOKE_HANDLER}(${boundHandler(trimmed)}, event);`;
  }
  if (FUNCTION_LITERAL.test(trimmed)) {
    return `(${trimmed})(event);`;
  }
  return `${INVOKE_HANDLER}((${trimmed}), event);`;
}

/**
 * Renders an element's events as Vue binding attributes. Events that resolve
 * to the same attribute - the same event with the same native modifiers - would
 * repeat it, which Vue's compiler rejects, so they merge into one handler
 * invoking each in declared order. Events whose modifiers differ
 * (`@keydown.escape` beside `@keydown.arrow-down`) stay separate attributes.
 *
 * @example
 * eventAttributes([
 *   { name: 'click', handler: 'track' },
 *   { name: 'click', handler: 'submit' },
 * ]);
 * // ['@click="(event) => { track(event); submit(event); }"']
 *
 * @param events - The element's events.
 * @param composes - Whether an event composes with a consumer handler the
 *   element's spread carries for it; such a binding renders through
 *   {@link composedEventAttribute}.
 * @param allocateOnceKey - Allocates a composing one-shot listener's key in
 *   the component's per-instance set, unique within the component.
 * @param untyped - Whether the element types no listener for an event for
 *   Vue to type a generated one by, for every event or by event: a
 *   `<component :is="...">`, which may render any tag or component, or an
 *   event Vue types no listener for on the element (see
 *   {@link isTypedElementEvent}). A generated listener's parameters are
 *   then typed `any`, so it compiles under `strict` without an event type
 *   and accepts whatever handler the template binds.
 * @returns The binding attributes, in first-declared order.
 */
export function eventAttributes(
  events: EventDefinition[],
  composes: (event: EventDefinition) => boolean = () => false,
  allocateOnceKey: () => number = () => 0,
  untyped: boolean | ((event: EventDefinition) => boolean) = false
): string[] {
  const isUntyped = (event: EventDefinition): boolean =>
    typeof untyped === 'function' ? untyped(event) : untyped;
  const groups = new Map<string, EventDefinition[]>();
  const composing = new Set<string>();
  for (const event of events) {
    const eventComposes = composes(event);
    const name = eventAttributeName(event, eventComposes);
    groups.set(name, [...(groups.get(name) ?? []), event]);
    if (eventComposes) {
      composing.add(name);
    }
  }
  return [...groups].map(([name, group]) => {
    // A group shares one event name, so its first event decides.
    const groupUntyped = isUntyped(group[0]);
    if (composing.has(name)) {
      return composedEventAttribute(
        name,
        group,
        (event) =>
          event.modifiers?.includes('once') ? allocateOnceKey() : undefined,
        groupUntyped
      );
    }
    if (group.length === 1) {
      return eventAttribute(group[0], groupUntyped);
    }
    return `${name}=${directiveValue(
      `(event${groupUntyped ? ': any' : ''}) => { ${group.map((event) => handlerCall(event.handler)).join(' ')} }`
    )}`;
  });
}

/**
 * The key a consumer's listener for an event takes in Vue's attributes:
 * `on` + the camelized, capitalized event name (`keydown` → `onKeydown`),
 * with Vue's `Capture` suffix for a capturing listener (`onClickCapture`),
 * the only listener option that keys a separate handler a consumer's
 * `@click.capture` lands in.
 *
 * @param event - The event.
 * @returns The listener key.
 */
export function consumerListenerKey(event: EventDefinition): string {
  const name = camelizePropName(event.name);
  const capture = event.modifiers?.includes('capture') === true;
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}${capture ? 'Capture' : ''}`;
}
