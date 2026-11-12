import {
  normalizeExposes,
  normalizeNamedSlots,
  TemplateError,
} from '@js-template-engine/core';
import {
  isBindableDefinition,
  normalizeSlotName,
  optionalPropType,
  propAliases,
  propDocumentation,
} from '@js-template-engine/core/emitter';
import type { NormalizedExposedBinding } from '@js-template-engine/core';
import type {
  ExposedBinding,
  JsonValue,
  PropDefinition,
  TemplateNode,
} from '@js-template-engine/types';

import { objectKey, serializeJavaScriptValue } from './literals';

/** A snippet prop synthesized from a slot, for the runes props surface. */
export interface SnippetProp {
  /** The authored slot name; `undefined` for the default slot. */
  slotName: string | undefined;
  /** The normalized prop name; `'children'` for the default slot. */
  propName: string;
  /**
   * The local binding the prop destructures to and the markup references.
   * Normally the prop name itself; when a projected snippet declaration
   * (`{#snippet <name>}` filling a composed child's slot, or the
   * `{#snippet children}` block a `slotScope` consumer renders) shares the
   * name, the prop destructures under a `<propName>Slot` alias instead - a
   * snippet declaration is a lexical binding, so inside its own body it
   * would shadow the same-named prop and a slot rendered there would test
   * and `{@render}` the snippet itself, recursing forever.
   */
  localName: string;
  /**
   * The runtime values the slot exposes (a scoped slot), typing its snippet
   * with one object parameter. Empty for an ordinary slot (a bare `Snippet`).
   */
  exposes: NormalizedExposedBinding[];
}

/**
 * The consumer surface a passthrough root types: the attributes its rest
 * admits and the element its `element` handle binds, each a TypeScript type
 * expression. A static root indexes `SvelteHTMLElements` by its tag, a dynamic
 * root by its default, and a discriminated root takes the union of its
 * branches.
 */
export interface PassthroughSurfaceTypes {
  /** The rest attributes, e.g. `SvelteHTMLElements['button']`. */
  attributes: string;
  /** The bound element, e.g. `HTMLElementTagNameMap['button']`. */
  element: string;
  /**
   * A type declaration the attributes read, written before `Props`: the
   * alias of a routed element's keys.
   */
  declaration?: string;
}

/**
 * Collects the snippet props synthesized from a component's slots, in
 * document order, deduplicated by slot name (a slot rendered in several
 * conditional branches is one prop).
 *
 * Two slots whose names normalize to the same prop name, or a slot whose
 * prop name collides with a declared prop, are processing errors - the same
 * rule the React extension applies, since snippet props share the prop
 * namespace exactly as React's slot props do.
 *
 * A snippet prop whose name is also the name of a projected snippet the
 * component declares (a named-slot projection into a composed child, or the
 * `children` snippet of a `slotScope` consumer) receives an aliased
 * {@link SnippetProp.localName}, since the projected snippet declaration
 * would lexically shadow the prop inside its own body. The same holds for a
 * local binding of the prop's name - an iteration's `item` or `index`, or a
 * `slotScope` binding - which shadows the prop inside its loop or snippet.
 *
 * @param children - The component's template nodes.
 * @param declaredProps - The component's declared props.
 * @returns The snippet props in document order.
 */
export function collectSnippetProps(
  children: TemplateNode[],
  declaredProps: Record<string, PropDefinition>
): SnippetProp[] {
  const snippetProps: SnippetProp[] = [];
  const byPropName = new Map<string, SnippetProp>();
  // The names of the snippet declarations the component's markup emits when
  // it fills a composed child's slots: `{#snippet <name>}` per projected
  // named slot, plus `{#snippet children}` for a `slotScope` consumer.
  // Also the local bindings the markup declares (iteration items and
  // indexes, received slot-scope bindings): each shadows a snippet prop of
  // the same name inside its loop or snippet.
  const shadowingNames = new Set<string>();

  const registerSlot = (
    slotName: string | undefined,
    exposes: Record<string, ExposedBinding> | undefined,
    nodePath: string
  ): void => {
    const propName =
      slotName === undefined ? 'children' : normalizeSlotName(slotName);
    const existing = byPropName.get(propName);
    if (existing !== undefined) {
      if (existing.slotName !== slotName) {
        throw new TemplateError(
          `Slots '${existing.slotName ?? '(default)'}' and '${slotName ?? '(default)'}' both normalize to the Svelte snippet prop '${propName}'`,
          nodePath
        );
      }
      return;
    }
    if (propName in declaredProps) {
      throw new TemplateError(
        `The slot '${slotName ?? '(default)'}' collides with the declared prop '${propName}'`,
        nodePath
      );
    }
    const snippetProp: SnippetProp = {
      slotName,
      propName,
      localName: propName,
      exposes: normalizeExposes(exposes),
    };
    byPropName.set(propName, snippetProp);
    snippetProps.push(snippetProp);
  };

  const visit = (nodes: TemplateNode[], path: string): void => {
    nodes.forEach((node, index) => {
      const nodePath = path === '' ? `[${index}]` : `${path}[${index}]`;
      switch (node.type) {
        case 'element':
          if (node.slotScope !== undefined && node.slotScope.length > 0) {
            shadowingNames.add('children');
            node.slotScope.forEach((name) => shadowingNames.add(name));
          }
          if (node.children) {
            visit(node.children, `${nodePath}.children`);
          }
          for (const named of normalizeNamedSlots(node.slots)) {
            shadowingNames.add(normalizeSlotName(named.name));
            named.slotScope.forEach((name) => shadowingNames.add(name));
            visit(named.content, `${nodePath}.slots.${named.name}`);
          }
          break;
        case 'fragment':
          visit(node.children, `${nodePath}.children`);
          break;
        case 'conditional':
          node.conditions.forEach((branch, branchIndex) => {
            visit(
              branch.children,
              `${nodePath}.conditions[${branchIndex}].children`
            );
          });
          break;
        case 'iteration':
          shadowingNames.add(node.item);
          if (node.index !== undefined) {
            shadowingNames.add(node.index);
          }
          visit(node.children, `${nodePath}.children`);
          break;
        case 'slot':
          registerSlot(node.name, node.exposes, nodePath);
          if (node.fallback) {
            visit(node.fallback, `${nodePath}.fallback`);
          }
          break;
        default:
          break;
      }
    });
  };

  visit(children, '');

  // Alias every snippet prop a projected snippet declaration would shadow.
  // The alias appends `Slot` (`icon` -> `iconSlot`) and extends until free of
  // the declared props, the other snippet props, and the projected names -
  // an alias equal to a projected name would be shadowed all over again.
  const takenNames = new Set<string>([
    ...Object.keys(declaredProps),
    ...snippetProps.map((snippetProp) => snippetProp.propName),
    ...shadowingNames,
  ]);
  for (const snippetProp of snippetProps) {
    if (!shadowingNames.has(snippetProp.propName)) {
      continue;
    }
    let aliasCandidate = `${snippetProp.propName}Slot`;
    while (takenNames.has(aliasCandidate)) {
      aliasCandidate = `${aliasCandidate}Slot`;
    }
    takenNames.add(aliasCandidate);
    snippetProp.localName = aliasCandidate;
  }

  return snippetProps;
}

/**
 * The type of a snippet prop: a bare `Snippet` for an ordinary slot, or
 * `Snippet<[{ ... }]>` for a scoped slot - the exposed bindings bundle into
 * one object parameter, each typed as its declared `type` or `any`.
 */
export function snippetPropType(snippetProp: SnippetProp): string {
  if (snippetProp.exposes.length === 0) {
    return 'Snippet';
  }
  const scope = snippetProp.exposes
    .map((binding) => `${binding.name}: ${binding.type ?? 'any'}`)
    .join('; ');
  return `Snippet<[{ ${scope} }]>`;
}

/**
 * The `Props` member lines shared by the interface and the passthrough
 * intersection: declared props in authored order, snippet props in document
 * order, then the passthrough consumer surface (`class`, `style`, and the
 * bindable `element` DOM handle) when the component has one. Each optional
 * member is typed `?: T | undefined` ({@link optionalPropType}), so a
 * consumer compiling with `exactOptionalPropertyTypes` can pass `undefined`.
 */
function propsMembers(
  declaredProps: Record<string, PropDefinition>,
  snippetProps: SnippetProp[],
  passthrough: PassthroughSurfaceTypes | undefined
): string[] {
  const members: string[] = [];
  for (const [name, definition] of Object.entries(declaredProps)) {
    const required = definition.required === true;
    members.push(
      ...propDocumentation(
        definition,
        '  ',
        definition.default === undefined
          ? undefined
          : serializeJavaScriptValue(definition.default as JsonValue)
      )
    );
    members.push(
      required
        ? `  ${objectKey(name)}: ${definition.type};`
        : `  ${objectKey(name)}?: ${optionalPropType(definition.type)};`
    );
  }
  for (const snippetProp of snippetProps) {
    members.push(
      `  ${snippetProp.propName}?: ${snippetPropType(snippetProp)} | undefined;`
    );
  }
  if (passthrough !== undefined) {
    members.push(
      '  class?: string | undefined;',
      '  style?: string | undefined;',
      `  element?: ${optionalPropType(passthrough.element)};`
    );
  }
  return members;
}

/**
 * Renders the `Props` declaration for a runes component: an
 * `interface Props { ... }` from the declared and snippet props, or - for a
 * passthrough surface root - a `type Props = <rest surface> & { ... };`
 * intersection admitting the consumer's arbitrary attributes. Returns
 * `undefined` when there is nothing to declare.
 *
 * @param declaredProps - The component's declared props, in authored order.
 * @param snippetProps - The snippet props synthesized from the slots.
 * @param passthrough - The passthrough rest surface, if the component has one.
 * @param restAttributes - The type of a `rest` declaration's leftover
 *   attributes, if the component declares one.
 */
export function runesPropsDeclaration(
  declaredProps: Record<string, PropDefinition>,
  snippetProps: SnippetProp[],
  passthrough?: PassthroughSurfaceTypes,
  restAttributes?: string
): string | undefined {
  const members = propsMembers(declaredProps, snippetProps, passthrough);
  if (passthrough !== undefined) {
    const props = `type Props = ${passthrough.attributes} & {\n${members.join('\n')}\n};`;
    return passthrough.declaration === undefined
      ? props
      : `${passthrough.declaration}\n\n${props}`;
  }
  if (restAttributes !== undefined) {
    return members.length === 0
      ? `type Props = ${restAttributes};`
      : `type Props = ${restAttributes} & {\n${members.join('\n')}\n};`;
  }
  if (members.length === 0) {
    return undefined;
  }
  return `interface Props {\n${members.join('\n')}\n}`;
}

/** How wide a single-line destructure may render before wrapping. */
const MAXIMUM_WIDTH = 80;

/**
 * The identifier the passthrough rest gathers into (`...restProperties`) -
 * the spread in the markup and the event composition on a surface root both
 * reference it.
 */
export const REST_PROPERTIES_NAME = 'restProperties';

/**
 * Renders the `$props()` destructure for a runes component:
 * `let { label, variant = 'primary' }: Props = $props();`. A required prop
 * destructures bare, a default appends `= <value>`, and an optional prop
 * without one appends the explicit `= undefined`. A snippet prop destructures
 * bare under its prop name, or under its `<propName>Slot` alias when a
 * same-named projected snippet would shadow it. For a passthrough surface
 * root the consumer surface follows the props - `class` renamed to
 * `className`, `style`, the `element` DOM handle made bindable with
 * `$bindable(undefined)` (so consumers may `bind:element`), and the
 * undeclared rest gathered into `...restProperties` for the spread. Returns
 * `undefined` when there is nothing to destructure. A two-way prop
 * (`bindable` object) destructures as `$bindable()`, without a fallback. A
 * prop whose name cannot be a local binding destructures under its alias
 * (`'aria-pressed': ariaPressed = false`), from `aliases`.
 *
 * @param declaredProps - The component's declared props, in authored order.
 * @param snippetProps - The snippet props synthesized from the slots.
 * @param passthrough - Whether the component has a passthrough surface.
 * @param rest - Whether the component declares `rest`, gathering the leftover
 *   attributes into `...rest` for the author to place.
 * @param aliases - The alias of each prop whose name is not bindable
 *   ({@link propAliases} over the whole component).
 */
export function runesPropsDestructure(
  declaredProps: Record<string, PropDefinition>,
  snippetProps: SnippetProp[],
  passthrough: boolean,
  rest = false,
  aliases: ReadonlyMap<string, string> = propAliases(Object.keys(declaredProps))
): string | undefined {
  const entries = Object.entries(declaredProps).map(([name, definition]) => {
    const value =
      definition.default !== undefined
        ? serializeJavaScriptValue(definition.default as JsonValue)
        : undefined;
    // A name that cannot be a local binding destructures under its alias.
    const alias = aliases.get(name);
    const binding = alias === undefined ? name : `${objectKey(name)}: ${alias}`;
    // A bindable prop is declared to Svelte with `$bindable`, its default
    // inside, so a consumer's `bind:` compiles and follows the component.
    if (definition.bindable === true) {
      return `${binding} = $bindable(${value ?? (definition.required === true ? '' : 'undefined')})`;
    }
    // A two-way prop takes no fallback: `undefined` leaves the value to the
    // component, and Svelte rejects `bind:` to `undefined` on a prop with one.
    if (isBindableDefinition(definition.bindable)) {
      return `${binding} = $bindable()`;
    }
    if (value !== undefined) {
      return `${binding} = ${value}`;
    }
    if (definition.required === true) {
      return binding;
    }
    return `${binding} = undefined`;
  });
  // A snippet prop shadowed by a same-named projected snippet destructures
  // under its alias (`icon: iconSlot`); the markup references the alias.
  entries.push(
    ...snippetProps.map((snippetProp) =>
      snippetProp.localName === snippetProp.propName
        ? snippetProp.propName
        : `${snippetProp.propName}: ${snippetProp.localName}`
    )
  );
  if (passthrough) {
    entries.push(
      'class: className = undefined',
      'style = undefined',
      'element = $bindable(undefined)',
      `...${REST_PROPERTIES_NAME}`
    );
  } else if (rest) {
    entries.push('...rest');
  }
  if (entries.length === 0) {
    return undefined;
  }

  const singleLine = `let { ${entries.join(', ')} }: Props = $props();`;
  if (singleLine.length <= MAXIMUM_WIDTH) {
    return singleLine;
  }
  // A rest element may not carry a trailing comma.
  const trailingComma = passthrough || rest ? '' : ',';
  return `let {\n  ${entries.join(',\n  ')}${trailingComma}\n}: Props = $props();`;
}
