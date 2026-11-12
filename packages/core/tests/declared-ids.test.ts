import { describe, expect, it } from 'vitest';

import {
  declaredIdsOf,
  idComment,
  idExpression,
  RestIdCounter,
} from '../src/declared-ids';

describe('declared ids', () => {
  it('lists the ids in declaration order, in their object form', () => {
    expect(
      declaredIdsOf({
        ids: { listId: 'list', inputId: { prefix: 'input', prop: 'id' } },
      })
    ).toEqual([
      { name: 'listId', prefix: 'list' },
      { name: 'inputId', prefix: 'input', prop: 'id' },
    ]);
    expect(declaredIdsOf({})).toEqual([]);
  });

  it('builds each id from the generated id, after the prop when it has one', () => {
    expect(idExpression({ name: 'listId', prefix: 'list' })).toBe(
      '`list-${generatedId}`'
    );
    expect(
      idExpression({ name: 'inputId', prefix: 'input', prop: 'id' }, 'id')
    ).toBe('id ?? `input-${generatedId}`');
  });

  it('counts each prefix on its own at rest', () => {
    const counter = new RestIdCounter();
    expect([
      counter.next('list'),
      counter.next('input'),
      counter.next('list'),
    ]).toEqual(['list-1', 'input-1', 'list-2']);
  });

  it('comments what the markup reads', () => {
    expect(idComment({ name: 'listId', prefix: 'list' }, 'list-1')).toBe(
      "listId = 'list-1' (an id per instance)"
    );
    expect(
      idComment({ name: 'inputId', prefix: 'input', prop: 'id' }, 'input-1')
    ).toBe("inputId = id ?? 'input-1' (an id per instance)");
  });
});
