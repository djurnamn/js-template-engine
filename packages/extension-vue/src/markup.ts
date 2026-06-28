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
  bindingExpression,
  escapeAttributeValue,
  escapeText,
  quoteSingle,
} from './literals';
import type { VueNodeOverrides } from './overrides';

/** Everything the template renderer needs besides the nodes themselves. */
export interface VueContext {
  plan: TargetPlan;
  /** True when the styling output strategy is `inline`. */
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
   * Per-element BEM runtime calls, set when a styling extension is in runtime
   * mode. A node present here renders its BEM classes as the `bem(...)` call
   * instead of the literal classes.
   */
  bemRuntimeCalls?: ReadonlyMap<ElementNode, BemRuntimeCall>;
  warnings: Warning[];
}

const INDENTATION = '  ';
const MAX_WIDTH = 80;

function pad(indent: number): string {
  return INDENTATION.repeat(indent);
}

function fits(line: string): boolean {
  return line.length <= MAX_WIDTH;
}

/** Renders template nodes as Vue template lines at the given indent level. */
export function renderNodes(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: VueContext
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
  context: VueContext
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
  return `{{ ${String(node.expression).trim()} }}`;
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
        : `v-${branch.statement === 'if' ? 'if' : 'else-if'}="${bindingExpression(
            conditionExpression(branch, context)
          )}"`;
    const childPath = `${path}.conditions[${index}].children`;

    if (branch.children.length === 1 && branch.children[0].type === 'element') {
      const element = branch.children[0];
      const directives = context.surfaceElements?.has(element)
        ? [directive, 'v-bind="$attrs"']
        : [directive];
      lines.push(
        ...renderElement(element, `${childPath}[0]`, indent, context, directives)
      );
    } else {
      lines.push(`${padding}<template ${directive}>`);
      lines.push(...renderNodes(branch.children, childPath, indent + 1, context));
      lines.push(`${padding}</template>`);
    }
  });

  return lines;
}

/**
 * The expression a branch condition emits. A bare identifier naming a declared
 * named slot becomes that slot's Vue presence check (`$slots.<name>`), since
 * the bare slot name is not a declared prop; every other condition is emitted
 * verbatim.
 */
function conditionExpression(
  branch: ConditionalNode['conditions'][number],
  context: VueContext
): string {
  const slotName = slotConditionTarget(branch.condition, context.namedSlots);
  if (slotName !== undefined) {
    return `$slots.${slotName}`;
  }
  return String(branch.condition);
}

function renderIteration(
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
  const directives = [`v-for="${bindingExpression(iterator)}"`];

  if (node.key !== undefined) {
    directives.push(`:key="${bindingExpression(node.key)}"`);
  } else {
    context.warnings.push({
      message:
        "Iteration has no 'key' expression; Vue list items render without keys",
      nodePath: path,
    });
  }

  const childPath = `${path}.children`;
  if (node.children.length === 1 && node.children[0].type === 'element') {
    return renderElement(
      node.children[0],
      `${childPath}[0]`,
      indent,
      context,
      directives
    );
  }

  return [
    `${padding}<template ${directives.join(' ')}>`,
    ...renderNodes(node.children, childPath, indent + 1, context),
    `${padding}</template>`,
  ];
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
  // A scoped slot binds its exposed values on the `<slot>` element.
  for (const binding of normalizeExposes(node.exposes)) {
    slotAttributes.push(`:${binding.name}="${bindingExpression(binding.value)}"`);
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
  const isBinding = dynamic ? [`:is="${dynamic.$expression}"`] : [];
  const children = node.children ?? [];
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
  const parts = [
    ...directives,
    ...isBinding,
    ...slotScopeBinding,
    ...buildAttributeParts(node, path, context),
  ];
  const joined = parts.length > 0 ? ` ${parts.join(' ')}` : '';

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

  if (hasNamedSlots) {
    const slotTemplate = (
      binding: string,
      content: TemplateNode[],
      contentPath: string
    ): string[] => [
      `${pad(indent + 1)}<template ${binding}>`,
      ...renderNodes(content, contentPath, indent + 2, context),
      `${pad(indent + 1)}</template>`,
    ];
    const bodyLines: string[] = [];
    for (const named of namedSlots) {
      const binding =
        named.slotScope.length > 0
          ? `#${named.name}="{ ${named.slotScope.join(', ')} }"`
          : `#${named.name}`;
      bodyLines.push(
        ...slotTemplate(binding, named.content, `${path}.slots.${named.name}.content`)
      );
    }
    if (children.length > 0) {
      const binding =
        defaultSlotScope !== undefined ? `#default="${defaultSlotScope}"` : '#default';
      bodyLines.push(...slotTemplate(binding, children, `${path}.children`));
    }
    const openLines = fits(`${padding}${open}`)
      ? [`${padding}${open}`]
      : multilineOpen('>');
    return [...openLines, ...bodyLines, `${padding}${close}`];
  }

  if (children.every((child) => child.type === 'text')) {
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
    `${padding}${close}`,
  ];
}

function buildAttributeParts(
  node: ElementNode,
  path: string,
  context: VueContext
): string[] {
  const override = node.extensions?.vue as VueNodeOverrides | undefined;
  const attributes = { ...node.attributes, ...override?.attributes };
  const events = override?.events ?? node.events ?? [];
  const conditionals = node.conditionalAttributes ?? [];

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
    ...nodeSpreads(attributes).map(
      (expression) => `v-bind="${bindingExpression(expression)}"`
    )
  );
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
          runtimeCall?.expression
        )
      );
      classRendered = true;
    } else if (name === 'style') {
      parts.push(
        ...styleParts(
          value as NestedStyleObject,
          context.stylingInline
        )
      );
    } else if (isExpressionBinding(value)) {
      parts.push(`:${name}="${bindingExpression(value.$expression)}"`);
    } else if (typeof value === 'boolean') {
      if (value) {
        parts.push(name);
      }
    } else if (typeof value === 'number') {
      parts.push(`:${name}="${value}"`);
    } else {
      parts.push(`${name}="${escapeAttributeValue(String(value))}"`);
    }
  }

  if (!classRendered) {
    parts.push(
      ...classParts([], classConditionals, [], runtimeCall?.expression)
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
      parts.push(`:${name}="${bindingExpression(expression)}"`);
    }
  }

  const target = context.plan.get(node);
  if (target?.generatedNodeIndex !== undefined) {
    parts.push(`${GENERATED_NODE_ATTRIBUTE}="${target.generatedNodeIndex}"`);
  }

  for (const event of events) {
    parts.push(eventAttribute(event));
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
 * in array order, then expression classes) is applied with
 * first-occurrence deduplication of the literal sources.
 */
function classParts(
  staticClasses: string[],
  conditionals: ConditionalAttributes[],
  expressionClasses: string[],
  runtimeCall?: string
): string[] {
  const parts: string[] = [];
  if (staticClasses.length > 0) {
    parts.push(`class="${escapeAttributeValue(staticClasses.join(' '))}"`);
  }

  const seen = new Set(staticClasses);
  const entries: string[] = [];
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
    if (classes.length > 0) {
      entries.push(
        `${quoteSingle(classes.join(' '))}: ${bindingExpression(conditional.condition)}`
      );
    }
  }

  // The runtime call leads the `:class` binding (a non-empty string, no falsy
  // guard); a lone call binds directly, otherwise it joins the array form.
  if (runtimeCall === undefined) {
    if (expressionClasses.length > 0) {
      const bindingEntries: string[] = [];
      if (entries.length > 0) {
        bindingEntries.push(`{ ${entries.join(', ')} }`);
      }
      bindingEntries.push(...expressionClasses.map(bindingExpression));
      parts.push(`:class="[${bindingEntries.join(', ')}]"`);
    } else if (entries.length > 0) {
      parts.push(`:class="{ ${entries.join(', ')} }"`);
    }
    return parts;
  }

  const bindingEntries: string[] = [bindingExpression(runtimeCall)];
  if (entries.length > 0) {
    bindingEntries.push(`{ ${entries.join(', ')} }`);
  }
  bindingEntries.push(...expressionClasses.map(bindingExpression));
  if (bindingEntries.length === 1) {
    parts.push(`:class="${bindingEntries[0]}"`);
  } else {
    parts.push(`:class="[${bindingEntries.join(', ')}]"`);
  }
  return parts;
}

/**
 * Builds the style attribute parts. A whole-object expression renders as a
 * `:style` binding. Otherwise expression-valued properties always render in
 * a `:style` object - they go through Vue's dynamic style mechanism
 * regardless of the styling strategy - while static plain properties render
 * as a static `style="..."` attribute only under the `inline` strategy (and
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
        `${stylePropertyKey(property)}: ${bindingExpression(value.$expression)}`
      );
    }
  }
  // The `:style` binding layers the whole-object expression (base) under the
  // per-property expressions (override) as an array - Vue merges array entries
  // with later winning.
  if (wholeExpression !== undefined && entries.length > 0) {
    parts.push(
      `:style="[${bindingExpression(wholeExpression)}, { ${entries.join(', ')} }]"`
    );
  } else if (wholeExpression !== undefined) {
    parts.push(`:style="${bindingExpression(wholeExpression)}"`);
  } else if (entries.length > 0) {
    parts.push(`:style="{ ${entries.join(', ')} }"`);
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
