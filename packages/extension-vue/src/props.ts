import {
  camelizePropName,
  optionalPropType,
  propAliases,
  propDocumentation,
} from '@js-template-engine/core/emitter';
import type { JsonValue, PropDefinition } from '@js-template-engine/types';

import { objectKey, serializeJavaScriptValue } from './literals';

/**
 * The key Vue declares a prop under: a hyphenated name camelized as Vue's
 * runtime camelizes it (`aria-pressed` → `ariaPressed`). Vue reads a prop
 * from its camelized key whatever the consumer writes, `aria-pressed` or
 * `ariaPressed`, so a prop declared under the hyphenated key is never set.
 *
 * @param name - The declared prop name.
 * @returns The key the props interface and the destructure use.
 */
export function vuePropKey(name: string): string {
  return camelizePropName(name);
}

/**
 * The base admitting a consumer's `data-*` attributes on a component that
 * hands its undeclared attributes on. Vue types no `data-*` attribute, and
 * vue-tsc checks one written on a component under its camelized name
 * (`data-testid` as `dataTestid`), so the base keys every such name; typed
 * `unknown`, it admits a declared prop of the same shape (`dataSource`). The
 * `@vue-ignore` keeps it out of the runtime props, so the attributes still
 * fall through.
 */
const DATA_ATTRIBUTES_BASE =
  '/* @vue-ignore */ Record<`data${Capitalize<string>}`, unknown>';

/**
 * The base admitting a declared `aria-*` prop under its hyphenated name,
 * typed as the prop is. The interface declares the prop under its camelized
 * key (`ariaPressed`), which Vue sets whichever spelling the consumer
 * writes, but vue-tsc checks an `aria-*` attribute written on a component
 * under the name as written, so `<Toggle aria-pressed>` needs the
 * hyphenated key too. The `@vue-ignore` keeps it out of the runtime props.
 * Returns `undefined` when no declared prop is an `aria-*` name.
 */
function hyphenatedAriaBase(
  declaredProps: Record<string, PropDefinition>
): string | undefined {
  const members = Object.entries(declaredProps)
    .filter(([name]) => name.startsWith('aria-'))
    .map(
      ([name, definition]) =>
        `'${name}': ${definition.required === true ? definition.type : optionalPropType(definition.type)}`
    );
  return members.length === 0
    ? undefined
    : `/* @vue-ignore */ Partial<{ ${members.join('; ')} }>`;
}

/**
 * Renders the generated props interface for a Vue component, declared
 * props in authored order, a hyphenated name under its camelized key
 * ({@link vuePropKey}). Returns `undefined` when no props are declared
 * and no attributes tag is given.
 *
 * Unlike React, Vue slots are template `<slot>` elements rather than
 * props, so the interface carries only the author's declared props. The
 * interface is exported (a type export is allowed in `<script setup>`), so a
 * barrel that star-exports the component carries its props type. An optional
 * prop is typed `?: T | undefined` ({@link optionalPropType}), so a consumer
 * compiling with `exactOptionalPropertyTypes` can pass `undefined`.
 *
 * With `attributesTags` - the element a passthrough root or `rest` hands the
 * consumer's undeclared attributes to, or each branch's element on a
 * discriminated surface - the interface also extends each element's
 * attributes, its declared names left out, and admits any `data-*` attribute,
 * so a consumer's `disabled`, `data-testid` or `@blur` type-checks under
 * `strictTemplates`. The `@vue-ignore` keeps them out of the runtime props, so
 * they still fall through as attributes.
 *
 * @example
 * propsInterface('TextInput', { value: { type: 'string' } }, 'input');
 * // export interface TextInputProps extends /* @vue-ignore *\/ Omit<IntrinsicElementAttributes['input'], 'value'>, ..., /* @vue-ignore *\/ Record<`data${Capitalize<string>}`, unknown> {
 * //   value?: string | undefined;
 * // }
 */
export function propsInterface(
  componentName: string,
  declaredProps: Record<string, PropDefinition>,
  attributesTags: string | string[] = [],
  routed?: { tag: string; entries: readonly string[] }
): string | undefined {
  const entries = Object.entries(declaredProps).map(([name, definition]) => {
    const member =
      definition.required === true
        ? `: ${definition.type}`
        : `?: ${optionalPropType(definition.type)}`;
    return [
      ...propDocumentation(
        definition,
        '  ',
        definition.default === undefined
          ? undefined
          : serializeJavaScriptValue(definition.default as JsonValue)
      ),
      `  ${objectKey(vuePropKey(name))}${member};`,
    ].join('\n');
  });
  const tags = [
    ...new Set(
      typeof attributesTags === 'string' ? [attributesTags] : attributesTags
    ),
  ];
  const ariaBase = hyphenatedAriaBase(declaredProps);
  if (tags.length === 0) {
    if (entries.length === 0) {
      return undefined;
    }
    const extended = ariaBase === undefined ? '' : ` extends ${ariaBase}`;
    return `export interface ${componentName}Props${extended} {\n${entries.join('\n')}\n}`;
  }
  const declaredNames = Object.keys(declaredProps);
  if (routed !== undefined && tags.length === 1) {
    return routedPropsInterface(
      componentName,
      tags[0],
      routed,
      declaredNames,
      entries,
      ariaBase
    );
  }
  // Vue types an input's `autocomplete` as a union of every autofill token,
  // which `defineProps` cannot infer the props through (TS2590, "union type
  // that is too complex"); it is taken out and typed as a string instead.
  const narrowsAutocomplete =
    tags.includes('input') && !declaredNames.includes('autocomplete');
  // An interface can extend only a named type with type arguments, never an
  // indexed access; every attribute is already optional, so `Partial` leaves
  // the type as it is and gives the bare case that form.
  const bases = tags.map((tag) => {
    const attributes = `IntrinsicElementAttributes['${tag}']`;
    const omitted = [
      ...declaredNames,
      ...(tag === 'input' && narrowsAutocomplete ? ['autocomplete'] : []),
    ];
    return omitted.length === 0
      ? `/* @vue-ignore */ Partial<${attributes}>`
      : `/* @vue-ignore */ Omit<${attributes}, ${omitted.map((name) => `'${name}'`).join(' | ')}>`;
  });
  if (narrowsAutocomplete) {
    bases.push(`/* @vue-ignore */ Partial<Record<'autocomplete', string>>`);
  }
  if (ariaBase !== undefined) {
    bases.push(ariaBase);
  }
  bases.push(DATA_ATTRIBUTES_BASE);
  const body = entries.length === 0 ? '{}' : `{\n${entries.join('\n')}\n}`;
  return `export interface ${componentName}Props extends ${bases.join(', ')} ${body}`;
}

/**
 * The props interface of a passthrough root with a routed element: two
 * `@vue-ignore` bases, the root's attributes without the routed keys and the
 * routed element's attributes for them, the routed keys held in a type alias.
 * An input's `autocomplete` is typed as a string, as on a passthrough input
 * root. The alias is exported, as the interface is: beside a plain
 * `<script>` block or with type parameters, Vue's language tools keep only
 * the leading imports and exported types of `<script setup>` at module
 * scope, and an `export` after any other statement fails to compile.
 */
function routedPropsInterface(
  componentName: string,
  rootTag: string,
  routed: { tag: string; entries: readonly string[] },
  declaredNames: readonly string[],
  entries: readonly string[],
  ariaBase: string | undefined
): string {
  const keys = `${componentName}RoutedKeys`;
  const surface = `keyof IntrinsicElementAttributes['${routed.tag}']`;
  const narrowsAutocomplete =
    routed.tag === 'input' &&
    !declaredNames.includes('autocomplete') &&
    (routed.entries.includes('*') || routed.entries.includes('autocomplete'));
  const excluded = [
    ...new Set([
      ...declaredNames,
      'class',
      'style',
      ...(routed.tag === 'input' ? ['autocomplete'] : []),
    ]),
  ]
    .map((name) => `'${name}'`)
    .join(' | ');
  const patterns = routed.entries.map((entry) =>
    entry === 'aria-*'
      ? '`aria-${string}`'
      : entry === 'on*'
        ? '`on${string}`'
        : `'${entry}'`
  );
  const keysType = routed.entries.includes('*')
    ? `Exclude<${surface}, ${excluded}>`
    : `Exclude<Extract<${surface}, ${patterns.join(' | ')}>, ${excluded}>`;
  const rootOmitted = [...declaredNames.map((name) => `'${name}'`), keys];
  // With '*' the root keeps only what the runtime leaves it: its class and
  // style, and data-* (the last base).
  const bases = [
    routed.entries.includes('*')
      ? `/* @vue-ignore */ Pick<IntrinsicElementAttributes['${rootTag}'], 'class' | 'style'>`
      : `/* @vue-ignore */ Omit<IntrinsicElementAttributes['${rootTag}'], ${rootOmitted.join(' | ')}>`,
    `/* @vue-ignore */ Pick<IntrinsicElementAttributes['${routed.tag}'], ${keys}>`,
    ...(narrowsAutocomplete
      ? [`/* @vue-ignore */ Partial<Record<'autocomplete', string>>`]
      : []),
    ...(ariaBase === undefined ? [] : [ariaBase]),
    DATA_ATTRIBUTES_BASE,
  ];
  const body = entries.length === 0 ? '{}' : `{\n${entries.join('\n')}\n}`;
  return `export type ${keys} = ${keysType};\n\nexport interface ${componentName}Props extends ${bases.join(', ')} ${body}`;
}

/**
 * Whether a prop's TypeScript type includes a Boolean-casting union member,
 * for the purposes of Vue's Boolean prop casting: the `boolean` keyword or a
 * literal `false`/`true` member. Vue's type-based `defineProps` resolves any
 * of these to a runtime types array containing `Boolean` (`boolean | string`
 * and `false | 'default'` both become `[Boolean, String]`), which sets the
 * Boolean-cast flag - so the absent prop is cast to `false` exactly as for a
 * pure `boolean` prop. Matching is textual on the authored type string: any
 * `|`-split member that is exactly `boolean`, `false`, or `true`. A quoted
 * `'false'`/`'true'` string literal stays unmatched (Vue resolves it to
 * `String` - no cast), as does a member nested inside a generic or
 * parenthesized type (`Array<boolean | string>` splits into fragments that
 * never equal a casting member, and Vue resolves the outer type without the
 * Boolean flag). A named type alias that expands to a boolean-containing
 * union is not visible in the type string and stays unmatched: an author
 * using one declares the `undefined` default explicitly.
 */
const BOOLEAN_CASTING_MEMBERS = new Set(['boolean', 'false', 'true']);

function includesBooleanType(type: string): boolean {
  return type
    .split('|')
    .some((part) => BOOLEAN_CASTING_MEMBERS.has(part.trim()));
}

/**
 * The default a prop is destructured with, as code, or `undefined` when it
 * takes none: its declared default, or an explicit `undefined` for an
 * optional prop Vue would otherwise Boolean-cast.
 */
function destructuredDefault(definition: PropDefinition): string | undefined {
  if (definition.default !== undefined) {
    return serializeJavaScriptValue(definition.default as JsonValue);
  }
  if (definition.required !== true && includesBooleanType(definition.type)) {
    return 'undefined';
  }
  return undefined;
}

/**
 * Renders the `defineProps` macro call with the declared props destructured
 * from it, so the component's script and template read each prop by its bare
 * name, as they do in the other scripted targets. Returns `undefined` when
 * no props are declared.
 *
 * - `const { label, variant = 'primary' } = defineProps<ButtonProps>();`
 *
 * Vue compiles the destructure reactively: every read of a destructured name
 * is a read of the live prop, and each inline default becomes the runtime
 * prop's default - an array or object default wrapped in a factory, so no two
 * instances share one value. The statement stays on one line while it fits
 * in 80 columns, and otherwise puts each prop on a line of its own.
 *
 * A prop whose name cannot be a local binding (`aria-pressed`, a reserved
 * word) is destructured under its camel-cased alias, with or without a
 * default (`ariaPressed = false`, `for: forProp`), the alias every target
 * gives it, so an expression reads it by one name. A hyphenated name is
 * declared under its camelized key ({@link vuePropKey}), which is what Vue
 * sets. `aliases`
 * gives each alias ({@link propAliases} over the whole component); by
 * default it is computed from the declared props alone.
 *
 * `defaultedProps` (by default the declared props) names the props whose
 * defaults are applied; a discriminated surface destructures every branch's
 * props but applies only the shared props' and the defaulted branch props'.
 *
 * An optional prop whose type includes a Boolean-casting member (pure
 * `boolean`, a `boolean` union member as in `boolean | string`, or a literal
 * `false`/`true` member as in `false | 'default'`) and that declares no
 * default is destructured with an explicit `undefined` default. Without it, Vue's Boolean casting
 * coerces the absent prop to `false`, diverging from React and Svelte (where
 * an absent optional prop is `undefined`); declaring any default - even
 * `undefined` - opts the prop out of the cast, restoring cross-target parity.
 * This matters for a controlled/uncontrolled sentinel prop, where
 * `value === undefined` is semantically distinct from `false`.
 *
 * @param componentName - The component name, which names the props type.
 * @param declaredProps - The props to destructure, in authored order.
 * @param defaultedProps - The props whose defaults are applied.
 * @param typeArguments - The props type's type arguments, as code
 *   (`<Item, Key>`), or `''` for a component without type parameters.
 * @param aliases - The alias of each prop whose name is not bindable.
 * @param omitted - The props left out of the destructure: a prop the script
 *   shadows that nothing in the output reads, whose alias would be an unused
 *   local. It stays declared in the props type.
 * @returns The statement, or `undefined` when no props are declared.
 * @example
 * definePropsStatement('Button', {
 *   label: { type: 'string', required: true },
 *   variant: { type: "'primary' | 'secondary'", default: 'primary' },
 * });
 * // const { label, variant = 'primary' } = defineProps<ButtonProps>();
 */
export function definePropsStatement(
  componentName: string,
  declaredProps: Record<string, PropDefinition>,
  defaultedProps: Record<string, PropDefinition> = declaredProps,
  typeArguments = '',
  aliases: ReadonlyMap<string, string> = propAliases(
    Object.keys(declaredProps)
  ),
  omitted: ReadonlySet<string> = new Set()
): string | undefined {
  if (Object.keys(declaredProps).length === 0) {
    return undefined;
  }

  const call = `defineProps<${componentName}Props${typeArguments}>()`;
  const entries: string[] = [];
  for (const name of Object.keys(declaredProps)) {
    if (omitted.has(name)) continue;
    const definition = defaultedProps[name];
    const defaultValue =
      definition === undefined ? undefined : destructuredDefault(definition);
    const initializer = defaultValue === undefined ? '' : ` = ${defaultValue}`;
    const local = aliases.get(name) ?? name;
    const key = vuePropKey(name);
    entries.push(
      key === local
        ? `${local}${initializer}`
        : `${objectKey(key)}: ${local}${initializer}`
    );
  }
  if (entries.length === 0) {
    return `${call};`;
  }
  const singleLine = `const { ${entries.join(', ')} } = ${call};`;
  if (singleLine.length <= 80) {
    return singleLine;
  }
  return `const {\n${entries.map((entry) => `  ${entry},`).join('\n')}\n} = ${call};`;
}
