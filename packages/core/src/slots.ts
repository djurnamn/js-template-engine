import type {
  ExposedBinding,
  NamedSlotContent,
  TemplateNode,
} from '@js-template-engine/types';

import {
  readExpressionIdentifiers,
  tokenizeExpression,
} from './expression-scope';

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
 * Rewrites every reference to a declared named slot inside an expression to
 * that slot's per-target presence form, leaving the rest of the expression
 * verbatim. A bare slot name (`'icon'`), a negation (`'!icon'`), and a
 * compound expression (`'icon && size > 2'`) all resolve their slot
 * references; each scripted target supplies its own presence form via
 * `toPresence` (React `props.<propName>`, Vue `$slots.<name>`, Svelte
 * `$$slots.<name>`).
 *
 * Only a free reference is rewritten. The expression is tokenized and read
 * for scope, so a member-access tail (`'foo.icon'`), an identifier inside a
 * string literal (`"'icon'"`), an object literal key (`{ icon: 1 }`) and a
 * name the expression binds itself are left untouched: an arrow or `function`
 * parameter (plain, destructured, defaulted or rest) inside that function, a
 * `catch` binding, and a `const`, `let`, `var`, `function` or `class`
 * declaration inside its block (`options.find((icon) => icon.ready)` reads the
 * parameter). A shorthand property keeps its key (`{ icon }` becomes
 * `{ icon: $$slots.icon }`). The default (unnamed) slot is not
 * identifier-addressable and so is never matched.
 *
 * @param expression - The condition or attribute expression, if any.
 * @param namedSlots - The component's declared named-slot names.
 * @param toPresence - Maps a matched slot name to its target presence form.
 * @returns The expression with slot references rewritten, or `undefined` when
 *   `expression` is `undefined`.
 *
 * @example
 * rewriteSlotReferences('!icon', new Set(['icon']), (name) => `$$slots.${name}`)
 * // => '!$$slots.icon'
 */
export function rewriteSlotReferences(
  expression: string | undefined,
  namedSlots: ReadonlySet<string>,
  toPresence: (slotName: string) => string
): string | undefined {
  if (expression === undefined || namedSlots.size === 0) {
    return expression;
  }

  const tokens = tokenizeExpression(expression);
  const readings = readExpressionIdentifiers(tokens);
  return tokens
    .map((token, index) => {
      const reading = readings.get(index);
      if (
        reading === undefined ||
        !reading.free ||
        !namedSlots.has(token.text)
      ) {
        return token.text;
      }
      const presence = toPresence(token.text);
      return reading.shorthandProperty
        ? `${token.text}: ${presence}`
        : presence;
    })
    .join('');
}

/**
 * The slot-reference scope of a scripted target's render context: the named
 * slots a free identifier in an expression resolves to (see
 * {@link rewriteSlotReferences}).
 */
export interface SlotReferenceScope {
  namedSlots: ReadonlySet<string>;
}

/**
 * Renders a subtree in which some local bindings shadow named slots of the
 * same name: an iteration's `item` and `index`, or the bindings a
 * `slotScope` receives. While `render` runs, `scope.namedSlots` leaves those
 * names out, so an expression inside the subtree reads the local binding
 * (`option.label`) rather than the slot; the slots are restored afterwards,
 * so the same name outside the subtree still resolves to the slot.
 *
 * @param scope - The render context whose `namedSlots` is narrowed.
 * @param names - The local binding names the subtree declares.
 * @param render - Renders the subtree.
 * @returns What `render` returns.
 *
 * @example
 * withShadowedSlotNames(context, [node.item, node.index], () =>
 *   renderChildren(node.children, context)
 * );
 */
export function withShadowedSlotNames<Result>(
  scope: SlotReferenceScope,
  names: ReadonlyArray<string | undefined>,
  render: () => Result
): Result {
  const shadowed = names.filter(
    (name): name is string => name !== undefined && scope.namedSlots.has(name)
  );
  if (shadowed.length === 0) {
    return render();
  }
  const enclosing = scope.namedSlots;
  scope.namedSlots = new Set(
    [...enclosing].filter((name) => !shadowed.includes(name))
  );
  try {
    return render();
  } finally {
    scope.namedSlots = enclosing;
  }
}
