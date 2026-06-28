import {
  classExpressions,
  GENERATED_NODE_ATTRIBUTE,
  hasNestedSelectors,
  hasPlainProperties,
  isDynamicTag,
  isExpressionBinding,
  nodeSpreads,
  normalizeClassList,
  normalizeExposes,
  normalizeNamedSlots,
  serializeInlineStyle,
  slotConditionTarget,
  toKebabCaseProperty,
  wholeStyleExpression,
  type BemRuntimeCall,
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

import { eventAttribute } from './events';
import {
  escapeAttributeValue,
  escapeText,
  expression,
  quoteSingle,
} from './literals';
import type { SvelteNodeOverrides } from './overrides';

/** Everything the markup renderer needs besides the nodes themselves. */
export interface SvelteContext {
  plan: TargetPlan;
  /** True when the styling output strategy is `inline`. */
  stylingInline: boolean;
  /** The declared named-slot names, for slot-presence conditions. */
  namedSlots: ReadonlySet<string>;
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
  warnings: Warning[];
}

/** The name of the generated whole-object style serializer helper. */
export const STYLE_SERIALIZER_NAME = 'serializeStyleObject';

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

/**
 * The expression a branch condition emits. A bare identifier naming a declared
 * named slot becomes that slot's Svelte presence check (`$$slots.<name>`),
 * since the bare slot name is not an `export let` prop; every other condition
 * is emitted verbatim through {@link expression}.
 */
function conditionExpression(
  branch: ConditionalNode['conditions'][number],
  context: SvelteContext
): string {
  const slotName = slotConditionTarget(branch.condition, context.namedSlots);
  if (slotName !== undefined) {
    return `$$slots.${slotName}`;
  }
  return expression(String(branch.condition));
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

function renderSlot(
  node: SlotNode,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
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

function renderElement(
  node: ElementNode,
  path: string,
  indent: number,
  context: SvelteContext
): string[] {
  const padding = pad(indent);
  // A per-target `tag` override replaces the element wholesale (a capitalized
  // value renders as a component reference) and suppresses the dynamic-tag
  // path. Otherwise a dynamic tag renders as `<svelte:element this={...}>`; the
  // `this` binding leads the attributes, the expression emitted verbatim.
  const tagOverride = (node.extensions?.svelte as SvelteNodeOverrides | undefined)
    ?.tag;
  const dynamic =
    tagOverride === undefined && isDynamicTag(node.tag) ? node.tag : undefined;
  const tag = tagOverride ?? (dynamic ? 'svelte:element' : node.tag);
  const thisBinding = dynamic ? [`this={${dynamic.$expression}}`] : [];
  // A component-reference node with `slotScope` receives the composed
  // component's default scoped slot via `let:`, scoping its children.
  const letBindings =
    node.slotScope !== undefined && node.slotScope.length > 0
      ? node.slotScope.map((name) => `let:${name}`)
      : [];
  const parts = [
    ...thisBinding,
    ...letBindings,
    ...buildAttributeParts(node, path, context),
  ];
  const children = node.children ?? [];
  const joined = parts.length > 0 ? ` ${parts.join(' ')}` : '';
  // A component-reference node with `slots` projects content into the composed
  // component's named slots, each rendered as a `<svelte:fragment slot="name">`
  // child; a scoped named slot receives its scope through `let:` on the
  // fragment. The default children stay bare (Svelte distinguishes by the
  // `slot` attribute), and a default `slotScope` stays as the tag-level `let:`.
  const namedSlots = normalizeNamedSlots(node.slots);
  const slotFragments = namedSlots.flatMap((named) => {
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
  });
  const hasNamedSlots = slotFragments.length > 0;

  const multilineOpen = (closer: string): string[] => [
    `${padding}<${tag}`,
    ...parts.map((part) => `${padding}${INDENTATION}${part}`),
    `${padding}${closer}`,
  ];

  if (children.length === 0 && !hasNamedSlots) {
    const single = `${padding}<${tag}${joined} />`;
    return fits(single) ? [single] : multilineOpen('/>');
  }

  const open = `<${tag}${joined}>`;
  const close = `</${tag}>`;

  if (!hasNamedSlots && children.every((child) => child.type === 'text')) {
    const text = children.map((child) => textPiece(child as TextNode)).join('');
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
    ...renderNodes(children, `${path}.children`, indent + 1, context),
    ...slotFragments,
    `${padding}${close}`,
  ];
}

function buildAttributeParts(
  node: ElementNode,
  path: string,
  context: SvelteContext
): string[] {
  const override = node.extensions?.svelte as SvelteNodeOverrides | undefined;
  const attributes = { ...node.attributes, ...override?.attributes };
  const events = override?.events ?? node.events ?? [];
  const conditionals = node.conditionalAttributes ?? [];
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
          runtimeCall?.expression
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
      ...classParts([], classConditionals, consumerClasses, runtimeCall?.expression)
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

  for (const event of events) {
    parts.push(eventAttribute(event));
  }

  if (isPassthrough) {
    // Spread the consumer's undeclared attributes first so the authored
    // attributes above win per key; forward a consumer `style` not already
    // merged into an authored one; bind the DOM handle.
    parts.unshift('{...$$restProps}');
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
        const guarded = expression(classExpression);
        attributeValue +=
          attributeValue === '' && index === 0
            ? `{${guarded} || ''}`
            : `{${guarded} ? ' ' + ${guarded} : ''}`;
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
      const guarded = expression(classExpression);
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
