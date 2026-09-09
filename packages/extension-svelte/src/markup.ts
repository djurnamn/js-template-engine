import {
  classExpressions,
  formatBemCall,
  GENERATED_NODE_ATTRIBUTE,
  hasNestedSelectors,
  hasPlainProperties,
  isDynamicTag,
  isExpressionBinding,
  nodeSpreads,
  normalizeClassList,
  normalizeExposes,
  normalizeNamedSlots,
  parenthesizeClassExpression,
  rewriteSlotReferences,
  serializeInlineStyle,
  TemplateError,
  toKebabCaseProperty,
  wholeStyleExpression,
  type BemRuntimeCall,
  type NormalizedExposedBinding,
  type NormalizedNamedSlot,
  type TargetPlan,
} from '@js-template-engine/core';
import type {
  Attributes,
  AttributeValue,
  ConditionalAttributes,
  ConditionalNode,
  ElementNode,
  IterationNode,
  NestedStyleObject,
  SlotNode,
  TemplateNode,
  TextNode,
  Warning,
} from '@js-template-engine/types';

import { eventAttribute, runesEventAttributes } from './events';
import {
  escapeAttributeValue,
  escapeText,
  expression,
  quoteSingle,
} from './literals';
import type { SvelteNodeOverrides } from './overrides';
import { normalizeSlotName, REST_PROPERTIES_NAME } from './runes-props';
import type { SvelteMode } from './svelte-extension';

/** Everything the markup renderer needs besides the nodes themselves. */
export interface SvelteContext {
  plan: TargetPlan;
  /** The emission dialect: legacy Svelte or Svelte 5 runes. */
  mode: SvelteMode;
  /** True when the styling output strategy is `inline`. */
  stylingInline: boolean;
  /** The declared named-slot names, for slot-presence conditions. */
  namedSlots: ReadonlySet<string>;
  /**
   * Runes only: the slot props whose local binding is aliased away from the
   * prop name (prop name -> local binding), because a projected snippet
   * declaration of the same name would lexically shadow the prop. Slot
   * renders and slot-presence checks read the prop through this map; an
   * absent entry means the prop name is the binding.
   */
  slotPropAliases: ReadonlyMap<string, string>;
  /**
   * Set when a whole-object style expression was rendered; the component
   * builder then emits the generated style serializer into `<script>`.
   */
  usesStyleSerializer: boolean;
  /**
   * The component's passthrough surface root, if any. On this node
   * `{...$$restProps}` spreads first, the consumer `class`/`style` merge,
   * and `bind:this={element}` exposes the DOM handle.
   */
  passthroughNode?: ElementNode;
  /**
   * The expression of a component-valued dynamic root tag, if the component
   * has one. The script builder hoists it to the `RootTag` binding (`$:` in
   * legacy, `$derived` in runes) that the markup's `typeof` branch resolves.
   */
  componentValuedRootExpression?: string;
  /**
   * The branch surface elements of a discriminated surface root. Each carries
   * the surface contract (`{...$$restProps}`, `class`/`style` merge,
   * `bind:this={element}`) in its branch, exactly like a single passthrough
   * root.
   */
  surfaceElements?: ReadonlySet<ElementNode>;
  /**
   * Per-element BEM runtime calls, set when a styling extension is in runtime
   * mode. A node present here renders its BEM classes as the `bem(...)` call
   * instead of the literal classes.
   */
  bemRuntimeCalls?: ReadonlyMap<ElementNode, BemRuntimeCall>;
  /**
   * Set when a runes event binding applied the `once(...)` helper; the
   * component builder then declares the helper in `<script>`.
   */
  usesOnceHelper: boolean;
  /**
   * Set when a runes event binding rendered as a passive `{@attach}`
   * listener; the component builder then imports `on` from `svelte/events`.
   */
  usesPassiveAttachment: boolean;
  /**
   * Set when a runes event binding on a passthrough surface root composed
   * with the consumer spread's handler; the component builder then declares
   * the `composeEventHandlers(...)` helper in `<script>`.
   */
  usesComposeHelper: boolean;
  warnings: Warning[];
}

/** The name of the generated whole-object style serializer helper. */
export const STYLE_SERIALIZER_NAME = 'serializeStyleObject';

/**
 * The hoisted binding a component-valued dynamic root tag resolves to - the
 * `typeof` branch in the markup and the `$:`/`$derived` declaration in the
 * script both reference it. Capitalized so the runes component arm can render
 * the bare `<RootTag>` form (a lowercase name would parse as an intrinsic
 * tag). Mirrors the React extension's `RootTag` local.
 */
export const DYNAMIC_ROOT_BINDING = 'RootTag';

const INDENTATION = '  ';
const MAX_WIDTH = 80;

function pad(indent: number): string {
  return INDENTATION.repeat(indent);
}

function fits(line: string): boolean {
  return line.length <= MAX_WIDTH;
}

/** Renders template nodes as Svelte markup lines at the given indent level. */
export function renderNodes(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  const lines: string[] = [];
  nodes.forEach((node, index) => {
    lines.push(...renderNode(node, joinPath(path, `[${index}]`), indent, context));
  });
  return lines;
}

function joinPath(parent: string, segment: string): string {
  if (parent === '') {
    return segment;
  }
  return segment.startsWith('[') ? `${parent}${segment}` : `${parent}.${segment}`;
}

function renderNode(
  node: TemplateNode,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  const padding = pad(indent);
  switch (node.type) {
    case 'element':
      return renderElement(node, path, indent, context);
    case 'text':
      return [`${padding}${textPiece(node)}`];
    case 'comment':
      return [`${padding}<!-- ${node.content} -->`];
    case 'fragment':
      return renderNodes(node.children, `${path}.children`, indent, context);
    case 'slot':
      return renderSlot(node, path, indent, context);
    case 'conditional':
      return renderConditional(node, path, indent, context);
    case 'iteration':
      return renderIteration(node, path, indent, context);
    default:
      return [];
  }
}

function textPiece(node: TextNode): string {
  if (node.content !== undefined) {
    return escapeText(node.content);
  }
  return `{${expression(String(node.expression))}}`;
}

/**
 * Renders a conditional as a Svelte `{#if}` block. Every branch becomes an
 * `{#if}` / `{:else if}` / `{:else}` clause; the children render between the
 * clauses at the next indent level.
 */
function renderConditional(
  node: ConditionalNode,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  const padding = pad(indent);
  const lines: string[] = [];

  node.conditions.forEach((branch, index) => {
    const childPath = `${path}.conditions[${index}].children`;
    if (branch.statement === 'if') {
      lines.push(`${padding}{#if ${conditionExpression(branch, context)}}`);
    } else if (branch.statement === 'else-if') {
      lines.push(`${padding}{:else if ${conditionExpression(branch, context)}}`);
    } else {
      lines.push(`${padding}{:else}`);
    }
    lines.push(...renderNodes(branch.children, childPath, indent + 1, context));
  });
  lines.push(`${padding}{/if}`);

  return lines;
}

/** Svelte's legacy slot-presence form for a named slot. */
function sveltePresence(slotName: string): string {
  return `$$slots.${slotName}`;
}

/**
 * The local binding a runes slot prop reads through: the prop name itself,
 * or its alias when a same-named projected snippet declaration would shadow
 * the prop (see {@link SvelteContext.slotPropAliases}).
 */
function slotPropBinding(propName: string, context: SvelteContext): string {
  return context.slotPropAliases.get(propName) ?? propName;
}

/**
 * Rewrites the declared-named-slot references in a condition or attribute
 * expression to the mode's presence form: legacy `$$slots.<name>`, runes
 * `<propName> !== undefined` against the snippet prop. Inside a compound
 * runes expression the comparison is parenthesized so it stays a single
 * operand next to `!`, `&&`, and the other operators; an expression that is
 * exactly the bare slot name keeps the unparenthesized form.
 */
function slotPresenceExpression(
  source: string | undefined,
  context: SvelteContext
): string | undefined {
  if (context.mode !== 'runes') {
    return rewriteSlotReferences(source, context.namedSlots, sveltePresence);
  }
  if (source !== undefined && context.namedSlots.has(source.trim())) {
    return `${slotPropBinding(normalizeSlotName(source.trim()), context)} !== undefined`;
  }
  return rewriteSlotReferences(
    source,
    context.namedSlots,
    (slotName) =>
      `(${slotPropBinding(normalizeSlotName(slotName), context)} !== undefined)`
  );
}

/**
 * The expression a branch condition emits. A reference to a declared named
 * slot becomes that slot's Svelte presence check (legacy `$$slots.<name>`,
 * runes `<propName> !== undefined`), since the bare slot name is not a
 * declared prop; the rest of the condition is emitted verbatim through
 * {@link expression}.
 */
function conditionExpression(
  branch: ConditionalNode['conditions'][number],
  context: SvelteContext
): string {
  return expression(String(slotPresenceExpression(branch.condition, context)));
}

/**
 * The runtime `bem(...)` call for a node, with named-slot references in its
 * conditional modifiers resolved to the mode's slot-presence form - the same
 * resolution the conditional nodes apply, so a modifier gated on a slot
 * tracks the same presence as a wrapper gated on it.
 */
function bemCallExpression(
  runtimeCall: BemRuntimeCall,
  context: SvelteContext
): string {
  return formatBemCall(
    runtimeCall.elementName,
    runtimeCall.staticModifiers,
    runtimeCall.conditionalModifiers.map((modifier) => ({
      modifier: modifier.modifier,
      condition: slotPresenceExpression(modifier.condition, context)!,
    }))
  );
}

/**
 * Renders an iteration as a Svelte `{#each}` block. The optional index
 * becomes the second `as` binding and the key expression the trailing
 * `(...)`; an omitted key renders no key and warns.
 */
function renderIteration(
  node: IterationNode,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  const padding = pad(indent);
  let clause = `${expression(node.items)} as ${node.item}`;
  if (node.index !== undefined) {
    clause += `, ${node.index}`;
  }
  if (node.key !== undefined) {
    clause += ` (${expression(node.key)})`;
  } else {
    context.warnings.push({
      message:
        "Iteration has no 'key' expression; Svelte list items render without keys",
      nodePath: path,
    });
  }

  const childPath = `${path}.children`;
  return [
    `${padding}{#each ${clause}}`,
    ...renderNodes(node.children, childPath, indent + 1, context),
    `${padding}{/each}`,
  ];
}

/**
 * The scope object literal a scoped slot passes to its snippet: `{ api }`
 * when an exposed binding's value expression is exactly its name
 * (shorthand), `{ api: dialog.api }` otherwise.
 */
function scopeObjectLiteral(exposes: NormalizedExposedBinding[]): string {
  const parts = exposes.map((binding) =>
    binding.value.trim() === binding.name
      ? binding.name
      : `${binding.name}: ${binding.value.trim()}`
  );
  return `{ ${parts.join(', ')} }`;
}

/**
 * Renders a slot in runes form: the snippet prop rendered through
 * `{@render}`. Without a fallback the call is optional-chained
 * (`{@render children?.()}`); with one, an `{#if}` guard renders the snippet
 * when supplied and the fallback otherwise. A scoped slot bundles its
 * exposed bindings into the snippet's one object argument.
 */
function renderSlotRunes(
  node: SlotNode,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  const padding = pad(indent);
  const propName =
    node.name === undefined ? 'children' : normalizeSlotName(node.name);
  // The prop is read through its local binding - aliased when a same-named
  // projected snippet declaration would shadow it (a slot rendered inside
  // that snippet's body would otherwise guard on and render the snippet
  // itself, recursing forever).
  const binding = slotPropBinding(propName, context);
  const exposes = normalizeExposes(node.exposes);
  const argument = exposes.length > 0 ? scopeObjectLiteral(exposes) : '';
  const fallback = node.fallback ?? [];

  if (fallback.length === 0) {
    return [`${padding}{@render ${binding}?.(${argument})}`];
  }

  return [
    `${padding}{#if ${binding}}`,
    `${padding}${INDENTATION}{@render ${binding}(${argument})}`,
    `${padding}{:else}`,
    ...renderNodes(fallback, `${path}.fallback`, indent + 1, context),
    `${padding}{/if}`,
  ];
}

function renderSlot(
  node: SlotNode,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  if (context.mode === 'runes') {
    return renderSlotRunes(node, path, indent, context);
  }
  const padding = pad(indent);
  const slotAttributes: string[] = [];
  if (node.name !== undefined) {
    slotAttributes.push(`name="${escapeAttributeValue(node.name)}"`);
  }
  // A scoped slot binds its exposed values on the `<slot>` element.
  for (const binding of normalizeExposes(node.exposes)) {
    slotAttributes.push(`${binding.name}={${expression(binding.value)}}`);
  }
  const nameAttr = slotAttributes.length > 0 ? ` ${slotAttributes.join(' ')}` : '';
  const fallback = node.fallback ?? [];

  if (fallback.length === 0) {
    return [`${padding}<slot${nameAttr} />`];
  }

  const open = `<slot${nameAttr}>`;
  const close = '</slot>';

  if (fallback.every((child) => child.type === 'text')) {
    const text = fallback.map((child) => textPiece(child as TextNode)).join('');
    const single = `${padding}${open}${text}${close}`;
    if (fits(single)) {
      return [single];
    }
    return [`${padding}${open}`, `${padding}${INDENTATION}${text}`, `${padding}${close}`];
  }

  if (
    fallback.length === 1 &&
    (fallback[0].type === 'element' || fallback[0].type === 'fragment')
  ) {
    const inner = renderNode(fallback[0], `${path}.fallback[0]`, indent, context);
    if (inner.length === 1) {
      const single = `${padding}${open}${inner[0].trimStart()}${close}`;
      if (fits(single)) {
        return [single];
      }
    }
  }

  return [
    `${padding}${open}`,
    ...renderNodes(fallback, `${path}.fallback`, indent + 1, context),
    `${padding}${close}`,
  ];
}

/**
 * Rewrites an element's attribute parts for a component-valued root's
 * **component arm**, where Svelte's element-only directives are invalid. A CSS
 * custom-property style directive (`style:--foo={v}`) becomes the component
 * CSS-var-prop form (`--foo={v}`), which a forwarding component applies to its
 * subtree exactly as the element arm's directive would. Any other element-only
 * directive (a non-custom `style:`, or `class:`/`use:`/`transition:`/`in:`/
 * `out:`/`animate:`) has no component-valid form, so it is a build-time error
 * here rather than Svelte output that fails to compile on the component arm.
 * The string arm keeps the directives unchanged - they are valid on
 * `<svelte:element>`.
 */
function componentArmParts(parts: string[], path: string): string[] {
  return parts.map((part) => {
    const customProperty = part.match(/^style:(--[\w-]+)=([\s\S]+)$/);
    if (customProperty) {
      return `${customProperty[1]}=${customProperty[2]}`;
    }
    if (/^(style|class|use|transition|in|out|animate):/.test(part)) {
      const directive = part.split('=')[0];
      throw new TemplateError(
        `A component-valued dynamic root cannot carry the element-only Svelte ` +
          `directive '${directive}' - it is invalid on the component arm. Move ` +
          `it to a string 'class'/'style' attribute, or drop 'componentValued'.`,
        path
      );
    }
    return part;
  });
}

function renderElement(
  node: ElementNode,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  // A per-target `tag` override replaces the element wholesale (a capitalized
  // value renders as a component reference) and suppresses the dynamic-tag
  // path. Otherwise a dynamic tag renders as `<svelte:element this={...}>`; the
  // `this` binding leads the attributes, the expression emitted verbatim.
  const tagOverride = (node.extensions?.svelte as SvelteNodeOverrides | undefined)
    ?.tag;
  const dynamic =
    tagOverride === undefined && isDynamicTag(node.tag) ? node.tag : undefined;
  const runes = context.mode === 'runes';
  // A component-valued dynamic root may resolve to a component *or* a string
  // fallback, which Svelte cannot express with one construct (`<svelte:element>`
  // renders string tags only; the component forms render components only). So
  // it emits a `typeof` branch over the hoisted `RootTag` binding - a
  // `<svelte:element>` string arm and a component arm (`<svelte:component>` in
  // legacy, a bare `<RootTag>` in runes) - each rendering the same element. The
  // arm body sits one indent deeper inside the `{#if}`.
  const componentValued = dynamic?.componentValued === true;
  const bodyIndent = componentValued ? indent + 1 : indent;
  // A component-reference node with `slotScope` receives the composed
  // component's default scoped slot. In legacy form the scope binds via
  // `let:` on the tag; in runes form the children render inside an explicit
  // `{#snippet children(...)}` block instead (implicit children cannot take
  // parameters), so no tag-level binding is emitted.
  const slotScope =
    node.slotScope !== undefined && node.slotScope.length > 0
      ? node.slotScope
      : undefined;
  const letBindings =
    slotScope !== undefined && !runes
      ? slotScope.map((name) => `let:${name}`)
      : [];
  const children = node.children ?? [];
  const snippetChildren = runes && slotScope !== undefined;

  // The side-effecting renders (warnings, helper flags) run once; both branch
  // arms reuse the results, so a component-valued root never double-emits a
  // warning or a duplicated child subtree render.
  const attributeParts = buildAttributeParts(node, path, context);
  // A component-reference node with `slots` projects content into the composed
  // component's named slots: in legacy form a `<svelte:fragment slot="name">`
  // child (a scoped named slot receives its scope through `let:` on the
  // fragment), in runes form a `{#snippet name(...)}` declaration inside the
  // component tag. The default children stay bare in both forms.
  const namedSlots = normalizeNamedSlots(node.slots);
  const slotFragments = namedSlots.flatMap((named) =>
    runes
      ? snippetProjection(named, path, bodyIndent, context)
      : fragmentProjection(named, path, bodyIndent, context)
  );
  const hasNamedSlots = slotFragments.length > 0;
  const childLines = snippetChildren
    ? [
        `${pad(bodyIndent + 1)}{#snippet children({ ${slotScope!.join(', ')} })}`,
        ...renderNodes(children, `${path}.children`, bodyIndent + 2, context),
        `${pad(bodyIndent + 1)}{/snippet}`,
      ]
    : renderNodes(children, `${path}.children`, bodyIndent + 1, context);

  // Pure assembly of one element rendering: no side effects, so it is safe to
  // call once (the normal path) or twice (a component-valued root's two arms).
  const assemble = (
    tag: ElementNode['tag'],
    thisBinding: string[],
    isDynamicElement: boolean,
    componentArm = false
  ): string[] => {
    const padding = pad(bodyIndent);
    // The component arm rewrites element-only directives (custom-property
    // styles become CSS-var-props; others error) so `<svelte:component>` /
    // `<RootTag>` never receives a directive Svelte rejects.
    const effectiveAttributeParts = componentArm
      ? componentArmParts(attributeParts, path)
      : attributeParts;
    const parts = [...thisBinding, ...letBindings, ...effectiveAttributeParts];
    const joined = parts.length > 0 ? ` ${parts.join(' ')}` : '';

    const multilineOpen = (closer: string): string[] => [
      `${padding}<${tag}`,
      ...parts.map((part) => `${padding}${INDENTATION}${part}`),
      `${padding}${closer}`,
    ];

    if (children.length === 0 && !hasNamedSlots) {
      // Svelte 5 expects explicit closing tags on non-void elements, so the
      // runes form never self-closes an intrinsic non-void tag.
      if (runes && requiresExplicitClosingTag(tag, isDynamicElement)) {
        const single = `${padding}<${tag}${joined}></${tag}>`;
        return fits(single) ? [single] : multilineOpen(`></${tag}>`);
      }
      const single = `${padding}<${tag}${joined} />`;
      return fits(single) ? [single] : multilineOpen('/>');
    }

    const open = `<${tag}${joined}>`;
    const close = `</${tag}>`;

    if (
      !hasNamedSlots &&
      !snippetChildren &&
      children.every((child) => child.type === 'text')
    ) {
      const text = children
        .map((child) => textPiece(child as TextNode))
        .join('');
      const single = `${padding}${open}${text}${close}`;
      if (fits(single)) {
        return [single];
      }
      const openLines = fits(`${padding}${open}`)
        ? [`${padding}${open}`]
        : multilineOpen('>');
      return [
        ...openLines,
        `${padding}${INDENTATION}${text}`,
        `${padding}${close}`,
      ];
    }

    const openLines = fits(`${padding}${open}`)
      ? [`${padding}${open}`]
      : multilineOpen('>');
    return [...openLines, ...childLines, ...slotFragments, `${padding}${close}`];
  };

  if (componentValued) {
    const padding = pad(indent);
    const binding = DYNAMIC_ROOT_BINDING;
    const componentTag = runes ? binding : 'svelte:component';
    const componentThis = runes ? [] : [`this={${binding}}`];
    return [
      `${padding}{#if typeof ${binding} === 'string'}`,
      ...assemble('svelte:element', [`this={${binding}}`], true),
      `${padding}{:else}`,
      ...assemble(componentTag, componentThis, true, true),
      `${padding}{/if}`,
    ];
  }

  const tag = tagOverride ?? (dynamic ? 'svelte:element' : node.tag);
  const thisBinding = dynamic ? [`this={${dynamic.$expression}}`] : [];
  return assemble(tag, thisBinding, dynamic !== undefined);
}

/**
 * Renders one legacy named-slot projection: a
 * `<svelte:fragment slot="name">` child, with the received scope bound
 * through `let:` on the fragment.
 */
function fragmentProjection(
  named: NormalizedNamedSlot,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  const lets = named.slotScope.map((name) => `let:${name}`);
  const attributes = [`slot="${named.name}"`, ...lets].join(' ');
  return [
    `${pad(indent + 1)}<svelte:fragment ${attributes}>`,
    ...renderNodes(
      named.content,
      `${path}.slots.${named.name}.content`,
      indent + 2,
      context
    ),
    `${pad(indent + 1)}</svelte:fragment>`,
  ];
}

/**
 * Renders one runes named-slot projection: a `{#snippet name(...)}`
 * declaration inside the component tag, its parameter destructuring the
 * received scope names for a scoped named slot.
 */
function snippetProjection(
  named: NormalizedNamedSlot,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  const parameters =
    named.slotScope.length > 0 ? `{ ${named.slotScope.join(', ')} }` : '';
  return [
    `${pad(indent + 1)}{#snippet ${normalizeSlotName(named.name)}(${parameters})}`,
    ...renderNodes(
      named.content,
      `${path}.slots.${named.name}.content`,
      indent + 2,
      context
    ),
    `${pad(indent + 1)}{/snippet}`,
  ];
}

/** The HTML void elements, which keep the self-closing form in runes mode. */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Whether a childless element must render an explicit closing tag in runes
 * form: intrinsic non-void elements only. Void elements, component
 * references, and `<svelte:element>` (whose runtime tag is unknowable) keep
 * the self-closing form.
 */
function requiresExplicitClosingTag(
  tag: ElementNode['tag'],
  dynamic: boolean
): boolean {
  if (dynamic || typeof tag !== 'string') {
    return false;
  }
  if (!/^[a-z]/.test(tag) || tag.includes(':')) {
    return false;
  }
  return !VOID_ELEMENTS.has(tag);
}

function buildAttributeParts(
  node: ElementNode,
  path: string,
  context: SvelteContext
): string[] {
  const override = node.extensions?.svelte as SvelteNodeOverrides | undefined;
  const attributes = { ...node.attributes, ...override?.attributes };
  const events = override?.events ?? node.events ?? [];
  // Named-slot references in each condition resolve to the mode's
  // slot-presence form here, so attribute/class expressions match the
  // conditional nodes that gate on the same slot.
  const conditionals = (node.conditionalAttributes ?? []).map((conditional) => ({
    ...conditional,
    condition: slotPresenceExpression(conditional.condition, context)!,
  }));
  const isPassthrough =
    node === context.passthroughNode ||
    context.surfaceElements?.has(node) === true;
  // The consumer `class` (the reserved-word-aliased prop) is appended
  // after the authored expression classes.
  const consumerClasses = isPassthrough ? ['className'] : [];

  // In BEM runtime mode this node renders its BEM classes as the `bem(...)`
  // call: the contributed literals are suppressed from the static class list
  // and the folded conditional classes from the conditional rendering.
  const runtimeCall = context.bemRuntimeCalls?.get(node);
  const runtimeCallExpression =
    runtimeCall === undefined
      ? undefined
      : bemCallExpression(runtimeCall, context);
  const contributedClasses = new Set(runtimeCall?.contributedClasses ?? []);
  const foldedClasses = new Set(runtimeCall?.foldedConditionalClasses ?? []);
  const classConditionals =
    foldedClasses.size === 0
      ? conditionals
      : conditionals.map((conditional) => ({
          ...conditional,
          attributes: {
            ...conditional.attributes,
            class: normalizeClassList(conditional.attributes.class).filter(
              (className) => !foldedClasses.has(className)
            ),
          },
        }));

  const parts: string[] = [];
  // Object spreads lead the authored attributes (which override per key).
  parts.push(
    ...nodeSpreads(attributes).map((source) => `{...${expression(source)}}`)
  );
  let classRendered = false;
  let styleRendered = false;

  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || name === '$spread') {
      continue;
    }
    if (name === 'class') {
      const classValue = value as Attributes['class'];
      const staticClasses = normalizeClassList(classValue).filter(
        (className) => !contributedClasses.has(className)
      );
      parts.push(
        ...classParts(
          staticClasses,
          classConditionals,
          [...classExpressions(classValue), ...consumerClasses],
          runtimeCallExpression
        )
      );
      classRendered = true;
    } else if (name === 'style') {
      parts.push(
        ...styleParts(
          value as NestedStyleObject,
          context,
          isPassthrough ? 'style' : undefined
        )
      );
      styleRendered = true;
    } else if (isExpressionBinding(value)) {
      parts.push(`${name}={${expression(value.$expression)}}`);
    } else if (typeof value === 'boolean') {
      if (value) {
        parts.push(name);
      }
    } else if (typeof value === 'number') {
      parts.push(`${name}={${value}}`);
    } else {
      parts.push(`${name}="${escapeAttributeValue(String(value))}"`);
    }
  }

  if (!classRendered) {
    parts.push(
      ...classParts([], classConditionals, consumerClasses, runtimeCallExpression)
    );
  }

  for (const conditional of conditionals) {
    for (const [name, value] of Object.entries(conditional.attributes)) {
      if (name === 'class' || name === 'style' || value === undefined) {
        continue;
      }
      const expr = `${conditional.condition} ? ${conditionalValueExpression(
        value as AttributeValue
      )} : undefined`;
      parts.push(`${name}={${expression(expr)}}`);
    }
  }

  const target = context.plan.get(node);
  if (target?.generatedNodeIndex !== undefined) {
    parts.push(`${GENERATED_NODE_ATTRIBUTE}="${target.generatedNodeIndex}"`);
  }

  if (context.mode === 'runes') {
    // On a surface root the event attributes share one attribute object with
    // `{...restProperties}`, so each composes with the handler the spread
    // carries for the same attribute rather than overwriting it. Legacy `on:`
    // directives attach as their own listeners and need no such composition.
    for (const emission of runesEventAttributes(
      events,
      isPassthrough ? REST_PROPERTIES_NAME : undefined
    )) {
      parts.push(emission.part);
      if (emission.usesOnceHelper) {
        context.usesOnceHelper = true;
      }
      if (emission.usesPassiveAttachment) {
        context.usesPassiveAttachment = true;
      }
      if (emission.usesComposeHelper) {
        context.usesComposeHelper = true;
      }
    }
  } else {
    for (const event of events) {
      parts.push(eventAttribute(event));
    }
  }

  if (isPassthrough) {
    // Spread the consumer's undeclared attributes first so the authored
    // attributes above win per key; forward a consumer `style` not already
    // merged into an authored one; bind the DOM handle.
    parts.unshift(
      context.mode === 'runes'
        ? `{...${REST_PROPERTIES_NAME}}`
        : '{...$$restProps}'
    );
    if (!styleRendered) {
      parts.push('style={style}');
    }
    parts.push('bind:this={element}');
  }

  return parts;
}

/**
 * Builds the class attribute parts: a `class` attribute from the authored
 * classes - with guarded `{...}` interpolations appended for expression
 * classes, so a falsy runtime value contributes nothing - then a
 * `class:NAME={condition}` directive for each condition-gated class. The
 * fixed concatenation order (static first, then conditional in array
 * order, then expression classes in authored order) is applied with
 * first-occurrence deduplication of the literal sources.
 */
function classParts(
  staticClasses: string[],
  conditionals: ConditionalAttributes[],
  expressionClasses: string[],
  runtimeCall?: string
): string[] {
  const parts: string[] = [];
  if (runtimeCall === undefined) {
    if (staticClasses.length === 0 && expressionClasses.length === 1) {
      parts.push(`class={${expression(expressionClasses[0])} || ''}`);
    } else if (staticClasses.length > 0 || expressionClasses.length > 0) {
      let attributeValue =
        staticClasses.length > 0
          ? escapeAttributeValue(staticClasses.join(' '))
          : '';
      expressionClasses.forEach((classExpression, index) => {
        if (attributeValue === '' && index === 0) {
          // As the leading operand the expression is coerced by `|| ''`,
          // whose looser binding leaves every operator correctly grouped.
          attributeValue += `{${expression(classExpression)} || ''}`;
        } else {
          // In the `' ' + <expression>` concatenation the expression must be
          // a single operand, so a compound one is parenthesized.
          const guarded = parenthesizeClassExpression(classExpression);
          attributeValue += `{${guarded} ? ' ' + ${guarded} : ''}`;
        }
      });
      parts.push(`class="${attributeValue}"`);
    }
  } else if (staticClasses.length === 0 && expressionClasses.length === 0) {
    // The runtime call always yields a non-empty string, so it carries no
    // falsy guard.
    parts.push(`class={${expression(runtimeCall)}}`);
  } else {
    let attributeValue =
      staticClasses.length > 0
        ? `${escapeAttributeValue(staticClasses.join(' '))} `
        : '';
    attributeValue += `{${expression(runtimeCall)}}`;
    expressionClasses.forEach((classExpression) => {
      const guarded = parenthesizeClassExpression(classExpression);
      attributeValue += `{${guarded} ? ' ' + ${guarded} : ''}`;
    });
    parts.push(`class="${attributeValue}"`);
  }

  const seen = new Set(staticClasses);
  for (const conditional of conditionals) {
    const classes = normalizeClassList(conditional.attributes.class).filter(
      (className) => {
        if (seen.has(className)) {
          return false;
        }
        seen.add(className);
        return true;
      }
    );
    for (const className of classes) {
      parts.push(`class:${className}={${expression(conditional.condition)}}`);
    }
  }

  return parts;
}

/**
 * Builds the style attribute parts. A whole-object expression renders
 * through the generated style serializer (`style={serializeStyleObject(...)}`).
 * Otherwise expression-valued properties always render as `style:property`
 * directives - they go through Svelte's dynamic style mechanism regardless
 * of the styling strategy - while static plain properties render as a
 * static `style="..."` attribute only under the `inline` strategy (and only
 * when no nested selectors force the style to a stylesheet).
 */
function styleParts(
  style: NestedStyleObject,
  context: SvelteContext,
  consumerStyle?: string
): string[] {
  const parts: string[] = [];
  const wholeExpression = wholeStyleExpression(style);
  const includeStatic =
    context.stylingInline &&
    !hasNestedSelectors(style) &&
    hasPlainProperties(style);

  let serialized: string | undefined;
  if (wholeExpression !== undefined) {
    context.usesStyleSerializer = true;
    serialized = `${STYLE_SERIALIZER_NAME}(${expression(wholeExpression)})`;
  }

  // The `style` attribute string layers the whole-object serializer output
  // (base) under any static inline declarations, with the consumer style
  // appended last. `style:property` directives (per-property expressions)
  // override this attribute in Svelte's model.
  let stringStyleEmitted = false;
  if (serialized !== undefined && !includeStatic && consumerStyle === undefined) {
    // A lone whole-object expression keeps the bare `style={...}` form.
    parts.push(`style={${serialized}}`);
    stringStyleEmitted = true;
  } else if (serialized !== undefined || includeStatic) {
    const segments: string[] = [];
    if (serialized !== undefined) {
      segments.push(`{${serialized}}`);
    }
    if (includeStatic) {
      segments.push(escapeAttributeValue(serializeInlineStyle(style)));
    }
    const base = segments.join('; ');
    parts.push(
      consumerStyle !== undefined
        ? `style="${base}{${consumerStyle} ? '; ' + ${consumerStyle} : ''}"`
        : `style="${base}"`
    );
    stringStyleEmitted = true;
  }

  for (const [property, value] of Object.entries(style)) {
    if (property === '$expression') {
      continue;
    }
    if (isExpressionBinding(value)) {
      parts.push(
        `style:${toKebabCaseProperty(property)}={${expression(value.$expression)}}`
      );
    }
  }
  // The consumer style still needs a carrier when the authored style emitted
  // only `style:property` directives (or nothing inline).
  if (!stringStyleEmitted && consumerStyle !== undefined) {
    parts.push(`style={${consumerStyle}}`);
  }
  return parts;
}

function conditionalValueExpression(value: AttributeValue): string {
  if (isExpressionBinding(value)) {
    return value.$expression.trim();
  }
  if (typeof value === 'string') {
    return quoteSingle(value);
  }
  return String(value);
}
