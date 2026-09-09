import type {
  ExposedBinding,
  NamedSlotContent,
  TemplateNode,
} from '@js-template-engine/types';

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
 * references; each framework target supplies its own presence form via
 * `toPresence` (React `props.<propName>`, Vue `$slots.<name>`, Svelte
 * `$$slots.<name>`).
 *
 * The expression is tokenized rather than pattern-matched so that two false
 * positives are avoided: a member-access tail (`'foo.icon'` - the `icon` after
 * a `.`) and an identifier inside a string literal (`"'icon'"`) are left
 * untouched. A token the tokenizer cannot confidently classify as a free
 * identifier is likewise left verbatim. The default (unnamed) slot is not
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

  let result = '';
  let index = 0;
  // The last non-whitespace character emitted from the source, used to detect
  // a member-access tail (`foo.icon`, `foo?.icon`) regardless of spacing.
  let lastSignificant = '';
  const { length } = expression;

  while (index < length) {
    const char = expression[index];

    // String literals copy verbatim (honoring escapes); their contents are
    // never rewritten.
    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      result += char;
      index += 1;
      while (index < length) {
        const inner = expression[index];
        result += inner;
        index += 1;
        if (inner === '\\' && index < length) {
          result += expression[index];
          index += 1;
          continue;
        }
        if (inner === quote) {
          break;
        }
      }
      lastSignificant = quote;
      continue;
    }

    // Identifiers rewrite when they name a declared slot and are not a
    // member-access tail.
    if (isIdentifierStart(char)) {
      let identifier = char;
      index += 1;
      while (index < length && isIdentifierPart(expression[index])) {
        identifier += expression[index];
        index += 1;
      }
      const isMemberAccess = lastSignificant === '.';
      result +=
        !isMemberAccess && namedSlots.has(identifier)
          ? toPresence(identifier)
          : identifier;
      lastSignificant = identifier[identifier.length - 1];
      continue;
    }

    result += char;
    if (!/\s/.test(char)) {
      lastSignificant = char;
    }
    index += 1;
  }

  return result;
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char);
}
