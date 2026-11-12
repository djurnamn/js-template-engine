import { TemplateError } from './TemplateError';

/**
 * The kind of value a node field holds, checked before a node's own rules
 * read it. `present` only requires the field to be there; its value is
 * validated by the rule that reads it.
 */
type FieldKind =
  | 'string'
  | 'boolean'
  | 'array'
  | 'object'
  | 'object array'
  | 'tag'
  | 'statement'
  | 'boolean or object'
  | 'present';

interface FieldShape {
  kind: FieldKind;
  required?: boolean;
  /**
   * A hint for a value of the wrong kind an author is likely to write, or
   * `undefined` when the value calls for none.
   */
  mismatchHint?: (value: unknown) => string | undefined;
}

/** The fields one kind of template object takes, and a hint for misplaced keys. */
interface ObjectShape {
  /** The object's name in a message: `an element node`, `a conditional branch`. */
  label: string;
  fields: Record<string, FieldShape>;
  /** Hints for keys authors write in the wrong place, by key. */
  hints?: Record<string, string>;
  /** The hint for any other unknown key. */
  otherHint?: string;
}

/**
 * The hint for a text node's `content` written as an attribute's expression
 * binding: a text node computed from an expression takes `expression`.
 */
function expressionContentHint(value: unknown): string | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('$expression' in value)
  ) {
    return undefined;
  }
  const expression = (value as { $expression: unknown }).$expression;
  // The author's own expression, quoted so it reads back as written.
  const example =
    typeof expression !== 'string'
      ? "'label'"
      : expression.includes("'")
        ? JSON.stringify(expression)
        : `'${expression}'`;
  return `a text node computed from an expression takes 'expression' in place of 'content': { type: 'text', expression: ${example} }`;
}

const CONDITIONAL_HINT =
  "a conditional's branches go in 'conditions', each { statement, condition, children }";

/**
 * The shape of every node type, the component root, a conditional branch, a
 * conditional attribute entry, an event, a named slot projection, a dynamic
 * tag, a passthrough routing object, a fragment's override block, a prop
 * definition and a bindable object: the same keys the JSON Schema admits.
 */
export const NODE_SHAPES: Record<string, ObjectShape> = {
  component: {
    label: 'a component node',
    fields: {
      type: { kind: 'present', required: true },
      name: { kind: 'string', required: true },
      description: { kind: 'present' },
      props: { kind: 'present' },
      imports: { kind: 'array' },
      script: { kind: 'string' },
      derived: { kind: 'object' },
      ids: { kind: 'object' },
      style: { kind: 'string' },
      children: { kind: 'array', required: true },
      extensions: { kind: 'present' },
      rest: { kind: 'object' },
      typeParameters: { kind: 'array' },
      parts: { kind: 'array' },
    },
  },
  element: {
    label: 'an element node',
    fields: {
      type: { kind: 'present', required: true },
      tag: { kind: 'tag', required: true },
      attributes: { kind: 'object' },
      conditionalAttributes: { kind: 'object array' },
      events: { kind: 'object array' },
      children: { kind: 'array' },
      extensions: { kind: 'object' },
      slotScope: { kind: 'present' },
      slots: { kind: 'present' },
      passthrough: { kind: 'boolean or object' },
    },
    hints: {
      componentValued:
        "'componentValued' belongs in a dynamic tag: tag: { $expression, default, componentValued }",
    },
    otherHint:
      "an element's HTML attributes, class and style included, go in 'attributes'",
  },
  text: {
    label: 'a text node',
    fields: {
      type: { kind: 'present', required: true },
      content: { kind: 'string', mismatchHint: expressionContentHint },
      expression: { kind: 'present' },
    },
  },
  comment: {
    label: 'a comment node',
    fields: {
      type: { kind: 'present', required: true },
      content: { kind: 'string', required: true },
    },
  },
  fragment: {
    label: 'a fragment node',
    fields: {
      type: { kind: 'present', required: true },
      children: { kind: 'array', required: true },
      extensions: { kind: 'object' },
    },
  },
  slot: {
    label: 'a slot node',
    fields: {
      type: { kind: 'present', required: true },
      name: { kind: 'string' },
      fallback: { kind: 'array' },
      exposes: { kind: 'present' },
      scopeRequired: { kind: 'boolean' },
    },
    hints: {
      children: "a slot's default content goes in 'fallback'",
    },
  },
  conditional: {
    label: 'a conditional node',
    fields: {
      type: { kind: 'present', required: true },
      conditions: { kind: 'object array', required: true },
    },
    otherHint: CONDITIONAL_HINT,
  },
  iteration: {
    label: 'an iteration node',
    fields: {
      type: { kind: 'present', required: true },
      items: { kind: 'present', required: true },
      item: { kind: 'string', required: true },
      index: { kind: 'string' },
      key: { kind: 'present' },
      children: { kind: 'array', required: true },
    },
  },
  conditionalAttributes: {
    label: 'a conditional attribute entry',
    fields: {
      condition: { kind: 'present', required: true },
      attributes: { kind: 'object', required: true },
    },
  },
  event: {
    label: 'an event',
    fields: {
      name: { kind: 'string', required: true },
      handler: { kind: 'present', required: true },
      modifiers: { kind: 'present' },
    },
  },
  branch: {
    label: 'a conditional branch',
    fields: {
      statement: { kind: 'statement', required: true },
      condition: { kind: 'present' },
      props: { kind: 'present' },
      children: { kind: 'array', required: true },
    },
  },
  // The shapes below check unknown keys only; their own rules report a
  // missing or malformed field.
  namedSlot: {
    label: 'a named slot projection',
    fields: {
      content: { kind: 'present' },
      slotScope: { kind: 'present' },
    },
  },
  dynamicTag: {
    label: 'a dynamic tag',
    fields: {
      $expression: { kind: 'present' },
      default: { kind: 'present' },
      componentValued: { kind: 'present' },
    },
  },
  prop: {
    label: 'a prop definition',
    fields: {
      type: { kind: 'present' },
      required: { kind: 'present' },
      default: { kind: 'present' },
      documentedDefault: { kind: 'present' },
      description: { kind: 'present' },
      bindable: { kind: 'present' },
    },
  },
  passthroughRouting: {
    label: 'a passthrough routing object',
    fields: {
      attributes: { kind: 'present' },
      handle: { kind: 'present' },
    },
  },
  fragmentOverride: {
    label: "a fragment's override block",
    fields: {
      tag: { kind: 'string' },
      attributes: { kind: 'object' },
      events: { kind: 'array' },
    },
    hints: {
      unwrap:
        'a fragment already renders only its children wherever its block names no tag',
    },
    otherHint:
      'a fragment renders no element of its own, so its block names only the wrapper that target renders around its children, and styling extensions give it no class',
  },
  bindable: {
    label: 'a bindable object',
    fields: {
      current: { kind: 'present' },
      setter: { kind: 'present' },
      given: { kind: 'present' },
      report: { kind: 'present' },
      defaultProp: { kind: 'present' },
      changeProp: { kind: 'present' },
    },
  },
};

const STATEMENTS = new Set(['if', 'else-if', 'else']);

const KIND_DESCRIPTIONS: Record<FieldKind, string> = {
  string: 'a string',
  boolean: 'a boolean',
  array: 'an array',
  object: 'an object',
  'object array': 'an array of objects',
  tag: 'a tag name or a dynamic tag object',
  statement: "'if', 'else-if' or 'else'",
  'boolean or object': 'a boolean or an object',
  present: 'a value',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesKind(value: unknown, kind: FieldKind): boolean {
  switch (kind) {
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isRecord(value);
    case 'object array':
      return Array.isArray(value) && value.every(isRecord);
    case 'tag':
      return typeof value === 'string' || isRecord(value);
    case 'statement':
      return typeof value === 'string' && STATEMENTS.has(value);
    case 'boolean or object':
      return typeof value === 'boolean' || isRecord(value);
    case 'present':
      return true;
  }
}

function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return value.every(isRecord)
      ? 'an array'
      : 'an array with a non-object entry';
  }
  if (typeof value === 'string') {
    return `the string '${value}'`;
  }
  return typeof value === 'object'
    ? 'an object'
    : `${typeof value} ${String(value)}`;
}

/** The result of {@link checkObjectShape}. */
export interface ShapeCheck {
  /** One error per missing or malformed field and per unknown key. */
  errors: TemplateError[];
  /**
   * Whether a field is missing or of the wrong kind, so the object's own
   * rules, which read those fields, must not run.
   */
  malformed: boolean;
}

/**
 * Checks one template object against its shape: each required field
 * present, each field of its kind, and no key the shape does not define. The
 * contents of `extensions` are not checked here; extension override blocks
 * stay open (unknown override keys are inert).
 *
 * @param value - The node, branch or component root, an object.
 * @param shapeName - The key of its shape in {@link NODE_SHAPES}.
 * @param path - The object's path in the template.
 * @returns The errors found, and whether the object's fields are malformed.
 */
export function checkObjectShape(
  value: Record<string, unknown>,
  shapeName: string,
  path: string
): ShapeCheck {
  const shape = NODE_SHAPES[shapeName];
  const errors: TemplateError[] = [];
  let malformed = false;
  const at = (key: string) => (path === '' ? key : `${path}.${key}`);

  for (const [key, field] of Object.entries(shape.fields)) {
    const fieldValue = value[key];
    if (fieldValue === undefined) {
      if (field.required) {
        malformed = true;
        errors.push(
          new TemplateError(
            `${capitalize(shape.label)} requires '${key}', ${KIND_DESCRIPTIONS[field.kind]}`,
            at(key)
          )
        );
      }
    } else if (!matchesKind(fieldValue, field.kind)) {
      malformed = true;
      const hint = field.mismatchHint?.(fieldValue);
      errors.push(
        new TemplateError(
          `The '${key}' of ${shape.label} must be ${KIND_DESCRIPTIONS[field.kind]}; got ${describeValue(fieldValue)}${hint === undefined ? '' : `; ${hint}`}`,
          at(key)
        )
      );
    }
  }

  for (const [key, keyValue] of Object.entries(value)) {
    // A key set to undefined is as good as absent, as the JSON transport
    // drops it.
    if (
      keyValue === undefined ||
      Object.prototype.hasOwnProperty.call(shape.fields, key)
    ) {
      continue;
    }
    const hint = shape.hints?.[key] ?? shape.otherHint;
    errors.push(
      new TemplateError(
        `Unknown key '${key}' on ${shape.label}, which takes ${Object.keys(shape.fields).join(', ')}${hint === undefined ? '' : `; ${hint}`}`,
        at(key)
      )
    );
  }

  return { errors, malformed };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
