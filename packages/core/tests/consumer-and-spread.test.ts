// The generated consumerAndSpread helper folds a passthrough root's spread
// records into the consumer's attributes as Vue's mergeProps does. Each
// target's spelling is transpiled and run.

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  CONSUMER_AND_SPREAD,
  consumerAndSpreadDeclaration,
  type ConsumerAndSpreadSpelling,
} from '../src/emitter';

type Merge = (
  consumer: Record<string, unknown>,
  ...records: unknown[]
) => Record<string, unknown>;

function helper(spelling: ConsumerAndSpreadSpelling): Merge {
  const source = `${consumerAndSpreadDeclaration(spelling)}\nreturn ${CONSUMER_AND_SPREAD};`;
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  });
  return new Function(outputText)() as Merge;
}

const react = helper({
  classKey: 'className',
  style: 'object',
  handlerPattern: '/^on[A-Z]/',
});
const svelte = helper({
  classKey: 'class',
  style: 'text',
  handlerPattern: '/^on/',
});

describe('consumerAndSpread', () => {
  it("joins the classes, the consumer's first", () => {
    expect(
      react({ className: 'given' }, { className: 'machine' }).className
    ).toBe('given machine');
    expect(svelte({ class: undefined }, { class: 'machine' }).class).toBe(
      'machine'
    );
  });

  it("merges the styles, the record's declarations winning", () => {
    expect(
      react(
        { style: { color: 'red', margin: 0 } },
        { style: { color: 'blue' } }
      ).style
    ).toEqual({ color: 'blue', margin: 0 });
    expect(
      svelte({ style: 'color: red' }, { style: 'color: blue' }).style
    ).toBe('color: red; color: blue');
    expect(svelte({ style: undefined }, { style: 'color: blue' }).style).toBe(
      'color: blue'
    );
  });

  it("runs both of a handler both carry, the consumer's first", () => {
    const calls: string[] = [];
    const merged = react(
      { onClick: (event: string) => calls.push(`consumer ${event}`) },
      { onClick: (event: string) => calls.push(`record ${event}`) }
    );
    (merged.onClick as (event: string) => void)('press');
    expect(calls).toEqual(['consumer press', 'record press']);
    const runes = svelte(
      { onclick: () => calls.push('consumer') },
      { onclick: () => calls.push('record') }
    );
    (runes.onclick as () => void)();
    expect(calls.slice(2)).toEqual(['consumer', 'record']);
  });

  it("keeps the consumer's class, style and handler where the record's is unset", () => {
    const onClick = () => {};
    const merged = react(
      { className: 'given', style: { color: 'red' }, onClick },
      { className: undefined, style: null, onClick: undefined }
    );
    expect(merged).toEqual({
      className: 'given',
      style: { color: 'red' },
      onClick,
    });
  });

  it('lets the record win every other key, folding several in order', () => {
    expect(
      react(
        { id: 'consumer', role: 'button', 'data-state': undefined },
        { id: 'machine', 'data-state': 'open' },
        { role: 'switch' },
        null
      )
    ).toEqual({ id: 'machine', role: 'switch', 'data-state': 'open' });
  });
});
