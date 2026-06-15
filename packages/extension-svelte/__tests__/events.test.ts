import { describe, expect, it } from 'vitest';

import { eventAttribute } from '../src/events';

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
