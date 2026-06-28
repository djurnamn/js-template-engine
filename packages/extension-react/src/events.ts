import {
  isKeyEventModifier,
  keyGuardStatement,
} from '@js-template-engine/core';
import type { EventDefinition, Warning } from '@js-template-engine/types';

/**
 * DOM event names whose React prop capitalizes more than the first letter,
 * or is spelled differently altogether (`dblclick` → `onDoubleClick`).
 * Names not listed here map to `on` + the capitalized event name.
 */
const REACT_EVENT_PROPERTIES: Record<string, string> = {
  animationend: 'onAnimationEnd',
  animationiteration: 'onAnimationIteration',
  animationstart: 'onAnimationStart',
  auxclick: 'onAuxClick',
  beforeinput: 'onBeforeInput',
  canplay: 'onCanPlay',
  canplaythrough: 'onCanPlayThrough',
  compositionend: 'onCompositionEnd',
  compositionstart: 'onCompositionStart',
  compositionupdate: 'onCompositionUpdate',
  contextmenu: 'onContextMenu',
  dblclick: 'onDoubleClick',
  dragend: 'onDragEnd',
  dragenter: 'onDragEnter',
  dragleave: 'onDragLeave',
  dragover: 'onDragOver',
  dragstart: 'onDragStart',
  durationchange: 'onDurationChange',
  gotpointercapture: 'onGotPointerCapture',
  keydown: 'onKeyDown',
  keypress: 'onKeyPress',
  keyup: 'onKeyUp',
  loadeddata: 'onLoadedData',
  loadedmetadata: 'onLoadedMetadata',
  loadstart: 'onLoadStart',
  lostpointercapture: 'onLostPointerCapture',
  mousedown: 'onMouseDown',
  mouseenter: 'onMouseEnter',
  mouseleave: 'onMouseLeave',
  mousemove: 'onMouseMove',
  mouseout: 'onMouseOut',
  mouseover: 'onMouseOver',
  mouseup: 'onMouseUp',
  pointercancel: 'onPointerCancel',
  pointerdown: 'onPointerDown',
  pointerenter: 'onPointerEnter',
  pointerleave: 'onPointerLeave',
  pointermove: 'onPointerMove',
  pointerout: 'onPointerOut',
  pointerover: 'onPointerOver',
  pointerup: 'onPointerUp',
  ratechange: 'onRateChange',
  timeupdate: 'onTimeUpdate',
  touchcancel: 'onTouchCancel',
  touchend: 'onTouchEnd',
  touchmove: 'onTouchMove',
  touchstart: 'onTouchStart',
  transitionend: 'onTransitionEnd',
  volumechange: 'onVolumeChange',
};

/** Matches an identifier or a dot-separated member path: `handlers.save`. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

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
 * order. The `once` and `passive` modifiers cannot be expressed through
 * React's declarative listeners and produce a warning.
 */
export function eventProp(
  event: EventDefinition,
  nodePath: string,
  warnings: Warning[]
): EventProp {
  warnUnsupportedModifiers(event, nodePath, warnings);

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
 */
export function eventProps(
  events: EventDefinition[],
  path: string,
  warnings: Warning[]
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
      props.push(eventProp(events[index], `${path}.events[${index}]`, warnings));
      continue;
    }
    const bodies = indices.map((index) => {
      const event = events[index];
      warnUnsupportedModifiers(event, `${path}.events[${index}]`, warnings);
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
  const property = REACT_EVENT_PROPERTIES[event.name] ?? defaultProperty(event.name);
  return event.modifiers?.includes('capture') ? `${property}Capture` : property;
}

function defaultProperty(eventName: string): string {
  return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
}

/** The guard statements plus the handler invocation, in declared order. */
function eventStatements(event: EventDefinition): string[] {
  const call = IDENTIFIER_PATH.test(event.handler)
    ? `${event.handler}(event);`
    : `(${event.handler})(event);`;
  return [...guardStatements(event), call];
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
 * Guard statements for the `self`, `prevent`, and `stop` modifiers and the
 * key-guard modifiers, in declared order.
 */
function guardStatements(event: EventDefinition): string[] {
  const guards: string[] = [];
  for (const modifier of event.modifiers ?? []) {
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
