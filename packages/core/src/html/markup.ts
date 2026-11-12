import type {
  Attributes,
  AttributeValue,
  ElementNode,
  EventDefinition,
  ExposedBinding,
  NestedStyleObject,
  SlotNode,
  TemplateNode,
  TextNode,
  Warning,
} from '@js-template-engine/types';

import { isBooleanAttribute, isPropertyOnlyName } from '../boolean-attributes';
import { quoteClassAttributeValue } from '../class-list';
import { isDynamicTag, staticTagOf } from '../dynamic-tag';
import {
  isExpressionBinding,
  nodeSpreads,
  wholeStyleExpression,
} from '../expression-binding';
import {
  flattenTemplateLiterals,
  readExpressionIdentifiers,
  tokenizeExpression,
} from '../expression-scope';
import { classExpressions, normalizeClassList } from '../normalize';
import {
  isPassthroughRouting,
  isRoutedAttribute,
  isTokenListAttribute,
  joinList,
  mergesTokenList,
  routedAttributesDescription,
  routingRootDescription,
  type RoutedElement,
} from '../passthrough-routing';
import { escapeAttributeValue, escapeText } from './escape';
import { printNodes, type OutputNode } from './serialize';
import { toKebabCaseProperty } from './styles';
import {
  GENERATED_NODE_ATTRIBUTE,
  hasNestedSelectors,
  type TargetPlan,
} from './targeting';

/** Everything the markup renderer needs besides the nodes themselves. */
export interface MarkupContext {
  plan: TargetPlan;
  /** True when the stylesheet placement is `inline`. */
  stylingInline: boolean;
  warnings: Warning[];
  /**
   * The `defaultValue` of the `select` being rendered, which marks the
   * option it matches as `selected`.
   */
  selectDefault?: AttributeValue;
  /** True when that `select` may take several values. */
  selectMultiple?: boolean;
  /**
   * The component's routed element, which takes some of the consumer's
   * attributes instead of its passthrough root.
   */
  routed?: RoutedElement;
  /**
   * The component's declared prop names, which never reach the consumer's
   * attributes, so an id list of that name joins nothing.
   */
  declaredNames?: ReadonlySet<string>;
  /**
   * The value each declared id takes at rest, by name. An expression that
   * reads only these renders its value instead of a placeholder.
   */
  ids?: ReadonlyMap<string, string>;
}

/**
 * The text an expression renders as: its value where it reads declared ids
 * and nothing else (`listId`, `` `${listId}-label` ``), which the markup
 * knows at rest, else a `{{ expression }}` placeholder.
 *
 * The value comes from running the expression as JavaScript with the ids
 * bound, so the html target too treats a template as code to run, not data
 * to read: an expression reading only ids can call anything reachable from
 * them. Templates are trusted input.
 *
 * @param expression - The expression, as written.
 * @param ids - The value of each declared id, by name.
 * @returns The value, unescaped, or the placeholder.
 */
export function placeholderOf(
  expression: string,
  ids: ReadonlyMap<string, string> | undefined
): string {
  const trimmed = expression.trim();
  const placeholder = `{{ ${trimmed} }}`;
  if (ids === undefined || ids.size === 0) {
    return placeholder;
  }
  const tokens = flattenTemplateLiterals(tokenizeExpression(trimmed));
  const free = new Set<string>();
  for (const [index, reading] of readExpressionIdentifiers(tokens)) {
    if (reading.free) {
      free.add(tokens[index].text);
    }
  }
  if (free.size === 0 || [...free].some((name) => !ids.has(name))) {
    return placeholder;
  }
  try {
    const names = [...free];
    const value: unknown = new Function(
      ...names,
      `"use strict";\nreturn (${trimmed}\n);`
    )(...names.map((name) => ids.get(name)));
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : placeholder;
  } catch {
    return placeholder;
  }
}

/**
 * Renders template nodes as an annotated HTML reference.
 *
 * Expressions become `{{ expression }}` placeholders, and every concept
 * plain HTML cannot express is written as a comment where it sits:
 * conditionals render every branch between `<!-- if -->` comments,
 * iterations render their children once between `<!-- for -->` comments,
 * slots render their fallback between `<!-- slot -->` comments, component
 * references wrap their projected content in `<!-- component -->`
 * comments, and an element's conditional attributes, events, spreads,
 * passthrough role, dynamic tag and the DOM properties it sets that have no
 * attribute are each written as a comment before it.
 */
export function renderMarkup(
  nodes: TemplateNode[],
  context: MarkupContext
): string {
  return printNodes(renderNodes(nodes, context));
}

function renderNodes(
  nodes: TemplateNode[],
  context: MarkupContext
): OutputNode[] {
  return nodes.flatMap((node) => renderNode(node, context));
}

function comment(text: string): OutputNode {
  return { kind: 'comment', text };
}

function renderNode(node: TemplateNode, context: MarkupContext): OutputNode[] {
  switch (node.type) {
    case 'element':
      return renderElement(node, context);
    case 'text':
      return [{ kind: 'text', text: textContent(node, context) }];
    case 'comment':
      return [comment(node.content)];
    case 'fragment':
      return renderNodes(node.children, context);
    case 'slot':
      return renderSlot(node, context);
    case 'conditional': {
      const output: OutputNode[] = [];
      for (const branch of node.conditions) {
        if (branch.statement === 'if') {
          output.push(comment(`if: ${branch.condition}`));
        } else if (branch.statement === 'else-if') {
          output.push(comment(`else if: ${branch.condition}`));
        } else {
          output.push(comment('else'));
        }
        output.push(...renderNodes(branch.children, context));
      }
      output.push(comment('/if'));
      return output;
    }
    case 'iteration': {
      const variables =
        node.index === undefined ? node.item : `${node.item}, ${node.index}`;
      const key = node.key === undefined ? '' : ` (key: ${node.key})`;
      return [
        comment(`for: ${variables} in ${node.items}${key}`),
        ...renderNodes(node.children, context),
        comment('/for'),
      ];
    }
    default:
      return [];
  }
}

/**
 * A slot: its fallback between `<!-- slot -->` and `<!-- /slot -->`, or the
 * opening comment alone when it has none. The comment names the slot and the
 * values it exposes to projected content.
 */
function renderSlot(node: SlotNode, context: MarkupContext): OutputNode[] {
  const opening = comment(slotLabel(node));
  if ((node.fallback?.length ?? 0) === 0) {
    return [opening];
  }
  return [
    opening,
    ...renderNodes(node.fallback ?? [], context),
    comment('/slot'),
  ];
}

/** `slot`, `slot: name`, and the exposed values: `slot (exposes api = api)`. */
export function slotLabel(node: SlotNode): string {
  const name = node.name === undefined ? '' : `: ${node.name}`;
  const exposes =
    node.exposes === undefined
      ? ''
      : ` (exposes ${Object.entries(node.exposes)
          .map(([binding, value]) => `${binding} = ${exposedValue(value)}`)
          .join(', ')})`;
  return `slot${name}${exposes}`;
}

function exposedValue(value: ExposedBinding): string {
  return typeof value === 'string' ? value : value.value;
}

/**
 * True when an element references a composed component rather than an HTML
 * element: a literal tag that does not start with a lower-case letter.
 */
export function isComponentReference(node: ElementNode): boolean {
  return !isDynamicTag(node.tag) && !/^[a-z]/.test(node.tag);
}

/**
 * The comments written before an element for what its markup cannot carry:
 * a dynamic tag, the passthrough role, spreads, conditional attributes and
 * events, in that order.
 */
function elementAnnotations(
  node: ElementNode,
  context: MarkupContext,
  defaultHints: readonly string[] = []
): OutputNode[] {
  const output: OutputNode[] = [];
  if (isDynamicTag(node.tag)) {
    output.push(
      comment(
        `tag: ${node.tag.$expression.trim()} (default: ${node.tag.default})`
      )
    );
  }
  if (node.passthrough === true) {
    // An id list the root sets itself keeps its ids and gains the
    // consumer's, unless the routed element takes the consumer's.
    const routedEntries = context.routed?.entries;
    const joined = authoredNames(node).filter(
      (name) =>
        isTokenListAttribute(name) &&
        !(context.declaredNames?.has(name) ?? false) &&
        (routedEntries === undefined || !isRoutedAttribute(routedEntries, name))
    );
    output.push(
      comment(
        `${
          context.routed === undefined
            ? PASSTHROUGH_COMMENT
            : `passthrough: ${routingRootDescription(context.routed)}`
        }${joinedDescription(joined)}`
      )
    );
  } else if (isPassthroughRouting(node.passthrough)) {
    const entries = node.passthrough.attributes;
    // An id list the element sets itself keeps its ids and gains the
    // consumer's.
    const joined = authoredNames(node).filter(
      (name) =>
        mergesTokenList(entries, name) &&
        !(context.declaredNames?.has(name) ?? false)
    );
    output.push(
      comment(
        `passthrough: ${routedAttributesDescription(entries)} apply here${joinedDescription(joined)}`
      )
    );
  }
  for (const spread of nodeSpreads(node.attributes)) {
    output.push(comment(`spread: ${spread}`));
  }
  for (const entry of node.conditionalAttributes ?? []) {
    const condition = entry.condition.trim();
    const booleans = boundBooleans(
      reflectedAttributes(node, entry.attributes),
      staticTagOf(node.tag),
      condition
    );
    const attributes = attributeParts(
      booleans.attributes,
      true,
      context.ids
    ).join(' ');
    if (attributes !== '' || booleans.hints.length === 0) {
      output.push(comment(`if ${condition}: ${attributes}`));
    }
    output.push(...booleans.hints.map(comment));
  }
  for (const hint of defaultHints) {
    output.push(comment(hint));
  }
  for (const event of node.events ?? []) {
    output.push(comment(eventAnnotation(event)));
  }
  return output;
}

/** The attribute names an element sets, plainly or under a condition,
 *  leaving out a name authored as `undefined`. */
function authoredNames(node: ElementNode): string[] {
  return [
    ...new Set(
      [
        ...Object.entries(node.attributes ?? {}),
        ...(node.conditionalAttributes ?? []).flatMap((entry) =>
          Object.entries(entry.attributes)
        ),
      ]
        .filter(([, value]) => value !== undefined)
        .map(([name]) => name)
    ),
  ];
}

/** The passthrough comment's note on the id lists an element joins. */
function joinedDescription(joined: readonly string[]): string {
  return joined.length === 0
    ? ''
    : `, the consumer's ${joinList(joined)} added after the element's own`;
}

const PASSTHROUGH_COMMENT =
  "passthrough: the consumer's other attributes, class and style apply here";

function eventAnnotation(event: EventDefinition): string {
  const modifiers =
    (event.modifiers?.length ?? 0) > 0
      ? ` (${(event.modifiers ?? []).join(', ')})`
      : '';
  return `on ${event.name}${modifiers}: ${event.handler.trim()}`;
}

/**
 * A component reference: a `<!-- component -->` comment naming it and its
 * props, wrapping the content projected into its default slot and each
 * named slot (`<!-- slot: name -->`). With nothing projected the opening
 * comment stands alone.
 */
function renderComponentReference(
  node: ElementNode,
  context: MarkupContext
): OutputNode[] {
  const tag = staticTagOf(node.tag);
  const props = attributeParts(node.attributes ?? {}, true, context.ids);
  const scope =
    node.slotScope === undefined
      ? ''
      : ` (scope: ${node.slotScope.join(', ')})`;
  const content = renderNodes(node.children ?? [], context);
  for (const [name, projected] of Object.entries(node.slots ?? {})) {
    const nodes = Array.isArray(projected) ? projected : projected.content;
    const slotScope = Array.isArray(projected)
      ? undefined
      : projected.slotScope;
    const named =
      slotScope === undefined ? '' : ` (scope: ${slotScope.join(', ')})`;
    content.push({
      kind: 'block',
      open: `slot: ${name}${named}`,
      close: '/slot',
      children: renderNodes(nodes, context),
    });
  }
  return [
    ...elementAnnotations(node, context),
    {
      kind: 'block',
      open: `component: ${[tag, ...props].join(' ')}${scope}`,
      close: content.length === 0 ? undefined : '/component',
      children: content,
    },
  ];
}

function textContent(node: TextNode, context: MarkupContext): string {
  if (node.content !== undefined) {
    return escapeText(node.content);
  }
  const text = placeholderOf(String(node.expression), context.ids);
  return text.startsWith('{{ ') ? text : escapeText(text);
}

function renderElement(
  node: ElementNode,
  context: MarkupContext
): OutputNode[] {
  if (isComponentReference(node)) {
    return renderComponentReference(node, context);
  }
  // A dynamic tag renders its `default`; the comment before it names the
  // expression.
  const defaults = formDefaults(node, context);
  const booleans = boundBooleans(defaults.attributes, staticTagOf(node.tag));
  const children =
    defaults.text !== undefined && (node.children ?? []).length === 0
      ? [defaults.text]
      : renderNodes(node.children ?? [], defaults.childContext);
  return [
    ...elementAnnotations(node, context, [
      ...defaults.hints,
      ...booleans.hints,
    ]),
    {
      kind: 'element',
      tag: staticTagOf(node.tag),
      attributes: renderAttributes(node, booleans.attributes, context),
      children,
    },
  ];
}

/**
 * Takes each boolean attribute bound to an expression out of a set of
 * attributes and writes it as an `if` comment, since a boolean attribute is
 * on whatever its value: `checked="{{ isChecked }}"` would check the input
 * when `isChecked` is false, so markup writes `<!-- if isChecked: checked -->`
 * and leaves the attribute out. Inside a conditional attribute entry the
 * comment's condition is the entry's and the binding's together
 * (`<!-- if open && isChecked: checked -->`).
 *
 * A DOM property with no attribute, such as an input's `indeterminate`, is
 * taken out too and written as a `property` comment naming its value
 * (`<!-- property indeterminate: isMixed -->`), since markup cannot set it;
 * a static `false` leaves nothing to write.
 *
 * @param attributes - The attributes, as markup would write them.
 * @param tag - The element's tag, which decides the attributes that are
 *   boolean on it and the properties that have no attribute.
 * @param condition - The condition of the conditional attribute entry they
 *   belong to, if any.
 * @returns The other attributes, and one comment text per bound boolean and
 *   property.
 */
function boundBooleans(
  attributes: Attributes,
  tag: string,
  condition?: string
): { attributes: Attributes; hints: string[] } {
  const remaining: Attributes = {};
  const hints: string[] = [];
  for (const [name, value] of Object.entries(attributes)) {
    if (name !== '$spread' && isPropertyOnlyName(name, tag)) {
      if (value !== undefined && value !== null && value !== false) {
        hints.push(`property ${name}: ${propertyValue(value, condition)}`);
      }
      continue;
    }
    if (
      name === '$spread' ||
      !isBooleanAttribute(name, tag) ||
      !isExpressionBinding(value)
    ) {
      remaining[name] = value;
      continue;
    }
    const expression = value.$expression.trim();
    hints.push(
      condition === undefined
        ? `if ${expression}: ${name}`
        : `if ${conjunctionOperand(condition)} && ${conjunctionOperand(expression)}: ${name}`
    );
  }
  return { attributes: remaining, hints };
}

/**
 * A property's value as a `property` comment names it: its expression, or
 * its static value as a literal; inside a conditional attribute entry, the
 * entry's condition and the value together (`open && isMixed`, or `open`
 * for a static `true`).
 */
function propertyValue(value: unknown, condition?: string): string {
  if (condition === undefined) {
    return isExpressionBinding(value)
      ? value.$expression.trim()
      : expressionOf(value as AttributeValue);
  }
  return value === true
    ? condition
    : `${conjunctionOperand(condition)} && ${expressionOf(value as AttributeValue)}`;
}

/**
 * An expression as an operand of `&&`: as it is when it is a member path or
 * a negated one, parenthesized otherwise.
 */
function conjunctionOperand(expression: string): string {
  return /^!*[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(expression)
    ? expression
    : `(${expression})`;
}

/** A form control's default-value properties, written as markup writes them. */
interface FormDefaults {
  /** The element's attributes with each default-value property replaced. */
  attributes: Attributes;
  /** `if` comments for the boolean defaults bound to an expression. */
  hints: string[];
  /** A textarea's default value, as its text. */
  text?: OutputNode;
  /** The context the element's children render in. */
  childContext: MarkupContext;
}

/**
 * The default-value DOM properties, by element, and the attribute each is
 * named as in a conditional attribute entry's comment: markup has no
 * `defaultChecked`, its `checked` attribute is the default.
 */
const REFLECTED_ATTRIBUTES: Record<string, Record<string, string>> = {
  input: { defaultChecked: 'checked', defaultValue: 'value' },
  option: { defaultSelected: 'selected' },
  select: { defaultValue: 'value' },
  textarea: { defaultValue: 'value' },
};

/** The literal tag of an HTML element, or undefined for any other tag. */
function intrinsicTag(node: ElementNode): string | undefined {
  return typeof node.tag === 'string' && /^[a-z]/.test(node.tag)
    ? node.tag
    : undefined;
}

/** Attributes with each default-value property named as its attribute. */
function reflectedAttributes(
  node: ElementNode,
  attributes: Attributes
): Attributes {
  const reflected = REFLECTED_ATTRIBUTES[intrinsicTag(node) ?? ''];
  if (reflected === undefined) {
    return attributes;
  }
  return Object.fromEntries(
    Object.entries(attributes).map(([name, value]) => [
      reflected[name] ?? name,
      value,
    ])
  ) as Attributes;
}

/**
 * Writes a form control's default-value properties as markup writes them.
 * A control's value is its `value`, its `defaultValue`, or
 * `value ?? defaultValue` when both are given and `value` is bound: an
 * input's is its `value` attribute, a textarea's its text, and a select's
 * marks the option with that value `selected`; a textarea and a select keep
 * no `value` attribute. A boolean default - an input's
 * `defaultChecked`, an option's `defaultSelected` - is the bare attribute
 * when `true` and absent when `false`; bound to an expression, it is an
 * `if` comment before the element (`<!-- if defaultChecked: checked -->`),
 * since `checked="{{ defaultChecked }}"` would check the input whatever the
 * value.
 */
function formDefaults(node: ElementNode, context: MarkupContext): FormDefaults {
  const tag = intrinsicTag(node);
  const authored = node.attributes ?? {};
  const childContext =
    tag === 'select' ? { ...context, selectDefault: undefined } : context;
  const result: FormDefaults = {
    attributes: authored,
    hints: [],
    childContext,
  };
  if (tag === 'select' || tag === 'textarea') {
    const value = controlValue(
      authored.value as AttributeValue | undefined,
      authored.defaultValue as AttributeValue | undefined
    );
    if (value === undefined) {
      return result;
    }
    result.attributes = Object.fromEntries(
      Object.entries(authored).filter(
        ([name]) => name !== 'value' && name !== 'defaultValue'
      )
    ) as Attributes;
    if (tag === 'select') {
      const multiple = authored.multiple as AttributeValue | undefined;
      result.childContext = {
        ...context,
        selectDefault: value,
        selectMultiple: multiple !== undefined && multiple !== false,
      };
    } else {
      result.text = {
        kind: 'text',
        text: isExpressionBinding(value)
          ? `{{ ${value.$expression.trim()} }}`
          : escapeText(String(value)),
      };
    }
    return result;
  }
  if (tag !== 'input' && tag !== 'option') {
    return result;
  }
  const attributes: Attributes = {};
  // A boolean attribute bound beside its bound default reads the attribute,
  // else the default, in one comment written for the default.
  const paired = new Set(
    Object.entries(REFLECTED_ATTRIBUTES[tag])
      .filter(
        ([property, attribute]) =>
          isBooleanAttribute(attribute, tag) &&
          isExpressionBinding(authored[property]) &&
          isExpressionBinding(authored[attribute])
      )
      .map(([, attribute]) => attribute)
  );
  for (const [name, value] of Object.entries(authored)) {
    const reflected = REFLECTED_ATTRIBUTES[tag][name];
    if (paired.has(name)) {
      continue;
    }
    if (reflected !== undefined && isBooleanAttribute(reflected, tag)) {
      booleanDefault(
        reflected,
        value as AttributeValue,
        authored,
        attributes,
        result
      );
    } else if (name === 'defaultValue' && tag === 'input') {
      attributes.value = controlValue(
        authored.value as AttributeValue | undefined,
        value as AttributeValue
      );
    } else if (!(name === 'value' && 'value' in attributes)) {
      attributes[name] = value;
    }
  }
  if (tag === 'option' && context.selectDefault !== undefined) {
    selectedOption(
      node,
      attributes,
      context.selectDefault,
      context.selectMultiple === true,
      result
    );
  }
  result.attributes = attributes;
  return result;
}

/**
 * A control's value from its `value` and `defaultValue`: either alone, the
 * `value` when static, and `value ?? defaultValue` when it is bound.
 */
function controlValue(
  value: AttributeValue | undefined,
  defaultValue: AttributeValue | undefined
): AttributeValue | undefined {
  if (value === undefined || defaultValue === undefined) {
    return value ?? defaultValue;
  }
  if (!isExpressionBinding(value)) {
    return value;
  }
  return {
    $expression: `${expressionOf(value)} ?? ${expressionOf(defaultValue)}`,
  };
}

/**
 * A boolean default written as its attribute, or as an `if` comment; bound
 * beside its bound attribute, the comment reads the attribute, else the
 * default (`<!-- if checked ?? defaultChecked: checked -->`).
 */
function booleanDefault(
  attribute: string,
  value: AttributeValue,
  authored: Attributes,
  attributes: Attributes,
  result: FormDefaults
): void {
  const controlled = authored[attribute];
  if (isExpressionBinding(value) && isExpressionBinding(controlled)) {
    result.hints.push(
      `if ${expressionOf(controlled)} ?? ${expressionOf(value)}: ${attribute}`
    );
  } else if (isExpressionBinding(value)) {
    result.hints.push(`if ${value.$expression.trim()}: ${attribute}`);
  } else if (value === true && authored[attribute] === undefined) {
    attributes[attribute] = true;
  }
}

/**
 * Marks an option inside a select with a `defaultValue`: `selected` when
 * both values are static and equal, an `if` comment comparing them when
 * either is an expression, which looks the option up under `multiple`.
 */
function selectedOption(
  node: ElementNode,
  attributes: Attributes,
  selectDefault: AttributeValue,
  multiple: boolean,
  result: FormDefaults
): void {
  if (attributes.selected !== undefined) {
    return;
  }
  const optionValue = optionValueOf(node);
  if (optionValue === undefined) {
    return;
  }
  if (
    !isExpressionBinding(optionValue) &&
    !isExpressionBinding(selectDefault)
  ) {
    if (String(optionValue) === String(selectDefault)) {
      attributes.selected = true;
    }
    return;
  }
  result.hints.push(
    multiple
      ? `if [${expressionOf(selectDefault)}].flat().includes(${expressionOf(optionValue)}): selected`
      : `if ${expressionOf(optionValue)} === ${expressionOf(selectDefault)}: selected`
  );
}

/** An option's value: its `value` attribute, or else its text. */
function optionValueOf(node: ElementNode): AttributeValue | undefined {
  const value = node.attributes?.value as AttributeValue | undefined;
  if (value !== undefined) {
    return value;
  }
  const children = node.children ?? [];
  if (children.length === 1 && children[0].type === 'text') {
    const text = children[0];
    return text.content !== undefined
      ? text.content.trim()
      : { $expression: String(text.expression).trim() };
  }
  if (
    children.every(
      (child) => child.type === 'text' && child.content !== undefined
    )
  ) {
    return children
      .map((child) => (child as TextNode).content)
      .join('')
      .trim();
  }
  return undefined;
}

/**
 * A value as an operand: a binding's expression, parenthesized unless a
 * member path, and a static value as a literal.
 */
function expressionOf(value: AttributeValue): string {
  if (isExpressionBinding(value)) {
    const expression = value.$expression.trim();
    return /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(expression)
      ? expression
      : `(${expression})`;
  }
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return String(value);
}

function renderAttributes(
  node: ElementNode,
  attributes: Attributes,
  context: MarkupContext
): string[] {
  const parts = attributeParts(attributes, context.stylingInline, context.ids);
  const target = context.plan.get(node);
  if (target?.generatedNodeValue !== undefined) {
    parts.push(`${GENERATED_NODE_ATTRIBUTE}="${target.generatedNodeValue}"`);
  }
  return parts;
}

/**
 * The `name="value"` parts for a set of attributes. `$spread` is left to
 * the element's annotations; static style properties are included only when
 * `stylingInline` is set. An expression reading only declared ids renders
 * their value.
 */
function attributeParts(
  attributes: Attributes,
  stylingInline: boolean,
  ids?: ReadonlyMap<string, string>
): string[] {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || name === '$spread') {
      continue;
    }
    if (name === 'class') {
      const classValue = value as Attributes['class'];
      const tokens = [
        ...normalizeClassList(classValue),
        ...classExpressions(classValue).map((expression) =>
          placeholderOf(expression, ids)
        ),
      ];
      if (tokens.length > 0) {
        parts.push(`class=${quoteClassAttributeValue(tokens.join(' '))}`);
      }
    } else if (name === 'style') {
      const style = value as NestedStyleObject;
      const preview = styleAttributePreview(style, stylingInline);
      if (preview !== '') {
        parts.push(`style="${escapeAttributeValue(preview)}"`);
      }
    } else if (isExpressionBinding(value)) {
      const placeholder = placeholderOf(value.$expression, ids);
      parts.push(`${name}="${escapeAttributeValue(placeholder)}"`);
    } else if (typeof value === 'boolean') {
      if (value) {
        parts.push(name);
      }
    } else {
      parts.push(`${name}="${escapeAttributeValue(String(value))}"`);
    }
  }
  return parts;
}

/**
 * Builds the static `style` attribute preview. Expression values - whole
 * style objects and individual property values - render as
 * `{{ expression }}` placeholders regardless of the stylesheet placement; static
 * plain properties render only under the `inline` placement and only when the
 * style has no nested selectors (which force the whole style to a
 * stylesheet). Returns an empty string when there is nothing to render.
 */
function styleAttributePreview(
  style: NestedStyleObject,
  stylingInline: boolean
): string {
  const includeStatic = stylingInline && !hasNestedSelectors(style);
  const declarations: string[] = [];
  // The whole-object expression renders first (the base layer), then
  // per-property expressions and static properties in authored order.
  const wholeExpression = wholeStyleExpression(style);
  if (wholeExpression !== undefined) {
    declarations.push(`{{ ${wholeExpression.trim()} }}`);
  }
  for (const [key, value] of Object.entries(style)) {
    if (key === '$expression') {
      continue;
    }
    if (isExpressionBinding(value)) {
      declarations.push(
        `${toKebabCaseProperty(key)}: {{ ${value.$expression.trim()} }}`
      );
    } else if (
      includeStatic &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      declarations.push(`${toKebabCaseProperty(key)}: ${value}`);
    }
  }
  return declarations.join('; ');
}
