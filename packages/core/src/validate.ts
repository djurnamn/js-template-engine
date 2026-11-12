import type {
  Attributes,
  ComponentNode,
  ConditionalNode,
  ElementNode,
  Extension,
  FragmentNode,
  IterationNode,
  PropDefinition,
  ReservedName,
  ReservedNameContext,
  Template,
  TemplateNode,
  TextNode,
} from '@js-template-engine/types';

import {
  GENERATED_ID_NEXT_NAME,
  GENERATED_ID_NAME,
  ID_PREFIX_PATTERN,
} from './declared-ids';
import { isDynamicTag, staticTagOf } from './dynamic-tag';
import { isExpressionBinding } from './expression-binding';
import {
  flattenTemplateLiterals,
  readExpressionIdentifiers,
  tokenizeExpression,
  topLevelDeclarations,
} from './expression-scope';
import { importsEntryParseFailure } from './html/module-scope';
import {
  EVENT_MODIFIERS,
  isEventModifier,
  isKeyEventModifier,
} from './key-event-modifiers';
import {
  isBindableName,
  normalizeSlotName,
  propAliases,
  scriptDeclarations,
} from './local-bindings';
import { checkObjectShape } from './node-shape';
import { normalizeClassList } from './normalize';
import {
  conditionalPassthroughOf,
  discriminantOf,
  discriminatedSurfaceOf,
  type DiscriminatedSurface,
  hasBooleanMember,
  isFalsyLiteralType,
  isTruthyLiteralType,
  RESERVED_PASSTHROUGH_PROPS,
  unionMembersOf,
} from './passthrough';
import {
  isInsideIteration,
  isPassthroughRouting,
  RESERVED_ROUTED_NAMES,
  ROUTE_ALL,
  ROUTE_ARIA,
  ROUTE_HANDLERS,
} from './passthrough-routing';
import {
  reservedBindingNames,
  reservedBindingOf,
  resolveReservedNames,
} from './reserved-names';
import { normalizeExposes, normalizeNamedSlots } from './slots';
import {
  TemplateError,
  templateErrorDetails,
  throwTemplateErrors,
  type TemplateErrorDetail,
} from './TemplateError';
import { visitNodes } from './traverse';
import {
  isBindableDefinition,
  isRelayedBindableDefinition,
  admitsFunction,
  defaultTypeMatches,
  defaultValueFitsType,
  isEventType,
  isFunctionType,
  ownValueName,
} from './two-way-bindings';
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

/** A bare JavaScript identifier - no member access, calls, or operators. */
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

interface ValidationContext {
  /** True while validating the subtree of a slot's fallback. */
  insideSlotFallback: boolean;
}

/** Options for {@link validateTemplate}. */
export interface ValidationOptions {
  /**
   * The extensions of the build the template is validated for. Each
   * reserves the names its output declares (`reservedNames`), has its
   * override blocks checked (`overrideBlocks`) and validates what only it
   * reads (`validateOverrides`). Omitted, the template is checked against
   * the template format and the names the engine's own generated code
   * declares, with no target's.
   */
  extensions?: readonly Extension[];
  /**
   * Further extensions whose `reservedNames` are reserved as well, though
   * they are not in the build: the targets a template must stay buildable
   * for, such as every target of a kit. Only their names are
   * read; their override blocks and checks are not.
   */
  reserveNamesOf?: readonly Extension[];
}

/** The template a validation run checks, with the build's extensions. */
interface ValidationScope {
  template: Template;
  extensions: readonly Extension[];
  /** Further extensions whose names are reserved too. */
  reserveNamesOf: readonly Extension[];
}

/**
 * The names reserved in a component: the engine's own and each extension's
 * ({@link resolveReservedNames}), given the component's two-way props.
 */
function reservedNamesIn(
  scope: ValidationScope,
  twoWayProps: ReservedNameContext['twoWayProps'] = []
): ReservedName[] {
  return resolveReservedNames([...scope.extensions, ...scope.reserveNamesOf], {
    template: scope.template,
    twoWayProps,
  });
}

/**
 * The extension blocks a component override holds beside its own fields
 * (`Extension.overrideBlocks`), each with its path, for every extension of
 * the build that declares them and whose override the component sets.
 */
function overrideBlocksOf(
  template: ComponentNode,
  extensions: readonly Extension[],
  extensionKey?: string
): Array<{ block: unknown; path: string }> {
  const blocks: Array<{ block: unknown; path: string }> = [];
  for (const extension of extensions) {
    if (extensionKey !== undefined && extension.key !== extensionKey) continue;
    const override = template.extensions?.[extension.key];
    if (!isRecord(override)) continue;
    for (const key of extension.overrideBlocks ?? []) {
      if (override[key] !== undefined) {
        blocks.push({
          block: override[key],
          path: `extensions.${extension.key}.${key}`,
        });
      }
    }
  }
  return blocks;
}

/**
 * The errors of the validation run in progress, which {@link collect}
 * records into; undefined outside a run.
 */
let recorded: TemplateErrorDetail[] | undefined;

/**
 * Runs one check and records the `TemplateError` it throws, so validation
 * goes on to the next check and reports every violation in one run. Any
 * other thrown value - a check that cannot read a malformed shape -
 * propagates while nothing is recorded, and is dropped once a violation is:
 * the template is already reported invalid, and the crash adds nothing.
 */
function collect(check: () => void): void {
  try {
    check();
  } catch (error) {
    if (recorded === undefined) {
      throw error;
    }
    if (error instanceof TemplateError) {
      recorded.push(...templateErrorDetails(error));
    } else if (recorded.length === 0) {
      throw error;
    }
  }
}

/**
 * Validates a template against the structural rules of the template format,
 * throwing a `TemplateError` with a node path when it violates any. Every
 * violation is reported: one is thrown as it is, several as one
 * `TemplateError` that lists them, one per line, and carries them on its
 * `errors`.
 *
 * The rules cover: component nodes only at the template root (at most one),
 * known node types, conditional branch sequencing, void elements without
 * children, expression bindings on `class` and `style` only in their
 * constrained forms (class entries or sole value; style whole-object as the
 * sole key or top-level property values, never inside nested selector
 * blocks, literal-only inside `conditionalAttributes`), a class beside every
 * `conditionalAttributes` style, event modifiers from the supported set and
 * at most one key modifier per event definition, `style` always a style
 * object, non-empty expressions, no slot named `default`, no slot nodes
 * inside slot fallbacks, exactly one of
 * `content` | `expression` on text nodes, a component's `description`
 * a string, each prop definition an object with a string `type`, each
 * component extension override of the shared override shape, each
 * `imports` entry parsing as a TypeScript module, a prop's
 * `documentedDefault` a string never set beside its `default`, and each
 * two-way prop's `bindable` object well formed, naming props of the right
 * kind and names no prop, slot, binding or script takes.
 *
 * The names a target's output declares itself are reserved only when that
 * target's extension is given in `options.extensions`, so a template is
 * validated for the build it is part of; each given extension's own checks
 * run too.
 *
 * @param template - The template to validate.
 * @param options - The extensions of the build.
 * @example
 * validateTemplate(template); // the template format and the engine's own names
 * validateTemplate(template, { extensions: [react(), bem()] }); // and React's
 */
export function validateTemplate(
  template: Template,
  options: ValidationOptions = {}
): void {
  const scope: ValidationScope = {
    template,
    extensions: options.extensions ?? [],
    reserveNamesOf: options.reserveNamesOf ?? [],
  };
  const outer = recorded;
  const errors: TemplateErrorDetail[] = [];
  recorded = errors;
  try {
    validateNodes(template, scope.extensions);
    const nodeErrors = errors.length;
    try {
      validateSurfaceContract(template, scope);
    } catch (error) {
      // The cross-node rules walk the template's shape; on a template whose
      // nodes are already reported malformed, a walk that cannot read the
      // shape adds nothing to those errors.
      if (nodeErrors === 0) {
        throw error;
      }
    }
    try {
      validateExtensionOverrides(template, scope.extensions);
    } catch (error) {
      // As above: an extension's walk of a malformed template adds nothing.
      if (errors.length === 0) {
        throw error;
      }
    }
  } finally {
    recorded = outer;
  }
  if (errors.length > 0) {
    throwTemplateErrors(errors, 'validation');
  }
}

/**
 * Runs each extension's own checks (`Extension.validateOverrides`),
 * recording the violations it returns.
 */
function validateExtensionOverrides(
  template: Template,
  extensions: readonly Extension[]
): void {
  const checking = extensions.filter(
    (extension) => extension.validateOverrides !== undefined
  );
  if (checking.length === 0) {
    return;
  }
  const twoWayProps = Array.isArray(template)
    ? []
    : wellFormedBindings(template).map(([name]) => name);
  for (const extension of checking) {
    collect(() => {
      for (const violation of extension.validateOverrides!(template, {
        twoWayProps,
      })) {
        recorded?.push({
          message: violation.message,
          nodePath: violation.nodePath,
        });
      }
    });
  }
}

/** Validates the template's own fields and each of its nodes. */
function validateNodes(
  template: Template,
  extensions: readonly Extension[]
): void {
  const context: ValidationContext = { insideSlotFallback: false };
  if (Array.isArray(template)) {
    template.forEach((node, index) => {
      collect(() => validateNode(node, `[${index}]`, context));
    });
  } else if (template?.type !== 'component') {
    throw new TemplateError(
      `Unknown node type '${describeType(template)}'; a template must be a component node or a node array`
    );
  } else {
    if (
      template.description !== undefined &&
      typeof template.description !== 'string'
    ) {
      collect(() => {
        throw new TemplateError(
          `A component's description must be a string; got ${Array.isArray(template.description) ? 'an array' : `a ${typeof template.description}`}`,
          'description'
        );
      });
    }
    const { malformed } = recordShape(template, 'component', '');
    if (!malformed && template.parts !== undefined) {
      validateParts(template.parts, template.name);
    }
    validateImportsParse(template.imports, 'imports');
    validateProps(template.props, 'props', true);
    validateComponentOverrides(template, extensions);
    if (!malformed) {
      template.children.forEach((node, index) => {
        collect(() => validateNode(node, `children[${index}]`, context));
      });
    }
  }
}

/**
 * Records the errors of an object's shape check: a missing or malformed
 * field, or a key its shape does not define (rule 28).
 *
 * @returns Whether a field is malformed, so the object's own rules, which
 * read its fields, are skipped.
 */
function recordShape(
  value: object,
  shapeName: string,
  path: string
): { malformed: boolean } {
  const { errors, malformed } = checkObjectShape(
    value as Record<string, unknown>,
    shapeName,
    path
  );
  for (const error of errors) {
    collect(() => {
      throw error;
    });
  }
  return { malformed };
}

/** Describes a value's kind for an error message: `null`, `an array`, ... */
function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'an array';
  }
  if (typeof value === 'string' && value.trim() === '') {
    return 'an empty string';
  }
  if (typeof value === 'string') {
    return `the string '${value}'`;
  }
  return typeof value === 'object'
    ? 'an object'
    : `${typeof value} ${String(value)}`;
}

/** Whether a value is a plain record: an object, not null or an array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a props record (the shared props, a discriminated branch's or a
 * component extension override's): a record whose every entry is a prop
 * definition object with a non-empty string `type`, and each documented
 * default a non-empty string, the code a consumer reads, never set beside a
 * declared `default`, since a prop has one default to document.
 */
function validateProps(props: unknown, path: string, shared = false): void {
  if (props === undefined) {
    return;
  }
  if (!isRecord(props)) {
    collect(() => {
      throw new TemplateError(
        `A props record must map prop names to prop definitions; got ${describeValue(props)}`,
        path
      );
    });
    return;
  }
  for (const [name, definition] of Object.entries(props)) {
    collect(() => validateProp(name, definition, `${path}.${name}`, shared));
  }
}

/** Validates one prop definition; see {@link validateProps}. */
function validateProp(
  name: string,
  definition: unknown,
  propPath: string,
  shared: boolean
): void {
  if (!isRecord(definition)) {
    throw new TemplateError(
      `The prop '${name}' must be a prop definition object, such as { type: 'string' }; got ${describeValue(definition)}`,
      propPath
    );
  }
  recordShape(definition, 'prop', propPath);
  if (typeof definition.type !== 'string' || definition.type.trim() === '') {
    throw new TemplateError(
      `The prop '${name}' needs a type, a non-empty string such as 'string'; got ${definition.type === undefined ? 'none' : describeValue(definition.type)}`,
      `${propPath}.type`
    );
  }
  if (definition.bindable !== undefined) {
    validateBindable(name, definition, propPath, shared);
  }
  if (definition.default !== undefined) {
    collect(() => validateDefault(name, definition, propPath));
  }
  if (definition.documentedDefault === undefined) {
    return;
  }
  const documentedDefault: unknown = definition.documentedDefault;
  if (
    typeof documentedDefault !== 'string' ||
    documentedDefault.trim() === ''
  ) {
    throw new TemplateError(
      `A prop's documentedDefault must be a non-empty string holding the code a consumer reads; got ${typeof documentedDefault === 'string' ? 'an empty string' : Array.isArray(documentedDefault) ? 'an array' : documentedDefault === null ? 'null' : `a ${typeof documentedDefault}`}`,
      `${propPath}.documentedDefault`
    );
  }
  if (definition.default !== undefined) {
    throw new TemplateError(
      `The prop '${name}' sets both default and documentedDefault; a declared default is documented already, so keep one`,
      propPath
    );
  }
}

/**
 * Validates a prop's `default`: a literal, never an expression binding, the
 * targets write as the prop's fallback, and a value of the prop's type where
 * the type is a union of primitives and literals the check reads (see
 * {@link defaultValueFitsType}).
 */
function validateDefault(
  name: string,
  definition: Record<string, unknown>,
  propPath: string
): void {
  const value = definition.default;
  if (isRecord(value) && '$expression' in value) {
    throw new TemplateError(
      `The prop '${name}' has an expression binding as its default; a default is a literal value the targets write as the prop's fallback, so give a literal, or leave the default out and compute the fallback where the value is read (${name} ?? ...) or in a derived value`,
      `${propPath}.default`
    );
  }
  if (
    typeof definition.type === 'string' &&
    !defaultValueFitsType(definition.type, value)
  ) {
    throw new TemplateError(
      `The prop '${name}' has ${describeDefault(value)} as its default, which its type, ${definition.type.trim()}, does not admit; give a default of that type`,
      `${propPath}.default`
    );
  }
}

/** Describes a default value for an error message, as it is written. */
function describeDefault(value: unknown): string {
  return typeof value === 'object' && value !== null
    ? describeValue(value)
    : JSON.stringify(value);
}

/**
 * Validates a prop's `bindable`: `true`, `false` or a two-way object of one
 * form - the copy form, whose `current` and `setter` are free identifiers
 * (distinct from each other) and whose `defaultProp` and `changeProp`, when
 * given, are non-empty strings, or the relayed form, whose `given` and
 * `report` are free identifiers (distinct from each other), whose
 * `changeProp`, when given, is a non-empty string, and which names no
 * `defaultProp` and sets no `default`, since the value's owner keeps it. The
 * object is declared only among the component's own props; the copy form
 * on a prop that is optional and not itself a function. The props it names
 * are checked with the whole component (see {@link validateTwoWayBindings}).
 */
function validateBindable(
  name: string,
  definition: Record<string, unknown>,
  propPath: string,
  shared: boolean
): void {
  const bindable = definition.bindable;
  const path = `${propPath}.bindable`;
  if (typeof bindable === 'boolean') {
    return;
  }
  if (!isRecord(bindable)) {
    throw new TemplateError(
      `A prop's bindable must be true, false or an object such as { current: 'isOpen', setter: 'setOpen' }; got ${describeValue(bindable)}`,
      path
    );
  }
  recordShape(bindable, 'bindable', path);
  if (!shared) {
    throw new TemplateError(
      `The prop '${name}' declares its two-way value here, which only the component's own props may: declare the bindable object in the component's props`,
      path
    );
  }
  const copied = 'current' in bindable || 'setter' in bindable;
  const relayed = 'given' in bindable || 'report' in bindable;
  if (copied && relayed) {
    throw new TemplateError(
      `A two-way prop's bindable is one form: { current, setter } keeps the value in the component, { given, report } relays it to its owner; '${name}' mixes them`,
      path
    );
  }
  if (!copied && !relayed) {
    throw new TemplateError(
      `A two-way prop's bindable object names the value and the function that changes it: { current: 'isOpen', setter: 'setOpen' } to keep the value in the component, or { given: 'givenOpen', report: 'reportOpen' } to relay it to its owner; got ${describeValue(bindable)}`,
      path
    );
  }
  const [valueField, functionField] = relayed
    ? (['given', 'report'] as const)
    : (['current', 'setter'] as const);
  const examples = relayed
    ? { given: 'givenOpen', report: 'reportOpen' }
    : { current: 'isOpen', setter: 'setOpen' };
  for (const field of [valueField, functionField]) {
    const value = bindable[field];
    // Svelte reserves a leading `$` for its stores and runes.
    if (
      typeof value !== 'string' ||
      !isBindableName(value) ||
      value.startsWith('$')
    ) {
      throw new TemplateError(
        `A two-way prop's ${field} must be an identifier the component can declare, not starting with $, such as '${examples[field as keyof typeof examples]}'; got ${value === undefined ? 'none' : describeValue(value)}`,
        `${path}.${field}`
      );
    }
  }
  if (bindable[valueField] === bindable[functionField]) {
    throw new TemplateError(
      `A two-way prop's ${valueField} and ${functionField} take two names; both are '${String(bindable[valueField])}'`,
      `${path}.${functionField}`
    );
  }
  if (relayed && bindable.defaultProp !== undefined) {
    throw new TemplateError(
      `The relayed prop '${name}' names a defaultProp, but a relayed value keeps no copy to seed; the owner starts from an ordinary prop the template forwards to it`,
      `${path}.defaultProp`
    );
  }
  if (relayed && definition.default !== undefined) {
    throw new TemplateError(
      `The relayed prop '${name}' sets a default, but a relayed value keeps no copy to seed, and a default would always be given; the owner starts from an ordinary prop the template forwards to it`,
      `${propPath}.default`
    );
  }
  for (const field of ['defaultProp', 'changeProp'] as const) {
    const value = bindable[field];
    if (
      value !== undefined &&
      (typeof value !== 'string' || value.trim() === '')
    ) {
      throw new TemplateError(
        `A two-way prop's ${field} must name a declared prop; got ${describeValue(value)}`,
        `${path}.${field}`
      );
    }
  }
  if (relayed) {
    return;
  }
  if (definition.required === true) {
    throw new TemplateError(
      `The two-way prop '${name}' is required, so it is always given and the component never keeps its own value; make it optional, or declare it bindable: true`,
      `${propPath}.required`
    );
  }
  if (typeof definition.type === 'string' && admitsFunction(definition.type)) {
    throw new TemplateError(
      `The two-way prop '${name}' may be a function, which its setter would take for an updater; a two-way value is never a function`,
      `${propPath}.type`
    );
  }
}

/**
 * Records each `parts` entry that is not a component name: an empty or
 * non-string entry, a name listed twice, or the component's own name.
 * Whether each names a component of the kit is the kit build's check, which
 * sees every template.
 */
function validateParts(parts: unknown[], componentName: string): void {
  const seen = new Set<string>();
  parts.forEach((part, index) => {
    const path = `parts[${index}]`;
    collect(() => {
      if (typeof part !== 'string' || part.trim() === '') {
        throw new TemplateError(
          "A compound's parts are component names, such as 'DialogTrigger'",
          path
        );
      }
      if (part === componentName) {
        throw new TemplateError(
          `'${part}' lists itself as one of its own parts`,
          path
        );
      }
      if (seen.has(part)) {
        throw new TemplateError(`'${part}' is listed twice in parts`, path);
      }
      seen.add(part);
    });
  });
}

/**
 * Records each `imports` entry that does not parse as a TypeScript module
 * (see {@link importsEntryParseFailure}), at its path. The targets write an
 * entry as it is, so one that does not parse would break every component
 * file it lands in. Entries that are not strings are left to the shape
 * checks.
 */
function validateImportsParse(imports: unknown, path: string): void {
  if (!Array.isArray(imports)) {
    return;
  }
  // An override's entries land in its own target alone.
  const target = /^extensions\.([^.]+)\./.exec(path)?.[1];
  const writer = target === undefined ? 'every target' : `the ${target} target`;
  imports.forEach((entry: unknown, index) => {
    if (typeof entry !== 'string') {
      return;
    }
    const failure = importsEntryParseFailure(entry);
    if (failure !== undefined) {
      collect(() => {
        throw new TemplateError(
          `This imports entry does not parse: ${failure}; ${writer} writes it as it is, so fix the entry`,
          `${path}[${index}]`
        );
      });
    }
  });
}

/** The fields every component-level extension override shares, by kind. */
const OVERRIDE_TEXT_FIELDS = ['script', 'style'] as const;
const OVERRIDE_STRATEGY_FIELDS = [
  'scriptStrategy',
  'importsStrategy',
  'styleStrategy',
  'propsStrategy',
] as const;

/**
 * Validates each component-level extension override: an object whose shared
 * fields have their shapes - `script` and `style` strings, `imports` an
 * array of strings, each strategy `'merge'` or `'replace'` and `props` a
 * props record (see {@link validateProps}). A malformed one would otherwise
 * fail the target's render with no path. Every key's override is checked,
 * whether or not its extension is in the build, as the shared props are;
 * the blocks an extension of the build declares inside its override
 * (`Extension.overrideBlocks`) are checked the same way.
 */
function validateComponentOverrides(
  template: ComponentNode,
  buildExtensions: readonly Extension[]
): void {
  const extensions: unknown = template.extensions;
  if (!isRecord(extensions)) {
    return;
  }
  for (const [extensionKey, override] of Object.entries(extensions)) {
    if (override === undefined) {
      continue;
    }
    if (extensionKey === 'html') {
      collect(() => {
        throw new TemplateError(HTML_BLOCK_MESSAGE, 'extensions.html');
      });
      continue;
    }
    checkComponentOverride(override, `extensions.${extensionKey}`);
  }
  for (const { block, path } of overrideBlocksOf(template, buildExtensions)) {
    checkComponentOverride(block, path);
  }
}

/**
 * Validates one component-level override block against the shared override
 * shape - an object whose `script` and `style` are strings, `imports` an
 * array of strings, each strategy `'merge'` or `'replace'` and `props` a
 * props record - throwing a `TemplateError` that reports every violation
 * with its path. Template validation checks each extension's block this way,
 * and each block an extension declares inside its override
 * (`Extension.overrideBlocks`); an extension rendering such a block calls it
 * too.
 *
 * @param override - The override block.
 * @param path - The block's path, such as `extensions.example.compact`.
 *
 * @example
 * validateComponentOverride({ script: 42 }, 'extensions.example.compact');
 * // throws: An override's script must be a string; got number 42 (at extensions.example.compact.script)
 */
export function validateComponentOverride(
  override: unknown,
  path: string
): void {
  const outer = recorded;
  const errors: TemplateErrorDetail[] = [];
  recorded = errors;
  try {
    checkComponentOverride(override, path);
  } finally {
    recorded = outer;
  }
  if (errors.length > 0) {
    throwTemplateErrors(errors, 'validation');
  }
}

/** Records each violation of the shared override shape; see {@link validateComponentOverride}. */
function checkComponentOverride(override: unknown, path: string): void {
  if (!isRecord(override)) {
    collect(() => {
      throw new TemplateError(
        `A component's extension override must be an object; got ${describeValue(override)}`,
        path
      );
    });
    return;
  }
  for (const field of OVERRIDE_TEXT_FIELDS) {
    const value = override[field];
    if (value !== undefined && typeof value !== 'string') {
      collect(() => {
        throw new TemplateError(
          `An override's ${field} must be a string; got ${describeValue(value)}`,
          `${path}.${field}`
        );
      });
    }
  }
  const imports = override.imports;
  if (imports !== undefined) {
    if (!Array.isArray(imports)) {
      collect(() => {
        throw new TemplateError(
          `An override's imports must be an array of strings; got ${describeValue(imports)}`,
          `${path}.imports`
        );
      });
    } else {
      imports.forEach((line: unknown, index) => {
        if (typeof line !== 'string') {
          collect(() => {
            throw new TemplateError(
              `An override's imports must be an array of strings; got ${describeValue(line)}`,
              `${path}.imports[${index}]`
            );
          });
        }
      });
      validateImportsParse(imports, `${path}.imports`);
    }
  }
  for (const field of OVERRIDE_STRATEGY_FIELDS) {
    const value = override[field];
    if (value !== undefined && value !== 'merge' && value !== 'replace') {
      collect(() => {
        throw new TemplateError(
          `An override's ${field} must be 'merge' or 'replace'; got ${typeof value === 'string' ? `'${value}'` : describeValue(value)}`,
          `${path}.${field}`
        );
      });
    }
  }
  validateProps(override.props, `${path}.props`);
}

/**
 * Validates the cross-node surface-contract rules the JSON Schema cannot
 * express (like conditional branch sequencing): the `passthrough` rules and
 * the root-only rule for a component-valued dynamic tag, both carrying the offending node's path.
 */
function validateSurfaceContract(
  template: Template,
  scope: ValidationScope
): void {
  const isArray = Array.isArray(template);
  const rootChildren = isArray ? template : template.children;

  const passthroughs: Array<{ node: ElementNode; path: string }> = [];
  const slots: Array<{ name: string; path: string }> = [];
  const dynamicTags: Array<{ node: ElementNode; path: string }> = [];
  collectSurfaceNodes(
    rootChildren,
    isArray ? '' : 'children',
    passthroughs,
    slots,
    dynamicTags
  );
  const slotNames = slots.map((slot) => slot.name);

  const rendered = rootChildren.filter((child) => child.type !== 'comment');
  validateDynamicTag(dynamicTags, rendered);
  validateRepeatedSlots(rootChildren, isArray ? '' : 'children');
  collect(() =>
    validatePassthrough(template, rootChildren, passthroughs, slotNames)
  );
  if (!isArray && template.rest !== undefined) {
    collect(() =>
      validateRest(template, rootChildren, passthroughs, slotNames)
    );
  }
  if (!isArray && template.typeParameters !== undefined) {
    validateTypeParameters(template);
  }
  collect(() =>
    validateRouting(
      template,
      rootChildren,
      isArray ? '' : 'children',
      passthroughs
    )
  );
  validateGeneratedBindings(
    template,
    rootChildren,
    slots,
    passthroughs.length > 0,
    scope
  );
  if (!isArray) {
    validateTwoWayBindings(template, passthroughs.length > 0, scope);
    if (template.derived !== undefined) {
      validateDerived(template, passthroughs.length > 0, scope);
    }
    if (template.ids !== undefined) {
      validateIds(template, passthroughs.length > 0, scope);
    }
  }
}

/**
 * The scripts a component carries, each with its path: the component
 * `script`, each extension override's `script` and those of the blocks an
 * extension of the build declares inside its override.
 */
function componentScripts(
  template: ComponentNode,
  extensions: readonly Extension[]
): Array<{ script: string; path: string }> {
  const scripts: Array<{ script: unknown; path: string }> = [
    { script: template.script, path: 'script' },
    ...Object.entries(template.extensions ?? {}).map(
      ([extensionKey, override]) => ({
        script: isRecord(override) ? override.script : undefined,
        path: `extensions.${extensionKey}.script`,
      })
    ),
  ];
  for (const { block, path } of overrideBlocksOf(template, extensions)) {
    if (isRecord(block)) {
      scripts.push({ script: block.script, path: `${path}.script` });
    }
  }
  return scripts.filter(
    (entry): entry is { script: string; path: string } =>
      typeof entry.script === 'string'
  );
}

/**
 * Every expression a component's nodes hold, each with its path: an event's
 * handler (an element override's and a fragment wrapper's events included),
 * a bound value (`$expression`, a `$spread`) anywhere in an element's
 * attributes, conditional attributes, dynamic tag or overrides or a fragment
 * wrapper's attributes, a conditional
 * attribute's and a branch's condition, a text node's `expression`, an
 * iteration's `items` and `key`, and each value a slot exposes.
 */
function templateExpressions(
  template: ComponentNode
): Array<{ expression: string; path: string }> {
  const expressions: Array<{ expression: string; path: string }> = [];
  const add = (expression: unknown, path: string): void => {
    if (typeof expression === 'string') {
      expressions.push({ expression, path });
    }
  };
  // Each bound value inside an attribute-like value, however deep.
  const addBindings = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => addBindings(entry, `${path}[${index}]`));
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, entry] of Object.entries(value)) {
      const entryPath = `${path}.${key}`;
      if (key === '$expression' || (key === '$spread' && !isRecord(entry))) {
        add(entry, entryPath);
      } else {
        addBindings(entry, entryPath);
      }
    }
  };
  const addEvents = (events: unknown, path: string): void => {
    if (!Array.isArray(events)) return;
    events.forEach((event, index) => {
      if (isRecord(event)) add(event.handler, `${path}[${index}].handler`);
    });
  };
  // An element override's, or a fragment wrapper's, events and attributes.
  const addOverrides = (extensions: unknown, path: string): void => {
    for (const [key, override] of Object.entries(
      isRecord(extensions) ? extensions : {}
    )) {
      if (!isRecord(override)) continue;
      const overridePath = `${path}.extensions.${key}`;
      addEvents(override.events, `${overridePath}.events`);
      addBindings(override.attributes, `${overridePath}.attributes`);
    }
  };
  visitNodes(template.children, 'children', (node, path) => {
    switch (node.type) {
      case 'element': {
        addBindings(node.tag, `${path}.tag`);
        addBindings(node.attributes, `${path}.attributes`);
        addEvents(node.events, `${path}.events`);
        node.conditionalAttributes?.forEach((entry, index) => {
          if (!isRecord(entry)) return;
          const entryPath = `${path}.conditionalAttributes[${index}]`;
          add(entry.condition, `${entryPath}.condition`);
          addBindings(entry.attributes, `${entryPath}.attributes`);
        });
        addOverrides(node.extensions, path);
        break;
      }
      case 'fragment':
        addOverrides(node.extensions, path);
        break;
      case 'text':
        add(node.expression, `${path}.expression`);
        break;
      case 'conditional':
        node.conditions.forEach((branch, index) => {
          if (isRecord(branch)) {
            add(branch.condition, `${path}.conditions[${index}].condition`);
          }
        });
        break;
      case 'iteration':
        add(node.items, `${path}.items`);
        add(node.key, `${path}.key`);
        break;
      case 'slot':
        for (const [name, exposed] of Object.entries(node.exposes ?? {})) {
          add(
            isRecord(exposed) ? exposed.value : exposed,
            `${path}.exposes.${name}${isRecord(exposed) ? '.value' : ''}`
          );
        }
        break;
      default:
        break;
    }
  });
  return expressions;
}

/**
 * Validates a component's derived values: each name an identifier not
 * starting with `$`, each expression a non-empty string, and no derived
 * value on a discriminated surface root. No prop or its alias, slot (by name
 * or prop name), two-way name, generated binding, local binding, top-level
 * script or `imports` declaration takes a derived name, nor a name a target
 * of the build imports for derived values, `rest` where the component has
 * leftover attributes, or a passthrough root's `className`, `style`, `ref`
 * or `element`. An expression is one expression, with no top-level comma or semicolon; it writes no
 * prop, two-way value or derived value, and reads no name only a script
 * declares, no two-way setter or generated two-way name, and no derived
 * value declared after it - reported as a cycle when that value reads back
 * to it, a template literal's placeholders included. No script writes a
 * free derived name.
 */
function validateDerived(
  template: ComponentNode,
  passthrough: boolean,
  scope: ValidationScope
): void {
  if (!isRecord(template.derived)) {
    // The shape check reports a `derived` that is not an object.
    return;
  }
  const entries = Object.entries(template.derived as Record<string, unknown>);
  const order = new Map(entries.map(([name], index) => [name, index]));
  const wellFormed: Array<{ name: string; expression: string }> = [];
  for (const [name, expression] of entries) {
    const path = `derived.${name}`;
    if (!isBindableName(name) || name.startsWith('$')) {
      collect(() => {
        throw new TemplateError(
          `A derived value's name is an identifier not starting with '$'; got '${name}'`,
          path
        );
      });
      continue;
    }
    if (typeof expression !== 'string' || expression.trim() === '') {
      collect(() => {
        throw new TemplateError(
          `The derived value '${name}' is an expression, a non-empty string; got ${describeValue(expression)}`,
          path
        );
      });
      continue;
    }
    wellFormed.push({ name, expression });
  }
  if (discriminatedSurfaceOf(template.children) !== undefined) {
    collect(() => {
      throw new TemplateError(
        "A discriminated surface root declares no derived values: its React props are read per branch; inline it in each branch's expressions or keep it in a script override",
        'derived'
      );
    });
    return;
  }

  const {
    props,
    taken,
    declared,
    currents,
    setters,
    generatedTwoWay,
    moduleNames,
    scripts,
    scriptNames,
    reserved,
  } = componentNames(template, passthrough, scope);
  // What the targets import for the derived values.
  for (const { name, description, when } of reserved) {
    if (when === 'derived' && !taken.has(name)) taken.set(name, description);
  }
  const localBindings: Array<{ name: string; path: string }> = [];
  collectBindings(template.children, 'children', localBindings);
  for (const { name, path } of localBindings) {
    if (order.has(name)) {
      collect(() => {
        throw new TemplateError(
          `The binding '${name}' would shadow the derived value '${name}'; rename the binding`,
          path
        );
      });
    }
  }
  for (const { name } of wellFormed) {
    const owner = taken.get(name) ?? reservedBindingOf(reserved, name);
    if (owner !== undefined) {
      collect(() => {
        throw new TemplateError(
          `The derived value '${name}' takes the name of ${owner}; give the derived value its own name`,
          `derived.${name}`
        );
      });
    }
  }

  // What each expression reads freely, a template literal's placeholders
  // included.
  const reads = new Map<string, string[]>();
  const writable = new Map<string, string>();
  for (const name of [...declared, ...currents, ...order.keys()]) {
    writable.set(name, name);
  }
  for (const { name, expression } of wellFormed) {
    const tokens = flattenTemplateLiterals(tokenizeExpression(expression));
    // One expression, the same in every target: a top-level comma or
    // semicolon would be a sequence in one target and a statement in
    // another.
    let depth = 0;
    for (const token of tokens) {
      if (token.kind !== 'punctuator') continue;
      if ('([{'.includes(token.text)) depth += 1;
      else if (')]}'.includes(token.text)) depth -= 1;
      else if (depth === 0 && (token.text === ',' || token.text === ';')) {
        collect(() => {
          throw new TemplateError(
            `The derived value '${name}' has a top-level '${token.text}'; a derived value is one expression, so ${token.text === ';' ? 'drop the semicolon' : 'wrap a sequence in a helper declared in imports'}`,
            `derived.${name}`
          );
        });
        break;
      }
    }
    // An expression only reads: it writes no prop, two-way value or derived
    // value.
    for (const written of writtenNames(expression, writable)) {
      collect(() => {
        throw new TemplateError(
          `The derived value '${name}' writes '${written}'; a derived value only reads what it is computed from`,
          `derived.${name}`
        );
      });
    }
    const readings = readExpressionIdentifiers(tokens);
    const names: string[] = [];
    tokens.forEach((token, index) => {
      if (readings.get(index)?.free === true && !names.includes(token.text)) {
        names.push(token.text);
      }
    });
    reads.set(name, names);
  }
  // A path of reads from one derived value to another, if there is one.
  const pathBetween = (
    from: string,
    to: string,
    seen = new Set<string>()
  ): string[] | undefined => {
    for (const read of reads.get(from) ?? []) {
      if (!order.has(read) || seen.has(read)) continue;
      if (read === to) return [from, to];
      seen.add(read);
      const rest = pathBetween(read, to, seen);
      if (rest !== undefined) return [from, ...rest];
    }
    return undefined;
  };
  const propNames = new Set(declared);
  for (const { name } of wellFormed) {
    const index = order.get(name)!;
    for (const read of reads.get(name) ?? []) {
      const readIndex = order.get(read);
      const path = `derived.${name}`;
      if (readIndex !== undefined && readIndex >= index) {
        const cycle = pathBetween(read, name);
        collect(() => {
          throw new TemplateError(
            cycle !== undefined || read === name
              ? `The derived value '${name}' reads itself through ${(read === name ? [name, name] : [name, ...cycle!]).join(' -> ')}; a derived value reads only those declared before it, so break the cycle`
              : `The derived value '${name}' reads '${read}', which is declared after it; declare '${read}' first`,
            path
          );
        });
        continue;
      }
      if (generatedTwoWay.has(read)) {
        collect(() => {
          throw new TemplateError(
            `The derived value '${name}' reads '${read}', ${generatedTwoWay.get(read)}, which one target generates for itself; read the two-way value instead`,
            path
          );
        });
        continue;
      }
      if (setters.has(read)) {
        collect(() => {
          throw new TemplateError(
            `The derived value '${name}' reads '${read}', the setter of the two-way prop '${setters.get(read)}'; a derived value only reads, so compute it from the value`,
            path
          );
        });
        continue;
      }
      if (
        scriptNames.has(read) &&
        readIndex === undefined &&
        !propNames.has(read) &&
        !currents.has(read) &&
        !moduleNames.has(read)
      ) {
        collect(() => {
          throw new TemplateError(
            `The derived value '${name}' reads '${read}', which only the component script declares; a derived value reads props, two-way values, declared ids, derived values declared before it and imports, so declare '${read}' in imports when it is a pure helper or constant, in ids when it is a generated id (ids: { ${read}: 'prefix' }), or keep '${name}' in the script when '${read}' is per instance, such as a value read from a context`,
            path
          );
        });
      }
    }
  }

  // No script writes a derived value.
  const derivedNames = new Map(
    wellFormed.map(({ name }) => [name, name] as [string, string])
  );
  for (const { script, path } of scripts) {
    const declaredInScript = scriptDeclarations(script);
    for (const name of writtenNames(script, derivedNames).filter(
      (written) => !declaredInScript.has(written)
    )) {
      collect(() => {
        throw new TemplateError(
          `'${name}' is a derived value, computed from its expression; no script writes it, so change what it reads instead`,
          path
        );
      });
    }
  }
  // Nor does a handler or any other template expression.
  for (const { expression, path } of templateExpressions(template)) {
    for (const name of writtenNames(expression, derivedNames)) {
      collect(() => {
        throw new TemplateError(
          `'${name}' is a derived value, computed from its expression; no handler or other expression writes it, so change what it reads instead`,
          path
        );
      });
    }
  }
}

/**
 * Validates a component's declared ids (rule 32): each name an identifier not
 * starting with `$`, each value a prefix or `{ prefix, prop }` with no other
 * key; a prefix a literal string of letters, digits, `-` and `_` starting
 * with a letter, and no two ids sharing one, since every id of an instance
 * is its prefix and the instance's one generated id; a `prop` a declared
 * shared prop typed `string`, not two-way. No prop or its alias, slot,
 * two-way name, generated binding, derived value, `slotScope` entry or
 * iteration local, top-level declaration of a script or of the `imports`
 * lines (an override's included), `rest`, a passthrough root's own local
 * nor a name a target of the build imports beside the ids takes an id
 * name, and none of those takes `generatedId` or `nextGeneratedId`, which
 * the targets declare and nothing reads. No script or expression writes an
 * id, and a discriminated surface root declares none.
 */
function validateIds(
  template: ComponentNode,
  passthrough: boolean,
  scope: ValidationScope
): void {
  if (!isRecord(template.ids)) {
    // The shape check reports an `ids` that is not an object.
    return;
  }
  const entries = Object.entries(template.ids as Record<string, unknown>);
  const props = isRecord(template.props) ? template.props : {};
  const wellFormed: string[] = [];
  const prefixes = new Map<string, string>();
  for (const [name, definition] of entries) {
    const path = `ids.${name}`;
    if (!isBindableName(name) || name.startsWith('$')) {
      collect(() => {
        throw new TemplateError(
          `An id's name is an identifier not starting with '$'; got '${name}'`,
          path
        );
      });
      continue;
    }
    wellFormed.push(name);
    const objectForm = isRecord(definition);
    if (!objectForm && typeof definition !== 'string') {
      collect(() => {
        throw new TemplateError(
          `The id '${name}' is a prefix or { prefix, prop }; got ${describeValue(definition)}`,
          path
        );
      });
      continue;
    }
    if (objectForm) {
      for (const key of Object.keys(definition)) {
        if (key !== 'prefix' && key !== 'prop') {
          collect(() => {
            throw new TemplateError(
              `The id '${name}' takes 'prefix' and 'prop'; '${key}' is not one of them`,
              `${path}.${key}`
            );
          });
        }
      }
    }
    const prefix: unknown = objectForm ? definition.prefix : definition;
    const prefixPath = objectForm ? `${path}.prefix` : path;
    if (typeof prefix !== 'string' || !ID_PREFIX_PATTERN.test(prefix)) {
      collect(() => {
        throw new TemplateError(
          prefix === ''
            ? `The id '${name}' has an empty prefix; give it the literal start of the id, such as '${name.replace(/Id$/, '') || 'id'}'`
            : `The id '${name}' has the prefix ${typeof prefix === 'string' ? `'${prefix}'` : describeValue(prefix)}; a prefix is a literal string of letters, digits, '-' and '_', starting with a letter, the same in every target`,
          prefixPath
        );
      });
    } else if (prefixes.has(prefix)) {
      collect(() => {
        throw new TemplateError(
          `The ids '${prefixes.get(prefix)}' and '${name}' share the prefix '${prefix}'; each id of an instance is its prefix and the instance's one generated id, so give each its own prefix`,
          prefixPath
        );
      });
    } else {
      prefixes.set(prefix, name);
    }
    if (objectForm && definition.prop !== undefined) {
      const prop = definition.prop;
      const propPath = `${path}.prop`;
      const propDefinition = typeof prop === 'string' ? props[prop] : undefined;
      if (typeof prop !== 'string' || !isRecord(propDefinition)) {
        collect(() => {
          throw new TemplateError(
            `The id '${name}' names the prop ${typeof prop === 'string' ? `'${prop}'` : describeValue(prop)}, which the component does not declare; declare it in props as a string, such as ${typeof prop === 'string' ? prop : 'id'}: { type: 'string' }`,
            propPath
          );
        });
      } else if (!isStringType(propDefinition.type)) {
        collect(() => {
          throw new TemplateError(
            `The id '${name}' names the prop '${prop}', typed ${typeof propDefinition.type === 'string' ? `'${propDefinition.type}'` : describeValue(propDefinition.type)}; the consumer's value replaces the generated id, so the prop is a string`,
            propPath
          );
        });
      } else if (isBindableDefinition(propDefinition.bindable)) {
        collect(() => {
          throw new TemplateError(
            `The id '${name}' names the two-way prop '${prop}'; its value is the component's own copy when the consumer leaves it out, which the targets start differently, so name a plain string prop`,
            propPath
          );
        });
      }
    }
  }
  if (discriminatedSurfaceOf(template.children) !== undefined) {
    collect(() => {
      throw new TemplateError(
        'A discriminated surface root declares no ids: its React props are read per branch; declare the ids in a component it renders',
        'ids'
      );
    });
    return;
  }

  const { taken, scripts, reserved } = componentNames(
    template,
    passthrough,
    scope
  );
  const derivedNames = isRecord(template.derived)
    ? Object.keys(template.derived)
    : [];
  for (const name of derivedNames) {
    if (!taken.has(name)) taken.set(name, `the derived value '${name}'`);
  }
  // The declarations of each override's imports lines, which share the
  // component's module scope in their target.
  for (const { lines, path } of overrideImports(template, scope.extensions)) {
    for (const name of topLevelDeclarations(lines.join('\n'))) {
      if (!taken.has(name)) taken.set(name, `a declaration in ${path}`);
    }
  }
  // The targets declare the instance's generated id, and a target without a
  // per-instance id of its own a counter function, so nothing else may.
  for (const reserved of [GENERATED_ID_NAME, GENERATED_ID_NEXT_NAME]) {
    const owner = taken.get(reserved);
    if (owner !== undefined) {
      collect(() => {
        throw new TemplateError(
          `'${reserved}' is ${owner}, but a component with ids declares '${reserved}' itself; rename it`,
          'ids'
        );
      });
    }
  }
  // What the targets import beside the ids.
  for (const { name, description, when } of reserved) {
    if (when === 'ids' && !taken.has(name)) taken.set(name, description);
  }
  const idNames = new Set(wellFormed);
  for (const name of wellFormed) {
    const owner =
      taken.get(name) ??
      reservedBindingOf(reserved, name) ??
      (name === GENERATED_ID_NAME || name === GENERATED_ID_NEXT_NAME
        ? 'a name the ids generate'
        : undefined);
    if (owner !== undefined) {
      collect(() => {
        throw new TemplateError(
          `The id '${name}' takes the name of ${owner}; give the id its own name`,
          `ids.${name}`
        );
      });
    }
  }
  const localBindings: Array<{ name: string; path: string }> = [];
  collectBindings(template.children, 'children', localBindings);
  for (const { name, path } of localBindings) {
    if (idNames.has(name)) {
      collect(() => {
        throw new TemplateError(
          `The binding '${name}' would shadow the id '${name}'; rename the binding`,
          path
        );
      });
    } else if (name === GENERATED_ID_NAME || name === GENERATED_ID_NEXT_NAME) {
      collect(() => {
        throw new TemplateError(
          `The binding '${name}' takes a name a component with ids declares itself; rename the binding`,
          path
        );
      });
    }
  }

  // The generated id is each target's own, and unset at rest, so nothing
  // reads it: an id reads it for the template.
  const generatedIds = new Set([GENERATED_ID_NAME, GENERATED_ID_NEXT_NAME]);
  const reads: Array<{ code: string; path: string }> = [
    ...scripts.map(({ script, path }) => ({ code: script, path })),
    ...templateExpressions(template).map(({ expression, path }) => ({
      code: expression,
      path,
    })),
    ...derivedNames.flatMap((name) => {
      const expression = (template.derived as Record<string, unknown>)[name];
      return typeof expression === 'string'
        ? [{ code: expression, path: `derived.${name}` }]
        : [];
    }),
  ];
  for (const { code, path } of reads) {
    const tokens = flattenTemplateLiterals(tokenizeExpression(code));
    const reported = new Set<string>();
    for (const [index, reading] of readExpressionIdentifiers(tokens)) {
      const name = tokens[index].text;
      if (reading.free && generatedIds.has(name) && !reported.has(name)) {
        reported.add(name);
        collect(() => {
          throw new TemplateError(
            `'${name}' is the id each target generates for itself, unset in the html target; read a declared id instead`,
            path
          );
        });
      }
    }
  }

  // An id is the same through the instance's life: nothing writes it.
  const writable = new Map(
    wellFormed.map((name) => [name, name] as [string, string])
  );
  for (const { script, path } of scripts) {
    const declaredInScript = scriptDeclarations(script);
    for (const name of writtenNames(script, writable).filter(
      (written) => !declaredInScript.has(written)
    )) {
      collect(() => {
        throw new TemplateError(
          `'${name}' is an id, generated once per instance; no script writes it`,
          path
        );
      });
    }
  }
  for (const { expression, path } of templateExpressions(template)) {
    for (const name of writtenNames(expression, writable)) {
      collect(() => {
        throw new TemplateError(
          `'${name}' is an id, generated once per instance; no handler or other expression writes it`,
          path
        );
      });
    }
  }
}

/**
 * The `imports` lines of each component-level override, each with its
 * path: every extension's, and those of the blocks an extension of the
 * build declares inside its override.
 */
function overrideImports(
  template: ComponentNode,
  extensions: readonly Extension[]
): Array<{ lines: string[]; path: string }> {
  const found: Array<{ lines: string[]; path: string }> = [];
  const add = (imports: unknown, path: string): void => {
    if (Array.isArray(imports)) {
      found.push({
        lines: imports.filter(
          (line): line is string => typeof line === 'string'
        ),
        path,
      });
    }
  };
  for (const [key, override] of Object.entries(template.extensions ?? {})) {
    if (!isRecord(override)) continue;
    add(override.imports, `extensions.${key}.imports`);
    for (const { block, path } of overrideBlocksOf(template, extensions, key)) {
      if (isRecord(block)) {
        add(block.imports, `${path}.imports`);
      }
    }
  }
  return found;
}

/** Whether a prop type is a string: `string`, alone or with `undefined`. */
function isStringType(type: unknown): boolean {
  if (typeof type !== 'string') return false;
  const members = type.split('|').map((member) => member.trim());
  return (
    members.includes('string') &&
    members.every((member) => member === 'string' || member === 'undefined')
  );
}

/** The names a component takes already, and the parts they come from. */
interface ComponentNames {
  props: Record<string, unknown>;
  /** Each name taken, with what takes it, for an error message. */
  taken: Map<string, string>;
  /** Every declared prop name: shared, an override's and a branch's. */
  declared: string[];
  /** Each two-way value's name (a copy's `current`, a relay's `given`). */
  currents: Set<string>;
  /** Each two-way value's name with the function that writes it (a copy's `setter`, a relay's `report`). */
  setters: Map<string, string>;
  /** The names a target generates for a two-way value, with what each is. */
  generatedTwoWay: Map<string, string>;
  /** The top-level declarations of the `imports` lines. */
  moduleNames: Set<string>;
  /** The component's scripts, each with its path. */
  scripts: Array<{ script: string; path: string }>;
  /** The top-level declarations of every script. */
  scriptNames: Set<string>;
  /**
   * The names reserved in the component, the two-way names included
   * ({@link resolveReservedNames}).
   */
  reserved: ReservedName[];
}

/**
 * The names a component takes already, each with what takes it: every prop
 * and its alias, the slots (by name and prop name), each two-way value's
 * names, the names a target of the build generates for them, `rest` where
 * the component has leftover attributes, a passthrough root's own locals,
 * and the top-level declarations of the `imports` lines and every script.
 */
function componentNames(
  template: ComponentNode,
  passthrough: boolean,
  scope: ValidationScope
): ComponentNames {
  const props = isRecord(template.props) ? template.props : {};
  // The names the component takes already, each with what takes it.
  const taken = new Map<string, string>();
  const take = (name: string, description: string): void => {
    if (!taken.has(name)) taken.set(name, description);
  };
  const declared: string[] = Object.keys(props);
  for (const override of Object.values(template.extensions ?? {})) {
    if (isRecord(override) && isRecord(override.props)) {
      declared.push(...Object.keys(override.props));
    }
  }
  template.children.forEach((node) => {
    if (node.type === 'conditional') {
      for (const branch of node.conditions) {
        declared.push(...Object.keys(branch.props ?? {}));
      }
    }
  });
  const aliases = propAliases(declared, {
    ...template,
    reservedNames: reservedBindingNames(reservedNamesIn(scope)),
  });
  for (const name of declared) {
    take(name, `the prop '${name}'`);
    const alias = aliases.get(name);
    if (alias !== undefined) {
      take(alias, `the local name of the prop '${name}'`);
    }
  }
  visitNodes(template.children, 'children', (node) => {
    if (node.type !== 'slot') return;
    if (node.name === undefined) {
      take('children', 'the default slot');
    } else {
      take(node.name, `the slot '${node.name}'`);
      take(normalizeSlotName(node.name), `the slot '${node.name}'`);
    }
  });
  // Each two-way value's current, setter and generated names.
  const currents = new Set<string>();
  const setters = new Map<string, string>();
  // The names a target generates for a two-way value, which an expression
  // does not read: each is one target's own (a ref, an emit function).
  const generatedTwoWay = new Map<string, string>();
  const twoWayProps: Array<{ name: string; local: string; relayed: boolean }> =
    [];
  for (const [prop, definition] of Object.entries(props)) {
    if (!isRecord(definition) || !isBindableDefinition(definition.bindable)) {
      continue;
    }
    const local = aliases.get(prop) ?? prop;
    const relayed = isRelayedBindableDefinition(definition.bindable);
    const { current, setter, given, report } =
      definition.bindable as unknown as Record<string, unknown>;
    const valueName = relayed ? given : current;
    const functionName = relayed ? report : setter;
    if (typeof valueName === 'string') {
      currents.add(valueName);
      take(
        valueName,
        relayed
          ? `the given value of the relayed prop '${prop}'`
          : `the value of the two-way prop '${prop}'`
      );
    }
    if (typeof functionName === 'string') {
      setters.set(functionName, prop);
      take(
        functionName,
        relayed
          ? `the report function of the relayed prop '${prop}'`
          : `the setter of the two-way prop '${prop}'`
      );
    }
    if (!relayed) {
      const ownName = ownValueName(local);
      const ownDescription = `the component's own copy of '${prop}'`;
      take(ownName, ownDescription);
      generatedTwoWay.set(ownName, ownDescription);
    }
    twoWayProps.push({ name: prop, local, relayed });
  }
  const reserved = reservedNamesIn(scope, twoWayProps);
  if (twoWayProps.length > 0) {
    for (const { name, description, when, readable } of reserved) {
      if (when !== 'twoWay') continue;
      take(name, description);
      if (readable === false && !generatedTwoWay.has(name)) {
        generatedTwoWay.set(name, description);
      }
    }
  }
  if (template.rest !== undefined || passthrough) {
    take(REST_NAME, "the component's leftover attributes");
  }
  if (passthrough) {
    for (const name of ['className', 'style', 'ref', 'element']) {
      take(name, "a passthrough root's own local");
    }
  }
  const moduleNames = topLevelDeclarations(
    (Array.isArray(template.imports) ? template.imports : [])
      .filter((line): line is string => typeof line === 'string')
      .join('\n')
  );
  for (const name of moduleNames) {
    take(name, 'a declaration in imports');
  }
  const scripts = componentScripts(template, scope.extensions);
  const scriptNames = new Set<string>();
  for (const { script, path } of scripts) {
    for (const name of scriptDeclarations(script)) {
      scriptNames.add(name);
      take(name, `a declaration in ${path}`);
    }
  }
  return {
    props,
    taken,
    declared,
    currents,
    setters,
    generatedTwoWay,
    moduleNames,
    scripts,
    scriptNames,
    reserved,
  };
}

/**
 * Whether a generated two-way name's path is one the author chose: a
 * binding's `current`, `setter`, `given` or `report`.
 */
function isChosenBindingPath(path: string): boolean {
  return /\.(current|setter|given|report)$/.test(path);
}

/** A name a component's two-way props have the scripted targets declare. */
interface TwoWayName {
  name: string;
  /** What declares it, for an error message. */
  description: string;
  /** Where the name is given, for an error naming it. */
  path: string;
}

/**
 * The names a well-formed `bindable` object gives the value and the function
 * that writes it: a copy's `current` and `setter`, a relay's `given` and
 * `report`; `undefined` for a malformed object.
 */
function bindingNamesOf(
  bindable: unknown
): { value: string; writer: string; relayed: boolean } | undefined {
  if (!isBindableDefinition(bindable)) {
    return undefined;
  }
  const relayed = isRelayedBindableDefinition(bindable);
  const { current, setter, given, report } = bindable as unknown as Record<
    string,
    unknown
  >;
  if (relayed && (current !== undefined || setter !== undefined)) {
    return undefined;
  }
  const value = relayed ? given : current;
  const writer = relayed ? report : setter;
  return typeof value === 'string' &&
    typeof writer === 'string' &&
    isBindableName(value) &&
    isBindableName(writer) &&
    !value.startsWith('$') &&
    !writer.startsWith('$') &&
    value !== writer
    ? { value, writer, relayed }
    : undefined;
}

/**
 * The component's two-way props whose `bindable` object is well formed, of
 * either form: a binding whose own fields are malformed is reported by its
 * prop, and the whole-component rules read the well-formed ones.
 */
function wellFormedBindings(
  template: ComponentNode
): Array<[string, PropDefinition]> {
  const props = isRecord(template.props) ? template.props : {};
  return Object.entries(props).filter(
    ([, definition]) =>
      isRecord(definition) && bindingNamesOf(definition.bindable) !== undefined
  ) as Array<[string, PropDefinition]>;
}

/**
 * Validates a component's two-way props (`bindable` objects, of either
 * form) against the whole component: each `defaultProp` names a declared
 * prop that is not a function, each `changeProp` a declared event prop (a
 * function returning `void`), neither the two-way prop itself, another
 * two-way prop or a prop another binding names; a two-way prop with a
 * `defaultProp` sets no `default` of its own. The names generated for the
 * bindings - each binding's `current` and `setter` or `given` and `report`,
 * a copy's own copy (`own<Prop>`), and the names a target of the build
 * declares beside them (`reservedNames` with `when: 'twoWay'`) - are taken
 * by no prop (or its alias), slot, local binding, generated binding or
 * other generated name, and declared by no component script or script
 * override (an override's blocks included); the value's and the function's
 * names are not `rest` where the component has leftover attributes, nor a
 * passthrough root's `className`, `style`, `ref` or `element`. No script
 * or expression writes a value's name; the function writes it.
 */
function validateTwoWayBindings(
  template: ComponentNode,
  passthrough: boolean,
  scope: ValidationScope
): void {
  const props = isRecord(template.props) ? template.props : {};
  const bindings = wellFormedBindings(template);
  if (bindings.length === 0) {
    return;
  }

  // The props each binding names.
  const named = new Map<string, string>();
  for (const [prop, definition] of bindings) {
    const bindable = definition.bindable as unknown as Record<string, unknown>;
    const path = `props.${prop}.bindable`;
    for (const field of ['defaultProp', 'changeProp'] as const) {
      const target = bindable[field];
      if (typeof target !== 'string' || target.trim() === '') {
        continue;
      }
      collect(() => {
        const targetDefinition = props[target];
        if (!isRecord(targetDefinition)) {
          throw new TemplateError(
            `The two-way prop '${prop}' names '${target}' as its ${field}, which the component's props do not declare`,
            `${path}.${field}`
          );
        }
        if (target === prop) {
          throw new TemplateError(
            `The two-way prop '${prop}' names itself as its ${field}`,
            `${path}.${field}`
          );
        }
        if (isBindableDefinition(targetDefinition.bindable)) {
          throw new TemplateError(
            `The two-way prop '${prop}' names '${target}' as its ${field}, which is a two-way prop of its own`,
            `${path}.${field}`
          );
        }
        const earlier = named.get(target);
        if (earlier !== undefined) {
          throw new TemplateError(
            `The two-way prop '${prop}' names '${target}' as its ${field}, which ${earlier} names already`,
            `${path}.${field}`
          );
        }
        named.set(target, `'${prop}'`);
        const type =
          typeof targetDefinition.type === 'string'
            ? targetDefinition.type
            : '';
        if (field === 'changeProp' && !isEventType(type)) {
          throw new TemplateError(
            `The two-way prop '${prop}' names '${target}' as its changeProp, which must be an event, a function returning void such as (${prop}: ${definition.type}) => void; its type is ${type}`,
            `${path}.${field}`
          );
        }
        if (field === 'defaultProp' && isFunctionType(type)) {
          throw new TemplateError(
            `The two-way prop '${prop}' names '${target}' as its defaultProp, which is a function; the default prop holds the value the component starts from`,
            `${path}.${field}`
          );
        }
        if (
          field === 'defaultProp' &&
          typeof definition.type === 'string' &&
          !defaultTypeMatches(definition.type, type)
        ) {
          throw new TemplateError(
            `The two-way prop '${prop}' names '${target}' as its defaultProp, whose type, ${type}, is not the two-way prop's type, ${definition.type}; the default prop seeds the two-way value, so it declares the same type (optionally with '| undefined')`,
            `${path}.${field}`
          );
        }
      });
    }
    if (
      typeof bindable.defaultProp === 'string' &&
      definition.default !== undefined
    ) {
      collect(() => {
        throw new TemplateError(
          `The two-way prop '${prop}' sets a default and names '${bindable.defaultProp}' as its defaultProp, which seeds it; give the default to '${bindable.defaultProp}'`,
          `props.${prop}.default`
        );
      });
    }
  }

  // Every prop name the component declares, with where it is declared.
  const declared: Array<{ name: string; path: string }> = Object.keys(
    props
  ).map((name) => ({ name, path: `props.${name}` }));
  for (const [extensionKey, override] of Object.entries(
    template.extensions ?? {}
  )) {
    const overrideProps = isRecord(override) ? override.props : undefined;
    if (isRecord(overrideProps)) {
      for (const name of Object.keys(overrideProps)) {
        declared.push({
          name,
          path: `extensions.${extensionKey}.props.${name}`,
        });
      }
    }
  }
  template.children.forEach((node, index) => {
    if (node.type !== 'conditional') {
      return;
    }
    node.conditions.forEach((branch, branchIndex) => {
      for (const name of Object.keys(branch.props ?? {})) {
        declared.push({
          name,
          path: `children[${index}].conditions[${branchIndex}].props.${name}`,
        });
      }
    });
  });
  const bindingNames = reservedNamesIn(scope);
  const aliases = propAliases(
    declared.map(({ name }) => name),
    { ...template, reservedNames: reservedBindingNames(bindingNames) }
  );

  // The names the targets generate for the bindings.
  const generated: TwoWayName[] = [];
  // Each two-way value's writer (a setter or a report function), by the
  // value's name.
  const setters = new Map<string, string>();
  for (const [prop, definition] of bindings) {
    const names = bindingNamesOf(definition.bindable)!;
    const path = `props.${prop}.bindable`;
    const local = aliases.get(prop) ?? prop;
    setters.set(names.value, names.writer);
    if (names.relayed) {
      generated.push(
        {
          name: names.value,
          description: `the given value of the relayed prop '${prop}'`,
          path: `${path}.given`,
        },
        {
          name: names.writer,
          description: `the report function of the relayed prop '${prop}'`,
          path: `${path}.report`,
        }
      );
      continue;
    }
    generated.push(
      {
        name: names.value,
        description: `the value of the two-way prop '${prop}'`,
        path: `${path}.current`,
      },
      {
        name: names.writer,
        description: `the setter of the two-way prop '${prop}'`,
        path: `${path}.setter`,
      },
      {
        name: ownValueName(local),
        description: `the component's own copy of the two-way prop '${prop}'`,
        path: `props.${prop}`,
      }
    );
  }
  // The names the build's targets declare beside the bindings: a name two
  // targets declare for the same reason (the same prop, or the bindings as
  // a whole) is listed once, so only a real clash is reported.
  const targetNames = new Set<string>();
  for (const { name, description, when, path } of reservedNamesIn(
    scope,
    bindings.map(([prop, definition]) => ({
      name: prop,
      local: aliases.get(prop) ?? prop,
      relayed: bindingNamesOf(definition.bindable)!.relayed,
    }))
  )) {
    const at = path ?? 'props';
    if (when !== 'twoWay' || targetNames.has(`${name} ${at}`)) continue;
    targetNames.add(`${name} ${at}`);
    generated.push({ name, description, path: at });
  }

  const byName = new Map<string, TwoWayName>();
  for (const entry of generated) {
    const first = byName.get(entry.name);
    if (first !== undefined) {
      collect(() => {
        throw new TemplateError(
          `The name '${entry.name}' is ${entry.description} and ${first.description}; give each its own name`,
          isChosenBindingPath(entry.path) ? entry.path : first.path
        );
      });
      continue;
    }
    byName.set(entry.name, entry);
    // A name the user chose that a target declares for another reason: a
    // generated binding, the leftover attributes, or a passthrough local.
    if (isChosenBindingPath(entry.path)) {
      const other =
        reservedBindingOf(bindingNames, entry.name) ??
        ((template.rest !== undefined || passthrough) && entry.name === 'rest'
          ? "the component's leftover attributes"
          : passthrough &&
              ['className', 'style', 'ref', 'element'].includes(entry.name)
            ? "a passthrough root's own local"
            : undefined);
      if (other !== undefined) {
        collect(() => {
          throw new TemplateError(
            `The name '${entry.name}' is ${entry.description} and ${other}, which the generated component declares itself; choose another`,
            entry.path
          );
        });
      }
    }
  }

  const clash = (name: string): TwoWayName | undefined => byName.get(name);
  for (const { name, path } of declared) {
    for (const local of new Set([name, aliases.get(name) ?? name])) {
      const entry = clash(local);
      if (entry !== undefined) {
        collect(() => {
          throw new TemplateError(
            `The prop '${name}' ${local === name ? 'takes' : `is read as '${local}',`} the name of ${entry.description}, which the generated component declares itself; rename one`,
            path
          );
        });
      }
    }
  }
  visitNodes(template.children, 'children', (node, path) => {
    if (node.type !== 'slot') {
      return;
    }
    const slotNames =
      node.name === undefined
        ? ['children']
        : [node.name, normalizeSlotName(node.name)];
    for (const name of new Set(slotNames)) {
      const entry = clash(name);
      if (entry !== undefined) {
        collect(() => {
          throw new TemplateError(
            `The slot '${node.name ?? '(default)'}' takes the name '${name}' of ${entry.description}, which the generated component declares itself; rename one`,
            path
          );
        });
      }
    }
  });
  const localBindings: Array<{ name: string; path: string }> = [];
  collectBindings(template.children, 'children', localBindings);
  for (const { name, path } of localBindings) {
    const entry = clash(name);
    if (entry !== undefined) {
      collect(() => {
        throw new TemplateError(
          `The binding '${name}' would shadow ${entry.description}, which the generated component declares itself; rename the binding`,
          path
        );
      });
    }
  }

  for (const { script, path } of componentScripts(template, scope.extensions)) {
    for (const name of scriptDeclarations(script)) {
      const entry = clash(name);
      if (entry !== undefined) {
        collect(() => {
          throw new TemplateError(
            `The script declares '${name}', the name of ${entry.description}, which the generated component declares itself; remove the script's declaration or rename the binding`,
            path
          );
        });
      }
    }
    // A name the script declares is reported as a declaration already.
    const declaredInScript = scriptDeclarations(script);
    for (const name of writtenNames(script, setters).filter(
      (written) => !declaredInScript.has(written)
    )) {
      collect(() => {
        throw new TemplateError(
          `'${name}' is the two-way value; write it through '${setters.get(name)}'`,
          path
        );
      });
    }
  }
  // A handler or any other template expression changes the value through
  // the setter or the report function too.
  for (const { expression, path } of templateExpressions(template)) {
    for (const name of writtenNames(expression, setters)) {
      collect(() => {
        throw new TemplateError(
          `'${name}' is the two-way value; write it through '${setters.get(name)}'`,
          path
        );
      });
    }
  }
}

/**
 * Validates a component's type parameters: each name an identifier, used
 * once, and neither the component's name nor its props type's, which the
 * parameter would shadow in the emitted signature. A parameter with a
 * default is not followed by one without, as TypeScript requires.
 */
function validateTypeParameters(template: ComponentNode): void {
  const seen = new Set<string>();
  let defaulted: string | undefined;
  template.typeParameters!.forEach((parameter, index) =>
    collect(() => {
      const path = `typeParameters[${index}]`;
      const name = typeof parameter === 'string' ? parameter : parameter?.name;
      if (typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) {
        throw new TemplateError(
          `A type parameter's name must be an identifier; '${String(name)}' is not one`,
          path
        );
      }
      if (seen.has(name)) {
        throw new TemplateError(
          `The type parameter '${name}' is declared more than once`,
          path
        );
      }
      seen.add(name);
      if (name === template.name || name === `${template.name}Props`) {
        throw new TemplateError(
          `A type parameter named '${name}' would shadow the component's own type`,
          path
        );
      }
      const hasDefault =
        typeof parameter !== 'string' && parameter.default !== undefined;
      if (hasDefault) {
        defaulted = name;
      } else if (defaulted !== undefined) {
        throw new TemplateError(
          `The type parameter '${name}' has no default but follows '${defaulted}', which has one`,
          path
        );
      }
    })
  );
}

/** The value a `rest` declaration gathers the leftover attributes into. */
const REST_NAME = 'rest';

/**
 * Validates a component's `rest` declaration: an intrinsic `tag`, no
 * `passthrough` root beside it (a discriminated surface included), and no
 * prop, slot, scoped-slot binding or iteration binding named `rest`, which
 * would shadow the value where the author spreads it.
 */
function validateRest(
  template: ComponentNode,
  rootChildren: readonly TemplateNode[],
  passthroughs: Array<{ node: ElementNode; path: string }>,
  slotNames: string[]
): void {
  const tag = template.rest!.tag;
  if (typeof tag !== 'string' || !/^[a-z][a-z0-9-]*$/.test(tag)) {
    throw new TemplateError(
      `A rest declaration requires an intrinsic HTML tag; '${String(tag)}' is not one`,
      'rest.tag'
    );
  }
  if (passthroughs.length > 0) {
    throw new TemplateError(
      'A component declaring rest cannot also have a passthrough root; the two are alternatives',
      passthroughs[0].path
    );
  }
  if (Object.keys(template.props ?? {}).includes(REST_NAME)) {
    throw new TemplateError(
      `A component declaring rest must not declare a prop named '${REST_NAME}'`,
      `props.${REST_NAME}`
    );
  }
  if (slotNames.includes(REST_NAME)) {
    throw new TemplateError(
      `A component declaring rest must not declare a slot named '${REST_NAME}'`
    );
  }
  const bindings: Array<{ name: string; path: string }> = [];
  collectBindings(rootChildren, 'children', bindings);
  const shadowing = bindings.find((binding) => binding.name === REST_NAME);
  if (shadowing !== undefined) {
    throw new TemplateError(
      `A slot scope or iteration binding named '${REST_NAME}' would shadow the component's rest attributes`,
      shadowing.path
    );
  }
}

/**
 * Collects every name a template binds locally: each `slotScope` entry (on a
 * node or a named-slot projection) and each iteration `item` and `index`.
 */
function collectBindings(
  nodes: readonly TemplateNode[],
  path: string,
  into: Array<{ name: string; path: string }>
): void {
  nodes.forEach((node, index) => {
    const nodePath = `${path}[${index}]`;
    switch (node.type) {
      case 'element':
        for (const name of node.slotScope ?? []) {
          into.push({ name, path: `${nodePath}.slotScope` });
        }
        if (node.children) {
          collectBindings(node.children, `${nodePath}.children`, into);
        }
        for (const named of normalizeNamedSlots(node.slots)) {
          for (const name of named.slotScope) {
            into.push({
              name,
              path: `${nodePath}.slots.${named.name}.slotScope`,
            });
          }
          collectBindings(
            named.content,
            `${nodePath}.slots.${named.name}`,
            into
          );
        }
        break;
      case 'iteration':
        into.push({ name: node.item, path: `${nodePath}.item` });
        if (node.index !== undefined) {
          into.push({ name: node.index, path: `${nodePath}.index` });
        }
        collectBindings(node.children, `${nodePath}.children`, into);
        break;
      case 'fragment':
        collectBindings(node.children, `${nodePath}.children`, into);
        break;
      case 'slot':
        if (node.fallback) {
          collectBindings(node.fallback, `${nodePath}.fallback`, into);
        }
        break;
      case 'conditional':
        node.conditions.forEach((branch, branchIndex) => {
          collectBindings(
            branch.children,
            `${nodePath}.conditions[${branchIndex}].children`,
            into
          );
        });
        break;
      default:
        break;
    }
  });
}

/**
 * Validates that no name the template binds takes one the generated
 * component declares itself in its scope (`bem`, the build's targets'
 * `reservedNames`), which would declare it twice or shadow it: the declared
 * props (shared, a discriminated branch's, and a component extension
 * override's), the slots (by name and by the camel-cased prop name a slot
 * takes), each `slotScope` entry and each iteration `item` and `index`. A
 * name reserved for an event modifier counts only where an event uses it.
 * On a passthrough component a prop or slot named `rest` is rejected too,
 * since the consumer's leftover props are gathered under it.
 */
function validateGeneratedBindings(
  template: Template,
  rootChildren: readonly TemplateNode[],
  slots: Array<{ name: string; path: string }>,
  passthrough: boolean,
  scope: ValidationScope
): void {
  const reserved = reservedNamesIn(scope);
  const eventModifiers = new Set<string>();
  visitNodes(rootChildren, '', (node) => {
    if (node.type !== 'element' && node.type !== 'fragment') {
      return;
    }
    const eventLists = [
      node.type === 'element' ? node.events : undefined,
      ...Object.values(node.extensions ?? {}).map((override) =>
        typeof override === 'object' && override !== null
          ? (override as { events?: unknown }).events
          : undefined
      ),
    ];
    for (const events of eventLists) {
      if (!Array.isArray(events)) {
        continue;
      }
      for (const event of events) {
        const modifiers: unknown = event?.modifiers;
        if (Array.isArray(modifiers)) {
          for (const modifier of modifiers) {
            eventModifiers.add(String(modifier));
          }
        }
      }
    }
  });
  const clash = (name: string): string | undefined => {
    const generated = reservedBindingOf(reserved, name, eventModifiers);
    if (generated !== undefined) {
      return generated;
    }
    return passthrough && name === REST_NAME
      ? "the consumer's leftover props React gathers on a passthrough component"
      : undefined;
  };
  const props: Array<{ name: string; path: string }> = [];
  if (!Array.isArray(template)) {
    for (const name of Object.keys(template.props ?? {})) {
      props.push({ name, path: `props.${name}` });
    }
    for (const [extensionKey, override] of Object.entries(
      template.extensions ?? {}
    )) {
      const overrideProps =
        typeof override === 'object' && override !== null
          ? (override as { props?: unknown }).props
          : undefined;
      if (typeof overrideProps === 'object' && overrideProps !== null) {
        for (const name of Object.keys(overrideProps)) {
          props.push({
            name,
            path: `extensions.${extensionKey}.props.${name}`,
          });
        }
      }
    }
  }
  const rootPath = Array.isArray(template) ? '' : 'children';
  rootChildren.forEach((node, index) => {
    if (node.type !== 'conditional') {
      return;
    }
    node.conditions.forEach((branch, branchIndex) => {
      for (const name of Object.keys(branch.props ?? {})) {
        props.push({
          name,
          path: `${rootPath}[${index}].conditions[${branchIndex}].props.${name}`,
        });
      }
    });
  });
  for (const { name, path } of props) {
    const generated = clash(name);
    if (generated !== undefined) {
      collect(() => {
        throw new TemplateError(
          `The prop '${name}' takes the name of ${generated}, which the generated component declares itself; rename the prop`,
          path
        );
      });
    }
  }
  for (const { name, path } of slots) {
    const generated = clash(name) ?? clash(normalizeSlotName(name));
    if (generated !== undefined) {
      collect(() => {
        throw new TemplateError(
          `The slot '${name}' takes the name of ${generated}, which the generated component declares itself; rename the slot`,
          path
        );
      });
    }
  }
  const bindings: Array<{ name: string; path: string }> = [];
  collectBindings(rootChildren, rootPath, bindings);
  for (const { name, path } of bindings) {
    const generated = reservedBindingOf(reserved, name, eventModifiers);
    if (generated !== undefined) {
      collect(() => {
        throw new TemplateError(
          `The binding '${name}' would shadow ${generated}, which the generated component declares itself; rename the binding`,
          path
        );
      });
    }
  }
}

/**
 * Validates where a dynamic `tag` may declare `componentValued`: only on the
 * component's single root rendered element (the sole non-comment top-level
 * child). A string-valued dynamic tag is allowed on any element; a component
 * value needs the root's hoisted binding, which cannot see a loop's or a
 * scoped slot's locals.
 */
function validateDynamicTag(
  dynamicTags: Array<{ node: ElementNode; path: string }>,
  rendered: readonly TemplateNode[]
): void {
  for (const { node, path } of dynamicTags) {
    const isRoot = rendered.length === 1 && rendered[0] === node;
    if (
      !isRoot &&
      isDynamicTag(node.tag) &&
      node.tag.componentValued === true
    ) {
      collect(() => {
        throw new TemplateError(
          "A component-valued dynamic tag is allowed only on the component's single root rendered element",
          path
        );
      });
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

  const reserved = new Set(RESERVED_PASSTHROUGH_PROPS);
  const sharedProps = Array.isArray(template)
    ? []
    : Object.keys(template.props ?? {});

  // A discriminated surface root: a single root conditional whose every branch
  // is a passthrough element. Multiple passthroughs are legal here, so this
  // case is handled before the single-root rules below.
  const surface = discriminatedSurfaceOf(rootChildren);
  if (surface !== undefined) {
    const branchElements = new Set(
      surface.branches.map((entry) => entry.element)
    );
    for (const { node, path } of passthroughs) {
      if (!branchElements.has(node)) {
        throw new TemplateError(
          "A passthrough element must be the component's single root rendered element, or a branch root of its discriminated surface root",
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
    }

    const branchProps = surface.branches.flatMap((entry) =>
      Object.keys(entry.branch.props ?? {})
    );
    const surfacePath = passthroughs[0].path;
    for (const propName of [...sharedProps, ...branchProps]) {
      if (reserved.has(propName)) {
        throw new TemplateError(
          `A passthrough component must not declare the reserved prop '${propName}'; the surface contract owns ${RESERVED_PASSTHROUGH_PROPS.join(', ')}`,
          surfacePath
        );
      }
    }
    for (const slotName of slotNames) {
      if (reserved.has(slotName)) {
        throw new TemplateError(
          `A passthrough component must not declare a slot named '${slotName}'; the surface contract reserves ${RESERVED_PASSTHROUGH_PROPS.join(', ')}`,
          surfacePath
        );
      }
    }
    validateDiscriminants(
      surface,
      sharedProps,
      surfacePath.replace(/\.conditions\[\d+\]\.children\[\d+\]$/, '')
    );
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
  const conditional = conditionalPassthroughOf(rootChildren);
  if (conditional === undefined) {
    validateConditionalPassthroughShape(rendered, node, path);
  }
  if (
    conditional === undefined &&
    (rendered.length !== 1 || rendered[0] !== node)
  ) {
    throw new TemplateError(
      "A passthrough element must be the component's single root rendered element",
      path
    );
  }
  if (conditional !== undefined) {
    const rootPath = Array.isArray(template) ? '' : 'children';
    const rootIndex = rootChildren.indexOf(conditional.conditional);
    conditional.conditional.conditions.forEach((branch, index) => {
      if (branch.props !== undefined) {
        throw new TemplateError(
          "A conditional passthrough root's branch cannot declare props; branch props type the branches of a discriminated surface root. Declare the props among the component's own",
          `${rootPath}[${rootIndex}].conditions[${index}].props`
        );
      }
    });
  }
  const tagName = staticTagOf(node.tag);
  if (!/^[a-z]/.test(tagName)) {
    throw new TemplateError(
      `A passthrough element requires an intrinsic HTML tag; '${tagName}' is a component reference`,
      path
    );
  }

  for (const propName of sharedProps) {
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
 * Explains a passthrough element that sits as a branch root of the
 * component's single root conditional when that conditional is neither a
 * discriminated surface root nor a conditional passthrough root, so the
 * author learns which of the two shapes to write. Does nothing for any other
 * misplaced passthrough, which the single-root error reports.
 */
function validateConditionalPassthroughShape(
  rendered: readonly TemplateNode[],
  node: ElementNode,
  path: string
): void {
  if (rendered.length !== 1 || rendered[0].type !== 'conditional') {
    return;
  }
  const { conditions } = rendered[0];
  const holder = conditions.findIndex((branch) =>
    branch.children.includes(node)
  );
  if (holder === -1) {
    return;
  }
  if (holder > 0) {
    throw new TemplateError(
      "A conditional passthrough root renders its passthrough element in the 'if' branch; write the condition so that branch is the one that shows it",
      path
    );
  }
  if (
    conditions[0].children.filter((child) => child.type !== 'comment')
      .length !== 1
  ) {
    throw new TemplateError(
      "A conditional passthrough root's 'if' branch must render the passthrough element alone; put a companion inside the element",
      path
    );
  }
  throw new TemplateError(
    "A conditional passthrough root takes at most one more branch, an 'else' that renders nothing; for a branch that renders another element, make every branch render a passthrough element (a discriminated surface root)",
    path
  );
}

/**
 * Validates where a passthrough routing object may sit: on one
 * element, with an intrinsic static tag, below the component's single,
 * static-tag passthrough root, in a component without `rest`. A name the
 * component declares may be listed: it never reaches the consumer's
 * attributes, so it is skipped, as under the wildcards.
 */
function validateRouting(
  template: Template,
  rootChildren: readonly TemplateNode[],
  rootPath: string,
  passthroughs: Array<{ node: ElementNode; path: string }>
): void {
  const routed: Array<{ node: ElementNode; path: string }> = [];
  visitNodes(rootChildren, rootPath, (node, path) => {
    if (node.type === 'element' && isPassthroughRouting(node.passthrough)) {
      routed.push({ node, path });
    }
  });
  if (routed.length === 0) {
    return;
  }
  const first = routed[0];
  const rendered = rootChildren.filter((child) => child.type !== 'comment');
  if (rendered.length === 1 && rendered[0] === first.node) {
    throw new TemplateError(
      "passthrough: { attributes } routes the root's attributes to an element below it; the root itself sets passthrough: true",
      `${first.path}.passthrough`
    );
  }
  if (!Array.isArray(template) && template.rest !== undefined) {
    throw new TemplateError(
      'passthrough: { attributes } routes the attributes of a passthrough root, and a component declaring rest has none; spread rest where the attributes land instead',
      `${first.path}.passthrough`
    );
  }
  if (discriminatedSurfaceOf(rootChildren) !== undefined) {
    throw new TemplateError(
      'passthrough: { attributes } is not supported under a discriminated surface root',
      `${first.path}.passthrough`
    );
  }
  const root = passthroughs.length === 1 ? passthroughs[0] : undefined;
  if (conditionalPassthroughOf(rootChildren) !== undefined) {
    throw new TemplateError(
      'passthrough: { attributes } is not supported under a conditional passthrough root',
      `${first.path}.passthrough`
    );
  }
  if (
    root === undefined ||
    rendered.length !== 1 ||
    rendered[0] !== root.node
  ) {
    throw new TemplateError(
      'passthrough: { attributes } routes the attributes of a passthrough root to an element below it, and this component has no passthrough root',
      `${first.path}.passthrough`
    );
  }
  if (isDynamicTag(root.node.tag)) {
    throw new TemplateError(
      'passthrough: { attributes } is not supported below a passthrough root with a dynamic tag',
      `${first.path}.passthrough`
    );
  }
  if (!first.path.startsWith(`${root.path}.`)) {
    throw new TemplateError(
      "passthrough: { attributes } must sit on an element below the component's passthrough root",
      `${first.path}.passthrough`
    );
  }
  if (routed.length > 1) {
    throw new TemplateError(
      'At most one element per component may route passthrough attributes',
      `${routed[1].path}.passthrough`
    );
  }
  if (typeof first.node.tag !== 'string') {
    throw new TemplateError(
      'An element routing passthrough attributes requires a static tag, not a dynamic one',
      `${first.path}.tag`
    );
  }
  if (!/^[a-z]/.test(first.node.tag)) {
    throw new TemplateError(
      `An element routing passthrough attributes requires an intrinsic HTML tag; '${first.node.tag}' is a component reference`,
      `${first.path}.tag`
    );
  }
  if (
    isPassthroughRouting(first.node.passthrough) &&
    first.node.passthrough.handle === 'routed' &&
    isInsideIteration(rootChildren, first.node)
  ) {
    throw new TemplateError(
      "handle: 'routed' moves the DOM handle to one element, and this element renders once per item of an iteration; keep the handle on the root",
      `${first.path}.passthrough.handle`
    );
  }
}

/**
 * Validates a discriminated surface root's discriminants. Each `if`/`else-if`
 * condition is declared in branch props, not among the shared props, and is
 * one of two kinds:
 *
 * - a **literal** discriminant: the bare prop name, declared in every branch,
 *   typed as truthy literals (`true`) in the branch it picks and as falsy
 *   literals (`false`) in every branch after it;
 * - a **presence** discriminant: `<name> !== undefined`; the branch it picks
 *   requires the prop with a type that holds no `undefined`, `null` or
 *   boolean member, and every other branch leaves it out or types it
 *   `undefined`.
 *
 * Anything else - a bare name of a prop not typed as literals, a loose
 * `!= null` test, a compound condition, a shared discriminant, a literal a
 * later branch could also satisfy, a presence test that can't tell the
 * branches apart - cannot narrow the union, so a branch's `ref` and native
 * attributes would not type-check against its element.
 */
function validateDiscriminants(
  surface: DiscriminatedSurface,
  sharedProps: readonly string[],
  conditionalPath: string
): void {
  surface.branches.forEach(({ branch }, index) => {
    if (branch.statement === 'else') {
      return;
    }
    const path = `${conditionalPath}.conditions[${index}]`;
    const condition = (branch.condition ?? '').trim();
    const discriminant = discriminantOf(branch);
    const looseNull = LOOSE_NULL_CONDITION.exec(condition);
    const name =
      discriminant?.name ??
      looseNull?.[1] ??
      (BARE_IDENTIFIER.test(condition) ? condition : undefined);
    if (name === undefined) {
      throw new TemplateError(
        `A discriminated surface root's condition must be the bare name of a prop typed as literals, or '<prop> !== undefined'; '${condition}' is neither`,
        path
      );
    }
    if (sharedProps.includes(name)) {
      throw new TemplateError(
        `The discriminant '${name}' must be declared in each branch's props, not in the component's shared props`,
        path
      );
    }
    const own = branch.props?.[name];
    if (own === undefined) {
      throw new TemplateError(
        `The discriminant '${name}' must be declared in the props of the branch it picks`,
        path
      );
    }

    if (discriminant === undefined) {
      if (looseNull !== null) {
        // The checks `name !== undefined` would face come first, so the
        // advice below leads to a template that validates.
        if (!hasBooleanMember(own.type)) {
          validatePresenceDiscriminant(surface, index, name, own, path);
        }
        throw new TemplateError(
          `The discriminated surface root's condition '${condition}' is a loose null test, which no discriminant accepts: presence is written '${name} !== undefined', the test every target renders; ${discriminantAdvice(name, own.type, 'loose-null')}`,
          path
        );
      }
      throw new TemplateError(
        `The discriminated surface root's condition '${name}' tests a prop typed '${own.type}', which ${
          isLiteralUnion(own.type)
            ? 'has a falsy literal member'
            : 'is not a literal type'
        }: an empty, zero or false value would pick a later branch, and React's props union cannot narrow on it; ${discriminantAdvice(name, own.type, 'bare')}`,
        path
      );
    }

    if (discriminant.kind === 'literal') {
      surface.branches.forEach((entry, entryIndex) => {
        const definition = entry.branch.props?.[name];
        if (definition === undefined) {
          throw new TemplateError(
            `Every branch of a discriminated surface root must declare the discriminant '${name}' in its props`,
            path
          );
        }
        if (entryIndex > index && !isFalsyLiteralType(definition.type)) {
          throw new TemplateError(
            isTruthyLiteralType(definition.type)
              ? `The literal discriminant '${name}' picks more than one branch, typed '${own.type}' in one and '${definition.type}' in a later one, and a truthiness test cannot tell them apart; give each branch a boolean discriminant of its own, typed 'true' in that branch and 'false' in the branches after it`
              : `The literal discriminant '${name}' must be typed as falsy literals (such as 'false') in the branches after the one it picks; '${definition.type}' does not narrow`,
            path
          );
        }
      });
      return;
    }

    validatePresenceDiscriminant(surface, index, name, own, path);
  });
}

const BARE_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const LOOSE_NULL_CONDITION = /^([A-Za-z_$][\w$]*)\s*!=\s*null$/;

/**
 * Validates a presence discriminant `<name> !== undefined` picking the branch
 * at `index`: the branch requires the prop with a type holding no boolean,
 * `undefined` or `null` member, and every other branch leaves it out or
 * types it `undefined`.
 */
function validatePresenceDiscriminant(
  surface: DiscriminatedSurface,
  index: number,
  name: string,
  own: PropDefinition,
  path: string
): void {
  if (hasBooleanMember(own.type)) {
    throw new TemplateError(
      `The presence discriminant '${name}' is typed '${own.type}', which has a boolean member; Vue casts a boolean prop that is left out to false, so the test would always pick this branch. Write the bare name '${name}' and type it 'true' in this branch and 'false' in the branches after it`,
      path
    );
  }
  if (own.required !== true) {
    throw new TemplateError(
      `The presence discriminant '${name}' must be required in the branch it picks`,
      path
    );
  }
  if (
    unionMembersOf(own.type).some(
      (member) => member === 'undefined' || member === 'null'
    )
  ) {
    throw new TemplateError(
      `The presence discriminant '${name}' must be typed without 'undefined' or 'null' in the branch it picks; '${own.type}' is not`,
      path
    );
  }
  surface.branches.forEach((entry, entryIndex) => {
    const definition = entry.branch.props?.[name];
    if (
      entryIndex !== index &&
      definition !== undefined &&
      unionMembersOf(definition.type).some((member) => member !== 'undefined')
    ) {
      throw new TemplateError(
        `The presence discriminant '${name}' may be declared only in the branch it picks; another branch leaves it out or types it 'undefined', not '${definition.type}'`,
        path
      );
    }
  });
}

/** Whether every member of a prop type is a truthy or falsy literal. */
function isLiteralUnion(type: string): boolean {
  const members = unionMembersOf(type);
  return (
    members.length > 0 &&
    members.every(
      (member) => isTruthyLiteralType(member) || isFalsyLiteralType(member)
    )
  );
}

/**
 * The suggestion an unnarrowable discriminant condition ends with, tailored
 * to the prop's type: a type with a boolean member gets literal `true` /
 * `false` typing only (a presence test on it is an error, since Vue casts a
 * left-out boolean prop to `false`); a literal union with a falsy member
 * gets dropping that member; any other type gets `<name> !== undefined` or
 * literal `true` / `false` typing.
 *
 * @param name - The prop the condition reads.
 * @param type - The prop's type in the branch the condition picks.
 * @param form - Whether the condition is a bare name or a loose `!= null`.
 */
function discriminantAdvice(
  name: string,
  type: string,
  form: 'bare' | 'loose-null'
): string {
  const literalTyping = `type '${name}' as 'true' in this branch and 'false' in the branches after it`;
  if (hasBooleanMember(type)) {
    return form === 'bare'
      ? literalTyping
      : `write the bare name '${name}' and ${literalTyping}`;
  }
  if (form === 'bare' && isLiteralUnion(type)) {
    const falsy = unionMembersOf(type)
      .filter((member) => isFalsyLiteralType(member))
      .join(', ');
    return `drop ${falsy} from its type in this branch, so it is typed as truthy literals only and the branches after it type it as falsy ones`;
  }
  return `write '${name} !== undefined' to pick this branch by whether the prop is given, or ${literalTyping}`;
}

/**
 * Collects every `passthrough`-flagged element, every dynamic-tag element
 * (each with its node path), and every named slot (each with its node path) in document order, walking
 * the same node shapes as validation.
 */
function collectSurfaceNodes(
  nodes: readonly TemplateNode[],
  path: string,
  passthroughs: Array<{ node: ElementNode; path: string }>,
  slots: Array<{ name: string; path: string }>,
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
          collectSurfaceNodes(
            node.children,
            `${nodePath}.children`,
            passthroughs,
            slots,
            dynamicTags
          );
        }
        for (const named of normalizeNamedSlots(node.slots)) {
          collectSurfaceNodes(
            named.content,
            `${nodePath}.slots.${named.name}`,
            passthroughs,
            slots,
            dynamicTags
          );
        }
        break;
      case 'fragment':
      case 'iteration':
        collectSurfaceNodes(
          node.children,
          `${nodePath}.children`,
          passthroughs,
          slots,
          dynamicTags
        );
        break;
      case 'slot':
        if (node.name !== undefined) {
          slots.push({ name: node.name, path: nodePath });
        }
        if (node.fallback) {
          collectSurfaceNodes(
            node.fallback,
            `${nodePath}.fallback`,
            passthroughs,
            slots,
            dynamicTags
          );
        }
        break;
      case 'conditional':
        node.conditions.forEach((branch, branchIndex) => {
          collectSurfaceNodes(
            branch.children,
            `${nodePath}.conditions[${branchIndex}].children`,
            passthroughs,
            slots,
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

  // A malformed field is reported here; a later check of this node that
  // cannot read it is then dropped by the caller's collect.
  if (node.type !== 'component') {
    recordShape(node, node.type, path);
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
      validateFragmentOverrides(node, path);
      validateChildren(node.children, `${path}.children`, context);
      break;
    case 'slot':
      if (node.name === 'default') {
        collect(() => {
          throw new TemplateError(
            "A slot cannot be named 'default'; omit 'name' for the default slot",
            `${path}.name`
          );
        });
      }
      if (context.insideSlotFallback) {
        collect(() => {
          throw new TemplateError(
            'Slot fallbacks must not contain slot nodes',
            path
          );
        });
      }
      if (node.exposes !== undefined) {
        collect(() => validateExposes(node.exposes, `${path}.exposes`));
      }
      // A malformed `exposes` has its own error.
      if (
        node.scopeRequired === true &&
        (node.exposes === undefined ||
          (isRecord(node.exposes) && !hasExposedValues(node.exposes)))
      ) {
        collect(() => {
          throw new TemplateError(
            "'scopeRequired' needs a scope to require: give the slot 'exposes', or drop 'scopeRequired'",
            `${path}.scopeRequired`
          );
        });
      }
      if (node.fallback !== undefined) {
        validateChildren(node.fallback, `${path}.fallback`, {
          insideSlotFallback: true,
        });
      }
      break;
    case 'conditional':
      validateConditional(node, path, context);
      break;
    case 'iteration':
      validateIteration(node, path, context);
      break;
  }
}

/**
 * Validates each node of a child list, recording each one's errors and
 * going on to the next.
 */
function validateChildren(
  children: readonly TemplateNode[],
  path: string,
  context: ValidationContext
): void {
  children.forEach((child, index) => {
    collect(() => validateNode(child, `${path}[${index}]`, context));
  });
}

function validateElement(
  node: ElementNode,
  path: string,
  context: ValidationContext
): void {
  if (isDynamicTag(node.tag)) {
    const tag = node.tag;
    recordShape(tag, 'dynamicTag', `${path}.tag`);
    collect(() =>
      validateExpression(tag.$expression, `${path}.tag.$expression`)
    );
    if (typeof tag.default !== 'string' || tag.default.trim() === '') {
      collect(() => {
        throw new TemplateError(
          "A dynamic tag requires a non-empty 'default' tag",
          `${path}.tag.default`
        );
      });
    }
  }

  // `null` removes an attribute in a per-target override only; on the node
  // itself it has no meaning (the JSON Schema rejects it too).
  const nullAttributes: Array<[unknown, string]> = [
    [node.attributes, `${path}.attributes`],
    ...(Array.isArray(node.conditionalAttributes)
      ? node.conditionalAttributes
      : []
    ).map((entry, index): [unknown, string] => [
      isRecord(entry) ? entry.attributes : undefined,
      `${path}.conditionalAttributes[${index}].attributes`,
    ]),
  ];
  for (const [attributes, attributesPath] of nullAttributes) {
    if (!isRecord(attributes)) continue;
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) {
        collect(() => {
          throw new TemplateError(
            `The attribute '${name}' is null, which only a per-target attributes override takes, to remove the node's attribute in that target (extensions.react.attributes and the like); leave the attribute out instead`,
            `${attributesPath}.${name}`
          );
        });
      }
    }
  }

  validateReservedExtensionKeys(node.extensions, path);

  if (isPassthroughRouting(node.passthrough)) {
    const routing = node.passthrough;
    const routingPath = `${path}.passthrough`;
    if (!recordShape(routing, 'passthroughRouting', routingPath).malformed) {
      validateRoutingEntries(routing.attributes, `${routingPath}.attributes`);
      const handle: unknown = routing.handle;
      if (handle !== undefined && handle !== 'root' && handle !== 'routed') {
        collect(() => {
          throw new TemplateError(
            `A passthrough routing object's 'handle' is 'routed', which moves the DOM handle to this element, or 'root', the default; got ${describeValue(handle)}`,
            `${routingPath}.handle`
          );
        });
      }
    }
  }

  if (node.attributes) {
    validateAttributes(node.attributes, `${path}.attributes`, {
      expressionsAllowed: true,
    });
  }

  node.conditionalAttributes?.forEach((conditional, index) => {
    const conditionalPath = `${path}.conditionalAttributes[${index}]`;
    if (
      !isRecord(conditional) ||
      recordShape(conditional, 'conditionalAttributes', conditionalPath)
        .malformed
    ) {
      return;
    }
    collect(() => validateConditionalAttributes(conditional, conditionalPath));
  });

  if (node.events !== undefined) {
    validateEvents(node.events, `${path}.events`);
  }

  // An extension override's events render in place of the node's, so their
  // modifiers meet the same vocabulary.
  for (const [extensionKey, override] of Object.entries(
    node.extensions ?? {}
  )) {
    const events =
      typeof override === 'object' && override !== null
        ? (override as { events?: unknown }).events
        : undefined;
    if (Array.isArray(events)) {
      events.forEach((event, index) => {
        validateEventModifiers(
          (event as { modifiers?: unknown } | null)?.modifiers,
          `${path}.extensions.${extensionKey}.events[${index}].modifiers`
        );
      });
    }
  }

  const effectiveTag = staticTagOf(node.tag);
  if (VOID_ELEMENTS.has(effectiveTag) && (node.children?.length ?? 0) > 0) {
    collect(() => {
      throw new TemplateError(
        `Void element '<${effectiveTag}>' must not have children`,
        path
      );
    });
  }

  if (node.slotScope !== undefined) {
    collect(() => validateSlotScope(node, effectiveTag, path));
  }

  if (node.slots !== undefined) {
    collect(() => validateSlots(node, effectiveTag, path, context));
  }

  if (node.children !== undefined) {
    validateChildren(node.children, `${path}.children`, context);
  }
}

/**
 * Validates each event of a node's or a fragment wrapper's list: an event
 * object with a `name` and an expression `handler`, modifiers from the
 * vocabulary and at most one key modifier.
 */
function validateEvents(events: readonly unknown[], path: string): void {
  events.forEach((event, index) => {
    const eventPath = `${path}[${index}]`;
    if (!isRecord(event) || recordShape(event, 'event', eventPath).malformed) {
      return;
    }
    collect(() => validateExpression(event.handler, `${eventPath}.handler`));
    validateEventModifiers(event.modifiers, `${eventPath}.modifiers`);
    const keyModifiers = Array.isArray(event.modifiers)
      ? event.modifiers.filter(isKeyEventModifier)
      : [];
    if (keyModifiers.length > 1) {
      collect(() => {
        throw new TemplateError(
          'At most one key modifier is allowed per event definition; write multiple accepted keys as separate event entries',
          `${eventPath}.modifiers`
        );
      });
    }
  });
}

/**
 * The error for an `extensions.html` block, on any node: `html` is core's
 * own target, not an extension, so no node's `extensions` takes that name.
 */
const HTML_BLOCK_MESSAGE =
  "'html' is reserved: it names core's own HTML output, not an extension, so no node's extensions take an html block. " +
  'A wrapper only some scripted targets render is a fragment whose blocks name it, ' +
  "{ type: 'fragment', extensions: { react: { tag: 'Portal' } }, children: [...] }, " +
  'and the HTML output renders its children alone';

/** Rejects an `html` block in an element's `extensions` (see {@link HTML_BLOCK_MESSAGE}). */
function validateReservedExtensionKeys(
  extensions: unknown,
  path: string
): void {
  if (isRecord(extensions) && extensions.html !== undefined) {
    collect(() => {
      throw new TemplateError(HTML_BLOCK_MESSAGE, `${path}.extensions.html`);
    });
  }
}

/**
 * Validates a fragment's `extensions`: each block names the wrapper its
 * target renders around the fragment's children, an object with a
 * non-empty `tag`, optional `attributes` and `events`, and no other key. The
 * attributes hold no `null`, since a fragment has no attribute of its own
 * to remove, no `$spread` and no `style` (a wrapper takes a class). A void
 * `tag` takes no children. There is no `html` block.
 */
function validateFragmentOverrides(node: FragmentNode, path: string): void {
  const extensions: unknown = node.extensions;
  if (!isRecord(extensions)) {
    return;
  }
  for (const [extensionKey, override] of Object.entries(extensions)) {
    if (override === undefined) {
      continue;
    }
    const overridePath = `${path}.extensions.${extensionKey}`;
    if (extensionKey === 'html') {
      collect(() => {
        throw new TemplateError(HTML_BLOCK_MESSAGE, overridePath);
      });
      continue;
    }
    if (!isRecord(override)) {
      collect(() => {
        throw new TemplateError(
          `A fragment's ${extensionKey} block must be an object naming the wrapper that target renders, { tag: 'Portal' }; got ${describeValue(override)}`,
          overridePath
        );
      });
      continue;
    }
    if (recordShape(override, 'fragmentOverride', overridePath).malformed) {
      continue;
    }
    const { tag, attributes, events } = override;
    if (typeof tag !== 'string' || tag.trim() === '') {
      collect(() => {
        throw new TemplateError(
          `A fragment's ${extensionKey} block renders a wrapper only with a 'tag': ` +
            `name the element or component ${extensionKey} renders around the fragment's children, { tag: 'Portal' }` +
            (tag === undefined
              ? `, or drop the block for no wrapper in ${extensionKey}`
              : `; got ${describeValue(tag)}`),
          `${overridePath}.tag`
        );
      });
    } else if (VOID_ELEMENTS.has(tag) && node.children.length > 0) {
      collect(() => {
        throw new TemplateError(
          `Void element '<${tag}>' must not have children; a fragment whose ${extensionKey} wrapper is '<${tag}>' has children`,
          `${overridePath}.tag`
        );
      });
    }
    if (isRecord(attributes)) {
      const rendered: Attributes = {};
      for (const [name, value] of Object.entries(attributes)) {
        if (value === null) {
          collect(() => {
            throw new TemplateError(
              `The attribute '${name}' is null, but a fragment has no attribute of its own to remove; leave it out of the wrapper's attributes`,
              `${overridePath}.attributes.${name}`
            );
          });
        } else if (name === 'style' && value !== undefined) {
          collect(() => {
            throw new TemplateError(
              "A fragment's wrapper takes a class in its attributes, not a style: style an element inside the fragment, or give the wrapper a class the stylesheet styles",
              `${overridePath}.attributes.style`
            );
          });
        } else if (name === '$spread' && value !== undefined) {
          collect(() => {
            throw new TemplateError(
              "A fragment's wrapper takes no '$spread': spread onto an element inside the fragment instead",
              `${overridePath}.attributes.$spread`
            );
          });
        } else {
          rendered[name] = value as Attributes[string];
        }
      }
      validateAttributes(rendered, `${overridePath}.attributes`, {
        expressionsAllowed: true,
      });
    }
    if (Array.isArray(events)) {
      validateEvents(events, `${overridePath}.events`);
    }
  }
}

/**
 * Validates a passthrough routing object's `attributes`: a
 * non-empty array of distinct entries, each `'*'`, `'aria-*'`, `'on*'` or a
 * lowercase HTML attribute name that the surface contract does not keep on
 * the root.
 */
function validateRoutingEntries(entries: unknown, path: string): void {
  if (!Array.isArray(entries) || entries.length === 0) {
    collect(() => {
      throw new TemplateError(
        "A passthrough routing object requires 'attributes', a non-empty array of attribute names ('*', 'aria-*', 'on*' or HTML names such as 'required')",
        path
      );
    });
    return;
  }
  const seen = new Set<string>();
  entries.forEach((entry: unknown, index) => {
    const entryPath = `${path}[${index}]`;
    collect(() => {
      if (typeof entry !== 'string') {
        throw new TemplateError(
          `A routed attribute must be a string; got ${describeValue(entry)}`,
          entryPath
        );
      }
      if (seen.has(entry)) {
        throw new TemplateError(
          `The routed attribute '${entry}' is listed twice`,
          entryPath
        );
      }
      seen.add(entry);
      if (
        entry === ROUTE_ALL ||
        entry === ROUTE_ARIA ||
        entry === ROUTE_HANDLERS
      ) {
        return;
      }
      if (!/^[a-z][a-z0-9-]*$/.test(entry)) {
        throw new TemplateError(
          /^[A-Za-z][A-Za-z0-9-]*$/.test(entry)
            ? `The routed attribute '${entry}' must be written in its HTML spelling, '${entry.toLowerCase()}'; each target matches it in its own spelling`
            : `The routed attribute '${entry}' is not '*', 'aria-*', 'on*' or an HTML attribute name`,
          entryPath
        );
      }
      if (RESERVED_ROUTED_NAMES.includes(entry)) {
        throw new TemplateError(
          ['ref', 'element'].includes(entry)
            ? `'${entry}' cannot be routed: it is the DOM handle, which handle: 'routed' moves to this element`
            : ['class', 'classname', 'style'].includes(entry)
              ? `'${entry}' cannot be routed: the consumer's class and style stay on the passthrough root`
              : `'${entry}' cannot be routed: it is not one of the consumer's attributes`,
          entryPath
        );
      }
    });
  });
}

/**
 * Validates one `conditionalAttributes` entry: its condition, its literal
 * attributes, and a class beside any style.
 */
function validateConditionalAttributes(
  conditional: NonNullable<ElementNode['conditionalAttributes']>[number],
  conditionalPath: string
): void {
  collect(() =>
    validateExpression(conditional.condition, `${conditionalPath}.condition`)
  );
  validateAttributes(conditional.attributes, `${conditionalPath}.attributes`, {
    expressionsAllowed: false,
  });
  // A conditional style renders as the stylesheet rule of the entry's
  // first class, which the condition toggles; without a class it has no
  // selector and nothing to toggle.
  const style = conditional.attributes.style;
  if (
    typeof style === 'object' &&
    style !== null &&
    Object.keys(style).length > 0 &&
    normalizeClassList(conditional.attributes.class).length === 0
  ) {
    throw new TemplateError(
      "A conditionalAttributes style needs a class in the same entry: the style becomes that class's rule, which the condition toggles",
      `${conditionalPath}.attributes`
    );
  }
}

/**
 * Validates a slot rendered in several places (rule 15): each place exposes
 * the same signature - the same binding names, in any order, the same type
 * for a binding every place declaring one gives it, and the same
 * `scopeRequired` - since a target types the slot once. Each place keeps its
 * own expressions. A place whose `exposes` is malformed has its own error
 * and is skipped.
 */
function validateRepeatedSlots(
  nodes: readonly TemplateNode[],
  path: string
): void {
  const first = new Map<
    string | undefined,
    {
      names: string;
      types: Map<string, string>;
      scopeRequired: boolean;
      path: string;
    }
  >();
  visitNodes(nodes, path, (node, nodePath) => {
    if (node.type !== 'slot') {
      return;
    }
    if (node.exposes !== undefined && !isWellFormedExposes(node.exposes)) {
      return;
    }
    const bindings = normalizeExposes(node.exposes);
    const names = JSON.stringify(
      bindings.map((binding) => binding.name).sort()
    );
    const types = new Map(
      bindings.flatMap((binding) =>
        binding.type === undefined
          ? []
          : [[binding.name, binding.type.trim()] as const]
      )
    );
    const scopeRequired = node.scopeRequired === true;
    const earlier = first.get(node.name);
    if (earlier === undefined) {
      first.set(node.name, { names, types, scopeRequired, path: nodePath });
      return;
    }
    const label =
      node.name === undefined ? 'The default slot' : `The slot '${node.name}'`;
    const retyped = [...types].find(
      ([name, type]) =>
        earlier.types.has(name) && earlier.types.get(name) !== type
    );
    if (earlier.names !== names) {
      collect(() => {
        throw new TemplateError(
          `${label} exposes other bindings here than at ${earlier.path}; every place a slot renders exposes the same names`,
          `${nodePath}.exposes`
        );
      });
    } else if (retyped !== undefined) {
      collect(() => {
        throw new TemplateError(
          `${label} types '${retyped[0]}' as '${retyped[1]}' here and '${earlier.types.get(retyped[0])}' at ${earlier.path}; every place a slot renders gives a binding the same type`,
          `${nodePath}.exposes.${retyped[0]}.type`
        );
      });
    } else if (earlier.scopeRequired !== scopeRequired) {
      collect(() => {
        throw new TemplateError(
          `${label} sets 'scopeRequired' differently here than at ${earlier.path}; every place a slot renders sets it alike`,
          `${nodePath}.scopeRequired`
        );
      });
    }
    for (const [name, type] of types) {
      if (!earlier.types.has(name)) {
        earlier.types.set(name, type);
      }
    }
  });
}

/** Whether a slot's `exposes` is a record of valid bindings. */
function isWellFormedExposes(exposes: unknown): boolean {
  return (
    isRecord(exposes) &&
    Object.entries(exposes).every(
      ([name, binding]) =>
        IDENTIFIER_PATTERN.test(name) &&
        (typeof binding === 'string' ||
          (isRecord(binding) && typeof binding.value === 'string'))
    )
  );
}

/** Whether a slot's `exposes` names at least one value. */
function hasExposedValues(exposes: unknown): boolean {
  return (
    typeof exposes === 'object' &&
    exposes !== null &&
    !Array.isArray(exposes) &&
    Object.keys(exposes).length > 0
  );
}

/**
 * Validates the `exposes` record of a scoped slot: each key is a bare
 * identifier (the scope binding name), and each value is a non-empty
 * provider-scope expression (string shorthand or `{ value, type? }`), with an
 * optional non-empty `type` string.
 */
function validateExposes(exposes: unknown, path: string): void {
  if (
    typeof exposes !== 'object' ||
    exposes === null ||
    Array.isArray(exposes)
  ) {
    throw new TemplateError(
      "'exposes' must be a record of binding names to expressions",
      path
    );
  }
  for (const [name, binding] of Object.entries(exposes)) {
    const bindingPath = `${path}.${name}`;
    if (!IDENTIFIER_PATTERN.test(name)) {
      throw new TemplateError(
        `An 'exposes' key must be a valid identifier; '${name}' is not`,
        bindingPath
      );
    }
    if (typeof binding === 'string') {
      validateExpression(binding, bindingPath);
      continue;
    }
    if (
      typeof binding !== 'object' ||
      binding === null ||
      Array.isArray(binding)
    ) {
      throw new TemplateError(
        "An 'exposes' value must be an expression string or a { value, type? } object",
        bindingPath
      );
    }
    validateExpression(
      (binding as { value?: unknown }).value,
      `${bindingPath}.value`
    );
    const type = (binding as { type?: unknown }).type;
    if (
      type !== undefined &&
      (typeof type !== 'string' || type.trim() === '')
    ) {
      throw new TemplateError(
        "An 'exposes' type must be a non-empty string",
        `${bindingPath}.type`
      );
    }
  }
}

/**
 * Validates an event's modifiers against the supported vocabulary: a
 * modifier outside it would otherwise render as nothing in one target and
 * as an invalid directive in another.
 */
function validateEventModifiers(modifiers: unknown, path: string): void {
  if (modifiers === undefined) {
    return;
  }
  if (!Array.isArray(modifiers)) {
    collect(() => {
      throw new TemplateError('`modifiers` must be an array', path);
    });
    return;
  }
  modifiers.forEach((modifier, index) => {
    if (!isEventModifier(modifier)) {
      collect(() => {
        throw new TemplateError(
          `Unknown event modifier ${JSON.stringify(modifier)}; the supported modifiers are ${EVENT_MODIFIERS.join(', ')}. ` +
            'Guard any other key inside the handler',
          `${path}[${index}]`
        );
      });
    }
  });
}

/**
 * Validates the `slotScope` of a consuming node: allowed only on a
 * component-reference node (a capitalized tag), it must be a non-empty array
 * of binding identifiers, and the node must have children to bring into scope.
 */
function validateSlotScope(
  node: ElementNode,
  effectiveTag: string,
  path: string
): void {
  const slotScopePath = `${path}.slotScope`;
  if (/^[a-z]/.test(effectiveTag)) {
    throw new TemplateError(
      `'slotScope' is allowed only on a component-reference node; '${effectiveTag}' is an intrinsic element`,
      slotScopePath
    );
  }
  if (!Array.isArray(node.slotScope) || node.slotScope.length === 0) {
    throw new TemplateError(
      "'slotScope' must be a non-empty array of binding identifiers",
      slotScopePath
    );
  }
  node.slotScope.forEach((name, index) => {
    if (typeof name !== 'string' || !IDENTIFIER_PATTERN.test(name)) {
      throw new TemplateError(
        "Each 'slotScope' entry must be a valid identifier",
        `${slotScopePath}[${index}]`
      );
    }
  });
  if ((node.children?.length ?? 0) === 0) {
    throw new TemplateError(
      "'slotScope' requires children to bring into scope",
      slotScopePath
    );
  }
}

/**
 * Validates the `slots` map of a consuming node (named-slot projection):
 * allowed only on a component-reference node (a capitalized tag), each key a
 * non-empty slot name and each value a non-empty content array or a
 * `{ content, slotScope? }` object (content non-empty; `slotScope`, when
 * present, a non-empty array of binding identifiers). Recurses into the
 * projected content nodes.
 */
function validateSlots(
  node: ElementNode,
  effectiveTag: string,
  path: string,
  context: ValidationContext
): void {
  const slotsPath = `${path}.slots`;
  if (/^[a-z]/.test(effectiveTag)) {
    throw new TemplateError(
      `'slots' is allowed only on a component-reference node; '${effectiveTag}' is an intrinsic element`,
      slotsPath
    );
  }
  if (
    typeof node.slots !== 'object' ||
    node.slots === null ||
    Array.isArray(node.slots)
  ) {
    throw new TemplateError(
      "'slots' must be a record of slot names to projected content",
      slotsPath
    );
  }
  for (const [name, value] of Object.entries(node.slots)) {
    const slotPath = `${slotsPath}.${name}`;
    if (!Array.isArray(value) && !isRecord(value)) {
      throw new TemplateError(
        `The slot '${name}' must project an array of content nodes or a { content, slotScope? } object; got ${describeValue(value)}`,
        slotPath
      );
    }
    if (isRecord(value)) {
      recordShape(value, 'namedSlot', slotPath);
      if (value.slotScope !== undefined && !Array.isArray(value.slotScope)) {
        throw new TemplateError(
          `A named slot's 'slotScope' must be an array of binding identifiers; got ${describeValue(value.slotScope)}`,
          `${slotPath}.slotScope`
        );
      }
    }
  }
  for (const named of normalizeNamedSlots(node.slots)) {
    collect(() =>
      validateNamedSlot(named, `${slotsPath}.${named.name}`, context)
    );
  }
}

/** Validates one named slot of a `slots` map; see {@link validateSlots}. */
function validateNamedSlot(
  named: ReturnType<typeof normalizeNamedSlots>[number],
  slotPath: string,
  context: ValidationContext
): void {
  if (named.name.trim() === '') {
    throw new TemplateError(
      "A 'slots' key must be a non-empty slot name",
      slotPath
    );
  }
  if (named.name === 'default') {
    throw new TemplateError(
      "'slots' fills named slots only; project the default slot through the element's children, with 'slotScope' for a scoped one",
      slotPath
    );
  }
  if (!Array.isArray(named.content) || named.content.length === 0) {
    throw new TemplateError(
      `The slot '${named.name}' must project a non-empty array of content nodes`,
      `${slotPath}.content`
    );
  }
  named.slotScope.forEach((name, index) => {
    if (typeof name !== 'string' || !IDENTIFIER_PATTERN.test(name)) {
      throw new TemplateError(
        "Each 'slotScope' entry must be a valid identifier",
        `${slotPath}.slotScope[${index}]`
      );
    }
  });
  validateChildren(named.content, `${slotPath}.content`, context);
}

interface AttributeRules {
  /**
   * False inside `conditionalAttributes`, where `class` and `style` are
   * literal-only - the condition is their dynamism.
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
    collect(() => {
      if (name === 'class') {
        validateClass(value as Attributes['class'], `${path}.class`, rules);
      } else if (name === 'style') {
        validateStyle(value as Attributes['style'], `${path}.style`, rules);
      } else if (name === '$spread') {
        validateSpread(value, `${path}.$spread`, rules);
      } else if (isExpressionBinding(value)) {
        validateExpression(value.$expression, `${path}.${name}`);
      }
    });
  }
}

/**
 * Validates the `$spread` directive: an expression binding, or a non-empty
 * array of them, naming the runtime objects spread onto the node. Static
 * values are rejected - a spread is inherently a runtime reference - and
 * `$spread` is not allowed inside `conditionalAttributes` (the condition is
 * the dynamism there; a spread carries its own).
 */
function validateSpread(
  value: unknown,
  path: string,
  rules: AttributeRules
): void {
  if (!rules.expressionsAllowed) {
    throw new TemplateError(
      "'$spread' is not allowed inside conditionalAttributes",
      path
    );
  }
  const entries = Array.isArray(value) ? value : [value];
  if (entries.length === 0) {
    throw new TemplateError(
      "'$spread' must carry an expression binding or a non-empty array of them",
      path
    );
  }
  entries.forEach((entry, index) => {
    const entryPath = Array.isArray(value) ? `${path}[${index}]` : path;
    if (!isExpressionBinding(entry)) {
      throw new TemplateError(
        "'$spread' values must be { $expression } bindings, not static values",
        entryPath
      );
    }
    validateExpression(entry.$expression, entryPath);
  });
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
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TemplateError(
      `'style' must be a style object, such as { paddingLeft: '2ch' }; ${
        typeof value === 'string' ? 'a string' : `'${String(value)}'`
      } is not one`,
      path
    );
  }
  if ('$expression' in value) {
    // A whole-object style expression may coexist with static properties,
    // includes, nested selectors, and per-property expressions: validate it
    // here, then fall through to validate the remaining keys as an ordinary
    // style object (which skips the string-valued `$expression` key).
    if (!rules.expressionsAllowed) {
      throw new TemplateError(
        "Expression bindings are not allowed on 'style' inside conditionalAttributes; the condition is the dynamism",
        path
      );
    }
    validateExpression((value as { $expression: unknown }).$expression, path);
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
    collect(() =>
      validateStyleEntry(key, value, path, rules, insideSelectorBlock)
    );
  }
}

/** Validates one key of a style object; see {@link validateStyleObject}. */
function validateStyleEntry(
  key: string,
  value: unknown,
  path: string,
  rules: AttributeRules,
  insideSelectorBlock: boolean
): void {
  if (key === '$include') {
    validateInclude(value, `${path}.${key}`);
    return;
  }
  if (key.startsWith('@include')) {
    validateIncludeKey(value, `${path}.${key}`, rules);
    return;
  }
  if (value === undefined || typeof value !== 'object' || value === null) {
    return;
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

/**
 * Validates an `@include ...` at-rule key's value: `true` (a no-content
 * statement) or an object (the content block, validated like a nested
 * selector block - no `$expression` inside). Any other value (a string,
 * number, array, or `false`) is a processing error. An empty object is the
 * no-content form and passes.
 */
function validateIncludeKey(
  value: unknown,
  path: string,
  rules: AttributeRules
): void {
  if (value === true) {
    return;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isExpressionBinding(value)
  ) {
    validateStyleObject(value, path, rules, true);
    return;
  }
  throw new TemplateError(
    "An '@include' value must be `true` (a no-content statement) or an object (a content block)",
    path
  );
}

/**
 * Validates a `$include` value: a non-empty string, or an array of
 * non-empty strings (several `@include` statements in authored order). The
 * statements themselves are opaque source - checked for non-emptiness,
 * never parsed.
 *
 * @deprecated `$include` is superseded by `@include ...` at-rule keys; this
 *   validation supports the deprecation window.
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
    if (
      !isRecord(branch) ||
      recordShape(branch, 'branch', branchPath).malformed
    ) {
      return;
    }
    collect(() =>
      validateBranchSequence(
        branch,
        index,
        index === node.conditions.length - 1,
        branchPath
      )
    );
    validateProps(branch.props, `${branchPath}.props`);
    validateChildren(branch.children, `${branchPath}.children`, context);
  });
}

/**
 * Validates one conditional branch's place in the sequence and its
 * condition; see {@link validateConditional}.
 */
function validateBranchSequence(
  branch: ConditionalNode['conditions'][number],
  index: number,
  isLast: boolean,
  branchPath: string
): void {
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
}

function validateIteration(
  node: IterationNode,
  path: string,
  context: ValidationContext
): void {
  collect(() => validateExpression(node.items, `${path}.items`));
  if (node.key !== undefined) {
    const key = node.key;
    collect(() => validateExpression(key, `${path}.key`));
  }
  validateChildren(node.children, `${path}.children`, context);
}

function validateExpression(expression: unknown, path: string): void {
  if (typeof expression !== 'string' || expression.trim() === '') {
    throw new TemplateError('Expressions must be non-empty strings', path);
  }
}

/** Matches an assignment operator, plain or compound. */
const ASSIGNMENT_OPERATOR = /^(?:\*\*|<<|>>>|>>|&&|\|\||\?\?|[-+*/%&|^])?=$/;

/**
 * The names among `names` a script writes as free references, each once in
 * first-write order: assigned (`name = `, `name += `, `name ??= `, ...) or
 * incremented and decremented (`name++`, `--name`). A parameter of the same
 * name, a member (`menu.name = `) and a comparison (`name == `, `name <= `)
 * are not writes. A write inside a template literal's placeholder counts.
 */
function writtenNames(
  script: string,
  names: ReadonlyMap<string, string>
): string[] {
  if (names.size === 0) {
    return [];
  }
  // A template literal's placeholders are read where they sit.
  const tokens = flattenTemplateLiterals(tokenizeExpression(script));
  const readings = readExpressionIdentifiers(tokens);
  // The punctuators directly after `index`, joined while adjacent.
  const operatorAfter = (index: number): string => {
    let cursor = index + 1;
    while (tokens[cursor]?.kind === 'space') {
      cursor += 1;
    }
    let operator = '';
    while (tokens[cursor]?.kind === 'punctuator') {
      operator += tokens[cursor].text;
      cursor += 1;
      if (operator.endsWith('=')) {
        break;
      }
    }
    return tokens[cursor]?.kind === 'punctuator' &&
      /^[=>]/.test(tokens[cursor].text)
      ? operator + tokens[cursor].text
      : operator;
  };
  const written: string[] = [];
  tokens.forEach((token, index) => {
    if (
      !names.has(token.text) ||
      readings.get(index)?.free !== true ||
      written.includes(token.text)
    ) {
      return;
    }
    let before = index - 1;
    while (tokens[before]?.kind === 'space') {
      before -= 1;
    }
    if (tokens[before]?.text === 'typeof') {
      // A type query, as in `let snapshot: typeof name = ...`.
      return;
    }
    const after = operatorAfter(index);
    // The run of adjacent `+` or `-` tokens on one side of the name.
    const run = (offset: number): number => {
      const sign = tokens[index + offset]?.text;
      if (sign !== '+' && sign !== '-') {
        return 0;
      }
      let length = 0;
      while (tokens[index + offset * (length + 1)]?.text === sign) {
        length += 1;
      }
      return length;
    };
    // JavaScript reads `++` greedily from the left, so `b+++name` is
    // `b++ + name`: the run before the name ends in `++` only when its
    // length is even.
    const leading = run(-1);
    const prefixed = leading >= 2 && leading % 2 === 0;
    if (ASSIGNMENT_OPERATOR.test(after) || run(1) >= 2 || prefixed) {
      written.push(token.text);
    }
  });
  return written;
}
