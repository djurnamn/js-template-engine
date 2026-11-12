import {
  isDynamicTag,
  normalizeExposes,
  normalizeNamedSlots,
  TemplateError,
} from '@js-template-engine/core';
import {
  CONSUMER_ATTRIBUTES,
  normalizeSlotName,
  optionalPropType,
  propAliases,
  propDocumentation,
} from '@js-template-engine/core/emitter';
import type {
  NormalizedExposedBinding,
  NormalizedTypeParameter,
} from '@js-template-engine/core';
import type {
  ElementNode,
  ExposedBinding,
  JsonValue,
  PropDefinition,
  TemplateNode,
} from '@js-template-engine/types';

import { attributeName } from './attribute-names';
import { objectKey, serializeJavaScriptValue } from './literals';

/** A prop synthesized from a slot. */
export interface SlotProp {
  /** The authored slot name; `undefined` for the default slot. */
  slotName: string | undefined;
  /** The normalized React prop name; `'children'` for the default slot. */
  propName: string;
  /**
   * The runtime values the slot exposes (a scoped slot), making its prop a
   * render prop. Empty for an ordinary slot (a bare `ReactNode` prop).
   */
  exposes: NormalizedExposedBinding[];
  /**
   * Whether the slot's content must take its scope (`scopeRequired`): the
   * prop is then the render function alone, never plain content.
   */
  scopeRequired: boolean;
}

/**
 * The React type of a slot prop: a bare `ReactNode` for an ordinary slot,
 * and for a scoped slot `ReactNode | ((scope: { ... }) => ReactNode)` - a
 * render function or plain content, as a Vue or Svelte slot takes either.
 * A scoped slot that requires its scope takes the render function alone,
 * `((scope: { ... }) => ReactNode) | undefined`, so plain content is a type
 * error. Each exposed binding types as its declared `type` or `any`.
 */
function slotPropType(slotProp: SlotProp): string {
  if (slotProp.exposes.length === 0) {
    return 'ReactNode';
  }
  const scope = slotProp.exposes
    .map((binding) => `${binding.name}: ${binding.type ?? 'any'}`)
    .join('; ');
  const renderFunction = `(scope: { ${scope} }) => ReactNode`;
  return slotProp.scopeRequired
    ? `(${renderFunction}) | undefined`
    : `ReactNode | (${renderFunction})`;
}

/**
 * Collects the props synthesized from a component's slots, in document
 * order, deduplicated by slot name.
 *
 * Two slots whose names normalize to the same prop name, or a slot whose
 * prop name collides with a declared prop, are processing errors.
 */
export function collectSlotProps(
  children: TemplateNode[],
  declaredProps: Record<string, PropDefinition>
): SlotProp[] {
  const slotProps: SlotProp[] = [];
  const byPropName = new Map<string, SlotProp>();

  const visit = (nodes: TemplateNode[], path: string): void => {
    nodes.forEach((node, index) => {
      const nodePath = path === '' ? `[${index}]` : `${path}[${index}]`;
      switch (node.type) {
        case 'element':
          if (node.children) {
            visit(node.children, `${nodePath}.children`);
          }
          for (const named of normalizeNamedSlots(node.slots)) {
            visit(named.content, `${nodePath}.slots.${named.name}`);
          }
          break;
        case 'fragment':
          visit(node.children, `${nodePath}.children`);
          break;
        case 'conditional':
          node.conditions.forEach((branch, branchIndex) => {
            visit(
              branch.children,
              `${nodePath}.conditions[${branchIndex}].children`
            );
          });
          break;
        case 'iteration':
          visit(node.children, `${nodePath}.children`);
          break;
        case 'slot': {
          registerSlot(
            node.name,
            node.exposes,
            node.scopeRequired === true,
            nodePath
          );
          if (node.fallback) {
            visit(node.fallback, `${nodePath}.fallback`);
          }
          break;
        }
        default:
          break;
      }
    });
  };

  const registerSlot = (
    slotName: string | undefined,
    exposes: Record<string, ExposedBinding> | undefined,
    scopeRequired: boolean,
    nodePath: string
  ): void => {
    const propName =
      slotName === undefined ? 'children' : normalizeSlotName(slotName);
    const existing = byPropName.get(propName);
    if (existing !== undefined) {
      if (existing.slotName !== slotName) {
        throw new TemplateError(
          `Slots '${existing.slotName ?? '(default)'}' and '${slotName ?? '(default)'}' both normalize to the React prop '${propName}'`,
          nodePath
        );
      }
      // Validation holds every place a slot renders to the same binding
      // names, declared types and `scopeRequired`; a type only a later
      // place declares still types the prop.
      for (const binding of normalizeExposes(exposes)) {
        const known = existing.exposes.find(
          (candidate) => candidate.name === binding.name
        );
        if (known !== undefined && known.type === undefined && binding.type) {
          known.type = binding.type;
        }
      }
      return;
    }
    if (propName in declaredProps) {
      throw new TemplateError(
        `The slot '${slotName ?? '(default)'}' collides with the declared prop '${propName}'`,
        nodePath
      );
    }
    const normalized = normalizeExposes(exposes);
    const slotProp: SlotProp = {
      slotName,
      propName,
      exposes: normalized,
      scopeRequired: scopeRequired && normalized.length > 0,
    };
    byPropName.set(propName, slotProp);
    slotProps.push(slotProp);
  };

  visit(children, '');
  return slotProps;
}

/**
 * A passthrough root whose dynamic tag is a declared prop: the prop is the
 * tag, so the generated props follow the tag or component it holds.
 */
export interface PolymorphicRoot {
  /** The declared prop the tag expression reads. */
  propName: string;
  /**
   * The type parameter the tag prop binds: `T extends <constraint> =
   * '<default tag>'`, appended after the component's own type parameters.
   */
  typeParameter: NormalizedTypeParameter;
  /** Whether the constraint reads React's `JSX` namespace. */
  usesJsxNamespace: boolean;
  /** The tag an omitted prop renders: the type parameter's default. */
  defaultTag: string;
}

/** A tag expression that is a bare identifier, with an optional `?? '<tag>'` fallback. */
const POLYMORPHIC_EXPRESSION =
  /^\s*([A-Za-z_$][\w$]*)\s*(?:\?\?\s*(?:'[^'\\]*'|"[^"\\]*")\s*)?$/;

/** Authored prop types that add nothing to the polymorphic constraint. */
const UNCONSTRAINED_TYPES = new Set(['any', 'unknown', 'ElementType']);

/**
 * Recognizes a polymorphic root: a passthrough root whose dynamic tag
 * expression is a declared prop's bare name, optionally followed by a
 * `?? '<tag>'` fallback (`as`, `as ?? 'button'`). The expression is matched
 * whole, never parsed; any other form keeps the default tag's surface.
 *
 * The type parameter's constraint is `ElementType` for a `componentValued`
 * tag and `keyof JSX.IntrinsicElements` otherwise, intersected with the
 * prop's authored type (with the default tag added when it leaves that out)
 * unless that is `any`, `unknown` or `ElementType`. Its default is the
 * prop's own default when that is a string, else the tag's `default`.
 *
 * @param root - The component's passthrough root, if any.
 * @param declaredProps - The component's declared props.
 * @param typeParameters - The component's own type parameters, whose names
 *   the polymorphic one avoids.
 * @returns The polymorphic root, or `undefined` when the root is not one.
 *
 * @example
 * // tag: { $expression: "as ?? 'button'", default: 'button' },
 * // props: { as: { type: "'button' | 'a'" } }
 * // typeParameter: T extends keyof JSX.IntrinsicElements & ('button' | 'a') = 'button'
 */
export function polymorphicRootOf(
  root: ElementNode | undefined,
  declaredProps: Record<string, PropDefinition>,
  typeParameters: readonly NormalizedTypeParameter[] = []
): PolymorphicRoot | undefined {
  if (root === undefined || !isDynamicTag(root.tag)) {
    return undefined;
  }
  const propName = POLYMORPHIC_EXPRESSION.exec(root.tag.$expression)?.[1];
  if (propName === undefined || !(propName in declaredProps)) {
    return undefined;
  }
  const componentValued = root.tag.componentValued === true;
  const base = componentValued ? 'ElementType' : 'keyof JSX.IntrinsicElements';
  const definition = declaredProps[propName];
  // The tag an omitted prop renders: the prop's own string default, else the
  // tag's `default`.
  const defaultTag =
    typeof definition.default === 'string'
      ? definition.default
      : root.tag.default;
  const defaultLiteral = `'${defaultTag}'`;
  let authored = definition.type.trim();
  // The default must satisfy the constraint, so a default the authored type
  // leaves out is added to it.
  if (
    !UNCONSTRAINED_TYPES.has(authored) &&
    authored !== 'string' &&
    !authored.includes(defaultLiteral) &&
    !authored.includes(`"${defaultTag}"`)
  ) {
    authored = `${authored} | ${defaultLiteral}`;
  }
  const constraint = UNCONSTRAINED_TYPES.has(authored)
    ? base
    : `${base} & ${/^[\w$.'"-]+$/.test(authored) ? authored : `(${authored})`}`;
  const taken = new Set(typeParameters.map((parameter) => parameter.name));
  let name = 'T';
  for (let index = 2; taken.has(name); index++) {
    name = `T${index}`;
  }
  return {
    propName,
    typeParameter: { name, constraint, default: defaultLiteral },
    usesJsxNamespace: constraint.includes('JSX.'),
    defaultTag,
  };
}

/**
 * Renders the generated props interface: declared props in authored order,
 * then slot-synthesized `ReactNode` entries in document order. Returns
 * `undefined` when there is nothing to declare. The interface is exported,
 * so a barrel that star-exports the component carries its props type. An
 * optional prop is typed `?: T | undefined` ({@link optionalPropType}), so a
 * consumer compiling with `exactOptionalPropertyTypes` can pass `undefined`.
 *
 * For a passthrough surface root (`passthroughTag` set) or a component
 * declaring `rest` (`restTag` set), the props extend
 * `Omit<ComponentPropsWithRef<'<tag>'>, <declared and slot prop names>>` -
 * admitting the consumer's arbitrary attributes plus the ref-as-prop,
 * `className`, and `style`, while a declared prop sharing a native
 * attribute's name keeps its own type - and the block is always emitted even
 * with no declared or slot entries (a bare type alias then).
 *
 * For a polymorphic root (`polymorphic` set), the props are a type alias
 * intersecting `Omit<ComponentPropsWithRef<T>, ...>` with the declared and
 * slot entries, the tag prop typed `T`: the surface follows the tag or
 * component the consumer passes. The caller declares `T` on the alias and
 * the function.
 */
export function propsInterface(
  componentName: string,
  declaredProps: Record<string, PropDefinition>,
  slotProps: SlotProp[],
  passthroughTag?: string,
  restTag?: string,
  polymorphic?: PolymorphicRoot,
  routed?: RoutedSurface
): string | undefined {
  const entries: string[] = [];
  for (const [name, definition] of Object.entries(declaredProps)) {
    entries.push(
      ...propDocumentation(
        definition,
        '  ',
        definition.default === undefined
          ? undefined
          : serializeJavaScriptValue(definition.default as JsonValue)
      )
    );
    const type =
      polymorphic?.propName === name
        ? polymorphic.typeParameter.name
        : definition.type;
    entries.push(
      definition.required === true
        ? `  ${objectKey(name)}: ${type};`
        : `  ${objectKey(name)}?: ${optionalPropType(type)};`
    );
  }
  // A slot prop's type has `ReactNode` at its top level, which already
  // admits `undefined`, so it takes no `| undefined` of its own; a render
  // function alone carries its own (`slotPropType`).
  for (const slotProp of slotProps) {
    entries.push(`  ${slotProp.propName}?: ${slotPropType(slotProp)};`);
  }
  const omitted = [
    ...Object.keys(declaredProps),
    ...slotProps.map((slotProp) => slotProp.propName),
  ];
  // A polymorphic root's surface follows the type parameter its tag prop
  // binds, so the props are an intersection: an interface cannot extend a
  // mapped type over a type parameter.
  if (polymorphic !== undefined) {
    const base = omittedSurface(polymorphic.typeParameter.name, omitted, false);
    return `export type ${componentName}Props = ${base} & {\n${entries.join('\n')}\n};`;
  }
  // A routed element's attributes are typed after its own tag: the root's
  // surface loses the routed keys, and the routed tag's surface supplies them.
  if (passthroughTag !== undefined && routed !== undefined) {
    const keys = routedKeysName(componentName);
    const alias = `type ${keys} = ${routedKeysType(routed, omitted)};`;
    // With '*' the root keeps only what the runtime leaves it: the class,
    // style and ref (and data-*, which JSX admits on any component). A
    // routed handle types the ref after the routed tag's element instead.
    const rootKeys = routed.handlesRef
      ? "'className' | 'style'"
      : "'className' | 'style' | 'ref'";
    const rootBase = routed.entries.includes('*')
      ? `Pick<ComponentPropsWithRef<'${passthroughTag}'>, ${rootKeys}>`
      : omittedSurface(
          passthroughTag,
          [...omitted, ...(routed.handlesRef ? ['ref'] : []), keys],
          true,
          [keys]
        );
    const routedBase = [
      `Pick<ComponentPropsWithoutRef<'${routed.tag}'>, ${keys}>`,
      ...(routed.handlesRef
        ? [`Pick<ComponentPropsWithRef<'${routed.tag}'>, 'ref'>`]
        : []),
    ].join(entries.length === 0 ? ' & ' : ', ');
    if (entries.length === 0) {
      return `${alias}\n\nexport type ${componentName}Props = ${rootBase} & ${routedBase};`;
    }
    return `${alias}\n\nexport interface ${componentName}Props extends ${rootBase}, ${routedBase} {\n${entries.join('\n')}\n}`;
  }
  const surfaceTag = passthroughTag ?? restTag;
  if (surfaceTag !== undefined) {
    const base = omittedSurface(surfaceTag, omitted);
    if (entries.length === 0) {
      return `export type ${componentName}Props = ${base};`;
    }
    return `export interface ${componentName}Props extends ${base} {\n${entries.join('\n')}\n}`;
  }
  if (entries.length === 0) {
    return undefined;
  }
  return `export interface ${componentName}Props {\n${entries.join('\n')}\n}`;
}

/**
 * A tag's typed surface without the names the component declares itself
 * and without `children`, which a default slot redeclares when the component
 * has one: `Omit<ComponentPropsWithRef<'<tag>'>, 'a' | 'b' | 'children'>`.
 * With `literal` false, `tag` names a type parameter rather than a tag:
 * `Omit<ComponentPropsWithRef<T>, ...>`.
 */
function omittedSurface(
  tag: string,
  omitted: readonly string[],
  literal = true,
  typeNames: readonly string[] = []
): string {
  const surface = `ComponentPropsWithRef<${literal ? `'${tag}'` : tag}>`;
  // A component with no default slot takes no children: left in, they would
  // spread onto the root (or a void element) where nothing renders them.
  const names = new Set(omitted.filter((name) => !typeNames.includes(name)));
  names.add('children');
  return `Omit<${surface}, ${[...[...names].map((name) => `'${name}'`), ...typeNames].join(' | ')}>`;
}

/** The routed element of a passthrough surface, as the props type needs it. */
export interface RoutedSurface {
  /** The routed element's intrinsic tag. */
  tag: string;
  /** Its routing entries. */
  entries: readonly string[];
  /** Whether the consumer's `ref` lands on the routed element. */
  handlesRef?: boolean;
}

/** The name of the type alias holding a component's routed prop keys. */
export function routedKeysName(componentName: string): string {
  return `${componentName}RoutedKeys`;
}

/**
 * The prop keys a routed element takes, as a type over its tag's props: each
 * key matching `aria-${string}` or `on${string}` when those entries are
 * listed, or whose lowercase form is a listed HTML name (`formNoValidate` for
 * `formnovalidate`), without the declared names; or every key but
 * `className`, `style` and the declared names for `'*'`. `children` and `key`
 * are never routed.
 */
function routedKeysType(
  routed: RoutedSurface,
  declared: readonly string[]
): string {
  const surface = `keyof ComponentPropsWithoutRef<'${routed.tag}'>`;
  const excluded = [
    ...new Set([...declared, 'children', 'key', 'className', 'style']),
  ]
    .map((name) => `'${name}'`)
    .join(' | ');
  if (routed.entries.includes('*')) {
    return `Exclude<${surface}, ${excluded}>`;
  }
  const patterns = [
    ...(routed.entries.includes('aria-*') ? ['`aria-${string}`'] : []),
    ...(routed.entries.includes('on*') ? ['`on${string}`'] : []),
  ];
  // An HTML name matches its React prop case-blind (`formnovalidate` is
  // `formNoValidate`), or through React's renamed spelling (`htmlFor`).
  const names = [
    ...new Set(
      routed.entries
        .filter((entry) => entry !== 'aria-*' && entry !== 'on*')
        .flatMap((entry) => [
          entry.toLowerCase(),
          attributeName(entry).toLowerCase(),
        ])
    ),
  ].map((name) => `'${name}'`);
  const byName =
    names.length === 0
      ? 'never'
      : `Lowercase<Key & string> extends ${names.join(' | ')} ? Key : never`;
  const test =
    patterns.length === 0
      ? byName
      : `Key extends ${patterns.join(' | ')} ? Key : ${byName}`;
  return `Exclude<{ [Key in ${surface}]-?: ${test} }[${surface}], ${excluded}>`;
}

/**
 * Renders the props type for a discriminated surface root as a discriminated
 * union - one member per branch. Each member intersects the branch element's
 * typed surface (`ComponentPropsWithRef<'<tag>'>`, without the names the
 * component declares) with the shared component
 * props and the branch's own props (a literal discriminant as a literal type),
 * so a consumer is typed against whichever element a branch renders. A
 * presence discriminant is typed as declared in the branch it picks and
 * `?: undefined` in every other member, so the union narrows on
 * `props.<name> !== undefined` and the prop is a type error on another branch.
 *
 * @example
 * export type InputProps =
 *   | (ComponentPropsWithRef<'div'> & { size?: number | undefined; visual: true })
 *   | (ComponentPropsWithRef<'input'> & { size?: number | undefined; visual?: false | undefined });
 *
 * @example
 * export type ButtonProps =
 *   | (ComponentPropsWithRef<'a'> & { href: string })
 *   | (ComponentPropsWithRef<'button'> & { href?: undefined });
 */
export function discriminatedPropsInterface(
  componentName: string,
  sharedProps: Record<string, PropDefinition>,
  branches: Array<{ tag: string; props: Record<string, PropDefinition> }>,
  slotProps: SlotProp[],
  presenceDiscriminants: ReadonlyArray<{ name: string; branch: number }> = []
): string {
  const propLine = (name: string, definition: PropDefinition): string =>
    [
      ...propDocumentation(
        definition,
        '      ',
        definition.default === undefined
          ? undefined
          : serializeJavaScriptValue(definition.default as JsonValue)
      ),
      definition.required === true
        ? `      ${objectKey(name)}: ${definition.type};`
        : `      ${objectKey(name)}?: ${optionalPropType(definition.type)};`,
    ].join('\n');

  // A presence discriminant another branch picks: `?: undefined` here, with the
  // description this branch gives it, if any.
  const absentLine = (name: string, definition?: PropDefinition): string =>
    [
      ...(definition === undefined
        ? []
        : propDocumentation(
            { type: 'undefined', description: definition.description },
            '      ',
            undefined
          )),
      `      ${objectKey(name)}?: undefined;`,
    ].join('\n');

  const members = branches.map(({ tag, props }, index) => {
    const foreign = new Set(
      presenceDiscriminants
        .filter((discriminant) => discriminant.branch !== index)
        .map((discriminant) => discriminant.name)
    );
    const entries: string[] = [];
    for (const [name, definition] of Object.entries(sharedProps)) {
      entries.push(propLine(name, definition));
    }
    for (const [name, definition] of Object.entries(props)) {
      entries.push(
        foreign.has(name)
          ? absentLine(name, definition)
          : propLine(name, definition)
      );
    }
    for (const name of foreign) {
      if (props[name] === undefined) {
        entries.push(absentLine(name));
      }
    }
    for (const slotProp of slotProps) {
      entries.push(`      ${slotProp.propName}?: ${slotPropType(slotProp)};`);
    }
    const base = omittedSurface(tag, [
      ...Object.keys(sharedProps),
      ...Object.keys(props),
      ...[...foreign].filter((name) => props[name] === undefined),
      ...slotProps.map((slotProp) => slotProp.propName),
    ]);
    if (entries.length === 0) {
      return `  | ${base}`;
    }
    return `  | (${base} & {\n${entries.join('\n')}\n    })`;
  });

  return `export type ${componentName}Props =\n${members.join('\n')};`;
}

/**
 * Renders the prop destructuring statement with defaults:
 * `const { label, variant = 'primary' } = props;`. Returns `undefined`
 * when no props are declared.
 *
 * A prop whose name cannot be a local binding (`aria-pressed`, a reserved
 * word such as `for` or `class`) is destructured under a camel-cased alias,
 * with or without a default (`'aria-pressed': ariaPressed = false`,
 * `for: forProp`), so expressions read it by that alias and it never reaches
 * `...rest`. `aliases` gives each alias ({@link propAliases}, computed over
 * the whole component so every target agrees); by default it is computed
 * from the props and slot prop names given.
 *
 * For a passthrough surface root, the consumer `className`, `style`, and
 * `ref` are destructured out (handled explicitly by the renderer) and the
 * remaining undeclared props are gathered into `...rest` for the spread -
 * so the statement is emitted even with no declared props
 * (`const { className, style, ref, ...rest } = props;`). Slot prop names are
 * destructured too so the framework's slot props never leak into the
 * spread as invalid DOM attributes.
 *
 * For a component declaring `rest`, everything but the declared and slot
 * props gathers into `...rest` - `className`, `style` and `ref` included -
 * for the author to spread where the attributes land.
 */
export function propsDestructuring(
  declaredProps: Record<string, PropDefinition>,
  passthrough = false,
  slotPropNames: readonly string[] = [],
  rest = false,
  aliases: ReadonlyMap<string, string> = propAliases([
    ...Object.keys(declaredProps),
    ...slotPropNames,
  ]),
  routed = false
): string | undefined {
  const names = Object.entries(declaredProps).map(([name, definition]) => {
    const initializer =
      definition.default === undefined
        ? ''
        : ` = ${serializeJavaScriptValue(definition.default)}`;
    const alias = aliases.get(name);
    return alias === undefined
      ? `${name}${initializer}`
      : `${objectKey(name)}: ${alias}${initializer}`;
  });
  if (passthrough) {
    // With a routed element the undeclared props are split in two after
    // the destructuring, the root's share keeping the name `rest`.
    names.push(
      ...slotPropNames,
      'className',
      'style',
      'ref',
      routed ? `...${SURFACE_PROPERTIES}` : '...rest'
    );
  } else if (rest) {
    names.push(...slotPropNames, '...rest');
  }
  if (names.length === 0) {
    return undefined;
  }
  return `const { ${names.join(', ')} } = props;`;
}

/** The share of the consumer's props a routed element receives. */
export const ROUTED_REST = 'routedRest';

/** The undeclared props of a passthrough surface with a routed element,
 *  before they are split between the root and the routed element. */
export const SURFACE_PROPERTIES = 'surfaceProperties';

/**
 * The statements that split a routed surface's undeclared props: the root's
 * share as `rest`, the routed element's as `routedRest`, each typed after
 * its element through the routed keys alias.
 */
export function routedRestStatements(componentName: string): string[] {
  const keys = routedKeysName(componentName);
  return [
    `const rest = ${CONSUMER_ATTRIBUTES}<Omit<typeof ${SURFACE_PROPERTIES}, ${keys}>>(${SURFACE_PROPERTIES}, 'root');`,
    `const ${ROUTED_REST} = ${CONSUMER_ATTRIBUTES}<Pick<typeof ${SURFACE_PROPERTIES}, ${keys}>>(${SURFACE_PROPERTIES}, 'routed');`,
  ];
}
