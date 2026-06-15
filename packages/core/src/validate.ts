import type {
  Attributes,
  ConditionalNode,
  ElementNode,
  IterationNode,
  Template,
  TemplateNode,
  TextNode,
} from '@js-template-engine/types';

import { isDynamicTag, staticTagOf } from './dynamic-tag';
import { isExpressionBinding } from './expression-binding';
import { isKeyEventModifier } from './key-event-modifiers';
import { RESERVED_PASSTHROUGH_PROPS } from './passthrough';
import { TemplateError } from './TemplateError';
import { VOID_ELEMENTS } from './void-elements';

const NODE_TYPES = new Set([
  'component',
  'element',
  'text',
  'comment',
  'fragment',
  'slot',
  'conditional',
  'iteration',
]);

interface ValidationContext {
  /** True while validating the subtree of a slot's fallback. */
  insideSlotFallback: boolean;
}

/**
 * Validates a template against the structural rules of the template format,
 * throwing a `TemplateError` with a node path on the first violation.
 *
 * The rules cover: component nodes only at the template root (at most one),
 * known node types, conditional branch sequencing, void elements without
 * children, expression bindings on `class` and `style` only in their
 * constrained forms (class entries or sole value; style whole-object as the
 * sole key or top-level property values, never inside nested selector
 * blocks, literal-only inside `conditionalAttributes`), at most one key
 * modifier per event definition, non-empty expressions, no slot nodes
 * inside slot fallbacks, and exactly one of `content` | `expression` on
 * text nodes.
 */
export function validateTemplate(template: Template): void {
  const context: ValidationContext = { insideSlotFallback: false };
  if (Array.isArray(template)) {
    template.forEach((node, index) => {
      validateNode(node, `[${index}]`, context);
    });
  } else if (template?.type !== 'component') {
    throw new TemplateError(
      `Unknown node type '${describeType(template)}'; a template must be a component node or a node array`
    );
  } else {
    template.children.forEach((node, index) => {
      validateNode(node, `children[${index}]`, context);
    });
  }
  validateSurfaceContract(template);
}

/**
 * Validates the cross-node surface-contract rules the JSON Schema cannot
 * express (like conditional branch sequencing): the `passthrough` rules and
 * the dynamic-tag root-only rule, both carrying the offending node's path.
 */
function validateSurfaceContract(template: Template): void {
  const isArray = Array.isArray(template);
  const rootChildren = isArray ? template : template.children;

  const passthroughs: Array<{ node: ElementNode; path: string }> = [];
  const slotNames: string[] = [];
  const dynamicTags: Array<{ node: ElementNode; path: string }> = [];
  collectSurfaceNodes(
    rootChildren,
    isArray ? '' : 'children',
    passthroughs,
    slotNames,
    dynamicTags
  );

  const rendered = rootChildren.filter((child) => child.type !== 'comment');
  validateDynamicTag(dynamicTags, rendered);
  validatePassthrough(template, rootChildren, passthroughs, slotNames);
}

/**
 * Validates the dynamic-tag root-only rule: a dynamic `tag` is allowed only on
 * the component's single root rendered element (the sole non-comment top-level
 * child). A dynamic tag on any other node is a processing error.
 */
function validateDynamicTag(
  dynamicTags: Array<{ node: ElementNode; path: string }>,
  rendered: readonly TemplateNode[]
): void {
  for (const { node, path } of dynamicTags) {
    if (rendered.length !== 1 || rendered[0] !== node) {
      throw new TemplateError(
        "A dynamic tag is allowed only on the component's single root rendered element",
        path
      );
    }
  }
}

/**
 * Validates the surface-contract rules for `passthrough` elements: at most
 * one per component, and the flagged element must be the component's single
 * root rendered element with an intrinsic HTML tag, declaring no prop or
 * slot whose name the contract reserves.
 */
function validatePassthrough(
  template: Template,
  rootChildren: readonly TemplateNode[],
  passthroughs: Array<{ node: ElementNode; path: string }>,
  slotNames: string[]
): void {
  if (passthroughs.length === 0) {
    return;
  }
  if (passthroughs.length > 1) {
    throw new TemplateError(
      'At most one element per component may set passthrough',
      passthroughs[1].path
    );
  }

  const { node, path } = passthroughs[0];
  const rendered = rootChildren.filter((child) => child.type !== 'comment');
  if (rendered.length !== 1 || rendered[0] !== node) {
    throw new TemplateError(
      "A passthrough element must be the component's single root rendered element",
      path
    );
  }
  const tagName = staticTagOf(node.tag);
  if (!/^[a-z]/.test(tagName)) {
    throw new TemplateError(
      `A passthrough element requires an intrinsic HTML tag; '${tagName}' is a component reference`,
      path
    );
  }

  const reserved = new Set(RESERVED_PASSTHROUGH_PROPS);
  const declaredProps = Array.isArray(template)
    ? []
    : Object.keys(template.props ?? {});
  for (const propName of declaredProps) {
    if (reserved.has(propName)) {
      throw new TemplateError(
        `A passthrough component must not declare the reserved prop '${propName}'; the surface contract owns ${RESERVED_PASSTHROUGH_PROPS.join(', ')}`,
        path
      );
    }
  }
  for (const slotName of slotNames) {
    if (reserved.has(slotName)) {
      throw new TemplateError(
        `A passthrough component must not declare a slot named '${slotName}'; the surface contract reserves ${RESERVED_PASSTHROUGH_PROPS.join(', ')}`,
        path
      );
    }
  }
}

/**
 * Collects every `passthrough`-flagged element, every dynamic-tag element
 * (each with its node path), and every slot name in document order, walking
 * the same node shapes as validation.
 */
function collectSurfaceNodes(
  nodes: readonly TemplateNode[],
  path: string,
  passthroughs: Array<{ node: ElementNode; path: string }>,
  slotNames: string[],
  dynamicTags: Array<{ node: ElementNode; path: string }>
): void {
  nodes.forEach((node, index) => {
    const nodePath = path === '' ? `[${index}]` : `${path}[${index}]`;
    switch (node.type) {
      case 'element':
        if (node.passthrough === true) {
          passthroughs.push({ node, path: nodePath });
        }
        if (isDynamicTag(node.tag)) {
          dynamicTags.push({ node, path: nodePath });
        }
        if (node.children) {
          collectSurfaceNodes(node.children, `${nodePath}.children`, passthroughs, slotNames, dynamicTags);
        }
        break;
      case 'fragment':
      case 'iteration':
        collectSurfaceNodes(node.children, `${nodePath}.children`, passthroughs, slotNames, dynamicTags);
        break;
      case 'slot':
        if (node.name !== undefined) {
          slotNames.push(node.name);
        }
        if (node.fallback) {
          collectSurfaceNodes(node.fallback, `${nodePath}.fallback`, passthroughs, slotNames, dynamicTags);
        }
        break;
      case 'conditional':
        node.conditions.forEach((branch, branchIndex) => {
          collectSurfaceNodes(
            branch.children,
            `${nodePath}.conditions[${branchIndex}].children`,
            passthroughs,
            slotNames,
            dynamicTags
          );
        });
        break;
      default:
        break;
    }
  });
}

function describeType(node: unknown): string {
  if (typeof node !== 'object' || node === null) {
    return String(node);
  }
  return String((node as { type?: unknown }).type);
}

function validateNode(
  node: TemplateNode,
  path: string,
  context: ValidationContext
): void {
  if (typeof node !== 'object' || node === null || !NODE_TYPES.has(node.type)) {
    throw new TemplateError(`Unknown node type '${describeType(node)}'`, path);
  }

  switch (node.type) {
    case 'component':
      throw new TemplateError(
        'Component nodes are only allowed at the template root',
        path
      );
    case 'element':
      validateElement(node, path, context);
      break;
    case 'text':
      validateText(node, path);
      break;
    case 'comment':
      break;
    case 'fragment':
      node.children.forEach((child, index) => {
        validateNode(child, `${path}.children[${index}]`, context);
      });
      break;
    case 'slot':
      if (context.insideSlotFallback) {
        throw new TemplateError(
          'Slot fallbacks must not contain slot nodes',
          path
        );
      }
      node.fallback?.forEach((child, index) => {
        validateNode(child, `${path}.fallback[${index}]`, {
          insideSlotFallback: true,
        });
      });
      break;
    case 'conditional':
      validateConditional(node, path, context);
      break;
    case 'iteration':
      validateIteration(node, path, context);
      break;
  }
}

function validateElement(
  node: ElementNode,
  path: string,
  context: ValidationContext
): void {
  if (isDynamicTag(node.tag)) {
    validateExpression(node.tag.$expression, `${path}.tag.$expression`);
    if (typeof node.tag.default !== 'string' || node.tag.default.trim() === '') {
      throw new TemplateError(
        "A dynamic tag requires a non-empty 'default' tag",
        `${path}.tag.default`
      );
    }
  }

  if (node.attributes) {
    validateAttributes(node.attributes, `${path}.attributes`, {
      expressionsAllowed: true,
    });
  }

  node.conditionalAttributes?.forEach((conditional, index) => {
    const conditionalPath = `${path}.conditionalAttributes[${index}]`;
    validateExpression(conditional.condition, `${conditionalPath}.condition`);
    validateAttributes(conditional.attributes, `${conditionalPath}.attributes`, {
      expressionsAllowed: false,
    });
  });

  node.events?.forEach((event, index) => {
    validateExpression(event.handler, `${path}.events[${index}].handler`);
    const keyModifiers = (event.modifiers ?? []).filter(isKeyEventModifier);
    if (keyModifiers.length > 1) {
      throw new TemplateError(
        'At most one key modifier is allowed per event definition; write multiple accepted keys as separate event entries',
        `${path}.events[${index}].modifiers`
      );
    }
  });

  const effectiveTag = staticTagOf(node.tag);
  if (VOID_ELEMENTS.has(effectiveTag) && (node.children?.length ?? 0) > 0) {
    throw new TemplateError(
      `Void element '<${effectiveTag}>' must not have children`,
      path
    );
  }

  node.children?.forEach((child, index) => {
    validateNode(child, `${path}.children[${index}]`, context);
  });
}

interface AttributeRules {
  /**
   * False inside `conditionalAttributes`, where `class` and `style` are
   * literal-only — the condition is their dynamism.
   */
  expressionsAllowed: boolean;
}

function validateAttributes(
  attributes: Attributes,
  path: string,
  rules: AttributeRules
): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }
    if (name === 'class') {
      validateClass(value as Attributes['class'], `${path}.class`, rules);
    } else if (name === 'style') {
      validateStyle(value as Attributes['style'], `${path}.style`, rules);
    } else if (isExpressionBinding(value)) {
      validateExpression(value.$expression, `${path}.${name}`);
    }
  }
}

function validateClass(
  value: Attributes['class'],
  path: string,
  rules: AttributeRules
): void {
  const entries = Array.isArray(value) ? value : [value];
  entries.forEach((entry, index) => {
    if (!isExpressionBinding(entry)) {
      return;
    }
    const entryPath = Array.isArray(value) ? `${path}[${index}]` : path;
    if (!rules.expressionsAllowed) {
      throw new TemplateError(
        "Expression bindings are not allowed on 'class' inside conditionalAttributes; the condition is the dynamism",
        entryPath
      );
    }
    validateExpression(entry.$expression, entryPath);
  });
}

function validateStyle(
  value: Attributes['style'],
  path: string,
  rules: AttributeRules
): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  if ('$expression' in value) {
    if (Object.keys(value).length > 1) {
      throw new TemplateError(
        "A whole-object style expression must have '$expression' as its sole key",
        path
      );
    }
    if (!rules.expressionsAllowed) {
      throw new TemplateError(
        "Expression bindings are not allowed on 'style' inside conditionalAttributes; the condition is the dynamism",
        path
      );
    }
    validateExpression(value.$expression, path);
    return;
  }
  validateStyleObject(value, path, rules, false);
}

function validateStyleObject(
  style: object,
  path: string,
  rules: AttributeRules,
  insideSelectorBlock: boolean
): void {
  for (const [key, value] of Object.entries(style)) {
    if (key === '$include') {
      validateInclude(value, `${path}.${key}`);
      continue;
    }
    if (value === undefined || typeof value !== 'object' || value === null) {
      continue;
    }
    const valuePath = `${path}.${key}`;
    if (isExpressionBinding(value)) {
      if (insideSelectorBlock) {
        throw new TemplateError(
          'Expression values are not allowed inside nested selector blocks; stylesheets cannot hold runtime values',
          valuePath
        );
      }
      if (!rules.expressionsAllowed) {
        throw new TemplateError(
          "Expression bindings are not allowed on 'style' inside conditionalAttributes; the condition is the dynamism",
          valuePath
        );
      }
      validateExpression(value.$expression, valuePath);
    } else {
      validateStyleObject(value, valuePath, rules, true);
    }
  }
}

/**
 * Validates a `$include` value: a non-empty string, or an array of
 * non-empty strings (several `@include` statements in authored order). The
 * statements themselves are opaque source — checked for non-emptiness,
 * never parsed.
 */
function validateInclude(value: unknown, path: string): void {
  const statements = Array.isArray(value) ? value : [value];
  if (statements.length === 0) {
    throw new TemplateError(
      "A '$include' value must be a non-empty string or array of strings",
      path
    );
  }
  statements.forEach((statement, index) => {
    if (typeof statement !== 'string' || statement.trim() === '') {
      throw new TemplateError(
        "A '$include' statement must be a non-empty string",
        Array.isArray(value) ? `${path}[${index}]` : path
      );
    }
  });
}

function validateText(node: TextNode, path: string): void {
  const hasContent = node.content !== undefined;
  const hasExpression = node.expression !== undefined;
  if (hasContent === hasExpression) {
    throw new TemplateError(
      "A text node must have exactly one of 'content' | 'expression'",
      path
    );
  }
  if (hasExpression) {
    validateExpression(node.expression, `${path}.expression`);
  }
}

function validateConditional(
  node: ConditionalNode,
  path: string,
  context: ValidationContext
): void {
  if (node.conditions.length === 0) {
    throw new TemplateError(
      "A conditional must contain at least an 'if' branch",
      `${path}.conditions`
    );
  }

  node.conditions.forEach((branch, index) => {
    const branchPath = `${path}.conditions[${index}]`;
    const isLast = index === node.conditions.length - 1;

    if (index === 0 && branch.statement !== 'if') {
      throw new TemplateError(
        `A conditional must start with an 'if' branch, found '${branch.statement}'`,
        branchPath
      );
    }
    if (index > 0 && branch.statement === 'if') {
      throw new TemplateError(
        "Only the first branch of a conditional may be 'if'",
        branchPath
      );
    }
    if (branch.statement === 'else' && !isLast) {
      throw new TemplateError(
        "An 'else' branch must be the last branch of a conditional",
        branchPath
      );
    }

    if (branch.statement === 'else') {
      if (branch.condition !== undefined) {
        throw new TemplateError(
          "An 'else' branch must not have a condition",
          branchPath
        );
      }
    } else if (branch.condition === undefined) {
      throw new TemplateError(
        `An '${branch.statement}' branch requires a condition`,
        branchPath
      );
    } else {
      validateExpression(branch.condition, `${branchPath}.condition`);
    }

    branch.children.forEach((child, childIndex) => {
      validateNode(child, `${branchPath}.children[${childIndex}]`, context);
    });
  });
}

function validateIteration(
  node: IterationNode,
  path: string,
  context: ValidationContext
): void {
  validateExpression(node.items, `${path}.items`);
  if (node.key !== undefined) {
    validateExpression(node.key, `${path}.key`);
  }
  node.children.forEach((child, index) => {
    validateNode(child, `${path}.children[${index}]`, context);
  });
}

function validateExpression(expression: unknown, path: string): void {
  if (typeof expression !== 'string' || expression.trim() === '') {
    throw new TemplateError('Expressions must be non-empty strings', path);
  }
}
