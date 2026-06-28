import type { PropDefinition } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { flattenDiscriminatedProps } from '../src/passthrough';

describe('flattenDiscriminatedProps', () => {
  it('passes shared props through unchanged, before branch props', () => {
    const shared: Record<string, PropDefinition> = {
      size: { type: 'number' },
      value: { type: 'string | number' },
    };
    const merged = flattenDiscriminatedProps(shared, [
      { visual: { type: 'true', required: true } },
      { visual: { type: 'false' } },
    ]);
    expect(Object.keys(merged)).toEqual(['size', 'value', 'visual']);
    expect(merged.size).toEqual({ type: 'number' });
    expect(merged.value).toEqual({ type: 'string | number' });
  });

  it('unions branch types and collapses the discriminant to `true | false`', () => {
    const merged = flattenDiscriminatedProps({}, [
      { visual: { type: 'true', required: true } },
      { visual: { type: 'false' } },
    ]);
    expect(merged.visual.type).toBe('true | false');
  });

  it('is required only when present and required in every branch', () => {
    // required in both branches → required
    const both = flattenDiscriminatedProps({}, [
      { kind: { type: "'a'", required: true } },
      { kind: { type: "'b'", required: true } },
    ]);
    expect(both.kind.required).toBe(true);

    // required in one branch only → optional
    const one = flattenDiscriminatedProps({}, [
      { kind: { type: "'a'", required: true } },
      { kind: { type: "'b'" } },
    ]);
    expect(one.kind.required).toBe(false);

    // present in one branch only → optional (appears < branch count)
    const partial = flattenDiscriminatedProps({}, [
      { extra: { type: 'string', required: true } },
      {},
    ]);
    expect(partial.extra.required).toBe(false);
  });

  it('deduplicates identical branch types', () => {
    const merged = flattenDiscriminatedProps({}, [
      { id: { type: 'string' } },
      { id: { type: 'string' } },
    ]);
    expect(merged.id.type).toBe('string');
  });

  it('returns the shared props verbatim when there are no branch props', () => {
    const shared: Record<string, PropDefinition> = {
      label: { type: 'string', required: true },
    };
    expect(flattenDiscriminatedProps(shared, [{}, {}])).toEqual(shared);
  });
});
