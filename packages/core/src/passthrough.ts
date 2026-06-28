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
 * DOM-handle names the framework targets generate (React's ref-as-prop,
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
 * sole rendered (non-comment) top-level child, set on exactly one element in
 * the tree, with an intrinsic HTML tag. A malformed passthrough (a second
 * flagged node, a nested or non-single root, a component-reference tag) is a
 * validation error caught upstream by `validateTemplate`, so renderers can
 * treat a returned node as authoritative.
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
  return undefined;
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
 * The flat prop projection of a discriminated surface root - the looser
 * equivalent of React's discriminated union, for targets without per-branch
 * prop typing (Vue, Svelte). Shared props pass through unchanged; each branch
 * prop is merged across branches: its `type` is the union of the branch types
 * (the discriminant collapses to `true | false`), and it is `required` only
 * when present and required in **every** branch.
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
    { types: string[]; requiredCount: number; appearances: number }
  >();
  for (const props of branchProps) {
    for (const [name, definition] of Object.entries(props)) {
      const entry =
        accumulated.get(name) ?? { types: [], requiredCount: 0, appearances: 0 };
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
        entry.appearances === branchCount && entry.requiredCount === branchCount,
    };
  }
  return merged;
}
