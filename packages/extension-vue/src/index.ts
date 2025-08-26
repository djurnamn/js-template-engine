/**
 * Vue Framework Extension
 * 
 * Generates Vue Single File Components with template, script, and style sections.
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

/**
 * Vue-specific event output interface
 */
export interface VueEventOutput {
  directive: string;
  handler: string;
  modifiers: string[];
  parameters: string[];
  nodeId: string;
  syntax: string;
}

/**
 * Vue-specific conditional output interface
 */
export interface VueConditionalOutput {
  condition: string;
  thenElements: VueElement;
  elseElements: VueElement | null;
  nodeId: string;
  syntax: string;
}

/**
 * Vue-specific iteration output interface
 */
export interface VueIterationOutput {
  vForExpression: string;
  keyExpression: string;
  items: string;
  itemVariable: string;
  indexVariable?: string;
  nodeId: string;
  syntax: VueElement;
}

/**
 * Vue-specific slot output interface
 */
export interface VueSlotOutput {
  name: string;
  fallback: string | null;
  nodeId: string;
  syntax: VueElement;
}

/**
 * Vue-specific attribute output interface
 */
export interface VueAttributeOutput {
  originalName: string;
  vueName: string;
  value: string | boolean;
  isExpression: boolean;
  isDirective: boolean;
  nodeId: string;
  syntax: string;
}

/**
 * Vue element interface
 */
export interface VueElement {
  type: 'element';
  tag: string;
  attributes: Record<string, string>;
  children?: any[];
}

/**
 * Vue attribute info interface
 */
export interface VueAttributeInfo {
  name: string;
  isDirective: boolean;
  syntax: string;
}

/**
 * Vue conditional elements interface
 */
export interface VueConditionalElements {
  thenElements: VueElement;
  elseElements: VueElement | null;
  combined: VueElement[];
}

/**
 * Vue reactivity info interface
 */
export interface VueReactivityInfo {
  reactive: string[];
  computed: string[];
  watch: string[];
}

/**
 * Vue component generation configuration
 */
export interface VueComponentConfig {
  name: string;
  imports: string[];
  script: string;
  props: Record<string, string>;
  concepts: ComponentConcept;
  context: RenderContext;
}

/**
 * Template node interface
 */
export interface TemplateNode {
  type?: string;
  tag?: string;
  content?: string;
  attributes?: Record<string, any>;
  children?: TemplateNode[];
  [key: string]: any;
}

/**
 * Vue Framework Extension for generating Single File Components
 */
export class VueFrameworkExtension implements FrameworkExtension {
  public metadata: ExtensionMetadata & { type: 'framework' } = {
    type: 'framework',
    key: 'vue',
    name: 'Vue Framework Extension',
    version: '1.0.0'
  };

  public framework = 'vue' as const;

  // Core processors
  private eventNormalizer = new EventNormalizer();
  private propertyProcessor: ComponentPropertyProcessor;
  private scriptMerger: ScriptMergeProcessor;
  private importProcessor = new ImportProcessor();

  // Merge strategies
  private scriptMergeStrategy: ScriptMergeStrategy = DEFAULT_MERGE_STRATEGIES.script;
  private propMergeStrategy: PropMergeStrategy = DEFAULT_MERGE_STRATEGIES.props;
  private importMergeStrategy: ImportMergeStrategy = DEFAULT_MERGE_STRATEGIES.imports;

  constructor() {
    this.propertyProcessor = new ComponentPropertyProcessor({
      script: this.scriptMergeStrategy,
      props: this.propMergeStrategy,
      imports: this.importMergeStrategy
    });
    this.scriptMerger = new ScriptMergeProcessor();
  }

  /**
   * Process event concepts to Vue directives
   */
  processEvents(events: EventConcept[]): FrameworkEventOutput {
    const processedEvents = events.map(event => {
      // Normalize event to Vue directive format
      const normalizedEvent = this.eventNormalizer.normalizeEvent(event, {
        framework: 'vue',
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
      } as VueEventOutput;
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
   * Generate Vue event syntax with modifiers
   */
  private generateEventSyntax(eventName: string, handler: string, modifiers: string[] = []): string {
    const modifierString = modifiers.length > 0 ? `.${modifiers.join('.')}` : '';
    return `@${eventName}${modifierString}="${handler}"`;
  }

  /**
   * Process conditional concepts for Vue v-if/v-else directives
   */
  processConditionals(conditionals: ConditionalConcept[]): FrameworkConditionalOutput {
    const processedConditionals = conditionals.map(conditional => {
      const elements = this.generateConditionalElements(conditional);
      
      return {
        condition: conditional.condition,
        thenElements: elements.thenElements,
        elseElements: elements.elseElements,
        nodeId: conditional.nodeId,
        syntax: elements.combined.map(el => this.renderVueElement(el)).join('\n')
      } as VueConditionalOutput;
    });

    const syntax = processedConditionals.map(c => c.syntax).join('\n');

    return {
      syntax,
      imports: []
    };
  }

  /**
   * Generate Vue conditional elements
   */
  private generateConditionalElements(conditional: ConditionalConcept): VueConditionalElements {
    const thenElements = this.processConditionalBranch(conditional.thenNodes, {
      'v-if': conditional.condition
    });
    
    const elseElements = conditional.elseNodes ?
      this.processConditionalBranch(conditional.elseNodes, { 'v-else': '' }) : null;
    
    return {
      thenElements,
      elseElements,
      combined: elseElements ? [thenElements, elseElements] : [thenElements]
    };
  }

  /**
   * Process conditional branch
   */
  private processConditionalBranch(nodes: TemplateNode[], directive: Record<string, string>): VueElement {
    if (nodes.length === 1 && this.isElementNode(nodes[0])) {
      // Single element - add directive directly
      return {
        type: 'element',
        tag: nodes[0].tag || 'div',
        attributes: { ...nodes[0].attributes, ...directive },
        children: nodes[0].children || []
      };
    } else {
      // Multiple elements - wrap in template
      return {
        type: 'element',
        tag: 'template',
        attributes: directive,
        children: nodes
      };
    }
  }

  /**
   * Process iteration concepts for Vue v-for directive
   */
  processIterations(iterations: IterationConcept[]): FrameworkIterationOutput {
    const processedIterations = iterations.map(iteration => {
      const vForExpression = this.generateVForExpression(iteration);
      const keyExpression = iteration.keyExpression || 
        (iteration.indexVariable || 'index');
      
      const element = this.generateIterationElement(iteration, vForExpression, keyExpression);
      
      return {
        vForExpression,
        keyExpression,
        items: iteration.items,
        itemVariable: iteration.itemVariable,
        indexVariable: iteration.indexVariable,
        nodeId: iteration.nodeId,
        syntax: element
      } as VueIterationOutput;
    });

    const syntax = processedIterations.map(i => this.renderVueElement(i.syntax)).join('\n');

    return {
      syntax,
      imports: []
    };
  }

  /**
   * Generate Vue v-for expression
   */
  private generateVForExpression(iteration: IterationConcept): string {
    if (iteration.indexVariable) {
      return `(${iteration.itemVariable}, ${iteration.indexVariable}) in ${iteration.items}`;
    } else {
      return `${iteration.itemVariable} in ${iteration.items}`;
    }
  }

  /**
   * Generate iteration element
   */
  private generateIterationElement(
    iteration: IterationConcept,
    vForExpression: string,
    keyExpression: string
  ): VueElement {
    const directives = {
      'v-for': vForExpression,
      ':key': keyExpression
    };
    
    if (iteration.childNodes.length === 1 && this.isElementNode(iteration.childNodes[0])) {
      // Single element - add v-for directly
      const child = iteration.childNodes[0];
      return {
        type: 'element',
        tag: child.tag || 'div',
        attributes: { ...child.attributes, ...directives },
        children: child.children || []
      };
    } else {
      // Multiple elements - wrap in template
      return {
        type: 'element',
        tag: 'template',
        attributes: directives,
        children: iteration.childNodes
      };
    }
  }

  /**
   * Process slot concepts for Vue slot elements
   */
  processSlots(slots: SlotConcept[]): FrameworkSlotOutput {
    const processedSlots = slots.map(slot => {
      const fallbackContent = slot.fallback ? 
        this.renderNodes(slot.fallback) : null;
      
      return {
        name: slot.name,
        fallback: fallbackContent,
        nodeId: slot.nodeId,
        syntax: this.generateSlotElement(slot.name, fallbackContent)
      } as VueSlotOutput;
    });

    const syntax = processedSlots.map(s => this.renderVueElement(s.syntax)).join('\n');
    const props: Record<string, string> = {};

    return {
      syntax,
      props,
      imports: []
    };
  }

  /**
   * Generate slot element
   */
  private generateSlotElement(name: string, fallback: string | null): VueElement {
    const attributes: Record<string, string> = name === 'default' ? {} : { name };
    
    return {
      type: 'element',
      tag: 'slot',
      attributes,
      children: fallback ? this.parseNodes(fallback) : []
    };
  }

  /**
   * Process attribute concepts for Vue attribute and directive handling
   */
  processAttributes(attributes: AttributeConcept[]): FrameworkAttributeOutput {
    const processedAttributes = attributes.map(attribute => {
      const vueAttribute = this.processVueAttribute(attribute);
      
      return {
        originalName: attribute.name,
        vueName: vueAttribute.name,
        value: attribute.value,
        isExpression: attribute.isExpression,
        isDirective: vueAttribute.isDirective,
        nodeId: attribute.nodeId,
        syntax: vueAttribute.syntax
      } as VueAttributeOutput;
    });

    const attributeMap: Record<string, string> = {};
    for (const attr of processedAttributes) {
      if (typeof attr.value === 'string') {
        attributeMap[attr.vueName] = attr.value;
      } else if (typeof attr.value === 'boolean' && attr.value) {
        attributeMap[attr.vueName] = 'true';
      }
    }

    return {
      attributes: attributeMap,
      imports: []
    };
  }

  /**
   * Process Vue attribute
   */
  private processVueAttribute(attribute: AttributeConcept): VueAttributeInfo {
    const { name, value, isExpression } = attribute;
    
    // Handle Vue directives
    if (name.startsWith('v-') || name.startsWith('@') || name.startsWith(':')) {
      return {
        name,
        isDirective: true,
        syntax: `${name}="${value}"`
      };
    }
    
    // Handle dynamic bindings
    if (isExpression) {
      return {
        name: `:${name}`,
        isDirective: true,
        syntax: `:${name}="${value}"`
      };
    }
    
    // Static attributes
    return {
      name,
      isDirective: false,
      syntax: `${name}="${value}"`
    };
  }

  /**
   * Render component to Vue SFC format
   */
  renderComponent(concepts: ComponentConcept, context: RenderContext): string {
    // Resolve component name
    const componentName = this.propertyProcessor.resolveComponentName(
      { framework: 'vue', component: context.component },
      { common: context.component },
      'Component' // default
    );

    // Generate SFC sections
    const templateSection = this.generateTemplateSection(concepts);
    const scriptSection = this.generateScriptSection(concepts, context, componentName);
    const styleSection = this.generateStyleSection(context);
    
    return this.assembleSFC(templateSection, scriptSection, styleSection);
  }

  /**
   * Assemble SFC sections
   */
  private assembleSFC(template: string, script: string, style: string): string {
    const sections = [template, script, style].filter(Boolean);
    return sections.join('\n\n');
  }

  /**
   * Generate template section
   */
  private generateTemplateSection(concepts: ComponentConcept): string {
    const templateContent = this.renderTemplate(concepts);
    return `<template>\n  ${this.indentTemplate(templateContent)}\n</template>`;
  }

  /**
   * Indent template content
   */
  private indentTemplate(content: string): string {
    return content.split('\n').map(line => 
      line.trim() ? `  ${line}` : line
    ).join('\n');
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
    const useComposition = context.component?.extensions?.vue?.composition ?? 
      context.options?.composition ?? false;
    const useSetup = context.component?.extensions?.vue?.setup ?? 
      context.options?.setup ?? false;
    
    if (useSetup) {
      return this.generateSetupScript(concepts, context, componentName, useTypeScript);
    } else if (useComposition) {
      return this.generateCompositionScript(concepts, context, componentName, useTypeScript);
    } else {
      return this.generateOptionsScript(concepts, context, componentName, useTypeScript);
    }
  }

  /**
   * Generate setup script
   */
  private generateSetupScript(
    concepts: ComponentConcept,
    context: RenderContext,
    _componentName: string,
    useTypeScript: boolean
  ): string {
    // Merge imports and scripts
    const imports = this.importProcessor.mergeImports(
      this.getDefaultVueImports(concepts, true),
      context.component?.imports || [],
      { strategy: this.importMergeStrategy }
    );
    
    const scriptResult = this.scriptMerger.mergeScripts(
      context.component?.script || '',
      context.component?.extensions?.vue?.script || '',
      this.scriptMergeStrategy
    );
    const script = scriptResult.content;
    
    // Generate props definition
    const propsDefinition = this.generateSetupProps(concepts, context, useTypeScript);
    
    const lang = useTypeScript ? ' lang="ts"' : '';
    const importStatements = this.formatImports(imports);
    
    return `<script setup${lang}>
${importStatements.join('\n')}

${propsDefinition}

${script}
</script>`;
  }

  /**
   * Generate composition script
   */
  private generateCompositionScript(
    concepts: ComponentConcept,
    context: RenderContext,
    componentName: string,
    useTypeScript: boolean
  ): string {
    // Use composition API but not setup syntax
    return this.generateOptionsScript(concepts, context, componentName, useTypeScript);
  }

  /**
   * Generate options script
   */
  private generateOptionsScript(
    concepts: ComponentConcept,
    context: RenderContext,
    componentName: string,
    useTypeScript: boolean
  ): string {
    const imports = this.importProcessor.mergeImports(
      this.getDefaultVueImports(concepts, false),
      context.component?.imports || [],
      { strategy: this.importMergeStrategy }
    );
    
    const scriptResult = this.scriptMerger.mergeScripts(
      context.component?.script || '',
      context.component?.extensions?.vue?.script || '',
      this.scriptMergeStrategy
    );
    const script = scriptResult.content;
    
    const props = this.generateOptionsProps(concepts, context);
    const lang = useTypeScript ? ' lang="ts"' : '';
    const importStatements = this.formatImports(imports);
    
    // Generate TypeScript interface for Options API
    const propsInterface = useTypeScript && Object.keys(this.mergeAllProps(concepts, context)).length > 0 ?
      this.generatePropsInterface(`${componentName}Props`, this.mergeAllProps(concepts, context)) + '\n\n' : '';
    
    return `<script${lang}>
${importStatements.join('\n')}

${propsInterface}export default defineComponent({
  name: '${componentName}',${props ? `\n  ${props},` : ''}${script ? `\n  setup() {\n    ${this.indentScript(script)}\n  }` : ''}
});
</script>`;
  }

  /**
   * Generate setup props
   */
  private generateSetupProps(
    concepts: ComponentConcept,
    context: RenderContext,
    useTypeScript: boolean
  ): string {
    const props = this.mergeAllProps(concepts, context);
    
    if (Object.keys(props).length === 0) {
      return '';
    }
    
    if (useTypeScript) {
      // TypeScript interface approach
      const interfaceName = `${this.getComponentName(context)}Props`;
      const propsInterface = this.generatePropsInterface(interfaceName, props);
      return `${propsInterface}\n\ndefineProps<${interfaceName}>();`;
    } else {
      // Runtime props definition
      const runtimeProps = this.generateRuntimeProps(props);
      return `const props = defineProps(${runtimeProps});`;
    }
  }

  /**
   * Generate options props
   */
  private generateOptionsProps(concepts: ComponentConcept, context: RenderContext): string {
    const props = this.mergeAllProps(concepts, context);
    
    if (Object.keys(props).length === 0) {
      return '';
    }
    
    const runtimeProps = this.generateRuntimeProps(props);
    return `props: ${runtimeProps}`;
  }

  /**
   * Generate style section
   */
  private generateStyleSection(context: RenderContext): string {
    const styleOutput = context.styleOutput || 
      context.component?.extensions?.vue?.styleOutput || '';
      
    if (!styleOutput.trim()) {
      return '';
    }
    
    const styleLanguage = context.component?.extensions?.vue?.styleLanguage ?? 'css';
    const isScoped = context.component?.extensions?.vue?.scoped ?? false;
    
    const attributes = [];
    if (styleLanguage !== 'css') {
      attributes.push(`lang="${styleLanguage}"`);
    }
    if (isScoped) {
      attributes.push('scoped');
    }
    
    const attrString = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
    
    return `<style${attrString}>\n${styleOutput.trim()}\n</style>`;
  }

  /**
   * Get default Vue imports
   */
  private getDefaultVueImports(concepts: ComponentConcept, isComposition: boolean): ImportDefinition[] {
    const imports: ImportDefinition[] = [
      { from: 'vue', named: ['defineComponent'] }
    ];
    
    if (isComposition) {
      const compositionImports = this.analyzeCompositionImports(concepts);
      if (compositionImports.length > 0) {
        imports.push({
          from: 'vue',
          named: compositionImports
        });
      }
    }
    
    return imports;
  }

  /**
   * Analyze composition imports
   */
  private analyzeCompositionImports(_concepts: ComponentConcept): string[] {
    const imports = new Set<string>();
    // Analyze script for Vue composition imports
    return Array.from(imports);
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
   * Generate props interface
   */
  private generatePropsInterface(interfaceName: string, props: Record<string, string>): string {
    const propEntries = Object.entries(props).map(([key, type]) =>
      `  ${key}?: ${type};`
    ).join('\n');

    return `interface ${interfaceName} {\n${propEntries}\n}`;
  }

  /**
   * Generate runtime props
   */
  private generateRuntimeProps(props: Record<string, string>): string {
    const propEntries = Object.entries(props).map(([key, type]) => {
      const propType = this.getVueRuntimeType(type);
      return `  ${key}: { type: ${propType}, required: false }`;
    }).join(',\n');

    return `{\n${propEntries}\n}`;
  }

  /**
   * Get Vue runtime type
   */
  private getVueRuntimeType(type: string): string {
    const lowerType = type.toLowerCase();
    switch (lowerType) {
      case 'string': return 'String';
      case 'number': return 'Number';
      case 'boolean': return 'Boolean';
      case 'array': return 'Array';
      case 'object': return 'Object';
      case 'function': return 'Function';
      default: return 'Object';
    }
  }

  /**
   * Get component name
   */
  private getComponentName(context: RenderContext): string {
    return context.component?.name || 'Component';
  }

  /**
   * Indent script content
   */
  private indentScript(script: string): string {
    return script.split('\n').map(line => 
      line.trim() ? `    ${line}` : line
    ).join('\n');
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
   * Render template from concepts
   */
  private renderTemplate(concepts: ComponentConcept): string {
    // Process behavioral concepts to get attributes
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
      const conditionalOutput = this.processConditionals(concepts.conditionals);
      parts.push(conditionalOutput.syntax);
    }

    if (concepts.iterations.length > 0) {
      const iterationOutput = this.processIterations(concepts.iterations);
      parts.push(iterationOutput.syntax);
    }

    if (concepts.slots.length > 0) {
      const slotOutput = this.processSlots(concepts.slots);
      parts.push(slotOutput.syntax);
    }

    return parts.filter(Boolean).join('\n');
  }

  /**
   * Render structural concepts to Vue template syntax
   */
  private renderStructuralConcepts(
    structuralConcepts: (StructuralConcept | TextConcept | CommentConcept | FragmentConcept)[],
    attributes: Record<string, string>
  ): string {
    return structuralConcepts.map(concept => {
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
          return this.renderStructuralElement(structuralConcept, attributes);
      }
    }).join('');
  }

  /**
   * Render a structural element as Vue template
   */
  private renderStructuralElement(
    concept: StructuralConcept,
    globalAttributes: Record<string, string>
  ): string {
    const tag = concept.tag;
    
    // Render children
    const childrenOutput = this.renderStructuralConcepts(concept.children, {});
    
    // Apply global attributes only to the first/root element
    let attributeString = '';
    if (Object.keys(globalAttributes).length > 0) {
      for (const [name, value] of Object.entries(globalAttributes)) {
        // Handle Vue directives and expressions correctly
        if (name.startsWith('@') || name.startsWith('v-') || name.startsWith(':')) {
          attributeString += ` ${name}="${value}"`;
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
    if (typeof node === 'string') return node;

    switch (node.type) {
      case 'text':
        return node.content || '';
      case 'element':
        return this.renderElementNode(node);
      default:
        return '';
    }
  }

  /**
   * Render an element node
   */
  private renderElementNode(node: any): string {
    const tag = node.tag || 'div';
    
    let children = '';
    if (node.children && node.children.length > 0) {
      children = this.renderNodes(node.children);
    } else if (node.content) {
      children = node.content;
    }
    
    let attributes = '';
    if (node.attributes) {
      for (const [name, value] of Object.entries(node.attributes)) {
        if (typeof value === 'boolean' && value) {
          attributes += ` ${name}`;
        } else if (typeof value === 'string' || typeof value === 'number') {
          attributes += ` ${name}="${value}"`;
        }
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
   * Render Vue element
   */
  private renderVueElement(element: VueElement): string {
    return this.renderElementNode(element);
  }

  /**
   * Check if node is an element node
   */
  private isElementNode(node: any): boolean {
    return node && (node.type === 'element' || node.tag);
  }

  /**
   * Parse nodes from string
   */
  private parseNodes(content: string): TemplateNode[] {
    // Simple text node implementation
    return [{ type: 'text', content }];
  }

  /**
   * Get file extension for Vue components
   */
  public getFileExtension(_options: { language?: 'typescript' | 'javascript' }): string {
    return '.vue';
  }

  /**
   * Get Prettier parser for Vue components
   */
  public getPrettierParser(_options: { language?: 'typescript' | 'javascript' }): string {
    return 'vue';
  }
}

// Main exports
export default VueFrameworkExtension;
export { VueFrameworkExtension as VueExtension };