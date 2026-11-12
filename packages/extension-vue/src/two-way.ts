import {
  type RelayedBinding,
  type TwoWayBinding,
} from '@js-template-engine/core';
import {
  flattenTemplateLiterals,
  latestValueName,
  readExpressionIdentifiers,
  relayedReportLines,
  tokenizeExpression,
  ownValueName,
  twoWayCurrentType,
  twoWaySeed,
  twoWaySetterLines,
  type ExpressionToken,
} from '@js-template-engine/core/emitter';
import type { PropDefinition } from '@js-template-engine/types';

import { serializeJavaScriptValue } from './literals';
import { vuePropKey } from './props';

/** The prop a bare `v-model` binds, standing in for the named two-way prop. */
export const MODEL_VALUE = 'modelValue';

/**
 * The props a Vue component declares with a bare `v-model` binding: the
 * named two-way prop followed by `modelValue`, of its type, which stands in
 * for it. A required two-way prop is declared optional, since a consumer
 * binding `v-model` gives its value through `modelValue`. Without a model
 * the props are returned as they are.
 *
 * @param props - The component's props.
 * @param model - The two-way prop `extensions.vue.model` names, if any.
 * @returns The props.
 */
export function withModelValue(
  props: Readonly<Record<string, PropDefinition>>,
  model: string | undefined
): Record<string, PropDefinition> {
  if (model === undefined || !(model in props)) {
    return { ...props };
  }
  const result: Record<string, PropDefinition> = {};
  for (const [name, definition] of Object.entries(props)) {
    if (name !== model) {
      result[name] = definition;
    } else {
      const optional: PropDefinition = { ...definition };
      delete optional.required;
      result[name] = optional;
      result[MODEL_VALUE] = {
        type: definition.type,
        description: `Binds \`${name}\` with a bare \`v-model\`; it stands in for \`${name}\`.`,
      };
    }
  }
  return result;
}

/**
 * The `<script setup>` statements that give each two-way prop its value and
 * setter in a Vue component: one typed `defineEmits` with an `update:<prop>`
 * event per binding, copy or relayed, in prop order (and `update:modelValue`
 * for the bare `v-model` one), then per binding, in prop order, its
 * statements. A copy-form binding gets the component's own copy in a
 * `shallowRef` seeded from the default prop, the value as a `computed`
 * reading a given prop over it, the value the setter wrote last until the
 * task ends (so consecutive calls in one handler compose), and the setter,
 * which keeps the own copy only while the prop is not given, calls the
 * change prop and emits. A relayed binding gets the given value as a
 * `computed` (`modelValue` first with a bare `v-model`) and the report
 * function, which calls the change prop with each new value and emits.
 *
 * @param bindings - The component's copy-form two-way bindings.
 * @param props - The component's props, as declared.
 * @param local - A prop's local name (its alias, when it has one).
 * @param model - The two-way prop a bare `v-model` binds, if any.
 * @param relays - The component's relayed two-way bindings.
 * @returns The statements' sections, each a list of lines.
 */
export function twoWayStatements(
  bindings: readonly TwoWayBinding[],
  props: Readonly<Record<string, PropDefinition>>,
  local: (name: string) => string,
  model: string | undefined,
  relays: readonly RelayedBinding[] = []
): string[][] {
  if (bindings.length === 0 && relays.length === 0) {
    return [];
  }
  // Both forms in prop order.
  const order = Object.keys(props);
  const ordered: Array<
    | { kind: 'copy'; binding: TwoWayBinding }
    | { kind: 'relay'; binding: RelayedBinding }
  > = [
    ...bindings.map((binding) => ({ kind: 'copy' as const, binding })),
    ...relays.map((binding) => ({ kind: 'relay' as const, binding })),
  ].sort(
    (first, second) =>
      order.indexOf(first.binding.prop) - order.indexOf(second.binding.prop)
  );
  const events: string[] = [];
  for (const entry of ordered) {
    const { binding } = entry;
    const label = local(binding.prop);
    // A relay emits what its report takes; a copy emits its own value.
    const type =
      entry.kind === 'relay'
        ? entry.binding.reportType
        : binding.definition.type;
    events.push(`'update:${vuePropKey(binding.prop)}': [${label}: ${type}]`);
    if (binding.prop === model) {
      events.push(`'update:${MODEL_VALUE}': [${label}: ${type}]`);
    }
  }
  const emits =
    events.length === 1
      ? [`const emit = defineEmits<{ ${events[0]} }>();`]
      : [
          'const emit = defineEmits<{',
          ...events.map((event) => `  ${event};`),
          '}>();',
        ];
  return [
    emits,
    ...ordered.map(({ kind, binding }) => {
      if (kind === 'relay') {
        return relayedStatements(binding, props, local, model);
      }
      const seed = twoWaySeed(binding, props, local, serializeJavaScriptValue);
      const currentType = twoWayCurrentType(binding, seed);
      const name = local(binding.prop);
      const own = ownValueName(name);
      const isModel = binding.prop === model;
      const given = isModel
        ? `${MODEL_VALUE} !== undefined ? ${MODEL_VALUE} : ${name} !== undefined ? ${name}`
        : `${name} !== undefined ? ${name}`;
      const absent = isModel
        ? `${MODEL_VALUE} === undefined && ${name} === undefined`
        : `${name} === undefined`;
      const latest = latestValueName(name);
      return [
        `const ${own} = shallowRef<${currentType}>(${seed.expression});`,
        `const ${binding.current} = computed(() => (${given} : ${own}.value));`,
        // The value the setter wrote last, until the task ends: a given prop
        // updates only on the next render, so a second call in one handler
        // builds on the first.
        `let ${latest}: { value: ${currentType} } | undefined;`,
        ...twoWaySetterLines({
          binding,
          currentType,
          currentRead: `${latest} !== undefined ? ${latest}.value : ${binding.current}.value`,
          keep: (value) => [
            `${latest} = { ${value === 'value' ? 'value' : `value: ${value}`} };`,
            `queueMicrotask(() => (${latest} = undefined));`,
            `if (${absent}) ${own}.value = ${value};`,
          ],
          changeCall:
            binding.changeProp === undefined
              ? undefined
              : local(binding.changeProp),
          after: (value) => [
            `emit('update:${vuePropKey(binding.prop)}', ${value});`,
            ...(isModel ? [`emit('update:${MODEL_VALUE}', ${value});`] : []),
          ],
          declared: Object.keys(props).map(local),
          reads: [
            name,
            own,
            latest,
            'emit',
            ...(isModel ? [MODEL_VALUE] : []),
            ...(binding.changeProp === undefined
              ? []
              : [local(binding.changeProp)]),
          ],
        }),
      ];
    }),
  ];
}

/**
 * The statements of one relayed two-way prop: the given value as a
 * `computed`, reading `modelValue` first when the prop is the bare
 * `v-model` one, and the report function.
 */
function relayedStatements(
  binding: RelayedBinding,
  props: Readonly<Record<string, PropDefinition>>,
  local: (name: string) => string,
  model: string | undefined
): string[] {
  const name = local(binding.prop);
  const isModel = binding.prop === model;
  const given = isModel
    ? `${MODEL_VALUE} !== undefined ? ${MODEL_VALUE} : ${name}`
    : name;
  const changeCall =
    binding.changeProp === undefined ? undefined : local(binding.changeProp);
  return [
    `const ${binding.given} = computed(() => ${isModel ? `(${given})` : given});`,
    ...relayedReportLines({
      binding,
      changeCall,
      after: (value) => [
        `emit('update:${vuePropKey(binding.prop)}', ${value});`,
        ...(isModel ? [`emit('update:${MODEL_VALUE}', ${value});`] : []),
      ],
      declared: Object.keys(props).map(local),
      reads: [
        name,
        'emit',
        ...(isModel ? [MODEL_VALUE] : []),
        ...(changeCall === undefined ? [] : [changeCall]),
      ],
    }),
  ];
}

/**
 * Rewrites a shared script's free reads of each two-way value and derived
 * value to read the `computed` it is in Vue: `isOpen` becomes
 * `isOpen.value`, so a script written once reads the value in every target.
 * A derived value's own expression is read the same way. Only a free reference is
 * rewritten: a parameter, a local or a destructured name that shadows the
 * value, a member-access tail (`menu.isOpen`), an object key, a class
 * field's name, a label, a name inside a string or a regular expression, an
 * interface or type alias declaration and a type after `as` or `satisfies`
 * are left as written, except that `typeof isOpen` in a type reads
 * `typeof isOpen.value`, the value's type. A read followed by `.value` is
 * rewritten too, since the shared script reads the value itself as every
 * target does: `selected.value` is the value's own `value` field and becomes
 * `selected.value.value`. A shorthand property keeps its key (`{ isOpen }`
 * becomes `{ isOpen: isOpen.value }`), and a template literal's
 * placeholders are read in the scope around them.
 *
 * @param script - The shared script, if any.
 * @param names - The values' names: each two-way binding's `current` and
 *   each derived value's name.
 * @returns The script with the reads rewritten, or `undefined` when
 *   `script` is `undefined`.
 * @example
 * readTwoWayValues('function toggle() { setOpen(!isOpen); }', new Set(['isOpen']));
 * // => 'function toggle() { setOpen(!isOpen.value); }'
 */
export function readTwoWayValues(
  script: string | undefined,
  names: ReadonlySet<string>
): string | undefined {
  if (script === undefined || names.size === 0) {
    return script;
  }
  const tokens = flattenTemplateLiterals(tokenizeExpression(script));
  const readings = readExpressionIdentifiers(tokens);
  const types = typePositions(tokens);
  const previous = (index: number): number => {
    let cursor = index - 1;
    while (cursor >= 0 && tokens[cursor].kind === 'space') {
      cursor -= 1;
    }
    return cursor;
  };
  return tokens
    .map((token, index) => {
      const reading = readings.get(index);
      if (
        reading === undefined ||
        !reading.free ||
        !names.has(token.text) ||
        (types.has(index) && tokens[previous(index)]?.text !== 'typeof')
      ) {
        return token.text;
      }
      return reading.shorthandProperty
        ? `${token.text}: ${token.text}.value`
        : `${token.text}.value`;
    })
    .join('');
}

/** The tokens that let a type alias continue past a line break. */
const TYPE_CONTINUATIONS = new Set(['|', '&', '=', ',', ':', '?', '=>', '<']);

/** The tokens that end a type written after `as` or `satisfies`, at its own depth. */
const TYPE_ENDINGS = new Set([
  ')',
  ']',
  '}',
  ',',
  ';',
  '=',
  '&&',
  '||',
  '??',
  '?',
  ':',
]);

/**
 * The indexes of the tokens in a type position: an `interface` declaration
 * up to its body's closing brace, a `type` alias up to the `;` or the line
 * break that ends it, and a type after `as` or `satisfies`.
 */
function typePositions(tokens: readonly ExpressionToken[]): Set<number> {
  const positions = new Set<number>();
  const significant: number[] = [];
  tokens.forEach((token, index) => {
    if (token.kind !== 'space') {
      significant.push(index);
    }
  });
  const text = (cursor: number): string =>
    cursor >= 0 && cursor < significant.length
      ? tokens[significant[cursor]].text
      : '';
  const kind = (cursor: number): ExpressionToken['kind'] | undefined =>
    tokens[significant[cursor]]?.kind;
  const lineBreakBefore = (cursor: number): boolean => {
    for (
      let index = significant[cursor - 1] + 1;
      index < significant[cursor];
      index += 1
    ) {
      if (tokens[index].text.includes('\n')) {
        return true;
      }
    }
    return false;
  };
  const isOpening = (value: string): boolean =>
    value === '(' || value === '[' || value === '{' || value === '<';
  const isClosing = (value: string): boolean =>
    value === ')' || value === ']' || value === '}' || value === '>';

  let cursor = 0;
  while (cursor < significant.length) {
    const word = text(cursor);
    const declaresType =
      kind(cursor) === 'identifier' &&
      text(cursor - 1) !== '.' &&
      text(cursor - 1) !== '?.' &&
      kind(cursor + 1) === 'identifier' &&
      ((word === 'interface' && text(cursor + 1) !== 'extends') ||
        (word === 'type' &&
          (text(cursor + 2) === '=' || text(cursor + 2) === '<')));
    if (declaresType) {
      let depth = 0;
      let end = cursor + 1;
      for (; end < significant.length; end += 1) {
        const value = text(end);
        if (kind(end) === 'punctuator' && isOpening(value)) {
          depth += 1;
        } else if (kind(end) === 'punctuator' && isClosing(value)) {
          depth -= 1;
          if (depth === 0 && word === 'interface' && value === '}') {
            break;
          }
        } else if (depth === 0 && word === 'type') {
          if (value === ';') {
            break;
          }
          if (
            lineBreakBefore(end) &&
            !TYPE_CONTINUATIONS.has(text(end - 1)) &&
            !TYPE_CONTINUATIONS.has(value)
          ) {
            end -= 1;
            break;
          }
        }
      }
      for (
        let index = cursor;
        index <= end && index < significant.length;
        index += 1
      ) {
        positions.add(significant[index]);
      }
      cursor = end + 1;
      continue;
    }
    if (
      kind(cursor) === 'identifier' &&
      (word === 'as' || word === 'satisfies')
    ) {
      let depth = 0;
      let end = cursor + 1;
      for (; end < significant.length; end += 1) {
        const value = text(end);
        if (
          depth === 0 &&
          lineBreakBefore(end) &&
          !TYPE_CONTINUATIONS.has(text(end - 1)) &&
          !TYPE_CONTINUATIONS.has(value)
        ) {
          break;
        }
        if (kind(end) !== 'punctuator') {
          continue;
        }
        if (isOpening(value)) {
          depth += 1;
        } else if (depth > 0 && isClosing(value)) {
          depth -= 1;
        } else if (depth === 0 && TYPE_ENDINGS.has(value)) {
          break;
        }
      }
      for (let index = cursor; index < end; index += 1) {
        positions.add(significant[index]);
      }
      cursor = end;
      continue;
    }
    cursor += 1;
  }
  return positions;
}
