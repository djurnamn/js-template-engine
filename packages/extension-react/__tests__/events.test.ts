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
      '(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); handleSubmit(event); }'
    );
  });

  it('invokes non-identifier handlers through parentheses when wrapped', () => {
    const { prop } = renderEvent({
      name: 'click',
      handler: '() => save()',
      modifiers: ['stop'],
    });
    expect(prop.expression).toBe(
      '(event) => { event.stopPropagation(); (() => save())(event); }'
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

  it('wraps key-guard modifiers in a generated event.key guard in declared order', () => {
    expect(
      renderEvent({
        name: 'keyup',
        handler: 'submitSearch',
        modifiers: ['enter'],
      }).prop
    ).toEqual({
      name: 'onKeyUp',
      expression:
        "(event) => { if (event.key !== 'Enter') return; submitSearch(event); }",
    });
    expect(
      renderEvent({
        name: 'keydown',
        handler: 'highlightNext',
        modifiers: ['prevent', 'arrow-down'],
      }).prop.expression
    ).toBe(
      "(event) => { event.preventDefault(); if (event.key !== 'ArrowDown') return; highlightNext(event); }"
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
      { name: 'onClick', expression: '(event) => { track(event); submit(event); }' },
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
          "(event) => { ((event) => { if (event.key !== 'Escape') return; closeOnEscape(event); })(event); ((event) => { if (event.key !== 'ArrowDown') return; moveHighlight(event); })(event); }",
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
