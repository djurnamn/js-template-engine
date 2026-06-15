import {
  collectCss,
  dynamicRootTagExpressionOf,
  passthroughNodeOf,
  planTargets,
  resolveComponentOverrides,
  staticTagOf,
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
  propsDestructuring,
  propsInterface,
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
 * emits `<Name>.css` with an import. Scripting supports only `in-file` —
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
  const passthroughNode = passthroughNodeOf(resolved.children);
  const rootTagExpression = dynamicRootTagExpressionOf(resolved.children);

  const context: JsxContext = {
    plan,
    stylingInline: stylingStrategy === 'inline',
    slotPropNames: new Map(
      slotProps.map((slotProp) => [slotProp.slotName, slotProp.propName])
    ),
    usesFragmentImport: false,
    passthroughNode,
    warnings,
  };

  const emitStyleElement = css !== '' && stylingStrategy !== 'separate-file';
  const returnLines = buildReturn(resolved.children, emitStyleElement, context);

  const interfaceBlock = propsInterface(
    resolved.name,
    resolved.props,
    slotProps,
    passthroughNode ? staticTagOf(passthroughNode.tag) : undefined
  );
  const functionBlock = buildFunction(
    resolved,
    interfaceBlock !== undefined,
    returnLines,
    passthroughNode !== undefined,
    slotProps.map((slotProp) => slotProp.propName),
    rootTagExpression
  );
  const importsBlock = buildImports(
    resolved,
    css,
    stylingStrategy,
    styleExtension,
    context,
    slotProps.length > 0,
    passthroughNode !== undefined
  );
  const stylesBlock = emitStyleElement
    ? `const styles = \`\n${escapeTemplateLiteral(css)}\n\`;`
    : undefined;

  const sections = [importsBlock, interfaceBlock, stylesBlock, functionBlock]
    .filter((section): section is string => section !== undefined);

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
  rootTagExpression?: string
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
  // a dynamic tag; the expression is emitted verbatim.
  if (rootTagExpression !== undefined) {
    sections.push([`${INDENTATION}const RootTag = ${rootTagExpression};`]);
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

function buildImports(
  component: NormalizedComponent,
  css: string,
  stylingStrategy: string,
  styleExtension: string,
  context: JsxContext,
  hasSlotProps: boolean,
  hasPassthrough: boolean
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
  if (valueImports.length > 0) {
    const members = [
      ...valueImports,
      ...typeImports.map((name) => `type ${name}`),
    ];
    lines.push(`import { ${members.join(', ')} } from 'react';`);
  } else if (typeImports.length > 0) {
    lines.push(`import type { ${typeImports.join(', ')} } from 'react';`);
  }

  lines.push(...component.imports);

  if (css !== '' && stylingStrategy === 'separate-file') {
    lines.push(`import './${component.name}.${styleExtension}';`);
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
}
