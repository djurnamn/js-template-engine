import { describe, expect, it } from 'vitest';

import {
  admitsFunction,
  holdsOnlyFunctions,
  isCopiedBindableDefinition,
  isEventType,
  isFunctionType,
  isRelayedBindableDefinition,
  relayedBindingsOf,
  relayedComment,
  relayedReportLines,
  firstParameterTypeOf,
  twoWayBindingsOf,
  twoWayCodeProps,
  twoWayComment,
  twoWayCurrentType,
  twoWaySeed,
  twoWaySetterLines,
} from '../src/two-way-bindings';
import { TemplateError } from '../src/TemplateError';

const props = {
  pressed: {
    type: 'boolean',
    bindable: {
      current: 'isPressed',
      setter: 'setPressed',
      defaultProp: 'defaultPressed',
      changeProp: 'onPressedChange',
    },
  },
  defaultPressed: { type: 'boolean', default: false },
  onPressedChange: { type: '(pressed: boolean) => void' },
  label: { type: 'string', bindable: true },
};

describe('two-way bindings', () => {
  it('reads the bindings of bindable objects only', () => {
    expect(twoWayBindingsOf(props).map((binding) => binding.prop)).toEqual(['pressed']);
  });

  it('rejects a binding whose props a target dropped', () => {
    expect(() => twoWayBindingsOf({ pressed: props.pressed })).toThrow(TemplateError);
  });

  it("documents a two-way prop's default without declaring it", () => {
    const code = twoWayCodeProps(
      { value: { type: 'number | null', default: null, bindable: { current: 'rating', setter: 'setRating' } } },
      (value) => JSON.stringify(value)
    );
    expect(code.value).toEqual({
      type: 'number | null',
      documentedDefault: 'null',
      bindable: { current: 'rating', setter: 'setRating' },
    });
  });

  it('seeds from the default prop, else the default, else undefined', () => {
    const [binding] = twoWayBindingsOf(props);
    const local = (name: string) => name;
    const serialize = (value: unknown) => JSON.stringify(value);
    expect(twoWaySeed(binding, props, local, serialize)).toEqual({
      expression: 'defaultPressed',
      definite: true,
    });
    const [own] = twoWayBindingsOf({
      value: { type: 'string', default: 'a', bindable: { current: 'current', setter: 'setValue' } },
    });
    expect(twoWaySeed(own, {}, local, serialize)).toEqual({ expression: '"a"', definite: true });
    const [bare] = twoWayBindingsOf({
      value: { type: 'string | (() => void)[]', bindable: { current: 'current', setter: 'setValue' } },
    });
    const seed = twoWaySeed(bare, {}, local, serialize);
    expect(seed).toEqual({ expression: 'undefined', definite: false });
    expect(twoWayCurrentType(bare, seed)).toBe('(string | (() => void)[]) | undefined');
  });

  it('writes a setter that takes an updater, skips an unchanged value and avoids the names it reads', () => {
    const [binding] = twoWayBindingsOf({
      value: { type: 'string', bindable: { current: 'current', setter: 'setValue' } },
    });
    expect(
      twoWaySetterLines({
        binding,
        currentType: 'string',
        currentRead: 'current',
        keep: (value) => [`value = ${value};`],
        changeCall: 'onChange',
        reads: ['value', 'onChange'],
        declared: ['value', 'onChange'],
      })
    ).toEqual([
      'function setValue(next: string | ((current: string) => string)) {',
      "  const updated = typeof next === 'function' ? (next as (current: string) => string)(current) : next;",
      '  if (Object.is(updated, current)) return;',
      '  value = updated;',
      '  onChange?.(updated);',
      '}',
    ]);
  });

  it("never shadows a declared prop with the setter's locals", () => {
    const [binding] = twoWayBindingsOf({
      visible: { type: 'boolean', bindable: { current: 'isVisible', setter: 'setVisible' } },
    });
    const lines = twoWaySetterLines({
      binding,
      currentType: 'boolean',
      currentRead: 'isVisible',
      keep: (value) => [`visible = ${value};`],
      reads: ['visible'],
      declared: ['value', 'next', 'visible'],
    });
    expect(lines[0]).toBe('function setVisible(nextValue: boolean | ((current: boolean) => boolean)) {');
    expect(lines[1]).toBe(
      "  const updated = typeof nextValue === 'function' ? (nextValue as (current: boolean) => boolean)(isVisible) : nextValue;"
    );
  });

  it('tells a function type and an event type from a type holding one', () => {
    expect(isFunctionType('(value: string) => void')).toBe(true);
    expect(isFunctionType('<T>(value: T) => T')).toBe(true);
    expect(isFunctionType('{ apply: () => void }')).toBe(false);
    expect(isFunctionType('string | ((value: string) => void)')).toBe(false);
    expect(isEventType('(value: string) => void')).toBe(true);
    expect(isEventType('(value: string) => Promise<void>')).toBe(true);
    expect(isEventType('(value: string) => string')).toBe(false);
    expect(isEventType('string')).toBe(false);
  });

  it('names where the value comes from for HTML mode', () => {
    const serialize = (value: unknown) => JSON.stringify(value);
    expect(twoWayComment(twoWayBindingsOf(props)[0], serialize)).toBe(
      'isPressed: pressed, else defaultPressed'
    );
    const [bare] = twoWayBindingsOf({
      open: { type: 'boolean', bindable: { current: 'isOpen', setter: 'setOpen' } },
    });
    expect(twoWayComment(bare, serialize)).toBe("isOpen: open, else the component's own value");
  });

  it('writes the default prop\'s default into a seed read off props', () => {
    const [binding] = twoWayBindingsOf(props);
    expect(
      twoWaySeed(binding, props, (name) => `props.${name}`, (value) => JSON.stringify(value), false)
    ).toEqual({
      expression: 'props.defaultPressed !== undefined ? props.defaultPressed : false',
      definite: true,
    });
  });

  it('tells a type admitting a function', () => {
    expect(admitsFunction('(value: string) => void')).toBe(true);
    expect(admitsFunction('string | ((value: string) => void)')).toBe(true);
    expect(admitsFunction('Function | null')).toBe(true);
    expect(admitsFunction('Array<(value: string) => void>')).toBe(false);
    expect(admitsFunction('{ run: () => void } | null')).toBe(false);
    expect(admitsFunction("'a' | 'b'")).toBe(false);
  });

  it('tells a type holding nothing but functions, undefined and null', () => {
    expect(holdsOnlyFunctions('(tag: string) => void')).toBe(true);
    expect(holdsOnlyFunctions('((tag: string) => void) | undefined')).toBe(true);
    expect(holdsOnlyFunctions('null | (() => void) | Function')).toBe(true);
    expect(holdsOnlyFunctions('string | (() => string)')).toBe(false);
    expect(holdsOnlyFunctions('undefined | null')).toBe(false);
    expect(holdsOnlyFunctions('Array<() => void>')).toBe(false);
  });
});

describe('relayed bindings', () => {
  const relayed = {
    value: {
      type: 'string',
      bindable: { given: 'givenValue', report: 'reportValue', changeProp: 'onValueChange' },
    },
    onValueChange: { type: '(value: string) => void' },
    pressed: props.pressed,
    defaultPressed: props.defaultPressed,
    onPressedChange: props.onPressedChange,
  };

  it('tells the two forms apart', () => {
    expect(isRelayedBindableDefinition(relayed.value.bindable)).toBe(true);
    expect(isCopiedBindableDefinition(relayed.value.bindable)).toBe(false);
    expect(isRelayedBindableDefinition(props.pressed.bindable)).toBe(false);
    expect(isCopiedBindableDefinition(props.pressed.bindable)).toBe(true);
    expect(isRelayedBindableDefinition(true)).toBe(false);
  });

  it('reads the relayed bindings apart from the copies', () => {
    expect(relayedBindingsOf(relayed)).toEqual([
      {
        prop: 'value',
        definition: relayed.value,
        given: 'givenValue',
        report: 'reportValue',
        changeProp: 'onValueChange',
        reportType: 'string',
      },
    ]);
    expect(twoWayBindingsOf(relayed).map((binding) => binding.prop)).toEqual(['pressed']);
  });

  it('rejects a relay whose change prop a target dropped', () => {
    expect(() => relayedBindingsOf({ value: relayed.value })).toThrow(TemplateError);
  });

  it('keeps a relayed prop as declared in the code props', () => {
    expect(twoWayCodeProps(relayed, JSON.stringify).value).toBe(relayed.value);
  });

  it('writes the report function, passing every call through', () => {
    const [binding] = relayedBindingsOf(relayed);
    expect(
      relayedReportLines({
        binding,
        before: (value) => [`value = ${value};`],
        changeCall: 'onValueChange',
        after: (value) => [`emit('update:value', ${value});`],
        reads: ['value', 'emit'],
        declared: Object.keys(relayed),
      })
    ).toEqual([
      'function reportValue(next: string) {',
      '  value = next;',
      '  onValueChange?.(next);',
      "  emit('update:value', next);",
      '}',
    ]);
    expect(relayedReportLines({ binding, reads: [] })).toEqual([
      'function reportValue(_next: string) {',
      '}',
    ]);
  });

  it("types the report's value as its change prop's parameter, else as the prop", () => {
    const wide = {
      value: {
        type: 'string | number',
        bindable: { given: 'givenValue', report: 'reportValue', changeProp: 'onChange' },
      },
      onChange: { type: '(value: string) => void' },
    };
    const [binding] = relayedBindingsOf(wide);
    expect(binding.reportType).toBe('string');
    expect(
      relayedReportLines({ binding, changeCall: 'onChange', reads: [] })[0]
    ).toBe('function reportValue(next: string) {');
    const [untyped] = relayedBindingsOf({
      ...wide,
      value: { ...wide.value, bindable: { given: 'givenValue', report: 'reportValue' } },
    });
    expect(untyped.reportType).toBe('string | number');
  });

  it("reads a change prop's first parameter type", () => {
    expect(firstParameterTypeOf('(value: string) => void')).toBe('string');
    expect(firstParameterTypeOf('((value: string) => void)')).toBe('string');
    expect(firstParameterTypeOf('(value?: Map<string, number>, reason: string) => void')).toBe(
      'Map<string, number>'
    );
    expect(firstParameterTypeOf('(change: { apply: () => void }) => void')).toBe(
      '{ apply: () => void }'
    );
    expect(firstParameterTypeOf('(next: (value: string) => void) => void')).toBe(
      '(value: string) => void'
    );
    expect(firstParameterTypeOf('() => void')).toBeUndefined();
    expect(firstParameterTypeOf('(value) => void')).toBeUndefined();
    expect(firstParameterTypeOf('string')).toBeUndefined();
  });

  it('names the parameter past a declared or read next', () => {
    const [binding] = relayedBindingsOf(relayed);
    const changeCall = 'onValueChange';
    expect(relayedReportLines({ binding, changeCall, reads: ['next'] })[0]).toBe(
      'function reportValue(nextValue: string) {'
    );
    expect(
      relayedReportLines({ binding, changeCall, reads: ['next'], declared: ['nextValue'] })[0]
    ).toBe('function reportValue(next2: string) {');
  });

  it('comments what the given value is and what reports it', () => {
    const [binding] = relayedBindingsOf(relayed);
    expect(relayedComment(binding)).toBe(
      'givenValue: value as given, reported through reportValue'
    );
  });
});
