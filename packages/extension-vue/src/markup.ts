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
  wholeStyleExpression,
  type BemRuntimeCall,
  type TargetPlan,
} from '@js-template-engine/core';
import {
  AUTHORED_AND_CONSUMER,
  camelizePropName,
  INVOKE_HANDLER,
  AUTHORED_OR_CONSUMER,
  CONSUMER_ATTRIBUTES,
  classStringLiteral,
  escapeComment,
  fragmentWrapper,
  groupConditionalClasses,
  isRoutedAttribute,
  isTokenListAttribute,
  mergeAttributeOverride,
  selectedOptions,
  joinConditions,
  joinSiblingLines,
  quoteClassAttributeValue,
  withoutConditionalClasses,
  withShadowedSlotNames,
  tagLines,
  textLines,
  type SiblingLines,
} from '@js-template-engine/core/emitter';
import type {
  Attributes,
  AttributeValue,
  ConditionalAttributes,
  ConditionalNode,
  ElementNode,
  EventDefinition,
  ExpressionBinding,
  IterationNode,
  NestedStyleObject,
  SlotNode,
  TemplateNode,
  TextNode,
  Warning,
} from '@js-template-engine/types';

import {
  consumerListenerKey,
  eventAttributes,
  isTypedElementEvent,
} from './events';
import {
  directiveValue,
  escapeAttributeValue,
  escapeText,
  interpolation,
  quoteSingle,
  recordExpression,
  withTemplateLocals,
} from './literals';
import type { VueNodeOverrides } from './overrides';

/** Everything the template renderer needs besides the nodes themselves. */
export interface VueContext {
  plan: TargetPlan;
  /** True when the stylesheet placement is `inline`. */
  stylingInline: boolean;
  /** The declared named-slot names, for slot-presence conditions. */
  namedSlots: ReadonlySet<string>;
  /**
   * The branch surface elements of a discriminated surface root. Each renders
   * with an explicit `v-bind="$attrs"` so the consumer's fallthrough attributes
   * reach it under `inheritAttrs: false` (two roots disable auto-inheritance).
   */
  surfaceElements?: ReadonlySet<ElementNode>;
  /**
   * The element of a conditional passthrough root, if the component has one.
   * Its branch puts `v-if` on the element itself, with the branch's comments
   * before it, so a template ref's `$el` is the element while it renders.
   */
  conditionalPassthroughElement?: ElementNode;
  /** The component's declared prop names: never in `$attrs`, so an attribute
   *  of one of these names takes no fallback to it. */
  declaredNames?: ReadonlySet<string>;
  /**
   * The element below the passthrough root that takes the consumer's routed
   * attributes (`passthrough: { attributes }`), if any. It binds
   * `consumerAttributes($attrs, 'routed')` and the root
   * `consumerAttributes($attrs, 'root')`, each in the place `$attrs` takes.
   */
  routedNode?: ElementNode;
  /** The routed element's routing entries. */
  routedEntries?: readonly string[];
  /**
   * Whether the component's handle is the routed element
   * (`handle: 'routed'`): it carries `v-routed-element`, which records it in
   * `routedElement`, the `$el` `<script setup>` exposes.
   */
  routedHandle?: boolean;
  /** Set when an id list a surface element sets joins the consumer's
   *  through the generated `authoredAndConsumer` helper, so `<script setup>`
   *  declares it. */
  usesAuthoredAndConsumer?: boolean;
  /** Whether a passthrough root without a routed element binds its
   *  `$attrs` through the generated `consumerAttributes` helper. */
  usesConsumerAttributes?: boolean;
  /**
   * Whether the component declares `rest`: a node that spreads exactly `rest`
   * binds its own listeners after the spread, as a surface element binds
   * them after `$attrs`, so the consumer's handler runs first.
   */
  declaresRest?: boolean;
  /** Set when a surface attribute resolves through the generated
   *  `authoredOrConsumer` helper, so `<script setup>` declares it. */
  usesAuthoredOrConsumer?: boolean;
  /** Set when an event composes with the consumer's handler through the
   *  generated `unlessDefaultPrevented` helper, so `<script setup>`
   *  declares it. */
  usesUnlessDefaultPrevented?: boolean;
  /** Set when a key-guarded binding calls its handler through the generated
   *  `invokeHandler` helper, so `<script setup>` declares it. */
  usesInvokeHandler?: boolean;
  /**
   * How many composing one-shot listeners the component has, each keyed by
   * its index in the generated `usedOnceListeners` record, which
   * `<script setup>` declares, with its `claimOnceListener` helper, when
   * there is any.
   */
  onceListenerCount?: number;
  /** Set when an element binds a DOM property through the generated
   *  `definedProperties` helper, so `<script setup>` declares it. */
  usesDefinedProperties?: boolean;
  /** Set when a surface element's `$attrs` merge with a `$spread` through
   *  Vue's `mergeProps`, so `<script setup>` imports it. */
  usesMergeProps?: boolean;
  /**
   * Per-element BEM runtime calls, set when a styling extension is in runtime
   * mode. A node present here renders its BEM classes as the `bem(...)` call
   * instead of the literal classes.
   */
  bemRuntimeCalls?: ReadonlyMap<ElementNode, BemRuntimeCall>;
  warnings: Warning[];
}

const INDENTATION = '  ';
const MAXIMUM_WIDTH = 80;

/**
 * Inside a `<pre>` or `<textarea>`, Vue keeps every whitespace character, so
 * while one's content renders, nothing is indented or wrapped: each node
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

/** Renders template nodes as Vue template lines at the given indent level. */
export function renderNodes(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: VueContext
): string[] {
  return renderSiblings(nodes, path, indent, context).lines;
}

/**
 * Renders sibling nodes, text joined to its neighbors on one line: Vue drops
 * whitespace holding a line break between two elements, but keeps it as a
 * space beside text. Inside a whitespace-preserving element nothing is
 * indented, and the lines join with nothing between them.
 */
function renderSiblings(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: VueContext
): SiblingLines {
  return layoutSiblings(
    nodes,
    path,
    indent,
    context,
    preservingWhitespace > 0 ? new Set() : condensedAwayText(nodes)
  );
}

/** The siblings of one parent, or of a fragment that renders in its place. */
function layoutSiblings(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: VueContext,
  condensedAway: ReadonlySet<TextNode>
): SiblingLines {
  const parts = nodes.flatMap((node, index) =>
    renderNode(
      node,
      joinPath(path, `[${index}]`),
      indent,
      context,
      condensedAway
    )
  );
  if (preservingWhitespace > 0) {
    return tagLines(parts.flatMap((part) => part.lines));
  }
  return joinSiblingLines(parts, 'between-tags');
}

/**
 * Opening lines, content and a closing line, joined: text at either end of
 * the content holds to the tag beside it, since Vue keeps whitespace holding
 * a line break there as a space.
 */
function wrapChildren(
  open: string[],
  children: SiblingLines,
  close: string
): string[] {
  return joinSiblingLines(
    [tagLines(open), children, tagLines([close])],
    'between-tags'
  ).lines;
}

/** What Vue's parser sees a rendered node as, for whitespace condensing. */
type ParsedSibling =
  | { kind: 'text'; node: TextNode }
  | { kind: 'interpolation' | 'comment' | 'element' };

/** The nodes of one parent as its parser sees them, fragments flattened. */
function parsedSiblings(nodes: readonly TemplateNode[]): ParsedSibling[] {
  return nodes.flatMap((node): ParsedSibling[] => {
    if (node.type === 'fragment') {
      return fragmentWrapper(node, 'vue') === undefined
        ? parsedSiblings(node.children)
        : [{ kind: 'element' }];
    }
    if (node.type === 'text') {
      if (node.content === undefined) {
        return [{ kind: 'interpolation' }];
      }
      return node.content === '' ? [] : [{ kind: 'text', node }];
    }
    return [{ kind: node.type === 'comment' ? 'comment' : 'element' }];
  });
}

/** The whitespace Vue's parser counts as such, which excludes a `&nbsp;`. */
const ONLY_WHITESPACE = /^[ \t\r\n\f]+$/;

/**
 * The whitespace-only text one parsed sibling list loses to Vue's parser: at
 * the start or end of its parent's content, between a comment and a comment
 * or an element, and, holding a line break, between two elements. Adjacent
 * text is one node to the parser, so a run is judged whole.
 */
function removedWhitespace(siblings: readonly ParsedSibling[]): TextNode[] {
  const removed: TextNode[] = [];
  let index = 0;
  while (index < siblings.length) {
    if (siblings[index].kind !== 'text') {
      index += 1;
      continue;
    }
    const start = index;
    const run: TextNode[] = [];
    for (; index < siblings.length; index += 1) {
      const sibling = siblings[index];
      if (sibling.kind !== 'text') {
        break;
      }
      run.push(sibling.node);
    }
    const content = run.map((node) => node.content).join('');
    if (!ONLY_WHITESPACE.test(content)) {
      continue;
    }
    const previous = siblings[start - 1]?.kind;
    const next = siblings[index]?.kind;
    if (
      previous === undefined ||
      next === undefined ||
      (previous === 'comment' && (next === 'comment' || next === 'element')) ||
      (previous === 'element' &&
        (next === 'comment' || (next === 'element' && /[\r\n]/.test(content))))
    ) {
      removed.push(...run);
    }
  }
  return removed;
}

/**
 * The whitespace-only text Vue's compiler would remove from one parent's
 * content, whether it keeps comments, as in development, or strips them, as
 * a production build does. Elsewhere, an interpolation beside it included,
 * Vue keeps the space, and the text is written as authored.
 */
function condensedAwayText(nodes: readonly TemplateNode[]): Set<TextNode> {
  const siblings = parsedSiblings(nodes);
  return new Set([
    ...removedWhitespace(siblings),
    ...removedWhitespace(
      siblings.filter((sibling) => sibling.kind !== 'comment')
    ),
  ]);
}

/** Whitespace as a string literal, written where the parser cannot remove it. */
function whitespaceLiteral(content: string): string {
  const escaped = content
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\f/g, '\\f');
  return `'${escaped}'`;
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
  context: VueContext,
  condensedAway: ReadonlySet<TextNode>
): SiblingLines[] {
  const padding = pad(indent);
  switch (node.type) {
    case 'element':
      return [tagLines(renderElement(node, path, indent, context))];
    case 'text':
      return [textLines(padding, textPiece(node, condensedAway.has(node)))];
    case 'comment':
      return [tagLines([`${padding}<!-- ${escapeComment(node.content)} -->`])];
    case 'fragment': {
      const wrapper = fragmentWrapper(node, 'vue');
      if (wrapper !== undefined) {
        return [tagLines(renderElement(wrapper, path, indent, context))];
      }
      return [
        layoutSiblings(
          node.children,
          `${path}.children`,
          indent,
          context,
          condensedAway
        ),
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

function textPiece(node: TextNode, condensedAway: boolean): string {
  if (node.content !== undefined) {
    return condensedAway
      ? interpolation(whitespaceLiteral(node.content))
      : escapeText(node.content);
  }
  return interpolation(String(node.expression));
}

function renderConditional(
  node: ConditionalNode,
  path: string,
  indent: number,
  context: VueContext
): string[] {
  const padding = pad(indent);
  const lines: string[] = [];

  node.conditions.forEach((branch, index) => {
    const directive =
      branch.statement === 'else'
        ? 'v-else'
        : `v-${branch.statement === 'if' ? 'if' : 'else-if'}=${directiveValue(
            conditionExpression(branch, context)
          )}`;
    const childPath = `${path}.conditions[${index}].children`;

    // A conditional passthrough root's element carries the directive itself
    // and its branch's comments go before it: a `<template v-if>` around
    // them would render a fragment, whose `$el` is a text anchor.
    const surfaceIndex =
      context.conditionalPassthroughElement === undefined
        ? -1
        : branch.children.indexOf(context.conditionalPassthroughElement);
    if (surfaceIndex !== -1) {
      for (const child of branch.children) {
        if (child.type === 'comment') {
          lines.push(`${padding}<!-- ${escapeComment(child.content)} -->`);
        }
      }
      lines.push(
        ...renderElement(
          branch.children[surfaceIndex] as ElementNode,
          `${childPath}[${surfaceIndex}]`,
          indent,
          context,
          [directive]
        )
      );
      return;
    }

    // A directive sits on a lone element, a fragment's wrapper included; a
    // fragment with no wrapper has no tag to carry it, so its children go in
    // a `<template>` like several children.
    const element =
      branch.children.length === 1
        ? loneElementOf(branch.children[0])
        : undefined;
    if (element !== undefined) {
      lines.push(
        ...renderElement(element, `${childPath}[0]`, indent, context, [
          directive,
        ])
      );
    } else {
      lines.push(
        ...wrapChildren(
          [`${padding}<template ${directive}>`],
          renderSiblings(branch.children, childPath, indent + 1, context),
          `${padding}</template>`
        )
      );
    }
  });

  return lines;
}

/**
 * The element a conditional branch's or a loop's lone child renders as in
 * Vue, carrying the branch's or loop's directives: an element, or a
 * fragment's Vue wrapper. A fragment with no wrapper renders none.
 */
function loneElementOf(node: TemplateNode): ElementNode | undefined {
  return node.type === 'element' ? node : fragmentWrapper(node, 'vue');
}

/** Vue's slot-presence form for a named slot. */
function vuePresence(slotName: string): string {
  return `$slots.${slotName}`;
}

/**
 * The expression a branch condition emits. A reference to a declared named
 * slot becomes that slot's Vue presence check (`$slots.<name>`), since the
 * bare slot name is not a declared prop; the rest of the condition is emitted
 * verbatim.
 */
function conditionExpression(
  branch: ConditionalNode['conditions'][number],
  context: VueContext
): string {
  return String(
    rewriteSlotReferences(branch.condition, context.namedSlots, vuePresence)
  );
}

/**
 * The runtime `bem(...)` call for a node, with named-slot references in its
 * conditional modifiers resolved to Vue's `$slots.<name>` presence form - the
 * same resolution the conditional nodes apply.
 */
function bemCallExpression(
  runtimeCall: BemRuntimeCall,
  context: VueContext
): string {
  return formatBemCall(
    runtimeCall.elementName,
    runtimeCall.staticModifiers,
    runtimeCall.conditionalModifiers.map((modifier) => ({
      modifier: modifier.modifier,
      condition: rewriteSlotReferences(
        modifier.condition,
        context.namedSlots,
        vuePresence
      )!,
    }))
  );
}

/**
 * Renders a subtree a `slotScope` binds names in: they shadow a named slot
 * of the same name there, and are template locals for the globals the
 * subtree's expressions read.
 */
function withScopeLocals<Result>(
  context: VueContext,
  names: readonly string[],
  render: () => Result
): Result {
  return withTemplateLocals(names, () =>
    withShadowedSlotNames(context, names, render)
  );
}

function renderIteration(
  node: IterationNode,
  path: string,
  indent: number,
  context: VueContext
): string[] {
  // The loop item and index are template locals for every expression the
  // loop binds, its `v-for` and `:key` included; the source the loop reads
  // is outside them (`document in document.forms` reads the global).
  recordExpression(node.items);
  return withTemplateLocals([node.item, node.index], () =>
    renderIterationScope(node, path, indent, context)
  );
}

function renderIterationScope(
  node: IterationNode,
  path: string,
  indent: number,
  context: VueContext
): string[] {
  const padding = pad(indent);
  const iterator =
    node.index === undefined
      ? `${node.item} in ${node.items}`
      : `(${node.item}, ${node.index}) in ${node.items}`;
  const directives = [`v-for=${directiveValue(iterator)}`];

  if (node.key !== undefined) {
    directives.push(`:key=${directiveValue(node.key)}`);
  } else {
    context.warnings.push({
      message:
        "Iteration has no 'key' expression; Vue list items render without keys",
      nodePath: path,
    });
  }

  const childPath = `${path}.children`;
  // The loop item and index shadow a named slot of the same name inside the
  // loop, the element carrying `v-for` included.
  return withShadowedSlotNames(context, [node.item, node.index], () => {
    const element =
      node.children.length === 1 ? loneElementOf(node.children[0]) : undefined;
    if (element !== undefined) {
      return renderElement(
        element,
        `${childPath}[0]`,
        indent,
        context,
        directives
      );
    }

    return wrapChildren(
      [`${padding}<template ${directives.join(' ')}>`],
      renderSiblings(node.children, childPath, indent + 1, context),
      `${padding}</template>`
    );
  });
}

function renderSlot(
  node: SlotNode,
  path: string,
  indent: number,
  context: VueContext
): string[] {
  const padding = pad(indent);
  const slotAttributes: string[] = [];
  if (node.name !== undefined) {
    slotAttributes.push(`name="${escapeAttributeValue(node.name)}"`);
  }
  // A scoped slot binds its exposed values on the `<slot>` element. A value
  // exposed as `name` goes through `v-bind`, since `:name` on `<slot>` is the
  // slot's own name.
  for (const binding of normalizeExposes(node.exposes)) {
    slotAttributes.push(
      binding.name === 'name'
        ? `v-bind=${directiveValue(`{ name: ${binding.value.trim()} }`)}`
        : `:${binding.name}=${directiveValue(binding.value)}`
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

  // Text, alone or beside other nodes, holds to the tags around it.
  return wrapChildren(
    [`${padding}${open}`],
    renderSiblings(fallback, `${path}.fallback`, indent + 1, context),
    `${padding}${close}`
  );
}

function renderElement(
  node: ElementNode,
  path: string,
  indent: number,
  context: VueContext,
  directives: string[] = []
): string[] {
  const padding = pad(indent);
  // A per-target `tag` override replaces the element wholesale (a capitalized
  // value renders as a component reference, e.g. the built-in `Teleport`) and
  // suppresses the dynamic-tag path. Otherwise a dynamic tag renders as
  // `<component :is="...">`; the `:is` binding leads the attributes, the
  // expression emitted verbatim.
  const tagOverride = (node.extensions?.vue as VueNodeOverrides | undefined)
    ?.tag;
  const dynamic =
    tagOverride === undefined && isDynamicTag(node.tag) ? node.tag : undefined;
  const tag = tagOverride ?? (dynamic ? 'component' : node.tag);
  const isBinding = dynamic
    ? [`:is=${directiveValue(dynamic.$expression)}`]
    : [];
  const ownChildren = node.children ?? [];
  const defaultText =
    ownChildren.length === 0
      ? textareaDefaultText(
          node,
          isIntrinsicElement(node),
          mergeAttributeOverride(
            node.attributes,
            (node.extensions?.vue as VueNodeOverrides | undefined)?.attributes
          )
        )
      : undefined;
  const children = defaultText === undefined ? ownChildren : [defaultText];
  // A component-reference node with `slots` projects content into the composed
  // component's named slots, each rendered as a `<template #name>` child;
  // scoped named slots receive their scope through `#name="{ ... }"`.
  const namedSlots = normalizeNamedSlots(node.slots);
  const hasNamedSlots = namedSlots.length > 0;
  const defaultSlotScope =
    node.slotScope !== undefined && node.slotScope.length > 0
      ? `{ ${node.slotScope.join(', ')} }`
      : undefined;
  // A component-reference node with `slotScope` receives the composed
  // component's default scoped slot via `v-slot`, scoping its children. Beside
  // named slots this moves into `<template #default>` (a tag-level `v-slot` is
  // invalid alongside named templates).
  const slotScopeBinding =
    defaultSlotScope !== undefined && !hasNamedSlots
      ? [`v-slot="${defaultSlotScope}"`]
      : [];
  const parts = mergeSpreads(
    [
      ...directives,
      ...isBinding,
      ...slotScopeBinding,
      ...buildAttributeParts(node, path, context),
    ],
    context
  );
  const joined = parts.length > 0 ? ` ${parts.join(' ')}` : '';

  const multilineOpen = (closer: string): string[] => [
    `${padding}<${tag}`,
    ...parts.map((part) => `${padding}${indentation()}${part}`),
    `${padding}${closer}`,
  ];

  if (children.length === 0 && !hasNamedSlots) {
    const single = `${padding}<${tag}${joined} />`;
    return fits(single) ? [single] : multilineOpen('/>');
  }

  const open = `<${tag}${joined}>`;
  const close = `</${tag}>`;

  // A literal `<pre>` or `<textarea>` renders its content exactly: on the
  // opening tag's last line, with nothing added. The tag's own attributes may
  // still wrap, since whitespace inside a tag does not render. Content that
  // begins with a line break gets one more, since Vue's compiler drops the
  // first line break after the opening tag of either, as a browser does.
  if (
    preservingWhitespace === 0 &&
    !hasNamedSlots &&
    typeof tag === 'string' &&
    WHITESPACE_PRESERVING_TAGS.has(tag)
  ) {
    const openLines = fits(`${padding}${open}`)
      ? [`${padding}${open}`]
      : multilineOpen('>');
    preservingWhitespace += 1;
    let content: string;
    try {
      content = withScopeLocals(context, node.slotScope ?? [], () =>
        renderNodes(children, `${path}.children`, 0, context)
      ).join('');
    } finally {
      preservingWhitespace -= 1;
    }
    const last = openLines.pop()!;
    return [
      ...openLines,
      `${last}${leadingLineBreak(content)}${content}${close}`,
    ];
  }

  if (hasNamedSlots) {
    // A slot's scope bindings shadow a named slot of the same name in its
    // content.
    const slotTemplate = (
      binding: string,
      content: TemplateNode[],
      contentPath: string,
      slotScope: string[]
    ): string[] =>
      wrapChildren(
        [`${pad(indent + 1)}<template ${binding}>`],
        withScopeLocals(context, slotScope, () =>
          renderSiblings(content, contentPath, indent + 2, context)
        ),
        `${pad(indent + 1)}</template>`
      );
    const bodyLines: string[] = [];
    for (const named of namedSlots) {
      const binding =
        named.slotScope.length > 0
          ? `#${named.name}="{ ${named.slotScope.join(', ')} }"`
          : `#${named.name}`;
      bodyLines.push(
        ...slotTemplate(
          binding,
          named.content,
          `${path}.slots.${named.name}.content`,
          named.slotScope
        )
      );
    }
    if (children.length > 0) {
      const binding =
        defaultSlotScope !== undefined
          ? `#default="${defaultSlotScope}"`
          : '#default';
      bodyLines.push(
        ...slotTemplate(
          binding,
          children,
          `${path}.children`,
          node.slotScope ?? []
        )
      );
    }
    const openLines = fits(`${padding}${open}`)
      ? [`${padding}${open}`]
      : multilineOpen('>');
    return [...openLines, ...bodyLines, `${padding}${close}`];
  }

  // Text, alone or beside other nodes, holds to the tags around it. When it
  // pushes the opening line past the width, several attributes wrap instead.
  const content = withScopeLocals(context, node.slotScope ?? [], () =>
    renderSiblings(children, `${path}.children`, indent + 1, context)
  );
  if (fits(`${padding}${open}`)) {
    const lines = wrapChildren(
      [`${padding}${open}`],
      content,
      `${padding}${close}`
    );
    if (fits(lines[0]) || parts.length < 2) {
      return lines;
    }
  }
  return wrapChildren(multilineOpen('>'), content, `${padding}${close}`);
}

/**
 * Whether the Vue override removes the node's class (a `null` `class`), so
 * the node renders no class here, a BEM runtime call included.
 *
 * @param node - The element node.
 * @returns `true` when Vue renders the node with no class.
 */
export function vueRemovesClass(node: ElementNode): boolean {
  const override = node.extensions?.vue as VueNodeOverrides | undefined;
  return override?.attributes?.class === null;
}

function buildAttributeParts(
  node: ElementNode,
  path: string,
  context: VueContext
): string[] {
  const override = node.extensions?.vue as VueNodeOverrides | undefined;
  // DOM properties bound on an intrinsic element, gathered into one object
  // the generated helper leaves `undefined` out of (see DOM_PROPERTIES).
  const intrinsic = isIntrinsicElement(node);
  const domProperties: string[] = [];
  const merged = mergeAttributeOverride(node.attributes, override?.attributes);
  // A textarea's default value is its text (see textareaDefaultText).
  const attributes = selectDefaults(
    node,
    intrinsic,
    textareaDefaultText(node, intrinsic, merged) === undefined
      ? merged
      : (Object.fromEntries(
          Object.entries(merged).filter(([name]) => name !== 'defaultValue')
        ) as Attributes)
  );
  const events = override?.events ?? node.events ?? [];
  // Named-slot references in each condition resolve to Vue's `$slots` presence
  // form here, so attribute/class expressions match the conditional nodes that
  // gate on the same slot. An override removing the node's class takes the
  // condition-gated classes with it; the entries' other attributes stay.
  const conditionals = (
    vueRemovesClass(node)
      ? withoutConditionalClasses(node.conditionalAttributes ?? [])
      : (node.conditionalAttributes ?? [])
  ).map((conditional) => ({
    ...conditional,
    condition: rewriteSlotReferences(
      conditional.condition,
      context.namedSlots,
      vuePresence
    )!,
  }));

  // In BEM runtime mode this node renders its BEM classes as the `bem(...)`
  // call: the contributed literals are suppressed from the static class list
  // and the folded conditional classes from the conditional rendering. A
  // node whose class the override removes has no call (`vueRemovesClass`).
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
  // Object spreads lead the authored attributes (which override per key): a
  // surface element's fallthrough `$attrs` first, then the named `$spread`s.
  // Vue's automatic fallthrough would apply the consumer's attributes after
  // the element's own, so a surface binds them explicitly here instead. Vue
  // merges listeners in attribute order, so the element's own listeners
  // follow `$attrs`: the consumer's handler runs first, then the declared
  // one, through a helper that skips it when the consumer prevented the
  // default.
  const routedElement =
    context.routedNode !== undefined && node === context.routedNode;
  const surfaceElement =
    context.surfaceElements?.has(node) === true || routedElement;
  // Whether a consumer attribute of this name lands on this element's share:
  // a declared prop never reaches either.
  const inShare = (name: string): boolean =>
    !(context.declaredNames?.has(name) ?? false) &&
    (context.routedEntries === undefined ||
      isRoutedAttribute(context.routedEntries, name) === routedElement);
  // Whether an id list this element sets joins the consumer's value of the
  // same name, the element's ids first: on a surface element whose share
  // holds that name.
  const joinsTokenList = (name: string): boolean =>
    surfaceElement && inShare(name) && isTokenListAttribute(name);
  // An id list the element joins reads the consumer's camel-case spelling
  // too, so that spelling stays out of the spread, where it would land as a
  // stray attribute of its own. Only a list that renders the join counts: a
  // bound or string value, or any condition-gated one; a boolean or number
  // renders as written, so the spread keeps the consumer's value.
  const joinedCamelCase = surfaceElement
    ? [
        ...new Set(
          [
            ...Object.entries(attributes).filter(
              ([, value]) =>
                isExpressionBinding(value) || typeof value === 'string'
            ),
            ...conditionals.flatMap((conditional) =>
              Object.entries(conditional.attributes)
            ),
          ]
            .filter(
              ([name, value]) => value !== undefined && joinsTokenList(name)
            )
            .map(([name]) => camelizePropName(name))
            .filter((camelCase) => !camelCase.includes('-'))
        ),
      ]
    : [];
  if (context.routedNode === undefined && joinedCamelCase.length > 0) {
    context.usesConsumerAttributes = true;
  }
  // With a routed element the root and that element each bind their share of
  // `$attrs`, in the place `$attrs` takes; a root without one binds the whole
  // of it, through the same helper when a joined spelling stays out.
  const attributesBinding =
    context.routedNode === undefined && joinedCamelCase.length === 0
      ? 'v-bind="$attrs"'
      : `v-bind="${CONSUMER_ATTRIBUTES}($attrs, '${routedElement ? 'routed' : 'root'}'${
          joinedCamelCase.length === 0
            ? ''
            : `, [${joinedCamelCase.map(quoteSingle).join(', ')}]`
        })"`;
  // A node spreading `rest` binds its listeners after its spreads too, so the
  // consumer's handler runs first; its class and style move before the
  // spread, as on a surface element, so the consumer's style wins.
  const spreadsRest =
    !surfaceElement &&
    context.declaresRest === true &&
    nodeSpreads(attributes).includes('rest');
  // Whether an event composes with a consumer handler the spread carries.
  const composes = (event: EventDefinition): boolean => {
    const key = consumerListenerKey(event);
    return surfaceElement
      ? inShare(key)
      : spreadsRest && !(context.declaredNames?.has(key) ?? false);
  };
  if (surfaceElement) {
    parts.push(attributesBinding);
  }
  // A routed handle is the routed element, which `<script setup>` exposes
  // as `$el`. A directive rather than a template ref, so it never takes the
  // place of a `ref` the template sets on the element itself.
  if (routedElement && context.routedHandle === true) {
    parts.push(ROUTED_ELEMENT_DIRECTIVE);
  }
  parts.push(
    ...nodeSpreads(attributes).map(
      (expression) => `v-bind=${directiveValue(expression)}`
    )
  );
  // A class leads the authored attributes, where hand-written markup puts it.
  const attributesStart = parts.length;
  let classRendered = false;

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
          runtimeCallExpression
        )
      );
      classRendered = true;
    } else if (name === 'style') {
      parts.push(
        ...styleParts(value as NestedStyleObject, context.stylingInline)
      );
    } else if (isExpressionBinding(value)) {
      // On a surface element an authored value that resolves to nothing
      // leaves the consumer's attribute of the same name in place, through the
      // generated helper (typed as the authored value).
      // A declared named slot read in the expression is `$slots.<name>`, as
      // a condition reads it.
      const authored = String(
        rewriteSlotReferences(
          value.$expression.trim(),
          context.namedSlots,
          vuePresence
        )
      );
      const fallsBack = surfaceElement && inShare(name);
      // An id list the surface sets keeps its ids and gains the consumer's.
      const joins = joinsTokenList(name);
      if (joins) context.usesAuthoredAndConsumer = true;
      else if (fallsBack) context.usesAuthoredOrConsumer = true;
      const expression = joins
        ? `${AUTHORED_AND_CONSUMER}(${authored}, $attrs, ${consumerSpellings(name)})`
        : fallsBack
          ? `${AUTHORED_OR_CONSUMER}(${authored}, $attrs, ${quoteSingle(name)})`
          : authored;
      if (intrinsic && DOM_PROPERTIES.has(name)) {
        domProperties.push(`${name}: ${expression}`);
        continue;
      }
      const reflected = reflectedAttribute(node, intrinsic, name);
      parts.push(
        reflected === undefined
          ? `:${name}=${directiveValue(expression)}`
          : reflectedBinding(reflected, expression)
      );
    } else if (typeof value === 'string' && joinsTokenList(name)) {
      // A static id list on the surface joins the consumer's too.
      context.usesAuthoredAndConsumer = true;
      parts.push(
        `:${name}=${directiveValue(`${AUTHORED_AND_CONSUMER}(${quoteSingle(value)}, $attrs, ${consumerSpellings(name)})`)}`
      );
    } else {
      // A static default is the attribute it reflects, written as such.
      const attribute = reflectedAttribute(node, intrinsic, name) ?? name;
      if (typeof value === 'boolean') {
        if (value) {
          parts.push(attribute);
        }
      } else if (typeof value === 'number') {
        parts.push(`:${attribute}="${value}"`);
      } else {
        // A directive an override writes as a plain attribute (`':title':
        // 'document.title'`) binds its value as an expression.
        if (/^(?::|@|#|v-)/.test(attribute)) {
          recordExpression(String(value));
        }
        parts.push(`${attribute}="${escapeAttributeValue(String(value))}"`);
      }
    }
  }

  if (!classRendered) {
    parts.splice(
      attributesStart,
      0,
      ...classParts([], classConditionals, [], runtimeCallExpression)
    );
  }

  for (const conditional of conditionals) {
    for (const [name, value] of Object.entries(conditional.attributes)) {
      if (name === 'class' || name === 'style' || value === undefined) {
        continue;
      }
      const expression = `${conditional.condition} ? ${conditionalValueExpression(
        value as AttributeValue
      )} : undefined`;
      if (intrinsic && DOM_PROPERTIES.has(name)) {
        domProperties.push(`${name}: ${expression}`);
        continue;
      }
      if (joinsTokenList(name)) {
        // A condition-gated id list on the surface joins the consumer's too,
        // which stands alone while the condition is false.
        context.usesAuthoredAndConsumer = true;
        parts.push(
          `:${name}=${directiveValue(`${AUTHORED_AND_CONSUMER}(${expression}, $attrs, ${consumerSpellings(name)})`)}`
        );
        continue;
      }
      const reflected = reflectedAttribute(node, intrinsic, name);
      parts.push(
        reflected === undefined
          ? `:${name}=${directiveValue(expression)}`
          : reflectedBinding(reflected, expression)
      );
    }
  }

  if (domProperties.length > 0) {
    context.usesDefinedProperties = true;
    parts.push(
      `v-bind=${directiveValue(`${DEFINED_PROPERTIES}({ ${domProperties.join(', ')} })`)}`
    );
  }

  const target = context.plan.get(node);
  if (target?.generatedNodeValue !== undefined) {
    parts.push(`${GENERATED_NODE_ATTRIBUTE}="${target.generatedNodeValue}"`);
  }

  parts.push(
    ...eventAttributes(
      events,
      composes,
      () => {
        context.onceListenerCount = (context.onceListenerCount ?? 0) + 1;
        return context.onceListenerCount - 1;
      },
      // A `<component :is="...">` gives a listener no contextual type, and
      // an element none for an event Vue types no listener for.
      (event) =>
        (override?.tag === undefined && isDynamicTag(node.tag)) ||
        (intrinsic && !isTypedElementEvent(event))
    )
  );
  if (events.some(composes)) {
    context.usesUnlessDefaultPrevented = true;
  }
  if (parts.some((part) => part.includes(`${INVOKE_HANDLER}(`))) {
    context.usesInvokeHandler = true;
  }

  if (surfaceElement || spreadsRest) {
    // The element's own class and style lead `$attrs` (or a `rest` spread)
    // too: Vue merges both whatever the order, so the own class comes first
    // as on the other targets and the consumer's style, applied after, wins
    // per property.
    const ownClassAndStyle = parts.filter((part) =>
      /^:?(class|style)=/.test(part)
    );
    const rest = parts.filter((part) => !/^:?(class|style)=/.test(part));
    const attributesAt = rest.indexOf(
      surfaceElement ? attributesBinding : `v-bind=${directiveValue('rest')}`
    );
    if (attributesAt === -1) {
      return parts;
    }
    parts.splice(
      0,
      parts.length,
      ...rest.slice(0, attributesAt),
      ...ownClassAndStyle,
      ...rest.slice(attributesAt)
    );
  }

  return parts;
}

/**
 * Builds the class attribute parts: a static `class="..."` from the
 * authored classes, and a `:class` binding from condition-gated and
 * expression classes - the object form (`:class="{ ... }"`) when only
 * condition-gated classes need binding, the array form
 * (`:class="[{ ... }, expression]"`) once expression classes join it, with
 * expression entries last in authored order (Vue drops falsy entries at
 * runtime). The fixed concatenation order (static first, then conditional
 * in array order, then expression classes) is applied; a conditional class
 * is dropped when a static class carries it, and one repeated across
 * conditional entries applies whenever any of its conditions holds.
 */
function classParts(
  staticClasses: string[],
  conditionals: ConditionalAttributes[],
  expressionClasses: string[],
  runtimeCall?: string
): string[] {
  const parts: string[] = [];
  if (staticClasses.length > 0) {
    parts.push(`class=${quoteClassAttributeValue(staticClasses.join(' '))}`);
  }

  // A conditional class repeated across entries is one key whose value
  // joins its conditions, so it applies whenever any of them holds.
  // A key that needs a template literal is written as a computed key.
  const entries = groupConditionalClasses(conditionals, staticClasses).map(
    (group) => {
      const literal = classStringLiteral(group.classes.join(' '), {
        allowDoubleQuote: false,
      });
      const key = literal.startsWith('`') ? `[${literal}]` : literal;
      return `${key.replace(/&(?=[A-Za-z0-9#])/g, '&amp;')}: ${joinConditions(
        group.conditions
      ).trim()}`;
    }
  );

  // The runtime call leads the `:class` binding (a non-empty string, no falsy
  // guard); a lone call binds directly, otherwise it joins the array form.
  if (runtimeCall === undefined) {
    if (expressionClasses.length > 0) {
      const bindingEntries: string[] = [];
      if (entries.length > 0) {
        bindingEntries.push(`{ ${entries.join(', ')} }`);
      }
      bindingEntries.push(
        ...expressionClasses.map((expression) => expression.trim())
      );
      parts.push(`:class=${directiveValue(`[${bindingEntries.join(', ')}]`)}`);
    } else if (entries.length > 0) {
      parts.push(`:class=${directiveValue(`{ ${entries.join(', ')} }`)}`);
    }
    return parts;
  }

  const bindingEntries: string[] = [runtimeCall.trim()];
  if (entries.length > 0) {
    bindingEntries.push(`{ ${entries.join(', ')} }`);
  }
  bindingEntries.push(
    ...expressionClasses.map((expression) => expression.trim())
  );
  if (bindingEntries.length === 1) {
    parts.push(`:class=${directiveValue(bindingEntries[0])}`);
  } else {
    parts.push(`:class=${directiveValue(`[${bindingEntries.join(', ')}]`)}`);
  }
  return parts;
}

/**
 * Builds the style attribute parts. A whole-object expression renders as a
 * `:style` binding. Otherwise expression-valued properties always render in
 * a `:style` object - they go through Vue's dynamic style mechanism
 * regardless of the stylesheet placement - while static plain properties render
 * as a static `style="..."` attribute only under the `inline` placement (and
 * only when no nested selectors force the style to a stylesheet); Vue
 * merges the two at runtime.
 */
function styleParts(
  style: NestedStyleObject,
  stylingInline: boolean
): string[] {
  const wholeExpression = wholeStyleExpression(style);
  const parts: string[] = [];
  if (
    stylingInline &&
    !hasNestedSelectors(style) &&
    hasPlainProperties(style)
  ) {
    parts.push(`style="${escapeAttributeValue(serializeInlineStyle(style))}"`);
  }
  const entries: string[] = [];
  for (const [property, value] of Object.entries(style)) {
    if (property === '$expression') {
      continue;
    }
    if (isExpressionBinding(value)) {
      entries.push(
        `${stylePropertyKey(property)}: ${value.$expression.trim()}`
      );
    }
  }
  // The `:style` binding layers the whole-object expression (base) under the
  // per-property expressions (override) as an array - Vue merges array entries
  // with later winning.
  if (wholeExpression !== undefined && entries.length > 0) {
    parts.push(
      `:style=${directiveValue(`[${wholeExpression.trim()}, { ${entries.join(', ')} }]`)}`
    );
  } else if (wholeExpression !== undefined) {
    parts.push(`:style=${directiveValue(wholeExpression)}`);
  } else if (entries.length > 0) {
    parts.push(`:style=${directiveValue(`{ ${entries.join(', ')} }`)}`);
  }
  return parts;
}

/**
 * Serializes a `:style` object key: CSS custom properties stay verbatim as
 * quoted keys; everything else converts to the camelCase style property.
 */
function stylePropertyKey(property: string): string {
  if (property.startsWith('--')) {
    return quoteSingle(property);
  }
  return toCamelCaseProperty(property);
}

/** Converts a kebab-case CSS property name to its camelCase form. */
function toCamelCaseProperty(propertyName: string): string {
  return propertyName.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
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

/**
 * DOM properties Vue writes to the element even when the bound value is
 * `undefined`: it sets `el.checked = false` for an unset `checked`, which
 * marks the input dirty so a `defaultChecked` beside it no longer checks it,
 * and `value` and the rest behave alike. Bound through `definedProperties`,
 * an `undefined` value leaves the property unset, as React and Svelte do.
 */
const DOM_PROPERTIES = new Set([
  'checked',
  'value',
  'selected',
  'indeterminate',
  'muted',
]);

/**
 * The content attribute a default-value DOM property reflects, by element:
 * an input's `defaultChecked` is its `checked` attribute and its
 * `defaultValue` its `value` attribute, an option's `defaultSelected` its
 * `selected` attribute. Vue types no such property on its elements, so a
 * template binding one fails a strict consumer's type-check; written as the
 * attribute with `.attr`, it type-checks and means the same: the initial
 * state, which the user's input then takes over.
 */
const REFLECTED_ATTRIBUTES: Record<string, Record<string, string>> = {
  input: { defaultChecked: 'checked', defaultValue: 'value' },
  option: { defaultSelected: 'selected' },
};

/**
 * The reflected attributes that are boolean: present means on, whatever the
 * value. Vue writes any bound value other than `null` and `undefined` with
 * `.attr`, `false` as `checked="false"`, which checks the input.
 */
const BOOLEAN_REFLECTED_ATTRIBUTES = new Set(['checked', 'selected']);

/**
 * A default-value property bound as the attribute it reflects:
 * `:value.attr="defaultValue"`. A boolean attribute binds
 * `expression || undefined`, so a false value leaves it out.
 */
function reflectedBinding(attribute: string, expression: string): string {
  if (!BOOLEAN_REFLECTED_ATTRIBUTES.has(attribute)) {
    return `:${attribute}.attr=${directiveValue(expression)}`;
  }
  const operand = IDENTIFIER_PATH.test(expression)
    ? expression
    : `(${expression})`;
  const value = `${operand} || undefined`;
  return `:${attribute}.attr=${directiveValue(value)}`;
}

/** Matches an identifier or a dot-separated member path: `props.checked`. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/**
 * The `defaultSelected` each option below a select with a `defaultValue` or
 * a bound `value` takes, recorded when the select's attributes are written,
 * before its options.
 */
const optionSelections = new WeakMap<
  ElementNode,
  { name: 'defaultSelected' | 'selected'; value: AttributeValue }
>();

/**
 * A select's `defaultValue` moved to its options, and an option's recorded
 * default added. A select has no default-value property (Vue would write a
 * `defaultValue` attribute, which selects nothing), so the matching option
 * takes `defaultSelected`, written as its `selected` attribute; beside a
 * bound `value` the default is read when the value is unset,
 * `value ?? defaultValue`, and beside a static one it is dropped.
 *
 * A `value`, static or bound, marks its options the same way. Vue's server render writes
 * it as an attribute of the select, which browsers ignore, and hydrating
 * writes no `value` to a select, so the option's `selected` is what a page
 * shows until the value next changes. On the client the select's `value` is
 * written after its options and decides the selection, as before.
 */
function selectDefaults(
  node: ElementNode,
  intrinsic: boolean,
  attributes: Attributes
): Attributes {
  if (!intrinsic) {
    return attributes;
  }
  if (node.tag === 'option') {
    const selected = optionSelections.get(node);
    return selected === undefined
      ? attributes
      : { ...attributes, [selected.name]: selected.value };
  }
  if (node.tag !== 'select') {
    return attributes;
  }
  const defaultValue = attributes.defaultValue as AttributeValue | undefined;
  if (defaultValue === undefined) {
    const value = attributes.value as AttributeValue | undefined;
    return isExpressionBinding(value) ||
      typeof value === 'string' ||
      typeof value === 'number'
      ? withOptionSelections(node, value, attributes)
      : attributes;
  }
  const rest = Object.fromEntries(
    Object.entries(attributes).filter(([name]) => name !== 'defaultValue')
  ) as Attributes;
  const authored = rest.value as AttributeValue | undefined;
  if (authored === undefined) {
    const multiple = rest.multiple as AttributeValue | undefined;
    for (const [option, value] of selectedOptions(node, defaultValue, {
      multiple: multiple !== undefined && multiple !== false,
    })) {
      optionSelections.set(option, { name: 'defaultSelected', value });
    }
    return rest;
  }
  if (isExpressionBinding(authored)) {
    const fallback = isExpressionBinding(defaultValue)
      ? `(${defaultValue.$expression.trim()})`
      : typeof defaultValue === 'string'
        ? `'${defaultValue.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
        : String(defaultValue);
    return withOptionSelections(
      node,
      { $expression: `(${authored.$expression.trim()}) ?? ${fallback}` },
      rest
    );
  }
  return rest;
}

/**
 * A select's attributes once its `value` has marked the options it chooses,
 * each with a `defaultSelected`. Vue writes a select's `value` as one string,
 * which matches no option when the value is a list, so a `multiple` select
 * with a bound value leaves `value` off and binds each option's `selected`
 * property, which is right on mount, on update and in the server render.
 * Where a bound `multiple` decides at run time, the select writes its value
 * only when it is single, as it would without the list.
 */
function withOptionSelections(
  select: ElementNode,
  value: ExpressionBinding | string | number,
  attributes: Attributes
): Attributes {
  const multiple = attributes.multiple as AttributeValue | undefined;
  const listed = multiple !== undefined && multiple !== false;
  const property = listed && isExpressionBinding(value);
  for (const [option, selected] of selectedOptions(select, value, {
    multiple: listed,
  })) {
    optionSelections.set(option, {
      name: property ? 'selected' : 'defaultSelected',
      value: selected,
    });
  }
  if (!property) {
    return { ...attributes, value };
  }
  if (!isExpressionBinding(multiple)) {
    return Object.fromEntries(
      Object.entries(attributes).filter(([name]) => name !== 'value')
    ) as Attributes;
  }
  return {
    ...attributes,
    value: {
      $expression: `${selectOperand(multiple.$expression)} ? undefined : ${selectOperand(value.$expression)}`,
    },
  };
}

/** An expression as an operand, parenthesized unless a member path. */
function selectOperand(expression: string): string {
  const trimmed = expression.trim();
  return IDENTIFIER_PATH.test(trimmed) ? trimmed : `(${trimmed})`;
}

/**
 * A textarea's `defaultValue`, as the text Vue writes it in. Vue types no
 * `defaultValue` on a textarea, and its default value is its text content:
 * Vue writes the text once and again whenever it changes, and the user's
 * edits stand until it does, as a browser keeps them (a bound `:value` is
 * rewritten on every render instead). The text is used only when the
 * textarea has no children of its own.
 */
function textareaDefaultText(
  node: ElementNode,
  intrinsic: boolean,
  attributes: Attributes
): TextNode | undefined {
  if (!intrinsic || node.tag !== 'textarea') {
    return undefined;
  }
  const defaultValue = attributes.defaultValue as AttributeValue | undefined;
  if (defaultValue === undefined) {
    return undefined;
  }
  return isExpressionBinding(defaultValue)
    ? { type: 'text', expression: defaultValue.$expression.trim() }
    : { type: 'text', content: String(defaultValue) };
}

/** Whether an element renders as the literal HTML element its tag names. */
function isIntrinsicElement(node: ElementNode): boolean {
  const override = node.extensions?.vue as VueNodeOverrides | undefined;
  return (
    override?.tag === undefined &&
    typeof node.tag === 'string' &&
    /^[a-z]/.test(node.tag)
  );
}

function reflectedAttribute(
  node: ElementNode,
  intrinsic: boolean,
  name: string
): string | undefined {
  if (!intrinsic || typeof node.tag !== 'string') {
    return undefined;
  }
  return REFLECTED_ATTRIBUTES[node.tag]?.[name];
}

/**
 * The names a consumer's `$attrs` may hold an attribute under, quoted: its
 * HTML spelling and, for a hyphenated name, the camel case a render
 * function's `ariaDescribedby` keeps (Vue camelizes only declared props).
 */
function consumerSpellings(name: string): string {
  const camelCase = camelizePropName(name);
  return [name, ...(camelCase === name ? [] : [camelCase])]
    .map(quoteSingle)
    .join(', ');
}

/**
 * The `shallowRef` holding the routed element of a routed handle
 * (`handle: 'routed'`), exposed as the component's `$el` and, typed after
 * the routed tag, as `element`.
 */
export const ROUTED_ELEMENT = 'routedElement';

/** The generated directive that records the routed element. */
export const ROUTED_ELEMENT_DIRECTIVE_NAME = 'vRoutedElement';

/** The directive as the routed element's template writes it. */
const ROUTED_ELEMENT_DIRECTIVE = 'v-routed-element';

/**
 * The routed handle's declarations, as `<script setup>` writes them: the
 * `shallowRef` the directive keeps the routed element in while it is
 * mounted, the directive, and, unless the author's script exposes its own
 * (which takes the two instead), the `defineExpose` that makes it the
 * component's `$el`, read before Vue's own root `$el`, and its `element`,
 * which Vue types as `elementType | null` where it types `$el` as `any`.
 *
 * @param elementType - The routed element's DOM type.
 * @param exposes - Whether to write the `defineExpose` call.
 * @returns The statements.
 */
export function routedElementDeclaration(
  elementType: string,
  exposes = true
): string {
  return [
    `const ${ROUTED_ELEMENT} = shallowRef<${elementType} | null>(null);`,
    `const ${ROUTED_ELEMENT_DIRECTIVE_NAME} = {`,
    `  mounted(element: ${elementType}): void {`,
    `    ${ROUTED_ELEMENT}.value = element;`,
    '  },',
    `  unmounted(element: ${elementType}): void {`,
    `    if (${ROUTED_ELEMENT}.value === element) {`,
    `      ${ROUTED_ELEMENT}.value = null;`,
    '    }',
    '  },',
    '};',
    ...(exposes
      ? [
          `defineExpose({ $el: ${ROUTED_ELEMENT}, element: ${ROUTED_ELEMENT} });`,
        ]
      : []),
  ].join('\n');
}

/** The generated helper that leaves `undefined` properties out of an object. */
export const DEFINED_PROPERTIES = 'definedProperties';

/** The `definedProperties` helper, as `<script setup>` declares it. */
export function definedPropertiesDeclaration(): string {
  return [
    `function ${DEFINED_PROPERTIES}<T extends object>(properties: T): Partial<T> {`,
    '  return Object.fromEntries(',
    '    Object.entries(properties).filter(([, propertyValue]) => propertyValue !== undefined)',
    '  ) as Partial<T>;',
    '}',
  ].join('\n');
}

/** Matches one `v-bind="<expression>"` object spread. */
const SPREAD_PART = /^v-bind=(["'])(.*)\1$/s;

/**
 * Whether a spread expression carries the consumer's attributes: `$attrs`
 * itself, the share of it a routed surface's root or routed element binds
 * through `consumerAttributes`, or the `rest` binding of a component that
 * declares one.
 */
function spreadsConsumerAttributes(
  expression: string,
  context: VueContext
): boolean {
  return (
    expression === '$attrs' ||
    expression.startsWith(`${CONSUMER_ATTRIBUTES}($attrs, `) ||
    (expression === 'rest' && context.declaresRest === true)
  );
}

/**
 * Merges an element's object spreads - the consumer's attributes a surface
 * element or a `rest` node binds, and its `$spread`s - into one `v-bind`,
 * since Vue's compiler rejects a repeated attribute. The objects spread in
 * order, so a later one wins per key as separate spreads would; the merged
 * binding takes the first one's place. With the consumer's attributes among
 * them (`$attrs`, a `consumerAttributes($attrs, ...)` share or `rest`) the
 * merge goes through Vue's `mergeProps`, which joins the consumer's `class`,
 * `style` and listeners with a spread's rather than letting the spread
 * replace them.
 */
function mergeSpreads(parts: string[], context: VueContext): string[] {
  const spreads = parts
    .map((part) => SPREAD_PART.exec(part))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(([, quote, value]) =>
      quote === '"' ? value.replace(/&quot;/g, '"') : value
    );
  if (spreads.length < 2) {
    return parts;
  }
  const mergesAttributes = spreads.some((expression) =>
    spreadsConsumerAttributes(expression, context)
  );
  if (mergesAttributes) {
    context.usesMergeProps = true;
  }
  const merged = `v-bind=${directiveValue(
    mergesAttributes
      ? `mergeProps(${spreads.join(', ')})`
      : `{ ${spreads.map((expression) => `...${expression}`).join(', ')} }`
  )}`;
  const first = parts.findIndex((part) => SPREAD_PART.test(part));
  return parts.flatMap((part, index) =>
    index === first ? [merged] : SPREAD_PART.test(part) ? [] : [part]
  );
}
