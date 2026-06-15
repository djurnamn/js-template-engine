import { describe, expect, it } from 'vitest';

import { eventAttribute } from '../src/events';

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

  it('maps key-guard modifiers to native kebab-cased key modifiers', () => {
    expect(
      eventAttribute({
        name: 'keyup',
        handler: 'submitSearch',
        modifiers: ['enter'],
      })
    ).toBe('@keyup.enter="submitSearch"');
    expect(
      eventAttribute({
        name: 'keydown',
        handler: 'highlightNext',
        modifiers: ['prevent', 'arrow-down'],
      })
    ).toBe('@keydown.prevent.arrow-down="highlightNext"');
  });
});
