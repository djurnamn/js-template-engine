/**
 * Svelte Framework Extension
 * 
 * Generates Svelte components with reactive statements and event handlers.
 */

import type {
  FrameworkExtension,
  ExtensionMetadata,
  RenderContext,
  FrameworkEventOutput,
  FrameworkConditionalOutput,
  FrameworkIterationOutput,
  FrameworkSlotOutput,
  FrameworkAttributeOutput
} from '@js-template-engine/core';

import type {
  EventConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
  ComponentConcept,
  StructuralConcept,
  TextConcept,
  CommentConcept,
  FragmentConcept
} from '@js-template-engine/core';

import {
  EventNormalizer,
  ComponentPropertyProcessor,
  ScriptMergeProcessor,
  ImportProcessor,
  DEFAULT_MERGE_STRATEGIES
} from '@js-template-engine/core';

import type {
  ImportDefinition,
  ScriptMergeStrategy,
  PropMergeStrategy,
  ImportMergeStrategy
} from '@js-template-engine/core';

import type {
  SvelteEventOutput,
  SvelteConditionalOutput,
  SvelteIterationOutput,
  SvelteSlotOutput,
  SvelteAttributeOutput,
  SvelteAttributeInfo,
  SvelteComponentConfig,
  SvelteReactiveVariable,
  SvelteActionInfo,
  SvelteFeatureAnalysis,
  TemplateNode
} from './types';

/**
 * Svelte Framework Extension for generating Svelte components
 */
export class SvelteFrameworkExtension implements FrameworkExtension {
  public metadata: ExtensionMetadata & { type: 'framework' } = {
    type: 'framework',
    key: 'svelte',
    name: 'Svelte Framework Extension',
    version: '1.0.0'
  };

  public framework = 'svelte' as const;

  // Core processors
  private eventNormalizer = new EventNormalizer();
  private propertyProcessor: ComponentPropertyProcessor;
  private scriptMerger: ScriptMergeProcessor;
  private importProcessor = new ImportProcessor();

  // Merge strategies
  private scriptMergeStrategy: ScriptMergeStrategy = DEFAULT_MERGE_STRATEGIES.script;
  private propMergeStrategy: PropMergeStrategy = DEFAULT_MERGE_STRATEGIES.props;
  private importMergeStrategy: ImportMergeStrategy = DEFAULT_MERGE_STRATEGIES.imports;
  
  /** Current concepts being rendered (for per-element class access) */
  private concepts?: ComponentConcept;


  constructor() {
    this.propertyProcessor = new ComponentPropertyProcessor({
      script: this.scriptMergeStrategy,
      props: this.propMergeStrategy,
      imports: this.importMergeStrategy
    });
    this.scriptMerger = new ScriptMergeProcessor();
  }

  /**
   * Process event concepts to Svelte event handlers
   */
  processEvents(events: EventConcept[]): FrameworkEventOutput {
    const processedEvents = events.map(event => {
      // Normalize event to Svelte format: 'click' → 'on:click'
      const normalizedEvent = this.eventNormalizer.normalizeEvent(event, {
        framework: 'svelte',
        preserveModifiers: true
      });

      const syntax = this.generateEventSyntax(event.name, event.handler, event.modifiers || []);

      return {
        directive: normalizedEvent.frameworkAttribute,
        handler: event.handler,
        modifiers: event.modifiers || [],
        parameters: event.parameters || [],
        nodeId: event.nodeId,
        syntax
      } as SvelteEventOutput;
    });

    // Generate framework event output
    const attributes: Record<string, string> = {};
    const imports: string[] = [];

    for (const processedEvent of processedEvents) {
      attributes[processedEvent.directive] = processedEvent.handler;
    }

    return {
      attributes,
      imports
    };
  }

  /**
   * Generate Svelte event syntax with modifiers
   */
  private generateEventSyntax(eventName: string, handler: string, modifiers: string[] = []): string {
    const modifierString = modifiers.length > 0 ? `|${modifiers.join('|')}` : '';
    return `on:${eventName}${modifierString}={${handler}}`;
  }

  /**
   * Process conditional concepts for Svelte logic blocks
   */
  processConditionals(conditionals: ConditionalConcept[], globalAttributes: Record<string, string> = {}): FrameworkConditionalOutput {
    const processedConditionals = conditionals.map(conditional => {
      // Convert raw template nodes to rendered content while preserving per-element styling
      const thenContent = this.renderNodes(conditional.thenNodes);
      const elseContent = conditional.elseNodes ?
        this.renderNodes(conditional.elseNodes) : null;

      return {
        condition: conditional.condition,
        thenContent,
        elseContent,
        nodeId: conditional.nodeId,
        syntax: this.generateConditionalSyntax(conditional.condition, thenContent, elseContent)
      } as SvelteConditionalOutput;
    });

    const syntax = processedConditionals.map(c => c.syntax).join('\n');

    return {
      syntax,
      imports: []
    };
  }

  /**
   * Generate Svelte conditional syntax with proper formatting
   */
  private generateConditionalSyntax(
    condition: string,
    thenContent: string,
    elseContent: string | null
  ): string {
    const cleanThenContent = this.indentContent(thenContent.trim());

    let syntax = `{#if ${condition}}\n${cleanThenContent}`;

    if (elseContent) {
      const cleanElseContent = this.indentContent(elseContent.trim());
      syntax += `\n{:else}\n${cleanElseContent}`;
    }

    syntax += `\n{/if}`;

    return syntax;
  }

  /**
   * Indent content for Svelte blocks
   */
  private indentContent(content: string): string {
    return content.split('\n').map(line => 
      line.trim() ? `  ${line}` : line
    ).join('\n');
  }

  /**
   * Process iteration concepts for Svelte each blocks
   */
  processIterations(iterations: IterationConcept[], globalAttributes: Record<string, string> = {}): FrameworkIterationOutput {
    const processedIterations = iterations.map(iteration => {
      const vEachExpression = this.generateEachExpression(iteration);
      const keyExpression = iteration.keyExpression ||
        (iteration.indexVariable || 'index');
      // Convert raw template nodes to rendered content while preserving per-element styling
      const childContent = this.renderNodes(iteration.childNodes);

      return {
        vEachExpression,
        keyExpression,
        items: iteration.items,
        itemVariable: iteration.itemVariable,
        indexVariable: iteration.indexVariable,
        childContent,
        nodeId: iteration.nodeId,
        syntax: this.generateIterationSyntax(iteration, vEachExpression, keyExpression, childContent)
      } as SvelteIterationOutput;
    });

    const syntax = processedIterations.map(i => i.syntax).join('\n');

    return {
      syntax,
      imports: []
    };
  }

  /**
   * Generate Svelte each expression
   */
  private generateEachExpression(iteration: IterationConcept): string {
    let eachExpression = `${iteration.items} as ${iteration.itemVariable}`;

    if (iteration.indexVariable) {
      eachExpression += `, ${iteration.indexVariable}`;
    }

    if (iteration.keyExpression) {
      eachExpression += ` (${iteration.keyExpression})`;
    }

    return eachExpression;
  }

  /**
   * Generate Svelte iteration syntax with proper formatting
   */
  private generateIterationSyntax(
    iteration: IterationConcept,
    vEachExpression: string,
    keyExpression: string,
    childContent: string
  ): string {
    const cleanContent = this.indentContent(childContent.trim());
    return `{#each ${vEachExpression}}\n${cleanContent}\n{/each}`;
  }

  /**
   * Process slot concepts for Svelte slot elements
   */
  processSlots(slots: SlotConcept[]): FrameworkSlotOutput {
    const processedSlots = slots.map(slot => {
      const fallbackContent = slot.fallback ?
        this.renderNodes(slot.fallback) : null;

      return {
        name: slot.name,
        fallback: fallbackContent,
        nodeId: slot.nodeId,
        syntax: this.generateSlotSyntax(slot.name, fallbackContent)
      } as SvelteSlotOutput;
    });

    const syntax = processedSlots.map(s => s.syntax).join('\n');
    const props: Record<string, string> = {};

    return {
      syntax,
      props,
      imports: []
    };
  }

  /**
   * Generate slot syntax with proper fallback handling
   */
  private generateSlotSyntax(name: string, fallback: string | null): string {
    const slotAttributes = name === 'default' ? '' : ` name="${name}"`;

    if (fallback) {
      const cleanFallback = this.indentContent(fallback.trim());
      return `<slot${slotAttributes}>\n${cleanFallback}\n</slot>`;
    } else {
      return `<slot${slotAttributes} />`;
    }
  }

  /**
   * Process attribute concepts for Svelte attribute and directive handling
   */
  processAttributes(attributes: AttributeConcept[]): FrameworkAttributeOutput {
    const processedAttributes = attributes.map(attribute => {
      const svelteAttribute = this.processSvelteAttribute(attribute);

      return {
        originalName: attribute.name,
        svelteName: svelteAttribute.name,
        value: attribute.value,
        isExpression: attribute.isExpression,
        isDirective: svelteAttribute.isDirective,
        isBinding: svelteAttribute.isBinding,
        nodeId: attribute.nodeId,
        syntax: svelteAttribute.syntax
      } as SvelteAttributeOutput;
    });

    const attributeMap: Record<string, string> = {};
    for (const attr of processedAttributes) {
      if (typeof attr.value === 'string') {
        attributeMap[attr.svelteName] = attr.value;
      } else if (typeof attr.value === 'boolean' && attr.value) {
        attributeMap[attr.svelteName] = 'true';
      }
    }

    return {
      attributes: attributeMap,
      imports: []
    };
  }

  /**
   * Process Svelte attribute
   */
  private processSvelteAttribute(attribute: AttributeConcept): SvelteAttributeInfo {
    const { name, value, isExpression } = attribute;

    // Handle Svelte directives
    if (name.startsWith('use:') || name.startsWith('on:') || name.startsWith('bind:')) {
      return {
        name,
        isDirective: true,
        isBinding: name.startsWith('bind:'),
        syntax: `${name}={${value}}`
      };
    }

    // Handle class directive (special case)
    if (name === 'class' && isExpression) {
      return {
        name,
        isDirective: true,
        isBinding: false,
        syntax: `class={${value}}`
      };
    }

    // Handle dynamic attributes
    if (isExpression) {
      return {
        name,
        isDirective: false,
        isBinding: false,
        syntax: `${name}={${value}}`
      };
    }

    // Static attributes
    return {
      name,
      isDirective: false,
      isBinding: false,
      syntax: `${name}="${value}"`
    };
  }

  /**
   * Render component to Svelte format
   */
  renderComponent(concepts: ComponentConcept, context: RenderContext): string {
    // Store concepts for per-element class access
    this.concepts = concepts;
    
    // Resolve component name
    const componentName = this.propertyProcessor.resolveComponentName(
      { framework: 'svelte', component: context.component },
      { common: context.component },
      'Component' // default
    );

    // Generate component sections
    const scriptSection = this.generateScriptSection(concepts, context, componentName);
    const templateSection = this.generateTemplateSection(concepts);
    const styleSection = this.generateStyleSection(context);

    return this.assembleSvelteComponent(scriptSection, templateSection, styleSection);
  }

  /**
   * Assemble Svelte component sections
   */
  private assembleSvelteComponent(script: string, template: string, style: string): string {
    const sections = [script, template, style].filter(Boolean);
    return sections.join('\n\n');
  }

  /**
   * Generate script section
   */
  private generateScriptSection(
    concepts: ComponentConcept,
    context: RenderContext,
    componentName: string
  ): string {
    const useTypeScript = (context.options?.language || 'javascript') === 'typescript';

    // Merge imports and scripts
    const imports = this.importProcessor.mergeImports(
      this.getDefaultSvelteImports(concepts),
      context.component?.imports || [],
      { strategy: this.importMergeStrategy }
    );

    const scriptResult = this.scriptMerger.mergeScripts(
      context.component?.script || '',
      context.component?.extensions?.svelte?.script || '',
      this.scriptMergeStrategy
    );
    const script = scriptResult.content;

    // Generate props and reactive statements
    const propsSection = this.generateProps(concepts, context, useTypeScript);
    const reactiveSection = this.generateReactiveStatements(concepts, context);

    const lang = useTypeScript ? ' lang="ts"' : '';
    const importStatements = this.formatImports(imports);

    const scriptContent = [
      importStatements.join('\n'),
      propsSection,
      script,
      reactiveSection
    ].filter(Boolean).join('\n\n');

    return `<script${lang}>\n${this.indentScript(scriptContent)}\n</script>`;
  }

  /**
   * Generate props section
   */
  private generateProps(concepts: ComponentConcept, context: RenderContext, useTypeScript: boolean): string {
    const props = this.mergeAllProps(concepts, context);

    if (Object.keys(props).length === 0) {
      return '';
    }

    if (useTypeScript) {
      // TypeScript prop declarations
      const propDeclarations = Object.entries(props).map(([key, type]) =>
        `export let ${key}: ${type};`
      ).join('\n');

      return propDeclarations;
    } else {
      // JavaScript prop declarations
      const propDeclarations = Object.keys(props).map(key =>
        `export let ${key};`
      ).join('\n');

      return propDeclarations;
    }
  }

  /**
   * Generate reactive statements
   */
  private generateReactiveStatements(concepts: ComponentConcept, context: RenderContext): string {
    const reactiveStatements: string[] = [];

    // Analyze concepts for reactive dependencies
    const reactiveVars = this.analyzeReactiveVariables(concepts, context);

    reactiveVars.forEach(reactiveVar => {
      reactiveStatements.push(`$: ${reactiveVar.statement}`);
    });

    return reactiveStatements.join('\n');
  }

  /**
   * Analyze reactive variables
   */
  private analyzeReactiveVariables(concepts: ComponentConcept, context: RenderContext): SvelteReactiveVariable[] {
    const reactiveVars: SvelteReactiveVariable[] = [];
    const script = context.component?.script || '';

    // Simple analysis for reactive statements
    const reactiveMatches = script.match(/\$:\s*(.+)/g);

    if (reactiveMatches) {
      reactiveMatches.forEach((match: string) => {
        const statement = match.replace(/\$:\s*/, '');
        reactiveVars.push({
          statement,
          dependencies: this.extractDependencies(statement)
        });
      });
    }

    return reactiveVars;
  }

  /**
   * Extract dependencies from statement
   */
  private extractDependencies(statement: string): string[] {
    // Basic dependency extraction
    const varMatches = statement.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
    return [...new Set(varMatches)];
  }

  /**
   * Generate template section
   */
  private generateTemplateSection(concepts: ComponentConcept): string {
    const templateContent = this.renderTemplate(concepts);
    return templateContent;
  }

  /**
   * Generate style section
   */
  private generateStyleSection(context: RenderContext): string {
    const styleOutput = context.styleOutput ||
      context.component?.extensions?.svelte?.styleOutput || '';

    if (!styleOutput.trim()) {
      return '';
    }

    const styleLanguage = context.component?.extensions?.svelte?.styleLanguage ?? 'css';
    const isGlobal = context.component?.extensions?.svelte?.globalStyles ?? false;

    const attributes = [];
    if (styleLanguage !== 'css') {
      attributes.push(`lang="${styleLanguage}"`);
    }
    if (isGlobal) {
      attributes.push('global');
    }

    const attrString = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';

    return `<style${attrString}>\n${styleOutput.trim()}\n</style>`;
  }

  /**
   * Get default Svelte imports
   */
  private getDefaultSvelteImports(concepts: ComponentConcept): ImportDefinition[] {
    const imports: ImportDefinition[] = [];

    // Analyze concepts for required Svelte features
    const features = this.analyzeSvelteFeatures(concepts);

    if (features.stores.length > 0) {
      imports.push({
        from: 'svelte/store',
        named: features.stores
      });
    }

    if (features.lifecycle.length > 0) {
      imports.push({
        from: 'svelte',
        named: features.lifecycle
      });
    }

    if (features.transitions.length > 0) {
      imports.push({
        from: 'svelte/transition',
        named: features.transitions
      });
    }

    return imports;
  }

  /**
   * Analyze Svelte features
   */
  private analyzeSvelteFeatures(concepts: ComponentConcept): SvelteFeatureAnalysis {
    return {
      stores: this.analyzeStoreUsage(concepts),
      lifecycle: this.analyzeLifecycleHooks(concepts),
      transitions: this.analyzeTransitions(concepts),
      actions: this.analyzeActions(concepts)
    };
  }

  /**
   * Analyze store usage
   */
  private analyzeStoreUsage(concepts: ComponentConcept): string[] {
    const storeFeatures = new Set<string>();
    // Analysis logic would be implemented here
    return Array.from(storeFeatures);
  }

  /**
   * Analyze lifecycle hooks
   */
  private analyzeLifecycleHooks(concepts: ComponentConcept): string[] {
    const lifecycleHooks = new Set<string>();
    // Analysis logic would be implemented here
    return Array.from(lifecycleHooks);
  }

  /**
   * Analyze transitions
   */
  private analyzeTransitions(concepts: ComponentConcept): string[] {
    const transitions = new Set<string>();
    // Analysis logic would be implemented here
    return Array.from(transitions);
  }

  /**
   * Analyze actions
   */
  private analyzeActions(concepts: ComponentConcept): string[] {
    const actions = new Set<string>();
    
    // Process use: directives from concepts
    concepts.attributes.forEach(attr => {
      if (attr.name.startsWith('use:')) {
        const actionName = attr.name.slice(4);
        actions.add(actionName);
      }
    });

    return Array.from(actions);
  }

  /**
   * Merge all props
   */
  private mergeAllProps(concepts: ComponentConcept, context: RenderContext): Record<string, string> {
    const props: Record<string, string> = {};

    // Add slot props
    for (const slot of concepts.slots) {
      const propName = slot.name === 'default' ? 'children' : slot.name;
      props[propName] = 'any';
    }

    // Merge with component props
    if (context.component?.props) {
      Object.assign(props, context.component.props);
    }

    return props;
  }

  /**
   * Format imports to string array
   */
  private formatImports(imports: ImportDefinition[]): string[] {
    return imports.map(imp => {
      const parts: string[] = [];

      if (imp.default && imp.named) {
        parts.push(`${imp.default}, { ${imp.named.join(', ')} }`);
      } else if (imp.default) {
        parts.push(imp.default);
      } else if (imp.named) {
        parts.push(`{ ${imp.named.join(', ')} }`);
      } else if (imp.namespace) {
        parts.push(`* as ${imp.namespace}`);
      }

      const typePrefix = imp.typeOnly ? 'type ' : '';
      return `import ${typePrefix}${parts.join('')} from '${imp.from}';`;
    });
  }

  /**
   * Indent script content
   */
  private indentScript(script: string): string {
    return script.split('\n').map(line =>
      line.trim() ? `  ${line}` : line
    ).join('\n');
  }

  /**
   * Render template from concepts
   */
  private renderTemplate(concepts: ComponentConcept): string {
    // Process behavioural concepts to get attributes and special logic
    let eventAttributes: Record<string, string> = {};
    if (concepts.events.length > 0) {
      const eventOutput = this.processEvents(concepts.events);
      eventAttributes = eventOutput.attributes;
    }

    let staticAttributes: Record<string, string> = {};
    if (concepts.attributes.length > 0) {
      const attributeOutput = this.processAttributes(concepts.attributes);
      staticAttributes = attributeOutput.attributes;
    }

    const allAttributes = { ...staticAttributes, ...eventAttributes };

    // Add styling classes if present
    if (concepts.styling) {
      const staticClasses = concepts.styling.staticClasses.join(' ');
      if (staticClasses) {
        allAttributes['class'] = staticClasses;
      }

      if (Object.keys(concepts.styling.inlineStyles).length > 0) {
        const styleObj = Object.entries(concepts.styling.inlineStyles)
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ');
        allAttributes['style'] = styleObj;
      }
    }

    // Render structural concepts
    const structuralOutput = this.renderStructuralConcepts(concepts.structure, allAttributes);

    // Process behavioral concepts that generate their own syntax
    const parts: string[] = [structuralOutput];

    if (concepts.conditionals.length > 0) {
      const conditionalOutput = this.processConditionals(concepts.conditionals, allAttributes);
      parts.push(conditionalOutput.syntax);
    }

    if (concepts.iterations.length > 0) {
      const iterationOutput = this.processIterations(concepts.iterations, allAttributes);
      parts.push(iterationOutput.syntax);
    }

    if (concepts.slots.length > 0) {
      const slotOutput = this.processSlots(concepts.slots);
      parts.push(slotOutput.syntax);
    }

    return parts.filter(Boolean).join('\n');
  }

  /**
   * Render structural concepts to HTML
   */
  private renderStructuralConcepts(
    structuralConcepts: (StructuralConcept | TextConcept | CommentConcept | FragmentConcept)[],
    attributes: Record<string, string>
  ): string {
    return structuralConcepts.map((concept, index) => {
      switch (concept.type) {
        case 'text':
          const textConcept = concept as TextConcept;
          return textConcept.content;

        case 'comment':
          const commentConcept = concept as CommentConcept;
          return `<!-- ${commentConcept.content} -->`;

        case 'fragment':
          const fragmentConcept = concept as FragmentConcept;
          return this.renderStructuralConcepts(fragmentConcept.children, {});

        case 'element':
        default:
          // StructuralConcept (element)
          const structuralConcept = concept as StructuralConcept;
          // Only apply global attributes to the first element
          const attributesToApply = index === 0 ? attributes : {};
          return this.renderStructuralElement(structuralConcept, attributesToApply);
      }
    }).join('');
  }

  /**
   * Render a structural element
   */
  private renderStructuralElement(
    concept: StructuralConcept,
    globalAttributes: Record<string, string>
  ): string {
    const tag = concept.tag;
    
    // Render children
    const childrenOutput = this.renderStructuralConcepts(concept.children, {});
    
    let attributeString = '';
    
    // First, render the element's own attributes
    if (concept.attributes) {
      for (const [name, value] of Object.entries(concept.attributes)) {
        // Handle Svelte event directives and expressions correctly
        if (name.startsWith('on:') || name.startsWith('bind:') || name.startsWith('use:')) {
          attributeString += ` ${name}={${value}}`;
        } else if (this.isExpressionValue(String(value))) {
          // Handle expression attributes like disabled="{isDisabled}" -> disabled={isDisabled}
          const expressionContent = this.extractExpressionContent(String(value));
          attributeString += ` ${name}={${expressionContent}}`;
        } else {
          attributeString += ` ${name}="${value}"`;
        }
      }
    }

    // Apply per-element classes if available (e.g., from BEM extension)
    if (this.concepts?.styling?.perElementClasses && concept.nodeId) {
      const elementClasses = this.concepts.styling.perElementClasses[concept.nodeId];
      if (elementClasses && elementClasses.length > 0) {
        const classNames = elementClasses.join(' ');
        // Merge with existing class attribute if present
        const existingClass = concept.attributes?.class || '';
        const combinedClasses = existingClass ? `${existingClass} ${classNames}` : classNames;
        attributeString += ` class="${combinedClasses}"`;
      }
    }
    
    // Then apply global attributes (behavioral concepts)
    if (Object.keys(globalAttributes).length > 0) {
      for (const [name, value] of Object.entries(globalAttributes)) {
        // Skip attributes that look like event names without proper prefixes
        // This prevents issues where 'mouseenter' appears instead of 'on:mouseenter'
        const commonEvents = ['click', 'mouseenter', 'mouseleave', 'keydown', 'keyup', 'change', 'input', 'submit', 'focus', 'blur'];
        if (commonEvents.includes(name.toLowerCase())) {
          continue; // Skip potential event attributes without proper prefixes
        }
        
        // Handle Svelte event directives and expressions correctly
        if (name.startsWith('on:') || name.startsWith('bind:') || name.startsWith('use:')) {
          attributeString += ` ${name}={${value}}`;
        } else if (this.isExpressionValue(value)) {
          // Handle expression attributes like disabled="{isDisabled}" -> disabled={isDisabled}
          const expressionContent = this.extractExpressionContent(value);
          attributeString += ` ${name}={${expressionContent}}`;
        } else {
          attributeString += ` ${name}="${value}"`;
        }
      }
    }

    // Self-closing tags
    if (concept.isSelfClosing && !childrenOutput) {
      return `<${tag}${attributeString} />`;
    }

    return `<${tag}${attributeString}>${childrenOutput}</${tag}>`;
  }

  /**
   * Check if a value is an expression (wrapped in curly braces)
   */
  private isExpressionValue(value: string): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return trimmed.startsWith('{') && trimmed.endsWith('}');
  }

  /**
   * Extract expression content from curly braces
   */
  private extractExpressionContent(value: string): string {
    if (!this.isExpressionValue(value)) return value;
    const trimmed = value.trim();
    return trimmed.slice(1, -1); // Remove { and }
  }

  /**
   * Render template nodes to string
   */
  private renderNodes(nodes: any[]): string {
    if (!nodes || nodes.length === 0) return '';

    return nodes.map(node => this.renderSingleNode(node)).join('');
  }

  /**
   * Render a single template node
   */
  private renderSingleNode(node: any): string {
    // Handle simple string nodes
    if (typeof node === 'string') return node;

    // Handle different node types
    switch (node.type) {
      case 'text':
        return node.content || '';

      case 'comment':
        return `<!-- ${node.content} -->`;

      case 'element':
        return this.renderElementNode(node);

      case 'if':
        const thenContent = this.renderNodes(node.then || []);
        const elseContent = node.else ? this.renderNodes(node.else) : null;
        return this.generateConditionalSyntax(node.condition, thenContent, elseContent);

      case 'for':
        const iterationContent = this.renderNodes(node.children || []);
        const iteration = {
          items: node.items,
          itemVariable: node.item,
          indexVariable: node.index,
          keyExpression: node.key,
          childNodes: node.children
        } as IterationConcept;
        const vEachExpression = this.generateEachExpression(iteration);
        return this.generateIterationSyntax(iteration, vEachExpression, node.key || 'index', iterationContent);

      case 'slot':
        const fallback = node.fallback ? this.renderNodes(node.fallback) : null;
        return this.generateSlotSyntax(node.name, fallback);

      default:
        // Unknown node type, try to render as generic object
        if (node.tag) {
          return this.renderElementNode(node);
        }
        return '';
    }
  }

  /**
   * Render an element node
   */
  private renderElementNode(node: any): string {
    const tag = node.tag || 'div';

    // Get children content
    let children = '';
    if (node.children && node.children.length > 0) {
      children = this.renderNodes(node.children);
    } else if (node.content) {
      children = node.content;
    }

    // Process attributes
    let attributes = '';
    if (node.attributes) {
      for (const [name, value] of Object.entries(node.attributes)) {
        if (typeof value === 'boolean' && value) {
          attributes += ` ${name}`;
        } else if (typeof value === 'string' || typeof value === 'number') {
          // Handle Svelte event directives and expressions correctly
          if (name.startsWith('on:') || name.startsWith('bind:') || name.startsWith('use:')) {
            attributes += ` ${name}={${value}}`;
          } else {
            attributes += ` ${name}="${value}"`;
          }
        }
      }
    }

    // Process expression attributes
    if (node.expressionAttributes) {
      for (const [name, expression] of Object.entries(node.expressionAttributes)) {
        attributes += ` ${name}={${expression}}`;
      }
    }

    // Apply per-element classes if available (e.g., from BEM extension)
    // For raw template nodes, we need to find the matching classes by checking all per-element classes
    if (this.concepts?.styling?.perElementClasses && node.extensions) {
      // Find the nodeId that matches this node's extension data
      let matchedClasses: string[] = [];
      
      if (this.concepts.styling.extensionData?.bem) {
        for (const bemNode of this.concepts.styling.extensionData.bem) {
          // Check if this BEM node data matches the current node's extension data
          if (node.extensions.bem && 
              JSON.stringify(bemNode.data) === JSON.stringify(node.extensions.bem)) {
            const elementClasses = this.concepts.styling.perElementClasses[bemNode.nodeId];
            if (elementClasses && elementClasses.length > 0) {
              matchedClasses = elementClasses;
              break;
            }
          }
        }
      }
      
      if (matchedClasses.length > 0) {
        const classNames = matchedClasses.join(' ');
        // Merge with existing class attribute if present
        const existingClass = node.attributes?.class || '';
        const combinedClasses = existingClass ? `${existingClass} ${classNames}` : classNames;
        attributes += ` class="${combinedClasses}"`;
      }
    }

    // Self-closing tags
    const selfClosingTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
                            'link', 'meta', 'param', 'source', 'track', 'wbr'];

    if (selfClosingTags.includes(tag.toLowerCase()) && !children) {
      return `<${tag}${attributes} />`;
    }

    return `<${tag}${attributes}>${children}</${tag}>`;
  }

  /**
   * Get file extension for Svelte components
   */
  public getFileExtension(_options: { language?: 'typescript' | 'javascript' }): string {
    return '.svelte';
  }

  /**
   * Get Prettier parser for Svelte components
   */
  public getPrettierParser(_options: { language?: 'typescript' | 'javascript' }): string {
    return 'svelte';
  }
}

// Main exports
export default SvelteFrameworkExtension;
export { SvelteFrameworkExtension as SvelteExtension };
export * from './types';