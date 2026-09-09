import {
  normalizeExposes,
  normalizeNamedSlots,
  TemplateError,
} from '@js-template-engine/core';
import type { NormalizedExposedBinding } from '@js-template-engine/core';
import type {
  ExposedBinding,
  JsonValue,
  PropDefinition,
  TemplateNode,
} from '@js-template-engine/types';

import { serializeJavaScriptValue } from './literals';

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
 * The rest-attribute surface a passthrough root types its consumer props
 * against: a static intrinsic tag indexes `SvelteHTMLElements`, while a
 * dynamic or discriminated root - whose element is only known at runtime -
 * falls back to `HTMLAttributes<HTMLElement>`.
 */
export type RunesPassthroughSurface =
  | { kind: 'static'; tag: string }
  | { kind: 'dynamic' };

/**
 * Normalizes a slot name to a valid JavaScript identifier: kebab-case and
 * snake_case convert to camelCase (`navigation-menu` → `navigationMenu`),
 * and a leading digit is prefixed with an underscore (`123invalid` →
 * `_123invalid`).
 */
export function normalizeSlotName(name: string): string {
  const segments = name.split(/[^A-Za-z0-9$]+/).filter((segment) => segment !== '');
  const camelCased = segments
    .map((segment, index) =>
      index === 0
        ? segment
        : `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`
    )
    .join('');
  return /^\d/.test(camelCased) ? `_${camelCased}` : camelCased;
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
 * would lexically shadow the prop inside its own body.
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
  const projectedSnippetNames = new Set<string>();

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
            projectedSnippetNames.add('children');
          }
          if (node.children) {
            visit(node.children, `${nodePath}.children`);
          }
          for (const named of normalizeNamedSlots(node.slots)) {
            projectedSnippetNames.add(normalizeSlotName(named.name));
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
    ...projectedSnippetNames,
  ]);
  for (const snippetProp of snippetProps) {
    if (!projectedSnippetNames.has(snippetProp.propName)) {
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
 * bindable `element` DOM handle) when the component has one.
 */
function propsMembers(
  declaredProps: Record<string, PropDefinition>,
  snippetProps: SnippetProp[],
  passthrough: boolean
): string[] {
  const members: string[] = [];
  for (const [name, definition] of Object.entries(declaredProps)) {
    const optionalMarker = definition.required === true ? '' : '?';
    members.push(`  ${name}${optionalMarker}: ${definition.type};`);
  }
  for (const snippetProp of snippetProps) {
    members.push(`  ${snippetProp.propName}?: ${snippetPropType(snippetProp)};`);
  }
  if (passthrough) {
    members.push('  class?: string;', '  style?: string;', '  element?: HTMLElement;');
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
 */
export function runesPropsDeclaration(
  declaredProps: Record<string, PropDefinition>,
  snippetProps: SnippetProp[],
  passthrough?: RunesPassthroughSurface
): string | undefined {
  const members = propsMembers(declaredProps, snippetProps, passthrough !== undefined);
  if (passthrough !== undefined) {
    const base =
      passthrough.kind === 'static'
        ? `SvelteHTMLElements['${passthrough.tag}']`
        : 'HTMLAttributes<HTMLElement>';
    return `type Props = ${base} & {\n${members.join('\n')}\n};`;
  }
  if (members.length === 0) {
    return undefined;
  }
  return `interface Props {\n${members.join('\n')}\n}`;
}

/** How wide a single-line destructure may render before wrapping. */
const MAX_WIDTH = 80;

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
 * `undefined` when there is nothing to destructure.
 *
 * @param declaredProps - The component's declared props, in authored order.
 * @param snippetProps - The snippet props synthesized from the slots.
 * @param passthrough - Whether the component has a passthrough surface.
 */
export function runesPropsDestructure(
  declaredProps: Record<string, PropDefinition>,
  snippetProps: SnippetProp[],
  passthrough: boolean
): string | undefined {
  const entries = Object.entries(declaredProps).map(([name, definition]) => {
    if (definition.default !== undefined) {
      return `${name} = ${serializeJavaScriptValue(definition.default as JsonValue)}`;
    }
    if (definition.required === true) {
      return name;
    }
    return `${name} = undefined`;
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
  }
  if (entries.length === 0) {
    return undefined;
  }

  const singleLine = `let { ${entries.join(', ')} }: Props = $props();`;
  if (singleLine.length <= MAX_WIDTH) {
    return singleLine;
  }
  // A rest element may not carry a trailing comma.
  const trailingComma = passthrough ? '' : ',';
  return `let {\n  ${entries.join(',\n  ')}${trailingComma}\n}: Props = $props();`;
}
