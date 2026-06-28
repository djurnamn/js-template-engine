import type {
  Attributes,
  ElementNode,
  NestedStyleObject,
  TemplateNode,
  TextNode,
  Warning,
} from '@js-template-engine/types';

import { staticTagOf } from '../dynamic-tag';
import { isExpressionBinding, wholeStyleExpression } from '../expression-binding';
import { classExpressions, normalizeClassList } from '../normalize';
import { VOID_ELEMENTS } from '../void-elements';
import { escapeAttributeValue, escapeText } from './escape';
import { inlineHandlerAttribute } from './scripts';
import { toKebabCaseProperty } from './styles';
import {
  GENERATED_NODE_ATTRIBUTE,
  hasNestedSelectors,
  type TargetPlan,
} from './targeting';

/** Everything the markup renderer needs besides the nodes themselves. */
export interface MarkupContext {
  plan: TargetPlan;
  /** True when the styling output strategy is `inline`. */
  stylingInline: boolean;
  /** True when the scripting output strategy is `inline`. */
  scriptingInline: boolean;
  warnings: Warning[];
}

const INDENTATION = '  ';

/**
 * Renders template nodes as static HTML markup.
 *
 * Dynamic concepts render as static previews: expressions become
 * `{{ expression }}` placeholders, conditionals render every branch between
 * `<!-- if -->` comments, iterations render their children once between
 * `<!-- for -->` comments, slots render their fallback, and conditional
 * attributes are omitted with a warning.
 */
export function renderMarkup(
  nodes: TemplateNode[],
  context: MarkupContext
): string {
  return renderNodes(nodes, '', 0, context).join('\n');
}

function renderNodes(
  nodes: TemplateNode[],
  path: string,
  indent: number,
  context: MarkupContext
): string[] {
  const lines: string[] = [];
  nodes.forEach((node, index) => {
    lines.push(
      ...renderNode(node, joinPath(path, `[${index}]`), indent, context)
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

function renderNode(
  node: TemplateNode,
  path: string,
  indent: number,
  context: MarkupContext
): string[] {
  const indentation = INDENTATION.repeat(indent);
  switch (node.type) {
    case 'element':
      return renderElement(node, path, indent, context);
    case 'text':
      return [`${indentation}${textContent(node)}`];
    case 'comment':
      return [`${indentation}<!-- ${node.content} -->`];
    case 'fragment':
      return renderNodes(
        node.children,
        `${path}.children`,
        indent,
        context
      );
    case 'slot':
      return node.fallback
        ? renderNodes(node.fallback, `${path}.fallback`, indent, context)
        : [];
    case 'conditional': {
      const lines: string[] = [];
      node.conditions.forEach((branch, index) => {
        if (branch.statement === 'if') {
          lines.push(`${indentation}<!-- if: ${branch.condition} -->`);
        } else if (branch.statement === 'else-if') {
          lines.push(`${indentation}<!-- else if: ${branch.condition} -->`);
        } else {
          lines.push(`${indentation}<!-- else -->`);
        }
        lines.push(
          ...renderNodes(
            branch.children,
            `${path}.conditions[${index}].children`,
            indent,
            context
          )
        );
      });
      lines.push(`${indentation}<!-- /if -->`);
      return lines;
    }
    case 'iteration': {
      const lines: string[] = [
        `${indentation}<!-- for: ${node.item} in ${node.items} -->`,
      ];
      lines.push(
        ...renderNodes(node.children, `${path}.children`, indent, context)
      );
      lines.push(`${indentation}<!-- /for -->`);
      return lines;
    }
    default:
      return [];
  }
}

function textContent(node: TextNode): string {
  if (node.content !== undefined) {
    return escapeText(node.content);
  }
  return `{{ ${String(node.expression).trim()} }}`;
}

function renderElement(
  node: ElementNode,
  path: string,
  indent: number,
  context: MarkupContext
): string[] {
  const indentation = INDENTATION.repeat(indent);

  if ((node.conditionalAttributes?.length ?? 0) > 0) {
    context.warnings.push({
      message:
        'Conditional attributes are not applied in static HTML output',
      nodePath: path,
    });
  }

  // A dynamic tag renders its `default` as the static preview; the runtime
  // expression has no consumer in HTML mode.
  const tag = staticTagOf(node.tag);
  const openTag = `<${tag}${renderAttributes(node, path, context)}>`;

  if (VOID_ELEMENTS.has(tag)) {
    return [`${indentation}${openTag}`];
  }

  const children = node.children ?? [];
  if (children.length === 0) {
    return [`${indentation}${openTag}</${tag}>`];
  }
  if (children.every((child) => child.type === 'text')) {
    const text = children
      .map((child) => textContent(child as TextNode))
      .join('');
    return [`${indentation}${openTag}${text}</${tag}>`];
  }

  return [
    `${indentation}${openTag}`,
    ...renderNodes(children, `${path}.children`, indent + 1, context),
    `${indentation}</${tag}>`,
  ];
}

function renderAttributes(
  node: ElementNode,
  path: string,
  context: MarkupContext
): string {
  const parts: string[] = [];
  const attributes = node.attributes ?? {};
  const target = context.plan.get(node);

  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }
    if (name === '$spread') {
      // Object spread has no runtime consumer in static HTML - inert, like
      // the passthrough root's rest spread.
      continue;
    }
    if (name === 'class') {
      const classValue = value as Attributes['class'];
      const tokens = [
        ...normalizeClassList(classValue),
        ...classExpressions(classValue).map(
          (expression) => `{{ ${expression} }}`
        ),
      ];
      if (tokens.length > 0) {
        parts.push(`class="${escapeAttributeValue(tokens.join(' '))}"`);
      }
    } else if (name === 'style') {
      const style = value as NestedStyleObject;
      const preview = styleAttributePreview(style, context.stylingInline);
      if (preview !== '') {
        parts.push(`style="${escapeAttributeValue(preview)}"`);
      }
    } else if (isExpressionBinding(value)) {
      const placeholder = `{{ ${value.$expression.trim()} }}`;
      parts.push(`${name}="${escapeAttributeValue(placeholder)}"`);
    } else if (typeof value === 'boolean') {
      if (value) {
        parts.push(name);
      }
    } else {
      parts.push(`${name}="${escapeAttributeValue(String(value))}"`);
    }
  }

  if (target?.generatedNodeIndex !== undefined) {
    parts.push(`${GENERATED_NODE_ATTRIBUTE}="${target.generatedNodeIndex}"`);
  }

  if (context.scriptingInline) {
    node.events?.forEach((event, index) => {
      const handler = inlineHandlerAttribute(
        event,
        `${path}.events[${index}]`,
        context.warnings
      );
      parts.push(`${handler.name}="${escapeAttributeValue(handler.value)}"`);
    });
  }

  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

/**
 * Builds the static `style` attribute preview. Expression values - whole
 * style objects and individual property values - render as
 * `{{ expression }}` placeholders regardless of the styling strategy; static
 * plain properties render only under the `inline` strategy and only when the
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
