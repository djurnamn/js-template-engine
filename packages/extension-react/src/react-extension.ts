import {
  collectCss,
  declaredIdsOf,
  derivedValuesOf,
  discriminatedSurfaceOf,
  dynamicRootTagExpressionOf,
  isDynamicTag,
  partitionImports,
  passthroughNodeOf,
  planTargets,
  resolveComponentOverrides,
  staticTagOf,
  stylesheetFiles,
  relayedBindingsOf,
  twoWayBindingsOf,
  type BemRuntimeBinding,
  type DiscriminatedSurface,
  type TargetExtension,
  type NormalizedComponent,
  type ResolvedProcessingOptions,
} from '@js-template-engine/core';
import {
  invokeHandlerDeclaration,
  usesInvokeHandler,
  authoredAndConsumerDeclaration,
  authoredOrConsumerDeclaration,
  consumerAndSpreadDeclaration,
  consumerAttributesDeclaration,
  conditionalPassthroughOf,
  COMPONENT_OVERRIDE_KEYS,
  discriminantOf,
  documentationComment,
  TARGET_NODE_OVERRIDE_KEYS,
  GENERATED_ID_NAME,
  idExpression,
  importedNames,
  joinSiblingLines,
  routedElementOf,
  propAliases,
  tagLines,
  twoWayCodeProps,
  typeParameterArguments,
  typeParameterDeclarations,
  withoutRemovedBemRuntimeCalls,
  type ConditionalPassthrough,
  type SiblingLines,
} from '@js-template-engine/core/emitter';
import type {
  OutputFile,
  ProcessResult,
  StylesheetLink,
  TemplateNode,
  Warning,
} from '@js-template-engine/types';

import { attributeName } from './attribute-names';
import { composeEventHandlersDeclaration } from './events';
import {
  CUSTOM_PROPERTY_STYLE_TYPE,
  negatedRootCondition,
  reactRemovesClass,
  renderJsxNode,
  renderJsxSiblings,
  wrapJsxChildren,
  type JsxContext,
} from './jsx';
import {
  escapeTemplateLiteral,
  objectKey,
  serializeJavaScriptValue,
} from './literals';
import type { ReactComponentOverride } from './overrides';
import { composeRefsDeclaration, indeterminateRefDeclaration } from './refs';
import { reactReservedNames } from './reserved-names';
import {
  collectSlotProps,
  discriminatedPropsInterface,
  polymorphicRootOf,
  propsDestructuring,
  propsInterface,
  routedRestStatements,
  type SlotProp,
} from './props';
import { relayedStatements, twoWayStatements } from './two-way';

/** The React target extension. */
export interface ReactExtension extends TargetExtension {
  readonly key: 'react';
}

/**
 * Creates the React target extension.
 *
 * Renders a template as a React function component in TypeScript
 * (`<Name>.tsx`): a generated props interface with destructured defaults,
 * slots as props (the default slot as `children`), conditional rendering,
 * keyed list rendering, and event props with modifiers applied in generated
 * handlers.
 *
 * Styling supports all three stylesheet placements: `inline` renders plain
 * style properties as `style={{ ... }}` objects, `in-file` embeds the
 * collected CSS through a rendered `<style>` element, and `separate-file`
 * emits `<Name>.css` with an import. Component script content lives in the
 * component function, where React event props expect their handlers in
 * scope.
 *
 * @example
 * const result = process(template, { extensions: [react()] });
 * // result.files[0] = { path: 'Button.tsx', content: '...' }
 */
export function react(): ReactExtension {
  return {
    key: 'react',
    kind: 'target',
    restClassAndStyle: { classKey: 'className' },
    overrideKeys: {
      node: TARGET_NODE_OVERRIDE_KEYS,
      component: [...COMPONENT_OVERRIDE_KEYS, 'client'],
    },
    // The components take `ref` as a prop, which React 19 introduced.
    peerDependencies: { react: '^19.0.0' },
    reservedNames: reactReservedNames,
    render: renderReactComponent,
  };
}

const INDENTATION = '  ';
const MAXIMUM_WIDTH = 80;

/**
 * The file-local style type admitting CSS custom properties (`--*`) in inline
 * `style` object literals, declared only in components that use one.
 * `React.CSSProperties` has no `--*` index signature, so the literal would
 * otherwise fail a consumer's `tsc` on the typed-import path; a local type,
 * unlike a `declare module 'react'` augmentation, leaves the consumer's own
 * `CSSProperties` as React ships it. Standard-property checking is unchanged.
 */
const CSS_CUSTOM_PROPERTY_STYLE_TYPE = `type ${CUSTOM_PROPERTY_STYLE_TYPE} = CSSProperties & {\n${INDENTATION}[key: \`--\${string}\`]: string | number | undefined;\n};`;

function renderReactComponent(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions
): ProcessResult {
  const warnings: Warning[] = [];
  // A node whose class React removes renders no `bem(...)` call, and with no
  // call left the component needs no `useBem` setup.
  const overridden = withoutRemovedBemRuntimeCalls(
    resolveComponentOverrides(component, 'react'),
    reactRemovesClass
  );
  // A two-way prop's value and setter are generated; its own default seeds
  // the component's copy, so the prop itself is declared without one. A
  // relayed prop's given value and report function are generated too, and
  // hold no state.
  const twoWayBindings = twoWayBindingsOf(overridden.props);
  const relayedBindings = relayedBindingsOf(overridden.props);
  const resolved: NormalizedComponent = {
    ...overridden,
    props: twoWayCodeProps(overridden.props, serializeJavaScriptValue),
  };
  const placement = options.styling.placement;
  const styleExtension = options.styling.language === 'scss' ? 'scss' : 'css';

  const plan = planTargets(
    resolved.children,
    placement,
    'inline',
    resolved.selectorClasses,
    resolved.name
  );
  const css = collectCss(
    resolved,
    plan,
    placement,
    options.styling.language,
    options.styling.layer
  );
  const slotProps = collectSlotProps(resolved.children, resolved.props);
  const surface = discriminatedSurfaceOf(resolved.children);
  const aliases = propAliases(
    [
      ...Object.keys(resolved.props),
      ...(surface?.branches.flatMap((entry) =>
        Object.keys(entry.branch.props ?? {})
      ) ?? []),
    ],
    overridden
  );
  const local = (name: string): string => aliases.get(name) ?? name;
  const read =
    surface === undefined
      ? local
      : (name: string): string =>
          objectKey(name) === name
            ? `props.${name}`
            : `props[${objectKey(name)}]`;
  const twoWayBlocks = [
    ...twoWayStatements(
      twoWayBindings,
      overridden.props,
      read,
      local,
      surface === undefined
    ),
    ...relayedStatements(relayedBindings, overridden.props, read, local),
  ];
  // Each derived value is a `const` after the props and two-way values it
  // reads, ahead of the script, which may read it in turn.
  const derivedLines = derivedValuesOf(resolved).flatMap((value) =>
    `const ${value.name} = ${value.expression.trim()};`.split('\n')
  );
  // The instance's id comes from `useId()`, called once and unconditionally,
  // and each declared id is a `const` built from it ahead of the derived
  // values, which may read it.
  const declaredIds = declaredIdsOf(resolved);
  const idLines =
    declaredIds.length > 0
      ? [
          `const ${GENERATED_ID_NAME} = useId();`,
          ...declaredIds.map(
            (id) =>
              `const ${id.name} = ${idExpression(id, id.prop === undefined ? undefined : local(id.prop))};`
          ),
        ]
      : [];
  const stateBlocks = [
    ...twoWayBlocks,
    ...(idLines.length > 0 ? [idLines] : []),
    ...(derivedLines.length > 0 ? [derivedLines] : []),
  ];
  const passthroughNode = passthroughNodeOf(resolved.children);
  const conditional = conditionalPassthroughOf(resolved.children);
  const routed =
    surface === undefined ? routedElementOf(resolved.children) : undefined;
  const passthroughTag = passthroughNode
    ? staticTagOf(passthroughNode.tag)
    : undefined;
  const rootTagExpression = dynamicRootTagExpressionOf(resolved.children);
  // A dynamic root tag on a passthrough surface renders `<RootTag>` as a union
  // of its possible tags, but `ref`/`{...rest}` are typed against the single
  // default tag. Annotating the hoisted local as `ElementType<...default props...>`
  // keeps that prop checking while admitting the runtime-dynamic tag.
  const dynamicRootPassthroughTag =
    rootTagExpression !== undefined ? passthroughTag : undefined;
  // A passthrough root whose tag is a declared prop types its props by the
  // tag or component that prop holds, through a type parameter of its own.
  const polymorphic =
    surface === undefined
      ? polymorphicRootOf(
          passthroughNode,
          resolved.props,
          resolved.typeParameters
        )
      : undefined;
  const typeParameters =
    polymorphic === undefined
      ? resolved.typeParameters
      : [...(resolved.typeParameters ?? []), polymorphic.typeParameter];
  // The hoisted root tag's type: the default tag's element type, or, on a
  // polymorphic root, any element type, the props already being typed by it.
  const rootTagType =
    polymorphic !== undefined
      ? 'ElementType'
      : dynamicRootPassthroughTag !== undefined
        ? `ElementType<ComponentPropsWithRef<'${dynamicRootPassthroughTag}'>>`
        : undefined;
  const renderedRoots = resolved.children.filter(
    (node) => node.type !== 'comment'
  );
  const dynamicRootNode =
    renderedRoots.length === 1 &&
    renderedRoots[0].type === 'element' &&
    isDynamicTag(renderedRoots[0].tag)
      ? renderedRoots[0]
      : undefined;
  // The component body's dynamic-tag bindings (a loop or scoped slot keeps
  // its own); a discriminated surface gives each branch its own instead.
  const componentBindings: string[] = [];

  const context: JsxContext = {
    plan,
    stylingInline: placement === 'inline',
    slotPropNames: new Map(
      slotProps.map((slotProp) => [slotProp.slotName, slotProp.propName])
    ),
    scopeRequiredSlots: new Set(
      slotProps
        .filter((slotProp) => slotProp.scopeRequired)
        .map((slotProp) => slotProp.slotName)
    ),
    namedSlots: new Set(
      slotProps
        .map((slotProp) => slotProp.slotName)
        .filter((slotName): slotName is string => slotName !== undefined)
    ),
    usesFragmentImport: false,
    usesCssCustomProperty: false,
    passthroughNode,
    routedNode: routed?.node,
    routedEntries: routed?.entries,
    routedHandle: routed?.handlesRef === true,
    dynamicRootNode,
    ...(polymorphic !== undefined
      ? { polymorphicRootTag: polymorphic.defaultTag }
      : {}),
    scopeBindings: componentBindings,
    dynamicTagCount: { value: 0 },
    destructuredNames: new Set([
      ...Object.keys(resolved.props),
      ...slotProps.map((slotProp) => slotProp.propName),
    ]),
    bemRuntimeCalls: resolved.bemRuntimeCalls,
    declaresRest: resolved.rest !== undefined,
    warnings,
  };

  const restTag = resolved.rest?.tag;
  const hasPassthrough =
    passthroughNode !== undefined ||
    surface !== undefined ||
    restTag !== undefined;
  // A discriminated surface root returns a single element per branch, so there
  // is no fragment to host an in-file `<style>`; its CSS rides `inline` or
  // `separate-file` styling instead.
  const emitStyleElement =
    surface === undefined && css !== '' && placement !== 'separate-file';

  let interfaceBlock: string | undefined;
  let functionBlock: string;
  if (surface !== undefined) {
    interfaceBlock = discriminatedPropsInterface(
      resolved.name,
      resolved.props,
      surface.branches.map((entry) => ({
        tag: entry.tag,
        props: entry.branch.props ?? {},
      })),
      slotProps,
      surface.branches.flatMap((entry, index) => {
        const discriminant = discriminantOf(entry.branch);
        return discriminant?.kind === 'presence'
          ? [{ name: discriminant.name, branch: index }]
          : [];
      })
    );
    functionBlock = buildDiscriminatedFunction(
      resolved,
      surface,
      slotProps,
      context,
      aliases,
      twoWayBlocks
    );
  } else {
    // A conditional passthrough root renders its element alone, after an
    // early `return null` while the condition is false: the hooks of the
    // script and the two-way blocks all run above it.
    const returnLines =
      conditional === undefined
        ? buildReturn(resolved.children, emitStyleElement, context)
        : conditionalReturn(
            conditional,
            resolved.children,
            emitStyleElement,
            context
          );
    interfaceBlock = propsInterface(
      resolved.name,
      resolved.props,
      slotProps,
      passthroughTag,
      restTag,
      polymorphic,
      routed
    );
    functionBlock = buildFunction(
      { ...resolved, typeParameters },
      interfaceBlock !== undefined,
      returnLines,
      passthroughNode !== undefined,
      slotProps.map((slotProp) => slotProp.propName),
      componentBindings,
      aliases,
      stateBlocks,
      rootTagExpression,
      rootTagType,
      routed !== undefined
    );
  }
  // The component's description is its doc comment, above the function an
  // editor shows on hover; the props interface documents only its members.
  functionBlock = [
    ...documentationComment(resolved.description, ''),
    functionBlock,
  ].join('\n');

  // A generic component's props type takes its type parameters.
  if (interfaceBlock !== undefined) {
    interfaceBlock = interfaceBlock.replace(
      `${resolved.name}Props`,
      `${resolved.name}Props${typeParameterDeclarations(typeParameters)}`
    );
  }
  const importsBlock = buildImports(
    resolved,
    css,
    placement,
    options.styling.stylesheetLink,
    styleExtension,
    context,
    slotProps.length > 0,
    hasPassthrough,
    rootTagType !== undefined,
    polymorphic?.usesJsxNamespace === true,
    twoWayBindings.length > 0,
    routed !== undefined,
    declaredIds.length > 0
  );
  const stylesBlock = emitStyleElement
    ? `const componentStyles = \`\n${escapeTemplateLiteral(css)}\n\`;`
    : undefined;

  // `React.CSSProperties` carries no `--*` index signature, so an inline style
  // object with a CSS custom property is checked against a local widened type
  // instead (see CSS_CUSTOM_PROPERTY_STYLE_TYPE).
  const customPropertyStyleBlock = context.usesCssCustomProperty
    ? CSS_CUSTOM_PROPERTY_STYLE_TYPE
    : undefined;

  // A client module's directive must be the file's first statement, ahead of
  // every import. A component holding a two-way value holds state, so it is
  // always one.
  const clientBlock =
    (resolved.extensions['react'] as ReactComponentOverride | undefined)
      ?.client === true || twoWayBindings.length > 0
      ? "'use client';"
      : undefined;

  const composeHelperBlock =
    [
      ...(context.usesComposeHelper ? [composeEventHandlersDeclaration()] : []),
      ...(context.usesAuthoredOrConsumer
        ? [authoredOrConsumerDeclaration()]
        : []),
      ...(context.usesAuthoredAndConsumer
        ? [authoredAndConsumerDeclaration()]
        : []),
      ...(context.usesConsumerAndSpread
        ? [
            consumerAndSpreadDeclaration({
              classKey: 'className',
              style: 'object',
              handlerPattern: '/^on[A-Z]/',
            }),
          ]
        : []),
      ...(usesInvokeHandler(functionBlock) ? [invokeHandlerDeclaration()] : []),
      ...(context.usesComposeRefs ? [composeRefsDeclaration()] : []),
      ...(context.usesIndeterminateRef ? [indeterminateRefDeclaration()] : []),
      ...(routed !== undefined
        ? [consumerAttributesDeclaration(routed.entries, attributeName)]
        : []),
    ].join('\n\n') || undefined;

  const sections = [
    clientBlock,
    importsBlock,
    customPropertyStyleBlock,
    interfaceBlock,
    stylesBlock,
    composeHelperBlock,
    functionBlock,
  ].filter((section): section is string => section !== undefined);

  const files: OutputFile[] = [
    { path: `${resolved.name}.tsx`, content: `${sections.join('\n\n')}\n` },
  ];
  if (css !== '' && placement === 'separate-file') {
    files.push(...stylesheetFiles(resolved.name, css, options.styling));
  }

  return { files, warnings };
}

/** Node types whose single-line child rendering `{X}` is a valid expression unwrapped. */
function unwrapsToExpression(node: TemplateNode): boolean {
  return (
    node.type === 'conditional' ||
    node.type === 'iteration' ||
    node.type === 'slot' ||
    (node.type === 'text' && node.expression !== undefined)
  );
}

function buildReturn(
  children: TemplateNode[],
  emitStyleElement: boolean,
  context: JsxContext,
  lonePath = '[0]'
): string[] {
  const loneChild = children.length === 1 ? children[0] : undefined;

  if (!emitStyleElement && loneChild !== undefined) {
    if (loneChild.type === 'element' || loneChild.type === 'fragment') {
      const lines = renderJsxNode(loneChild, lonePath, 2, context);
      if (lines.length === 1) {
        const single = `${INDENTATION}return ${lines[0].trimStart()};`;
        if (single.length <= MAXIMUM_WIDTH) {
          return [single];
        }
      }
      return [`${INDENTATION}return (`, ...lines, `${INDENTATION});`];
    }
    if (unwrapsToExpression(loneChild)) {
      const lines = renderJsxNode(loneChild, '[0]', 2, context);
      if (lines.length === 1) {
        const rendered = lines[0].trimStart();
        const single = `${INDENTATION}return ${rendered.slice(1, -1)};`;
        if (
          rendered.startsWith('{') &&
          rendered.endsWith('}') &&
          single.length <= MAXIMUM_WIDTH
        ) {
          return [single];
        }
      }
      return [
        `${INDENTATION}return (`,
        `${INDENTATION.repeat(2)}<>`,
        ...reindent(lines, 1),
        `${INDENTATION.repeat(2)}</>`,
        `${INDENTATION});`,
      ];
    }
  }

  const siblings = renderJsxSiblings(children, '', 3, context);
  const inner: SiblingLines = emitStyleElement
    ? joinSiblingLines(
        [
          tagLines([
            `${INDENTATION.repeat(3)}<style>{componentStyles}</style>`,
          ]),
          siblings,
        ],
        'between-tags'
      )
    : siblings;
  return [
    `${INDENTATION}return (`,
    ...wrapJsxChildren(
      [`${INDENTATION.repeat(2)}<>`],
      inner,
      `${INDENTATION.repeat(2)}</>`
    ),
    `${INDENTATION});`,
  ];
}

/**
 * The return of a conditional passthrough root: `return null` while the `if`
 * condition is false, then the passthrough element as the component's lone
 * root.
 */
function conditionalReturn(
  conditional: ConditionalPassthrough,
  children: readonly TemplateNode[],
  emitStyleElement: boolean,
  context: JsxContext
): string[] {
  const branch = conditional.conditional.conditions[0];
  const elementPath =
    `[${children.indexOf(conditional.conditional)}]` +
    `.conditions[0].children[${branch.children.indexOf(conditional.element)}]`;
  return [
    `${INDENTATION}if (${negatedRootCondition(branch, context)}) {`,
    `${INDENTATION.repeat(2)}return null;`,
    `${INDENTATION}}`,
    '',
    ...buildReturn(
      [conditional.element],
      emitStyleElement,
      context,
      elementPath
    ),
  ];
}

function reindent(lines: string[], levels: number): string[] {
  const prefix = INDENTATION.repeat(levels);
  return lines.map((line) => (line === '' ? line : `${prefix}${line}`));
}

function buildFunction(
  component: NormalizedComponent,
  hasProps: boolean,
  returnLines: string[],
  passthrough: boolean,
  slotPropNames: readonly string[],
  bindings: readonly string[],
  aliases: ReadonlyMap<string, string>,
  twoWayBlocks: readonly string[][],
  rootTagExpression?: string,
  rootTagType?: string,
  routed = false
): string {
  const sections: string[][] = [];

  const destructuring = propsDestructuring(
    component.props,
    passthrough,
    slotPropNames,
    component.rest !== undefined,
    aliases,
    routed
  );
  if (destructuring !== undefined) {
    sections.push([
      `${INDENTATION}${destructuring}`,
      ...(routed
        ? routedRestStatements(component.name).map(
            (statement) => `${INDENTATION}${statement}`
          )
        : []),
    ]);
  }

  // Each two-way prop's value and setter, ahead of everything that may read
  // them.
  for (const block of twoWayBlocks) {
    sections.push(reindent(block, 1));
  }

  // A dynamic root tag is hoisted to a capitalized local so JSX renders it as
  // a dynamic tag. On a passthrough surface the local is cast to
  // `rootTagType` - `ElementType<ComponentPropsWithRef<'<default>'>>`, so the
  // union-tag root still accepts `ref`/`{...rest}` typed against the default
  // tag, or a bare `ElementType` on a polymorphic root, whose props follow
  // its type parameter instead. The expression is parenthesized before the
  // cast - `as` binds tighter than `?:`/`??`, so an unwrapped conditional
  // expression (`visual ? 'div' : 'button'`) would cast only its last branch.
  if (rootTagExpression !== undefined) {
    const annotated =
      rootTagType !== undefined
        ? `(${rootTagExpression}) as ${rootTagType}`
        : rootTagExpression;
    sections.push([`${INDENTATION}const RootTag = ${annotated};`]);
  }

  if (component.bemRuntime !== undefined) {
    sections.push([
      `${INDENTATION}const bem = ${bemSetupCall(component.bemRuntime)};`,
    ]);
  }

  if (component.script !== undefined && component.script.trim() !== '') {
    sections.push(reindent(component.script.trim().split('\n'), 1));
  }

  // Dynamic tags below the root, bound after the script so an expression may
  // read what it declares.
  if (bindings.length > 0) {
    sections.push(bindings.map((binding) => `${INDENTATION}${binding}`));
  }

  sections.push(returnLines);

  const parameter = hasProps
    ? `props: ${component.name}Props${typeParameterArguments(component.typeParameters)}`
    : '';
  const body = sections.flatMap((section, index) =>
    index === 0 ? section : ['', ...section]
  );
  return [
    `export function ${component.name}${typeParameterDeclarations(component.typeParameters)}(${parameter}) {`,
    ...body,
    '}',
  ].join('\n');
}

/**
 * Builds the component function for a discriminated surface root: a narrowed
 * `if (<discriminant>) { ... return <branchElement> }` per branch, each
 * destructuring the shared and branch props (plus the surface contract's
 * `className`/`style`/`ref`/`...rest`) and returning that branch's passthrough
 * element. The trailing `else` branch falls through to a final return.
 */
function buildDiscriminatedFunction(
  component: NormalizedComponent,
  surface: DiscriminatedSurface,
  slotProps: SlotProp[],
  context: JsxContext,
  aliases: ReadonlyMap<string, string>,
  twoWayBlocks: readonly string[][]
): string {
  const slotPropNames = slotProps.map((slotProp) => slotProp.propName);
  const lines: string[] = [
    `export function ${component.name}${typeParameterDeclarations(component.typeParameters)}(props: ${component.name}Props${typeParameterArguments(component.typeParameters)}) {`,
  ];

  if (component.bemRuntime !== undefined) {
    lines.push(
      `${INDENTATION}const bem = ${bemSetupCall(component.bemRuntime)};`
    );
  }

  // Each two-way prop's value and setter, ahead of the branches like the
  // script, reading the props through `props`.
  for (const block of twoWayBlocks) {
    lines.push(...reindent(block, 1), '');
  }

  // The component's script runs once, ahead of the branches: inside one it
  // would make any hook it calls conditional. It reads props through `props`,
  // since each branch destructures its own.
  if (component.script !== undefined && component.script.trim() !== '') {
    lines.push(...reindent(component.script.trim().split('\n'), 1), '');
  }

  surface.branches.forEach((entry, index) => {
    const { branch, element } = entry;
    const isElse = branch.statement === 'else';
    const baseIndent = isElse ? 1 : 2;
    const branchProps = { ...component.props, ...(branch.props ?? {}) };
    const destructuring = propsDestructuring(
      branchProps,
      true,
      slotPropNames,
      false,
      aliases
    );
    const branchBindings: string[] = [];
    const branchContext: JsxContext = {
      ...context,
      passthroughNode: element,
      destructuredNames: new Set([
        ...Object.keys(branchProps),
        ...slotPropNames,
      ]),
      scopeBindings: branchBindings,
    };
    const elementLines = renderJsxNode(
      element,
      `[0].conditions[${index}].children[0]`,
      baseIndent + 1,
      branchContext
    );
    // The branch renders against its own context copy; what it found it needs
    // (a type, a helper, an import) is declared once for the whole file.
    context.usesFragmentImport ||= branchContext.usesFragmentImport;
    context.usesCssCustomProperty ||= branchContext.usesCssCustomProperty;
    context.usesComposeHelper ||= branchContext.usesComposeHelper;
    context.usesAuthoredOrConsumer ||= branchContext.usesAuthoredOrConsumer;
    context.usesAuthoredAndConsumer ||= branchContext.usesAuthoredAndConsumer;
    context.usesConsumerAndSpread ||= branchContext.usesConsumerAndSpread;
    context.usesComposeRefs ||= branchContext.usesComposeRefs;
    context.usesIndeterminateRef ||= branchContext.usesIndeterminateRef;
    const returnLines = wrapReturn(elementLines, baseIndent);

    if (index > 0) {
      lines.push('');
    }
    const bindingLines = (depth: number): string[] =>
      branchBindings.map((binding) => `${INDENTATION.repeat(depth)}${binding}`);
    if (isElse) {
      if (destructuring !== undefined) {
        lines.push(`${INDENTATION}${destructuring}`);
      }
      lines.push(...bindingLines(1));
      lines.push(...returnLines);
    } else {
      // The discriminant drives both the runtime branch and the union
      // narrowing, so it must read off `props` (the branch destructures from
      // `props` below, so the bare name is not yet in scope): a literal
      // discriminant by truthiness, a presence one by `!== undefined`, which
      // narrows a union whose other members type the prop `?: undefined`.
      const discriminant = discriminantOf(branch);
      const condition =
        discriminant === undefined
          ? branch.condition
          : discriminant.kind === 'presence'
            ? `props.${discriminant.name} !== undefined`
            : `props.${discriminant.name}`;
      lines.push(`${INDENTATION}if (${condition}) {`);
      if (destructuring !== undefined) {
        lines.push(`${INDENTATION.repeat(2)}${destructuring}`);
      }
      lines.push(...bindingLines(2));
      lines.push(...returnLines);
      lines.push(`${INDENTATION}}`);
    }
  });

  lines.push('}');
  return lines.join('\n');
}

/** Wraps rendered element lines in a `return ( ... );`, inlining when it fits. */
function wrapReturn(elementLines: string[], baseIndent: number): string[] {
  const padding = INDENTATION.repeat(baseIndent);
  if (elementLines.length === 1) {
    const single = `${padding}return ${elementLines[0].trimStart()};`;
    if (single.length <= MAXIMUM_WIDTH) {
      return [single];
    }
  }
  return [`${padding}return (`, ...elementLines, `${padding});`];
}

function buildImports(
  component: NormalizedComponent,
  css: string,
  placement: string,
  stylesheetLink: StylesheetLink,
  styleExtension: string,
  context: JsxContext,
  hasSlotProps: boolean,
  hasPassthrough: boolean,
  usesElementType: boolean,
  usesJsxNamespace: boolean,
  usesState: boolean,
  routed: boolean,
  usesId: boolean
): string | undefined {
  const lines: string[] = [];

  // Value imports keep the `import { Fragment }` form; a `react` import with
  // only type members stays an `import type { ... }`.
  const valueImports: string[] = [];
  const typeImports: string[] = [];
  if (context.usesFragmentImport) {
    valueImports.push('Fragment');
  }
  // A two-way prop's own copy is React state and its latest value a ref; an
  // author's import of `useState` or `useRef` already binds it.
  const { importStatements: authoredImports } = partitionImports(
    component.imports
  );
  if (usesState) {
    const authored = importedNames(authoredImports);
    for (const name of ['useRef', 'useState']) {
      if (!authored.has(name)) {
        valueImports.push(name);
      }
    }
  }
  // A declared id comes from `useId()`; an author's import of it already
  // binds it.
  if (usesId && !importedNames(authoredImports).has('useId')) {
    valueImports.push('useId');
  }
  if (hasSlotProps) {
    typeImports.push('ReactNode');
  }
  if (hasPassthrough) {
    typeImports.push('ComponentPropsWithRef');
  }
  if (routed) {
    typeImports.push('ComponentPropsWithoutRef');
  }
  if (usesElementType) {
    typeImports.push('ElementType');
  }
  if (usesJsxNamespace) {
    typeImports.push('JSX');
  }
  if (context.usesCssCustomProperty) {
    typeImports.push('CSSProperties');
  }
  if (context.usesComposeRefs) {
    typeImports.push('Ref', 'RefCallback');
  } else if (context.usesIndeterminateRef) {
    typeImports.push('RefCallback');
  }
  // The import statements come first and the declarations written among
  // them after, so every import heads the file.
  const { importStatements, declarations } = partitionImports(
    component.imports
  );
  const generated = [
    ...valueImports.map((name) => ({ name, typeOnly: false })),
    ...typeImports.map((name) => ({ name, typeOnly: true })),
  ];
  const { statement: reactImport, merged } = reactImportStatement(
    generated,
    importStatements
  );
  if (reactImport !== undefined) {
    lines.push(reactImport);
  }

  if (component.bemRuntime !== undefined) {
    lines.push(
      `import { useBem } from '${component.bemRuntime.importSource}/react';`
    );
  }

  lines.push(
    ...importStatements.filter((statement) => !merged.includes(statement))
  );

  // Under `stylesheetLink: 'none'` the stylesheet is still emitted; the
  // component just does not import it, leaving that to the consumer.
  if (
    css !== '' &&
    placement === 'separate-file' &&
    stylesheetLink === 'component'
  ) {
    lines.push(`import './${component.name}.${styleExtension}';`);
  }

  const sections = [lines, declarations]
    .filter((section) => section.length > 0)
    .map((section) => section.join('\n'));
  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

/** One member of a named import: its specifier as written, and whether it
 *  imports a type only. */
interface ImportMember {
  name: string;
  typeOnly: boolean;
}

/** An import of named members from `react` alone, with `import type` or
 *  without: no default or namespace import, and no comment. */
const NAMED_REACT_IMPORT =
  /^import\s+(type\s+)?\{([^{}]*)\}\s*from\s*(['"])react\3\s*;?$/;

/** Any import statement whose source is `react`. */
const REACT_IMPORT_SOURCE = /^import\b[^]*\bfrom\s*(['"])react\1\s*;?$/;

/**
 * The component's one import from `react`: the members it needs, followed by
 * those of each authored import of named members from `react`, which it
 * replaces, so the file imports from `react` once. A member keeps its type
 * modifier: every member a type is `import type { ... }`, otherwise each type
 * reads `type Name`. A member an authored import already names is not
 * repeated, nor is one two authored imports name. An authored import with a
 * comment in its braces, or binding a generated member's name to another
 * export or with another `type` modifier, stays as written; so does one
 * with a default or namespace binding (`import React, { Fragment } from
 * 'react'`), and the generated import leaves out the members it binds.
 * Past 80 columns each member takes a line of its own. Without generated
 * members the authored imports stay as written.
 *
 * @param generated - The members the component needs from `react`.
 * @param authored - The template's own import statements.
 * @returns The statement, or `undefined` when nothing is imported, and the
 *   authored statements it replaces.
 */
function reactImportStatement(
  generated: readonly ImportMember[],
  authored: readonly string[]
): { statement: string | undefined; merged: string[] } {
  if (generated.length === 0) {
    return { statement: undefined, merged: [] };
  }
  const merged: string[] = [];
  const authoredMembers: ImportMember[] = [];
  const generatedByLocal = new Map(
    generated.map((member) => [localName(member), member])
  );
  // A `react` import the merge leaves as written - one with a default or
  // namespace binding, or a comment inside its braces - still binds its
  // members, so the generated import leaves out the ones it already binds.
  const boundElsewhere = new Set<string>();
  for (const statement of authored) {
    const match = NAMED_REACT_IMPORT.exec(statement.trim());
    // A comment inside the braces would be lost in the merge.
    if (match === null || /\/[/*]/.test(match[2])) {
      if (REACT_IMPORT_SOURCE.test(statement.trim())) {
        for (const name of importedNames([statement])) {
          boundElsewhere.add(name);
        }
      }
      continue;
    }
    const statementTypeOnly = match[1] !== undefined;
    const members: ImportMember[] = [];
    for (const specifier of match[2].split(',')) {
      const text = specifier.trim().replace(/\s+/g, ' ');
      if (text === '') {
        continue;
      }
      members.push({
        name: text.replace(/^type\s+/, ''),
        typeOnly: statementTypeOnly || /^type\s/.test(text),
      });
    }
    // A member binding a generated member's name to something else - another
    // export, or a type where a value is generated - is the author's to
    // resolve, so its statement stays as written.
    const conflicts = members.some((member) => {
      const twin = generatedByLocal.get(localName(member));
      return (
        twin !== undefined &&
        (twin.name !== member.name || twin.typeOnly !== member.typeOnly)
      );
    });
    if (conflicts) {
      continue;
    }
    merged.push(statement);
    authoredMembers.push(...members);
  }
  const authoredLocals = new Set<string>();
  const uniqueAuthored = authoredMembers.filter((member) => {
    const local = localName(member);
    if (authoredLocals.has(local)) {
      return false;
    }
    authoredLocals.add(local);
    return true;
  });
  const members = [
    ...generated.filter(
      (member) =>
        !authoredLocals.has(localName(member)) &&
        !boundElsewhere.has(localName(member))
    ),
    ...uniqueAuthored,
  ];
  if (members.length === 0) {
    return { statement: undefined, merged };
  }
  const typeOnly = members.every((member) => member.typeOnly);
  const specifiers = members.map((member) =>
    member.typeOnly && !typeOnly ? `type ${member.name}` : member.name
  );
  const keyword = typeOnly ? 'import type' : 'import';
  const single = `${keyword} { ${specifiers.join(', ')} } from 'react';`;
  // Past the line width each member takes a line of its own, as Prettier
  // writes it.
  const statement =
    single.length <= MAXIMUM_WIDTH
      ? single
      : `${keyword} {\n${specifiers.map((specifier) => `${INDENTATION}${specifier},`).join('\n')}\n} from 'react';`;
  return { statement, merged };
}

/** The name an import member binds: its `as` name, or its own. */
function localName(member: ImportMember): string {
  const parts = member.name.split(/\s+as\s+/);
  return parts[parts.length - 1];
}

/**
 * The runtime helper setup expression for a component, e.g.
 * `useBem('Badge')` or `useBem('Badge', { elementSeparator: '-' })`.
 */
function bemSetupCall(binding: BemRuntimeBinding): string {
  return `useBem('${binding.block}'${bemConfigurationArgument(binding)})`;
}

/**
 * The trailing configuration argument for a runtime helper call, present only when a
 * separator differs from the helper's defaults (`__` / `--`).
 */
function bemConfigurationArgument(binding: BemRuntimeBinding): string {
  const entries: string[] = [];
  if (binding.elementSeparator !== '__') {
    entries.push(`elementSeparator: '${binding.elementSeparator}'`);
  }
  if (binding.modifierSeparator !== '--') {
    entries.push(`modifierSeparator: '${binding.modifierSeparator}'`);
  }
  return entries.length > 0 ? `, { ${entries.join(', ')} }` : '';
}
