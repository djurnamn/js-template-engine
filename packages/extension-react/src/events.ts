import {
  isKeyEventModifier,
  keyGuardStatement,
} from '@js-template-engine/core';
import { handlerCallStatement } from '@js-template-engine/core/emitter';
import type { EventDefinition, Warning } from '@js-template-engine/types';

/**
 * React's event props for every intrinsic element, as `@types/react`
 * declares them on `DOMAttributes` (each also has a typed `Capture` variant,
 * except the four enter/leave props, `onToggle` and `onBeforeToggle`). Each listens for the DOM event of its lowercased name
 * without the `on`, except `onDoubleClick` (`dblclick`), and `onFocus` and
 * `onBlur`, which React attaches to the bubbling `focusin` and `focusout`.
 */
const REACT_EVENT_PROPERTY_NAMES = [
  'onAbort',
  'onAnimationEnd',
  'onAnimationIteration',
  'onAnimationStart',
  'onAuxClick',
  'onBeforeInput',
  'onBeforeToggle',
  'onBlur',
  'onCanPlay',
  'onCanPlayThrough',
  'onChange',
  'onClick',
  'onCompositionEnd',
  'onCompositionStart',
  'onCompositionUpdate',
  'onContextMenu',
  'onCopy',
  'onCut',
  'onDoubleClick',
  'onDrag',
  'onDragEnd',
  'onDragEnter',
  'onDragExit',
  'onDragLeave',
  'onDragOver',
  'onDragStart',
  'onDrop',
  'onDurationChange',
  'onEmptied',
  'onEncrypted',
  'onEnded',
  'onError',
  'onFocus',
  'onGotPointerCapture',
  'onInput',
  'onInvalid',
  'onKeyDown',
  'onKeyPress',
  'onKeyUp',
  'onLoad',
  'onLoadStart',
  'onLoadedData',
  'onLoadedMetadata',
  'onLostPointerCapture',
  'onMouseDown',
  'onMouseEnter',
  'onMouseLeave',
  'onMouseMove',
  'onMouseOut',
  'onMouseOver',
  'onMouseUp',
  'onPaste',
  'onPause',
  'onPlay',
  'onPlaying',
  'onPointerCancel',
  'onPointerDown',
  'onPointerEnter',
  'onPointerLeave',
  'onPointerMove',
  'onPointerOut',
  'onPointerOver',
  'onPointerUp',
  'onProgress',
  'onRateChange',
  'onReset',
  'onScroll',
  'onScrollEnd',
  'onSeeked',
  'onSeeking',
  'onSelect',
  'onStalled',
  'onSubmit',
  'onSuspend',
  'onTimeUpdate',
  'onToggle',
  'onTouchCancel',
  'onTouchEnd',
  'onTouchMove',
  'onTouchStart',
  'onTransitionCancel',
  'onTransitionEnd',
  'onTransitionRun',
  'onTransitionStart',
  'onVolumeChange',
  'onWaiting',
  'onWheel',
] as const;

/**
 * The React props whose `Capture` variant React does not register, so a
 * capture binding attaches no listener: the enter/leave props, which React
 * builds from `mouseover`/`mouseout` (`pointerover`/`pointerout`).
 */
const PROPERTIES_WITHOUT_CAPTURE_LISTENER = new Set([
  'onMouseEnter',
  'onMouseLeave',
  'onPointerEnter',
  'onPointerLeave',
]);

/**
 * The React props whose `Capture` variant React attaches at runtime but
 * `@types/react` does not declare, so a capture binding is untyped.
 */
const PROPERTIES_WITH_UNTYPED_CAPTURE = new Set([
  'onBeforeToggle',
  'onCancel',
  'onClose',
  'onToggle',
]);

/**
 * React's element-specific event props, which `@types/react` declares on one
 * element's attributes rather than on `DOMAttributes`: `onCancel` and
 * `onClose` on `<dialog>`, `onResize` (and `onResizeCapture`) on `<video>`.
 * On `<audio>` React attaches `onResize` too, untyped.
 */
const ELEMENT_EVENT_PROPERTIES: ReadonlyMap<
  string,
  {
    property: string;
    typedOn: ReadonlySet<string>;
    untypedOn: ReadonlySet<string>;
  }
> = new Map([
  [
    'cancel',
    {
      property: 'onCancel',
      typedOn: new Set(['dialog']),
      untypedOn: new Set<string>(),
    },
  ],
  [
    'close',
    {
      property: 'onClose',
      typedOn: new Set(['dialog']),
      untypedOn: new Set<string>(),
    },
  ],
  [
    'resize',
    {
      property: 'onResize',
      typedOn: new Set(['video']),
      untypedOn: new Set(['audio']),
    },
  ],
]);

/**
 * The template format's DOM event names mapped to React's event props.
 * `focusin` and `focusout` map to `onFocus` and `onBlur`, which React
 * implements with those bubbling events, so `focus` and `focusin` (and
 * `blur` and `focusout`) resolve to the same prop.
 */
const REACT_EVENT_PROPERTIES: ReadonlyMap<string, string> = new Map([
  ...REACT_EVENT_PROPERTY_NAMES.map((property): [string, string] => [
    property.slice(2).toLowerCase(),
    property,
  ]).filter(([eventName]) => eventName !== 'doubleclick'),
  ['dblclick', 'onDoubleClick'],
  ['focusin', 'onFocus'],
  ['focusout', 'onBlur'],
]);

/** The name of the generated handler-composition helper. */
export const COMPOSE_HELPER_NAME = 'composeEventHandlers';

/**
 * The generated handler-composition helper: composes the consumer's handler
 * for an event with the template's. The consumer's runs first, and the
 * template's runs only when the consumer did not call `preventDefault()` -
 * an event without `defaultPrevented` (a component's payload) always runs
 * it. Either side alone is returned as it is, and `undefined` when neither
 * is supplied, so a passthrough root whose declared handler and consumer
 * spread are both empty attaches no listener, and a server component can
 * render it.
 *
 * The helper is generic over the event, inferred from the consumer's
 * handler type (the element's props), so an inline template handler keeps
 * that type: `(event) => ...` on a `div`'s `onKeyDown` reads a
 * `KeyboardEvent<HTMLDivElement>`. A second overload takes a template
 * handler typed independently of the element - a prop declared once for
 * every target, whose DOM event type is not React's synthetic one - as it
 * is.
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

/** A rendered JSX event prop: `onClick` + the handler expression. */
export interface EventProp {
  name: string;
  expression: string;
}

/**
 * Renders an event definition as a JSX event prop.
 *
 * The `capture` modifier maps to React's `Capture`-suffixed prop variant.
 * The `prevent`, `stop`, and `self` modifiers and the key-guard modifiers
 * wrap the handler in a generated arrow function applying them in declared
 * order, the key guard first. The `once` and `passive` modifiers cannot be expressed through
 * React's declarative listeners and produce a warning, as does an event
 * React has no prop for on an intrinsic element (`intrinsicTag`).
 */
export function eventProp(
  event: EventDefinition,
  nodePath: string,
  warnings: Warning[],
  intrinsicTag?: string
): EventProp {
  warnUnsupportedModifiers(event, nodePath, warnings);
  warnUnknownEvent(event, nodePath, intrinsicTag, warnings);

  const name = propName(event);
  const guards = guardStatements(event);
  if (guards.length === 0) {
    return { name, expression: event.handler };
  }
  return {
    name,
    expression: `(event) => { ${eventStatements(event).join(' ')} }`,
  };
}

/**
 * Renders a node's events as JSX event props, one per distinct prop name.
 *
 * Two events whose names resolve to the same React prop (two `keydown`
 * handlers → `onKeyDown`, but not `keydown` vs a captured `keydown`) cannot
 * both be spelled as props - React would keep only the last. They merge
 * into one handler that invokes each in declared order. A handler with an
 * early-returning guard (`self` or a key modifier) is isolated in its own
 * arrow so its `return` cannot skip the handlers that follow it.
 *
 * On an intrinsic element (`intrinsicTag`, the element's tag name) an event
 * React has no prop for is reported as a warning; a component tag's events
 * are its own props and are not checked.
 */
export function eventProps(
  events: EventDefinition[],
  path: string,
  warnings: Warning[],
  intrinsicTag?: string
): EventProp[] {
  const groups = new Map<string, number[]>();
  events.forEach((event, index) => {
    const name = propName(event);
    const group = groups.get(name);
    if (group === undefined) {
      groups.set(name, [index]);
    } else {
      group.push(index);
    }
  });

  const props: EventProp[] = [];
  for (const [name, indices] of groups) {
    if (indices.length === 1) {
      const index = indices[0];
      props.push(
        eventProp(
          events[index],
          `${path}.events[${index}]`,
          warnings,
          intrinsicTag
        )
      );
      continue;
    }
    const bodies = indices.map((index) => {
      const event = events[index];
      warnUnsupportedModifiers(event, `${path}.events[${index}]`, warnings);
      warnUnknownEvent(
        event,
        `${path}.events[${index}]`,
        intrinsicTag,
        warnings
      );
      const statements = eventStatements(event).join(' ');
      return needsIsolation(event)
        ? `((event) => { ${statements} })(event);`
        : statements;
    });
    props.push({ name, expression: `(event) => { ${bodies.join(' ')} }` });
  }
  return props;
}

/** The React prop name for an event, including the `Capture` suffix. */
function propName(event: EventDefinition): string {
  const property =
    REACT_EVENT_PROPERTIES.get(event.name) ?? defaultProperty(event.name);
  return event.modifiers?.includes('capture') ? `${property}Capture` : property;
}

/**
 * Warns for an event on an intrinsic element that React has no prop for:
 * an event name outside React's event props (or an element-specific one on
 * another element), whose `on` + name prop React neither types nor attaches,
 * or a `capture` binding of an enter/leave event, which React does not
 * register. An event React attaches but `@types/react` does not declare
 * there - a capture binding of `toggle`, `beforetoggle`, `cancel` or
 * `close`, or `resize` on `<audio>` - warns that the prop is untyped. A
 * component tag takes any prop, so its events are not checked.
 */
function warnUnknownEvent(
  event: EventDefinition,
  nodePath: string,
  intrinsicTag: string | undefined,
  warnings: Warning[]
): void {
  if (intrinsicTag === undefined) {
    return;
  }
  const rendered = propName(event);
  const elementEvent = ELEMENT_EVENT_PROPERTIES.get(event.name);
  let property = REACT_EVENT_PROPERTIES.get(event.name);
  if (elementEvent !== undefined) {
    if (elementEvent.untypedOn.has(intrinsicTag)) {
      warnings.push({
        message: `React's types have no '${rendered}' prop on <${intrinsicTag}>: React attaches the '${event.name}' listener, but the prop is untyped`,
        nodePath,
      });
      return;
    }
    if (elementEvent.typedOn.has(intrinsicTag)) {
      property = elementEvent.property;
    }
  }
  if (property === undefined) {
    warnings.push({
      message: `React has no event prop for the '${event.name}' event on <${intrinsicTag}>: the rendered '${rendered}' attaches no listener. Rename the event to one React has a prop for, in a React 'events' override on the node if the other targets keep this name`,
      nodePath,
    });
    return;
  }
  if (event.modifiers?.includes('capture') !== true) {
    return;
  }
  if (PROPERTIES_WITHOUT_CAPTURE_LISTENER.has(property)) {
    warnings.push({
      message: `React has no capture-phase prop for the '${event.name}' event on <${intrinsicTag}>: the rendered '${rendered}' attaches no listener`,
      nodePath,
    });
  } else if (PROPERTIES_WITH_UNTYPED_CAPTURE.has(property)) {
    warnings.push({
      message: `React's types have no '${rendered}' prop on <${intrinsicTag}>: React attaches the capture-phase '${event.name}' listener, but the prop is untyped`,
      nodePath,
    });
  }
}

function defaultProperty(eventName: string): string {
  return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
}

/** The guard statements plus the handler invocation, in declared order. */
function eventStatements(event: EventDefinition): string[] {
  return [...guardStatements(event), handlerCallStatement(event.handler)];
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

/** Warns for the `once` and `passive` modifiers React cannot express. */
function warnUnsupportedModifiers(
  event: EventDefinition,
  nodePath: string,
  warnings: Warning[]
): void {
  for (const modifier of event.modifiers ?? []) {
    if (modifier === 'once' || modifier === 'passive') {
      warnings.push({
        message: `The '${modifier}' modifier is not supported in React output`,
        nodePath,
      });
    }
  }
}

/**
 * Guard statements for the key-guard modifiers and the `self`, `prevent`,
 * and `stop` modifiers. The key guard comes first, so `prevent` and `stop`
 * apply only to the guarded key, as Vue's native key modifiers do; the
 * others follow in declared order.
 */
function guardStatements(event: EventDefinition): string[] {
  const modifiers = event.modifiers ?? [];
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
