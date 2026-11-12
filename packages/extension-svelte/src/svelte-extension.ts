import {
  collectCss,
  collectNamedSlotNames,
  declaredIdsOf,
  derivedValuesOf,
  discriminatedSurfaceOf,
  flattenDiscriminatedProps,
  isDynamicTag,
  partitionImports,
  passthroughNodeOf,
  planTargets,
  staticTagOf,
  layerOrderModuleFiles,
  stylesheetFiles,
  relayedBindingsOf,
  twoWayBindingsOf,
  type BemRuntimeBinding,
  type TargetExtension,
  type NormalizedComponent,
  type ResolvedProcessingOptions,
} from '@js-template-engine/core';
import {
  dynamicElementTypeOf,
  elementTypeOf,
  isInsideConditional,
  invokeHandlerDeclaration,
  usesInvokeHandler,
  authoredAndConsumerDeclaration,
  authoredOrConsumerDeclaration,
  consumerAndSpreadDeclaration,
  consumerAttributesDeclaration,
  COMPONENT_OVERRIDE_KEYS,
  conditionalPassthroughOf,
  GENERATED_ID_NEXT_NAME,
  GENERATED_ID_NAME,
  idExpression,
  nextGeneratedIdDeclaration,
  TARGET_NODE_OVERRIDE_KEYS,
  routedElementOf,
  propAliases,
  scriptDeclarations,
  twoWayCodeProps,
  typeParameterScriptAttribute,
  withoutRemovedBemRuntimeCalls,
} from '@js-template-engine/core/emitter';
import type {
  ElementNode,
  OutputFile,
  ProcessResult,
  PropDefinition,
  TemplateNode,
  Warning,
} from '@js-template-engine/types';

import {
  composeEventHandlersDeclaration,
  onceHelperDeclaration,
} from './events';
import {
  DYNAMIC_ROOT_BINDING,
  renderNodes,
  STYLE_SERIALIZER_NAME,
  CONSUMER_STYLE_VALUE_NAME,
  svelteRemovesClass,
  type SvelteContext,
  scopedNodesOf,
} from './markup';
import {
  exportLetDeclarations,
  passthroughDeclarations,
  restWithoutSlotContentStatement,
} from './props';
import {
  collectSnippetProps,
  runesPropsDeclaration,
  runesPropsDestructure,
  type PassthroughSurfaceTypes,
  type SnippetProp,
} from './runes-props';
import { serializeJavaScriptValue } from './literals';
import {
  resolveSvelteOverrides,
  SVELTE_MODE_OVERRIDE_KEYS,
} from './mode-overrides';
import { svelteReservedNames } from './reserved-names';
import { relayedStatements, twoWayStatements } from './two-way';

/** The Svelte dialects the extension can emit. */
export const svelteModes = ['legacy', 'runes'] as const;

/** One of the Svelte dialects the extension can emit. */
export type SvelteMode = (typeof svelteModes)[number];

/** Options for the Svelte extension. */
export interface SvelteOptions {
  /**
   * The Svelte dialect of the generated components. `'legacy'` (default)
   * emits `export let` prop declarations, `<slot>` elements, and `on:event`
   * directive bindings. `'runes'` emits Svelte 5 runes components: a typed
   * `Props` interface destructured from `$props()`, a `$bindable()` DOM
   * handle, snippet props rendered through `{@render}`, and `onevent`
   * attribute bindings with generated modifier wrappers.
   */
  mode?: SvelteMode;
}

/** The Svelte target extension. */
export interface SvelteExtension extends TargetExtension {
  readonly key: 'svelte';
}

/**
 * Creates the Svelte target extension.
 *
 * Renders a template as a Svelte component (`<Name>.svelte`): a
 * `<script lang="ts">` block with typed prop declarations, top-level
 * markup with block-based conditionals (`{#if}`), list rendering
 * (`{#each}` + key), slots, event bindings, and a `<style>` block. The
 * `mode` option selects the emitted dialect: legacy Svelte components
 * (`export let`, `<slot>`, `on:event`) or Svelte 5 runes components
 * (`$props()`, snippets and `{@render}`, `onevent` attributes).
 *
 * Styling supports all three stylesheet placements. Handlers live in
 * `<script>`, where the markup's event bindings resolve them.
 *
 * @example
 * const result = process(template, { extensions: [svelte()] });
 * // result.files[0] = { path: 'Button.svelte', content: '...' }
 *
 * @example
 * // Svelte 5 runes components:
 * const result = process(template, { extensions: [svelte({ mode: 'runes' })] });
 */
export function svelte(options: SvelteOptions = {}): SvelteExtension {
  const mode = options.mode ?? 'legacy';
  return {
    key: 'svelte',
    kind: 'target',
    restClassAndStyle: {
      classKey: 'class',
      styleString: true,
      styleDirectives: true,
    },
    compilesInDocumentStyles: true,
    overrideKeys: {
      node: [...TARGET_NODE_OVERRIDE_KEYS, 'ignore'],
      component: [...COMPONENT_OVERRIDE_KEYS, ...SVELTE_MODE_OVERRIDE_KEYS],
    },
    // Runes mode takes each instance's id from `$props.id()`, new in 5.20.
    peerDependencies: { svelte: mode === 'runes' ? '^5.20.0' : '^5.0.0' },
    reservedNames: svelteReservedNames,
    overrideBlocks: SVELTE_MODE_OVERRIDE_KEYS,
    // The references check sees the mode block's imports; the warnings the
    // render reports for the blocks are not repeated here.
    resolveComponentOverrides: (component) =>
      resolveSvelteOverrides(component, mode, []),
    render: (component, processingOptions) =>
      renderSvelteComponent(component, processingOptions, mode),
  };
}

function renderSvelteComponent(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions,
  mode: SvelteMode
): ProcessResult {
  const warnings: Warning[] = [];
  // A node whose class Svelte removes renders no `bem(...)` call, and with no
  // call left the component needs no `createBem` setup.
  const overridden = withoutRemovedBemRuntimeCalls(
    resolveSvelteOverrides(component, mode, warnings),
    svelteRemovesClass
  );
  // A two-way prop's value and setter are generated; its own default seeds
  // the component's copy, so the prop itself is declared without one.
  const resolved: NormalizedComponent = {
    ...overridden,
    props: twoWayCodeProps(overridden.props, serializeJavaScriptValue),
  };
  const twoWayAliases = propAliases(
    Object.keys(
      flattenDiscriminatedProps(
        resolved.props,
        (discriminatedSurfaceOf(resolved.children)?.branches ?? []).map(
          (entry) => entry.branch.props ?? {}
        )
      )
    ),
    resolved
  );
  const twoWayBlocks = [
    ...twoWayStatements(
      twoWayBindingsOf(overridden.props),
      overridden.props,
      (name) => twoWayAliases.get(name) ?? name,
      mode
    ),
    ...relayedStatements(
      relayedBindingsOf(overridden.props),
      overridden.props,
      (name) => twoWayAliases.get(name) ?? name,
      mode
    ),
  ];
  // Each derived value follows what it reads: a `$derived` in runes mode, a
  // `$:` declaration in legacy mode, after the two-way values.
  const derivedLines = derivedValuesOf(resolved).flatMap((value) =>
    (mode === 'runes'
      ? `const ${value.name} = $derived(${value.expression.trim()});`
      : `$: ${value.name} = ${value.expression.trim()};`
    ).split('\n')
  );
  // The instance's id: `$props.id()` in runes mode, which Svelte takes once
  // per component as a declaration's whole initializer, and the next number
  // of the page-wide counter in legacy mode, which every component shares.
  // Each declared id is built from it, a `$derived` or a `let` the `$:`
  // declaration keeps in step where it follows a prop.
  const declaredIds = declaredIdsOf(resolved);
  const idLines =
    declaredIds.length > 0
      ? [
          mode === 'runes'
            ? `const ${GENERATED_ID_NAME} = $props.id();`
            : `const ${GENERATED_ID_NAME} = ${GENERATED_ID_NEXT_NAME}();`,
          ...declaredIds.flatMap((id) => {
            if (id.prop === undefined) {
              return `const ${id.name} = ${idExpression(id)};`;
            }
            const expression = idExpression(
              id,
              twoWayAliases.get(id.prop) ?? id.prop
            );
            // Legacy `$:` runs after the instance script's top level, so the
            // `let` sets the id the script reads there.
            return mode === 'runes'
              ? [`const ${id.name} = $derived(${expression});`]
              : [
                  `let ${id.name} = ${expression};`,
                  `$: ${id.name} = ${expression};`,
                ];
          }),
        ]
      : [];
  const stateBlocks = [
    ...twoWayBlocks,
    ...(idLines.length > 0 ? [idLines] : []),
    ...(derivedLines.length > 0 ? [derivedLines] : []),
  ];
  const placement = options.styling.placement;
  const language = options.styling.language;
  const styleExtension = language === 'scss' ? 'scss' : 'css';

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
    language,
    options.styling.layer
  );
  const surface = discriminatedSurfaceOf(resolved.children);
  const passthroughNode = passthroughNodeOf(resolved.children);
  const routed =
    surface === undefined ? routedElementOf(resolved.children) : undefined;

  // A discriminated surface root: every branch is a passthrough element, so the
  // surface-contract declarations are emitted and each branch carries the
  // contract in the markup.
  const declaredProps = surface
    ? flattenDiscriminatedProps(
        resolved.props,
        surface.branches.map((entry) => entry.branch.props ?? {})
      )
    : resolved.props;
  const snippetProps =
    mode === 'runes'
      ? collectSnippetProps(resolved.children, declaredProps)
      : [];

  const context: SvelteContext = {
    plan,
    mode,
    stylingInline: placement === 'inline',
    usesStyleSerializer: false,
    usesConsumerStyleValue: false,
    namedSlots: collectNamedSlotNames(resolved.children),
    slotsInRest:
      mode === 'runes' ? [] : [...collectNamedSlotNames(resolved.children)],
    // The slot props a projected snippet declaration would shadow read
    // through their aliased local bindings in the markup.
    slotPropAliases: new Map(
      snippetProps
        .filter((snippetProp) => snippetProp.localName !== snippetProp.propName)
        .map((snippetProp) => [snippetProp.propName, snippetProp.localName])
    ),
    passthroughNode,
    routedNode: routed?.node,
    routedEntries: routed?.entries,
    routedHandle: routed?.handlesRef === true,
    surfaceElements: surface
      ? new Set<ElementNode>(surface.branches.map((entry) => entry.element))
      : undefined,
    declaredNames: new Set([
      ...Object.keys(declaredProps),
      ...snippetProps.map((snippetProp) => snippetProp.propName),
    ]),
    declaresRest: resolved.rest !== undefined,
    bemRuntimeCalls: resolved.bemRuntimeCalls,
    usesOnceHelper: false,
    usesPassiveAttachment: false,
    usesComposeHelper: false,
    componentArmEvents: new Map(),
    componentValuedRootExpression: componentValuedRootExpressionOf(
      resolved.children
    ),
    scopedNodes: scopedNodesOf(resolved.children),
    takenNames: new Set([
      ...Object.keys(declaredProps),
      ...snippetProps.map((snippetProp) => snippetProp.localName),
      ...scriptDeclarations(resolved.script),
    ]),
    warnings,
  };

  const hasPassthrough = passthroughNode !== undefined || surface !== undefined;
  const passthroughTypes = passthroughSurfaceTypesOf(
    passthroughNode,
    surface?.branches.map((entry) => entry.tag),
    [
      ...Object.keys(declaredProps),
      ...snippetProps.map((snippetProp) => snippetProp.propName),
    ],
    routed === undefined
      ? undefined
      : {
          ...routed,
          name: resolved.name,
          conditional: isInsideConditional(resolved.children, routed.node),
        },
    conditionalPassthroughOf(resolved.children) !== undefined
  );

  const markup = renderNodes(resolved.children, '', 0, context).join('\n');
  // A generated event wrapper calls a handler it does not see through the
  // reserved helper.
  context.usesInvokeHandler = usesInvokeHandler(markup);
  const separateFile = placement === 'separate-file' && css !== '';
  // The sibling stylesheet is emitted either way; `stylesheetLink: 'none'`
  // only drops the component's import of it.
  const importsStylesheet =
    separateFile && options.styling.stylesheetLink === 'component';
  // A declaration written among the imports - a counter, a context key, an
  // exported type - belongs to the module, run once rather than per instance,
  // so it moves to the module script, whose names the instance script and the
  // markup both see. The import statements keep their place in the instance
  // script.
  const { importStatements, declarations } = partitionImports(resolved.imports);
  const instance: NormalizedComponent = {
    ...resolved,
    imports: importStatements,
  };
  const moduleScriptBlock = buildModuleScript(
    mode === 'legacy' && declaredIds.length > 0
      ? [...declarations, ...nextGeneratedIdDeclaration()]
      : declarations,
    mode
  );
  const runesScript =
    mode === 'runes'
      ? buildRunesScript(
          instance,
          importsStylesheet,
          styleExtension,
          context,
          passthroughTypes,
          declaredProps,
          snippetProps,
          stateBlocks
        )
      : undefined;
  const scriptBlock =
    runesScript !== undefined
      ? runesScript.block
      : buildScript(
          instance,
          importsStylesheet,
          styleExtension,
          context,
          passthroughTypes,
          declaredProps,
          stateBlocks
        );
  const styleBlock = buildStyleBlock(css, placement, language);

  // Svelte detects a component's dialect per file by rune presence, so a
  // generated runes component whose script carries no rune opts in
  // explicitly - otherwise it would silently compile as a legacy component.
  const runesOptionsTag =
    runesScript !== undefined && !runesScript.declaresRune
      ? '<svelte:options runes={true} />'
      : undefined;

  const sections = [
    componentDocumentation(resolved.description),
    runesOptionsTag,
    moduleScriptBlock,
    scriptBlock,
    markup,
    styleBlock,
  ].filter(
    (section): section is string => section !== undefined && section !== ''
  );

  const files: OutputFile[] = [
    { path: `${resolved.name}.svelte`, content: `${sections.join('\n\n')}\n` },
  ];
  if (separateFile) {
    files.push(...stylesheetFiles(resolved.name, css, options.styling));
  } else if (css !== '') {
    // The style block loads the layer order module first, so it sits
    // beside the component file.
    files.push(...layerOrderModuleFiles(css, options.styling));
  }

  return { files, warnings };
}

/**
 * Builds the module script holding the declarations a template writes among
 * its imports, which Svelte runs once per module rather than per instance:
 * `<script context="module">` in legacy mode, `<script module>` in runes
 * mode.
 */
function buildModuleScript(
  declarations: readonly string[],
  mode: SvelteMode
): string | undefined {
  if (declarations.length === 0) {
    return undefined;
  }
  const attribute = mode === 'runes' ? 'module' : 'context="module"';
  return `<script ${attribute} lang="ts">\n${declarations.join('\n')}\n</script>`;
}

function buildScript(
  component: NormalizedComponent,
  importsStylesheet: boolean,
  styleExtension: string,
  context: SvelteContext,
  passthroughTypes: PassthroughSurfaceTypes | undefined,
  declaredProps: Record<string, PropDefinition>,
  twoWayBlocks: readonly string[][]
): string | undefined {
  const sections: string[] = [];

  const imports = [...component.imports];
  if (context.usesPassiveAttachment) {
    imports.unshift(`import { on } from 'svelte/events';`);
  }
  if (component.bemRuntime !== undefined) {
    imports.unshift(
      `import { createBem } from '${component.bemRuntime.importSource}';`
    );
  }
  if (importsStylesheet) {
    imports.push(`import './${component.name}.${styleExtension}';`);
  }
  if (imports.length > 0) {
    sections.push(imports.join('\n'));
  }

  const props = exportLetDeclarations(
    declaredProps,
    propAliases(Object.keys(declaredProps), component),
    propPathsOf(component)
  );
  if (props !== undefined) {
    sections.push(props);
  }

  // Each two-way prop's value and setter, ahead of everything that may read
  // them.
  for (const block of twoWayBlocks) {
    sections.push(block.join('\n'));
  }

  // A component-valued dynamic root tag hoists to a reactive `RootTag` so the
  // markup's `typeof` branch and both arms share one evaluation; `$:` keeps it
  // in step with the props the expression reads.
  if (context.componentValuedRootExpression !== undefined) {
    sections.push(
      `$: ${DYNAMIC_ROOT_BINDING} = ${context.componentValuedRootExpression};`
    );
  }

  if (component.bemRuntime !== undefined) {
    sections.push(`const bem = ${bemSetupCall(component.bemRuntime)};`);
  }

  if (passthroughTypes !== undefined) {
    sections.push(passthroughDeclarations(passthroughTypes.element));
  }

  // A named slot's content can arrive in `$$restProps`, under the slot's name;
  // what reaches the element is the rest without it.
  const slotsInRest = context.slotsInRest ?? [];
  const restSource =
    component.rest !== undefined && slotsInRest.length > 0
      ? 'restProperties'
      : '$$restProps';
  if (context.usesRestWithoutSlots === true || restSource !== '$$restProps') {
    sections.push(restWithoutSlotContentStatement(slotsInRest));
  }

  // A `rest` declaration names the leftover attributes for the author; legacy
  // Svelte collects them in `$$restProps` (event handlers do not ride it).
  if (component.rest !== undefined) {
    sections.push(`$: rest = ${restSource};`);
  }

  if (component.script !== undefined && component.script.trim() !== '') {
    sections.push(component.script.trim());
  }

  // A form control's bound default, captured once so the control's value
  // is written once.
  for (const binding of context.initialValueBindings ?? []) {
    sections.push(`const ${binding.name} = ${binding.expression};`);
  }

  // A component-valued root's component arm passes its events as composed
  // event-attribute props, which may need the runes event helpers.
  if (context.usesComposeHelper) {
    sections.push(composeEventHandlersDeclaration());
  }

  if (context.usesAuthoredOrConsumer) {
    sections.push(authoredOrConsumerDeclaration());
  }

  if (context.usesAuthoredAndConsumer) {
    sections.push(authoredAndConsumerDeclaration());
  }

  for (const [call, name] of context.consumerAndSpreadBindings ?? []) {
    sections.push(`$: ${name} = ${call};`);
  }

  if (context.consumerAndSpreadBindings !== undefined) {
    sections.push(
      consumerAndSpreadDeclaration({
        classKey: 'class',
        style: 'text',
        handlerPattern: '/^on/',
      })
    );
  }

  if (context.usesInvokeHandler) {
    sections.push(invokeHandlerDeclaration());
  }

  if (context.routedEntries !== undefined) {
    sections.push(consumerAttributesDeclaration(context.routedEntries));
  }

  if (context.usesOnceHelper) {
    sections.push(onceHelperDeclaration());
  }

  if (context.usesStyleSerializer) {
    sections.push(styleSerializerDeclaration());
  }

  if (context.usesConsumerStyleValue) {
    sections.push(consumerStyleValueDeclaration());
  }

  if (sections.length === 0) {
    return undefined;
  }
  return `<script lang="ts"${typeParameterScriptAttribute('generics', component.typeParameters)}>\n${sections.join('\n\n')}\n</script>`;
}

/**
 * The expression of a component-valued dynamic root tag, if the component's
 * single rendered root carries one. The script builder hoists it to the
 * `RootTag` binding the markup's `typeof` branch resolves; a plain (string-
 * valued) dynamic root returns `undefined` and keeps the bare
 * `<svelte:element>` form.
 */
function componentValuedRootExpressionOf(
  children: readonly TemplateNode[]
): string | undefined {
  const rendered = children.filter((node) => node.type !== 'comment');
  if (rendered.length !== 1) {
    return undefined;
  }
  const root = rendered[0];
  if (
    root.type === 'element' &&
    isDynamicTag(root.tag) &&
    root.tag.componentValued === true
  ) {
    return root.tag.$expression;
  }
  return undefined;
}

/**
 * The template path of each declared prop: `props.<name>` for a shared prop,
 * `children[i].conditions[j].props.<name>` for a discriminated branch's.
 */
function propPathsOf(component: NormalizedComponent): Map<string, string> {
  const paths = new Map<string, string>();
  for (const name of Object.keys(component.props)) {
    paths.set(name, `props.${name}`);
  }
  component.children.forEach((node, index) => {
    if (node.type !== 'conditional') {
      return;
    }
    node.conditions.forEach((branch, branchIndex) => {
      for (const name of Object.keys(branch.props ?? {})) {
        if (!paths.has(name)) {
          paths.set(
            name,
            `children[${index}].conditions[${branchIndex}].props.${name}`
          );
        }
      }
    });
  });
  return paths;
}

/**
 * The names a native attribute surface leaves out, as a string-literal union:
 * the component's declared and snippet prop names, plus `children`, which a
 * default slot redeclares as its snippet when the component has one and which
 * would otherwise land on an inner component where nothing renders it.
 */
function omittedNamesOf(omitted: readonly string[]): string {
  const names = new Set(omitted);
  names.add('children');
  return [...names].map((name) => `'${name}'`).join(' | ');
}

/**
 * The consumer surface types of a passthrough root, if it has one: a static
 * intrinsic tag types its attributes and element by that tag; a dynamic root
 * by its default for the attributes (as React does), its element by the
 * namespace alone, since `svelte:element` may render another tag; a
 * discriminated root takes the union of its branch tags. Each tag's
 * attributes leave out the names the component declares (`omitted`), so a
 * declared prop sharing a native attribute's name keeps its own type; on a
 * union the `Omit` applies per member, as `Omit` over a union keeps only the
 * members' shared keys. The element of a conditional passthrough root may also
 * be `null`, once it has rendered and unmounted.
 */
function passthroughSurfaceTypesOf(
  passthroughNode: ElementNode | undefined,
  discriminatedTags: string[] | undefined,
  omitted: readonly string[],
  routed?: {
    name: string;
    tag: string;
    entries: readonly string[];
    handlesRef: boolean;
    /** Whether the routed element renders only some of the time. */
    conditional: boolean;
  },
  conditional = false
): PassthroughSurfaceTypes | undefined {
  const omittedNames = omittedNamesOf(omitted);
  const attributesOf = (tag: string): string =>
    `Omit<SvelteHTMLElements['${tag}'], ${omittedNames}>`;
  if (discriminatedTags !== undefined) {
    const tags = [...new Set(discriminatedTags)];
    const attributes = tags.map(attributesOf);
    return {
      attributes:
        attributes.length === 1 ? attributes[0] : `(${attributes.join(' | ')})`,
      element: [...new Set(tags.map(elementTypeOf))].join(' | '),
    };
  }
  if (passthroughNode === undefined) {
    return undefined;
  }
  const tag = staticTagOf(passthroughNode.tag);
  // A routed element's attributes are typed after its own tag: the root's
  // lose the routed keys, and the routed tag's supply them.
  if (routed !== undefined) {
    const keys = `${routed.name}RoutedKeys`;
    const surface = `keyof SvelteHTMLElements['${routed.tag}']`;
    const excluded = `${omittedNamesOf(omitted)} | 'class' | 'style'`;
    const patterns = routed.entries.map((entry) =>
      entry === 'aria-*'
        ? '`aria-${string}`'
        : entry === 'on*'
          ? '`on${string}`'
          : `'${entry}'`
    );
    // With '*' the root keeps only what the runtime leaves it: its data-*
    // attributes, beside the class, style and element `Props` declares.
    const rootAttributes = routed.entries.includes('*')
      ? `Pick<SvelteHTMLElements['${tag}'], \`data-\${string}\`>`
      : `Omit<SvelteHTMLElements['${tag}'], ${omittedNamesOf(omitted)} | ${keys}>`;
    return {
      attributes: `${rootAttributes} & Pick<SvelteHTMLElements['${routed.tag}'], ${keys}>`,
      // A routed handle binds the routed element instead of the root, which
      // Svelte sets to `null` when the element unmounts.
      element: routed.handlesRef
        ? `${elementTypeOf(routed.tag)}${routed.conditional ? ' | null' : ''}`
        : elementTypeOf(tag),
      declaration: routed.entries.includes('*')
        ? `type ${keys} = Exclude<${surface}, ${excluded} | \`data-\${string}\`>;`
        : `type ${keys} = Exclude<Extract<${surface}, ${patterns.join(' | ')}>, ${excluded}>;`,
    };
  }
  const element = isDynamicTag(passthroughNode.tag)
    ? dynamicElementTypeOf(tag)
    : elementTypeOf(tag);
  return {
    attributes: attributesOf(tag),
    // Svelte sets a `bind:this` to `null` when its element unmounts, so the
    // handle of a root that renders only while its condition holds is typed
    // with it.
    element: conditional ? `${element} | null` : element,
  };
}

/** A built runes `<script>` block and whether it declares a rune. */
interface RunesScript {
  /** The `<script lang="ts">` block, or `undefined` when empty. */
  block: string | undefined;
  /**
   * True when the script carries a generated rune (`$props()` and, with it,
   * any `$bindable()`), which opts the file into runes mode by itself.
   */
  declaresRune: boolean;
}

/**
 * Builds the `<script lang="ts">` block of a runes component: imports, the
 * typed `Props` declaration and its `$props()` destructure, the BEM runtime
 * setup, the authored script verbatim, and the generated helpers the markup
 * used (the `once` event helper, the whole-object style serializer).
 */
function buildRunesScript(
  component: NormalizedComponent,
  importsStylesheet: boolean,
  styleExtension: string,
  context: SvelteContext,
  passthroughSurface: PassthroughSurfaceTypes | undefined,
  declaredProps: Record<string, PropDefinition>,
  snippetProps: SnippetProp[],
  twoWayBlocks: readonly string[][]
): RunesScript {
  const sections: string[] = [];

  const imports: string[] = [];
  if (component.bemRuntime !== undefined) {
    imports.push(
      `import { createBem } from '${component.bemRuntime.importSource}';`
    );
  }
  if (context.usesPassiveAttachment) {
    imports.push(`import { on } from 'svelte/events';`);
  }
  if (snippetProps.length > 0) {
    imports.push(`import type { Snippet } from 'svelte';`);
  }
  const restTag = component.rest?.tag;
  if (passthroughSurface !== undefined || restTag !== undefined) {
    imports.push(`import type { SvelteHTMLElements } from 'svelte/elements';`);
  }
  imports.push(...component.imports);
  if (importsStylesheet) {
    imports.push(`import './${component.name}.${styleExtension}';`);
  }
  if (imports.length > 0) {
    sections.push(imports.join('\n'));
  }

  // A `rest` declaration types its leftover attributes as the tag's, minus
  // the names the component declares itself.
  const omitted = [
    ...Object.keys(declaredProps),
    ...snippetProps.map((snippetProp) => snippetProp.propName),
  ];
  const restAttributes =
    restTag === undefined
      ? undefined
      : `Omit<SvelteHTMLElements['${restTag}'], ${omittedNamesOf(omitted)}>`;
  const declaration = runesPropsDeclaration(
    declaredProps,
    snippetProps,
    passthroughSurface,
    restAttributes
  );
  if (declaration !== undefined) {
    sections.push(declaration);
  }
  const destructure = runesPropsDestructure(
    declaredProps,
    snippetProps,
    passthroughSurface !== undefined,
    restTag !== undefined,
    propAliases(Object.keys(declaredProps), component)
  );
  if (destructure !== undefined) {
    sections.push(destructure);
  }

  // Each two-way prop's value and setter, ahead of everything that may read
  // them.
  for (const block of twoWayBlocks) {
    sections.push(block.join('\n'));
  }

  // A component-valued dynamic root tag hoists to a `$derived` `RootTag` so the
  // markup's `typeof` branch and both arms share one evaluation that tracks the
  // props the expression reads.
  if (context.componentValuedRootExpression !== undefined) {
    sections.push(
      `const ${DYNAMIC_ROOT_BINDING} = $derived(${context.componentValuedRootExpression});`
    );
  }

  if (component.bemRuntime !== undefined) {
    sections.push(`const bem = ${bemSetupCall(component.bemRuntime)};`);
  }

  if (component.script !== undefined && component.script.trim() !== '') {
    sections.push(component.script.trim());
  }

  if (context.usesComposeHelper) {
    sections.push(composeEventHandlersDeclaration());
  }

  if (context.usesAuthoredOrConsumer) {
    sections.push(authoredOrConsumerDeclaration());
  }

  if (context.usesAuthoredAndConsumer) {
    sections.push(authoredAndConsumerDeclaration());
  }

  for (const [call, name] of context.consumerAndSpreadBindings ?? []) {
    sections.push(`const ${name} = $derived(${call});`);
  }

  if (context.consumerAndSpreadBindings !== undefined) {
    sections.push(
      consumerAndSpreadDeclaration({
        classKey: 'class',
        style: 'text',
        handlerPattern: '/^on/',
      })
    );
  }

  if (context.usesInvokeHandler) {
    sections.push(invokeHandlerDeclaration());
  }

  if (context.routedEntries !== undefined) {
    sections.push(consumerAttributesDeclaration(context.routedEntries));
  }

  if (context.usesOnceHelper) {
    sections.push(onceHelperDeclaration());
  }

  if (context.usesStyleSerializer) {
    sections.push(styleSerializerDeclaration());
  }

  if (context.usesConsumerStyleValue) {
    sections.push(consumerStyleValueDeclaration());
  }

  return {
    block:
      sections.length === 0
        ? undefined
        : `<script lang="ts"${typeParameterScriptAttribute('generics', component.typeParameters)}>\n${sections.join('\n\n')}\n</script>`,
    declaresRune: destructure !== undefined,
  };
}

/**
 * The runtime helper setup expression for a component, e.g.
 * `createBem('Badge')` or `createBem('Badge', { elementSeparator: '-' })`.
 */
function bemSetupCall(binding: BemRuntimeBinding): string {
  return `createBem('${binding.block}'${bemConfigurationArgument(binding)})`;
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

/**
 * The generated whole-object style serializer: Svelte's `style` attribute
 * takes a string, so a style expression evaluating to an object of
 * camelCase property→value pairs serializes through this helper.
 *
 * A nullish entry is dropped rather than serialized. React's `style`
 * object and Vue's `normalizeStyle` both omit such a property, and without the
 * filter the value interpolates into the declaration as the text `undefined` -
 * harmless on a plain property, which is then simply invalid and dropped, but
 * silently wrong on a custom property, where `undefined` is a perfectly good
 * value and every `var()` reading it downstream gets the literal text instead
 * of its fallback.
 *
 * A string passes through as declarations: a consumer's `style` is a string
 * in Svelte, so an override reading `rest.style` serializes it unchanged. An
 * array serializes each entry in order, later declarations winning, which is
 * how a passthrough root puts the consumer's style after its own and how an
 * override merges one (`[styles?.root, rest.style]`).
 */
function styleSerializerDeclaration(): string {
  return [
    `function ${STYLE_SERIALIZER_NAME}(`,
    '  styleObject:',
    '    | Record<string, string | number | null | undefined>',
    '    | string',
    '    | null',
    '    | undefined',
    '    | Array<Record<string, string | number | null | undefined> | string | null | undefined>',
    '): string {',
    '  if (Array.isArray(styleObject)) {',
    '    return styleObject',
    `      .map((entry) => ${STYLE_SERIALIZER_NAME}(entry))`,
    "      .filter((declarations) => declarations !== '')",
    "      .join('; ');",
    '  }',
    '  if (styleObject == null) {',
    "    return '';",
    '  }',
    "  if (typeof styleObject === 'string') {",
    "    return styleObject.trim().replace(/;$/, '');",
    '  }',
    '  return Object.entries(styleObject)',
    '    .filter(([, value]) => value != null)',
    '    .map(([property, value]) => {',
    '      // A custom property name is case-sensitive: a capital in `--kit--Name--size`',
    '      // is part of the name, not a word boundary, so only a camelCase property converts.',
    "      const cssProperty = property.startsWith('--')",
    '        ? property',
    '        : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);',
    '      return `${cssProperty}: ${value}`;',
    '    })',
    "    .join('; ');",
    '}',
  ].join('\n');
}

/**
 * The generated helper a passthrough root's style directives read: the value
 * the consumer's style declares for one property, or `undefined`. A
 * `style:property` directive outranks the `style` attribute and removes its
 * declaration of the same property, so the directive takes the consumer's
 * value itself, and the consumer's style wins as in React and Vue. The style
 * is a string in Svelte (an object is read too), split at each `;` outside
 * quotes and parentheses; the last declaration of the property counts, a custom property's name case-sensitively, and a trailing
 * `!important` is dropped, which a directive cannot carry.
 */
function consumerStyleValueDeclaration(): string {
  return [
    `function ${CONSUMER_STYLE_VALUE_NAME}(`,
    '  style: string | Record<string, string | number | null | undefined> | null | undefined,',
    '  property: string',
    '): string | undefined {',
    '  if (style == null) {',
    '    return undefined;',
    '  }',
    '  const declarations: Array<[string, string | number | null | undefined]> = [];',
    "  if (typeof style === 'string') {",
    '    // Split at each `;` outside a quoted string and outside parentheses, so a',
    '    // `url("data:...;utf8,...")` or a quoted `"a;b"` stays whole.',
    '    const pieces: string[] = [];',
    "    let quote = '';",
    '    let depth = 0;',
    '    let start = 0;',
    '    for (let i = 0; i < style.length; i++) {',
    '      const character = style[i];',
    '      if (quote) {',
    "        if (character === '\\\\') {",
    '          i++;',
    '        } else if (character === quote) {',
    "          quote = '';",
    '        }',
    '      } else if (character === \'"\' || character === "\'") {',
    '        quote = character;',
    "      } else if (character === '(') {",
    '        depth++;',
    "      } else if (character === ')') {",
    '        depth = Math.max(0, depth - 1);',
    "      } else if (character === ';' && depth === 0) {",
    '        pieces.push(style.slice(start, i));',
    '        start = i + 1;',
    '      }',
    '    }',
    '    pieces.push(style.slice(start));',
    '    for (const piece of pieces) {',
    "      const colon = piece.indexOf(':');",
    '      if (colon !== -1) {',
    '        declarations.push([piece.slice(0, colon).trim(), piece.slice(colon + 1).trim()]);',
    '      }',
    '    }',
    '  } else {',
    '    for (const [name, value] of Object.entries(style)) {',
    '      declarations.push([',
    "        name.startsWith('--') ? name : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),",
    '        value,',
    '      ]);',
    '    }',
    '  }',
    '  let found: string | undefined;',
    '  for (const [name, value] of declarations) {',
    "    const matches = property.startsWith('--') ? name === property : name.toLowerCase() === property;",
    "    if (matches && value != null && value !== '') {",
    "      found = String(value).replace(/\\s*!important$/i, '');",
    '    }',
    '  }',
    '  return found;',
    '}',
  ].join('\n');
}

/**
 * Renders the `<style>` block. Under `separate-file` the CSS is emitted as a
 * sibling `<Name>.css` - imported from `<script>` unless
 * `stylesheetLink: 'none'` leaves that to the consumer - so no `<style>`
 * block is produced either way. Otherwise all collected CSS - including the
 * nested-selector CSS the `inline` placement cannot inline - lands in the
 * block.
 */
function buildStyleBlock(
  css: string,
  placement: string,
  language: 'css' | 'scss'
): string | undefined {
  if (css === '' || placement === 'separate-file') {
    return undefined;
  }
  const langAttribute = language === 'scss' ? ' lang="scss"' : '';
  return `<style${langAttribute}>\n${css}\n</style>`;
}

/**
 * The component's description as Svelte's `<!-- @component -->` doc comment,
 * which Svelte's language tools show on hover over the component's import and
 * its tag, in either dialect. Markdown passes through. A `-->` in the text is
 * written `--&gt;`, since it would end the comment, and reads back as `-->`
 * where the comment renders as markdown; a `*\/` is escaped as in a TSDoc
 * comment, since the language tools carry the text into one.
 *
 * @param description - The component's description
 * @returns The comment, or `undefined` without a description
 */
function componentDocumentation(
  description: string | undefined
): string | undefined {
  const trimmed = description?.trim();
  if (trimmed === undefined || trimmed === '') {
    return undefined;
  }
  const text = trimmed
    .replace(/-->/g, '--&gt;')
    .replace(/\*\//g, '*\\/')
    .split('\n')
    .map((line) => line.trimEnd());
  return ['<!--', '@component', ...text, '-->'].join('\n');
}
