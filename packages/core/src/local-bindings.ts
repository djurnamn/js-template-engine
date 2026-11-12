import type { PropDefinition, TemplateNode } from '@js-template-engine/types';

import { GENERATED_ID_NEXT_NAME, GENERATED_ID_NAME } from './declared-ids';
import { topLevelDeclarations } from './expression-scope';
import { isEngineReservedName } from './reserved-names';
import { visitNodes } from './traverse';

/**
 * Normalizes a slot name to the identifier its prop or snippet takes in
 * React and Svelte runes: kebab-case and snake_case convert to camelCase
 * (`navigation-menu` → `navigationMenu`), and a leading digit is prefixed
 * with an underscore (`123invalid` → `_123invalid`).
 *
 * @param name - The authored slot name.
 * @returns The identifier.
 */
export function normalizeSlotName(name: string): string {
  const segments = name
    .split(/[^A-Za-z0-9$]+/)
    .filter((segment) => segment !== '');
  const camelCased = segments
    .map((segment, index) =>
      index === 0
        ? segment
        : `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`
    )
    .join('');
  return /^\d/.test(camelCased) ? `_${camelCased}` : camelCased;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Whether a text is a JavaScript identifier.
 *
 * @param text - The text to test.
 * @returns `true` for an identifier, reserved words included.
 */
export function isIdentifier(text: string): boolean {
  return IDENTIFIER.test(text);
}

/** Words that cannot name a local binding in a module, which is strict code. */
const RESERVED_WORDS = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

/**
 * Whether a prop name can be destructured as a local binding of its own: an
 * identifier that is not a reserved word.
 *
 * @param name - The prop name.
 * @returns `false` for a name such as `aria-pressed`, `for` or `class`.
 */
export function isBindableName(name: string): boolean {
  return isIdentifier(name) && !RESERVED_WORDS.has(name);
}

/**
 * The local name a prop that cannot be bound under its own name is
 * destructured to: camel-cased (`aria-pressed` → `ariaPressed`), with a
 * `Prop` suffix while that is not a free identifier (`class` → `classProp`).
 * A name the engine's generated code declares (`bem`, `Tag2`, ...) or one of
 * `reserved` is never free.
 *
 * @param name - The prop name, one {@link isBindableName} rejects.
 * @param taken - The names already bound in the scope, which the alias
 *   avoids: the declared props and the aliases given before it.
 * @param reserved - The names the build's extensions declare in every
 *   component, which the alias avoids too.
 * @returns The alias.
 * @example
 * localAlias('aria-pressed', new Set(['aria-pressed'])); // 'ariaPressed'
 * localAlias('for', new Set(['for'])); // 'forProp'
 */
export function localAlias(
  name: string,
  taken: ReadonlySet<string>,
  reserved: ReadonlySet<string> = new Set()
): string {
  const words = name.split(/[^\w$]+/).filter((word) => word !== '');
  let alias = words
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');
  if (!isIdentifier(alias)) {
    alias = `_${alias}`;
  }
  while (
    !isBindableName(alias) ||
    isEngineReservedName(alias) ||
    reserved.has(alias) ||
    taken.has(alias)
  ) {
    alias = `${alias}Prop`;
  }
  return alias;
}

/**
 * A prop name camelized as Vue's runtime camelizes it, each `-` and the
 * letter after it becoming that letter upper-cased (`aria-pressed` →
 * `ariaPressed`): the key Vue declares and sets the prop under.
 *
 * @param name - The declared prop name.
 * @returns The camelized key; a name without `-` is returned as is.
 */
export function camelizePropName(name: string): string {
  return name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Every word of a component `script`, read loosely: the names it may declare,
 * and more.
 *
 * @param script - The component script, or `undefined` for none.
 * @returns The words.
 */
export function scriptWords(script: string | undefined): Set<string> {
  return new Set(script?.match(/[A-Za-z_$][\w$]*/g) ?? []);
}

/**
 * The names a component `script` declares at its top level: each `const`,
 * `let` or `var` binding (each identifier a destructuring pattern binds, not
 * its keys or defaults), each `function`, `class` and `enum` name, each
 * import binding and each legacy Svelte reactive declaration
 * (`$: name = ...`). Comments are skipped. A declaration inside a function
 * body, block or callback is that scope's own and is not read.
 *
 * @param script - The script, or `undefined` for none.
 * @returns The declared names.
 * @example
 * scriptDeclarations('const { open: isOpen = false } = props;\nfunction toggle() { let next = !isOpen; }');
 * // Set { 'isOpen', 'toggle' }
 */
export function scriptDeclarations(script: string | undefined): Set<string> {
  if (script === undefined) {
    return new Set();
  }
  const names = topLevelDeclarations(script);
  const source = script.replace(/\/\/[^\n]*|\/\*[^]*?\*\//g, ' ');
  for (const match of source.matchAll(
    /(?:^|[;\n])\s*\$:\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g
  )) {
    names.add(match[1]);
  }
  return names;
}

/** The parts of a component {@link propAliases} keeps an alias clear of. */
export interface PropAliasScope {
  /** The component's children, read for its slots. */
  children?: readonly TemplateNode[];
  /** The component `script`. */
  script?: string;
  /** The component-level extension overrides, read for their `script`s. */
  extensions?: Readonly<Record<string, unknown>>;
  /** The component's props, read for the names their two-way values take. */
  props?: Readonly<Record<string, PropDefinition>>;
  /** The component's derived values, read for their names. */
  derived?: Readonly<Record<string, unknown>>;
  /** The component's declared ids, read for their names. */
  ids?: Readonly<Record<string, unknown>>;
  /**
   * The names the build's extensions declare in every component, which an
   * alias steers clear of beside the engine's own generated names.
   */
  reservedNames?: ReadonlySet<string>;
}

/**
 * The local name each declared prop whose name is not bindable
 * ({@link isBindableName}) takes in every scripted target: its
 * {@link localAlias}, clear of the declared prop names, the prop names the
 * component's slots take in React and Svelte runes (`children`, the
 * camel-cased named slots), every word of the component `script` and of each
 * target's `script` override (so the alias never meets a name the script
 * declares, in whichever target), the names a two-way prop's `bindable`
 * object gives its value and setter, the component's derived value names,
 * its declared id names with the generated id's, and the aliases given
 * before it. Every
 * target asks with the same names, so an expression reads the prop by one
 * alias everywhere.
 *
 * @param propNames - Every declared prop name, in order: the shared props
 *   and then each discriminated branch's.
 * @param scope - The component's children, script and overrides.
 * @returns The alias of each prop that needs one, keyed by prop name.
 * @example
 * propAliases(['aria-pressed', 'label', 'for']);
 * // Map { 'aria-pressed' => 'ariaPressed', 'for' => 'forProp' }
 */
export function propAliases(
  propNames: readonly string[],
  scope: PropAliasScope = {}
): Map<string, string> {
  const taken = aliasTakenNames(propNames, scope);
  const aliases = new Map<string, string>();
  for (const name of propNames) {
    if (isBindableName(name) || aliases.has(name)) {
      continue;
    }
    const alias = localAlias(name, taken, scope.reservedNames);
    taken.add(alias);
    aliases.set(name, alias);
  }
  return aliases;
}

/**
 * The local name each declared prop takes in a target whose script declares
 * the prop's own local name at its top level, or imports it - Vue, where a setup binding of
 * a prop's name shadows the prop in the template: the prop is destructured
 * under an alias clear of every name {@link propAliases} avoids and of the
 * aliases already given, so the script's binding keeps the name and the
 * template reads it, as it reads any setup binding over a prop. A
 * declaration inside a function or block of the script is not read.
 *
 * @param propNames - Every declared prop name, in order.
 * @param scripts - The code that shares the props' scope: the component
 *   `script` with the target's `script` override, and the import statements,
 *   whose bindings count as declarations.
 * @param aliases - The aliases {@link propAliases} gave.
 * @param scope - The component's children, script and overrides.
 * @returns The alias of each prop a script shadows, keyed by prop name.
 * @example
 * scriptShadowedPropAliases(['value', 'label'], ['const value = computed(() => 1);'], new Map());
 * // Map { 'value' => 'valueProp' }
 */
export function scriptShadowedPropAliases(
  propNames: readonly string[],
  scripts: ReadonlyArray<string | undefined>,
  aliases: ReadonlyMap<string, string>,
  scope: PropAliasScope = {}
): Map<string, string> {
  const declared = new Set<string>();
  for (const script of scripts) {
    if (typeof script === 'string') {
      for (const name of topLevelDeclarations(script)) {
        declared.add(name);
      }
    }
  }
  const shadowed = new Map<string, string>();
  if (declared.size === 0) {
    return shadowed;
  }
  const taken = aliasTakenNames(propNames, scope);
  for (const name of [...aliases.values(), ...declared]) {
    taken.add(name);
  }
  for (const name of propNames) {
    const local = aliases.get(name) ?? name;
    if (!declared.has(local) || shadowed.has(name)) {
      continue;
    }
    const alias = localAlias(local, taken, scope.reservedNames);
    taken.add(alias);
    shadowed.set(name, alias);
  }
  return shadowed;
}

/**
 * The names a prop alias stays clear of: the declared prop names, the slot
 * prop names, every word of the component's scripts and the names two-way
 * props give their value and setter.
 */
function aliasTakenNames(
  propNames: readonly string[],
  scope: PropAliasScope
): Set<string> {
  const taken = new Set(propNames);
  visitNodes(scope.children ?? [], '', (node) => {
    if (node.type === 'slot') {
      taken.add(
        node.name === undefined ? 'children' : normalizeSlotName(node.name)
      );
    }
  });
  const scripts = [
    scope.script,
    ...Object.values(scope.extensions ?? {}).map((override) =>
      typeof override === 'object' && override !== null
        ? (override as { script?: unknown }).script
        : undefined
    ),
  ];
  for (const script of scripts) {
    if (typeof script === 'string') {
      for (const word of scriptWords(script)) {
        taken.add(word);
      }
    }
  }
  for (const definition of Object.values(scope.props ?? {})) {
    const bindable: unknown = definition?.bindable;
    if (typeof bindable === 'object' && bindable !== null) {
      for (const field of ['current', 'setter'] as const) {
        const name = (bindable as Record<string, unknown>)[field];
        if (typeof name === 'string') {
          taken.add(name);
        }
      }
    }
  }
  for (const name of Object.keys(scope.derived ?? {})) {
    taken.add(name);
  }
  // A declared id is read by its name, beside the instance's own generated
  // id and legacy Svelte's counter.
  const idNames = Object.keys(scope.ids ?? {});
  if (idNames.length > 0) {
    for (const name of [
      ...idNames,
      GENERATED_ID_NAME,
      GENERATED_ID_NEXT_NAME,
    ]) {
      taken.add(name);
    }
  }
  return taken;
}
