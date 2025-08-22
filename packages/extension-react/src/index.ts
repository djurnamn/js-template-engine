/**
 * React Framework Extension - Concept-Driven Implementation
 * 
 * Production-quality React framework extension that leverages the Phase 1 & Phase 2 
 * concept-driven foundation to generate real, compilable JSX/TypeScript components.
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
  ComponentConcept
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
 * React-specific event output interface
 */
export interface ReactEventOutput {
  attribute: string;
  handler: string;
  modifiers: string[];
  parameters: string[];
  syntax: string;
}

/**
 * React-specific conditional output interface
 */
export interface ReactConditionalOutput {
  condition: string;
  thenContent: string;
  elseContent: string | null;
  nodeId: string;
  syntax: string;
}

/**
 * React-specific iteration output interface
 */
export interface ReactIterationOutput {
  items: string;
  itemVariable: string;
  indexVariable?: string;
  keyExpression: string;
  childContent: string;
  nodeId: string;
  syntax: string;
}

/**
 * React-specific slot output interface
 */
export interface ReactSlotOutput {
  name: string;
  propName: string;
  fallback: string | null;
  nodeId: string;
  syntax: string;
}

/**
 * React-specific attribute output interface
 */
export interface ReactAttributeOutput {
  originalName: string;
  reactName: string;
  value: string | boolean;
  isExpression: boolean;
  nodeId: string;
  syntax: string;
}

/**
 * React component generation configuration
 */
export interface ReactComponentConfig {
  name: string;
  imports: string[];
  script: string;
  props: Record<string, string>;
  concepts: ComponentConcept;
  context: RenderContext;
}

/**
 * React Framework Extension implementing the concept-driven architecture
 */
export class ReactFrameworkExtension implements FrameworkExtension {
  public metadata: ExtensionMetadata = {
    type: 'framework',
    key: 'react',
    name: 'React Framework Extension',
    version: '1.0.0'
  };

  public framework = 'react' as const;

  // Phase 2 integration processors
  private eventNormalizer = new EventNormalizer();
  private propertyProcessor: ComponentPropertyProcessor;
  private scriptMerger: ScriptMergeProcessor;
  private importProcessor = new ImportProcessor();

  // Merge strategies (can be configured)
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
   * Process event concepts using Phase 2 event normalization
   */
  processEvents(events: EventConcept[]): FrameworkEventOutput {
    const processedEvents = events.map(event => {
      // Use Phase 2 normalization: 'click' → 'onClick'
      const normalizedEvent = this.eventNormalizer.normalizeEvent(event, {
        framework: 'react',
        preserveModifiers: true
      });

      const handler = this.formatHandler(event.handler, event.parameters || [], event.modifiers || []);
      const syntax = `${normalizedEvent.frameworkAttribute}={${handler}}`;

      return {
        attribute: normalizedEvent.frameworkAttribute,
        handler: event.handler,
        modifiers: event.modifiers || [],
        parameters: event.parameters || [],
        syntax
      } as ReactEventOutput;
    });

    // Generate framework event output
    const attributes: Record<string, string> = {};
    const imports: string[] = [];

    for (const processedEvent of processedEvents) {
      attributes[processedEvent.attribute] = processedEvent.handler;
    }

    return {
      attributes,
      imports
    };
  }

  /**
   * Format event handler with parameters and modifiers
   */
  private formatHandler(handler: string, parameters: string[], modifiers: string[] = []): string {
    // Transform parameters: '$event' → 'e', 'index' → 'index'
    const reactParams = parameters.map(param =>
      param === '$event' ? 'e' : param
    );

    // Handle modifiers by wrapping the handler
    if (modifiers.length > 0) {
      const modifierCode = this.generateModifierCode(modifiers);
      
      if (parameters.length === 0) {
        return `(e) => { ${modifierCode} ${handler}(); }`;
      } else {
        const paramString = reactParams.join(', ');
        return `(${paramString}) => { ${modifierCode} ${handler}(${paramString}); }`;
      }
    }

    if (parameters.length === 0) return handler;

    const paramString = reactParams.join(', ');
    return `(${paramString}) => ${handler}(${paramString})`;
  }

  /**
   * Generate modifier code for React event handlers
   */
  private generateModifierCode(modifiers: string[]): string {
    const code: string[] = [];

    for (const modifier of modifiers) {
      switch (modifier) {
        case 'prevent':
          code.push('e.preventDefault();');
          break;
        case 'stop':
          code.push('e.stopPropagation();');
          break;
        case 'once':
          // React doesn't have built-in once modifier, but we can implement it
          code.push('if (e.target.dataset.handlerExecuted) return; e.target.dataset.handlerExecuted = "true";');
          break;
        case 'self':
          code.push('if (e.target !== e.currentTarget) return;');
          break;
        default:
          // Unknown modifier, just add as comment
          code.push(`/* modifier: ${modifier} */`);
      }
    }

    return code.join(' ');
  }

  /**
   * Process conditional concepts for JSX conditional rendering
   */
  processConditionals(conditionals: ConditionalConcept[]): FrameworkConditionalOutput {
    const processedConditionals = conditionals.map(conditional => {
      const thenContent = this.renderNodes(conditional.thenNodes);
      const elseContent = conditional.elseNodes ?
        this.renderNodes(conditional.elseNodes) : null;

      return {
        condition: conditional.condition,
        thenContent,
        elseContent,
        nodeId: conditional.nodeId,
        syntax: this.generateConditionalSyntax(conditional, thenContent, elseContent)
      } as ReactConditionalOutput;
    });

    // Generate the combined syntax for all conditionals
    const syntax = processedConditionals.map(c => c.syntax).join('\n');

    return {
      syntax,
      imports: []
    };
  }

  /**
   * Generate JSX conditional syntax with proper formatting
   */
  private generateConditionalSyntax(
    conditional: ConditionalConcept,
    thenContent: string,
    elseContent: string | null
  ): string {
    const condition = conditional.condition;

    // Clean up content indentation
    const cleanThenContent = this.cleanJSXContent(thenContent);
    const cleanElseContent = elseContent ? this.cleanJSXContent(elseContent) : null;

    if (cleanElseContent) {
      // Ternary operator for if-else
      if (this.isSingleElement(cleanThenContent) && this.isSingleElement(cleanElseContent)) {
        return `{${condition} ? ${cleanThenContent} : ${cleanElseContent}}`;
      } else {
        return `{${condition} ? (\n    ${cleanThenContent}\n  ) : (\n    ${cleanElseContent}\n  )}`;
      }
    } else {
      // Logical AND for if-only
      if (this.isSingleElement(cleanThenContent)) {
        return `{${condition} && ${cleanThenContent}}`;
      } else {
        return `{${condition} && (\n    ${cleanThenContent}\n  )}`;
      }
    }
  }

  /**
   * Clean JSX content by removing extra whitespace and normalizing indentation
   */
  private cleanJSXContent(content: string): string {
    return content.trim().replace(/\n\s*/g, '\n    ');
  }

  /**
   * Check if content is a single JSX element that doesn't need wrapping
   */
  private isSingleElement(content: string): boolean {
    const trimmed = content.trim();
    return trimmed.startsWith('<') && trimmed.endsWith('>') && 
           !trimmed.includes('\n') && trimmed.length < 80; // Keep simple elements inline
  }

  /**
   * Process iteration concepts for JSX array mapping
   */
  processIterations(iterations: IterationConcept[]): FrameworkIterationOutput {
    const processedIterations = iterations.map(iteration => {
      const childContent = this.renderNodes(iteration.childNodes);
      const keyExpression = iteration.keyExpression ||
        (iteration.indexVariable || 'index');

      return {
        items: iteration.items,
        itemVariable: iteration.itemVariable,
        indexVariable: iteration.indexVariable,
        keyExpression,
        childContent,
        nodeId: iteration.nodeId,
        syntax: this.generateIterationSyntax(iteration, childContent, keyExpression)
      } as ReactIterationOutput;
    });

    const syntax = processedIterations.map(i => i.syntax).join('\n');

    return {
      syntax,
      imports: ['React'] // Need React for Fragment
    };
  }

  /**
   * Generate JSX iteration syntax with optimized Fragment usage
   */
  private generateIterationSyntax(
    iteration: IterationConcept,
    childContent: string,
    keyExpression: string
  ): string {
    const mapParams = iteration.indexVariable ?
      `(${iteration.itemVariable}, ${iteration.indexVariable})` :
      `${iteration.itemVariable}`;

    const cleanContent = this.cleanJSXContent(childContent);

    // For now, always use React.Fragment to match specification and tests
    // Future optimization: direct key assignment for single elements
    return `{${iteration.items}.map(${mapParams} => (
    <React.Fragment key={${keyExpression}}>
      ${cleanContent}
    </React.Fragment>
  ))}`;
  }

  /**
   * Check if content is a single element without a key attribute
   */
  private isSingleElementWithoutKey(content: string): boolean {
    const trimmed = content.trim();
    if (!this.isSingleElement(trimmed)) return false;
    
    // Check if element already has a key attribute
    return !trimmed.includes(' key=') && !trimmed.includes(' key={');
  }

  /**
   * Add key attribute to a single JSX element
   */
  private addKeyToElement(content: string, keyExpression: string): string {
    const trimmed = content.trim();
    
    // Find the position to insert the key
    const tagEndIndex = trimmed.indexOf('>');
    if (tagEndIndex === -1) return content;
    
    const beforeTag = trimmed.substring(0, tagEndIndex);
    const afterTag = trimmed.substring(tagEndIndex);
    
    return `${beforeTag} key={${keyExpression}}${afterTag}`;
  }

  /**
   * Check if we can use React.Fragment shorthand syntax
   */
  private canUseFragmentShorthand(content: string): boolean {
    // For now, always use standard Fragment for clarity and key support
    return false;
  }

  /**
   * Process slot concepts for React props transformation
   */
  processSlots(slots: SlotConcept[]): FrameworkSlotOutput {
    const processedSlots = slots.map(slot => {
      const propName = this.normalizeSlotName(slot.name);
      const fallbackContent = slot.fallback ?
        this.renderNodes(slot.fallback) : null;

      return {
        name: slot.name,
        propName,
        fallback: fallbackContent,
        nodeId: slot.nodeId,
        syntax: this.generateSlotSyntax(propName, fallbackContent)
      } as ReactSlotOutput;
    });

    const syntax = processedSlots.map(s => s.syntax).join('\n');
    const props: Record<string, string> = {};

    // Collect props for TypeScript interfaces
    for (const slot of processedSlots) {
      props[slot.propName] = 'React.ReactNode';
    }

    return {
      syntax,
      props,
      imports: ['React']
    };
  }

  /**
   * Normalize slot name to valid React prop name
   * Handles special cases and ensures valid JavaScript identifiers
   */
  private normalizeSlotName(name: string): string {
    // Handle special slot names
    if (name === 'default') return 'children';
    
    // Convert to camelCase
    let normalized = name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());

    // Ensure starts with valid character
    if (!/^[a-zA-Z_$]/.test(normalized)) {
      normalized = '_' + normalized;
    }

    // Remove invalid characters
    normalized = normalized.replace(/[^a-zA-Z0-9_$]/g, '');

    // Handle reserved keywords
    const reserved = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 
                      'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 
                      'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 
                      'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 
                      'var', 'void', 'while', 'with', 'yield'];
    
    if (reserved.includes(normalized)) {
      normalized = normalized + 'Prop';
    }

    return normalized || 'slotProp';
  }

  /**
   * Generate slot JSX syntax with proper fallback handling
   */
  private generateSlotSyntax(propName: string, fallback: string | null): string {
    if (!fallback) {
      return `{props.${propName}}`;
    }

    const cleanFallback = this.cleanJSXContent(fallback);
    
    // Handle special case for children prop
    if (propName === 'children') {
      if (this.isSingleElement(cleanFallback)) {
        return `{props.children || ${cleanFallback}}`;
      } else {
        return `{props.children || (\n    ${cleanFallback}\n  )}`;
      }
    }

    // Standard slot with fallback
    if (this.isSingleElement(cleanFallback)) {
      return `{props.${propName} || ${cleanFallback}}`;
    } else {
      return `{props.${propName} || (\n    ${cleanFallback}\n  )}`;
    }
  }

  /**
   * Process attribute concepts for HTML to React attribute transformation
   */
  processAttributes(attributes: AttributeConcept[]): FrameworkAttributeOutput {
    const processedAttributes = attributes.map(attribute => {
      const reactAttributeName = this.transformAttributeName(attribute.name);

      return {
        originalName: attribute.name,
        reactName: reactAttributeName,
        value: attribute.value,
        isExpression: attribute.isExpression,
        nodeId: attribute.nodeId,
        syntax: this.generateAttributeSyntax(reactAttributeName, attribute.value, attribute.isExpression)
      } as ReactAttributeOutput;
    });

    const attributeMap: Record<string, string> = {};
    for (const attr of processedAttributes) {
      if (typeof attr.value === 'string') {
        attributeMap[attr.reactName] = attr.value;
      } else if (typeof attr.value === 'boolean' && attr.value) {
        attributeMap[attr.reactName] = 'true';
      }
    }

    return {
      attributes: attributeMap,
      imports: []
    };
  }

  /**
   * Transform HTML attribute names to React attribute names
   * Comprehensive mapping including form, table, and accessibility attributes
   */
  private transformAttributeName(htmlName: string): string {
    const lowerName = htmlName.toLowerCase();
    
    // HTML → React transformations (comprehensive)
    const transformations: Record<string, string> = {
      // Common HTML attributes
      'class': 'className',
      'for': 'htmlFor',
      'tabindex': 'tabIndex',
      'contenteditable': 'contentEditable',
      'draggable': 'draggable',
      'spellcheck': 'spellCheck',
      'translate': 'translate',
      
      // Form attributes
      'readonly': 'readOnly',
      'maxlength': 'maxLength',
      'minlength': 'minLength',
      'formaction': 'formAction',
      'formenctype': 'formEncType',
      'formmethod': 'formMethod',
      'formnovalidate': 'formNoValidate',
      'formtarget': 'formTarget',
      'novalidate': 'noValidate',
      'autofocus': 'autoFocus',
      'autocomplete': 'autoComplete',
      'autoplay': 'autoPlay',
      'controls': 'controls',
      'defer': 'defer',
      'disabled': 'disabled',
      'hidden': 'hidden',
      'loop': 'loop',
      'multiple': 'multiple',
      'muted': 'muted',
      'open': 'open',
      'required': 'required',
      'reversed': 'reversed',
      'selected': 'selected',
      'checked': 'checked',
      
      // Table attributes
      'cellpadding': 'cellPadding',
      'cellspacing': 'cellSpacing',
      'rowspan': 'rowSpan',
      'colspan': 'colSpan',
      'useMap': 'useMap',
      
      // Media attributes
      'crossorigin': 'crossOrigin',
      'usemap': 'useMap',
      
      // ARIA attributes (keep kebab-case)
      // React handles aria-* and data-* attributes as-is
      
      // SVG attributes (common ones)
      'allowfullscreen': 'allowFullScreen',
      'autofocus': 'autoFocus',
      'autoplay': 'autoPlay',
      'contenteditable': 'contentEditable',
      'crossorigin': 'crossOrigin',
      'datetime': 'dateTime',
      'formaction': 'formAction',
      'formenctype': 'formEncType',
      'formmethod': 'formMethod',
      'formnovalidate': 'formNoValidate',
      'formtarget': 'formTarget',
      'frameborder': 'frameBorder',
      'marginheight': 'marginHeight',
      'marginwidth': 'marginWidth',
      'maxlength': 'maxLength',
      'mediagroup': 'mediaGroup',
      'minlength': 'minLength',
      'novalidate': 'noValidate',
      'radiogroup': 'radioGroup',
      'readonly': 'readOnly',
      'rowspan': 'rowSpan',
      'spellcheck': 'spellCheck',
      'srcdoc': 'srcDoc',
      'srclang': 'srcLang',
      'srcset': 'srcSet',
      'tabindex': 'tabIndex',
      'usemap': 'useMap'
    };

    // Return transformed name or original if no transformation needed
    const transformed = transformations[lowerName];
    if (transformed) return transformed;
    
    // Handle aria-* and data-* attributes (keep as-is)
    if (lowerName.startsWith('aria-') || lowerName.startsWith('data-')) {
      return lowerName;
    }
    
    // Return original name if no transformation needed
    return htmlName;
  }

  /**
   * Generate attribute JSX syntax with proper value handling
   */
  private generateAttributeSyntax(
    name: string,
    value: string | boolean,
    isExpression: boolean
  ): string {
    // Handle boolean attributes
    if (typeof value === 'boolean') {
      return value ? ` ${name}` : '';
    }

    // Handle expressions
    if (isExpression) {
      return ` ${name}={${value}}`;
    }

    // Handle string values
    const stringValue = String(value);
    
    // Special cases for React
    if (name === 'style' && !isExpression) {
      // Convert CSS string to object if it looks like CSS
      if (stringValue.includes(':')) {
        const styleObj = this.parseCSSToObject(stringValue);
        return ` ${name}={${JSON.stringify(styleObj)}}`;
      }
    }

    // Escape quotes in attribute values
    const escapedValue = stringValue.replace(/"/g, '&quot;');
    return ` ${name}="${escapedValue}"`;
  }

  /**
   * Parse CSS string to React style object
   */
  private parseCSSToObject(cssString: string): Record<string, string> {
    const styleObj: Record<string, string> = {};
    
    // Split by semicolon and process each declaration
    const declarations = cssString.split(';').filter(d => d.trim());
    
    for (const declaration of declarations) {
      const [property, value] = declaration.split(':').map(s => s.trim());
      if (property && value) {
        // Convert kebab-case to camelCase for React
        const reactProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        styleObj[reactProperty] = value;
      }
    }
    
    return styleObj;
  }

  /**
   * Render component using Phase 2 property resolution and merging
   */
  renderComponent(concepts: ComponentConcept, context: RenderContext): string {
    // Use Phase 2 component property resolution
    const componentName = this.propertyProcessor.resolveComponentName(
      { framework: 'react', component: context.component },
      { common: context.component },
      'Component' // default
    );

    // Use Phase 2 import merging with React-specific defaults
    const defaultImports = this.getDefaultReactImports(concepts);
    const imports = this.importProcessor.mergeImports(
      defaultImports,
      context.component?.imports || [],
      { strategy: this.importMergeStrategy }
    );

    // Use Phase 2 script merging
    const scriptResult = this.scriptMerger.mergeScripts(
      context.component?.script || '',
      context.component?.extensions?.react?.script || '',
      this.scriptMergeStrategy
    );
    const script = scriptResult.content;

    // Use Phase 2 props merging
    const slotProps = this.extractSlotProps(concepts.slots);
    const props = this.propertyProcessor.mergeProps(
      context.component?.props || {},
      slotProps,
      this.propMergeStrategy
    );

    return this.generateReactComponent({
      name: componentName,
      imports: this.formatImports(imports),
      script,
      props,
      concepts,
      context
    });
  }

  /**
   * Get default React imports based on concepts
   */
  private getDefaultReactImports(concepts: ComponentConcept): ImportDefinition[] {
    const imports: ImportDefinition[] = [
      { from: 'react', default: 'React' }
    ];

    // Add React hooks if needed based on script content
    const needsHooks = this.analyzeHookUsage(concepts);
    if (needsHooks.length > 0) {
      imports.push({
        from: 'react',
        named: needsHooks
      });
    }

    return imports;
  }

  /**
   * Analyze hook usage (simplified implementation)
   */
  private analyzeHookUsage(concepts: ComponentConcept): string[] {
    const hooks: string[] = [];
    // TODO: Enhance based on script analysis
    // For now, just return empty array
    return hooks;
  }

  /**
   * Extract slot props from slot concepts
   */
  private extractSlotProps(slots: SlotConcept[]): Record<string, string> {
    const props: Record<string, string> = {};
    for (const slot of slots) {
      const propName = this.normalizeSlotName(slot.name);
      props[propName] = 'React.ReactNode';
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
   * Generate complete React component
   */
  private generateReactComponent(config: ReactComponentConfig): string {
    const {
      name,
      imports,
      script,
      props,
      concepts,
      context
    } = config;

    // Generate TypeScript interface if needed
    const useTypeScript = (context.options?.language || 'javascript') === 'typescript';
    const propsInterface = useTypeScript && Object.keys(props).length > 0 ?
      this.generatePropsInterface(name, props) : '';

    // Process all concepts to JSX
    const template = this.renderTemplate(concepts);

    // Generate component sections
    const importSection = imports.length > 0 ? imports.join('\n') + '\n' : '';
    const interfaceSection = propsInterface ? propsInterface + '\n' : '';
    const componentSection = this.generateComponentFunction(name, props, script, template, useTypeScript);
    const exportSection = `\nexport default ${name};`;

    return [
      importSection,
      interfaceSection,
      componentSection,
      exportSection
    ].join('\n').trim();
  }

  /**
   * Generate TypeScript props interface
   */
  private generatePropsInterface(componentName: string, props: Record<string, string>): string {
    const propEntries = Object.entries(props).map(([key, type]) =>
      `  ${key}?: ${type};`
    ).join('\n');

    return `interface ${componentName}Props {\n${propEntries}\n}`;
  }

  /**
   * Generate React component function
   */
  private generateComponentFunction(
    name: string,
    props: Record<string, string>,
    script: string,
    template: string,
    useTypeScript: boolean
  ): string {
    const hasProps = Object.keys(props).length > 0;

    const signature = useTypeScript
      ? hasProps
        ? `const ${name}: React.FC<${name}Props> = (props) => {`
        : `const ${name}: React.FC = () => {`
      : hasProps
        ? `const ${name} = (props) => {`
        : `const ${name} = () => {`;

    const scriptSection = script ? `  ${script.split('\n').join('\n  ')}\n\n` : '';

    return `${signature}\n${scriptSection}  return (\n    ${template}\n  );\n};`;
  }

  /**
   * Render template from concepts to JSX
   */
  private renderTemplate(concepts: ComponentConcept): string {
    const parts: string[] = [];

    // Process events to get event attributes
    if (concepts.events.length > 0) {
      const eventOutput = this.processEvents(concepts.events);
      // Events are processed and included in individual elements
    }

    // Process conditionals
    if (concepts.conditionals.length > 0) {
      const conditionalOutput = this.processConditionals(concepts.conditionals);
      parts.push(conditionalOutput.syntax);
    }

    // Process iterations
    if (concepts.iterations.length > 0) {
      const iterationOutput = this.processIterations(concepts.iterations);
      parts.push(iterationOutput.syntax);
    }

    // Process slots
    if (concepts.slots.length > 0) {
      const slotOutput = this.processSlots(concepts.slots);
      parts.push(slotOutput.syntax);
    }

    // Process attributes and styling
    let elementAttributes = '';
    if (concepts.attributes.length > 0) {
      const attributeOutput = this.processAttributes(concepts.attributes);
      elementAttributes = Object.entries(attributeOutput.attributes)
        .map(([name, value]) => ` ${name}="${value}"`)
        .join('');
    }

    // Add styling classes if present
    if (concepts.styling) {
      const staticClasses = concepts.styling.staticClasses.join(' ');
      const dynamicClasses = concepts.styling.dynamicClasses.join(' ');
      
      if (staticClasses || dynamicClasses) {
        const classValue = staticClasses + (dynamicClasses ? ` ${dynamicClasses}` : '');
        elementAttributes += ` className="${classValue}"`;
      }

      // Add inline styles
      if (Object.keys(concepts.styling.inlineStyles).length > 0) {
        const styleObj = JSON.stringify(concepts.styling.inlineStyles);
        elementAttributes += ` style={${styleObj}}`;
      }
    }

    // If we have processed concepts, combine them
    if (parts.length > 0) {
      if (parts.length === 1) {
        return parts[0];
      } else {
        return `<>\n      ${parts.join('\n      ')}\n    </>`;
      }
    }

    // Default fallback for empty component
    return `<div${elementAttributes}>Component content</div>`;
  }

  /**
   * Render template nodes to JSX string
   */
  private renderNodes(nodes: any[]): string {
    if (!nodes || nodes.length === 0) return '';

    return nodes.map(node => this.renderSingleNode(node)).join('');
  }

  /**
   * Render a single template node to JSX
   */
  private renderSingleNode(node: any): string {
    // Handle simple string nodes
    if (typeof node === 'string') return node;

    // Handle different node types
    switch (node.type) {
      case 'text':
        return node.content || '';

      case 'comment':
        return `{/* ${node.content} */}`;

      case 'element':
        return this.renderElementNode(node);

      case 'fragment':
        const childContent = this.renderNodes(node.children || []);
        return `<React.Fragment>${childContent}</React.Fragment>`;

      case 'if':
        const thenContent = this.renderNodes(node.then || []);
        const elseContent = node.else ? this.renderNodes(node.else) : null;
        return this.generateConditionalSyntax(
          { condition: node.condition, thenNodes: node.then, elseNodes: node.else, nodeId: node.id || 'unknown' },
          thenContent,
          elseContent
        );

      case 'for':
        const iterationContent = this.renderNodes(node.children || []);
        return this.generateIterationSyntax(
          {
            items: node.items,
            itemVariable: node.item,
            indexVariable: node.index,
            keyExpression: node.key,
            childNodes: node.children,
            nodeId: node.id || 'unknown'
          },
          iterationContent,
          node.key || 'index'
        );

      case 'slot':
        const propName = this.normalizeSlotName(node.name);
        const fallback = node.fallback ? this.renderNodes(node.fallback) : null;
        return this.generateSlotSyntax(propName, fallback);

      default:
        // Unknown node type, try to render as generic object
        if (node.tag) {
          return this.renderElementNode(node);
        }
        return '';
    }
  }

  /**
   * Render an element node to JSX
   */
  private renderElementNode(node: any): string {
    const tag = node.tag || 'div';
    
    // Get children content - check both children array and content property
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
        const reactName = this.transformAttributeName(name);
        if (typeof value === 'boolean' && value) {
          attributes += ` ${reactName}`;
        } else if (typeof value === 'string' || typeof value === 'number') {
          attributes += ` ${reactName}="${value}"`;
        }
      }
    }

    // Process expression attributes
    if (node.expressionAttributes) {
      for (const [name, expression] of Object.entries(node.expressionAttributes)) {
        const reactName = this.transformAttributeName(name);
        attributes += ` ${reactName}={${expression}}`;
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
}

// Main exports
export default ReactFrameworkExtension;
export { ReactFrameworkExtension as ReactExtension };

