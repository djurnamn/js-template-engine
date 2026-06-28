import {
  collectCss,
  discriminatedSurfaceOf,
  dynamicRootTagExpressionOf,
  passthroughNodeOf,
  planTargets,
  resolveComponentOverrides,
  staticTagOf,
  type BemRuntimeBinding,
  type DiscriminatedSurface,
  type FrameworkExtension,
  type NormalizedComponent,
  type ResolvedProcessingOptions,
} from '@js-template-engine/core';
import type {
  OutputFile,
  ProcessResult,
  TemplateNode,
  Warning,
} from '@js-template-engine/types';

import { renderJsxNode, renderJsxNodes, type JsxContext } from './jsx';
import { escapeTemplateLiteral } from './literals';
import {
  collectSlotProps,
  discriminatedPropsInterface,
  propsDestructuring,
  propsInterface,
  type SlotProp,
} from './props';

/** The React framework extension. */
export interface ReactExtension extends FrameworkExtension {
  readonly key: 'react';
}

/**
 * Creates the React framework extension.
 *
 * Renders a template as a React function component in TypeScript
 * (`<Name>.tsx`): a generated props interface with destructured defaults,
 * slots as props (the default slot as `children`), conditional rendering,
 * keyed list rendering, and event props with modifiers applied in generated
 * handlers.
 *
 * Styling supports all three output strategies: `inline` renders plain
 * style properties as `style={{ ... }}` objects, `in-file` embeds the
 * collected CSS through a rendered `<style>` element, and `separate-file`
 * emits `<Name>.css` with an import. Scripting supports only `in-file` - 
 * component script content lives in the component function, where React
 * event props expect their handlers in scope.
 *
 * @example
 * const result = process(template, { extensions: [react()] });
 * // result.files[0] = { path: 'Button.tsx', content: '...' }
 */
export function react(): ReactExtension {
  return {
    key: 'react',
    kind: 'framework',
    unsupportedStrategies: { scripting: ['inline', 'separate-file'] },
    render: renderReactComponent,
  };
}

const INDENTATION = '  ';
const MAX_WIDTH = 80;

/**
 * Module augmentation admitting CSS custom properties (`--*`) in inline `style`
 * object literals. Emitted only in components that use one - `React.CSSProperties`
 * has no `--*` index signature, so the literal otherwise fails a consumer's
 * `tsc` on the typed-import path. Adds permissiveness for custom properties only;
 * standard-property checking is unchanged.
 */
const CSS_CUSTOM_PROPERTY_AUGMENTATION = [
  "declare module 'react' {",
  `${INDENTATION}interface CSSProperties {`,
  `${INDENTATION.repeat(2)}[key: \`--\${string}\`]: string | number | undefined;`,
  `${INDENTATION}}`,
  '}',
].join('\n');

function renderReactComponent(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions
): ProcessResult {
  const warnings: Warning[] = [];
  const resolved = resolveComponentOverrides(component, 'react');
  const stylingStrategy = options.styling.outputStrategy;
  const styleExtension = options.styling.language === 'scss' ? 'scss' : 'css';

  const plan = planTargets(
    resolved.children,
    stylingStrategy,
    'inline',
    resolved.selectorClasses
  );
  const css = collectCss(resolved, plan, stylingStrategy, options.styling.language);
  const slotProps = collectSlotProps(resolved.children, resolved.props);
  const surface = discriminatedSurfaceOf(resolved.children);
  const passthroughNode = passthroughNodeOf(resolved.children);
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

  const context: JsxContext = {
    plan,
    stylingInline: stylingStrategy === 'inline',
    slotPropNames: new Map(
      slotProps.map((slotProp) => [slotProp.slotName, slotProp.propName])
    ),
    slotExposes: new Map(
      slotProps.map((slotProp) => [slotProp.slotName, slotProp.exposes])
    ),
    namedSlots: new Set(
      slotProps
        .map((slotProp) => slotProp.slotName)
        .filter((slotName): slotName is string => slotName !== undefined)
    ),
    usesFragmentImport: false,
    usesCssCustomProperty: false,
    passthroughNode,
    bemRuntimeCalls: resolved.bemRuntimeCalls,
    warnings,
  };

  const hasPassthrough = passthroughNode !== undefined || surface !== undefined;
  // A discriminated surface root returns a single element per branch, so there
  // is no fragment to host an in-file `<style>`; its CSS rides `inline` or
  // `separate-file` styling instead.
  const emitStyleElement =
    surface === undefined && css !== '' && stylingStrategy !== 'separate-file';

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
      slotProps
    );
    functionBlock = buildDiscriminatedFunction(
      resolved,
      surface,
      slotProps,
      context
    );
  } else {
    const returnLines = buildReturn(resolved.children, emitStyleElement, context);
    interfaceBlock = propsInterface(
      resolved.name,
      resolved.props,
      slotProps,
      passthroughTag
    );
    functionBlock = buildFunction(
      resolved,
      interfaceBlock !== undefined,
      returnLines,
      passthroughNode !== undefined,
      slotProps.map((slotProp) => slotProp.propName),
      rootTagExpression,
      dynamicRootPassthroughTag
    );
  }
  const importsBlock = buildImports(
    resolved,
    css,
    stylingStrategy,
    styleExtension,
    context,
    slotProps.length > 0,
    hasPassthrough,
    dynamicRootPassthroughTag !== undefined
  );
  const stylesBlock = emitStyleElement
    ? `const styles = \`\n${escapeTemplateLiteral(css)}\n\`;`
    : undefined;

  // `React.CSSProperties` carries no `--*` index signature, so an inline style
  // object with a CSS custom property does not type-check when the output is
  // consumed as a typed import. Augment `CSSProperties` to admit custom
  // properties while leaving standard-property checking intact.
  const augmentationBlock = context.usesCssCustomProperty
    ? CSS_CUSTOM_PROPERTY_AUGMENTATION
    : undefined;

  const sections = [
    importsBlock,
    augmentationBlock,
    interfaceBlock,
    stylesBlock,
    functionBlock,
  ].filter((section): section is string => section !== undefined);

  const files: OutputFile[] = [
    { path: `${resolved.name}.tsx`, content: `${sections.join('\n\n')}\n` },
  ];
  if (css !== '' && stylingStrategy === 'separate-file') {
    files.push({
      path: `${resolved.name}.${styleExtension}`,
      content: `${css}\n`,
    });
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
  context: JsxContext
): string[] {
  const loneChild = children.length === 1 ? children[0] : undefined;

  if (!emitStyleElement && loneChild !== undefined) {
    if (loneChild.type === 'element' || loneChild.type === 'fragment') {
      const lines = renderJsxNode(loneChild, '[0]', 2, context);
      if (lines.length === 1) {
        const single = `${INDENTATION}return ${lines[0].trimStart()};`;
        if (single.length <= MAX_WIDTH) {
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
        if (rendered.startsWith('{') && rendered.endsWith('}') && single.length <= MAX_WIDTH) {
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

  const inner: string[] = [];
  if (emitStyleElement) {
    inner.push(`${INDENTATION.repeat(3)}<style>{styles}</style>`);
  }
  inner.push(...renderJsxNodes(children, '', 3, context));
  return [
    `${INDENTATION}return (`,
    `${INDENTATION.repeat(2)}<>`,
    ...inner,
    `${INDENTATION.repeat(2)}</>`,
    `${INDENTATION});`,
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
  rootTagExpression?: string,
  dynamicRootPassthroughTag?: string
): string {
  const sections: string[][] = [];

  const destructuring = propsDestructuring(
    component.props,
    passthrough,
    slotPropNames
  );
  if (destructuring !== undefined) {
    sections.push([`${INDENTATION}${destructuring}`]);
  }

  // A dynamic root tag is hoisted to a capitalized local so JSX renders it as
  // a dynamic tag. On a passthrough surface the local is annotated
  // `ElementType<ComponentPropsWithRef<'<default>'>>` so the union-tag root
  // still accepts `ref`/`{...rest}` typed against the default tag. The
  // expression is parenthesized before the cast - `as` binds tighter than
  // `?:`/`??`, so an unwrapped conditional expression
  // (`visual ? 'div' : 'button'`) would cast only its last branch.
  if (rootTagExpression !== undefined) {
    const annotated =
      dynamicRootPassthroughTag !== undefined
        ? `(${rootTagExpression}) as ElementType<ComponentPropsWithRef<'${dynamicRootPassthroughTag}'>>`
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

  sections.push(returnLines);

  const parameter = hasProps ? `props: ${component.name}Props` : '';
  const body = sections.flatMap((section, index) =>
    index === 0 ? section : ['', ...section]
  );
  return [`export function ${component.name}(${parameter}) {`, ...body, '}'].join('\n');
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
  context: JsxContext
): string {
  const slotPropNames = slotProps.map((slotProp) => slotProp.propName);
  const lines: string[] = [
    `export function ${component.name}(props: ${component.name}Props) {`,
  ];

  if (component.bemRuntime !== undefined) {
    lines.push(`${INDENTATION}const bem = ${bemSetupCall(component.bemRuntime)};`);
  }

  surface.branches.forEach((entry, index) => {
    const { branch, element } = entry;
    const isElse = branch.statement === 'else';
    const baseIndent = isElse ? 1 : 2;
    const branchProps = { ...component.props, ...(branch.props ?? {}) };
    const destructuring = propsDestructuring(branchProps, true, slotPropNames);
    const branchContext: JsxContext = { ...context, passthroughNode: element };
    const elementLines = renderJsxNode(
      element,
      `[0].conditions[${index}].children[0]`,
      baseIndent + 1,
      branchContext
    );
    const returnLines = wrapReturn(elementLines, baseIndent);

    if (index > 0) {
      lines.push('');
    }
    if (isElse) {
      if (destructuring !== undefined) {
        lines.push(`${INDENTATION}${destructuring}`);
      }
      lines.push(...returnLines);
    } else {
      // The discriminant drives both the runtime branch and the union
      // narrowing, so it must read off `props` (the branch destructures from
      // `props` below, so the bare name is not yet in scope). A bare-identifier
      // condition is prefixed; any other expression is emitted verbatim.
      const condition = /^[A-Za-z_$][\w$]*$/.test(branch.condition ?? '')
        ? `props.${branch.condition}`
        : branch.condition;
      lines.push(`${INDENTATION}if (${condition}) {`);
      if (destructuring !== undefined) {
        lines.push(`${INDENTATION.repeat(2)}${destructuring}`);
      }
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
    if (single.length <= MAX_WIDTH) {
      return [single];
    }
  }
  return [`${padding}return (`, ...elementLines, `${padding});`];
}

function buildImports(
  component: NormalizedComponent,
  css: string,
  stylingStrategy: string,
  styleExtension: string,
  context: JsxContext,
  hasSlotProps: boolean,
  hasPassthrough: boolean,
  usesElementType: boolean
): string | undefined {
  const lines: string[] = [];

  // Value imports keep the `import { Fragment }` form; a `react` import with
  // only type members stays an `import type { ... }`.
  const valueImports: string[] = [];
  const typeImports: string[] = [];
  if (context.usesFragmentImport) {
    valueImports.push('Fragment');
  }
  if (hasSlotProps) {
    typeImports.push('ReactNode');
  }
  if (hasPassthrough) {
    typeImports.push('ComponentPropsWithRef');
  }
  if (usesElementType) {
    typeImports.push('ElementType');
  }
  if (valueImports.length > 0) {
    const members = [
      ...valueImports,
      ...typeImports.map((name) => `type ${name}`),
    ];
    lines.push(`import { ${members.join(', ')} } from 'react';`);
  } else if (typeImports.length > 0) {
    lines.push(`import type { ${typeImports.join(', ')} } from 'react';`);
  }

  if (component.bemRuntime !== undefined) {
    lines.push(
      `import { useBem } from '${component.bemRuntime.importSource}/react';`
    );
  }

  lines.push(...component.imports);

  if (css !== '' && stylingStrategy === 'separate-file') {
    lines.push(`import './${component.name}.${styleExtension}';`);
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
}

/**
 * The runtime helper setup expression for a component, e.g.
 * `useBem('Badge')` or `useBem('Badge', { elementSeparator: '-' })`.
 */
function bemSetupCall(binding: BemRuntimeBinding): string {
  return `useBem('${binding.block}'${bemConfigArgument(binding)})`;
}

/**
 * The trailing config argument for a runtime helper call, present only when a
 * separator differs from the helper's defaults (`__` / `--`).
 */
function bemConfigArgument(binding: BemRuntimeBinding): string {
  const entries: string[] = [];
  if (binding.elementSeparator !== '__') {
    entries.push(`elementSeparator: '${binding.elementSeparator}'`);
  }
  if (binding.modifierSeparator !== '--') {
    entries.push(`modifierSeparator: '${binding.modifierSeparator}'`);
  }
  return entries.length > 0 ? `, { ${entries.join(', ')} }` : '';
}
