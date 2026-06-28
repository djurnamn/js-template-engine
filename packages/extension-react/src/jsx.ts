import {
  classExpressions,
  GENERATED_NODE_ATTRIBUTE,
  hasNestedSelectors,
  hasPlainProperties,
  isDynamicTag,
  isExpressionBinding,
  nodeSpreads,
  normalizeClassList,
  normalizeNamedSlots,
  slotConditionTarget,
  wholeStyleExpression,
  type BemRuntimeCall,
  type NormalizedExposedBinding,
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

import { eventProps } from './events';
import {
  escapeJsxAttributeValue,
  escapeJsxText,
  quoteSingle,
  toCamelCaseProperty,
} from './literals';
import type { ReactNodeOverrides } from './overrides';
import { normalizeSlotName } from './props';

/** Everything the JSX renderer needs besides the nodes themselves. */
export interface JsxContext {
  plan: TargetPlan;
  /** True when the styling output strategy is `inline`. */
  stylingInline: boolean;
  /** React prop name per slot name (`undefined` keys the default slot). */
  slotPropNames: Map<string | undefined, string>;
  /**
   * Exposed bindings per scoped slot name (`undefined` keys the default slot).
   * A non-empty entry renders the slot prop as a render-prop call
   * (`{children?.(scope)}`) instead of a bare `{children}`.
   */
  slotExposes: Map<string | undefined, NormalizedExposedBinding[]>;
  /** The declared named-slot names, for slot-presence conditions. */
  namedSlots: ReadonlySet<string>;
  /** Set when a keyed `<Fragment>` wrapper was emitted. */
  usesFragmentImport: boolean;
  /**
   * Set when an inline `style` object literal carries a CSS custom property
   * (`--*`) key. `React.CSSProperties` has no `--*` index signature, so such
   * a component emits a `declare module 'react'` augmentation that admits
   * custom properties while keeping standard-property checking intact.
   */
  usesCssCustomProperty: boolean;
  /**
   * The component's passthrough surface root, if any. On this node the
   * consumer's `...rest` props spread first, `ref` forwards as a prop, and
   * the consumer `className`/`style` merge (the consumer class is appended
   * last in the class list; the consumer style is the outermost layer).
   */
  passthroughNode?: ElementNode;
  /**
   * Per-element BEM runtime calls, set when a styling extension is in runtime
   * mode. A node present here renders its BEM classes as the `bem(...)` call
   * instead of the literal classes.
   */
  bemRuntimeCalls?: ReadonlyMap<ElementNode, BemRuntimeCall>;
  warnings: Warning[];
}

const INDENTATION = '  ';
const MAX_WIDTH = 80;

/**
 * Attribute names whose JSX prop is spelled differently from the HTML/SVG DOM
 * form. Covers the HTML attributes React renames (`for` → `htmlFor`,
 * `tabindex` → `tabIndex`, ...) and the SVG presentation attributes, which are
 * authored in their kebab-case DOM form (`stroke-width`) but must be emitted
 * as React's camelCase props (`strokeWidth`) - kebab names in JSX render the
 * correct DOM but trigger React's `Invalid DOM property` dev warning. The
 * kebab SVG presentation names are globally unambiguous, so no SVG-namespace
 * context is needed to map them. Attributes not listed here (including
 * `data-*`, `aria-*`, and the case-sensitive SVG set such as `viewBox` and
 * `preserveAspectRatio`, which React already accepts verbatim) pass through
 * unchanged.
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

  // SVG presentation attributes - kebab DOM form → React camelCase prop.
  'alignment-baseline': 'alignmentBaseline',
  'baseline-shift': 'baselineShift',
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
  'color-interpolation': 'colorInterpolation',
  'color-interpolation-filters': 'colorInterpolationFilters',
  'color-rendering': 'colorRendering',
  'dominant-baseline': 'dominantBaseline',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'flood-color': 'floodColor',
  'flood-opacity': 'floodOpacity',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-size-adjust': 'fontSizeAdjust',
  'font-stretch': 'fontStretch',
  'font-style': 'fontStyle',
  'font-variant': 'fontVariant',
  'font-weight': 'fontWeight',
  'image-rendering': 'imageRendering',
  'letter-spacing': 'letterSpacing',
  'lighting-color': 'lightingColor',
  'marker-end': 'markerEnd',
  'marker-mid': 'markerMid',
  'marker-start': 'markerStart',
  'paint-order': 'paintOrder',
  'pointer-events': 'pointerEvents',
  'shape-rendering': 'shapeRendering',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity',
  'stroke-width': 'strokeWidth',
  'text-anchor': 'textAnchor',
  'text-decoration': 'textDecoration',
  'text-rendering': 'textRendering',
  'transform-origin': 'transformOrigin',
  'unicode-bidi': 'unicodeBidi',
  'vector-effect': 'vectorEffect',
  'word-spacing': 'wordSpacing',
  'writing-mode': 'writingMode',
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
  const exposes = context.slotExposes.get(node.name) ?? [];
  const hasFallback = node.fallback !== undefined && node.fallback.length > 0;

  // A scoped slot's prop is a render prop: call it with the exposed scope.
  if (exposes.length > 0) {
    const scope = scopeObjectLiteral(exposes);
    if (!hasFallback) {
      return [`${padding}{${reference}?.(${scope})}`];
    }
    const body = renderExpressionBody(
      node.fallback as TemplateNode[],
      `${path}.fallback`,
      indent + 1,
      context
    );
    const call = `${reference}(${scope})`;
    if (body.inline !== undefined) {
      const line = `${padding}{${reference} ? ${call} : ${body.inline}}`;
      if (fits(line)) {
        return [line];
      }
    }
    return [`${padding}{${reference} ? ${call} : (`, ...body.block, `${padding})}`];
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
  lines.push(lastBranch.statement === 'else' ? `${padding})}` : `${padding}) : null}`);
  return lines;
}

/**
 * The JavaScript a branch condition emits. A bare identifier naming a declared
 * named slot becomes that slot's React prop (`props.<propName>`) - its
 * presence check - since the bare slot name is not otherwise in scope; every
 * other condition is emitted verbatim.
 */
function conditionExpression(
  branch: ConditionalNode['conditions'][number],
  context: JsxContext
): string | undefined {
  const slotName = slotConditionTarget(branch.condition, context.namedSlots);
  if (slotName !== undefined) {
    return `props.${context.slotPropNames.get(slotName)}`;
  }
  return branch.condition;
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
    const body = renderExpressionBody(
      named.content,
      `${path}.slots.${named.name}.content`,
      indent + 1,
      context
    );
    const opener =
      named.slotScope.length > 0
        ? `({ ${named.slotScope.join(', ')} }) => `
        : '';
    if (body.inline !== undefined) {
      const single = `${padding}${propName}={${opener}${body.inline}}`;
      if (fits(single)) {
        lines.push(single);
        continue;
      }
    }
    if (opener !== '') {
      lines.push(`${padding}${propName}={${opener}(`, ...body.block, `${padding})}`);
    } else {
      lines.push(`${padding}${propName}={`, ...body.block, `${padding}}`);
    }
  }
  return lines;
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
  // A per-target `tag` override replaces the element wholesale (a capitalized
  // value renders as a component reference); otherwise a dynamic tag renders
  // through the hoisted `const RootTag` local (the capitalized binding is what
  // makes JSX treat it as a dynamic tag).
  const tagOverride = (node.extensions?.react as ReactNodeOverrides | undefined)
    ?.tag;
  const tag = tagOverride ?? (isDynamicTag(node.tag) ? 'RootTag' : node.tag);

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
    const body = renderExpressionBody(
      children,
      `${path}.children`,
      indent + 2,
      context
    );
    if (body.inline !== undefined) {
      const inlineFn = `${padding}${INDENTATION}{(${parameter}) => ${body.inline}}`;
      if (fits(inlineFn)) {
        return [...openLines, inlineFn, `${padding}${close}`];
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

  if (children.every((child) => child.type === 'text')) {
    const text = children
      .map((child) => textPiece(child as TextNode))
      .join('');
    if (!hasSlotProps) {
      const single = `${padding}${open}${text}${close}`;
      if (fits(single)) {
        return [single];
      }
    }
    return [...openTagLines(), `${padding}${INDENTATION}${text}`, `${padding}${close}`];
  }

  return [
    ...openTagLines(),
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

  // In BEM runtime mode this node renders its BEM classes as the `bem(...)`
  // call: the contributed literals are suppressed from the static class list
  // and the folded conditional classes from the conditional rendering.
  const runtimeCall = context.bemRuntimeCalls?.get(node);
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
  if (keyExpression !== undefined) {
    parts.push(`key={${keyExpression}}`);
  }
  // Object spreads lead the authored attributes (which override per key).
  parts.push(...nodeSpreads(attributes).map((expression) => `{...${expression}}`));

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
      const part = classNamePart(
        staticClasses,
        classConditionals,
        [...classExpressions(classValue), ...consumerClasses],
        runtimeCall?.expression
      );
      if (part !== undefined) {
        parts.push(part);
      }
      classRendered = true;
    } else if (name === 'style') {
      const stylePart = styleProp(
        value as NestedStyleObject,
        context.stylingInline,
        isPassthrough ? 'style' : undefined,
        context
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
    const part = classNamePart(
      [],
      classConditionals,
      consumerClasses,
      runtimeCall?.expression
    );
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
  expressionClasses: string[],
  runtimeCall?: string
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

  // The runtime call always yields a non-empty string (at least the block
  // class), so it carries no falsy guard. It sits after the static classes
  // and before the conditional/expression classes, matching literal mode's
  // author-static-then-BEM order.
  if (runtimeCall === undefined) {
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
  } else if (
    staticClasses.length === 0 &&
    conditionalClasses.length === 0 &&
    expressionClasses.length === 0
  ) {
    return `className={${runtimeCall}}`;
  }

  const terms: string[] = [];
  if (staticClasses.length > 0) {
    terms.push(quoteSingle(staticClasses.join(' ')));
  }
  if (runtimeCall !== undefined) {
    terms.push(terms.length === 0 ? runtimeCall : `' ' + ${runtimeCall}`);
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
 * style object - they go through React's dynamic style mechanism regardless
 * of the styling strategy - while static plain properties join them only
 * under the `inline` strategy (and only when no nested selectors force the
 * style to a stylesheet). Returns `undefined` when there is nothing to
 * render.
 */
function styleProp(
  style: NestedStyleObject,
  stylingInline: boolean,
  consumerStyle: string | undefined,
  context: JsxContext
): string | undefined {
  const wholeExpression = wholeStyleExpression(style);
  const includeStatic =
    stylingInline && !hasNestedSelectors(style) && hasPlainProperties(style);
  const entries: string[] = [];
  for (const [property, value] of Object.entries(style)) {
    if (property === '$expression') {
      continue;
    }
    if (isExpressionBinding(value)) {
      entries.push(`${stylePropertyKey(property)}: ${value.$expression.trim()}`);
      if (property.startsWith('--')) {
        context.usesCssCustomProperty = true;
      }
    } else if (
      includeStatic &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      const serialized =
        typeof value === 'number' ? String(value) : quoteSingle(String(value));
      entries.push(`${stylePropertyKey(property)}: ${serialized}`);
      if (property.startsWith('--')) {
        context.usesCssCustomProperty = true;
      }
    }
  }
  // Merge order (later wins): the whole-object expression is the base layer,
  // then authored static / per-property entries, then the consumer style.
  if (entries.length === 0) {
    // Only spreads remain. A lone whole-object or lone consumer passes through
    // bare; both together spread into one object.
    if (wholeExpression !== undefined && consumerStyle === undefined) {
      return `style={${wholeExpression.trim()}}`;
    }
    if (wholeExpression === undefined) {
      // A passthrough node with no authored inline style still forwards the
      // consumer style; otherwise there is nothing to render.
      return consumerStyle !== undefined ? `style={${consumerStyle}}` : undefined;
    }
    return `style={{ ...${wholeExpression.trim()}, ...${consumerStyle} }}`;
  }
  const objectParts: string[] = [];
  if (wholeExpression !== undefined) {
    objectParts.push(`...${wholeExpression.trim()}`);
  }
  objectParts.push(...entries);
  if (consumerStyle !== undefined) {
    objectParts.push(`...${consumerStyle}`);
  }
  return `style={{ ${objectParts.join(', ')} }}`;
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
