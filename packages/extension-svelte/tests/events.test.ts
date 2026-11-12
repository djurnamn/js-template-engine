import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  composeEventHandlersDeclaration,
  eventAttribute,
  onceHelperDeclaration,
  runesEventAttribute,
  runesEventAttributes,
} from '../src/events';

describe('eventAttribute', () => {
  it('renders a generic DOM event as a Svelte event binding', () => {
    expect(eventAttribute({ name: 'click', handler: 'handleClick' })).toBe(
      'on:click={handleClick}'
    );
  });

  it('keeps the generic DOM event name (no React-style remapping)', () => {
    expect(eventAttribute({ name: 'dblclick', handler: 'open' })).toBe(
      'on:dblclick={open}'
    );
  });

  it('appends native modifiers in declared order', () => {
    expect(
      eventAttribute({
        name: 'submit',
        handler: 'handleSubmit',
        modifiers: ['prevent'],
      })
    ).toBe('on:submit|preventDefault={handleSubmit}');
    expect(
      eventAttribute({
        name: 'click',
        handler: 'trackClick',
        modifiers: ['stop', 'once'],
      })
    ).toBe('on:click|stopPropagation|once={trackClick}');
  });

  it('passes inline handler expressions through verbatim', () => {
    expect(eventAttribute({ name: 'click', handler: '() => save()' })).toBe(
      'on:click={() => save()}'
    );
  });

  it('wraps key-guard modifiers in a generated event.key guard', () => {
    expect(
      eventAttribute({
        name: 'keyup',
        handler: 'submitSearch',
        modifiers: ['enter'],
      })
    ).toBe(
      "on:keyup={(event) => { if (event.key !== 'Enter') return; invokeHandler(submitSearch, event); }}"
    );
  });

  it('moves handler-statement modifiers into the key-guard wrapper after the key guard', () => {
    expect(
      eventAttribute({
        name: 'keydown',
        handler: 'highlightNext',
        modifiers: ['prevent', 'arrow-down'],
      })
    ).toBe(
      "on:keydown={(event) => { if (event.key !== 'ArrowDown') return; event.preventDefault(); invokeHandler(highlightNext, event); }}"
    );
    expect(
      eventAttribute({
        name: 'keydown',
        handler: 'confirm',
        modifiers: ['stop', 'self', 'enter', 'prevent'],
      })
    ).toBe(
      "on:keydown={(event) => { if (event.key !== 'Enter') return; event.stopPropagation(); if (event.target !== event.currentTarget) return; event.preventDefault(); invokeHandler(confirm, event); }}"
    );
  });

  it('keeps listener-option modifiers as native pipes alongside a key-guard wrapper', () => {
    expect(
      eventAttribute({
        name: 'keydown',
        handler: 'closeOnce',
        modifiers: ['escape', 'once'],
      })
    ).toBe(
      "on:keydown|once={(event) => { if (event.key !== 'Escape') return; invokeHandler(closeOnce, event); }}"
    );
  });

  it('parenthesizes inline handlers inside a key-guard wrapper', () => {
    expect(
      eventAttribute({
        name: 'keyup',
        handler: '(event) => save(event.key)',
        modifiers: ['space'],
      })
    ).toBe(
      "on:keyup={(event) => { if (event.key !== ' ') return; ((event) => save(event.key))(event); }}"
    );
  });

  it('calls a parameterless inline handler without the event', () => {
    expect(
      eventAttribute({
        name: 'keyup',
        handler: '() => save()',
        modifiers: ['space'],
      })
    ).toBe(
      "on:keyup={(event) => { if (event.key !== ' ') return; (() => save())(); }}"
    );
  });
});

describe('typed wrapper parameters', () => {
  it('annotates a legacy key-guard wrapper with the DOM event type', () => {
    expect(
      eventAttribute(
        { name: 'keydown', handler: 'onConfirm', modifiers: ['enter'] },
        { typedEventParameter: true }
      )
    ).toBe(
      "on:keydown={(event: HTMLElementEventMap['keydown']) => { if (event.key !== 'Enter') return; invokeHandler(onConfirm, event); }}"
    );
    expect(
      eventAttribute({ name: 'click', handler: 'onPress', modifiers: ['prevent'] }, {
        typedEventParameter: true,
      })
    ).toBe('on:click|preventDefault={onPress}');
  });

  it('annotates an event-attribute wrapper, composed or merged', () => {
    expect(
      runesEventAttribute(
        { name: 'click', handler: 'onPress', modifiers: ['prevent'] },
        '$$restProps',
        new Set(),
        { typedEventParameter: true }
      ).part
    ).toBe(
      "onclick={composeEventHandlers($$restProps.onclick, (event: HTMLElementEventMap['click']) => { event.preventDefault(); invokeHandler(onPress, event); })}"
    );
    expect(
      runesEventAttributes(
        [
          { name: 'keydown', handler: 'onConfirm', modifiers: ['enter'] },
          { name: 'keydown', handler: 'onDismiss', modifiers: ['escape'] },
        ],
        undefined,
        new Set(),
        { typedEventParameter: true }
      ).map((emission) => emission.part)
    ).toEqual([
      "onkeydown={(event: HTMLElementEventMap['keydown']) => { ((event) => { if (event.key !== 'Enter') return; invokeHandler(onConfirm, event); })(event); ((event) => { if (event.key !== 'Escape') return; invokeHandler(onDismiss, event); })(event); }}",
    ]);
  });
});

describe('runesEventAttribute', () => {
  it('renders a generic DOM event as an event attribute', () => {
    expect(runesEventAttribute({ name: 'click', handler: 'handleClick' })).toEqual({
      part: 'onclick={handleClick}',
      usesOnceHelper: false,
      usesPassiveAttachment: false,
      usesComposeHelper: false,
    });
  });

  it('keeps the generic DOM event name (no React-style remapping)', () => {
    expect(runesEventAttribute({ name: 'dblclick', handler: 'open' }).part).toBe(
      'ondblclick={open}'
    );
  });

  it('moves prevent and stop into a generated wrapper in declared order', () => {
    expect(
      runesEventAttribute({
        name: 'submit',
        handler: 'handleSubmit',
        modifiers: ['prevent'],
      }).part
    ).toBe(
      'onsubmit={(event) => { event.preventDefault(); invokeHandler(handleSubmit, event); }}'
    );
    expect(
      runesEventAttribute({
        name: 'click',
        handler: 'trackClick',
        modifiers: ['stop', 'prevent'],
      }).part
    ).toBe(
      'onclick={(event) => { event.stopPropagation(); event.preventDefault(); invokeHandler(trackClick, event); }}'
    );
  });

  it('renders self as a target guard in the wrapper', () => {
    expect(
      runesEventAttribute({
        name: 'click',
        handler: 'close',
        modifiers: ['self'],
      }).part
    ).toBe(
      'onclick={(event) => { if (event.target !== event.currentTarget) return; invokeHandler(close, event); }}'
    );
  });

  it('renders capture as the capture attribute form', () => {
    expect(
      runesEventAttribute({
        name: 'click',
        handler: 'handleClick',
        modifiers: ['capture'],
      }).part
    ).toBe('onclickcapture={handleClick}');
  });

  it('applies the once helper inline at the attribute', () => {
    expect(
      runesEventAttribute({
        name: 'click',
        handler: 'trackClick',
        modifiers: ['once'],
      })
    ).toEqual({
      part: 'onclick={once(trackClick)}',
      usesOnceHelper: true,
      usesPassiveAttachment: false,
      usesComposeHelper: false,
    });
  });

  it('wraps guard statements inside the once helper', () => {
    expect(
      runesEventAttribute({
        name: 'click',
        handler: 'trackClick',
        modifiers: ['stop', 'once'],
      }).part
    ).toBe(
      'onclick={once((event) => { event.stopPropagation(); invokeHandler(trackClick, event); })}'
    );
  });

  it('drops passive on touchstart and touchmove (passive by default)', () => {
    expect(
      runesEventAttribute({
        name: 'touchstart',
        handler: 'handleTouch',
        modifiers: ['passive'],
      })
    ).toEqual({
      part: 'ontouchstart={handleTouch}',
      usesOnceHelper: false,
      usesPassiveAttachment: false,
      usesComposeHelper: false,
    });
  });

  it('renders passive on other events as an attachment through svelte/events', () => {
    expect(
      runesEventAttribute({
        name: 'wheel',
        handler: 'handleWheel',
        modifiers: ['passive'],
      })
    ).toEqual({
      part: "{@attach (listenerElement) => on(listenerElement, 'wheel', handleWheel, { passive: true })}",
      usesOnceHelper: false,
      usesPassiveAttachment: true,
      usesComposeHelper: false,
    });
  });

  it('folds capture into the attachment options alongside passive', () => {
    expect(
      runesEventAttribute({
        name: 'wheel',
        handler: 'handleWheel',
        modifiers: ['passive', 'capture'],
      }).part
    ).toBe(
      "{@attach (listenerElement) => on(listenerElement, 'wheel', handleWheel, { passive: true, capture: true })}"
    );
  });

  it('wraps key-guard modifiers in a generated event.key guard', () => {
    expect(
      runesEventAttribute({
        name: 'keyup',
        handler: 'submitSearch',
        modifiers: ['enter'],
      }).part
    ).toBe(
      "onkeyup={(event) => { if (event.key !== 'Enter') return; invokeHandler(submitSearch, event); }}"
    );
  });

  it('applies handler-statement modifiers after the key guard', () => {
    expect(
      runesEventAttribute({
        name: 'keydown',
        handler: 'highlightNext',
        modifiers: ['prevent', 'arrow-down'],
      }).part
    ).toBe(
      "onkeydown={(event) => { if (event.key !== 'ArrowDown') return; event.preventDefault(); invokeHandler(highlightNext, event); }}"
    );
  });

  it('parenthesizes inline handlers inside a generated wrapper', () => {
    expect(
      runesEventAttribute({
        name: 'keyup',
        handler: '(event) => save(event.key)',
        modifiers: ['space'],
      }).part
    ).toBe(
      "onkeyup={(event) => { if (event.key !== ' ') return; ((event) => save(event.key))(event); }}"
    );
  });

  it('calls a parameterless inline handler without the event', () => {
    expect(
      runesEventAttribute({
        name: 'keyup',
        handler: '() => save()',
        modifiers: ['space'],
      }).part
    ).toBe(
      "onkeyup={(event) => { if (event.key !== ' ') return; (() => save())(); }}"
    );
  });
});

describe('runesEventAttributes', () => {
  it('renders distinct events one attribute each, in declared order', () => {
    const parts = runesEventAttributes([
      { name: 'click', handler: 'track' },
      { name: 'wheel', handler: 'spin', modifiers: ['passive'] },
      { name: 'keyup', handler: 'submitSearch' },
    ]).map((emission) => emission.part);
    expect(parts).toEqual([
      'onclick={track}',
      "{@attach (listenerElement) => on(listenerElement, 'wheel', spin, { passive: true })}",
      'onkeyup={submitSearch}',
    ]);
  });

  it('merges same-name events into one handler invoking each in declared order', () => {
    const parts = runesEventAttributes([
      { name: 'click', handler: 'track' },
      { name: 'click', handler: 'submit' },
    ]).map((emission) => emission.part);
    expect(parts).toEqual([
      'onclick={(event) => { invokeHandler(track, event); invokeHandler(submit, event); }}',
    ]);
  });

  it('isolates early-returning key guards inside a merged handler', () => {
    const parts = runesEventAttributes([
      { name: 'keydown', handler: 'closeOnEscape', modifiers: ['escape'] },
      { name: 'keydown', handler: 'moveHighlight', modifiers: ['arrow-down'] },
    ]).map((emission) => emission.part);
    expect(parts).toEqual([
      "onkeydown={(event) => { ((event) => { if (event.key !== 'Escape') return; invokeHandler(closeOnEscape, event); })(event); ((event) => { if (event.key !== 'ArrowDown') return; invokeHandler(moveHighlight, event); })(event); }}",
    ]);
  });

  it('does not merge a captured event with its bubbling namesake', () => {
    const parts = runesEventAttributes([
      { name: 'click', handler: 'track', modifiers: ['capture'] },
      { name: 'click', handler: 'submit' },
    ]).map((emission) => emission.part);
    expect(parts).toEqual(['onclickcapture={track}', 'onclick={submit}']);
  });

  it('splits a once handler out of a merged attribute as a one-shot attachment', () => {
    const emissions = runesEventAttributes([
      { name: 'click', handler: 'track' },
      { name: 'click', handler: 'celebrate', modifiers: ['once'] },
    ]);
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclick={(event) => { invokeHandler(track, event); }}',
      "{@attach (listenerElement) => on(listenerElement, 'click', celebrate, { once: true })}",
    ]);
    expect(emissions[1].usesPassiveAttachment).toBe(true);
    expect(emissions[1].usesOnceHelper).toBe(false);
  });

  it('rides once natively on a passive attachment instead of the helper', () => {
    const emissions = runesEventAttributes([
      { name: 'wheel', handler: 'spin', modifiers: ['passive', 'once'] },
    ]);
    expect(emissions.map((emission) => emission.part)).toEqual([
      "{@attach (listenerElement) => on(listenerElement, 'wheel', spin, { passive: true, once: true })}",
    ]);
    expect(emissions[0].usesOnceHelper).toBe(false);
  });
});

describe('onceHelperDeclaration', () => {
  it('declares the generated one-shot handler helper', () => {
    const declaration = onceHelperDeclaration();
    expect(declaration).toContain('function once<EventType extends Event>(');
    expect(declaration).toContain('let fired = false;');
  });
});

// The passthrough composition. On a surface root the event
// attributes share one attribute object with `{...restProperties}`, so a
// bare `onclick={onClick}` overwrites whatever handler the consumer's spread
// carried - erasing it outright when the declared prop is unset. The rest
// identifier is passed only for such a node; every other node emits bare.
describe('runes event composition on a passthrough surface root', () => {
  it('composes a plain binding with the spread handler for the same attribute', () => {
    const emissions = runesEventAttributes(
      [{ name: 'click', handler: 'onClick' }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclick={composeEventHandlers(restProperties.onclick, onClick)}',
    ]);
    expect(emissions[0].usesComposeHelper).toBe(true);
  });

  it('emits bare when no rest identifier is supplied', () => {
    const emissions = runesEventAttributes([
      { name: 'click', handler: 'onClick' },
    ]);
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclick={onClick}',
    ]);
    expect(emissions[0].usesComposeHelper).toBe(false);
  });

  it('composes with a `rest` spread the same way', () => {
    const emissions = runesEventAttributes(
      [{ name: 'click', handler: 'toggle' }],
      'rest'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclick={composeEventHandlers(rest.onclick, toggle)}',
    ]);
  });

  it('emits bare for an attribute a declared prop takes, which is never in the rest', () => {
    const emissions = runesEventAttributes(
      [
        { name: 'click', handler: 'toggle' },
        { name: 'keydown', handler: 'onkeydown' },
      ],
      'rest',
      new Set(['onkeydown'])
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclick={composeEventHandlers(rest.onclick, toggle)}',
      'onkeydown={onkeydown}',
    ]);
    expect(emissions[1].usesComposeHelper).toBe(false);
  });

  it('composes the capture attribute against its own spread key', () => {
    const emissions = runesEventAttributes(
      [{ name: 'click', handler: 'track', modifiers: ['capture'] }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclickcapture={composeEventHandlers(restProperties.onclickcapture, track)}',
    ]);
  });

  it('composes a modifier wrapper as a whole', () => {
    const emissions = runesEventAttributes(
      [{ name: 'submit', handler: 'onSubmit', modifiers: ['prevent'] }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onsubmit={composeEventHandlers(restProperties.onsubmit, (event) => { event.preventDefault(); invokeHandler(onSubmit, event); })}',
    ]);
  });

  it('composes the once helper application, not the bare handler', () => {
    const emissions = runesEventAttributes(
      [{ name: 'click', handler: 'celebrate', modifiers: ['once'] }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclick={composeEventHandlers(restProperties.onclick, once(celebrate))}',
    ]);
    expect(emissions[0].usesOnceHelper).toBe(true);
    expect(emissions[0].usesComposeHelper).toBe(true);
  });

  it('composes a merged same-name attribute once, around the merged handler', () => {
    const emissions = runesEventAttributes(
      [
        { name: 'click', handler: 'track' },
        { name: 'click', handler: 'submit' },
      ],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclick={composeEventHandlers(restProperties.onclick, (event) => { invokeHandler(track, event); invokeHandler(submit, event); })}',
    ]);
    expect(emissions[0].usesComposeHelper).toBe(true);
  });

  it('composes a passive binding beside the spread in attribute form, which the consumer can cancel', () => {
    const emissions = runesEventAttributes(
      [{ name: 'wheel', handler: 'spin', modifiers: ['passive'] }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onwheel={composeEventHandlers(restProperties.onwheel, spin)}',
    ]);
    expect(emissions[0].usesPassiveAttachment).toBe(false);
    expect(emissions[0].usesComposeHelper).toBe(true);
  });

  it('merges a composing passive binding with a same-name one', () => {
    expect(
      runesEventAttributes(
        [
          { name: 'wheel', handler: 'spin' },
          { name: 'wheel', handler: 'track', modifiers: ['passive'] },
        ],
        'restProperties'
      ).map((emission) => emission.part)
    ).toEqual([
      'onwheel={composeEventHandlers(restProperties.onwheel, (event) => { invokeHandler(spin, event); invokeHandler(track, event); })}',
    ]);
  });

  it('keeps an attachment-form binding where the spread cannot carry its handler', () => {
    expect(
      runesEventAttributes(
        [{ name: 'wheel', handler: 'spin', modifiers: ['passive'] }],
        'restProperties',
        new Set(['onwheel'])
      ).map((emission) => emission.part)
    ).toEqual([
      "{@attach (listenerElement) => on(listenerElement, 'wheel', spin, { passive: true })}",
    ]);
  });

  it('checks a merged once binding\'s key before its one-shot state', () => {
    expect(
      runesEventAttributes(
        [
          { name: 'keydown', handler: 'track' },
          { name: 'keydown', handler: 'confirm', modifiers: ['enter', 'once'] },
        ],
        'restProperties'
      ).map((emission) => emission.part)
    ).toEqual([
      "onkeydown={composeEventHandlers(restProperties.onkeydown, ((onceRan) => (event) => { invokeHandler(track, event); ((event) => { if (event.key !== 'Enter') return; if (onceRan[0]) return; onceRan[0] = true; invokeHandler(confirm, event); })(event); })([false]))}",
    ]);
  });

  it('hands a single once binding\'s key to the helper', () => {
    expect(
      runesEventAttribute({
        name: 'keyup',
        handler: 'confirm',
        modifiers: ['enter', 'prevent', 'once'],
      }).part
    ).toBe(
      "onkeyup={once((event) => { event.preventDefault(); invokeHandler(confirm, event); }, 'Enter')}"
    );
  });

  it('hoists a merged once binding beside the spread into the composed attribute', () => {
    const emissions = runesEventAttributes(
      [
        { name: 'keydown', handler: 'track' },
        { name: 'keydown', handler: 'confirm', modifiers: ['once'] },
      ],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onkeydown={composeEventHandlers(restProperties.onkeydown, ((onceRan) => (event) => { invokeHandler(track, event); ((event) => { if (onceRan[0]) return; onceRan[0] = true; invokeHandler(confirm, event); })(event); })([false]))}',
    ]);
    expect(emissions[0].usesOnceHelper).toBe(false);
  });

  it('indexes a spread key that is not a valid identifier', () => {
    const emissions = runesEventAttributes(
      [{ name: 'my-event', handler: 'onMyEvent' }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onmy-event={composeEventHandlers(restProperties["onmy-event"], onMyEvent)}',
    ]);
  });

  it('composes a single binding through runesEventAttribute directly', () => {
    expect(
      runesEventAttribute({ name: 'input', handler: 'onInput' }, 'restProperties')
        .part
    ).toBe('oninput={composeEventHandlers(restProperties.oninput, onInput)}');
  });
});

// The generated helper's runtime behavior, evaluated as emitted (with the
// TypeScript annotations stripped the way svelte's compiler does). These are
// the three consumer cases the passthrough contract has to satisfy - and the
// only ones a rendered-markup assertion cannot tell apart, which is why the
// clobber survived a whole-tree cross-target parity suite.
describe('composeEventHandlersDeclaration', () => {
  type Handler = ((event: unknown) => void) | undefined | null;
  const compose = (): ((
    consumerHandler: Handler,
    templateHandler: Handler
  ) => ((event: unknown) => void) | undefined) => {
    const javaScript = ts.transpileModule(composeEventHandlersDeclaration(), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return new Function(`${javaScript}; return composeEventHandlers;`)();
  };

  it('runs only the consumer handler when the template has none', () => {
    const calls: string[] = [];
    const handler = compose()(() => calls.push('consumer'), undefined);
    handler?.({});
    expect(calls).toEqual(['consumer']);
  });

  it('runs only the template handler when the consumer has none', () => {
    const calls: string[] = [];
    const handler = compose()(undefined, () => calls.push('template'));
    handler?.({});
    expect(calls).toEqual(['template']);
  });

  it("runs both when both are supplied, the consumer's first", () => {
    const calls: string[] = [];
    const handler = compose()(
      () => calls.push('consumer'),
      () => calls.push('template')
    );
    handler?.({});
    expect(calls).toEqual(['consumer', 'template']);
  });

  it("skips the template handler when the consumer's prevented the default", () => {
    const calls: string[] = [];
    const handler = compose()(
      (event) => {
        (event as { defaultPrevented: boolean }).defaultPrevented = true;
        calls.push('consumer');
      },
      () => calls.push('template')
    );
    handler?.({ defaultPrevented: false });
    expect(calls).toEqual(['consumer']);
  });

  it('runs the template handler for an event without defaultPrevented', () => {
    const calls: string[] = [];
    const handler = compose()(
      () => calls.push('consumer'),
      () => calls.push('template')
    );
    handler?.(42);
    handler?.(null);
    expect(calls).toEqual(['consumer', 'template', 'consumer', 'template']);
  });

  it('attaches no listener when neither side supplies a handler', () => {
    expect(compose()(undefined, null)).toBeUndefined();
  });

  it('passes the event through to every handler', () => {
    const received: unknown[] = [];
    const event = { type: 'click' };
    compose()(
      (value) => received.push(value),
      (value) => received.push(value)
    )?.(event);
    expect(received).toEqual([event, event]);
  });
});
