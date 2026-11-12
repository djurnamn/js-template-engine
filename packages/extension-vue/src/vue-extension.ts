import {
  collectCss,
  collectNamedSlotNames,
  declaredIdsOf,
  derivedValuesOf,
  discriminatedSurfaceOf,
  GENERATED_NODE_ATTRIBUTE,
  flattenDiscriminatedProps,
  partitionImports,
  passthroughNodeOf,
  planTargets,
  resolveComponentOverrides,
  staticTagOf,
  layerOrderModuleFiles,
  stylesheetFiles,
  relayedBindingsOf,
  twoWayBindingsOf,
  type BemRuntimeBinding,
  type DiscriminatedSurface,
  type TargetExtension,
  type NormalizedComponent,
  type ResolvedProcessingOptions,
  type RelayedBinding,
  type TwoWayBinding,
} from '@js-template-engine/core';
import {
  invokeHandlerDeclaration,
  authoredAndConsumerDeclaration,
  arrowBodyOf,
  authoredOrConsumerDeclaration,
  consumerAttributesDeclaration,
  COMPONENT_OVERRIDE_KEYS,
  conditionalPassthroughOf,
  GENERATED_ID_NAME,
  idExpression,
  documentationComment,
  TARGET_NODE_OVERRIDE_KEYS,
  importedNames,
  routedElementOf,
  propAliases,
  scriptShadowedPropAliases,
  elementTypeOf,
  topLevelDeclarations,
  twoWayCodeProps,
  typeParameterArguments,
  typeParameterDeclarations,
  withoutRemovedBemRuntimeCalls,
  typeParameterScriptAttribute,
  type RoutedElement,
} from '@js-template-engine/core/emitter';
import type {
  ElementNode,
  OutputFile,
  ProcessResult,
  PropDefinition,
  StylesheetLink,
  Warning,
} from '@js-template-engine/types';

import {
  definedPropertiesDeclaration,
  renderNodes,
  ROUTED_ELEMENT,
  routedElementDeclaration,
  vueRemovesClass,
  type VueContext,
} from './markup';
import {
  unlessDefaultPreventedDeclaration,
  usedOnceListenersDeclaration,
} from './events';
import { globalDeclaration, templateGlobals } from './globals';
import type { VueComponentOverride, VueNodeOverrides } from './overrides';
import { recordingExpressions, serializeJavaScriptValue } from './literals';
import { mergeRoutedExpose } from './routed-expose';
import { definePropsStatement, propsInterface } from './props';
import { readTwoWayValues, twoWayStatements, withModelValue } from './two-way';
import { validateVueOverrides, vueReservedNames } from './validation';

/** The Vue target extension. */
export interface VueExtension extends TargetExtension {
  readonly key: 'vue';
}

/** The capitalized tags Vue's template compiler resolves without an import. */
const VUE_BUILT_IN_COMPONENTS: readonly string[] = [
  'Component',
  'KeepAlive',
  'Suspense',
  'Teleport',
  'Transition',
  'TransitionGroup',
];

/**
 * Creates the Vue target extension.
 *
 * Renders a template as a Vue Single File Component (`<Name>.vue`): a
 * `<script setup lang="ts">` block with a generated props interface and the
 * props destructured from `defineProps`, a `<template>` block with
 * directive-based conditionals (`v-if`), list rendering (`v-for` + `:key`),
 * slots, event bindings with native modifiers, and a `<style>` block.
 *
 * Styling supports all three stylesheet placements; the `<style>` block can be
 * scoped with the component-level `extensions.vue.scoped` option. Handlers
 * live in `<script setup>`, where the template's `@event` bindings resolve
 * them.
 *
 * @example
 * const result = process(template, { extensions: [vue()] });
 * // result.files[0] = { path: 'Button.vue', content: '...' }
 */
export function vue(): VueExtension {
  return {
    key: 'vue',
    kind: 'target',
    restClassAndStyle: 'merged',
    compilesInDocumentStyles: true,
    builtInComponents: VUE_BUILT_IN_COMPONENTS,
    globalComponentRegistration: true,
    overrideKeys: {
      node: TARGET_NODE_OVERRIDE_KEYS,
      component: [...COMPONENT_OVERRIDE_KEYS, 'scoped', 'model'],
    },
    // A destructured defineProps compiles reactively, and useId exists, from
    // Vue 3.5.
    peerDependencies: { vue: '^3.5.0' },
    reservedNames: vueReservedNames,
    validateOverrides: validateVueOverrides,
    render: renderVueComponent,
  };
}

function renderVueComponent(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions
): ProcessResult {
  const warnings: Warning[] = [];
  // A two-way value and a derived value are each a `computed` in Vue, so the
  // shared script's free reads of them read their `.value`, and a script
  // written once reads the values in every target; a `vue` script override
  // is Vue's own and stays as written.
  const vueProps = resolveComponentOverrides(component, 'vue').props;
  const computedNames = new Set([
    ...twoWayBindingsOf(vueProps).map((binding) => binding.current),
    ...relayedBindingsOf(vueProps).map((binding) => binding.given),
    ...computedIdNames(component),
    ...derivedValuesOf(component).map((value) => value.name),
  ]);
  // A node whose class Vue removes renders no `bem(...)` call, and with no
  // call left the component needs no `createBem` setup.
  const overridden = withoutRemovedBemRuntimeCalls(
    resolveComponentOverrides(
      {
        ...component,
        script: readTwoWayValues(component.script, computedNames),
      },
      'vue'
    ),
    vueRemovesClass
  );
  // A two-way prop's value and setter are generated; its own default seeds
  // the component's copy, so the prop itself is declared without one.
  const twoWay: TwoWay = {
    bindings: twoWayBindingsOf(overridden.props),
    relays: relayedBindingsOf(overridden.props),
    props: overridden.props,
    model: (overridden.extensions['vue'] as VueComponentOverride | undefined)
      ?.model,
  };
  const resolved: NormalizedComponent = {
    ...overridden,
    props: twoWayCodeProps(overridden.props, serializeJavaScriptValue),
  };
  const placement = options.styling.placement;
  const language = options.styling.language;

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
  // Every surface element binds `$attrs` itself, ahead of its own attributes,
  // so they override the consumer's per key (the passthrough
  // order); Vue's automatic fallthrough is turned off for the component.
  const passthroughRoot = surface
    ? undefined
    : passthroughNodeOf(resolved.children);
  const routed =
    surface === undefined ? routedElementOf(resolved.children) : undefined;
  const surfaceElements = surface
    ? new Set<ElementNode>(surface.branches.map((entry) => entry.element))
    : passthroughRoot
      ? new Set<ElementNode>([passthroughRoot])
      : undefined;

  const context: VueContext = {
    plan,
    stylingInline: placement === 'inline',
    namedSlots: collectNamedSlotNames(resolved.children),
    surfaceElements,
    conditionalPassthroughElement: conditionalPassthroughOf(resolved.children)
      ?.element,
    declaredNames: new Set(
      Object.keys(
        surface
          ? flattenDiscriminatedProps(
              resolved.props,
              surface.branches.map((entry) => entry.branch.props ?? {})
            )
          : resolved.props
      )
    ),
    declaresRest: resolved.rest !== undefined,
    routedNode: routed?.node,
    routedEntries: routed?.entries,
    routedHandle: routed?.handlesRef === true,
    bemRuntimeCalls: resolved.bemRuntimeCalls,
    warnings,
  };

  const { result: markup, expressions } = recordingExpressions(() =>
    renderNodes(resolved.children, '', 1, context)
  );
  // A browser global the template reads is invisible to a Vue template, so
  // `<script setup>` declares it under its own name; one whose value changes
  // with the page is reported instead.
  const globals = templateGlobals(
    expressions,
    templateBoundNames(resolved, context.declaredNames ?? new Set(), twoWay)
  );
  for (const name of globals.reported) {
    warnings.push({
      message: `The Vue template reads the browser global '${name}', which a Vue template cannot see; read it as ${name === 'globalThis' ? "'window'" : `'window.${name}'`} or from a script function`,
    });
  }
  const templateBlock = `<template>\n${markup.join('\n')}\n</template>`;

  // A node whose styles need a generated selector carries the engine's
  // `data-jte-node` attribute. Vue types no `data-*` attribute on a native
  // element, so a consumer type-checking with `strictTemplates` would reject
  // it; the component declares that one attribute, and nothing else, for them.
  const declaresGeneratedNode = markup.some((line) =>
    line.includes(`${GENERATED_NODE_ATTRIBUTE}=`)
  );
  const documentation = documentationComment(resolved.description, '');
  // A declaration written among the imports - a counter, an injection key, an
  // exported type - belongs to the module, run once rather than per instance,
  // so it moves to the plain block beside `<script setup>`, whose top-level
  // names the setup script and the template both see. The import statements
  // keep their place in `<script setup>`.
  const { importStatements, declarations: authoredDeclarations } =
    partitionImports(resolved.imports);
  const scriptBlock = buildScriptSetup(
    { ...resolved, imports: importStatements },
    surface,
    context.usesAuthoredOrConsumer === true,
    context.usesDefinedProperties === true,
    twoWay,
    routed,
    context.usesUnlessDefaultPrevented === true,
    (context.onceListenerCount ?? 0) > 0,
    globals.declared,
    context.usesAuthoredAndConsumer === true,
    context.usesInvokeHandler === true,
    context.usesConsumerAttributes === true,
    warnings,
    context.usesMergeProps === true
  );
  const scoped = resolveScoped(component, placement, warnings);
  const styleBlock = buildStyleBlock(
    css,
    placement,
    options.styling.stylesheetLink,
    scoped,
    resolved.name,
    language
  );

  const plainScriptBlock = buildPlainScript(
    documentation,
    declaresGeneratedNode,
    authoredDeclarations
  );

  const sections = [
    plainScriptBlock,
    scriptBlock,
    templateBlock,
    styleBlock,
  ].filter((section): section is string => section !== undefined);

  const files: OutputFile[] = [
    { path: `${resolved.name}.vue`, content: `${sections.join('\n\n')}\n` },
  ];
  if (css !== '' && placement === 'separate-file') {
    files.push(...stylesheetFiles(resolved.name, css, options.styling));
  } else if (css !== '') {
    // The style block loads the layer order module first, so it sits
    // beside the component file.
    files.push(...layerOrderModuleFiles(css, options.styling));
  }

  return { files, warnings };
}

/**
 * Every name a Vue component binds in its whole template's scope: its props
 * (`modelValue` included), the names its script, imports and module
 * declarations bind at the top level, and its two-way values and setters.
 * A template local - an iteration's `item` and `index`, a `slotScope`
 * binding - binds its name only inside its own subtree, so it is read as in
 * scope for the expressions bound there alone (see `withTemplateLocals`).
 */
function templateBoundNames(
  component: NormalizedComponent,
  declaredNames: ReadonlySet<string>,
  twoWay: TwoWay
): Set<string> {
  const bound = new Set<string>([...declaredNames, 'modelValue']);
  for (const name of topLevelDeclarations(
    [...component.imports, component.script ?? ''].join('\n')
  )) {
    bound.add(name);
  }
  for (const binding of twoWay.bindings) {
    bound.add(binding.current);
    bound.add(binding.setter);
  }
  for (const binding of twoWay.relays) {
    bound.add(binding.given);
    bound.add(binding.report);
  }
  for (const value of derivedValuesOf(component)) {
    bound.add(value.name);
  }
  for (const id of declaredIdsOf(component)) {
    bound.add(id.name);
  }
  return bound;
}

/**
 * The declared ids Vue keeps in a `computed`: each with a `prop`, which
 * follows the consumer's value. An id without one is a plain string.
 */
function computedIdNames(component: NormalizedComponent): string[] {
  return declaredIdsOf(component)
    .filter((id) => id.prop !== undefined)
    .map((id) => id.name);
}

/** The type declaration for the engine's generated node attribute, which
 *  `<script setup>` cannot hold, being a module declaration. */
const GENERATED_NODE_ATTRIBUTE_DECLARATION = [
  "declare module 'vue' {",
  '  interface HTMLAttributes {',
  `    '${GENERATED_NODE_ATTRIBUTE}'?: string;`,
  '  }',
  '}',
].join('\n');

/**
 * Builds the plain `<script lang="ts">` block beside `<script setup>`, for
 * what `<script setup>` cannot hold: the generated node attribute's type
 * declaration, the declarations a template writes among its imports, and the
 * component's description as the doc comment of an empty `export default`.
 * Vue's language tools carry that comment onto the component's own type, so
 * an editor shows it on hover over the component's import and its tag; a
 * comment in `<script setup>` documents nothing they read. Vue merges the
 * empty options object into the `<script setup>` component, so it changes
 * nothing at runtime.
 */
function buildPlainScript(
  documentation: string[],
  declaresGeneratedNode: boolean,
  authoredDeclarations: string[]
): string | undefined {
  const sections = [
    ...(declaresGeneratedNode ? [GENERATED_NODE_ATTRIBUTE_DECLARATION] : []),
    ...(authoredDeclarations.length > 0
      ? [authoredDeclarations.join('\n')]
      : []),
    ...(documentation.length > 0
      ? [[...documentation, 'export default {};'].join('\n')]
      : []),
  ];
  if (sections.length === 0) {
    return undefined;
  }
  return `<script lang="ts">\n${sections.join('\n\n')}\n</script>`;
}

/** A component's two-way props, as the Vue script generates them. */
interface TwoWay {
  /** The copy-form bindings. */
  bindings: TwoWayBinding[];
  /** The relayed bindings. */
  relays: RelayedBinding[];
  /** The component's props as declared, defaults included. */
  props: Record<string, PropDefinition>;
  /** The two-way prop a bare `v-model` binds, if any. */
  model: string | undefined;
}

/**
 * The DOM type of a routed element, after the tag Vue renders it as (its
 * `tag` override, else its own): the tag's `HTMLElementTagNameMap` entry,
 * its `SVGElementTagNameMap` entry for an SVG-only tag, or `HTMLElement` for
 * a custom element and for a component the override names, whose root
 * element is known only at runtime.
 */
function routedElementType(node: ElementNode): string {
  const tag =
    (node.extensions?.vue as VueNodeOverrides | undefined)?.tag ??
    staticTagOf(node.tag);
  return /^[A-Z]|\./.test(tag) ? 'HTMLElement' : elementTypeOf(tag);
}

function buildScriptSetup(
  component: NormalizedComponent,
  surface: DiscriminatedSurface | undefined,
  usesAuthoredOrConsumer = false,
  usesDefinedProperties = false,
  twoWay: TwoWay = { bindings: [], relays: [], props: {}, model: undefined },
  routed?: RoutedElement,
  usesUnlessDefaultPrevented = false,
  usesOnceListeners = false,
  globals: readonly string[] = [],
  usesAuthoredAndConsumer = false,
  usesInvokeHandler = false,
  usesConsumerAttributes = false,
  warnings: Warning[] = [],
  usesMergeProps = false
): string | undefined {
  const sections: string[] = [];

  const imports: string[] = [];
  const vueImports: string[] = [];
  // A two-way prop's own copy and value are a `shallowRef` and a `computed`,
  // and a derived value a `computed`; an author's import of either already
  // binds it. A routed handle holds the routed element in a `shallowRef` too.
  const derived = derivedValuesOf(component);
  const declaredIds = declaredIdsOf(component);
  const idComputed = computedIdNames(component);
  const routedHandle = routed?.handlesRef === true;
  const generatedImports = [
    ...(twoWay.bindings.length > 0 ||
    twoWay.relays.length > 0 ||
    derived.length > 0 ||
    idComputed.length > 0
      ? ['computed']
      : []),
    ...(twoWay.bindings.length > 0 || routedHandle ? ['shallowRef'] : []),
    ...(declaredIds.length > 0 ? ['useId'] : []),
    // A surface element's `$attrs` merge with a `$spread` through
    // `mergeProps`, so the consumer's class, style and listeners survive.
    ...(usesMergeProps ? ['mergeProps'] : []),
  ];
  if (generatedImports.length > 0) {
    const authored = importedNames(component.imports);
    vueImports.push(...generatedImports.filter((name) => !authored.has(name)));
  }
  // A component declaring `rest` hands the consumer's leftover attributes to
  // the author as `rest`, so Vue's own fallthrough is off.
  const rest = component.rest !== undefined;
  if (rest) {
    vueImports.push('useAttrs');
  }
  if (vueImports.length > 0) {
    imports.push(`import { ${vueImports.join(', ')} } from 'vue';`);
  }
  // The element a consumer's undeclared attributes land on - a passthrough
  // root, or the tag `rest` declares - types them in the props interface.
  const passthroughNode = surface
    ? undefined
    : passthroughNodeOf(component.children);
  const attributesTag =
    component.rest?.tag ??
    (passthroughNode ? staticTagOf(passthroughNode.tag) : undefined);
  // A discriminated surface hands them to whichever branch renders, so its
  // props take every branch's element attributes.
  const surfaceTags = surface ? surface.branches.map((entry) => entry.tag) : [];
  if (attributesTag !== undefined || surfaceTags.length > 0) {
    imports.push(`import type { IntrinsicElementAttributes } from 'vue';`);
  }
  if (component.bemRuntime !== undefined) {
    imports.push(
      `import { createBem } from '${component.bemRuntime.importSource}';`
    );
  }
  imports.push(...component.imports);
  if (imports.length > 0) {
    sections.push(imports.join('\n'));
  }

  // A discriminated surface root renders two roots, so Vue cannot auto-inherit
  // attributes onto one; `inheritAttrs: false` plus an explicit `v-bind="$attrs"`
  // per branch (in the markup) carries the consumer's fallthrough attributes.
  // A surface's props are its branches' flat projection, which the interface
  // documents, and every one of them is destructured. A branch prop's default
  // is applied beside the shared props', as React's per-branch destructuring
  // applies it.
  // A bare `v-model` binds `modelValue`, declared beside the prop it stands
  // in for.
  const model =
    twoWay.bindings.some((binding) => binding.prop === twoWay.model) ||
    twoWay.relays.some((binding) => binding.prop === twoWay.model)
      ? twoWay.model
      : undefined;
  const sharedProps = withModelValue(component.props, model);
  const declaredProps = surface
    ? flattenDiscriminatedProps(
        sharedProps,
        surface.branches.map((entry) => entry.branch.props ?? {})
      )
    : sharedProps;
  const defaultedProps = {
    ...sharedProps,
    ...Object.fromEntries(
      Object.entries(declaredProps).filter(
        ([name, definition]) =>
          !(name in sharedProps) && definition.default !== undefined
      )
    ),
  };
  const interfaceBlock = surface
    ? propsInterface(component.name, declaredProps, surfaceTags)
    : propsInterface(
        component.name,
        sharedProps,
        attributesTag,
        routed === undefined
          ? undefined
          : { tag: routed.tag, entries: routed.entries }
      );
  const defineOptionsBlock =
    surface || rest || passthroughNode !== undefined
      ? 'defineOptions({ inheritAttrs: false });'
      : undefined;
  // A generic component's props type takes its type parameters, so it stays
  // valid where Vue hoists the exported type out of the setup scope.
  const propsType = `${component.name}Props`;
  const typeArguments = typeParameterArguments(component.typeParameters);
  // A prop the script or an import declares a binding of its own for is
  // destructured under an alias clear of it: that binding keeps the name, and
  // the template reads it, as Vue reads a setup binding over a prop.
  const sharedAliases = propAliases(Object.keys(declaredProps), component);
  const shadowedAliases = scriptShadowedPropAliases(
    Object.keys(declaredProps),
    [component.script, ...component.imports],
    sharedAliases,
    component
  );
  const aliases = new Map([...sharedAliases, ...shadowedAliases]);
  // The generated code that reads a prop through its local name: the
  // two-way statements and the declared ids. A prop the script shadows that
  // none of it reads is left out of the destructure, where its alias would
  // be an unused local the script cannot reach.
  const readThroughAlias = new Set<string>();
  const localOf = (name: string): string => {
    readThroughAlias.add(name);
    return aliases.get(name) ?? name;
  };
  const twoWayBlocks = twoWayStatements(
    twoWay.bindings,
    twoWay.props,
    localOf,
    model,
    twoWay.relays
  );
  for (const id of declaredIds) {
    if (id.prop !== undefined) readThroughAlias.add(id.prop);
  }
  const unreadShadowed = new Set(
    [...shadowedAliases.keys()].filter((name) => !readThroughAlias.has(name))
  );
  const defineBlock =
    definePropsStatement(
      component.name,
      declaredProps,
      defaultedProps,
      typeArguments,
      aliases,
      unreadShadowed
    ) ??
    (surface || attributesTag !== undefined
      ? `defineProps<${propsType}${typeArguments}>();`
      : undefined);
  const typedInterfaceBlock = interfaceBlock?.replace(
    propsType,
    `${propsType}${typeParameterDeclarations(component.typeParameters)}`
  );
  const propsSection = [
    typedInterfaceBlock,
    defineOptionsBlock,
    defineBlock,
  ].filter((block): block is string => block !== undefined);
  if (propsSection.length > 0) {
    sections.push(propsSection.join('\n\n'));
  }

  // The browser globals the template reads, ahead of the script, which may
  // read them at its top level.
  if (globals.length > 0) {
    sections.push(globals.map(globalDeclaration).join('\n'));
  }

  // Each two-way prop's emits, value and setter, ahead of everything that
  // may read them.
  for (const block of twoWayBlocks) {
    sections.push(block.join('\n'));
  }

  // The instance's id from `useId()`, and each declared id built from it: a
  // plain string, or a `computed` following the consumer's prop.
  if (declaredIds.length > 0) {
    sections.push(
      [
        `const ${GENERATED_ID_NAME} = useId();`,
        ...declaredIds.map((id) =>
          id.prop === undefined
            ? `const ${id.name} = ${idExpression(id)};`
            : `const ${id.name} = computed(() => ${idExpression(id, aliases.get(id.prop) ?? id.prop)});`
        ),
      ].join('\n')
    );
  }

  // Each derived value, a `computed` reading the two-way values, the ids
  // following a prop and the derived values before it through their
  // `.value`.
  if (derived.length > 0) {
    const computedNames = new Set([
      ...twoWay.bindings.map((binding) => binding.current),
      ...twoWay.relays.map((binding) => binding.given),
      ...idComputed,
      ...derived.map((value) => value.name),
    ]);
    sections.push(
      derived
        .map(
          (value) =>
            `const ${value.name} = computed(() => ${readTwoWayValues(arrowBodyOf(value.expression), computedNames)});`
        )
        .join('\n')
    );
  }

  if (rest) {
    sections.push('const rest = useAttrs();');
  }

  // A routed handle: the routed element, recorded by a directive, is the
  // `$el` a consumer's template ref reads, in place of the root, and its
  // typed `element`. An author's own `defineExpose` takes both: Vue allows
  // one call. An `element` the author exposes stays theirs.
  const merged =
    component.script !== undefined && routed !== undefined && routedHandle
      ? mergeRoutedExpose(component.script, ROUTED_ELEMENT)
      : undefined;
  const script = merged?.script ?? component.script;
  const scriptPath =
    (component.extensions['vue'] as VueComponentOverride | undefined)
      ?.script !== undefined
      ? 'extensions.vue.script'
      : 'script';
  if (merged?.unread === true) {
    warnings.push({
      message:
        'The Vue script seems to call defineExpose, but the call could not be read, so the routed element is not exposed (Vue allows one call). Expose it yourself: defineExpose({ $el: routedElement, element: routedElement }).',
      nodePath: scriptPath,
    });
  }
  if (merged?.authoredElement === true) {
    warnings.push({
      message:
        "The Vue script's defineExpose exposes its own 'element', which stays the author's; the routed element is exposed as $el only. Rename the authored key to expose the routed element as element too.",
      nodePath: scriptPath,
    });
  }
  if (routed !== undefined && routedHandle) {
    sections.push(
      routedElementDeclaration(
        routedElementType(routed.node),
        merged === undefined
      )
    );
  }

  if (component.bemRuntime !== undefined) {
    sections.push(`const bem = ${bemSetupCall(component.bemRuntime)};`);
  }

  if (script !== undefined && script.trim() !== '') {
    sections.push(script.trim());
  }

  if (usesAuthoredOrConsumer) {
    sections.push(authoredOrConsumerDeclaration());
  }

  if (usesAuthoredAndConsumer) {
    sections.push(authoredAndConsumerDeclaration());
  }

  if (usesDefinedProperties) {
    sections.push(definedPropertiesDeclaration());
  }

  if (routed !== undefined || usesConsumerAttributes) {
    sections.push(
      consumerAttributesDeclaration(
        routed?.entries ?? [],
        (htmlName) => htmlName,
        true
      )
    );
  }

  if (usesUnlessDefaultPrevented) {
    sections.push(unlessDefaultPreventedDeclaration());
  }

  if (usesInvokeHandler) {
    sections.push(invokeHandlerDeclaration());
  }

  if (usesOnceListeners) {
    sections.push(usedOnceListenersDeclaration());
  }

  if (sections.length === 0) {
    return undefined;
  }
  const generic = typeParameterScriptAttribute(
    'generic',
    component.typeParameters
  );
  return `<script setup lang="ts"${generic}>\n${sections.join('\n\n')}\n</script>`;
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
 * Reads the component-level `extensions.vue.scoped` flag. It applies only
 * to the in-file `<style>` block; under the other placements there
 * is no SFC style block to scope, so a requested `scoped` is ignored with
 * a warning.
 */
function resolveScoped(
  component: NormalizedComponent,
  placement: string,
  warnings: Warning[]
): boolean {
  const override = component.extensions['vue'] as
    | VueComponentOverride
    | undefined;
  if (override?.scoped !== true) {
    return false;
  }
  if (placement !== 'in-file') {
    warnings.push({
      message: `The 'scoped' option applies only to the in-file placement; ignored under '${placement}'`,
      nodePath: 'extensions.vue.scoped',
    });
    return false;
  }
  return true;
}

/**
 * Renders the SFC `<style>` block. Under `separate-file` the block is the
 * link to the emitted sibling stylesheet - so `stylesheetLink: 'none'`
 * emits no block at all rather than an empty one, the SFC form of omitting
 * an import.
 */
function buildStyleBlock(
  css: string,
  placement: string,
  stylesheetLink: StylesheetLink,
  scoped: boolean,
  componentName: string,
  language: 'css' | 'scss'
): string | undefined {
  if (css === '') {
    return undefined;
  }
  const extension = language === 'scss' ? 'scss' : 'css';
  if (placement === 'separate-file') {
    return stylesheetLink === 'component'
      ? `<style src="./${componentName}.${extension}"></style>`
      : undefined;
  }
  const langAttribute = language === 'scss' ? ' lang="scss"' : '';
  return `<style${langAttribute}${scoped ? ' scoped' : ''}>\n${css}\n</style>`;
}
