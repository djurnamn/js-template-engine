import {
  classExpressions,
  GENERATED_NODE_ATTRIBUTE,
  hasNestedSelectors,
  hasPlainProperties,
  isDynamicTag,
  isExpressionBinding,
  normalizeClassList,
  type TargetPlan,
} from '@js-template-engine/core';
import type {
  Attributes,
  AttributeValue,
  ConditionalAttributes,
  ConditionalNode,
  ElementNode,
  ExpressionBinding,
  IterationNode,
  NestedStyleObject,
  SlotNode,
  TemplateNode,
  TextNode,
  Warning,
} from '@js-template-engine/types';

import { eventProps } from './events';
import {
  escapeJsxAttributeValue,
  escapeJsxText,
  quoteSingle,
  toCamelCaseProperty,
} from './literals';
import type { ReactNodeOverrides } from './overrides';

/** Everything the JSX renderer needs besides the nodes themselves. */
export interface JsxContext {
  plan: TargetPlan;
  /** True when the styling output strategy is `inline`. */
  stylingInline: boolean;
  /** React prop name per slot name (`undefined` keys the default slot). */
  slotPropNames: Map<string | undefined, string>;
  /** Set when a keyed `<Fragment>` wrapper was emitted. */
  usesFragmentImport: boolean;
  /**
   * The component's passthrough surface root, if any. On this node the
   * consumer's `...rest` props spread first, `ref` forwards as a prop, and
   * the consumer `className`/`style` merge (the consumer class is appended
   * last in the class list; the consumer style is the outermost layer).
   */
  passthroughNode?: ElementNode;
  warnings: Warning[];
}

const INDENTATION = '  ';
const MAX_WIDTH = 80;

/**
 * HTML attribute names whose JSX prop is spelled differently. Attributes
 * not listed here (including `data-*` and `aria-*`) pass through unchanged.
 */
const REACT_ATTRIBUTE_NAMES: Record<string, string> = {
  accesskey: 'accessKey',
  allowfullscreen: 'allowFullScreen',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  colspan: 'colSpan',
  contenteditable: 'contentEditable',
  crossorigin: 'crossOrigin',
  datetime: 'dateTime',
  enctype: 'encType',
  for: 'htmlFor',
  formaction: 'formAction',
  hreflang: 'hrefLang',
  inputmode: 'inputMode',
  ismap: 'isMap',
  maxlength: 'maxLength',
  minlength: 'minLength',
  novalidate: 'noValidate',
  playsinline: 'playsInline',
  readonly: 'readOnly',
  referrerpolicy: 'referrerPolicy',
  rowspan: 'rowSpan',
  spellcheck: 'spellCheck',
  srcdoc: 'srcDoc',
  srclang: 'srcLang',
  srcset: 'srcSet',
  tabindex: 'tabIndex',
  usemap: 'useMap',
};

function pad(indent: number): string {
  return INDENTATION.repeat(indent);
}

function fits(line: string): boolean {
  return line.length <= MAX_WIDTH;
}

/** Renders template nodes as JSX child lines at the given indent level. */
export function renderJsxNodes(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: JsxContext
): string[] {
  const lines: string[] = [];
  nodes.forEach((node, index) => {
    lines.push(
      ...renderJsxNode(node, joinPath(path, `[${index}]`), indent, context)
    );
  });
  return lines;
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
    case 'fragment':
      return [
        `${padding}<>`,
        ...renderJsxNodes(node.children, `${path}.children`, indent + 1, context),
        `${padding}</>`,
      ];
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
    block: [
      `${pad(indent)}<>`,
      ...renderJsxNodes(nodes, path, indent + 1, context),
      `${pad(indent)}</>`,
    ],
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

  if (node.fallback === undefined || node.fallback.length === 0) {
    return [`${padding}{${reference}}`];
  }

  const body = renderExpressionBody(
    node.fallback,
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

function renderConditional(
  node: ConditionalNode,
  path: string,
  indent: number,
  context: JsxContext
): string[] {
  const padding = pad(indent);
  const branches = node.conditions.map((branch, index) => ({
    branch,
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
    const [{ branch, body }] = branches;
    return [
      `${padding}{${branch.condition} && (`,
      ...body.block,
      `${padding})}`,
    ];
  }

  const lines: string[] = [];
  branches.forEach(({ branch, body }, index) => {
    if (index === 0) {
      lines.push(`${padding}{${branch.condition} ? (`);
    } else if (branch.statement === 'else') {
      lines.push(`${padding}) : (`);
    } else {
      lines.push(`${padding}) : ${branch.condition} ? (`);
    }
    lines.push(...body.block);
  });
  const lastBranch = branches[branches.length - 1].branch;
  lines.push(lastBranch.statement === 'else' ? `${padding})}` : `${padding}) : null}`);
  return lines;
}

function inlineConditional(
  branches: Array<{
    branch: ConditionalNode['conditions'][number];
    body: { inline?: string };
  }>
): string {
  if (branches.length === 1) {
    return `${branches[0].branch.condition} && ${branches[0].body.inline}`;
  }
  const terms = branches.map(({ branch, body }) =>
    branch.statement === 'else'
      ? String(body.inline)
      : `${branch.condition} ? ${body.inline}`
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
  const head = `${padding}{${node.items}.map(${parameters} => `;

  if (node.key === undefined) {
    context.warnings.push({
      message:
        "Iteration has no 'key' expression; React list items render without keys",
      nodePath: path,
    });
  }

  let body: { inline?: string; block: string[] };
  const loneChild = node.children.length === 1 ? node.children[0] : undefined;

  if (loneChild !== undefined && loneChild.type === 'element') {
    const block = renderElement(
      loneChild,
      `${path}.children[0]`,
      indent + 1,
      context,
      node.key
    );
    body = {
      inline: block.length === 1 ? block[0].trimStart() : undefined,
      block,
    };
  } else if (node.key !== undefined) {
    context.usesFragmentImport = true;
    const allText = node.children.every((child) => child.type === 'text');
    const inline = allText
      ? `<Fragment key={${node.key}}>${node.children
          .map((child) => textPiece(child as TextNode))
          .join('')}</Fragment>`
      : undefined;
    body = {
      inline,
      block: [
        `${pad(indent + 1)}<Fragment key={${node.key}}>`,
        ...renderJsxNodes(
          node.children,
          `${path}.children`,
          indent + 2,
          context
        ),
        `${pad(indent + 1)}</Fragment>`,
      ],
    };
  } else {
    body = renderExpressionBody(
      node.children,
      `${path}.children`,
      indent + 1,
      context
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
  // A dynamic tag renders through the hoisted `const RootTag` local (the
  // capitalized binding is what makes JSX treat it as a dynamic tag).
  const tag = isDynamicTag(node.tag) ? 'RootTag' : node.tag;

  const multilineOpen = (closer: string): string[] => [
    `${padding}<${tag}`,
    ...parts.map((part) => `${padding}${INDENTATION}${part}`),
    `${padding}${closer}`,
  ];

  if (children.length === 0) {
    const single = `${padding}<${tag}${joined} />`;
    return fits(single) ? [single] : multilineOpen('/>');
  }

  const open = `<${tag}${joined}>`;
  const close = `</${tag}>`;

  if (children.every((child) => child.type === 'text')) {
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
    return [...openLines, `${padding}${INDENTATION}${text}`, `${padding}${close}`];
  }

  const openLines = fits(`${padding}${open}`)
    ? [`${padding}${open}`]
    : multilineOpen('>');
  return [
    ...openLines,
    ...renderJsxNodes(children, `${path}.children`, indent + 1, context),
    `${padding}${close}`,
  ];
}

function buildAttributeParts(
  node: ElementNode,
  path: string,
  context: JsxContext,
  keyExpression?: string
): string[] {
  const override = node.extensions?.react as ReactNodeOverrides | undefined;
  const attributes = { ...node.attributes, ...override?.attributes };
  const events = override?.events ?? node.events ?? [];
  const conditionals = node.conditionalAttributes ?? [];
  const isPassthrough = node === context.passthroughNode;
  // The consumer `className` (destructured from props) is appended last,
  // after the authored expression classes.
  const consumerClasses = isPassthrough ? ['className'] : [];

  const parts: string[] = [];
  if (keyExpression !== undefined) {
    parts.push(`key={${keyExpression}}`);
  }

  let classRendered = false;
  let styleRendered = false;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }
    if (name === 'class') {
      const classValue = value as Attributes['class'];
      const part = classNamePart(
        normalizeClassList(classValue),
        conditionals,
        [...classExpressions(classValue), ...consumerClasses]
      );
      if (part !== undefined) {
        parts.push(part);
      }
      classRendered = true;
    } else if (name === 'style') {
      const stylePart = styleProp(
        value as NestedStyleObject | ExpressionBinding,
        context.stylingInline,
        isPassthrough ? 'style' : undefined
      );
      if (stylePart !== undefined) {
        parts.push(stylePart);
      }
      styleRendered = true;
    } else if (isExpressionBinding(value)) {
      parts.push(`${attributeName(name)}={${value.$expression.trim()}}`);
    } else if (typeof value === 'boolean') {
      if (value) {
        parts.push(attributeName(name));
      }
    } else if (typeof value === 'number') {
      parts.push(`${attributeName(name)}={${value}}`);
    } else {
      parts.push(
        `${attributeName(name)}="${escapeJsxAttributeValue(String(value))}"`
      );
    }
  }

  if (!classRendered) {
    const part = classNamePart([], conditionals, consumerClasses);
    if (part !== undefined) {
      parts.push(part);
    }
  }

  for (const conditional of conditionals) {
    for (const [name, value] of Object.entries(conditional.attributes)) {
      if (name === 'class' || name === 'style' || value === undefined) {
        continue;
      }
      const expression = conditionalValueExpression(value as AttributeValue);
      parts.push(
        `${attributeName(name)}={${conditional.condition} ? ${expression} : undefined}`
      );
    }
  }

  const target = context.plan.get(node);
  if (target?.generatedNodeIndex !== undefined) {
    parts.push(`${GENERATED_NODE_ATTRIBUTE}="${target.generatedNodeIndex}"`);
  }

  for (const prop of eventProps(events, path, context.warnings)) {
    parts.push(`${prop.name}={${prop.expression}}`);
  }

  if (isPassthrough) {
    // Spread the consumer's undeclared props first so the authored
    // attributes above override them per key; merge a consumer `style` not
    // already merged into an authored one; forward the DOM handle.
    parts.unshift('{...rest}');
    if (!styleRendered) {
      parts.push('style={style}');
    }
    parts.push('ref={ref}');
  }

  return parts;
}

/**
 * Builds the `className` part from static, condition-gated, and expression
 * classes, applying the fixed concatenation order (static first, then
 * conditional in array order, then expression classes in authored order)
 * with first-occurrence deduplication of the literal sources. Expression
 * terms carry a generated falsy guard so a falsy runtime value contributes
 * nothing.
 */
function classNamePart(
  staticClasses: string[],
  conditionals: ConditionalAttributes[],
  expressionClasses: string[]
): string | undefined {
  const seen = new Set(staticClasses);
  const conditionalClasses = conditionals
    .map((conditional) => ({
      condition: conditional.condition,
      classes: normalizeClassList(conditional.attributes.class).filter(
        (className) => {
          if (seen.has(className)) {
            return false;
          }
          seen.add(className);
          return true;
        }
      ),
    }))
    .filter((entry) => entry.classes.length > 0);

  if (conditionalClasses.length === 0 && expressionClasses.length === 0) {
    return staticClasses.length > 0
      ? `className="${escapeJsxAttributeValue(staticClasses.join(' '))}"`
      : undefined;
  }

  if (
    staticClasses.length === 0 &&
    conditionalClasses.length === 1 &&
    expressionClasses.length === 0
  ) {
    const [entry] = conditionalClasses;
    return `className={${entry.condition} ? ${quoteSingle(entry.classes.join(' '))} : ''}`;
  }

  if (
    staticClasses.length === 0 &&
    conditionalClasses.length === 0 &&
    expressionClasses.length === 1
  ) {
    return `className={${expressionClasses[0]} || ''}`;
  }

  const terms: string[] = [];
  if (staticClasses.length > 0) {
    terms.push(quoteSingle(staticClasses.join(' ')));
  }
  for (const entry of conditionalClasses) {
    const prefix = terms.length > 0 ? ' ' : '';
    terms.push(
      `(${entry.condition} ? ${quoteSingle(prefix + entry.classes.join(' '))} : '')`
    );
  }
  for (const expression of expressionClasses) {
    terms.push(
      terms.length === 0
        ? `(${expression} || '')`
        : `(${expression} ? ' ' + ${expression} : '')`
    );
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
 * style object — they go through React's dynamic style mechanism regardless
 * of the styling strategy — while static plain properties join them only
 * under the `inline` strategy (and only when no nested selectors force the
 * style to a stylesheet). Returns `undefined` when there is nothing to
 * render.
 */
function styleProp(
  style: NestedStyleObject | ExpressionBinding,
  stylingInline: boolean,
  consumerStyle?: string
): string | undefined {
  if (isExpressionBinding(style)) {
    const expression = style.$expression.trim();
    return consumerStyle !== undefined
      ? `style={{ ...${expression}, ...${consumerStyle} }}`
      : `style={${expression}}`;
  }
  const includeStatic =
    stylingInline && !hasNestedSelectors(style) && hasPlainProperties(style);
  const entries: string[] = [];
  for (const [property, value] of Object.entries(style)) {
    if (isExpressionBinding(value)) {
      entries.push(`${stylePropertyKey(property)}: ${value.$expression.trim()}`);
    } else if (
      includeStatic &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      const serialized =
        typeof value === 'number' ? String(value) : quoteSingle(String(value));
      entries.push(`${stylePropertyKey(property)}: ${serialized}`);
    }
  }
  if (entries.length === 0) {
    // A passthrough node with no authored inline style still forwards the
    // consumer style; otherwise there is nothing to render.
    return consumerStyle !== undefined ? `style={${consumerStyle}}` : undefined;
  }
  // The consumer style merges last so its properties win on conflict.
  return consumerStyle !== undefined
    ? `style={{ ${entries.join(', ')}, ...${consumerStyle} }}`
    : `style={{ ${entries.join(', ')} }}`;
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

function attributeName(name: string): string {
  return REACT_ATTRIBUTE_NAMES[name] ?? name;
}
