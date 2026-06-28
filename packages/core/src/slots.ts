import type {
  ExposedBinding,
  NamedSlotContent,
  TemplateNode,
} from '@js-template-engine/types';

/** A bare JavaScript identifier - no member access, calls, or operators. */
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** One runtime value a scoped slot exposes, in normalized form. */
export interface NormalizedExposedBinding {
  /** The scope binding name consumers see. */
  name: string;
  /** The provider-scope JavaScript expression. */
  value: string;
  /** An optional TypeScript type for the React render-prop scope. */
  type?: string;
}

/**
 * Normalizes a slot's `exposes` record into a document-ordered list of
 * `{ name, value, type? }` bindings, collapsing the shorthand string form
 * (`{ api: 'api' }`) and the object form (`{ api: { value, type } }`) into a
 * single shape. Returns an empty array for a non-scoped slot.
 *
 * @param exposes - A slot's `exposes` record, if any.
 * @returns The normalized bindings in declaration order.
 */
export function normalizeExposes(
  exposes: Record<string, ExposedBinding> | undefined
): NormalizedExposedBinding[] {
  if (exposes === undefined) {
    return [];
  }
  return Object.entries(exposes).map(([name, binding]) =>
    typeof binding === 'string'
      ? { name, value: binding }
      : { name, value: binding.value, type: binding.type }
  );
}

/** One named slot a composing node fills, in normalized form. */
export interface NormalizedNamedSlot {
  /** The slot name - the composed child's {@link SlotNode.name}. */
  name: string;
  /** The content projected into the slot. */
  content: TemplateNode[];
  /**
   * Binding names received from the slot's exposed scope (a scoped named
   * slot); empty for an ordinary named slot.
   */
  slotScope: string[];
}

/**
 * Normalizes a node's `slots` map into a document-ordered list of
 * `{ name, content, slotScope }`, collapsing the shorthand array form
 * (`{ closeButton: [...] }`) and the object form
 * (`{ items: { content, slotScope } }`) into a single shape. Returns an empty
 * array when the node fills no named slots.
 *
 * @param slots - A node's `slots` map, if any.
 * @returns The normalized named slots in declaration order.
 */
export function normalizeNamedSlots(
  slots: Record<string, NamedSlotContent> | undefined
): NormalizedNamedSlot[] {
  if (slots === undefined) {
    return [];
  }
  return Object.entries(slots).map(([name, value]) =>
    Array.isArray(value)
      ? { name, content: value, slotScope: [] }
      : { name, content: value.content, slotScope: value.slotScope ?? [] }
  );
}

/**
 * Collects the names of every named slot reachable from `nodes`, in document
 * order, descending into element children, fragment children, conditional
 * branches, iteration children, slot fallbacks, and projected named-slot
 * content (`ElementNode.slots`). The default (unnamed) slot has no name and is
 * never collected.
 *
 * @param nodes - The template nodes to walk.
 * @returns The set of declared named-slot names.
 */
export function collectNamedSlotNames(nodes: TemplateNode[]): Set<string> {
  const names = new Set<string>();
  const visit = (children: TemplateNode[]): void => {
    for (const node of children) {
      switch (node.type) {
        case 'slot':
          if (node.name !== undefined) {
            names.add(node.name);
          }
          if (node.fallback) {
            visit(node.fallback);
          }
          break;
        case 'element':
          if (node.children) {
            visit(node.children);
          }
          for (const named of normalizeNamedSlots(node.slots)) {
            visit(named.content);
          }
          break;
        case 'fragment':
          visit(node.children);
          break;
        case 'conditional':
          for (const branch of node.conditions) {
            visit(branch.children);
          }
          break;
        case 'iteration':
          visit(node.children);
          break;
        default:
          break;
      }
    }
  };
  visit(nodes);
  return names;
}

/**
 * Resolves the named slot a conditional `condition` refers to, or `undefined`
 * when it refers to none. A match requires `condition` to be a bare
 * identifier (no member access or operators) that exactly equals a declared
 * named-slot name - the optional-slot wrapper pattern (`condition: 'icon'`
 * gating a wrapper around `{ type: 'slot', name: 'icon' }`).
 *
 * Each framework target turns the returned name into its own slot-presence
 * check (React `props.<propName>`, Vue `$slots.<name>`, Svelte
 * `$$slots.<name>`) rather than emitting the bare identifier, which is not in
 * scope outside React's slot props. Compound expressions that merely contain
 * a slot name (`'icon && size > 2'`) do not match - the identifier inside is
 * not rewritten.
 *
 * @param condition - The conditional branch condition, if any.
 * @param namedSlots - The component's declared named-slot names.
 * @returns The matched slot name, or `undefined`.
 */
export function slotConditionTarget(
  condition: string | undefined,
  namedSlots: ReadonlySet<string>
): string | undefined {
  if (condition === undefined) {
    return undefined;
  }
  const identifier = condition.trim();
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    return undefined;
  }
  return namedSlots.has(identifier) ? identifier : undefined;
}
