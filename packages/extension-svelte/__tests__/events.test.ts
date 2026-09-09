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
      "on:keyup={(event) => { if (event.key !== 'Enter') return; submitSearch(event); }}"
    );
  });

  it('moves handler-statement modifiers into the key-guard wrapper in declared order', () => {
    expect(
      eventAttribute({
        name: 'keydown',
        handler: 'highlightNext',
        modifiers: ['prevent', 'arrow-down'],
      })
    ).toBe(
      "on:keydown={(event) => { event.preventDefault(); if (event.key !== 'ArrowDown') return; highlightNext(event); }}"
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
      "on:keydown|once={(event) => { if (event.key !== 'Escape') return; closeOnce(event); }}"
    );
  });

  it('parenthesizes inline handlers inside a key-guard wrapper', () => {
    expect(
      eventAttribute({
        name: 'keyup',
        handler: '() => save()',
        modifiers: ['space'],
      })
    ).toBe(
      "on:keyup={(event) => { if (event.key !== ' ') return; (() => save())(event); }}"
    );
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
      'onsubmit={(event) => { event.preventDefault(); handleSubmit(event); }}'
    );
    expect(
      runesEventAttribute({
        name: 'click',
        handler: 'trackClick',
        modifiers: ['stop', 'prevent'],
      }).part
    ).toBe(
      'onclick={(event) => { event.stopPropagation(); event.preventDefault(); trackClick(event); }}'
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
      'onclick={(event) => { if (event.target !== event.currentTarget) return; close(event); }}'
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
      'onclick={once((event) => { event.stopPropagation(); trackClick(event); })}'
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
      part: "{@attach (node) => on(node, 'wheel', handleWheel, { passive: true })}",
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
      "{@attach (node) => on(node, 'wheel', handleWheel, { passive: true, capture: true })}"
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
      "onkeyup={(event) => { if (event.key !== 'Enter') return; submitSearch(event); }}"
    );
  });

  it('applies handler-statement modifiers before a key guard in declared order', () => {
    expect(
      runesEventAttribute({
        name: 'keydown',
        handler: 'highlightNext',
        modifiers: ['prevent', 'arrow-down'],
      }).part
    ).toBe(
      "onkeydown={(event) => { event.preventDefault(); if (event.key !== 'ArrowDown') return; highlightNext(event); }}"
    );
  });

  it('parenthesizes inline handlers inside a generated wrapper', () => {
    expect(
      runesEventAttribute({
        name: 'keyup',
        handler: '() => save()',
        modifiers: ['space'],
      }).part
    ).toBe(
      "onkeyup={(event) => { if (event.key !== ' ') return; (() => save())(event); }}"
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
      "{@attach (node) => on(node, 'wheel', spin, { passive: true })}",
      'onkeyup={submitSearch}',
    ]);
  });

  it('merges same-name events into one handler invoking each in declared order', () => {
    const parts = runesEventAttributes([
      { name: 'click', handler: 'track' },
      { name: 'click', handler: 'submit' },
    ]).map((emission) => emission.part);
    expect(parts).toEqual([
      'onclick={(event) => { track(event); submit(event); }}',
    ]);
  });

  it('isolates early-returning key guards inside a merged handler', () => {
    const parts = runesEventAttributes([
      { name: 'keydown', handler: 'closeOnEscape', modifiers: ['escape'] },
      { name: 'keydown', handler: 'moveHighlight', modifiers: ['arrow-down'] },
    ]).map((emission) => emission.part);
    expect(parts).toEqual([
      "onkeydown={(event) => { ((event) => { if (event.key !== 'Escape') return; closeOnEscape(event); })(event); ((event) => { if (event.key !== 'ArrowDown') return; moveHighlight(event); })(event); }}",
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
      'onclick={(event) => { track(event); }}',
      "{@attach (node) => on(node, 'click', celebrate, { once: true })}",
    ]);
    expect(emissions[1].usesPassiveAttachment).toBe(true);
    expect(emissions[1].usesOnceHelper).toBe(false);
  });

  it('rides once natively on a passive attachment instead of the helper', () => {
    const emissions = runesEventAttributes([
      { name: 'wheel', handler: 'spin', modifiers: ['passive', 'once'] },
    ]);
    expect(emissions.map((emission) => emission.part)).toEqual([
      "{@attach (node) => on(node, 'wheel', spin, { passive: true, once: true })}",
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

// The passthrough composition (GAP-034). On a surface root the event
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
      'onclick={composeEventHandlers(onClick, restProperties.onclick)}',
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

  it('composes the capture attribute against its own spread key', () => {
    const emissions = runesEventAttributes(
      [{ name: 'click', handler: 'track', modifiers: ['capture'] }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclickcapture={composeEventHandlers(track, restProperties.onclickcapture)}',
    ]);
  });

  it('composes a modifier wrapper as a whole', () => {
    const emissions = runesEventAttributes(
      [{ name: 'submit', handler: 'onSubmit', modifiers: ['prevent'] }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onsubmit={composeEventHandlers((event) => { event.preventDefault(); onSubmit(event); }, restProperties.onsubmit)}',
    ]);
  });

  it('composes the once helper application, not the bare handler', () => {
    const emissions = runesEventAttributes(
      [{ name: 'click', handler: 'celebrate', modifiers: ['once'] }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onclick={composeEventHandlers(once(celebrate), restProperties.onclick)}',
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
      'onclick={composeEventHandlers((event) => { track(event); submit(event); }, restProperties.onclick)}',
    ]);
    expect(emissions[0].usesComposeHelper).toBe(true);
  });

  it('leaves an attachment-form binding uncomposed - it attaches beside the spread', () => {
    const emissions = runesEventAttributes(
      [{ name: 'wheel', handler: 'spin', modifiers: ['passive'] }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      "{@attach (node) => on(node, 'wheel', spin, { passive: true })}",
    ]);
    expect(emissions[0].usesComposeHelper).toBe(false);
  });

  it('indexes a spread key that is not a valid identifier', () => {
    const emissions = runesEventAttributes(
      [{ name: 'my-event', handler: 'onMyEvent' }],
      'restProperties'
    );
    expect(emissions.map((emission) => emission.part)).toEqual([
      'onmy-event={composeEventHandlers(onMyEvent, restProperties["onmy-event"])}',
    ]);
  });

  it('composes a single binding through runesEventAttribute directly', () => {
    expect(
      runesEventAttribute({ name: 'input', handler: 'onInput' }, 'restProperties')
        .part
    ).toBe('oninput={composeEventHandlers(onInput, restProperties.oninput)}');
  });
});

// The generated helper's runtime behavior, evaluated as emitted (with the
// TypeScript annotations stripped the way svelte's compiler does). These are
// the three consumer cases the passthrough contract has to satisfy - and the
// only ones a rendered-markup assertion cannot tell apart, which is why the
// clobber survived a whole-tree cross-target parity suite.
describe('composeEventHandlersDeclaration', () => {
  const compose = (): ((
    ...handlers: (((event: unknown) => void) | undefined | null)[]
  ) => ((event: unknown) => void) | undefined) => {
    const javaScript = composeEventHandlersDeclaration()
      .replace('type ComposableEventHandler = (event: any) => void;', '')
      .replace('...handlers: (ComposableEventHandler | undefined | null)[]', '...handlers')
      .replace('): ComposableEventHandler | undefined {', ') {')
      .replace('(handler): handler is ComposableEventHandler =>', '(handler) =>');
    return new Function(`${javaScript}; return composeEventHandlers;`)();
  };

  it('runs only the spread handler when the declared prop is unset', () => {
    const calls: string[] = [];
    const handler = compose()(undefined, () => calls.push('spread'));
    handler?.({});
    expect(calls).toEqual(['spread']);
  });

  it('runs only the declared handler when the spread carries none', () => {
    const calls: string[] = [];
    const handler = compose()(() => calls.push('declared'), undefined);
    handler?.({});
    expect(calls).toEqual(['declared']);
  });

  it('runs both when both are supplied, declared first', () => {
    const calls: string[] = [];
    const handler = compose()(
      () => calls.push('declared'),
      () => calls.push('spread')
    );
    handler?.({});
    expect(calls).toEqual(['declared', 'spread']);
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
