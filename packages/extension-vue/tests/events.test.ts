import { describe, expect, it } from 'vitest';

import {
  eventAttribute,
  eventAttributes,
  isTypedElementEvent,
} from '../src/events';

describe('eventAttribute', () => {
  it('renders a generic DOM event as a Vue event binding', () => {
    expect(eventAttribute({ name: 'click', handler: 'handleClick' })).toBe(
      '@click="handleClick"'
    );
  });

  it('keeps the generic DOM event name (no React-style remapping)', () => {
    expect(eventAttribute({ name: 'dblclick', handler: 'open' })).toBe(
      '@dblclick="open"'
    );
  });

  it('appends native modifiers in declared order', () => {
    expect(
      eventAttribute({
        name: 'submit',
        handler: 'handleSubmit',
        modifiers: ['prevent'],
      })
    ).toBe('@submit.prevent="handleSubmit"');
    expect(
      eventAttribute({
        name: 'click',
        handler: 'trackClick',
        modifiers: ['stop', 'once'],
      })
    ).toBe('@click.stop.once="trackClick"');
  });

  it('passes inline handler expressions through verbatim', () => {
    expect(eventAttribute({ name: 'click', handler: '() => save()' })).toBe(
      '@click="() => save()"'
    );
  });

  it('calls any other handler-valued expression with the event, since Vue would run it as a statement', () => {
    expect(
      eventAttribute({ name: 'input', handler: 'onChange ? (event) => onChange(event) : undefined' })
    ).toBe('@input="(onChange ? (event) => onChange(event) : undefined)?.($event)"');
    expect(eventAttribute({ name: 'click', handler: 'handlers.save' })).toBe(
      '@click="handlers.save"'
    );
    expect(eventAttribute({ name: 'click', handler: 'async function (event) { await save(event); }' })).toBe(
      '@click="async function (event) { await save(event); }"'
    );
  });

  // Vue's key guard reads its handler while rendering, so a method name
  // behind one binds through the generated helper: an unset handler does
  // nothing.
  it('maps key-guard modifiers to native kebab-cased key modifiers', () => {
    expect(
      eventAttribute({
        name: 'keyup',
        handler: 'submitSearch',
        modifiers: ['enter'],
      })
    ).toBe('@keyup.enter="(...args) => invokeHandler(submitSearch, ...args)"');
    expect(
      eventAttribute({
        name: 'keydown',
        handler: 'highlightNext',
        modifiers: ['prevent', 'arrow-down'],
      })
    ).toBe(
      '@keydown.prevent.arrow-down="(...args) => invokeHandler(highlightNext, ...args)"'
    );
  });
});

describe('eventAttribute behind a key guard', () => {
  it('binds a member path to its object and any other expression through the helper', () => {
    expect(
      eventAttribute({
        name: 'keydown',
        handler: 'handlers.save',
        modifiers: ['enter'],
      })
    ).toBe(
      '@keydown.enter="(...args) => invokeHandler(handlers.save?.bind(handlers), ...args)"'
    );
    expect(
      eventAttribute({
        name: 'keydown',
        handler: 'editing ? save : undefined',
        modifiers: ['enter'],
      })
    ).toBe(
      '@keydown.enter="(...args) => invokeHandler((editing ? save : undefined), ...args)"'
    );
  });
});

describe('eventAttributes', () => {
  it('merges events sharing a binding into one declared-order handler', () => {
    expect(
      eventAttributes([
        { name: 'click', handler: 'track' },
        { name: 'click', handler: '() => save()' },
        { name: 'click', handler: 'onExtra ? onExtra : undefined' },
      ])
    ).toEqual([
      '@click="(event) => { invokeHandler(track, event); (() => save())(event); invokeHandler((onExtra ? onExtra : undefined), event); }"',
    ]);
  });

  it('keeps events whose modifiers differ as separate bindings', () => {
    expect(
      eventAttributes([
        { name: 'keydown', handler: 'close', modifiers: ['escape'] },
        { name: 'keydown', handler: 'move', modifiers: ['arrow-down'] },
      ])
    ).toEqual([
      '@keydown.escape="(...args) => invokeHandler(close, ...args)"',
      '@keydown.arrow-down="(...args) => invokeHandler(move, ...args)"',
    ]);
  });

  it('leaves a composing listener to the element\'s contextual type', () => {
    expect(
      eventAttributes([{ name: 'toggle', handler: 'onToggled' }], () => true)
    ).toEqual([
      '@toggle="(...args) => unlessDefaultPrevented(onToggled, ...args)"',
    ]);
  });

  it('types a generated listener\'s parameters where the element types none', () => {
    expect(
      eventAttributes(
        [{ name: 'toggle', handler: 'onToggled' }],
        () => true,
        () => 0,
        true
      )
    ).toEqual([
      '@toggle="(...args: any[]) => unlessDefaultPrevented(onToggled, ...args)"',
    ]);
    expect(
      eventAttributes(
        [
          { name: 'click', handler: 'track' },
          { name: 'click', handler: 'save' },
        ],
        () => false,
        () => 0,
        true
      )
    ).toEqual(['@click="(event: any) => { invokeHandler(track, event); invokeHandler(save, event); }"']);
    expect(
      eventAttributes([{ name: 'click', handler: 'save' }], () => false, () => 0, true)
    ).toEqual(['@click="save"']);
  });

  it("types a generated listener's parameters for an event the element types none for", () => {
    const untyped = (event: { name: string; handler: string }) =>
      !isTypedElementEvent(event);
    expect(
      eventAttributes(
        [
          { name: 'my-event', handler: 'announce' },
          { name: 'click', handler: 'onPress' },
        ],
        () => true,
        () => 0,
        untyped
      )
    ).toEqual([
      '@my-event="(...args: any[]) => unlessDefaultPrevented(announce, ...args)"',
      '@click="(...args) => unlessDefaultPrevented(onPress, ...args)"',
    ]);
  });
});

describe('isTypedElementEvent', () => {
  it('names the events Vue types a listener for on an element', () => {
    expect(isTypedElementEvent({ name: 'click', handler: 'save' })).toBe(true);
    expect(isTypedElementEvent({ name: 'keydown', handler: 'save' })).toBe(true);
    expect(isTypedElementEvent({ name: 'my-event', handler: 'save' })).toBe(false);
    expect(isTypedElementEvent({ name: 'custom', handler: 'save' })).toBe(false);
  });
});
