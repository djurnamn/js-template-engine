import type {
  ConditionalBranch,
  ConditionalNode,
  ElementNode,
  PropDefinition,
  TemplateNode,
} from '@js-template-engine/types';

import { staticTagOf } from './dynamic-tag';

/**
 * Prop names the passthrough surface contract reserves. A component with a
 * passthrough node may not declare a prop - or a slot whose name resolves to
 * a prop - under any of these: `class`/`className` and `style` are the
 * consumer-supplied values the surface merges, and `ref`/`element` are the
 * DOM-handle names the scripted targets generate (React's ref-as-prop,
 * Svelte's bindable `element`). Reserved on every target so a kit built for
 * all of them stays coherent.
 */
export const RESERVED_PASSTHROUGH_PROPS: readonly string[] = [
  'class',
  'className',
  'style',
  'ref',
  'element',
];

/**
 * Returns the component's passthrough surface root - the single top-level
 * element a consumer's props/attributes spread onto - or `undefined` when no
 * element sets `passthrough`.
 *
 * Returns the node only when it is well-formed per the surface contract: the
 * sole rendered (non-comment) top-level child, or the element a conditional
 * passthrough root renders (see {@link conditionalPassthroughOf}), set on
 * exactly one element in the tree, with an intrinsic HTML tag. A malformed
 * passthrough (a second flagged node, a nested or non-single root, a
 * component-reference tag) is a validation error caught upstream by
 * `validateTemplate`, so renderers can treat a returned node as
 * authoritative.
 */
export function passthroughNodeOf(
  children: readonly TemplateNode[]
): ElementNode | undefined {
  const rendered = children.filter((node) => node.type !== 'comment');
  if (rendered.length !== 1) {
    return undefined;
  }
  const root = rendered[0];
  if (root.type === 'element' && root.passthrough === true) {
    return root;
  }
  return conditionalPassthroughOf(children)?.element;
}

/**
 * A conditional passthrough root: a single root `conditional` whose `if`
 * branch renders one `passthrough` element and whose only other branch, if
 * any, is an `else` that renders nothing. While the condition is false the
 * component renders nothing at all; while it is true the element is the
 * component's passthrough root, as if it stood alone.
 */
export interface ConditionalPassthrough {
  /** The root conditional. */
  conditional: ConditionalNode;
  /** The `if` branch's single passthrough element. */
  element: ElementNode;
}

/** The nodes a list renders, leaving out comments. */
function renderedOf(nodes: readonly TemplateNode[]): TemplateNode[] {
  return nodes.filter((node) => node.type !== 'comment');
}

/**
 * Returns the component's conditional passthrough root, or `undefined` when
 * the root is not one.
 *
 * The root qualifies when it is the sole rendered (non-comment) top-level
 * child, is a `conditional` whose `if` branch renders exactly one element
 * that sets `passthrough`, and has at most one more branch: an `else` that
 * renders nothing. Any other shape returns `undefined`, and
 * `validateTemplate` reports a passthrough element inside it.
 *
 * @param children - A component's top-level children.
 * @returns The root conditional and its passthrough element, or `undefined`.
 *
 * @example
 * conditionalPassthroughOf([
 *   {
 *     type: 'conditional',
 *     conditions: [
 *       {
 *         statement: 'if',
 *         condition: 'open',
 *         children: [{ type: 'element', tag: 'div', passthrough: true }],
 *       },
 *     ],
 *   },
 * ]);
 * // { conditional: { type: 'conditional', ... }, element: { tag: 'div', ... } }
 */
export function conditionalPassthroughOf(
  children: readonly TemplateNode[]
): ConditionalPassthrough | undefined {
  const rendered = renderedOf(children);
  if (rendered.length !== 1) {
    return undefined;
  }
  const root = rendered[0];
  if (root.type !== 'conditional' || root.conditions.length > 2) {
    return undefined;
  }
  const [first, second] = root.conditions;
  if (first === undefined || first.statement !== 'if') {
    return undefined;
  }
  if (
    second !== undefined &&
    (second.statement !== 'else' || renderedOf(second.children).length > 0)
  ) {
    return undefined;
  }
  const branchRendered = renderedOf(first.children);
  if (branchRendered.length !== 1) {
    return undefined;
  }
  const element = branchRendered[0];
  if (element.type !== 'element' || element.passthrough !== true) {
    return undefined;
  }
  return { conditional: root, element };
}

/** One branch of a discriminated surface root. */
export interface DiscriminatedSurfaceBranch {
  /** The conditional branch (carries `condition` and per-branch `props`). */
  branch: ConditionalBranch;
  /** The branch's single passthrough surface element. */
  element: ElementNode;
  /** The element's intrinsic tag (the typed-surface and ref basis). */
  tag: string;
}

/**
 * A discriminated surface root: a single root `conditional` whose every branch
 * renders one `passthrough` element, each of a (typically different) intrinsic
 * tag. The component's prop surface is the discriminated union of the branches
 * - each contributes its element's typed surface plus the branch's own `props`
 * (the discriminant as a literal type). Selected at runtime by the branch
 * conditions; a consumer reaches whichever element renders.
 */
export interface DiscriminatedSurface {
  /** The root conditional. */
  conditional: ConditionalNode;
  /** Each branch's surface element, in authored order. */
  branches: DiscriminatedSurfaceBranch[];
}

/**
 * Returns the component's discriminated surface root, or `undefined` when the
 * root is not one.
 *
 * The root qualifies when it is the sole rendered (non-comment) top-level
 * child, is a `conditional` with at least two branches, and every branch
 * renders exactly one element that sets `passthrough`. A malformed shape (a
 * branch with multiple or non-passthrough roots) returns `undefined`, falling
 * back to single-root passthrough handling where `validateTemplate` reports
 * the authoring error.
 */
export function discriminatedSurfaceOf(
  children: readonly TemplateNode[]
): DiscriminatedSurface | undefined {
  const rendered = children.filter((node) => node.type !== 'comment');
  if (rendered.length !== 1) {
    return undefined;
  }
  const root = rendered[0];
  if (root.type !== 'conditional' || root.conditions.length < 2) {
    return undefined;
  }

  const branches: DiscriminatedSurfaceBranch[] = [];
  for (const branch of root.conditions) {
    const branchRendered = branch.children.filter(
      (node) => node.type !== 'comment'
    );
    if (branchRendered.length !== 1) {
      return undefined;
    }
    const element = branchRendered[0];
    if (element.type !== 'element' || element.passthrough !== true) {
      return undefined;
    }
    branches.push({ branch, element, tag: staticTagOf(element.tag) });
  }

  return { conditional: root, branches };
}

/**
 * How a discriminated surface root's `if`/`else-if` condition picks its branch
 * and narrows the props union.
 *
 * - `literal`: the condition is the bare prop name, typed as truthy literals
 *   (`true`, `'link'`) in the branch it picks and as falsy ones (`false`) in
 *   the branches after it. The condition tests truthiness, and React's union
 *   narrows on it.
 * - `presence`: the condition is `<name> !== undefined`; the branch it picks
 *   requires the prop, and every other branch leaves it out or types it
 *   `undefined`. Every target tests `<name> !== undefined`, and React types
 *   the prop `?: undefined` on the other members.
 */
export interface Discriminant {
  /** The prop the condition reads. */
  name: string;
  /** How the condition picks its branch. */
  kind: 'literal' | 'presence';
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const PRESENCE_CONDITION = /^([A-Za-z_$][\w$]*)\s*!==\s*undefined$/;

/**
 * Splits a prop type into its top-level union members, trimmed. A `|` inside
 * brackets, braces, angle brackets or quotes stays in its member; a member
 * wrapped whole in parentheses is split in turn, so `(true)` reads as `true`
 * and `('a' | 'b') | null` as three members.
 *
 * @param type - A prop's `type` string, such as `"'a' | 'b'"`.
 * @returns The members, such as `["'a'", "'b'"]`.
 */
export function unionMembersOf(type: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = '';
  for (const character of type) {
    if (quote !== undefined) {
      current += character;
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if ('([{<'.includes(character)) {
      depth += 1;
    } else if (')]}>'.includes(character) && depth > 0) {
      depth -= 1;
    } else if (character === '|' && depth === 0) {
      members.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  members.push(current.trim());
  return members
    .filter((member) => member !== '')
    .flatMap((member) => {
      const inner = parenthesisedInner(member);
      return inner === undefined ? [member] : unionMembersOf(inner);
    });
}

/** The inside of a member wrapped whole in one pair of parentheses, or
 *  `undefined` when its first parenthesis closes before its end (`(a) => b`). */
function parenthesisedInner(member: string): string | undefined {
  if (!member.startsWith('(') || !member.endsWith(')')) return undefined;
  let depth = 0;
  let quote: string | undefined;
  for (let i = 0; i < member.length; i++) {
    const character = member[i];
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0 && i < member.length - 1) return undefined;
    }
  }
  return member.slice(1, -1);
}

/** A type member that is always truthy: `true`, a non-empty string literal,
 *  a non-zero number literal. */
function isTruthyLiteral(member: string): boolean {
  if (member === 'true') return true;
  if (/^(['"])(.+)\1$/.test(member)) return true;
  if (/^`[^`$]+`$/.test(member)) return true;
  return /^-?\d+(\.\d+)?$/.test(member) && Number(member) !== 0;
}

/** A type member that is always falsy: `false`, `undefined`, `null`, `''`,
 *  `0`. */
function isFalsyLiteral(member: string): boolean {
  return /^(false|undefined|null|''|""|``|-?0(\.0+)?)$/.test(member);
}

/**
 * Whether every member of a prop type is a truthy literal, so a truthiness
 * check on the prop narrows to the branch typing it so.
 *
 * @param type - A prop's `type` string.
 * @returns `true` for `'true'`, `'(true)'` or `"'link' | 'button'"`, `false`
 *   for `'string'`.
 */
export function isTruthyLiteralType(type: string): boolean {
  const members = unionMembersOf(type);
  return members.length > 0 && members.every(isTruthyLiteral);
}

/**
 * Whether every member of a prop type is a falsy literal, so a truthiness
 * check on the prop excludes the branch typing it so.
 *
 * @param type - A prop's `type` string.
 * @returns `true` for `'false'` or `'false | undefined'`, `false` for `'boolean'`.
 */
export function isFalsyLiteralType(type: string): boolean {
  const members = unionMembersOf(type);
  return members.length > 0 && members.every(isFalsyLiteral);
}

/**
 * Whether a prop type has a `boolean`, `true` or `false` member. Vue casts
 * such a prop to `false` when it is left out, so a presence test on it would
 * always pick its branch.
 *
 * @param type - A prop's `type` string.
 */
export function hasBooleanMember(type: string): boolean {
  return unionMembersOf(type).some(
    (member) => member === 'boolean' || member === 'true' || member === 'false'
  );
}

/**
 * Reads a discriminated surface root branch's condition as a discriminant:
 * the prop it reads and how it picks its branch. Returns `undefined` for an
 * `else` branch and for a condition that is neither the bare name of a prop
 * the branch types as truthy literals nor `<name> !== undefined`.
 *
 * @param branch - A branch of the discriminated surface root's conditional.
 * @returns The discriminant, or `undefined`.
 *
 * @example
 * discriminantOf({
 *   statement: 'if',
 *   condition: 'href !== undefined',
 *   props: { href: { type: 'string', required: true } },
 *   children: [],
 * });
 * // { name: 'href', kind: 'presence' }
 */
export function discriminantOf(
  branch: ConditionalBranch
): Discriminant | undefined {
  if (branch.statement === 'else') {
    return undefined;
  }
  const condition = (branch.condition ?? '').trim();
  const presence = PRESENCE_CONDITION.exec(condition);
  if (presence !== null) {
    return { name: presence[1], kind: 'presence' };
  }
  if (!IDENTIFIER.test(condition)) {
    return undefined;
  }
  const type = branch.props?.[condition]?.type;
  return type !== undefined && isTruthyLiteralType(type)
    ? { name: condition, kind: 'literal' }
    : undefined;
}

/**
 * The flat prop projection of a discriminated surface root - the looser
 * equivalent of React's discriminated union, for targets without per-branch
 * prop typing (Vue, Svelte). Shared props pass through unchanged; each branch
 * prop is merged across branches: its `type` is the union of the branch types
 * (the discriminant collapses to `true | false`), and it is `required` only
 * when present and required in **every** branch. Its `default` and
 * `documentedDefault` carry over where every branch that declares the prop
 * agrees on them; where branches differ, none of them speaks for it. Its
 * `description` is the one the branches giving the prop a value agree on - a
 * branch typing it `undefined` (a presence discriminant's absent side) speaks
 * only when no other branch describes it - so the flat prop is documented as
 * React's branches are.
 *
 * A format-level derivation: pure `PropDefinition` in and out, no framework
 * syntax. Each target formats the result its own way (Svelte `export let`, Vue
 * `interface`). Single-sources the merge semantics so they cannot drift between
 * extensions.
 */
export function flattenDiscriminatedProps(
  sharedProps: Record<string, PropDefinition>,
  branchProps: ReadonlyArray<Record<string, PropDefinition>>
): Record<string, PropDefinition> {
  const merged: Record<string, PropDefinition> = { ...sharedProps };

  const accumulated = new Map<
    string,
    {
      types: string[];
      requiredCount: number;
      appearances: number;
      definitions: PropDefinition[];
    }
  >();
  for (const props of branchProps) {
    for (const [name, definition] of Object.entries(props)) {
      const entry = accumulated.get(name) ?? {
        types: [],
        requiredCount: 0,
        appearances: 0,
        definitions: [],
      };
      entry.definitions.push(definition);
      if (!entry.types.includes(definition.type)) {
        entry.types.push(definition.type);
      }
      if (definition.required === true) {
        entry.requiredCount += 1;
      }
      entry.appearances += 1;
      accumulated.set(name, entry);
    }
  }

  const branchCount = branchProps.length;
  for (const [name, entry] of accumulated) {
    merged[name] = {
      type: entry.types.join(' | '),
      required:
        entry.appearances === branchCount &&
        entry.requiredCount === branchCount,
      ...agreedDescription(entry.definitions),
      ...agreed(entry.definitions, 'default'),
      ...agreed(entry.definitions, 'documentedDefault'),
    };
  }
  return merged;
}

/** The description the branches describing a prop give alike, as one entry
 *  to spread: those giving it a value when any of them describes it, else
 *  those typing it `undefined`; none when they differ. A branch leaving the
 *  description out does not object. */
function agreedDescription(
  definitions: PropDefinition[]
): Partial<Pick<PropDefinition, 'description'>> {
  const described = definitions.filter(
    (definition) => definition.description !== undefined
  );
  const valued = described.filter(
    (definition) => definition.type.trim() !== 'undefined'
  );
  const speaking = valued.length > 0 ? valued : described;
  if (speaking.length === 0) return {};
  const first = speaking[0].description;
  return speaking.every((definition) => definition.description === first)
    ? { description: first }
    : {};
}

/** A field every branch's definition of a prop gives alike, as one entry to
 *  spread, or none when a branch leaves it out or they differ. */
function agreed<Key extends 'description' | 'default' | 'documentedDefault'>(
  definitions: PropDefinition[],
  key: Key
): Partial<Pick<PropDefinition, Key>> {
  const first = definitions[0][key];
  if (first === undefined) return {};
  const same = definitions.every(
    (definition) => JSON.stringify(definition[key]) === JSON.stringify(first)
  );
  return same ? ({ [key]: first } as Partial<Pick<PropDefinition, Key>>) : {};
}
