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
  rewriteSlotReferences,
  serializeInlineStyle,
  staticTagOf,
  TemplateError,
  toKebabCaseProperty,
  wholeStyleExpression,
  type BemRuntimeCall,
  type NormalizedExposedBinding,
  type NormalizedNamedSlot,
  type TargetPlan,
} from '@js-template-engine/core';
import {
  AUTHORED_AND_CONSUMER,
  AUTHORED_OR_CONSUMER,
  CONSUMER_AND_SPREAD,
  CONSUMER_AND_SPREAD_BINDING,
  CONSUMER_ATTRIBUTES,
  classAttributeQuote,
  classStringLiteral,
  escapeClassAttributeValue,
  groupConditionalClasses,
  isReferenceExpression,
  joinConditions,
  childSiblingLayout,
  DOCUMENT_SIBLING_LAYOUT,
  joinSiblingLines,
  tagLines,
  textLines,
  type SiblingLayout,
  type SiblingLines,
  fragmentWrapper,
  isRoutedAttribute,
  isPropertyOnlyName,
  isTokenListAttribute,
  mergeAttributeOverride,
  normalizeSlotName,
  selectedOptions,
  readsRest,
  escapeComment,
  withoutConditionalClasses,
  withShadowedSlotNames,
} from '@js-template-engine/core/emitter';
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

import {
  eventAttribute,
  type EventRenderingOptions,
  runesEventAttributes,
} from './events';
import {
  escapeAttributeValue,
  escapeText,
  expression,
  quoteSingle,
} from './literals';
import type { SvelteNodeOverrides } from './overrides';
import { REST_PROPERTIES_NAME } from './runes-props';
import type { SvelteMode } from './svelte-extension';

/** Everything the markup renderer needs besides the nodes themselves. */
export interface SvelteContext {
  plan: TargetPlan;
  /** The emission dialect: legacy Svelte or Svelte 5 runes. */
  mode: SvelteMode;
  /** True when the stylesheet placement is `inline`. */
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
   * Set when a passthrough root's style directive reads the consumer's
   * value for its property; the component builder then emits the generated
   * `consumerStyleValue` helper into `<script>`.
   */
  usesConsumerStyleValue: boolean;
  /**
   * The component's passthrough surface root, if any. On this node
   * `{...$$restProps}` spreads first, the consumer `class`/`style` merge,
   * and `bind:this={element}` exposes the DOM handle.
   */
  passthroughNode?: ElementNode;
  /**
   * The element below the passthrough root that takes the consumer's routed
   * attributes (`passthrough: { attributes }`), if any: it spreads
   * `consumerAttributes(<rest>, 'routed')` and the root
   * `consumerAttributes(<rest>, 'root')`.
   */
  routedNode?: ElementNode;
  /** The routed element's routing entries. */
  routedEntries?: readonly string[];
  /**
   * Whether `bind:this={element}` sits on the routed element
   * (`handle: 'routed'`) rather than the passthrough root.
   */
  routedHandle?: boolean;
  /** Set when a routed id list joins the consumer's through the generated
   *  `authoredAndConsumer` helper, so the script declares it. */
  usesAuthoredAndConsumer?: boolean;
  /**
   * The bindings a passthrough root that also spreads a named record reads
   * its consumer attributes from, each folding the records into them through
   * the generated `consumerAndSpread` helper: the binding's name by the
   * helper call it holds. The script declares each, reactive, and the helper.
   */
  consumerAndSpreadBindings?: Map<string, string>;
  /**
   * The elements inside an iteration or a scoped slot, whose expressions may
   * read a local the component script cannot.
   */
  scopedNodes?: ReadonlySet<object>;
  /**
   * In legacy mode, the default values of form controls captured once in the
   * component script, so the control's reflected `value` or `checked` is
   * written once and a later change to the default leaves a user's edit in
   * place: each binding's name and the expression it captures.
   */
  initialValueBindings?: Array<{ name: string; expression: string }>;
  /** The names the script and the props already take, which a generated
   *  binding steers clear of. */
  takenNames?: ReadonlySet<string>;
  /** Set when a generated event wrapper calls its handler through the
   *  generated `invokeHandler` helper, so the script declares it. */
  usesInvokeHandler?: boolean;
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
   * The component's declared and snippet prop names: on a surface element an
   * attribute of one of these names is never in the rest, so it takes no
   * fallback to it.
   */
  declaredNames?: ReadonlySet<string>;
  /**
   * Whether the component declares `rest`: a node that spreads exactly `rest`
   * composes its event handlers with the consumer's the spread carries.
   */
  declaresRest?: boolean;
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
  /**
   * The legacy event bindings of a component-valued root, per node: the `on:`
   * directives its string arm keeps, and the event-attribute props its
   * component arm passes in their place.
   */
  componentArmEvents: Map<ElementNode, ComponentArmEvents>;
  /** Set when a surface attribute resolves through the generated
   *  `authoredOrConsumer` helper, so the script declares it. */
  usesAuthoredOrConsumer?: boolean;
  /**
   * The component's named slots whose content may arrive in a legacy rest. A
   * Svelte 5 consumer's snippet fills a named slot through a prop of that
   * name, which `$$restProps` carries; a surface reads the consumer's
   * attributes without them. Empty in runes mode, where snippets are props.
   */
  slotsInRest?: readonly string[];
  /** Set when a surface reads the rest without slot content, so the script
   *  declares it. */
  usesRestWithoutSlots?: boolean;
  warnings: Warning[];
}

/**
 * A legacy component-valued root's event bindings: the `on:` directive parts
 * and the event-attribute parts that replace them on the component arm.
 */
export interface ComponentArmEvents {
  directives: readonly string[];
  attributes: readonly string[];
}

/** The name of the generated whole-object style serializer helper. */
export const STYLE_SERIALIZER_NAME = 'serializeStyleObject';
/** The generated helper reading one property from the consumer's style. */
export const CONSUMER_STYLE_VALUE_NAME = 'consumerStyleValue';

/**
 * The hoisted binding a component-valued dynamic root tag resolves to - the
 * `typeof` branch in the markup and the `$:`/`$derived` declaration in the
 * script both reference it. Capitalized so the runes component arm can render
 * the bare `<RootTag>` form (a lowercase name would parse as an intrinsic
 * tag). Mirrors the React extension's `RootTag` local.
 */
export const DYNAMIC_ROOT_BINDING = 'RootTag';

const INDENTATION = '  ';
const MAXIMUM_WIDTH = 80;

/**
 * Inside a `<pre>` or `<textarea>`, Svelte keeps every whitespace character,
 * so while one's content renders, nothing is indented or wrapped: each node
 * renders on a single line and the lines join with nothing between them.
 * Counts the elements being rendered that way.
 */
let preservingWhitespace = 0;

/** The elements whose content keeps its whitespace when rendered. */
const WHITESPACE_PRESERVING_TAGS = new Set(['pre', 'textarea']);

function pad(indent: number): string {
  return preservingWhitespace > 0 ? '' : INDENTATION.repeat(indent);
}

/**
 * The line break added ahead of a `<pre>` or `<textarea>` whose content
 * begins with one, so the content keeps its own.
 */
function leadingLineBreak(content: string): string {
  return content.startsWith('\n') || content.startsWith('\r\n') ? '\n' : '';
}

/** One level of indentation, or none inside a whitespace-preserving element. */
function indentation(): string {
  return preservingWhitespace > 0 ? '' : INDENTATION;
}

function fits(line: string): boolean {
  return preservingWhitespace > 0 || line.length <= MAXIMUM_WIDTH;
}

/** Renders template nodes as Svelte markup lines at the given indent level. */
export function renderNodes(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  return renderSiblings(nodes, path, indent, context).lines;
}

/**
 * Renders sibling nodes, joined so that no line break between two of them
 * renders: Svelte keeps whitespace between siblings as a space, so each
 * break falls inside a tag and text joins its neighbors on one line. Inside
 * a whitespace-preserving element nothing is indented, and the lines join
 * with nothing between them.
 */
function renderSiblings(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: SvelteContext
): SiblingLines {
  const parts = nodes.flatMap((node, index) =>
    node.type === 'text'
      ? [
          textLines(
            pad(indent),
            edgeText(textPiece(node), index === 0, index === nodes.length - 1)
          ),
        ]
      : renderNode(node, joinPath(path, `[${index}]`), indent, context)
  );
  if (preservingWhitespace > 0) {
    return tagLines(parts.flatMap((part) => part.lines));
  }
  return joinSiblingLines(parts, siblingLayout.placement);
}

/**
 * The layout of the siblings being rendered: where whitespace between
 * elements never renders (inside an `<svg>` or a table, say), a line break
 * may fall anywhere between them.
 */
let siblingLayout: SiblingLayout = DOCUMENT_SIBLING_LAYOUT;

/** Renders an element's content in the layout its tag gives its children. */
function withChildLayout<T>(tag: string | undefined, render: () => T): T {
  const parent = siblingLayout;
  siblingLayout = childSiblingLayout(tag, parent);
  try {
    return render();
  } finally {
    siblingLayout = parent;
  }
}

function joinPath(parent: string, segment: string): string {
  if (parent === '') {
    return segment;
  }
  return segment.startsWith('[')
    ? `${parent}${segment}`
    : `${parent}.${segment}`;
}

function renderNode(
  node: TemplateNode,
  path: string,
  indent: number,
  context: SvelteContext
): SiblingLines[] {
  const padding = pad(indent);
  switch (node.type) {
    case 'element': {
      // An ignore comment holds to its element: a line break between them
      // would render.
      const [first, ...rest] = renderElement(node, path, indent, context);
      const comment = ignoreComment(node, path, padding);
      return [
        tagLines(
          comment === undefined
            ? [first, ...rest]
            : [`${comment}${first.slice(padding.length)}`, ...rest]
        ),
      ];
    }
    case 'text':
      return [textLines(padding, textPiece(node))];
    case 'comment':
      return [tagLines([`${padding}<!-- ${escapeComment(node.content)} -->`])];
    case 'fragment': {
      const wrapper = fragmentWrapper(node, 'svelte');
      if (wrapper !== undefined) {
        return renderNode(wrapper, path, indent, context);
      }
      return [
        renderSiblings(node.children, `${path}.children`, indent, context),
      ];
    }
    case 'slot':
      return [tagLines(renderSlot(node, path, indent, context))];
    case 'conditional':
      return [tagLines(renderConditional(node, path, indent, context))];
    case 'iteration':
      return [tagLines(renderIteration(node, path, indent, context))];
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
 * Text at the start or end of an element's or block's content. Svelte trims
 * whitespace there, so a space written at that edge renders as an
 * expression, `{' '}`. Inside a whitespace-preserving element it stays as
 * written.
 */
function edgeText(text: string, leading: boolean, trailing: boolean): string {
  if (preservingWhitespace > 0) {
    return text;
  }
  const asExpression = (whitespace: string): string =>
    `{${quoteSingle(whitespace)}}`;
  let result = text;
  if (leading) {
    result = result.replace(/^\s+/, asExpression);
  }
  if (trailing) {
    result = result.replace(/\s+$/, asExpression);
  }
  return result;
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
      lines.push(
        `${padding}{:else if ${conditionExpression(branch, context)}}`
      );
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
 * Rewrites the declared-named-slot references in an attribute expression to
 * the slot's value, as the expression reads it (`suffix !== undefined`,
 * `describe(suffix)`): legacy `$$slots.<name>`, runes the snippet prop through
 * its local binding - the alias where a forwarded snippet of the same name
 * would shadow it - with no comparison added, unlike a condition's presence
 * check.
 */
function slotValueExpression(
  source: string | undefined,
  context: SvelteContext
): string | undefined {
  if (context.mode !== 'runes') {
    return rewriteSlotReferences(source, context.namedSlots, sveltePresence);
  }
  return rewriteSlotReferences(source, context.namedSlots, (slotName) =>
    slotPropBinding(normalizeSlotName(slotName), context)
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
  // The loop item and index shadow a named slot of the same name inside the
  // loop.
  return [
    `${padding}{#each ${clause}}`,
    ...withShadowedSlotNames(context, [node.item, node.index], () =>
      renderNodes(node.children, childPath, indent + 1, context)
    ),
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
    `${padding}${indentation()}{@render ${binding}(${argument})}`,
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
  // A scoped slot binds its exposed values on the `<slot>` element. A value
  // exposed as `name` goes through a spread, since a `name` attribute on
  // `<slot>` is the slot's own name.
  for (const binding of normalizeExposes(node.exposes)) {
    slotAttributes.push(
      binding.name === 'name'
        ? `{...{ name: ${expression(binding.value)} }}`
        : `${binding.name}={${expression(binding.value)}}`
    );
  }
  const nameAttribute =
    slotAttributes.length > 0 ? ` ${slotAttributes.join(' ')}` : '';
  const fallback = node.fallback ?? [];

  if (fallback.length === 0) {
    return [`${padding}<slot${nameAttribute} />`];
  }

  const open = `<slot${nameAttribute}>`;
  const close = '</slot>';

  if (fallback.every((child) => child.type === 'text')) {
    const text = edgeText(
      fallback.map((child) => textPiece(child as TextNode)).join(''),
      true,
      true
    );
    const single = `${padding}${open}${text}${close}`;
    if (fits(single)) {
      return [single];
    }
    return [
      `${padding}${open}`,
      `${padding}${indentation()}${text}`,
      `${padding}${close}`,
    ];
  }

  if (
    fallback.length === 1 &&
    (fallback[0].type === 'element' || fallback[0].type === 'fragment')
  ) {
    const inner = renderNodes(fallback, `${path}.fallback`, indent, context);
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
function componentArmParts(
  parts: string[],
  path: string,
  events: ComponentArmEvents | undefined
): string[] {
  // The `element` handle binds the DOM node, which only the string arm
  // renders: `bind:this` on a component yields its instance, and a component
  // need not declare a bindable `element` to forward it to. Legacy `on:`
  // directives give way to the event-attribute props the arm passes instead.
  const directives = new Set(events?.directives ?? []);
  let eventsPlaced = false;
  return parts
    .filter((part) => part !== 'bind:this={element}')
    .flatMap((part) => {
      if (!directives.has(part)) return [part];
      if (eventsPlaced) return [];
      eventsPlaced = true;
      return [...events!.attributes];
    })
    .map((part) => {
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

/** A Svelte warning code: letters, digits, `_` and `-`. */
const WARNING_CODE = /^[A-Za-z0-9_-]+$/;

/**
 * The `<!-- svelte-ignore ... -->` comment an element's `extensions.svelte.ignore`
 * asks for, placed directly before it; none when the list is absent or empty.
 * A code outside Svelte's warning-code shape is a processing error, since it
 * could not silence anything and could end the comment early.
 */
function ignoreComment(
  node: ElementNode,
  path: string,
  padding: string
): string | undefined {
  const codes =
    (node.extensions?.svelte as SvelteNodeOverrides | undefined)?.ignore ?? [];
  if (codes.length === 0) {
    return undefined;
  }
  for (const [index, code] of codes.entries()) {
    if (typeof code !== 'string' || !WARNING_CODE.test(code)) {
      throw new TemplateError(
        `'${String(code)}' is not a Svelte warning code; extensions.svelte.ignore takes codes such as 'a11y_click_events_have_key_events'`,
        `${path}.extensions.svelte.ignore[${index}]`
      );
    }
  }
  // Comma-separated: runes mode reads only the first of a space-separated
  // list, and both modes accept commas.
  return `${padding}<!-- svelte-ignore ${codes.join(', ')} -->`;
}

/**
 * The consumer's undeclared attributes on a surface element, as an
 * expression: `restProperties` in runes mode, and in legacy `$$restProps`,
 * or the generated `restProperties` that leaves slot content out of it when
 * the component has named slots. A discriminated surface's rest is typed as the union of its branch elements'
 * attributes, so each branch reads it as its own element's, the narrowing
 * React's discriminated union does by type.
 */
function surfaceRest(node: ElementNode, context: SvelteContext): string {
  if (context.mode !== 'runes') {
    if ((context.slotsInRest ?? []).length === 0) return '$$restProps';
    context.usesRestWithoutSlots = true;
    return REST_PROPERTIES_NAME;
  }
  return context.surfaceElements?.has(node) === true
    ? `(${REST_PROPERTIES_NAME} as SvelteHTMLElements['${staticTagOf(node.tag)}'])`
    : REST_PROPERTIES_NAME;
}

/**
 * The share of the consumer's undeclared attributes an element spreads: the
 * whole rest, or with a routed element the root's or the routed element's
 * share of it through the generated `consumerAttributes` helper.
 */
function spreadShare(
  rest: string,
  context: SvelteContext,
  routed: boolean
): string {
  if (context.routedNode === undefined) return rest;
  return `${CONSUMER_ATTRIBUTES}(${rest}, '${routed ? 'routed' : 'root'}')`;
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
  const tagOverride = (
    node.extensions?.svelte as SvelteNodeOverrides | undefined
  )?.tag;
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
  const childTag =
    tagOverride ?? (dynamic === undefined ? (node.tag as string) : undefined);
  const slotFragments = withChildLayout(childTag, () =>
    namedSlots.flatMap((named) =>
      runes
        ? snippetProjection(named, path, bodyIndent, context)
        : fragmentProjection(named, path, bodyIndent, context)
    )
  );
  const hasNamedSlots = slotFragments.length > 0;
  // A literal `<pre>` or `<textarea>` renders its content exactly: on the
  // opening tag's last line, with nothing added (see preservingWhitespace).
  // Content that begins with a line break gets one more, since a browser
  // drops the first line break after the opening tag of either.
  let preservedContent: string | undefined;
  if (
    preservingWhitespace === 0 &&
    tagOverride === undefined &&
    dynamic === undefined &&
    !snippetChildren &&
    !hasNamedSlots &&
    children.length > 0 &&
    WHITESPACE_PRESERVING_TAGS.has(node.tag as string)
  ) {
    preservingWhitespace += 1;
    try {
      const content = withShadowedSlotNames(context, slotScope ?? [], () =>
        renderNodes(children, `${path}.children`, 0, context)
      ).join('');
      preservedContent = `${leadingLineBreak(content)}${content}`;
    } finally {
      preservingWhitespace -= 1;
    }
  }
  // The default slot's scope bindings shadow a named slot of the same name
  // in the children.
  const childLines = withChildLayout(childTag, () =>
    withShadowedSlotNames(context, slotScope ?? [], () =>
      preservedContent !== undefined
        ? []
        : snippetChildren
          ? [
              `${pad(bodyIndent + 1)}{#snippet children({ ${slotScope!.join(', ')} })}`,
              ...renderNodes(
                children,
                `${path}.children`,
                bodyIndent + 2,
                context
              ),
              `${pad(bodyIndent + 1)}{/snippet}`,
            ]
          : renderNodes(children, `${path}.children`, bodyIndent + 1, context)
    )
  );

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
      ? componentArmParts(
          attributeParts,
          path,
          context.componentArmEvents.get(node)
        )
      : attributeParts;
    const parts = [...thisBinding, ...letBindings, ...effectiveAttributeParts];
    const joined = parts.length > 0 ? ` ${parts.join(' ')}` : '';

    const multilineOpen = (closer: string): string[] => [
      `${padding}<${tag}`,
      ...parts.map((part) => `${padding}${indentation()}${part}`),
      `${padding}${closer}`,
    ];

    if (children.length === 0 && !hasNamedSlots) {
      // Svelte 5 expects explicit closing tags on non-void elements, so
      // neither form self-closes an intrinsic non-void tag.
      if (requiresExplicitClosingTag(tag, isDynamicElement)) {
        const single = `${padding}<${tag}${joined}></${tag}>`;
        return fits(single) ? [single] : multilineOpen(`></${tag}>`);
      }
      const single = `${padding}<${tag}${joined} />`;
      return fits(single) ? [single] : multilineOpen('/>');
    }

    const open = `<${tag}${joined}>`;
    const close = `</${tag}>`;

    if (preservedContent !== undefined) {
      const openLines = fits(`${padding}${open}`)
        ? [`${padding}${open}`]
        : multilineOpen('>');
      const last = openLines.pop()!;
      return [...openLines, `${last}${preservedContent}${close}`];
    }

    if (
      !hasNamedSlots &&
      !snippetChildren &&
      children.every((child) => child.type === 'text')
    ) {
      const text = edgeText(
        children.map((child) => textPiece(child as TextNode)).join(''),
        true,
        true
      );
      const single = `${padding}${open}${text}${close}`;
      if (fits(single)) {
        return [single];
      }
      const openLines = fits(`${padding}${open}`)
        ? [`${padding}${open}`]
        : multilineOpen('>');
      return [
        ...openLines,
        `${padding}${indentation()}${text}`,
        `${padding}${close}`,
      ];
    }

    const openLines = fits(`${padding}${open}`)
      ? [`${padding}${open}`]
      : multilineOpen('>');
    return [
      ...openLines,
      ...childLines,
      ...slotFragments,
      `${padding}${close}`,
    ];
  };

  if (componentValued) {
    const padding = pad(indent);
    const binding = DYNAMIC_ROOT_BINDING;
    const componentTag = runes ? binding : 'svelte:component';
    const componentThis = runes ? [] : [`this={${binding}}`];
    // The string arm's tag reads as an HTML tag name for type-checking: a
    // binding typed `any` or `string` would type the element's attributes as
    // no particular tag's, rejecting a static `type="button"`, while the
    // tag-name union admits any element's attributes and still checks their
    // types.
    const elementThis = `this={${binding} as keyof HTMLElementTagNameMap}`;
    return [
      `${padding}{#if typeof ${binding} === 'string'}`,
      ...assemble('svelte:element', [elementThis], true),
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
    ...withShadowedSlotNames(context, named.slotScope, () =>
      renderNodes(
        named.content,
        `${path}.slots.${named.name}.content`,
        indent + 2,
        context
      )
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
    ...withShadowedSlotNames(context, named.slotScope, () =>
      renderNodes(
        named.content,
        `${path}.slots.${named.name}.content`,
        indent + 2,
        context
      )
    ),
    `${pad(indent + 1)}{/snippet}`,
  ];
}

/** The HTML void elements, which keep the self-closing form. */
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
 * Whether a childless element must render an explicit closing tag:
 * intrinsic non-void elements only. Void elements, component
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

/**
 * The default-value DOM properties, by element, and the attribute each
 * reflects.
 */
const DEFAULT_VALUE_ATTRIBUTES: Record<string, Record<string, string>> = {
  input: { defaultChecked: 'checked', defaultValue: 'value' },
  textarea: { defaultValue: 'value' },
  option: { defaultSelected: 'selected' },
};

/** Matches an identifier or a dot-separated member path: `props.open`. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/** An expression as an operand of `??`, parenthesized unless a member path. */
function operand(expression: string): string {
  const trimmed = expression.trim();
  return IDENTIFIER_PATH.test(trimmed) ? trimmed : `(${trimmed})`;
}

/** A value as an operand: an expression's own, a static value as a literal. */
function valueOperand(value: AttributeValue): string {
  return isExpressionBinding(value)
    ? operand(value.$expression)
    : JSON.stringify(value);
}

/**
 * The `selected` each option below a select with a `defaultValue` takes,
 * recorded when the select's attributes are written, before its options.
 */
const optionSelections = new WeakMap<ElementNode, AttributeValue>();

/**
 * An element's attributes with its default-value properties written so that
 * Svelte's server render, which writes no `defaultChecked` or
 * `defaultValue`, starts the control in its default state:
 * - an input's `defaultChecked` and `defaultValue` and a textarea's
 *   `defaultValue` add the attribute they reflect, `checked` or `value`,
 *   and stay as the property, which the client sets so a form reset
 *   restores the default: `checked={defaultChecked} defaultChecked={...}`.
 *   A bound default with no authored attribute beside it is written once,
 *   so a later change to it leaves a user's edit in place, as an
 *   uncontrolled control does in the other targets: in runes mode the
 *   reflected attribute is the server's alone,
 *   `value={$effect.tracking() ? undefined : defaultName}`, and the client
 *   starts from the property; in legacy mode it reads a value the script
 *   captures once, `value={initialValue}`, except inside an iteration or a
 *   scoped slot, whose locals the script cannot read;
 * - an option's `defaultSelected` is its `selected` (Svelte writes an
 *   unknown `defaultSelected` as a `defaultselected` attribute);
 * - a select's `defaultValue`, which no DOM property carries, marks the
 *   option it matches `selected` (see `selectedOptions`).
 * An authored attribute beside the default wins: a static one stands alone,
 * a bound one reads the default when unset,
 * `checked={checked ?? defaultChecked}`; on a select that is its `value`.
 */
function defaultValueAttributes<T extends Record<string, unknown>>(
  node: ElementNode,
  tag: string | undefined,
  attributes: T,
  conditional = false,
  context?: SvelteContext
): T {
  const reflected = DEFAULT_VALUE_ATTRIBUTES[tag ?? ''];
  let result: Record<string, unknown> = attributes;
  if (
    reflected !== undefined &&
    Object.keys(attributes).some((name) => name in reflected)
  ) {
    result = {};
    const keepsProperty = tag === 'input' || tag === 'textarea';
    for (const [name, value] of Object.entries(attributes)) {
      const attribute = reflected[name];
      if (attribute === undefined) {
        if (!(name in result)) {
          result[name] = value;
        }
        continue;
      }
      const authored = attributes[attribute] as AttributeValue | undefined;
      result[attribute] =
        keepsProperty &&
        !conditional &&
        authored === undefined &&
        context !== undefined &&
        isExpressionBinding(value)
          ? writtenOnce(node, attribute, value.$expression, context)
          : reflectedValue(authored, value as AttributeValue, conditional);
      if (keepsProperty) {
        result[name] = value;
      }
    }
  }
  if (tag === 'select' && !conditional && 'defaultValue' in result) {
    const defaultValue = result.defaultValue as AttributeValue | undefined;
    result = Object.fromEntries(
      Object.entries(result).filter(([name]) => name !== 'defaultValue')
    );
    if (defaultValue !== undefined) {
      const authored = result.value as AttributeValue | undefined;
      if (authored === undefined) {
        const multiple = result.multiple as AttributeValue | undefined;
        for (const [option, selected] of selectedOptions(node, defaultValue, {
          multiple: multiple !== undefined && multiple !== false,
        })) {
          optionSelections.set(option, selected);
        }
      } else {
        result.value = reflectedValue(authored, defaultValue, false);
      }
    }
  }
  if (tag === 'option' && !conditional && optionSelections.has(node)) {
    result = { ...result, selected: optionSelections.get(node) };
  }
  return result as T;
}

/**
 * The nodes inside an iteration or a scoped slot (a node or a named-slot
 * projection with a `slotScope`), whose expressions may read the locals it
 * binds.
 *
 * @param children - The component's top-level nodes.
 * @returns Every node under such a scope.
 */
export function scopedNodesOf(children: readonly unknown[]): Set<object> {
  const scoped = new Set<object>();
  const visit = (value: unknown, inScope: boolean): void => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, inScope);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (inScope) scoped.add(record);
    const opensScope =
      record.type === 'iteration' ||
      (Array.isArray(record.slotScope) && record.slotScope.length > 0);
    for (const [key, entry] of Object.entries(record)) {
      if (key === 'extensions') continue;
      visit(entry, inScope || opensScope);
    }
  };
  visit(children, false);
  return scoped;
}

/**
 * A bound default's reflected attribute, written once (see
 * `defaultValueAttributes`).
 */
function writtenOnce(
  node: ElementNode,
  attribute: string,
  source: string,
  context: SvelteContext
): AttributeValue {
  if (context.mode === 'runes') {
    return {
      $expression: `$effect.tracking() ? undefined : ${operand(source)}`,
    };
  }
  if (context.scopedNodes?.has(node) === true) {
    return { $expression: source };
  }
  const bindings = (context.initialValueBindings ??= []);
  const base = `initial${attribute[0]!.toUpperCase()}${attribute.slice(1)}`;
  let name = base;
  for (
    let count = 2;
    context.takenNames?.has(name) === true ||
    bindings.some((binding) => binding.name === name);
    count += 1
  ) {
    name = `${base}${count}`;
  }
  bindings.push({
    name,
    expression: expression(String(slotValueExpression(source, context))),
  });
  return { $expression: name };
}

/**
 * The reflected attribute's value: the default, unless an authored value
 * stands beside it - a static one alone, a bound one reading the default
 * when unset.
 */
function reflectedValue(
  authored: AttributeValue | undefined,
  value: AttributeValue,
  conditional: boolean
): AttributeValue {
  if (conditional || authored === undefined) {
    return value;
  }
  if (!isExpressionBinding(authored)) {
    return authored;
  }
  return {
    $expression: `${operand(authored.$expression)} ?? ${valueOperand(value)}`,
  };
}

/**
 * Whether the Svelte override removes the node's class (a `null` `class`), so
 * the node renders no class here, a BEM runtime call included.
 *
 * @param node - The element node.
 * @returns `true` when Svelte renders the node with no class.
 */
export function svelteRemovesClass(node: ElementNode): boolean {
  const override = node.extensions?.svelte as SvelteNodeOverrides | undefined;
  return override?.attributes?.class === null;
}

/**
 * Attributes with each bound DOM property that has no attribute, such as an
 * input's `indeterminate`, read as `false` while its value is unset: Svelte
 * leaves a property alone when a spread or a dynamic element gives it
 * `undefined`, so a box that was mixed would stay mixed, where an element's
 * own binding, React and Vue clear it.
 */
function unsetPropertiesCleared(
  attributes: Attributes,
  tag: string
): Attributes {
  if (!Object.keys(attributes).some((name) => isPropertyOnlyName(name, tag))) {
    return attributes;
  }
  return Object.fromEntries(
    Object.entries(attributes).map(([name, value]) => [
      name,
      isPropertyOnlyName(name, tag) &&
      isExpressionBinding(value) &&
      !cannotBeNullish(value.$expression.trim())
        ? { $expression: `${unsetOperand(value.$expression.trim())} ?? false` }
        : value,
    ])
  ) as Attributes;
}

/**
 * Whether an expression's value is certainly neither `null` nor `undefined`,
 * so `?? false` after it is dead code, which TypeScript reports as an error:
 * a boolean literal, a whole `Boolean(...)` call, a `!` negation or a
 * comparison at the top level, each also inside balanced outer parentheses.
 * Anything else may be nullish: a conditional, whose arms are not read, and
 * anything not read for certain (a comment, a regular expression, a template
 * literal).
 */
function cannotBeNullish(expression: string): boolean {
  if (expression === 'true' || expression === 'false') {
    return true;
  }
  if (/[`/]/.test(expression)) {
    return false;
  }
  const opaque = expression.replace(
    /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g,
    "''"
  );
  if (/['"]/.test(opaque.replace(/''/g, ''))) {
    return false;
  }
  let depth = 0;
  let closedAt = -1;
  let equality = false;
  let less = false;
  let greater = false;
  for (let index = 0; index < opaque.length; index += 1) {
    const character = opaque[index];
    if ('([{'.includes(character)) {
      depth += 1;
      continue;
    }
    if (')]}'.includes(character)) {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
      if (depth === 0 && closedAt === -1) {
        closedAt = index;
      }
      continue;
    }
    if (depth > 0) {
      continue;
    }
    const rest = opaque.slice(index);
    const previous = opaque[index - 1] ?? '';
    if (
      /^(?:\?\?|\?(?!\.)|\?\.\d|&&|\|\||,|=>)/.test(rest) ||
      (/^=(?!=)/.test(rest) && !/[=!<>]/.test(previous))
    ) {
      return false;
    }
    const operator = /^(?:[=!]==?|<=?(?!<)|>=?(?!>))/.exec(rest);
    if (operator !== null) {
      if (operator[0].startsWith('<')) {
        less ||= previous !== '<';
      } else if (operator[0].startsWith('>')) {
        greater ||= previous !== '>';
      } else {
        equality = true;
      }
      index += operator[0].length - 1;
    } else if (/^(?:in|instanceof)\b/.test(rest) && !/[\w$.]/.test(previous)) {
      equality = true;
    }
  }
  if (depth !== 0) {
    return false;
  }
  if (opaque.startsWith('(') && closedAt === opaque.length - 1) {
    return cannotBeNullish(expression.slice(1, -1).trim());
  }
  // `<` beside `>` may be type arguments, `read<Flag>(key)`, not a comparison.
  if (equality || less !== greater || opaque.startsWith('!')) {
    return true;
  }
  return /^Boolean\s*\(/.test(opaque) && closedAt === opaque.length - 1;
}

/** An expression as the left operand of `??`, parenthesized unless a member path. */
function unsetOperand(expression: string): string {
  return /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(expression)
    ? expression
    : `(${expression})`;
}

function buildAttributeParts(
  node: ElementNode,
  path: string,
  context: SvelteContext
): string[] {
  const override = node.extensions?.svelte as SvelteNodeOverrides | undefined;
  const intrinsicTag =
    override?.tag === undefined && typeof node.tag === 'string'
      ? node.tag
      : undefined;
  const attributes = unsetPropertiesCleared(
    defaultValueAttributes(
      node,
      intrinsicTag,
      mergeAttributeOverride(node.attributes, override?.attributes),
      false,
      context
    ),
    override?.tag ?? staticTagOf(node.tag)
  );
  const events = override?.events ?? node.events ?? [];
  // Named-slot references in each condition resolve to the mode's
  // slot-presence form here, so attribute/class expressions match the
  // conditional nodes that gate on the same slot. An override removing the
  // node's class takes the condition-gated classes with it; the entries'
  // other attributes stay.
  const conditionals = (
    svelteRemovesClass(node)
      ? withoutConditionalClasses(node.conditionalAttributes ?? [])
      : (node.conditionalAttributes ?? [])
  ).map((conditional) => ({
    ...conditional,
    attributes: defaultValueAttributes(
      node,
      intrinsicTag,
      conditional.attributes,
      true
    ),
    condition: slotPresenceExpression(conditional.condition, context)!,
  }));
  const isPassthrough =
    node === context.passthroughNode ||
    context.surfaceElements?.has(node) === true;
  const isRouted =
    context.routedNode !== undefined && node === context.routedNode;
  // Whether a consumer attribute of this name lands on the routed element
  // rather than the root: a declared prop never reaches either.
  const routes = (name: string): boolean =>
    context.routedEntries !== undefined &&
    !(context.declaredNames?.has(name) ?? false) &&
    isRoutedAttribute(context.routedEntries, name);
  // The attribute names whose consumer value is not in this element's share:
  // a declared prop's, and with a routed element the other element's.
  const outsideShare = {
    has: (name: string): boolean =>
      (context.declaredNames?.has(name) ?? false) ||
      (context.routedEntries !== undefined && routes(name) !== isRouted),
  };
  // Whether an id list this element sets joins the consumer's value of the
  // same name, the element's ids first: on a surface element whose share
  // holds that name.
  const joinsTokenList = (name: string): boolean =>
    (isPassthrough || isRouted) &&
    !outsideShare.has(name) &&
    isTokenListAttribute(name);
  // The consumer `class` (the reserved-word-aliased prop) is appended
  // after the authored expression classes.
  // A passthrough root that also spreads a named record folds each record
  // into the consumer's attributes, as Vue's `mergeProps` does: the classes
  // join, the styles merge, a handler both carry runs both, and the record
  // wins every other key. The combined record is what the root spreads and
  // where its class, style and composed handlers read the consumer's; an
  // authored value's fallback and a joined id list read the consumer's own.
  const passthroughRecords = isPassthrough
    ? nodeSpreads(attributes).filter((source) => source !== 'rest')
    : [];
  const consumerRecord =
    passthroughRecords.length > 0
      ? bindConsumerAndSpread(
          spreadShare(surfaceRest(node, context), context, false),
          passthroughRecords.map((source) => expression(source)),
          context
        )
      : undefined;
  // The consumer share this element's composed handlers read.
  const handlerShare = (): string =>
    isPassthrough && consumerRecord !== undefined
      ? consumerRecord
      : surfaceRest(node, context);
  const consumerClass = !isPassthrough
    ? undefined
    : consumerRecord === undefined
      ? CONSUMER_CLASS_NAME
      : `${consumerRecord}.class`;
  const consumerStyle =
    consumerRecord === undefined ? 'style' : `${consumerRecord}.style`;
  // A component-valued root renders a component on one arm, where a `class:`
  // directive is invalid, so its condition-gated classes join the `class`
  // attribute on both arms instead.
  const classDirectives = !(
    override?.tag === undefined &&
    isDynamicTag(node.tag) &&
    node.tag.componentValued === true
  );

  // In BEM runtime mode this node renders its BEM classes as the `bem(...)`
  // call: the contributed literals are suppressed from the static class list
  // and the folded conditional classes from the conditional rendering. A
  // node whose class the override removes has no call (`svelteRemovesClass`).
  const runtimeCall = context.bemRuntimeCalls?.get(node);
  const runtimeCallExpression =
    runtimeCall === undefined
      ? undefined
      : bemCallExpression(runtimeCall, context);
  const contributedClasses = new Set(runtimeCall?.contributedClasses ?? []);
  const foldedClasses = new Set(runtimeCall?.foldedConditionalClasses ?? []);
  // A conditional class the call already renders - folded into it, or a
  // contributed BEM class - is dropped from the conditional rendering.
  const classConditionals =
    foldedClasses.size === 0 && contributedClasses.size === 0
      ? conditionals
      : conditionals.map((conditional) => ({
          ...conditional,
          attributes: {
            ...conditional.attributes,
            class: normalizeClassList(conditional.attributes.class).filter(
              (className) =>
                !foldedClasses.has(className) &&
                !contributedClasses.has(className)
            ),
          },
        }));

  const parts: string[] = [];
  // Object spreads lead the authored attributes (which override per key).
  parts.push(
    ...nodeSpreads(attributes)
      .filter((source) => !passthroughRecords.includes(source))
      .map((source) => `{...${expression(source)}}`)
  );
  // A class leads the authored attributes, where hand-written markup puts it.
  const attributesStart = parts.length;
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
          classExpressions(classValue),
          runtimeCallExpression,
          consumerClass,
          classDirectives
        )
      );
      classRendered = true;
    } else if (name === 'style') {
      parts.push(
        ...styleParts(
          value as NestedStyleObject,
          context,
          isPassthrough ? consumerStyle : undefined,
          !isPassthrough &&
            context.declaresRest === true &&
            nodeSpreads(attributes).includes('rest')
            ? 'rest.style'
            : undefined
        )
      );
      styleRendered = true;
    } else if (isExpressionBinding(value)) {
      // On a surface element an authored value that resolves to nothing
      // leaves the consumer's attribute of the same name in place.
      const authored = expression(
        String(slotValueExpression(value.$expression, context))
      );
      if (joinsTokenList(name)) {
        // An id list the surface sets keeps its ids and gains the
        // consumer's.
        context.usesAuthoredAndConsumer = true;
        parts.push(
          `${name}={${AUTHORED_AND_CONSUMER}(${authored}, ${surfaceRest(node, context)}, ${quoteSingle(name)})}`
        );
      } else if (
        (isPassthrough || isRouted) &&
        !outsideShare.has(name) &&
        !isSvelteDirective(name)
      ) {
        context.usesAuthoredOrConsumer = true;
        parts.push(
          `${name}={${AUTHORED_OR_CONSUMER}(${authored}, ${surfaceRest(node, context)}, ${quoteSingle(name)})}`
        );
      } else {
        parts.push(`${name}={${authored}}`);
      }
    } else if (typeof value === 'boolean') {
      if (value) {
        parts.push(name);
      }
    } else if (typeof value === 'number') {
      parts.push(`${name}={${value}}`);
    } else if (joinsTokenList(name)) {
      // A static id list on the surface joins the consumer's too.
      context.usesAuthoredAndConsumer = true;
      parts.push(
        `${name}={${AUTHORED_AND_CONSUMER}(${quoteSingle(String(value))}, ${surfaceRest(node, context)}, ${quoteSingle(name)})}`
      );
    } else {
      parts.push(`${name}="${escapeAttributeValue(String(value))}"`);
    }
  }

  if (!classRendered) {
    parts.splice(
      attributesStart,
      0,
      ...classParts(
        [],
        classConditionals,
        [],
        runtimeCallExpression,
        consumerClass,
        classDirectives
      )
    );
  }

  // A component's props are its own: only an element's numeric attributes
  // take a number.
  const renderedTag = override?.tag ?? node.tag;
  const rendersComponent =
    typeof renderedTag === 'string' && /^[A-Z]/.test(renderedTag);
  for (const conditional of conditionals) {
    for (const [name, value] of Object.entries(conditional.attributes)) {
      if (name === 'class' || name === 'style' || value === undefined) {
        continue;
      }
      const conditionalExpression = `${conditional.condition} ? ${conditionalValueExpression(
        rendersComponent ? undefined : name,
        value as AttributeValue
      )} : undefined`;
      if (joinsTokenList(name)) {
        // A condition-gated id list on the surface joins the consumer's too,
        // which stands alone while the condition is false.
        context.usesAuthoredAndConsumer = true;
        parts.push(
          `${name}={${AUTHORED_AND_CONSUMER}(${expression(conditionalExpression)}, ${surfaceRest(node, context)}, ${quoteSingle(name)})}`
        );
        continue;
      }
      parts.push(`${name}={${expression(conditionalExpression)}}`);
    }
  }

  const target = context.plan.get(node);
  if (target?.generatedNodeValue !== undefined) {
    parts.push(`${GENERATED_NODE_ATTRIBUTE}="${target.generatedNodeValue}"`);
  }

  // On a surface root the event attributes share one attribute object with
  // `{...restProperties}`, and on a node spreading `rest` with `{...rest}`,
  // so each composes with the handler the spread carries for the same
  // attribute rather than overwriting it.
  const spreadsRest =
    context.declaresRest === true && nodeSpreads(attributes).includes('rest');
  // A legacy dynamic tag gives a generated wrapper's `event` no contextual
  // type - a `<svelte:element>` whose tag is a union of tag names, or a
  // component-valued root's component arm - so the wrapper annotates it.
  const eventOptions: EventRenderingOptions = {
    typedEventParameter: context.mode !== 'runes' && isDynamicTag(node.tag),
  };
  const attributeEventParts = (): string[] =>
    runesEventAttributes(
      events,
      // A discriminated branch reads the rest as its own tag's attributes,
      // as its spread does.
      isPassthrough || isRouted
        ? handlerShare()
        : spreadsRest
          ? 'rest'
          : undefined,
      isPassthrough || isRouted ? outsideShare : context.declaredNames,
      eventOptions
    ).map((emission) => {
      if (emission.usesOnceHelper) {
        context.usesOnceHelper = true;
      }
      if (emission.usesPassiveAttachment) {
        context.usesPassiveAttachment = true;
      }
      if (emission.usesComposeHelper) {
        context.usesComposeHelper = true;
      }
      return emission.part;
    });
  if (context.mode === 'runes') {
    parts.push(...attributeEventParts());
  } else {
    // Legacy `on:` directives attach as their own listeners beside the
    // spread and need no composition.
    const directives = events.map((event) =>
      eventAttribute(event, eventOptions)
    );
    parts.push(...directives);
    if (!classDirectives && events.length > 0) {
      // On a component-valued root's component arm an `on:` directive is a
      // component event, which reaches the element only when the component
      // forwards it. That arm passes the handlers as event-attribute props
      // instead, as runes mode does, composed with the consumer's handlers
      // in `$$restProps`; a component that spreads its rest onto an element
      // attaches them there.
      context.componentArmEvents.set(node, {
        directives,
        attributes: attributeEventParts(),
      });
    }
  }

  if (isRouted) {
    // The consumer's routed attributes lead, so the authored ones override
    // them per key, as on the root; a routed handle binds here.
    parts.unshift(
      `{...${spreadShare(surfaceRest(node, context), context, true)}}`
    );
    if (context.routedHandle === true) {
      parts.push('bind:this={element}');
    }
  }

  if (isPassthrough) {
    // Spread the consumer's undeclared attributes first so the authored
    // attributes above win per key; forward a consumer `style` not already
    // merged into an authored one; bind the DOM handle.
    parts.unshift(
      `{...${consumerRecord ?? spreadShare(surfaceRest(node, context), context, false)}}`
    );
    if (!styleRendered) {
      parts.push(`style={${consumerStyle}}`);
    }
    if (context.routedHandle !== true) {
      parts.push('bind:this={element}');
    }
  }

  return parts;
}

/**
 * Binds a passthrough root's consumer attributes combined with its spread
 * records, once per distinct combination, and returns the binding's name:
 * `restAndSpread`, then `restAndSpread2` for a second one.
 */
function bindConsumerAndSpread(
  rest: string,
  records: readonly string[],
  context: SvelteContext
): string {
  const bindings =
    context.consumerAndSpreadBindings ??
    (context.consumerAndSpreadBindings = new Map());
  const call = `${CONSUMER_AND_SPREAD}({ ...${rest}, class: ${CONSUMER_CLASS_NAME}, style }, ${records.join(', ')})`;
  const bound = bindings.get(call);
  if (bound !== undefined) return bound;
  const name =
    bindings.size === 0
      ? CONSUMER_AND_SPREAD_BINDING
      : `${CONSUMER_AND_SPREAD_BINDING}${bindings.size + 1}`;
  bindings.set(call, name);
  return name;
}

/** One part of a Svelte `class` attribute, in concatenation order. */
type ClassPiece =
  | { kind: 'static'; text: string }
  | { kind: 'runtime'; source: string }
  | { kind: 'conditional'; condition: string; text: string }
  | { kind: 'expression'; source: string }
  | { kind: 'consumer'; source: string };

/** The passthrough root's consumer class: the reserved-word-aliased prop. */
const CONSUMER_CLASS_NAME = 'className';

/** Matches a Svelte directive name: `bind:value`, `use:portal`, `class:active`. */
const SVELTE_DIRECTIVE =
  /^(bind|on|use|transition|in|out|animate|class|style|let):/;

/**
 * True when an attribute name is a Svelte directive rather than an
 * attribute. A directive never reaches the consumer's rest spread, so it
 * takes no `authoredOrConsumer` fallback - and the helper call would not
 * compile in a `bind:` position, which needs an assignable expression.
 */
function isSvelteDirective(name: string): boolean {
  return SVELTE_DIRECTIVE.test(name);
}

/**
 * Characters a `class:` directive name cannot carry: Svelte ends an
 * attribute name at whitespace, `=`, `>` or `/`, reads `|` as a modifier, and
 * quotes, braces and backslashes cannot appear in one.
 */
const NON_DIRECTIVE_CHARACTERS = /[\s=<>/|"'`{}\\]/;

/**
 * True when a class name can be a `class:NAME` directive.
 *
 * @param className - The class name.
 * @returns Whether Svelte reads the name back verbatim as a directive.
 */
function isDirectiveClassName(className: string): boolean {
  return !NON_DIRECTIVE_CHARACTERS.test(className);
}

/**
 * Escapes static class names for a quoted Svelte attribute: the minimal
 * markup escaping, plus `{`, which would open an expression.
 */
function escapeClassText(text: string, quote: '"' | "'"): string {
  return escapeClassAttributeValue(text, quote).replace(/\{/g, '&#123;');
}

/**
 * Builds the class attribute parts: a `class:NAME={condition}` directive
 * for each condition-gated class whose name a directive can carry, and a
 * `class` attribute from the rest - static classes, the BEM runtime call,
 * condition-gated classes that cannot be directives, and expression
 * classes, in the fixed concatenation order. A conditional class is dropped
 * when a static class carries it; one repeated across conditional entries
 * applies whenever any of its conditions holds. Plain-reference expression
 * classes carry a guarded `{...}` interpolation so a falsy runtime value
 * contributes nothing; once any other expression joins, the attribute
 * renders as an array joined after dropping its falsy entries, so each
 * expression is evaluated exactly once. The passthrough root's consumer
 * class, when given, joins last; standing alone it binds bare. Without
 * `useDirectives` (a component-valued root, whose component arm takes no
 * directive) every condition-gated class joins the `class` attribute.
 */
function classParts(
  staticClasses: string[],
  conditionals: ConditionalAttributes[],
  expressionClasses: string[],
  runtimeCall?: string,
  consumerClass?: string,
  useDirectives = true
): string[] {
  const pieces: ClassPiece[] = [];
  const directives: string[] = [];
  if (staticClasses.length > 0) {
    pieces.push({ kind: 'static', text: staticClasses.join(' ') });
  }
  if (runtimeCall !== undefined) {
    pieces.push({ kind: 'runtime', source: expression(runtimeCall) });
  }
  for (const group of groupConditionalClasses(conditionals, staticClasses)) {
    const condition = expression(joinConditions(group.conditions));
    const interpolated: string[] = [];
    for (const className of group.classes) {
      if (useDirectives && isDirectiveClassName(className)) {
        directives.push(`class:${className}={${condition}}`);
      } else {
        interpolated.push(className);
      }
    }
    if (interpolated.length > 0) {
      pieces.push({
        kind: 'conditional',
        condition,
        text: interpolated.join(' '),
      });
    }
  }
  for (const classExpression of expressionClasses) {
    pieces.push({ kind: 'expression', source: expression(classExpression) });
  }
  if (consumerClass !== undefined) {
    pieces.push({ kind: 'consumer', source: consumerClass });
  }

  // Without directives, a class made only of guarded pieces can come out
  // empty; it then binds `undefined`, so no `class=""` is written.
  const mayBeEmpty =
    !useDirectives &&
    pieces.every(
      (piece) => piece.kind !== 'static' && piece.kind !== 'runtime'
    );
  const classAttribute = classAttributePart(
    pieces,
    !expressionClasses.every(isReferenceExpression),
    mayBeEmpty
  );
  return classAttribute === undefined
    ? directives
    : [classAttribute, ...directives];
}

/** Renders the `class` attribute from its pieces, if there are any; one that
 *  `mayBeEmpty` binds `undefined` in place of an empty string. */
function classAttributePart(
  pieces: ClassPiece[],
  evaluateOnce: boolean,
  mayBeEmpty = false
): string | undefined {
  if (pieces.length === 0) {
    return undefined;
  }

  if (evaluateOnce || mayBeEmpty) {
    const entries = pieces.map((piece) => {
      switch (piece.kind) {
        case 'static':
          return classStringLiteral(piece.text);
        case 'conditional':
          return `${piece.condition} ? ${classStringLiteral(piece.text)} : ''`;
        default:
          return piece.source;
      }
    });
    const joined = `[${entries.join(', ')}].filter(Boolean).join(' ')`;
    return mayBeEmpty ? `class={${joined} || undefined}` : `class={${joined}}`;
  }

  if (pieces.length === 1) {
    const [piece] = pieces;
    switch (piece.kind) {
      case 'static': {
        const quote = classAttributeQuote(piece.text);
        return `class=${quote}${escapeClassText(piece.text, quote)}${quote}`;
      }
      case 'runtime':
        // The runtime call always yields a non-empty string, so it carries
        // no falsy guard.
        return `class={${piece.source}}`;
      case 'conditional':
        return `class={${piece.condition} ? ${classStringLiteral(piece.text)} : ''}`;
      case 'expression':
        return `class={${piece.source} || ''}`;
      case 'consumer':
        // The consumer's class is a string or `undefined`, so it binds bare.
        return `class={${piece.source}}`;
    }
  }

  // Svelte reads each `{...}` with its JavaScript parser, so only the static
  // text decides the attribute's quote.
  const staticText = pieces
    .map((piece) => (piece.kind === 'static' ? piece.text : ''))
    .join('');
  const quote = classAttributeQuote(staticText);
  let value = '';
  pieces.forEach((piece, index) => {
    const leading = index === 0;
    switch (piece.kind) {
      case 'static':
        value += escapeClassText(piece.text, quote);
        break;
      case 'runtime':
        value += `${leading ? '' : ' '}{${piece.source}}`;
        break;
      case 'conditional': {
        const text = `${leading ? '' : ' '}${piece.text}`;
        value += `{${piece.condition} ? ${classStringLiteral(text)} : ''}`;
        break;
      }
      case 'expression':
      case 'consumer':
        // As the leading operand the reference is coerced by `|| ''`.
        value += leading
          ? `{${piece.source} || ''}`
          : `{${piece.source} ? ' ' + ${piece.source} : ''}`;
        break;
    }
  });
  return `class=${quote}${value}${quote}`;
}

/**
 * Builds the style attribute parts. A whole-object expression renders
 * through the generated style serializer (`style={serializeStyleObject(...)}`).
 * Expression-valued properties always render as `style:property` directives -
 * they go through Svelte's dynamic style mechanism regardless of the stylesheet
 * placement - while static plain properties render as a static `style="..."`
 * attribute only under the `inline` placement (and only when no nested
 * selectors force the style to a stylesheet).
 *
 * On a passthrough root the consumer's style string comes last in the
 * `style` attribute, after the whole-object and static declarations. A
 * directive outranks the attribute and removes its declaration of the same
 * property, so each directive takes the consumer's value for its property
 * when the consumer declares one, through the generated `consumerStyleValue`
 * helper - `style:--size={consumerStyleValue(style, '--size') ?? size}` - and
 * the consumer wins, as in React and Vue.
 *
 * On a node spreading `rest` (`restStyle`), the spread carries the
 * consumer's style attribute, which survives where the node writes no
 * `style` attribute of its own or writes one reading `rest.style`
 * (`[{ gap }, rest.style]`); there each directive takes the consumer's value
 * the same way.
 */
function styleParts(
  style: NestedStyleObject,
  context: SvelteContext,
  consumerStyle?: string,
  restStyle?: string
): string[] {
  const parts: string[] = [];
  const wholeExpression = wholeStyleExpression(style);
  const includeStatic =
    context.stylingInline &&
    !hasNestedSelectors(style) &&
    hasPlainProperties(style);
  const expressionProperties = Object.entries(style).filter(
    (entry): entry is [string, { $expression: string }] =>
      entry[0] !== '$expression' && isExpressionBinding(entry[1])
  );

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
  if (
    serialized !== undefined &&
    !includeStatic &&
    consumerStyle === undefined
  ) {
    // A lone whole-object expression keeps the bare `style={...}` form.
    parts.push(`style={${serialized}}`);
    stringStyleEmitted = true;
  } else if (serialized !== undefined || includeStatic) {
    const segments: string[] = [];
    if (serialized !== undefined) {
      segments.push(`{${serialized}}`);
    }
    if (includeStatic) {
      // A whole-object expression carrying a `rest` node's consumer style
      // comes after the static declarations, so the consumer's wins.
      const staticSegment = escapeAttributeValue(serializeInlineStyle(style));
      if (restStyle !== undefined && readsRest(wholeExpression, 'style')) {
        segments.unshift(staticSegment);
      } else {
        segments.push(staticSegment);
      }
    }
    const base = segments.join('; ');
    parts.push(
      consumerStyle !== undefined
        ? `style="${base}{${consumerStyle} ? '; ' + ${consumerStyle} : ''}"`
        : `style="${base}"`
    );
    stringStyleEmitted = true;
  }

  // The consumer's style each directive defers to: a passthrough root's, or
  // the one a `rest` spread carries while no own attribute replaces it.
  const directiveConsumerStyle =
    consumerStyle ??
    (restStyle !== undefined &&
    (!stringStyleEmitted || readsRest(wholeExpression, 'style'))
      ? restStyle
      : undefined);
  for (const [property, value] of expressionProperties) {
    const name = toKebabCaseProperty(property);
    const authored = expression(value.$expression);
    if (directiveConsumerStyle === undefined) {
      parts.push(`style:${name}={${authored}}`);
    } else {
      context.usesConsumerStyleValue = true;
      parts.push(
        `style:${name}={${CONSUMER_STYLE_VALUE_NAME}(${directiveConsumerStyle}, ${quoteSingle(name)}) ?? ${/^[\w$.]+$/.test(authored) ? authored : `(${authored})`}}`
      );
    }
  }
  // The consumer style still needs a carrier when the authored style emitted
  // nothing inline.
  if (!stringStyleEmitted && consumerStyle !== undefined) {
    parts.push(`style={${consumerStyle}}`);
  }
  return parts;
}

/**
 * The attributes Svelte's element types declare as `number` only
 * (`tabindex?: number | undefined | null`). svelte-check accepts a static
 * numeric string on one of them, but a string inside an expression fails it.
 */
const NUMERIC_SVELTE_ATTRIBUTES: ReadonlySet<string> = new Set([
  'aria-colcount',
  'aria-colindex',
  'aria-colspan',
  'aria-level',
  'aria-posinset',
  'aria-rowcount',
  'aria-rowindex',
  'aria-rowspan',
  'aria-setsize',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'border',
  'cols',
  'colspan',
  'currenttime',
  'defaultplaybackrate',
  'high',
  'low',
  'marginheight',
  'marginwidth',
  'maxlength',
  'minlength',
  'optimum',
  'results',
  'rows',
  'rowspan',
  'size',
  'span',
  'start',
  'tabindex',
  'volume',
]);

/** A decimal number written as a string: `'0'`, `'-1'`, `'2.5'`. */
const NUMERIC_STRING = /^-?(?:\d+|\d*\.\d+)$/;

/**
 * A conditional attribute's value as an expression. A numeric string on an
 * element attribute typed as a number only (`name` is `undefined` on a
 * component reference) is written as the number.
 */
function conditionalValueExpression(
  name: string | undefined,
  value: AttributeValue
): string {
  if (isExpressionBinding(value)) {
    return value.$expression.trim();
  }
  if (typeof value === 'string') {
    return name !== undefined &&
      NUMERIC_SVELTE_ATTRIBUTES.has(name) &&
      NUMERIC_STRING.test(value)
      ? String(Number(value))
      : quoteSingle(value);
  }
  return String(value);
}
