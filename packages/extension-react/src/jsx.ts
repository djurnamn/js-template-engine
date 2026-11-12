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
  wholeStyleExpression,
  type BemRuntimeCall,
  type NormalizedExposedBinding,
  type TargetPlan,
} from '@js-template-engine/core';
import {
  CONSUMER_AND_SPREAD,
  CONSUMER_AND_SPREAD_BINDING,
  AUTHORED_AND_CONSUMER,
  AUTHORED_OR_CONSUMER,
  classAttributeQuote,
  classStringLiteral,
  escapeClassAttributeValue,
  fragmentWrapper,
  groupConditionalClasses,
  isReferenceExpression,
  isRoutedAttribute,
  isTokenListAttribute,
  joinConditions,
  isIdentifier,
  literalMembersWithoutRest,
  joinSiblingLines,
  mergeAttributeOverride,
  normalizeSlotName,
  readsRest,
  tokenizeExpression,
  withoutConditionalClasses,
  withShadowedSlotNames,
  tagLines,
  textLines,
  type SiblingLines,
} from '@js-template-engine/core/emitter';
import type {
  Attributes,
  AttributeOverrides,
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

import { attributeName } from './attribute-names';
import { COMPOSE_HELPER_NAME, eventProps } from './events';
import {
  COMPOSE_REFS_NAME,
  INDETERMINATE_REF_NAME,
  reactTag,
  setsThroughRef,
} from './refs';
import {
  escapeJsxAttributeValue,
  escapeJsxText,
  quoteSingle,
  toCamelCaseProperty,
} from './literals';
import type { ReactNodeOverrides } from './overrides';
import { ROUTED_REST } from './props';

/** Everything the JSX renderer needs besides the nodes themselves. */
export interface JsxContext {
  plan: TargetPlan;
  /** True when the stylesheet placement is `inline`. */
  stylingInline: boolean;
  /** React prop name per slot name (`undefined` keys the default slot). */
  slotPropNames: Map<string | undefined, string>;
  /**
   * The scoped slots whose content must take the scope (`undefined` keys the
   * default slot): their prop renders only as a render function, anything
   * else giving the fallback.
   */
  scopeRequiredSlots: ReadonlySet<string | undefined>;
  /** The declared named-slot names, for slot-presence conditions. */
  namedSlots: ReadonlySet<string>;
  /** Set when a keyed `<Fragment>` wrapper was emitted. */
  usesFragmentImport: boolean;
  /**
   * Set when an inline `style` object literal carries a CSS custom property
   * (`--*`) key. `React.CSSProperties` has no `--*` index signature, so such
   * a component declares a file-local `StyleWithCustomProperties` type that
   * the literal is checked against before it is handed on as `CSSProperties`.
   */
  usesCssCustomProperty: boolean;
  /**
   * Set when a passthrough root composes a declared handler with the
   * spread's handler for the same event, so the component file declares the
   * `composeEventHandlers` helper.
   */
  usesComposeHelper?: boolean;
  /**
   * Set when a passthrough root also spreads a named record, which folds into
   * the consumer's attributes through the generated `consumerAndSpread`
   * helper, so the file declares it.
   */
  usesConsumerAndSpread?: boolean;
  /** Set when a surface attribute resolves through the generated
   *  `authoredOrConsumer` helper, so the file declares it. */
  usesAuthoredOrConsumer?: boolean;
  /**
   * Whether the component declares `rest`, whose value carries the
   * consumer's `ref`.
   */
  declaresRest?: boolean;
  /**
   * Set when a node spreading `rest`, or a passthrough root, composes its
   * own `ref` with the consumer's through the generated `composeRefs` helper,
   * so the file declares it.
   */
  usesComposeRefs?: boolean;
  /**
   * Set when an `<input>` sets its `indeterminate` through the generated
   * `indeterminateRef` helper, so the file declares it.
   */
  usesIndeterminateRef?: boolean;
  /**
   * The component's single root element when its tag is dynamic: it renders
   * through the `RootTag` local the component body hoists.
   */
  dynamicRootNode?: ElementNode;
  /**
   * The binding statements of the scope being rendered - the component body,
   * or a loop callback or scoped-slot function - each declaring a dynamic tag
   * below the root (`const Tag = <expression>;`). A dynamic tag binds in the
   * nearest scope enclosing it, where its expression can read every local it
   * might reference.
   */
  scopeBindings?: string[];
  /** How many dynamic tags below the root have taken a name, file-wide. */
  dynamicTagCount?: { value: number };
  /**
   * The component's passthrough surface root, if any. On this node the
   * consumer's `...rest` props spread first, `ref` forwards as a prop, and
   * the consumer `className`/`style` merge (the consumer class is appended
   * last in the class list; the consumer style is the outermost layer).
   */
  passthroughNode?: ElementNode;
  /**
   * The element below the passthrough root that takes the consumer's routed
   * attributes (`passthrough: { attributes }`), if any. On this node the
   * routed share, `routedRest`, spreads first; the root's `rest` holds the
   * others.
   */
  routedNode?: ElementNode;
  /** The routed element's routing entries. */
  routedEntries?: readonly string[];
  /**
   * Whether the consumer's `ref` lands on the routed element
   * (`handle: 'routed'`) rather than the passthrough root.
   */
  routedHandle?: boolean;
  /** Set when a routed id list joins the consumer's through the generated
   *  `authoredAndConsumer` helper, so the file declares it. */
  usesAuthoredAndConsumer?: boolean;
  /**
   * The default tag of a polymorphic passthrough root. Inside the generic
   * component body the spread's handler for an event is the union of every
   * admitted tag's handler type, which no one handler type accepts, or
   * `unknown` where the `as` prop may hold a component, so a composed
   * handler reads it as the default tag's handler - the type the element's
   * own handlers are checked against elsewhere on a dynamic root.
   */
  polymorphicRootTag?: string;
  /**
   * The names destructured out of `rest` on a passthrough surface (declared
   * and slot props): an event prop among them is the consumer's own handler,
   * so only the others compose with a handler the spread carries.
   */
  destructuredNames?: ReadonlySet<string>;
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
 * The DOM props React's types declare as `number` only (`tabIndex?: number`,
 * `colSpan?: number`, ...), by their JSX name. A numeric string authored for
 * one of them is written as a number, which renders the same attribute and
 * type-checks; a string fails strict `tsc`. Every other numeric prop React
 * types also accepts a string (`width?: number | string`), so it is left as
 * written.
 */
const NUMERIC_REACT_ATTRIBUTES: ReadonlySet<string> = new Set([
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
  'colSpan',
  'cols',
  'high',
  'low',
  'marginHeight',
  'marginWidth',
  'maxLength',
  'minLength',
  'optimum',
  'results',
  'rowSpan',
  'rows',
  'size',
  'span',
  'start',
  'tabIndex',
]);

/** A decimal number written as a string: `'0'`, `'-1'`, `'2.5'`. */
const NUMERIC_STRING = /^-?(?:\d+|\d*\.\d+)$/;

/**
 * A static string value as the number React's types expect, when the prop is
 * typed as a number only, the value is a numeric string and the element is an
 * intrinsic one (a component's props are its own).
 *
 * @param node - The element carrying the attribute.
 * @param key - The attribute's JSX name (`tabIndex`).
 * @param value - The authored string.
 * @returns The number as source (`'0'`), or `undefined` to write the string.
 */
function numericAttributeValue(
  node: ElementNode,
  key: string,
  value: string
): string | undefined {
  if (!NUMERIC_REACT_ATTRIBUTES.has(key) || !NUMERIC_STRING.test(value)) {
    return undefined;
  }
  const tagOverride = (node.extensions?.react as ReactNodeOverrides | undefined)
    ?.tag;
  const tag = tagOverride ?? (isDynamicTag(node.tag) ? undefined : node.tag);
  if (typeof tag === 'string' && !/^[a-z][a-z0-9]*$/.test(tag)) {
    return undefined;
  }
  return String(Number(value));
}

function pad(indent: number): string {
  return INDENTATION.repeat(indent);
}

function fits(line: string): boolean {
  return line.length <= MAXIMUM_WIDTH;
}

/** Renders template nodes as JSX child lines at the given indent level. */
export function renderJsxNodes(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: JsxContext
): string[] {
  return renderJsxSiblings(nodes, path, indent, context).lines;
}

/**
 * Renders sibling nodes as JSX children, text joined to its neighbors on one
 * line: JSX drops whitespace holding a line break and joins two lines of text
 * with a space, so a break beside text would change what renders. At either
 * end of the children, text holds to the tag beside it only where a space is
 * written at that edge.
 */
export function renderJsxSiblings(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: JsxContext
): SiblingLines {
  const joined = joinSiblingLines(
    nodes.map((node, index) =>
      node.type === 'text'
        ? textLines(pad(indent), textPiece(node))
        : tagLines(
            renderJsxNode(node, joinPath(path, `[${index}]`), indent, context)
          )
    ),
    'between-tags'
  );
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  return {
    ...joined,
    leadingText: first?.type === 'text' && /^\s/.test(first.content ?? ''),
    trailingText: last?.type === 'text' && /\s$/.test(last.content ?? ''),
  };
}

/**
 * Opening lines, JSX children and a closing line, joined: text written with
 * a space at either end of the children holds to the tag beside it.
 */
export function wrapJsxChildren(
  open: string[],
  children: SiblingLines,
  close: string
): string[] {
  return joinSiblingLines(
    [tagLines(open), children, tagLines([close])],
    'between-tags'
  ).lines;
}

function joinPath(parent: string, segment: string): string {
  if (parent === '') {
    return segment;
  }
  return segment.startsWith('[')
    ? `${parent}${segment}`
    : `${parent}.${segment}`;
}

/** Renders one template node as JSX child lines at the given indent level. */
export function renderJsxNode(
  node: TemplateNode,
  path: string,
  indent: number,
  context: JsxContext
): string[] {
  const padding = pad(indent);
  switch (node.type) {
    case 'element':
      return renderElement(node, path, indent, context);
    case 'text':
      return [`${padding}${textPiece(node)}`];
    case 'comment':
      return [`${padding}{/* ${node.content} */}`];
    case 'fragment': {
      const wrapper = fragmentWrapper(node, 'react');
      if (wrapper !== undefined) {
        return renderElement(wrapper, path, indent, context);
      }
      return wrapJsxChildren(
        [`${padding}<>`],
        renderJsxSiblings(
          node.children,
          `${path}.children`,
          indent + 1,
          context
        ),
        `${padding}</>`
      );
    }
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
    return escapeJsxText(node.content);
  }
  return `{${String(node.expression).trim()}}`;
}

/**
 * Renders nodes for a JSX expression position (a conditional branch, an
 * iteration body, a slot fallback): a single text node becomes a string
 * literal or its expression, a single element or fragment is used directly,
 * and anything else is wrapped in a fragment.
 */
function renderExpressionBody(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: JsxContext
): { inline?: string; block: string[] } {
  if (nodes.length === 1) {
    const node = nodes[0];
    if (node.type === 'text') {
      const inline =
        node.content !== undefined
          ? quoteSingle(node.content)
          : String(node.expression).trim();
      return { inline, block: [`${pad(indent)}${inline}`] };
    }
    if (node.type === 'element' || node.type === 'fragment') {
      const block = renderJsxNode(node, joinPath(path, '[0]'), indent, context);
      return {
        inline: block.length === 1 ? block[0].trimStart() : undefined,
        block,
      };
    }
  }
  return {
    block: wrapJsxChildren(
      [`${pad(indent)}<>`],
      renderJsxSiblings(nodes, path, indent + 1, context),
      `${pad(indent)}</>`
    ),
  };
}

function renderSlot(
  node: SlotNode,
  path: string,
  indent: number,
  context: JsxContext
): string[] {
  const propName = context.slotPropNames.get(node.name);
  const reference = `props.${propName}`;
  const padding = pad(indent);
  // Each place a slot renders passes its own expressions; validation holds
  // every place to the same binding names.
  const exposes = normalizeExposes(node.exposes);
  const hasFallback = node.fallback !== undefined && node.fallback.length > 0;

  // A scoped slot's prop takes a render function or plain content, as a Vue
  // or Svelte slot does: call a function with the exposed scope, render any
  // other content as it is. A slot that requires its scope renders only a
  // function: without one, its fallback renders, or nothing.
  if (exposes.length > 0) {
    const scope = scopeObjectLiteral(exposes);
    const isFunction = `typeof ${reference} === 'function'`;
    const call = `${reference}(${scope})`;
    const scopeRequired = context.scopeRequiredSlots.has(node.name);
    if (!hasFallback) {
      const otherwise = scopeRequired ? 'null' : reference;
      const line = `${padding}{${isFunction} ? ${call} : ${otherwise}}`;
      if (fits(line)) {
        return [line];
      }
      return [
        `${padding}{${isFunction}`,
        `${pad(indent + 1)}? ${call}`,
        `${pad(indent + 1)}: ${otherwise}}`,
      ];
    }
    const body = renderExpressionBody(
      node.fallback as TemplateNode[],
      `${path}.fallback`,
      indent + 2,
      context
    );
    if (body.inline !== undefined) {
      const fallback = scopeRequired
        ? body.inline
        : `(${reference} ?? ${body.inline})`;
      const line = `${padding}{${isFunction} ? ${call} : ${fallback}}`;
      if (fits(line)) {
        return [line];
      }
      const otherwise = `${pad(indent + 1)}: ${fallback}}`;
      if (fits(otherwise)) {
        return [
          `${padding}{${isFunction}`,
          `${pad(indent + 1)}? ${call}`,
          otherwise,
        ];
      }
    }
    return [
      `${padding}{${isFunction}`,
      `${pad(indent + 1)}? ${call}`,
      scopeRequired
        ? `${pad(indent + 1)}: (`
        : `${pad(indent + 1)}: (${reference} ?? (`,
      ...body.block,
      scopeRequired ? `${pad(indent + 1)})}` : `${pad(indent + 1)}))}`,
    ];
  }

  if (!hasFallback) {
    return [`${padding}{${reference}}`];
  }

  const body = renderExpressionBody(
    node.fallback as TemplateNode[],
    `${path}.fallback`,
    indent + 1,
    context
  );
  if (body.inline !== undefined) {
    const line = `${padding}{${reference} ?? ${body.inline}}`;
    if (fits(line)) {
      return [line];
    }
  }
  return [`${padding}{${reference} ?? (`, ...body.block, `${padding})}`];
}

/**
 * The scope object literal passed to a render-prop slot: `{ api }` when an
 * exposed binding's value expression is exactly its name (shorthand),
 * `{ api: dialog.api }` otherwise.
 */
function scopeObjectLiteral(exposes: NormalizedExposedBinding[]): string {
  const parts = exposes.map((binding) =>
    binding.value.trim() === binding.name
      ? binding.name
      : `${binding.name}: ${binding.value.trim()}`
  );
  return `{ ${parts.join(', ')} }`;
}

function renderConditional(
  node: ConditionalNode,
  path: string,
  indent: number,
  context: JsxContext
): string[] {
  const padding = pad(indent);
  const branches = node.conditions.map((branch, index) => ({
    branch,
    condition: conditionExpression(branch, context),
    body: renderExpressionBody(
      branch.children,
      `${path}.conditions[${index}].children`,
      indent + 1,
      context
    ),
  }));

  if (branches.every(({ body }) => body.inline !== undefined)) {
    const line = `${padding}{${inlineConditional(branches)}}`;
    if (fits(line)) {
      return [line];
    }
  }

  if (branches.length === 1) {
    const [{ condition, body }] = branches;
    return [
      `${padding}{${parenthesizeIfCompound(condition)} && (`,
      ...body.block,
      `${padding})}`,
    ];
  }

  const lines: string[] = [];
  branches.forEach(({ branch, condition, body }, index) => {
    if (index === 0) {
      lines.push(`${padding}{${condition} ? (`);
    } else if (branch.statement === 'else') {
      lines.push(`${padding}) : (`);
    } else {
      lines.push(`${padding}) : ${condition} ? (`);
    }
    lines.push(...body.block);
  });
  const lastBranch = branches[branches.length - 1].branch;
  lines.push(
    lastBranch.statement === 'else' ? `${padding})}` : `${padding}) : null}`
  );
  return lines;
}

const REFERENCE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/**
 * The negated condition of a conditional passthrough root's `if` branch, for
 * the component's early `return null`: `!open` for a bare name or member
 * access, `open` for `!open`, and `!(<condition>)` for anything else. A
 * condition holding a line comment closes its parenthesis on a line of its
 * own, so the comment cannot swallow it.
 *
 * @param branch - The root conditional's `if` branch.
 * @param context - The component's JSX context.
 * @returns The negated condition.
 */
export function negatedRootCondition(
  branch: ConditionalNode['conditions'][number],
  context: JsxContext
): string {
  const condition = (conditionExpression(branch, context) ?? '').trim();
  if (REFERENCE.test(condition)) {
    return `!${condition}`;
  }
  const negated = /^!\s*(.+)$/.exec(condition);
  if (negated !== null && REFERENCE.test(negated[1])) {
    return negated[1];
  }
  return condition.includes('//') ? `!(${condition}\n  )` : `!(${condition})`;
}

/** React's slot-presence form for a named slot: its destructured prop. */
function reactPresence(context: JsxContext): (slotName: string) => string {
  return (slotName) => `props.${context.slotPropNames.get(slotName)}`;
}

/**
 * The JavaScript a branch condition emits. A reference to a declared named
 * slot becomes that slot's React prop (`props.<propName>`) - its presence
 * check, emitted deterministically rather than relying on the slot name being
 * destructured into scope; the rest of the condition is emitted verbatim.
 */
function conditionExpression(
  branch: ConditionalNode['conditions'][number],
  context: JsxContext
): string | undefined {
  return rewriteSlotReferences(
    branch.condition,
    context.namedSlots,
    reactPresence(context)
  );
}

/**
 * The runtime `bem(...)` call for a node, with named-slot references in its
 * conditional modifiers resolved to each slot's React prop - the same
 * resolution the conditional nodes apply.
 */
function bemCallExpression(
  runtimeCall: BemRuntimeCall,
  context: JsxContext
): string {
  const toPresence = reactPresence(context);
  return formatBemCall(
    runtimeCall.elementName,
    runtimeCall.staticModifiers,
    runtimeCall.conditionalModifiers.map((modifier) => ({
      modifier: modifier.modifier,
      condition: rewriteSlotReferences(
        modifier.condition,
        context.namedSlots,
        toPresence
      )!,
    }))
  );
}

/**
 * A condition emitted into a `&&` short-circuit must keep its grouping. `&&`
 * binds tighter than `||`, `??`, and `?:`, so a condition like
 * `inlineLabel || description` would otherwise short-circuit on its first
 * operand alone (`inlineLabel || (description && ...)`), silently rendering the
 * wrong thing. The condition is parenthesized only when its top level carries
 * one of those looser-binding operators; bare identifiers, member chains,
 * comparisons, and `&&`-only chains already bind at least as tightly and are
 * emitted verbatim.
 */
function parenthesizeIfCompound(
  condition: string | undefined
): string | undefined {
  if (condition === undefined) {
    return condition;
  }
  const trimmed = condition.trim();
  return hasLooseTopLevelOperator(trimmed) ? `(${trimmed})` : trimmed;
}

/**
 * True when the expression's top level (outside any nested parentheses,
 * brackets, braces, or string/template literals) contains an operator that
 * binds looser than `&&`: `||`, `??`, or a ternary `?:`. Optional chaining
 * (`?.`) binds tightly and does not count.
 */
function hasLooseTopLevelOperator(condition: string): boolean {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < condition.length; i += 1) {
    const char = condition[i];
    if (quote !== '') {
      if (char === '\\') {
        i += 1;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
    } else if (depth === 0) {
      if (char === '?') {
        if (condition[i + 1] === '.') {
          i += 1; // `?.` optional chaining - binds tightly
        } else {
          return true; // `??` nullish or `?` ternary
        }
      } else if (char === '|' && condition[i + 1] === '|') {
        return true;
      }
    }
  }
  return false;
}

function inlineConditional(
  branches: Array<{
    branch: ConditionalNode['conditions'][number];
    condition: string | undefined;
    body: { inline?: string };
  }>
): string {
  if (branches.length === 1) {
    return `${parenthesizeIfCompound(branches[0].condition)} && ${branches[0].body.inline}`;
  }
  const terms = branches.map(({ branch, condition, body }) =>
    branch.statement === 'else'
      ? String(body.inline)
      : `${condition} ? ${body.inline}`
  );
  if (branches[branches.length - 1].branch.statement !== 'else') {
    terms.push('null');
  }
  return terms.join(' : ');
}

function renderIteration(
  node: IterationNode,
  path: string,
  indent: number,
  context: JsxContext
): string[] {
  const padding = pad(indent);
  const parameters =
    node.index === undefined
      ? `(${node.item})`
      : `(${node.item}, ${node.index})`;
  const head = `${padding}{${memberTarget(node.items)}.map(${parameters} => `;

  if (node.key === undefined) {
    context.warnings.push({
      message:
        "Iteration has no 'key' expression; React list items render without keys",
      nodePath: path,
    });
  }

  // The loop item and index shadow a named slot of the same name inside the
  // loop.
  const { result: body, bindings } = renderInScope(context, () =>
    withShadowedSlotNames(context, [node.item, node.index], () =>
      renderIterationBody(node, path, indent, context)
    )
  );

  if (bindings.length > 0) {
    return scopedBlock(
      `${head}{`,
      bindings,
      body.block,
      indent + 1,
      `${padding}})}`
    );
  }
  if (body.inline !== undefined) {
    const line = `${head}${body.inline})}`;
    if (fits(line)) {
      return [line];
    }
  }
  return [`${head}(`, ...body.block, `${padding}))}`];
}

/**
 * The local a dynamic tag renders through. The root's is the `RootTag` the
 * component body hoists; any other takes the next file-wide name (`Tag`,
 * `Tag2`, ...) and declares it in the scope being rendered, the nearest one
 * enclosing the element, so the expression can read a loop item or a slot
 * scope. The capitalized binding is what makes JSX treat it as a tag.
 */
function dynamicTagBinding(
  node: ElementNode,
  expression: string,
  context: JsxContext
): string {
  if (node === context.dynamicRootNode) {
    return 'RootTag';
  }
  const count =
    context.dynamicTagCount ?? (context.dynamicTagCount = { value: 0 });
  count.value += 1;
  const name = count.value === 1 ? 'Tag' : `Tag${count.value}`;
  (context.scopeBindings ?? (context.scopeBindings = [])).push(
    `const ${name} = ${expression.trim()};`
  );
  return name;
}

/**
 * Renders inside a scope of its own - a loop callback or a scoped-slot
 * function - collecting the dynamic-tag bindings declared within it.
 */
function renderInScope<T>(
  context: JsxContext,
  render: () => T
): { result: T; bindings: string[] } {
  const outer = context.scopeBindings;
  const bindings: string[] = [];
  context.scopeBindings = bindings;
  try {
    return { result: render(), bindings };
  } finally {
    context.scopeBindings = outer;
  }
}

/**
 * A scope's function in block-body form, used only when it declares a
 * binding: the opener (ending in `{`), the bindings, then `return (...)` of
 * the body, whose lines sit at `bodyIndent` and move one level in.
 */
function scopedBlock(
  opener: string,
  bindings: string[],
  body: string[],
  bodyIndent: number,
  closer: string
): string[] {
  const padding = pad(bodyIndent);
  return [
    opener,
    ...bindings.map((binding) => `${padding}${binding}`),
    `${padding}return (`,
    ...body.map((line) => `${INDENTATION}${line}`),
    `${padding});`,
    closer,
  ];
}

/** The JSX an iteration renders per item, as an inline and a block form. */
function renderIterationBody(
  node: IterationNode,
  path: string,
  indent: number,
  context: JsxContext
): { inline?: string; block: string[] } {
  // A lone fragment with no wrapper in React is its children: they take the
  // key, through a keyed Fragment, as several children do. One with a
  // wrapper is that element, which takes the key itself.
  const loneFragment =
    node.children.length === 1 && node.children[0].type === 'fragment'
      ? node.children[0]
      : undefined;
  const wrapper =
    loneFragment === undefined
      ? undefined
      : fragmentWrapper(loneFragment, 'react');
  const children =
    loneFragment !== undefined && wrapper === undefined
      ? loneFragment.children
      : node.children;
  const loneChild =
    wrapper ?? (children.length === 1 ? children[0] : undefined);

  if (loneChild !== undefined && loneChild.type === 'element') {
    const block = renderElement(
      loneChild,
      `${path}.children[0]`,
      indent + 1,
      context,
      node.key
    );
    return {
      inline: block.length === 1 ? block[0].trimStart() : undefined,
      block,
    };
  } else if (node.key !== undefined) {
    context.usesFragmentImport = true;
    const allText = children.every((child) => child.type === 'text');
    const inline = allText
      ? `<Fragment key={${node.key}}>${children
          .map((child) => textPiece(child as TextNode))
          .join('')}</Fragment>`
      : undefined;
    return {
      inline,
      block: wrapJsxChildren(
        [`${pad(indent + 1)}<Fragment key={${node.key}}>`],
        renderJsxSiblings(children, `${path}.children`, indent + 2, context),
        `${pad(indent + 1)}</Fragment>`
      ),
    };
  } else {
    return renderExpressionBody(
      children,
      `${path}.children`,
      indent + 1,
      context
    );
  }
}

/**
 * Renders a component-reference node's named-slot projections
 * (`ElementNode.slots`) as props on the reference, each at the attribute
 * indent: a plain named slot becomes `closeButton={<.../>}` (a fragment when
 * multi-node), a scoped named slot a render prop `items={({ row }) => (...)}`.
 * The prop name uses the same normalization as the provider slot prop.
 */
function renderReactSlotProps(
  node: ElementNode,
  path: string,
  indent: number,
  context: JsxContext
): string[] {
  const padding = pad(indent);
  const lines: string[] = [];
  for (const named of normalizeNamedSlots(node.slots)) {
    const propName = normalizeSlotName(named.name);
    const scoped = named.slotScope.length > 0;
    // The slot's scope bindings shadow a named slot of the same name.
    const render = () =>
      withShadowedSlotNames(context, named.slotScope, () =>
        renderExpressionBody(
          named.content,
          `${path}.slots.${named.name}.content`,
          indent + 1,
          context
        )
      );
    // A scoped slot's render function is a scope of its own.
    const { result: body, bindings } = scoped
      ? renderInScope(context, render)
      : { result: render(), bindings: [] };
    const opener = scoped ? `({ ${named.slotScope.join(', ')} }) => ` : '';
    if (bindings.length > 0) {
      lines.push(
        ...scopedBlock(
          `${padding}${propName}={${opener}{`,
          bindings,
          body.block,
          indent + 1,
          `${padding}}}`
        )
      );
      continue;
    }
    if (body.inline !== undefined) {
      const single = `${padding}${propName}={${opener}${body.inline}}`;
      if (fits(single)) {
        lines.push(single);
        continue;
      }
    }
    if (opener !== '') {
      lines.push(
        `${padding}${propName}={${opener}(`,
        ...body.block,
        `${padding})}`
      );
    } else {
      lines.push(`${padding}${propName}={`, ...body.block, `${padding}}`);
    }
  }
  return lines;
}

/** Elements whose text renders as written, line breaks included. */
const WHITESPACE_PRESERVING_TAGS = new Set(['pre', 'textarea']);

function renderElement(
  node: ElementNode,
  path: string,
  indent: number,
  context: JsxContext,
  keyExpression?: string
): string[] {
  const padding = pad(indent);
  const parts = buildAttributeParts(node, path, context, keyExpression);
  const children = node.children ?? [];
  const joined = parts.length > 0 ? ` ${parts.join(' ')}` : '';
  // A per-target `tag` override replaces the element wholesale (a capitalized
  // value renders as a component reference); otherwise a dynamic tag renders
  // through the hoisted `const RootTag` local (the capitalized binding is what
  // makes JSX treat it as a dynamic tag).
  const tagOverride = (node.extensions?.react as ReactNodeOverrides | undefined)
    ?.tag;
  const tag =
    tagOverride ??
    (isDynamicTag(node.tag)
      ? dynamicTagBinding(node, node.tag.$expression, context)
      : node.tag);

  const multilineOpen = (closer: string): string[] => [
    `${padding}<${tag}`,
    ...parts.map((part) => `${padding}${INDENTATION}${part}`),
    `${padding}${closer}`,
  ];

  // A component-reference node with `slots` projects content into the composed
  // component's named slots, each rendered as a prop on the reference. Their
  // presence forces the multiline open form (the prop values are JSX).
  const slotPropLines =
    node.slots !== undefined
      ? renderReactSlotProps(node, path, indent + 1, context)
      : [];
  const hasSlotProps = slotPropLines.length > 0;
  const multilineOpenWithSlots = (closer: string): string[] => [
    `${padding}<${tag}`,
    ...parts.map((part) => `${padding}${INDENTATION}${part}`),
    ...slotPropLines,
    `${padding}${closer}`,
  ];
  const openTagLines = (): string[] =>
    hasSlotProps
      ? multilineOpenWithSlots('>')
      : fits(`${padding}${open}`)
        ? [`${padding}${open}`]
        : multilineOpen('>');

  if (children.length === 0) {
    if (hasSlotProps) {
      return multilineOpenWithSlots('/>');
    }
    const single = `${padding}<${tag}${joined} />`;
    return fits(single) ? [single] : multilineOpen('/>');
  }

  const open = `<${tag}${joined}>`;
  const close = `</${tag}>`;

  // A component-reference node with `slotScope` projects its children through
  // the composed component's default scoped slot: the children become a
  // function child destructuring the received scope.
  if (node.slotScope !== undefined && node.slotScope.length > 0) {
    const openLines = openTagLines();
    const parameter = `{ ${node.slotScope.join(', ')} }`;
    const { result: body, bindings } = renderInScope(context, () =>
      withShadowedSlotNames(context, node.slotScope ?? [], () =>
        renderExpressionBody(children, `${path}.children`, indent + 2, context)
      )
    );
    if (bindings.length > 0) {
      return [
        ...openLines,
        ...scopedBlock(
          `${padding}${INDENTATION}{(${parameter}) => {`,
          bindings,
          body.block,
          indent + 2,
          `${padding}${INDENTATION}}}`
        ),
        `${padding}${close}`,
      ];
    }
    if (body.inline !== undefined) {
      const inlineFunction = `${padding}${INDENTATION}{(${parameter}) => ${body.inline}}`;
      if (fits(inlineFunction)) {
        return [...openLines, inlineFunction, `${padding}${close}`];
      }
    }
    return [
      ...openLines,
      `${padding}${INDENTATION}{(${parameter}) => (`,
      ...body.block,
      `${padding}${INDENTATION})}`,
      `${padding}${close}`,
    ];
  }

  if (!hasSlotProps && children.every((child) => child.type === 'text')) {
    const textChildren = children as TextNode[];
    // JSX trims the whitespace of a text child across line breaks, which a
    // `<pre>` or `<textarea>` renders; its static text holding one is written
    // as a string expression, which React sets as it is.
    const preservesLineBreaks =
      WHITESPACE_PRESERVING_TAGS.has(tag) &&
      textChildren.some(
        (child) => child.content !== undefined && child.content.includes('\n')
      );
    const text = textChildren
      .map((child) =>
        preservesLineBreaks && child.content !== undefined
          ? `{${quoteSingle(child.content)}}`
          : textPiece(child)
      )
      .join('');
    const single = `${padding}${open}${text}${close}`;
    if (preservesLineBreaks || fits(single)) {
      return [single];
    }
  }

  return wrapJsxChildren(
    openTagLines(),
    renderJsxSiblings(children, `${path}.children`, indent + 1, context),
    `${padding}${close}`
  );
}

/** The literal tag of an element React renders as written, if any. */
function intrinsicTag(node: ElementNode): string | undefined {
  const override = node.extensions?.react as ReactNodeOverrides | undefined;
  return override?.tag === undefined && typeof node.tag === 'string'
    ? node.tag
    : undefined;
}

/**
 * The intrinsic tag whose event props React must know, or `undefined` for a
 * node whose events are a component's own props: a capitalized tag (or tag
 * override), a component-valued dynamic tag, and a custom element, whose
 * events React attaches by name. A dynamic tag that resolves a tag string is
 * checked against its default.
 */
function eventCheckedTag(node: ElementNode): string | undefined {
  const override = node.extensions?.react as ReactNodeOverrides | undefined;
  const tag =
    override?.tag ??
    (isDynamicTag(node.tag)
      ? node.tag.componentValued === true
        ? undefined
        : node.tag.default
      : node.tag);
  return tag !== undefined && /^[a-z][A-Za-z0-9]*$/.test(tag) ? tag : undefined;
}

/**
 * Options whose `defaultSelected` their select carries as its
 * `defaultValue`, so the option itself leaves it out.
 */
const optionsSelectedBySelect = new WeakSet<ElementNode>();

/**
 * An element's attributes with the default-value properties React does not
 * take on an option moved to where it takes them. React has no
 * `defaultSelected`: it preselects an option through its select's
 * `defaultValue`, and warns about `selected` on an option. So a select whose
 * options with a `defaultSelected` are all its own (directly, in a fragment
 * or an `optgroup`) and have a known value gains a `defaultValue` choosing
 * among them, the last selected one winning as in markup:
 * `defaultValue={featured ? 'featured' : undefined}`. An option it cannot
 * reach that way - in a loop, a conditional or a slot, or one whose value is
 * not known - writes its default as `selected`, which preselects it with a
 * development warning. A select with a `value`, `defaultValue` or
 * `multiple` keeps its own and its options write `selected`.
 */
function selectDefaults(node: ElementNode, attributes: Attributes): Attributes {
  const tag = intrinsicTag(node);
  if (tag === 'option') {
    return optionAttributes(node, attributes);
  }
  if (
    tag !== 'select' ||
    attributes.value !== undefined ||
    attributes.defaultValue !== undefined ||
    attributes.multiple !== undefined
  ) {
    return attributes;
  }
  const options: ElementNode[] = [];
  if (!collectOwnOptions(node.children ?? [], options)) {
    return attributes;
  }
  // The value so far: a static one while every preset option is static.
  let value: AttributeValue | undefined;
  const selected: ElementNode[] = [];
  for (const option of options) {
    const own = option.attributes ?? {};
    const preset = own.defaultSelected as AttributeValue | undefined;
    if (preset === undefined || preset === false) {
      continue;
    }
    const optionValue = optionValueOf(option);
    if (optionValue === undefined || own.selected !== undefined) {
      return attributes;
    }
    selected.push(option);
    if (isExpressionBinding(preset)) {
      const condition = preset.$expression.trim();
      const otherwise =
        value === undefined ? 'undefined' : valueExpression(value);
      value = {
        $expression: `${IDENTIFIER_PATH.test(condition) ? condition : `(${condition})`} ? ${valueExpression(optionValue)} : ${otherwise}`,
      };
    } else {
      value = optionValue;
    }
  }
  if (value === undefined) {
    return attributes;
  }
  for (const option of selected) {
    optionsSelectedBySelect.add(option);
  }
  return { ...attributes, defaultValue: value };
}

/** Matches an identifier or a dot-separated member path: `props.open`. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/** A value as an expression: a static one as a literal. */
function valueExpression(value: AttributeValue): string {
  if (isExpressionBinding(value)) {
    const expression = value.$expression.trim();
    return IDENTIFIER_PATH.test(expression) ? expression : `(${expression})`;
  }
  return typeof value === 'string' ? quoteSingle(value) : String(value);
}

/**
 * Collects the options a select holds as its own: direct children, and those
 * in a fragment or an `optgroup`. False when an option with a
 * `defaultSelected` sits anywhere else below the select.
 */
function collectOwnOptions(
  nodes: readonly TemplateNode[],
  options: ElementNode[]
): boolean {
  for (const node of nodes) {
    if (node.type === 'fragment') {
      if (!collectOwnOptions(node.children, options)) {
        return false;
      }
    } else if (node.type === 'element' && intrinsicTag(node) === 'option') {
      if (
        (node.conditionalAttributes ?? []).some(
          (entry) => entry.attributes.defaultSelected !== undefined
        )
      ) {
        return false;
      }
      options.push(node);
    } else if (node.type === 'element' && intrinsicTag(node) === 'optgroup') {
      if (!collectOwnOptions(node.children ?? [], options)) {
        return false;
      }
    } else if (holdsDefaultSelected(node)) {
      return false;
    }
  }
  return true;
}

/** True when an option with a `defaultSelected` sits anywhere in `value`. */
function holdsDefaultSelected(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(holdsDefaultSelected);
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    record.type === 'element' &&
    record.tag === 'option' &&
    JSON.stringify([record.attributes, record.conditionalAttributes]).includes(
      '"defaultSelected"'
    )
  ) {
    return true;
  }
  return Object.values(record).some(holdsDefaultSelected);
}

/**
 * An option's value: its `value` attribute, or else its text, as the
 * browser takes it. Undefined when neither is known.
 */
function optionValueOf(option: ElementNode): AttributeValue | undefined {
  const value = option.attributes?.value as AttributeValue | undefined;
  if (value !== undefined) {
    return value;
  }
  const children = option.children ?? [];
  if (children.length === 1 && children[0].type === 'text') {
    const text = children[0];
    return text.content !== undefined
      ? text.content.trim()
      : { $expression: String(text.expression).trim() };
  }
  return undefined;
}

/**
 * An option's attributes with its `defaultSelected` left to its select, or
 * else written as `selected`; an authored `selected` stands.
 */
function optionAttributes(
  node: ElementNode,
  attributes: Attributes
): Attributes {
  if (!('defaultSelected' in attributes)) {
    return attributes;
  }
  const keep =
    !optionsSelectedBySelect.has(node) && attributes.selected === undefined;
  return Object.fromEntries(
    Object.entries(attributes).flatMap(([name, value]) =>
      name !== 'defaultSelected'
        ? [[name, value]]
        : keep
          ? [['selected', value]]
          : []
    )
  ) as Attributes;
}

/**
 * The React attributes override with `className` read as the node's
 * `class`, so it replaces the class, or removes it with `null`, as `class`
 * does. A `class` written beside it wins.
 */
function reactAttributeOverride(
  attributes: AttributeOverrides | undefined
): AttributeOverrides | undefined {
  if (attributes === undefined || !('className' in attributes)) {
    return attributes;
  }
  const { className, ...rest } = attributes;
  return rest.class !== undefined
    ? rest
    : { ...rest, class: className as AttributeOverrides['class'] };
}

/** An `indeterminate` value as code: its expression, or `true`. */
function indeterminateCode(value: unknown): string {
  return isExpressionBinding(value) ? value.$expression.trim() : 'true';
}

/**
 * An expression as an operand of `&&` or `?:`: as it is when it is a member
 * path or a negated one, parenthesized otherwise.
 */
function operand(expression: string): string {
  return /^!*[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(expression)
    ? expression
    : `(${expression})`;
}

/**
 * The value an `<input>`'s `indeterminate` takes from the node and its
 * conditional entries together: the node's own, then each entry's in order
 * while its condition holds, the last holding entry winning. An entry alone
 * reads `condition && value` (`condition` for a static `true`); after
 * another value, `condition ? value : previous`.
 */
function combinedIndeterminate(
  own: unknown,
  entries: ReadonlyArray<{ condition: string; value: unknown }>
): string | undefined {
  let combined = setsThroughRef(own) ? indeterminateCode(own) : undefined;
  for (const { condition, value } of entries) {
    const code = indeterminateCode(value);
    combined =
      combined === undefined
        ? value === true
          ? condition.trim()
          : `${operand(condition.trim())} && ${operand(code)}`
        : `${operand(condition.trim())} ? ${operand(code)} : ${operand(combined)}`;
  }
  return combined;
}

/**
 * An `<input>`'s `indeterminate` - the node's own or its React override's,
 * and its conditional entries', each bound or a static `true` - set through
 * its `ref`: the property has no attribute and React no prop for it, so the
 * attribute gives way to a `ref` taking the generated `indeterminateRef`
 * helper's callback, which writes the property when the input mounts and
 * when the value changes. A `ref` the node sets itself composes with it.
 *
 * @returns The node's attributes with the `ref`, and whether the
 *   conditional entries' `indeterminate` is set through it, so they leave it
 *   out.
 */
function indeterminateAsRef(
  node: ElementNode,
  override: ReactNodeOverrides | undefined,
  attributes: Attributes,
  context: JsxContext
): { attributes: Attributes; fromEntries: boolean } {
  const entries = (node.conditionalAttributes ?? [])
    .filter((entry) => setsThroughRef(entry.attributes.indeterminate))
    .map((entry) => ({
      condition: entry.condition,
      value: entry.attributes.indeterminate,
    }));
  const value = attributes.indeterminate;
  const combined =
    reactTag(node, override) === 'input'
      ? combinedIndeterminate(value, entries)
      : undefined;
  if (combined === undefined) {
    return { attributes, fromEntries: false };
  }
  context.usesIndeterminateRef = true;
  const call = `${INDETERMINATE_REF_NAME}(${combined})`;
  const ownRef = attributes.ref;
  // The ref takes the place of the node's own `indeterminate`, or of its own
  // `ref`, composed with it; else it follows the other attributes.
  const ordered: Array<[string, unknown]> = [];
  let placed = false;
  for (const [name, entry] of Object.entries(attributes)) {
    if (name === 'indeterminate' && setsThroughRef(value)) {
      if (ownRef === undefined) {
        ordered.push(['ref', { $expression: call }]);
        placed = true;
      }
    } else if (name === 'ref' && isExpressionBinding(entry)) {
      context.usesComposeRefs = true;
      ordered.push([
        'ref',
        {
          $expression: `${COMPOSE_REFS_NAME}(${call}, ${entry.$expression.trim()})`,
        },
      ]);
      placed = true;
    } else {
      ordered.push([name, entry]);
    }
  }
  if (!placed) {
    ordered.push(['ref', { $expression: call }]);
  }
  return {
    attributes: Object.fromEntries(ordered) as Attributes,
    fromEntries: entries.length > 0,
  };
}

/**
 * Warns where an `indeterminate` reaches an `<input>` in the React output
 * that {@link indeterminateAsRef} cannot set through the ref - a static
 * value other than `true` or `false`, the node's or a conditional entry's -
 * since it is a DOM property with no attribute and React has no prop for
 * it, so the output would neither set it nor type-check.
 */
function warnIndeterminate(
  node: ElementNode,
  override: ReactNodeOverrides | undefined,
  attributes: Attributes,
  path: string,
  context: JsxContext
): void {
  if (reactTag(node, override) !== 'input') {
    return;
  }
  const message =
    "React has no indeterminate prop, so <input indeterminate={...}> neither sets the box's mixed state nor type-checks. Bind it to an expression, or write true or false, and the output sets the property from a ref";
  const unset = (value: unknown): boolean =>
    value === undefined ||
    value === null ||
    value === false ||
    setsThroughRef(value);
  if (!unset(attributes.indeterminate)) {
    context.warnings.push({
      message,
      nodePath:
        override?.attributes?.indeterminate !== undefined
          ? `${path}.extensions.react.attributes.indeterminate`
          : `${path}.attributes.indeterminate`,
    });
  }
  (node.conditionalAttributes ?? []).forEach((entry, index) => {
    if (!unset(entry.attributes.indeterminate)) {
      context.warnings.push({
        message,
        nodePath: `${path}.conditionalAttributes[${index}].attributes.indeterminate`,
      });
    }
  });
}

/**
 * Whether the React override removes the node's class - a `null` `class`, or
 * a `null` `className` with no `class` beside it - so the node renders no
 * class here, a BEM runtime call included.
 *
 * @param node - The element node.
 * @returns `true` when React renders the node with no class.
 */
export function reactRemovesClass(node: ElementNode): boolean {
  const override = node.extensions?.react as ReactNodeOverrides | undefined;
  return reactAttributeOverride(override?.attributes)?.class === null;
}

function buildAttributeParts(
  node: ElementNode,
  path: string,
  context: JsxContext,
  keyExpression?: string
): string[] {
  const override = node.extensions?.react as ReactNodeOverrides | undefined;
  const attributeOverride = reactAttributeOverride(override?.attributes);
  const merged = selectDefaults(
    node,
    mergeAttributeOverride(node.attributes, attributeOverride)
  );
  warnIndeterminate(node, override, merged, path, context);
  const { attributes, fromEntries } = indeterminateAsRef(
    node,
    override,
    merged,
    context
  );
  const events = override?.events ?? node.events ?? [];
  const isOption = intrinsicTag(node) === 'option';
  // Named-slot references in each condition resolve to the slot's React prop
  // here, so attribute/class expressions match the conditional nodes that gate
  // on the same slot.
  // An entry's `indeterminate` the node's ref sets is left out of it.
  const entryAttributes = (entry: Attributes): Attributes => {
    if (!fromEntries || !setsThroughRef(entry.indeterminate)) {
      return entry;
    }
    return Object.fromEntries(
      Object.entries(entry).filter(([name]) => name !== 'indeterminate')
    ) as Attributes;
  };
  // An override removing the node's class takes the condition-gated classes
  // with it; the entries' other attributes stay.
  const conditionals = (
    reactRemovesClass(node)
      ? withoutConditionalClasses(node.conditionalAttributes ?? [])
      : (node.conditionalAttributes ?? [])
  ).map((conditional) => ({
    ...conditional,
    attributes: isOption
      ? optionAttributes(node, entryAttributes(conditional.attributes))
      : entryAttributes(conditional.attributes),
    condition: rewriteSlotReferences(
      conditional.condition,
      context.namedSlots,
      reactPresence(context)
    )!,
  }));
  const isPassthrough = node === context.passthroughNode;
  const isRouted =
    context.routedNode !== undefined && node === context.routedNode;
  // The element the consumer's `ref` reaches: the routed element under
  // `handle: 'routed'`, the passthrough root otherwise.
  const holdsHandle = context.routedHandle === true ? isRouted : isPassthrough;
  // A passthrough root that also spreads a named record folds each record
  // into the consumer's attributes, as Vue's `mergeProps` does: the classes
  // join, the styles merge, a handler both carry runs both, and the record
  // wins every other key. The combined record is what the root spreads and
  // where its class, style and composed handlers read the consumer's; an
  // authored value's fallback and a joined id list read the consumer's own.
  const passthroughRecords = isPassthrough
    ? nodeSpreads(attributes).filter((expression) => expression !== 'rest')
    : [];
  const consumerRecord =
    passthroughRecords.length > 0
      ? bindConsumerAndSpread(passthroughRecords, context)
      : 'rest';
  // Whether a consumer prop of this name lands on the routed element rather
  // than the root: a declared or slot prop never reaches either share.
  const routes = (key: string): boolean =>
    context.routedEntries !== undefined &&
    key !== 'ref' &&
    !(context.destructuredNames?.has(key) ?? false) &&
    isRoutedAttribute(context.routedEntries, key, attributeName);
  // The consumer share an id list this element sets joins, the element's ids
  // first: the root's `rest` or the routed element's, when the consumer's
  // value of that name lands on this element.
  const joinedShare = (name: string): string | undefined => {
    const key = attributeName(name);
    if (!isTokenListAttribute(name)) return undefined;
    if (isRouted && routes(key)) return ROUTED_REST;
    if (
      isPassthrough &&
      !(context.destructuredNames?.has(key) ?? false) &&
      !routes(key)
    ) {
      return 'rest';
    }
    return undefined;
  };
  // The consumer `className` (destructured from props) is appended last,
  // after the authored expression classes.
  const consumerClass = !isPassthrough
    ? undefined
    : consumerRecord === 'rest'
      ? CONSUMER_CLASS_NAME
      : `${consumerRecord}.className`;
  const consumerStyle =
    consumerRecord === 'rest' ? 'style' : `${consumerRecord}.style`;

  // In BEM runtime mode this node renders its BEM classes as the `bem(...)`
  // call: the contributed literals are suppressed from the static class list
  // and the folded conditional classes from the conditional rendering. A
  // node whose class the override removes has no call (`reactRemovesClass`).
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
  if (keyExpression !== undefined) {
    parts.push(`key={${keyExpression}}`);
  }
  // Object spreads lead the authored attributes (which override per key).
  parts.push(
    ...nodeSpreads(attributes)
      .filter((expression) => !passthroughRecords.includes(expression))
      .map((expression) => `{...${expression}}`)
  );
  // A class leads the authored attributes, where hand-written markup puts it.
  const attributesStart = parts.length;

  let classRendered = false;
  let styleRendered = false;
  let authoredRefComposed = false;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || name === '$spread') {
      continue;
    }
    if (name === 'class') {
      const classValue = value as Attributes['class'];
      const staticClasses = normalizeClassList(classValue).filter(
        (className) => !contributedClasses.has(className)
      );
      const part = classNamePart(
        staticClasses,
        classConditionals,
        classExpressions(classValue),
        runtimeCallExpression,
        consumerClass
      );
      if (part !== undefined) {
        parts.push(part);
      }
      classRendered = true;
    } else if (name === 'style') {
      // A node spreading `rest` whose style reads the consumer's
      // (`{ ...rest.style }`) keeps it last, over its own properties, as a
      // passthrough root keeps the consumer's style.
      const restStyle =
        !isPassthrough &&
        context.declaresRest === true &&
        nodeSpreads(attributes).includes('rest') &&
        readsRest(wholeStyleExpression(value), 'style')
          ? 'rest.style'
          : undefined;
      const stylePart = styleProp(
        value as NestedStyleObject,
        context.stylingInline,
        isPassthrough ? consumerStyle : undefined,
        context,
        restStyle
      );
      if (stylePart !== undefined) {
        parts.push(stylePart);
      }
      styleRendered = true;
    } else if (isExpressionBinding(value)) {
      // On a surface root an authored value that resolves to nothing leaves
      // the consumer's attribute of the same name in place; a name destructured
      // out of `rest` is never in it.
      const key = attributeName(name);
      // A declared named slot read in the expression is its prop, as a
      // condition reads it.
      const authored = String(
        rewriteSlotReferences(
          value.$expression.trim(),
          context.namedSlots,
          reactPresence(context)
        )
      );
      if (key === 'ref' && holdsHandle) {
        // The surface forwards the consumer's ref; both receive the node.
        context.usesComposeRefs = true;
        authoredRefComposed = true;
        parts.push(`ref={${COMPOSE_REFS_NAME}(${authored}, ref)}`);
      } else if (key === 'ref' && (isPassthrough || isRouted)) {
        // The handle lands on the other element, so this ref is the
        // template's own.
        parts.push(`ref={${authored}}`);
      } else if (
        key === 'ref' &&
        context.declaresRest === true &&
        nodeSpreads(attributes).includes('rest')
      ) {
        // `rest` carries the consumer's ref; one written after the spread
        // would replace it, so both receive the node.
        context.usesComposeRefs = true;
        parts.push(`ref={${COMPOSE_REFS_NAME}(${authored}, rest.ref)}`);
      } else if (joinedShare(name) !== undefined) {
        // An id list the surface sets keeps its ids and gains the
        // consumer's.
        context.usesAuthoredAndConsumer = true;
        parts.push(
          `${key}={${AUTHORED_AND_CONSUMER}(${authored}, ${joinedShare(name)}, ${quoteSingle(key)})}`
        );
      } else if (
        isPassthrough &&
        !(context.destructuredNames?.has(key) ?? false) &&
        !routes(key)
      ) {
        context.usesAuthoredOrConsumer = true;
        parts.push(
          `${key}={${AUTHORED_OR_CONSUMER}(${authored}, rest, ${quoteSingle(key)})}`
        );
      } else if (isRouted && routes(key)) {
        // The routed element's authored value falls back to the consumer's
        // routed attribute of the same name.
        context.usesAuthoredOrConsumer = true;
        parts.push(
          `${key}={${AUTHORED_OR_CONSUMER}(${authored}, ${ROUTED_REST}, ${quoteSingle(key)})}`
        );
      } else {
        parts.push(`${key}={${authored}}`);
      }
    } else if (typeof value === 'boolean') {
      if (value) {
        parts.push(attributeName(name));
      }
    } else if (typeof value === 'number') {
      parts.push(`${attributeName(name)}={${value}}`);
    } else if (joinedShare(name) !== undefined) {
      // A static id list on the surface joins the consumer's too.
      const key = attributeName(name);
      context.usesAuthoredAndConsumer = true;
      parts.push(
        `${key}={${AUTHORED_AND_CONSUMER}(${quoteSingle(String(value))}, ${joinedShare(name)}, ${quoteSingle(key)})}`
      );
    } else {
      const key = attributeName(name);
      const numeric = numericAttributeValue(node, key, String(value));
      parts.push(
        numeric !== undefined
          ? `${key}={${numeric}}`
          : `${key}="${escapeJsxAttributeValue(String(value))}"`
      );
    }
  }

  if (!classRendered) {
    const part = classNamePart(
      [],
      classConditionals,
      [],
      runtimeCallExpression,
      consumerClass
    );
    if (part !== undefined) {
      parts.splice(attributesStart, 0, part);
    }
  }

  for (const conditional of conditionals) {
    for (const [name, value] of Object.entries(conditional.attributes)) {
      if (name === 'class' || name === 'style' || value === undefined) {
        continue;
      }
      const key = attributeName(name);
      const expression =
        (typeof value === 'string'
          ? numericAttributeValue(node, key, value)
          : undefined) ?? conditionalValueExpression(value as AttributeValue);
      const gated = `${conditional.condition} ? ${expression} : undefined`;
      if (joinedShare(name) !== undefined) {
        // A condition-gated id list on the surface joins the consumer's too,
        // which stands alone while the condition is false.
        context.usesAuthoredAndConsumer = true;
        parts.push(
          `${key}={${AUTHORED_AND_CONSUMER}(${gated}, ${joinedShare(name)}, ${quoteSingle(key)})}`
        );
        continue;
      }
      parts.push(`${key}={${gated}}`);
    }
  }

  const target = context.plan.get(node);
  if (target?.generatedNodeValue !== undefined) {
    parts.push(`${GENERATED_NODE_ATTRIBUTE}="${target.generatedNodeValue}"`);
  }

  // A node that spreads exactly `rest` carries the consumer's handlers in it,
  // as a surface root's spread does.
  const spreadsRest =
    context.declaresRest === true && nodeSpreads(attributes).includes('rest');
  for (const prop of eventProps(
    events,
    path,
    context.warnings,
    eventCheckedTag(node)
  )) {
    // On a surface root, or a node spreading `rest`, the spread may carry the
    // consumer's handler for the same event; the template's handler composes
    // with it rather than overwriting it, the consumer's running first and
    // the template's only when the consumer did not prevent the default, and
    // when neither side supplies one the helper yields `undefined`, so no
    // listener is attached. A declared prop of the event's own name is destructured out
    // of `rest`, so it already is the consumer's handler.
    // On a routed element the routed share carries the consumer's handler
    // instead, and a handler routed away from the root leaves nothing there
    // to compose with. A prop React has no event for, named after a
    // hyphenated event (`onMy-event`), is no key of the consumer's typed
    // props, so nothing composes with it: the template's handler stands
    // alone, as the warning for the event says.
    const composable = isIdentifier(prop.name);
    if (composable && isRouted && routes(prop.name)) {
      context.usesComposeHelper = true;
      parts.push(
        `${prop.name}={${COMPOSE_HELPER_NAME}(${ROUTED_REST}.${prop.name}, ${prop.expression})}`
      );
      continue;
    }
    if (
      composable &&
      (isPassthrough || spreadsRest) &&
      !(context.destructuredNames?.has(prop.name) ?? false) &&
      !(isPassthrough && routes(prop.name))
    ) {
      context.usesComposeHelper = true;
      const consumerHandler =
        isPassthrough && context.polymorphicRootTag !== undefined
          ? `${isPassthrough ? consumerRecord : 'rest'}.${prop.name} as ComponentPropsWithRef<'${context.polymorphicRootTag}'>['${prop.name}']`
          : `${isPassthrough ? consumerRecord : 'rest'}.${prop.name}`;
      parts.push(
        `${prop.name}={${COMPOSE_HELPER_NAME}(${consumerHandler}, ${prop.expression})}`
      );
      continue;
    }
    parts.push(`${prop.name}={${prop.expression}}`);
  }

  if (isRouted) {
    // The consumer's routed attributes lead, so the authored ones override
    // them per key, as on the root.
    parts.unshift(`{...${ROUTED_REST}}`);
  }

  if (isPassthrough) {
    // Spread the consumer's undeclared props first so the authored
    // attributes above override them per key; merge a consumer `style` not
    // already merged into an authored one; forward the DOM handle.
    parts.unshift(`{...${consumerRecord}}`);
    if (!styleRendered) {
      parts.push(`style={${consumerStyle}}`);
    }
  }

  if (holdsHandle && !authoredRefComposed) {
    parts.push('ref={ref}');
  }

  return parts;
}

/**
 * Binds the passthrough root's consumer attributes combined with its spread
 * records in the scope being rendered, once per scope, and returns the
 * binding's name: `const restAndSpread = consumerAndSpread({ ...rest,
 * className, style }, extraProps);`.
 */
function bindConsumerAndSpread(
  records: readonly string[],
  context: JsxContext
): string {
  context.usesConsumerAndSpread = true;
  const bindings = context.scopeBindings ?? (context.scopeBindings = []);
  const binding = `const ${CONSUMER_AND_SPREAD_BINDING} = ${CONSUMER_AND_SPREAD}({ ...rest, className, style }, ${records.join(', ')});`;
  if (!bindings.includes(binding)) bindings.push(binding);
  return CONSUMER_AND_SPREAD_BINDING;
}

/** The passthrough root's consumer class, destructured from props. */
const CONSUMER_CLASS_NAME = 'className';

/**
 * Builds the `className` part from static, condition-gated, and expression
 * classes, applying the fixed concatenation order (static first, then
 * conditional in array order, then expression classes in authored order).
 * A conditional class is dropped when a static class carries it; one
 * repeated across conditional entries applies whenever any of its
 * conditions holds. Plain-reference expression terms carry a generated
 * falsy guard so a falsy runtime value contributes nothing; once any other
 * expression joins, the list renders as an array joined after dropping its
 * falsy entries, so each expression is evaluated exactly once and never
 * stands as a condition of its own. The passthrough root's consumer class,
 * when given, joins last; standing alone it binds bare.
 */
function classNamePart(
  staticClasses: string[],
  conditionals: ConditionalAttributes[],
  authoredExpressionClasses: string[],
  runtimeCall?: string,
  consumerClass?: string
): string | undefined {
  const expressionClasses =
    consumerClass === undefined
      ? authoredExpressionClasses
      : [...authoredExpressionClasses, consumerClass];
  const conditionalClasses = groupConditionalClasses(
    conditionals,
    staticClasses
  ).map((group) => ({
    condition: joinConditions(group.conditions),
    classes: group.classes,
  }));

  if (!expressionClasses.every(isReferenceExpression)) {
    const entries: string[] = [];
    if (staticClasses.length > 0) {
      entries.push(classStringLiteral(staticClasses.join(' ')));
    }
    if (runtimeCall !== undefined) {
      entries.push(runtimeCall);
    }
    for (const entry of conditionalClasses) {
      entries.push(
        `${entry.condition} ? ${classStringLiteral(entry.classes.join(' '))} : ''`
      );
    }
    entries.push(...expressionClasses.map((expression) => expression.trim()));
    return `className={[${entries.join(', ')}].filter(Boolean).join(' ')}`;
  }

  // The runtime call always yields a non-empty string (at least the block
  // class), so it carries no falsy guard. It sits after the static classes
  // and before the conditional/expression classes, matching literal mode's
  // author-static-then-BEM order.
  if (runtimeCall === undefined) {
    if (conditionalClasses.length === 0 && expressionClasses.length === 0) {
      if (staticClasses.length === 0) {
        return undefined;
      }
      const value = staticClasses.join(' ');
      const quote = classAttributeQuote(value);
      return `className=${quote}${escapeClassAttributeValue(value, quote)}${quote}`;
    }

    if (
      staticClasses.length === 0 &&
      conditionalClasses.length === 1 &&
      expressionClasses.length === 0
    ) {
      const [entry] = conditionalClasses;
      return `className={${entry.condition} ? ${classStringLiteral(entry.classes.join(' '))} : ''}`;
    }

    if (
      staticClasses.length === 0 &&
      conditionalClasses.length === 0 &&
      expressionClasses.length === 1
    ) {
      // The consumer's `className` is a string or `undefined`, and React
      // renders no attribute for `undefined`, so it passes through bare.
      return consumerClass !== undefined
        ? `className={${consumerClass}}`
        : `className={${expressionClasses[0]} || ''}`;
    }
  } else if (
    staticClasses.length === 0 &&
    conditionalClasses.length === 0 &&
    expressionClasses.length === 0
  ) {
    return `className={${runtimeCall}}`;
  }

  const terms: string[] = [];
  if (staticClasses.length > 0) {
    terms.push(classStringLiteral(staticClasses.join(' ')));
  }
  if (runtimeCall !== undefined) {
    terms.push(terms.length === 0 ? runtimeCall : `' ' + ${runtimeCall}`);
  }
  for (const entry of conditionalClasses) {
    const prefix = terms.length > 0 ? ' ' : '';
    terms.push(
      `(${entry.condition} ? ${classStringLiteral(prefix + entry.classes.join(' '))} : '')`
    );
  }
  for (const expression of expressionClasses) {
    if (terms.length === 0) {
      // As the sole/leading operand the reference is coerced by `|| ''`.
      terms.push(`(${expression} || '')`);
    } else {
      terms.push(`(${expression} ? ' ' + ${expression} : '')`);
    }
  }
  return `className={${terms.join(' + ')}}`;
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
 * Builds the `style` prop. A whole-object expression passes through as the
 * style value. Otherwise expression-valued properties always render in the
 * style object - they go through React's dynamic style mechanism regardless
 * of the stylesheet placement - while static plain properties join them only
 * under the `inline` placement (and only when no nested selectors force the
 * style to a stylesheet). Returns `undefined` when there is nothing to
 * render. `restStyle` is the consumer's style on a node spreading `rest`
 * whose whole-object expression already reads it: it follows the node's own
 * properties, so the consumer's wins over them too.
 */
function styleProp(
  style: NestedStyleObject,
  stylingInline: boolean,
  consumerStyle: string | undefined,
  context: JsxContext,
  restStyle?: string
): string | undefined {
  const wholeExpression = wholeStyleExpression(style);
  const includeStatic =
    stylingInline && !hasNestedSelectors(style) && hasPlainProperties(style);
  const entries: string[] = [];
  let hasCustomProperty = false;
  for (const [property, value] of Object.entries(style)) {
    if (property === '$expression') {
      continue;
    }
    if (isExpressionBinding(value)) {
      entries.push(
        `${stylePropertyKey(property)}: ${value.$expression.trim()}`
      );
      if (property.startsWith('--')) {
        hasCustomProperty = true;
      }
    } else if (
      includeStatic &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      const serialized =
        typeof value === 'number' ? String(value) : quoteSingle(String(value));
      entries.push(`${stylePropertyKey(property)}: ${serialized}`);
      if (property.startsWith('--')) {
        hasCustomProperty = true;
      }
    }
  }
  // Merge order (later wins): the whole-object expression is the base layer,
  // then authored static / per-property entries, then the consumer style.
  if (entries.length === 0) {
    // Only spreads remain. A lone whole-object or lone consumer passes through
    // bare; both together spread into one object. A lone object literal
    // declaring a custom property is checked like a built one, since React's
    // style type takes no `--*` key.
    if (wholeExpression !== undefined && consumerStyle === undefined) {
      const literal = wholeExpression.trim();
      if (declaresCustomProperty(literal)) {
        context.usesCssCustomProperty = true;
        return `style={(${literal} satisfies ${CUSTOM_PROPERTY_STYLE_TYPE}) as CSSProperties}`;
      }
      return `style={${literal}}`;
    }
    if (wholeExpression === undefined) {
      // A passthrough node with no authored inline style still forwards the
      // consumer style; otherwise there is nothing to render.
      return consumerStyle !== undefined
        ? `style={${consumerStyle}}`
        : undefined;
    }
    return `style={{ ...${wholeExpression.trim()}, ...${consumerStyle} }}`;
  }
  const objectParts: string[] = [];
  // The consumer's style is read once, last: a whole-object expression that
  // is the consumer's style alone moves to the end, and an object literal
  // spreading it keeps its other members without that spread.
  const readsRestLast = consumerStyle === undefined && restStyle !== undefined;
  const literalMembers =
    readsRestLast && wholeExpression !== undefined
      ? literalMembersWithoutRest(wholeExpression, 'style')
      : undefined;
  if (literalMembers !== undefined) {
    if (literalMembers.every((member) => member.startsWith('...'))) {
      objectParts.push(...literalMembers);
    } else {
      objectParts.push(`...{ ${literalMembers.join(', ')} }`);
    }
  } else if (
    wholeExpression !== undefined &&
    !(readsRestLast && wholeExpression.trim() === restStyle)
  ) {
    objectParts.push(`...${wholeExpression.trim()}`);
  }
  objectParts.push(...entries);
  if (consumerStyle !== undefined) {
    objectParts.push(`...${consumerStyle}`);
  } else if (restStyle !== undefined) {
    objectParts.push(`...${restStyle}`);
  }
  if (!hasCustomProperty) {
    return `style={{ ${objectParts.join(', ')} }}`;
  }
  // `satisfies` checks every key, a typo in a standard property included,
  // against CSSProperties widened by `--*`; the literal stays fresh through
  // it, so the `as` hands it on as plain CSSProperties for React's prop.
  context.usesCssCustomProperty = true;
  return `style={({ ${objectParts.join(', ')} } satisfies ${CUSTOM_PROPERTY_STYLE_TYPE}) as CSSProperties}`;
}

/** The file-local style type admitting CSS custom properties. */
export const CUSTOM_PROPERTY_STYLE_TYPE = 'StyleWithCustomProperties';

/**
 * Whether a style expression is an object literal with a CSS custom
 * property among its own keys: a quoted `--*` key at the literal's top
 * level, followed by a colon. A key of a nested object or an argument, and
 * any expression that is not an object literal, is not one.
 */
function declaresCustomProperty(expression: string): boolean {
  if (!expression.startsWith('{') || !expression.endsWith('}')) {
    return false;
  }
  const tokens = tokenizeExpression(expression).filter(
    (token) => token.kind !== 'space'
  );
  let depth = 0;
  for (const [index, token] of tokens.entries()) {
    if (token.kind !== 'punctuator') {
      if (
        depth === 1 &&
        token.kind === 'string' &&
        /^(['"])--/.test(token.text) &&
        tokens[index + 1]?.text === ':'
      ) {
        return true;
      }
      continue;
    }
    if (token.text === '{' || token.text === '(' || token.text === '[') {
      depth += 1;
    } else if (token.text === '}' || token.text === ')' || token.text === ']') {
      depth -= 1;
      if (depth === 0 && index < tokens.length - 1) {
        // The literal closed before the expression ended: not one literal.
        return false;
      }
    }
  }
  return false;
}

/**
 * Serializes a style object key: CSS custom properties stay verbatim as
 * quoted keys; everything else converts to the camelCase React style
 * property.
 */
function stylePropertyKey(property: string): string {
  if (property.startsWith('--')) {
    return quoteSingle(property);
  }
  return toCamelCaseProperty(property);
}

/**
 * An expression as the target of a member access (`<expression>.map`). A
 * member chain - identifiers, `.`, `?.`, calls and index brackets - is used
 * as written; anything else is parenthesized, since `.map` binds tighter than
 * every operator: `list.items ?? items` would otherwise map `items` alone.
 *
 * @param expression - The items expression, as authored.
 * @returns The expression, parenthesized unless it is a member chain.
 * @example
 * memberTarget('props.items'); // 'props.items'
 * memberTarget('list.items ?? items'); // '(list.items ?? items)'
 */
function memberTarget(expression: string): string {
  const trimmed = expression.trim();
  let depth = 0;
  let quote = '';
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (quote !== '') {
      if (char === '\\') {
        i += 1;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
    } else if (
      depth === 0 &&
      !/[\w$.]/.test(char) &&
      !(char === '?' && trimmed[i + 1] === '.')
    ) {
      return `(${trimmed})`;
    }
  }
  return trimmed;
}
