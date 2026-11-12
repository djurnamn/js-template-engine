import {
  type RelayedBinding,
  type TwoWayBinding,
} from '@js-template-engine/core';
import {
  latestValueName,
  ownSetterName,
  ownValueName,
  relayedReportLines,
  twoWayCurrentType,
  twoWaySeed,
  twoWaySetterLines,
} from '@js-template-engine/core/emitter';
import type { PropDefinition } from '@js-template-engine/types';

import { serializeJavaScriptValue } from './literals';

/**
 * The statements that give each two-way prop its value and setter in a
 * React component: the component's own copy in `useState`, seeded from the
 * default prop; the value, the given prop when it is not `undefined` and
 * the own copy otherwise; a ref holding the value the setter wrote last,
 * until the task ends, so consecutive calls in one handler compose; and the
 * setter, which keeps the own copy only while the prop is not given and
 * calls the change prop.
 *
 * @param bindings - The component's two-way bindings.
 * @param props - The component's props, as declared.
 * @param read - How the component reads a prop: its local name, or
 *   `props.<name>` where the props are destructured per branch.
 * @param local - A prop's local name (its alias, when it has one).
 * @param defaultsApplied - Whether `read` gives a prop with its default
 *   applied; `false` where the props are read off `props`.
 * @returns The lines, one binding after another, unindented.
 * @example
 * // const [ownPressed, setOwnPressed] = useState<boolean>(defaultPressed);
 * // const isPressed = pressed !== undefined ? pressed : ownPressed;
 * // function setPressed(next: boolean | ((current: boolean) => boolean)) { ... }
 */
export function twoWayStatements(
  bindings: readonly TwoWayBinding[],
  props: Readonly<Record<string, PropDefinition>>,
  read: (name: string) => string,
  local: (name: string) => string,
  defaultsApplied = true
): string[][] {
  return bindings.map((binding) => {
    const seed = twoWaySeed(
      binding,
      props,
      read,
      serializeJavaScriptValue,
      defaultsApplied
    );
    const currentType = twoWayCurrentType(binding, seed);
    const own = ownValueName(local(binding.prop));
    const setOwn = ownSetterName(local(binding.prop));
    const latest = latestValueName(local(binding.prop));
    const given = read(binding.prop);
    return [
      `const [${own}, ${setOwn}] = useState<${currentType}>(${seed.expression});`,
      `const ${binding.current} = ${given} !== undefined ? ${given} : ${own};`,
      // The value the setter wrote last, until the task ends: a second call
      // in one handler builds on the first rather than on the value this
      // render read, and the next event reads the rendered value again.
      `const ${latest} = useRef<{ value: ${currentType} } | null>(null);`,
      ...twoWaySetterLines({
        binding,
        currentType,
        currentRead: `${latest}.current !== null ? ${latest}.current.value : ${binding.current}`,
        keep: (value) => [
          `${latest}.current = { ${value === 'value' ? 'value' : `value: ${value}`} };`,
          `queueMicrotask(() => (${latest}.current = null));`,
          `if (${given} === undefined) ${setOwn}(${value});`,
        ],
        changeCall:
          binding.changeProp === undefined
            ? undefined
            : read(binding.changeProp),
        declared: Object.keys(props).map(local),
        reads: [
          given.split('.')[0],
          setOwn,
          latest,
          ...(binding.changeProp === undefined
            ? []
            : [read(binding.changeProp).split('.')[0]]),
        ],
      }),
    ];
  });
}

/**
 * The statements that give each relayed two-way prop its given value and
 * report function in a React component: the value is the prop as given,
 * and the report function calls the change prop with each new value. A
 * relayed value holds no state, so nothing here is a hook.
 *
 * @param bindings - The component's relayed bindings.
 * @param props - The component's props, as declared.
 * @param read - How the component reads a prop: its local name, or
 *   `props.<name>` where the props are destructured per branch.
 * @param local - A prop's local name (its alias, when it has one).
 * @returns The lines, one binding after another, unindented.
 * @example
 * // const givenValue = value;
 * // function reportValue(next: string) {
 * //   onValueChange?.(next);
 * // }
 */
export function relayedStatements(
  bindings: readonly RelayedBinding[],
  props: Readonly<Record<string, PropDefinition>>,
  read: (name: string) => string,
  local: (name: string) => string
): string[][] {
  return bindings.map((binding) => {
    const given = read(binding.prop);
    const changeCall =
      binding.changeProp === undefined ? undefined : read(binding.changeProp);
    return [
      `const ${binding.given} = ${given};`,
      ...relayedReportLines({
        binding,
        changeCall,
        declared: Object.keys(props).map(local),
        reads: [
          given.split('.')[0],
          ...(changeCall === undefined ? [] : [changeCall.split('.')[0]]),
        ],
      }),
    ];
  });
}
