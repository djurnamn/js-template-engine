import type {
  BindableDefinition,
  CopiedBindableDefinition,
  JsonValue,
  PropDefinition,
  RelayedBindableDefinition,
} from '@js-template-engine/types';

import { TemplateError } from './TemplateError';

/**
 * A two-way prop whose `bindable` is an object: the component generates its
 * controlled and uncontrolled value under {@link current}, changed through
 * {@link setter}.
 */
export interface TwoWayBinding {
  /** The bindable prop's name. */
  prop: string;
  /** The bindable prop's definition, as declared. */
  definition: PropDefinition;
  /** The name the template and the component script read the value by. */
  current: string;
  /** The name of the generated function that changes the value. */
  setter: string;
  /** The prop the component's own copy starts from, if any. */
  defaultProp?: string;
  /** The event prop called with each new value, if any. */
  changeProp?: string;
}

/**
 * Whether a prop's `bindable` is the object form, which has every framework
 * target generate the two-way value.
 *
 * @param bindable - A prop definition's `bindable`.
 * @returns `true` for a {@link BindableDefinition}.
 */
export function isBindableDefinition(
  bindable: unknown
): bindable is BindableDefinition {
  return (
    typeof bindable === 'object' &&
    bindable !== null &&
    !Array.isArray(bindable)
  );
}

/**
 * Whether a prop's `bindable` is the relayed form of the object, `{ given,
 * report }`, whose value its owner keeps.
 *
 * @param bindable - A prop definition's `bindable`.
 * @returns `true` for a {@link RelayedBindableDefinition}.
 */
export function isRelayedBindableDefinition(
  bindable: unknown
): bindable is RelayedBindableDefinition {
  return isBindableDefinition(bindable) && 'given' in bindable;
}

/**
 * Whether a prop's `bindable` is the copy form of the object, `{ current,
 * setter }`, whose value the component keeps.
 *
 * @param bindable - A prop definition's `bindable`.
 * @returns `true` for a {@link CopiedBindableDefinition}.
 */
export function isCopiedBindableDefinition(
  bindable: unknown
): bindable is CopiedBindableDefinition {
  return isBindableDefinition(bindable) && !('given' in bindable);
}

/**
 * A two-way prop whose `bindable` is the relayed form: the value's owner
 * keeps it, the template forwards the given value under {@link given} and
 * hands the owner {@link report} to call with each change.
 */
export interface RelayedBinding {
  /** The bindable prop's name. */
  prop: string;
  /** The bindable prop's definition, as declared. */
  definition: PropDefinition;
  /** The name the template and the component script read the given value by. */
  given: string;
  /** The name of the generated function the owner reports each new value through. */
  report: string;
  /** The event prop called with each reported value, if any. */
  changeProp?: string;
  /**
   * The type of the value `report` takes: the change prop's first parameter
   * type when the change prop states one, else the prop's type.
   */
  reportType: string;
}

/**
 * The relayed two-way bindings a component's props declare, in prop order.
 * A binding whose `changeProp` names a prop the given record does not
 * declare (a target's override replaced the props without it) is a
 * processing error.
 *
 * @param props - The component's props, as the target resolves them.
 * @returns The bindings.
 * @example
 * relayedBindingsOf({
 *   value: { type: 'string', bindable: { given: 'givenValue', report: 'reportValue' } },
 * });
 * // [{ prop: 'value', given: 'givenValue', report: 'reportValue', definition: { ... } }]
 */
export function relayedBindingsOf(
  props: Readonly<Record<string, PropDefinition>>
): RelayedBinding[] {
  const bindings: RelayedBinding[] = [];
  for (const [prop, definition] of Object.entries(props)) {
    const bindable = definition.bindable;
    if (!isRelayedBindableDefinition(bindable)) {
      continue;
    }
    if (bindable.changeProp !== undefined && !(bindable.changeProp in props)) {
      throw new TemplateError(
        `The two-way prop '${prop}' names '${bindable.changeProp}' as its changeProp, which this target's props do not declare`,
        `props.${prop}.bindable.changeProp`
      );
    }
    const changeType =
      bindable.changeProp === undefined
        ? undefined
        : props[bindable.changeProp]?.type;
    bindings.push({
      prop,
      definition,
      given: bindable.given,
      report: bindable.report,
      changeProp: bindable.changeProp,
      reportType:
        (changeType === undefined
          ? undefined
          : firstParameterTypeOf(changeType)) ?? definition.type.trim(),
    });
  }
  return bindings;
}

/**
 * The type of a function type's first parameter, as written:
 * `string` for `(value: string, reason?: Reason) => void`. A function type
 * with no parameter, or whose first parameter states no type, gives none.
 *
 * @param type - The function type, as code.
 * @returns The parameter's type, or `undefined`.
 * @example
 * firstParameterTypeOf('(value: string) => void'); // 'string'
 */
export function firstParameterTypeOf(type: string): string | undefined {
  let text = type.trim();
  while (wrappedInParentheses(text) && !isFunctionType(text)) {
    text = text.slice(1, -1).trim();
  }
  if (!isFunctionType(text) || !text.startsWith('(')) {
    return undefined;
  }
  let depth = 0;
  let end = -1;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (character === '=' && text[i + 1] === '>') {
      i += 1;
    } else if ('([{<'.includes(character)) {
      depth += 1;
    } else if (')]}>'.includes(character)) {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    return undefined;
  }
  const parameters = text.slice(1, end);
  let first = parameters;
  depth = 0;
  for (let i = 0; i < parameters.length; i += 1) {
    const character = parameters[i];
    if (character === '=' && parameters[i + 1] === '>') {
      i += 1;
    } else if ('([{<'.includes(character)) depth += 1;
    else if (')]}>'.includes(character)) depth -= 1;
    else if (character === ',' && depth === 0) {
      first = parameters.slice(0, i);
      break;
    }
  }
  depth = 0;
  for (let i = 0; i < first.length; i += 1) {
    const character = first[i];
    if ('([{<'.includes(character)) depth += 1;
    else if (')]}>'.includes(character)) depth -= 1;
    else if (character === ':' && depth === 0) {
      const parameterType = first.slice(i + 1).trim();
      return parameterType === '' ? undefined : parameterType;
    }
  }
  return undefined;
}

/**
 * The copy-form two-way bindings a component's props declare, in prop
 * order; the relayed form is read by {@link relayedBindingsOf}. A binding
 * whose `defaultProp` or `changeProp` names a prop the given record does
 * not declare (a target's override replaced the props without it) is a
 * processing error.
 *
 * @param props - The component's props, as the target resolves them.
 * @returns The bindings.
 * @example
 * twoWayBindingsOf({
 *   open: { type: 'boolean', bindable: { current: 'isOpen', setter: 'setOpen' } },
 * });
 * // [{ prop: 'open', current: 'isOpen', setter: 'setOpen', definition: { ... } }]
 */
export function twoWayBindingsOf(
  props: Readonly<Record<string, PropDefinition>>
): TwoWayBinding[] {
  const bindings: TwoWayBinding[] = [];
  for (const [prop, definition] of Object.entries(props)) {
    const bindable = definition.bindable;
    if (!isCopiedBindableDefinition(bindable)) {
      continue;
    }
    for (const field of ['defaultProp', 'changeProp'] as const) {
      const named = bindable[field];
      if (named !== undefined && !(named in props)) {
        throw new TemplateError(
          `The two-way prop '${prop}' names '${named}' as its ${field}, which this target's props do not declare`,
          `props.${prop}.bindable.${field}`
        );
      }
    }
    bindings.push({
      prop,
      definition,
      current: bindable.current,
      setter: bindable.setter,
      defaultProp: bindable.defaultProp,
      changeProp: bindable.changeProp,
    });
  }
  return bindings;
}

/**
 * The props as the generated code declares them: a copy-form two-way prop
 * keeps no default of its own, since `undefined` is what leaves the value
 * to the component, so its `default` (which seeds the component's own copy
 * instead) moves to `documentedDefault` and is still documented as the
 * prop's `@defaultValue`. A relayed prop declares no default.
 *
 * @param props - The component's props.
 * @param serialize - Writes a default as the target writes it in code.
 * @returns The props, unchanged when none is a two-way prop with a default.
 */
export function twoWayCodeProps(
  props: Readonly<Record<string, PropDefinition>>,
  serialize: (value: JsonValue) => string
): Record<string, PropDefinition> {
  const code: Record<string, PropDefinition> = {};
  for (const [name, definition] of Object.entries(props)) {
    if (
      isCopiedBindableDefinition(definition.bindable) &&
      definition.default !== undefined
    ) {
      const { default: value, ...rest } = definition;
      code[name] = { ...rest, documentedDefault: serialize(value) };
    } else {
      code[name] = definition;
    }
  }
  return code;
}

/**
 * The name of the component's own copy of a two-way value: `own` and the
 * prop's local name capitalized (`pressed` → `ownPressed`).
 *
 * @param local - The prop's local name (its alias, when it has one).
 * @returns The name.
 */
export function ownValueName(local: string): string {
  return `own${local.charAt(0).toUpperCase()}${local.slice(1)}`;
}

/**
 * The name of the React ref holding the latest value of a two-way prop, so
 * consecutive setter calls in one handler build on each other
 * (`pressed` → `latestPressed`).
 *
 * @param local - The prop's local name (its alias, when it has one).
 * @returns The name.
 */
export function latestValueName(local: string): string {
  return `latest${local.charAt(0).toUpperCase()}${local.slice(1)}`;
}

/**
 * The name of the React state setter of a two-way prop's own copy
 * (`pressed` → `setOwnPressed`).
 *
 * @param local - The prop's local name (its alias, when it has one).
 * @returns The name.
 */
export function ownSetterName(local: string): string {
  return `setOwn${local.charAt(0).toUpperCase()}${local.slice(1)}`;
}

/**
 * The name of the Svelte echo guard of a relayed two-way prop, which tells
 * the values the component reported itself from the ones the consumer
 * gives (`value` → `valueEcho`).
 *
 * @param local - The prop's local name (its alias, when it has one).
 * @returns The name.
 */
export function echoGuardName(local: string): string {
  return `${local}Echo`;
}

/** What a two-way value starts from when the prop is not given. */
export interface TwoWaySeed {
  /** The expression, as code. */
  expression: string;
  /**
   * Whether the seed always holds a value, so the current value is typed as
   * the prop's type; otherwise it may be `undefined` too.
   */
  definite: boolean;
}

/**
 * What a two-way prop's own copy starts from: the `defaultProp` (its own
 * default applied), else the prop's declared `default`, else `undefined`.
 *
 * @param binding - The two-way binding.
 * @param props - The component's props, as declared.
 * @param local - The local name a prop is read by in the target.
 * @param serialize - Writes a default as the target writes it in code.
 * @param defaultsApplied - Whether `local` reads a prop with its default
 *   applied (a destructured prop); otherwise the default prop's default is
 *   written into the seed (`props.defaultOpen !== undefined ?
 *   props.defaultOpen : false`).
 * @returns The seed.
 */
export function twoWaySeed(
  binding: TwoWayBinding,
  props: Readonly<Record<string, PropDefinition>>,
  local: (name: string) => string,
  serialize: (value: JsonValue) => string,
  defaultsApplied = true
): TwoWaySeed {
  if (binding.defaultProp !== undefined) {
    const definition = props[binding.defaultProp];
    const read = local(binding.defaultProp);
    return {
      expression:
        defaultsApplied || definition?.default === undefined
          ? read
          : `${read} !== undefined ? ${read} : ${serialize(definition.default)}`,
      definite:
        definition?.default !== undefined || definition?.required === true,
    };
  }
  if (binding.definition.default !== undefined) {
    return {
      expression: serialize(binding.definition.default),
      definite: true,
    };
  }
  return { expression: 'undefined', definite: false };
}

/**
 * A type written so a union can extend it: a conditional or function type
 * is parenthesized, any other is kept as written.
 */
function unionOperand(type: string): string {
  const trimmed = type.trim();
  return /\?|=>/.test(trimmed) ? `(${trimmed})` : trimmed;
}

/**
 * The TypeScript type of a two-way value as the component reads it: the
 * prop's type, widened with `undefined` when nothing seeds the component's
 * own copy.
 *
 * @param binding - The two-way binding.
 * @param seed - What the component's own copy starts from.
 * @returns The type, as code.
 */
export function twoWayCurrentType(
  binding: TwoWayBinding,
  seed: TwoWaySeed
): string {
  return seed.definite
    ? binding.definition.type.trim()
    : `${unionOperand(binding.definition.type)} | undefined`;
}

/** The pieces a target supplies to {@link twoWaySetterLines}. */
export interface TwoWaySetterParts {
  /** The two-way binding. */
  binding: TwoWayBinding;
  /** The current value's type ({@link twoWayCurrentType}). */
  currentType: string;
  /**
   * How the setter reads the current value: `isPressed`, `isPressed.value`,
   * or an expression, which the setter reads once into a local.
   */
  currentRead: string;
  /** Statements that keep the new value, run first, given its local name. */
  keep: (value: string) => string[];
  /** The change prop's local name, called after the value is kept. */
  changeCall?: string;
  /** Statements run last, such as Vue's emits, given the value's local name. */
  after?: (value: string) => string[];
  /** Names the setter's body reads, which its own locals avoid. */
  reads: Iterable<string>;
  /**
   * The local names of the component's declared props, which the setter's
   * own locals never shadow: a second two-way prop's setter declaring
   * `value` would hide a declared `value` prop. Omitted, only `reads` is
   * avoided.
   */
  declared?: Iterable<string>;
}

/**
 * The generated setter of a two-way value: it takes the next value or an
 * updater `(current) => next`, does nothing for an unchanged value
 * (`Object.is`), keeps the value as the target does, then calls the change
 * prop and runs what follows. Each of its names is chosen on its own: the
 * parameter is `next`, or `nextValue` where the body reads or the component
 * declares a `next`; the local is `value`, or `updated` where it reads or
 * declares a `value`; a current value read through an expression goes into
 * `current`, or `currentValue`.
 *
 * @param parts - What the target supplies.
 * @returns The function's lines, unindented.
 * @example
 * twoWaySetterLines({ binding, currentType: 'boolean', currentRead: 'isPressed',
 *   keep: (value) => [`if (pressed === undefined) setOwnPressed(${value});`],
 *   changeCall: 'onPressedChange', reads: [], declared: ['pressed'] });
 * // function setPressed(next: boolean | ((current: boolean) => boolean)) { ... }
 */
export function twoWaySetterLines(parts: TwoWaySetterParts): string[] {
  const taken = new Set([...parts.reads, ...(parts.declared ?? [])]);
  taken.add(parts.binding.current);
  taken.add(parts.binding.setter);
  const free = (candidates: string[]): string => {
    let name = candidates.find((candidate) => !taken.has(candidate));
    for (let index = 2; name === undefined; index += 1) {
      const numbered = `${candidates[0]}${index}`;
      name = taken.has(numbered) ? undefined : numbered;
    }
    taken.add(name);
    return name;
  };
  const next = free(['next', 'nextValue']);
  const value = free(['value', 'updated']);
  // A current value read through an expression is read once, into a local.
  const simple = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(
    parts.currentRead
  );
  const current = simple
    ? parts.currentRead
    : free(['current', 'currentValue']);
  const type = unionOperand(parts.binding.definition.type);
  const updater = `(current: ${parts.currentType}) => ${type}`;
  const keep = parts.keep(value);
  const after = parts.after?.(value) ?? [];
  return [
    `function ${parts.binding.setter}(${next}: ${type} | (${updater})) {`,
    ...(simple ? [] : [`  const ${current} = ${parts.currentRead};`]),
    `  const ${value} = typeof ${next} === 'function' ? (${next} as ${updater})(${current}) : ${next};`,
    `  if (Object.is(${value}, ${current})) return;`,
    ...keep.map((line) => `  ${line}`),
    ...(parts.changeCall === undefined
      ? []
      : [`  ${parts.changeCall}?.(${value});`]),
    ...after.map((line) => `  ${line}`),
    '}',
  ];
}

/** The pieces a target supplies to {@link relayedReportLines}. */
export interface RelayedReportParts {
  /** The relayed binding. */
  binding: RelayedBinding;
  /** Statements run first, given the new value's local name. */
  before?: (value: string) => string[];
  /** The change prop's local name, called with the value. */
  changeCall?: string;
  /** Statements run last, such as Vue's emits, given the value's local name. */
  after?: (value: string) => string[];
  /** Names the function's body reads, which its parameter avoids. */
  reads: Iterable<string>;
  /**
   * The local names of the component's declared props, which the parameter
   * never shadows. Omitted, only `reads` is avoided.
   */
  declared?: Iterable<string>;
}

/**
 * The generated report function of a relayed two-way value: it takes the
 * new value and passes every call through, an unchanged value included -
 * what runs first as the target has it, then the change prop, then what
 * follows. Its parameter is `next`, or `nextValue` where the body reads or
 * the component declares a `next`, typed as the binding's `reportType`; a
 * report with an empty body names it with a leading underscore.
 *
 * @param parts - What the target supplies.
 * @returns The function's lines, unindented.
 * @example
 * relayedReportLines({ binding, changeCall: 'onValueChange', reads: [], declared: ['value'] });
 * // function reportValue(next: string) {
 * //   onValueChange?.(next);
 * // }
 */
export function relayedReportLines(parts: RelayedReportParts): string[] {
  const taken = new Set([...parts.reads, ...(parts.declared ?? [])]);
  taken.add(parts.binding.given);
  taken.add(parts.binding.report);
  let next = ['next', 'nextValue'].find((candidate) => !taken.has(candidate));
  for (let index = 2; next === undefined; index += 1) {
    next = taken.has(`next${index}`) ? undefined : `next${index}`;
  }
  const body = [
    ...(parts.before?.(next) ?? []),
    ...(parts.changeCall === undefined
      ? []
      : [`${parts.changeCall}?.(${next});`]),
    ...(parts.after?.(next) ?? []),
  ];
  // A report that does nothing with its value still takes it, since the
  // markup passes it; the underscore keeps a consumer's noUnusedParameters
  // quiet.
  const parameter = body.length === 0 ? `_${next}` : next;
  return [
    `function ${parts.binding.report}(${parameter}: ${parts.binding.reportType}) {`,
    ...body.map((line) => `  ${line}`),
    '}',
  ];
}

/**
 * Whether a TypeScript type is a function type at its top level, such as
 * `(value: string) => void`, rather than a type that holds one.
 *
 * @param type - The type, as code.
 * @returns `true` for a function type.
 */
export function isFunctionType(type: string): boolean {
  return (
    /^\s*(?:new\s*)?(?:<[^]*?>\s*)?(\([^]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(
      type
    ) && returnTypeOf(type) !== undefined
  );
}

/**
 * Whether a TypeScript type is a function type or a union with a function
 * type among its top-level members, such as `string | ((value: string) =>
 * void)`: a value a setter could not tell from an updater.
 *
 * @param type - The type, as code.
 * @returns `true` when a function may be a value of the type.
 */
export function admitsFunction(type: string): boolean {
  if (isFunctionType(type)) {
    return true;
  }
  return unionMembers(type).some((member) => {
    let trimmed = member.trim();
    while (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      const inner = trimmed.slice(1, -1).trim();
      if (isFunctionType(inner)) return true;
      trimmed = inner;
    }
    return isFunctionType(trimmed) || /^Function$/.test(trimmed);
  });
}

/**
 * Whether every value of a TypeScript type is a function, or nothing: a
 * function type, or a union whose top-level members are each a function
 * type, `undefined` or `null`, a function among them, such as
 * `((tag: string) => void) | undefined`. `string | (() => string)` is not.
 *
 * @param type - The type, as code.
 * @returns `true` when the type holds only functions besides nothing.
 */
export function holdsOnlyFunctions(type: string): boolean {
  if (isFunctionType(type)) {
    return true;
  }
  let holdsFunction = false;
  for (const member of unionMembers(type)) {
    let trimmed = member.trim();
    while (
      trimmed.startsWith('(') &&
      trimmed.endsWith(')') &&
      !isFunctionType(trimmed)
    ) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    if (trimmed === 'undefined' || trimmed === 'null') continue;
    if (isFunctionType(trimmed) || trimmed === 'Function') {
      holdsFunction = true;
      continue;
    }
    return false;
  }
  return holdsFunction;
}

/**
 * The top-level members of a TypeScript union type, as written: `'a' | 'b'`
 * is `'a' ` and ` 'b'`; a `|` inside brackets, parentheses, braces, type
 * arguments or a quoted string does not split. A type that is no union is
 * its one member.
 */
function unionMembers(type: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: string | undefined;
  for (let i = 0; i < type.length; i += 1) {
    const character = type[i];
    if (quote !== undefined) {
      if (character === '\\') i += 1;
      else if (character === quote) quote = undefined;
    } else if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === '=' && type[i + 1] === '>') {
      i += 1;
    } else if ('([{<'.includes(character)) depth += 1;
    else if (')]}>'.includes(character)) depth -= 1;
    else if (character === '|' && depth === 0) {
      members.push(type.slice(start, i));
      start = i + 1;
    }
  }
  members.push(type.slice(start));
  return members;
}

/**
 * A type's code with its whitespace normalized outside quoted strings - each
 * run one space, and none beside punctuation, so `Array< string >` reads as
 * `Array<string>` - and each double-quoted string literal written with
 * single quotes, so `"sm"` reads as `'sm'`.
 */
function normalizeTypeText(type: string): string {
  let output = '';
  let i = 0;
  while (i < type.length) {
    const character = type[i];
    if (character === "'" || character === '"' || character === '`') {
      let end = i + 1;
      while (end < type.length && type[end] !== character) {
        end += type[end] === '\\' ? 2 : 1;
      }
      const body = type.slice(i + 1, end);
      output +=
        character === '"' && !body.includes("'")
          ? `'${body}'`
          : type.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    let end = i;
    while (end < type.length && !'\'"`'.includes(type[end])) end += 1;
    output += type
      .slice(i, end)
      .replace(/\s+/g, ' ')
      .replace(/ ?([|&<>()[\]{},;:?=]) ?/g, '$1');
    i = end;
  }
  return output.trim();
}

/** Whether a parenthesis at `0` closes at the type's last character. */
function wrappedInParentheses(type: string): boolean {
  if (!type.startsWith('(') || !type.endsWith(')')) return false;
  let depth = 0;
  for (let i = 0; i < type.length; i += 1) {
    if (type[i] === '(') depth += 1;
    else if (type[i] === ')') depth -= 1;
    if (depth === 0 && i < type.length - 1) return false;
  }
  return true;
}

/**
 * A union type's members in one canonical spelling each: outer parentheses
 * removed, `boolean` as `true` and `false`, `T[]` as `Array<T>` (its `T`
 * canonical in turn), and `undefined` left out.
 */
function canonicalMembers(type: string): Set<string> {
  let text = type.trim();
  while (wrappedInParentheses(text)) text = text.slice(1, -1).trim();
  const members = new Set<string>();
  for (const written of unionMembers(text)) {
    let member = written.trim();
    while (wrappedInParentheses(member)) member = member.slice(1, -1).trim();
    if (member === '' || member === 'undefined') continue;
    if (member === 'boolean') {
      members.add('true');
      members.add('false');
      continue;
    }
    const array = /^Array<([^]*)>$/.exec(member);
    const element = member.endsWith('[]') ? member.slice(0, -2) : array?.[1];
    if (element !== undefined) {
      const inner = [...canonicalMembers(element)].sort().join('|');
      members.add(`Array<${inner}>`);
      continue;
    }
    members.add(member);
  }
  return members;
}

/**
 * Whether a prop's literal `default` can be a value of its declared type,
 * read conservatively: only a type whose every top-level union member is
 * `string`, `number`, `boolean`, `true`, `false`, `null`, `undefined`, a
 * quoted string literal or a number literal is checked, and the default must
 * be a value of one member. Any other type (an object, an array, a type
 * parameter, an alias) is not read, and admits every default.
 *
 * @param propType - The prop's declared type, as code.
 * @param value - The prop's `default`.
 * @returns `false` only when the type is one the check reads and the default
 *   is none of its values.
 *
 * @example
 * defaultValueFitsType("'sm' | 'md'", 'lg'); // → false
 * defaultValueFitsType('string', { $expression: 'label' }); // → false
 * defaultValueFitsType('Row[]', []); // → true (not read)
 */
export function defaultValueFitsType(
  propType: string,
  value: unknown
): boolean {
  const members = canonicalMembers(normalizeTypeText(propType));
  const literals: unknown[] = [];
  for (const member of members) {
    if (member === 'string' || member === 'number') {
      literals.push(member);
    } else if (member === 'true' || member === 'false') {
      literals.push(member === 'true');
    } else if (member === 'null') {
      literals.push(null);
    } else if (/^'[^'\\]*'$/.test(member)) {
      literals.push({ literal: member.slice(1, -1) });
    } else if (/^-?\d+(\.\d+)?$/.test(member)) {
      literals.push({ literal: Number(member) });
    } else {
      return true;
    }
  }
  if (literals.length === 0) {
    return true;
  }
  return literals.some((literal) =>
    literal === 'string' || literal === 'number'
      ? typeof value === literal
      : typeof literal === 'object' && literal !== null
        ? (literal as { literal: unknown }).literal === value
        : literal === value
  );
}

/**
 * Whether a default prop's declared type matches its two-way prop's: the
 * same top-level union members, in any order, ignoring an `undefined` member
 * on either side, so a default prop may be the two-way prop's type with
 * `| undefined`. The comparison reads past spelling: whitespace outside
 * quoted strings, quote style, outer parentheses, `boolean` against
 * `true | false` and `T[]` against `Array<T>`.
 *
 * @param propType - The two-way prop's type, as code.
 * @param defaultType - The default prop's type, as code.
 * @returns `true` when the default prop's value can seed the two-way prop.
 */
export function defaultTypeMatches(
  propType: string,
  defaultType: string
): boolean {
  const prop = canonicalMembers(normalizeTypeText(propType));
  const fallback = canonicalMembers(normalizeTypeText(defaultType));
  return (
    prop.size === fallback.size &&
    [...prop].every((member) => fallback.has(member))
  );
}

/**
 * Whether a TypeScript type is an event's: a function that returns nothing,
 * such as `(value: string) => void`, which a component calls as things
 * happen.
 *
 * @param type - The type, as code.
 * @returns `true` for a `void`- or `Promise<void>`-returning function type.
 */
export function isEventType(type: string): boolean {
  if (!isFunctionType(type)) {
    return false;
  }
  const returned = returnTypeOf(type);
  return (
    returned !== undefined &&
    /^(void|Promise<void>)$/.test(returned.replace(/\s+/g, ''))
  );
}

/** The return type of a function type, after its first arrow outside any
 *  brackets: `void` for `(change: { apply: () => void }) => void`. */
function returnTypeOf(type: string): string | undefined {
  let depth = 0;
  for (let i = 0; i < type.length; i += 1) {
    const character = type[i];
    if (character === '=' && type[i + 1] === '>') {
      if (depth === 0) return type.slice(i + 2).trim();
      i += 1;
    } else if ('([{<'.includes(character)) depth += 1;
    else if (')]}>'.includes(character)) depth -= 1;
  }
  return undefined;
}

/**
 * The comment the html target writes at a component's head for each two-way
 * value, saying where the name the markup reads comes from:
 * `isPressed: pressed, else defaultPressed`.
 *
 * @param binding - The two-way binding.
 * @param serialize - Writes a default as code.
 * @returns The comment's text.
 */
export function twoWayComment(
  binding: TwoWayBinding,
  serialize: (value: JsonValue) => string
): string {
  const fallback =
    binding.defaultProp ??
    (binding.definition.default !== undefined
      ? serialize(binding.definition.default)
      : "the component's own value");
  return `${binding.current}: ${binding.prop}, else ${fallback}`;
}

/**
 * The comment the html target writes at a component's head for each relayed
 * two-way value, saying what the name the markup reads is and what reports
 * it: `givenValue: value as given, reported through reportValue`.
 *
 * @param binding - The relayed binding.
 * @returns The comment's text.
 */
export function relayedComment(binding: RelayedBinding): string {
  return `${binding.given}: ${binding.prop} as given, reported through ${binding.report}`;
}
