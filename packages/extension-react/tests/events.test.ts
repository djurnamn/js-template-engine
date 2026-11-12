import type { Warning } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { eventProp, eventProps } from '../src/events';

function renderEvent(event: Parameters<typeof eventProp>[0]) {
  const warnings: Warning[] = [];
  const prop = eventProp(event, '[0].events[0]', warnings);
  return { prop, warnings };
}

describe('eventProp', () => {
  it('maps generic DOM event names to React event props', () => {
    expect(renderEvent({ name: 'click', handler: 'handleClick' }).prop).toEqual(
      { name: 'onClick', expression: 'handleClick' }
    );
    expect(renderEvent({ name: 'dblclick', handler: 'open' }).prop.name).toBe(
      'onDoubleClick'
    );
    expect(renderEvent({ name: 'keydown', handler: 'onKey' }).prop.name).toBe(
      'onKeyDown'
    );
    expect(renderEvent({ name: 'customchange', handler: 'sync' }).prop.name).toBe(
      'onCustomchange'
    );
  });

  it('maps focusin and focusout to the bubbling onFocus and onBlur', () => {
    expect(renderEvent({ name: 'focusin', handler: 'track' }).prop.name).toBe(
      'onFocus'
    );
    expect(renderEvent({ name: 'focusout', handler: 'track' }).prop.name).toBe(
      'onBlur'
    );
  });

  it('maps every multi-word DOM event name to its React prop', () => {
    const expected: Record<string, string> = {
      animationend: 'onAnimationEnd',
      auxclick: 'onAuxClick',
      beforetoggle: 'onBeforeToggle',
      contextmenu: 'onContextMenu',
      gotpointercapture: 'onGotPointerCapture',
      lostpointercapture: 'onLostPointerCapture',
      mouseleave: 'onMouseLeave',
      pointerenter: 'onPointerEnter',
      scrollend: 'onScrollEnd',
      transitioncancel: 'onTransitionCancel',
      transitionrun: 'onTransitionRun',
      transitionstart: 'onTransitionStart',
    };
    for (const [name, property] of Object.entries(expected)) {
      expect(renderEvent({ name, handler: 'track' }).prop.name).toBe(property);
    }
  });

  it('warns for an event React has no prop for on an intrinsic element', () => {
    const warnings: Warning[] = [];
    const prop = eventProp(
      { name: 'doubleclick', handler: 'open' },
      '[0].events[0]',
      warnings,
      'div'
    );
    expect(prop.name).toBe('onDoubleclick');
    expect(warnings).toEqual([
      {
        message:
          "React has no event prop for the 'doubleclick' event on <div>: the rendered 'onDoubleclick' attaches no listener. Rename the event to one React has a prop for, in a React 'events' override on the node if the other targets keep this name",
        nodePath: '[0].events[0]',
      },
    ]);
  });

  it('warns for a capture binding of an enter or leave event', () => {
    const warnings: Warning[] = [];
    eventProp(
      { name: 'mouseenter', handler: 'track', modifiers: ['capture'] },
      '[0].events[0]',
      warnings,
      'div'
    );
    expect(warnings.map((warning) => warning.message)).toEqual([
      "React has no capture-phase prop for the 'mouseenter' event on <div>: the rendered 'onMouseEnterCapture' attaches no listener",
    ]);
  });

  it('accepts the element-specific events only on their own element', () => {
    const messages = (name: string, tag: string, capture = false) => {
      const warnings: Warning[] = [];
      eventProp(
        {
          name,
          handler: 'track',
          ...(capture ? { modifiers: ['capture' as const] } : {}),
        },
        '[0].events[0]',
        warnings,
        tag
      );
      return warnings.map((warning) => warning.message);
    };
    expect(messages('close', 'dialog')).toEqual([]);
    expect(messages('cancel', 'dialog')).toEqual([]);
    expect(messages('resize', 'video')).toEqual([]);
    expect(messages('resize', 'video', true)).toEqual([]);
    expect(messages('close', 'div')).toEqual([
      "React has no event prop for the 'close' event on <div>: the rendered 'onClose' attaches no listener. Rename the event to one React has a prop for, in a React 'events' override on the node if the other targets keep this name",
    ]);
    expect(messages('resize', 'audio')).toEqual([
      "React's types have no 'onResize' prop on <audio>: React attaches the 'resize' listener, but the prop is untyped",
    ]);
  });

  it('warns that a capture binding React attaches but does not type is untyped', () => {
    for (const [name, tag, property] of [
      ['toggle', 'details', 'onToggleCapture'],
      ['beforetoggle', 'div', 'onBeforeToggleCapture'],
      ['close', 'dialog', 'onCloseCapture'],
      ['cancel', 'dialog', 'onCancelCapture'],
    ]) {
      const warnings: Warning[] = [];
      eventProp(
        { name, handler: 'track', modifiers: ['capture'] },
        '[0].events[0]',
        warnings,
        tag
      );
      expect(warnings.map((warning) => warning.message)).toEqual([
        `React's types have no '${property}' prop on <${tag}>: React attaches the capture-phase '${name}' listener, but the prop is untyped`,
      ]);
    }
  });

  it('does not check the events of a component tag', () => {
    expect(
      renderEvent({ name: 'select-item', handler: 'choose' }).warnings
    ).toEqual([]);
  });

  it('passes inline function handlers through verbatim', () => {
    expect(renderEvent({ name: 'click', handler: '() => save()' }).prop).toEqual(
      { name: 'onClick', expression: '() => save()' }
    );
  });

  it('wraps prevent, stop, and self in a generated handler in declared order', () => {
    const { prop } = renderEvent({
      name: 'submit',
      handler: 'handleSubmit',
      modifiers: ['self', 'prevent'],
    });
    expect(prop.expression).toBe(
      '(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); invokeHandler(handleSubmit, event); }'
    );
  });

  it('invokes non-identifier handlers through parentheses when wrapped', () => {
    const { prop } = renderEvent({
      name: 'click',
      handler: '(event) => save(event.detail)',
      modifiers: ['stop'],
    });
    expect(prop.expression).toBe(
      '(event) => { event.stopPropagation(); ((event) => save(event.detail))(event); }'
    );
  });

  it('calls a parameterless inline handler without the event', () => {
    const { prop } = renderEvent({
      name: 'click',
      handler: '() => save()',
      modifiers: ['stop'],
    });
    expect(prop.expression).toBe(
      '(event) => { event.stopPropagation(); (() => save())(); }'
    );
  });

  it('maps the capture modifier to the Capture prop variant', () => {
    const { prop, warnings } = renderEvent({
      name: 'click',
      handler: 'track',
      modifiers: ['capture'],
    });
    expect(prop.name).toBe('onClickCapture');
    expect(prop.expression).toBe('track');
    expect(warnings).toEqual([]);
  });

  it('wraps key-guard modifiers in a generated event.key guard, the key guard first', () => {
    expect(
      renderEvent({
        name: 'keyup',
        handler: 'submitSearch',
        modifiers: ['enter'],
      }).prop
    ).toEqual({
      name: 'onKeyUp',
      expression:
        "(event) => { if (event.key !== 'Enter') return; invokeHandler(submitSearch, event); }",
    });
    expect(
      renderEvent({
        name: 'keydown',
        handler: 'highlightNext',
        modifiers: ['prevent', 'arrow-down'],
      }).prop.expression
    ).toBe(
      "(event) => { if (event.key !== 'ArrowDown') return; event.preventDefault(); invokeHandler(highlightNext, event); }"
    );
    expect(
      renderEvent({
        name: 'keydown',
        handler: 'confirm',
        modifiers: ['stop', 'self', 'enter', 'prevent'],
      }).prop.expression
    ).toBe(
      "(event) => { if (event.key !== 'Enter') return; event.stopPropagation(); if (event.target !== event.currentTarget) return; event.preventDefault(); invokeHandler(confirm, event); }"
    );
  });

  it('warns for the once and passive modifiers', () => {
    const { warnings } = renderEvent({
      name: 'click',
      handler: 'track',
      modifiers: ['once', 'passive'],
    });
    expect(warnings.map((warning) => warning.message)).toEqual([
      "The 'once' modifier is not supported in React output",
      "The 'passive' modifier is not supported in React output",
    ]);
  });
});

describe('eventProps', () => {
  function render(events: Parameters<typeof eventProps>[0]) {
    const warnings: Warning[] = [];
    const props = eventProps(events, '[0]', warnings);
    return { props, warnings };
  }

  it('renders distinct event names as separate props, unmerged', () => {
    const { props } = render([
      { name: 'click', handler: 'a' },
      { name: 'mouseenter', handler: 'b' },
    ]);
    expect(props).toEqual([
      { name: 'onClick', expression: 'a' },
      { name: 'onMouseEnter', expression: 'b' },
    ]);
  });

  it('merges plain same-name handlers inline in declared order', () => {
    const { props } = render([
      { name: 'click', handler: 'track' },
      { name: 'click', handler: 'submit' },
    ]);
    expect(props).toEqual([
      { name: 'onClick', expression: '(event) => { invokeHandler(track, event); invokeHandler(submit, event); }' },
    ]);
  });

  it('isolates early-returning guards when merging same-name handlers', () => {
    const { props } = render([
      { name: 'keydown', handler: 'closeOnEscape', modifiers: ['escape'] },
      { name: 'keydown', handler: 'moveHighlight', modifiers: ['arrow-down'] },
    ]);
    expect(props).toEqual([
      {
        name: 'onKeyDown',
        expression:
          "(event) => { ((event) => { if (event.key !== 'Escape') return; invokeHandler(closeOnEscape, event); })(event); ((event) => { if (event.key !== 'ArrowDown') return; invokeHandler(moveHighlight, event); })(event); }",
      },
    ]);
  });

  it('keeps captured and non-captured same-name events on separate props', () => {
    const { props } = render([
      { name: 'click', handler: 'a' },
      { name: 'click', handler: 'b', modifiers: ['capture'] },
    ]);
    expect(props).toEqual([
      { name: 'onClick', expression: 'a' },
      { name: 'onClickCapture', expression: 'b' },
    ]);
  });

  it('merges focus and focusin into one onFocus handler', () => {
    const { props } = render([
      { name: 'focus', handler: 'a' },
      { name: 'focusin', handler: 'b' },
    ]);
    expect(props).toEqual([
      { name: 'onFocus', expression: '(event) => { invokeHandler(a, event); invokeHandler(b, event); }' },
    ]);
  });

  it('warns for each unknown event of a merged prop on an intrinsic element', () => {
    const warnings: Warning[] = [];
    eventProps(
      [
        { name: 'focusout', handler: 'a' },
        { name: 'swipe', handler: 'b' },
        { name: 'swipe', handler: 'c' },
      ],
      '[0]',
      warnings,
      'div'
    );
    expect(warnings.map((warning) => warning.nodePath)).toEqual([
      '[0].events[1]',
      '[0].events[2]',
    ]);
  });

  it('warns once per merged event for unsupported modifiers', () => {
    const { warnings } = render([
      { name: 'click', handler: 'a', modifiers: ['once'] },
      { name: 'click', handler: 'b', modifiers: ['passive'] },
    ]);
    expect(warnings.map((warning) => warning.nodePath)).toEqual([
      '[0].events[0]',
      '[0].events[1]',
    ]);
  });
});
