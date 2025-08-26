/**
 * Template analyzer for extracting concepts from template nodes.
 */

import type { 
  ComponentConcept,
  EventConcept,
  StylingConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
  ComponentMetadata,
  StructuralConcept,
  TextConcept,
  CommentConcept,
  FragmentConcept
} from '../concepts';
import { NodeIdGenerator, ErrorCollector } from '../metadata';

/**
 * Template node interface (avoiding circular dependency with existing types).
 */
interface TemplateNode {
  type?: 'element' | 'text' | 'comment' | 'if' | 'for' | 'slot' | 'fragment';
  tag?: string;
  content?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, any>;
  children?: TemplateNode[];
  
  // Conditional node properties
  condition?: string;
  then?: TemplateNode[];
  else?: TemplateNode[];
  
  // Loop node properties
  items?: string;
  item?: string;
  index?: string;
  key?: string;
  
  // Slot node properties
  name?: string;
  fallback?: TemplateNode[];
  
  // Extension data
  extensions?: Record<string, any>;
}

/**
 * Analyzer options for customizing concept extraction.
 */
export interface AnalyzerOptions {
  /** Whether to extract styling concepts */
  extractStyling?: boolean;
  /** Whether to extract event concepts */
  extractEvents?: boolean;
  /** Whether to extract conditional concepts */
  extractConditionals?: boolean;
  /** Whether to extract iteration concepts */
  extractIterations?: boolean;
  /** Whether to extract slot concepts */
  extractSlots?: boolean;
  /** Whether to extract attribute concepts */
  extractAttributes?: boolean;
  /** Custom event attribute prefixes */
  eventPrefixes?: string[];
  /** Custom attribute names to ignore */
  ignoreAttributes?: string[];
}

/**
 * Default analyzer options.
 */
const DEFAULT_ANALYZER_OPTIONS: Required<AnalyzerOptions> = {
  extractStyling: true,
  extractEvents: true,
  extractConditionals: true,
  extractIterations: true,
  extractSlots: true,
  extractAttributes: true,
  eventPrefixes: ['on', '@', 'v-on:', 'on:'],
  ignoreAttributes: ['key', 'ref']
};

/**
 * Template analyzer for extracting concepts from template trees.
 */
export class TemplateAnalyzer {
  private errorCollector: ErrorCollector;
  private options: Required<AnalyzerOptions>;

  constructor(options: AnalyzerOptions = {}, errorCollector?: ErrorCollector) {
    this.options = { ...DEFAULT_ANALYZER_OPTIONS, ...options };
    this.errorCollector = errorCollector || new ErrorCollector();
  }

  /**
   * Extract concepts from a template tree.
   */
  extractConcepts(template: TemplateNode[]): ComponentConcept {
    const concepts: ComponentConcept = {
      structure: [],
      events: [],
      styling: this.createEmptyStylingConcept('root'),
      conditionals: [],
      iterations: [],
      slots: [],
      attributes: [],
      metadata: this.extractMetadata(template)
    };

    // Extract structural concepts first
    concepts.structure = this.extractStructuralConcepts(template, []);

    // Traverse template and extract behavioral concepts
    this.traverseNodes(template, concepts, []);

    return concepts;
  }

  /**
   * Extract structural concepts from template nodes.
   */
  private extractStructuralConcepts(
    nodes: TemplateNode[],
    pathStack: number[]
  ): (StructuralConcept | TextConcept | CommentConcept | FragmentConcept)[] {
    return nodes.map((node, index) => {
      const currentPath = [...pathStack, index];
      const nodeId = NodeIdGenerator.generateNodeId(currentPath);

      switch (node.type) {
        case 'text':
          return {
            nodeId,
            type: 'text',
            content: node.content || ''
          } as TextConcept;

        case 'comment':
          return {
            nodeId,
            type: 'comment',
            content: node.content || ''
          } as CommentConcept;

        case 'fragment':
          return {
            nodeId,
            type: 'fragment',
            children: this.extractStructuralConcepts(node.children || [], currentPath)
          } as FragmentConcept;

        case 'element':
        case undefined: // Default to element
          const tag = node.tag || 'div';
          const children = this.extractStructuralConcepts(node.children || [], currentPath);
          
          // Capture element's own attributes (excluding events and styling which are handled separately)
          const elementAttributes: Record<string, any> = {};
          if (node.attributes) {
            for (const [name, value] of Object.entries(node.attributes)) {
              // Skip attributes that will be handled as behavioral concepts
              if (!this.shouldIgnoreAttribute(name)) {
                elementAttributes[name] = value;
              }
            }
          }
          if (node.expressionAttributes) {
            for (const [name, value] of Object.entries(node.expressionAttributes)) {
              // Skip attributes that will be handled as behavioral concepts
              if (!this.shouldIgnoreAttribute(name)) {
                elementAttributes[name] = value;
              }
            }
          }
          
          return {
            nodeId,
            type: 'element',
            tag,
            children,
            attributes: Object.keys(elementAttributes).length > 0 ? elementAttributes : undefined,
            isSelfClosing: this.isSelfClosingTag(tag)
          } as StructuralConcept;

        // For special nodes like if/for/slot, we'll handle them as behavioral concepts
        // but still need to extract their structural children
        case 'if':
        case 'for': 
        case 'slot':
          // These will be handled as behavioral concepts, but we still extract their structure
          // For now, treat them as fragments with their children
          return {
            nodeId,
            type: 'fragment',
            children: this.extractStructuralConcepts(node.children || [], currentPath)
          } as FragmentConcept;

        default:
          // Unknown node type, treat as fragment
          this.errorCollector.addWarning(
            `Unknown node type for structural extraction: ${node.type}`,
            nodeId,
            'analyzer'
          );
          return {
            nodeId,
            type: 'fragment',
            children: this.extractStructuralConcepts(node.children || [], currentPath)
          } as FragmentConcept;
      }
    });
  }

  /**
   * Check if a tag is self-closing.
   */
  private isSelfClosingTag(tag: string): boolean {
    const selfClosingTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
                            'link', 'meta', 'param', 'source', 'track', 'wbr'];
    return selfClosingTags.includes(tag.toLowerCase());
  }

  /**
   * Get collected errors from analysis.
   */
  getErrors(): ErrorCollector {
    return this.errorCollector;
  }

  /**
   * Clear errors from previous analysis.
   */
  clearErrors(): void {
    this.errorCollector.clear();
  }

  /**
   * Traverse nodes and extract concepts.
   */
  private traverseNodes(
    nodes: TemplateNode[],
    concepts: ComponentConcept,
    pathStack: number[]
  ): void {
    nodes.forEach((node, index) => {
      const currentPath = [...pathStack, index];
      const nodeId = NodeIdGenerator.generateNodeId(currentPath);

      try {
        this.extractNodeConcepts(node, concepts, nodeId, currentPath);

        // Recursively process children
        if (node.children) {
          this.traverseNodes(node.children, concepts, currentPath);
        }

        // Handle special node types with nested content
        if (node.type === 'if') {
          if (node.then) {
            this.traverseNodes(node.then, concepts, [...currentPath, 'then'] as any);
          }
          if (node.else) {
            this.traverseNodes(node.else, concepts, [...currentPath, 'else'] as any);
          }
        }
      } catch (error) {
        this.errorCollector.addSimpleError(
          `Error processing node: ${error instanceof Error ? error.message : String(error)}`,
          nodeId,
          'analyzer'
        );
      }
    });
  }

  /**
   * Extract concepts from a single node.
   */
  private extractNodeConcepts(
    node: TemplateNode,
    concepts: ComponentConcept,
    nodeId: string,
    path: number[]
  ): void {
    // Extract concepts based on node type
    switch (node.type) {
      case 'if':
        if (this.options.extractConditionals) {
          const conditional = this.extractConditional(node, nodeId);
          if (conditional) {
            concepts.conditionals.push(conditional);
          }
        }
        break;

      case 'for':
        if (this.options.extractIterations) {
          const iteration = this.extractIteration(node, nodeId);
          if (iteration) {
            concepts.iterations.push(iteration);
          }
        }
        break;

      case 'slot':
        if (this.options.extractSlots) {
          const slot = this.extractSlot(node, nodeId);
          if (slot) {
            concepts.slots.push(slot);
          }
        }
        break;

      case 'element':
      case undefined: // Default to element
        // Extract events
        if (this.options.extractEvents) {
          const events = this.extractEvents(node, nodeId);
          concepts.events.push(...events);
        }

        // Extract attributes
        if (this.options.extractAttributes) {
          const attributes = this.extractAttributes(node, nodeId);
          concepts.attributes.push(...attributes);
        }

        // Extract styling (merge with existing)
        if (this.options.extractStyling) {
          this.extractStyling(node, nodeId, concepts.styling);
        }
        break;

      // Text and comment nodes don't have extractable concepts
      case 'text':
      case 'comment':
        break;

      default:
        this.errorCollector.addWarning(
          `Unknown node type: ${node.type}`,
          nodeId,
          'analyzer'
        );
    }
  }

  /**
   * Extract event concepts from a node.
   */
  private extractEvents(node: TemplateNode, nodeId: string): EventConcept[] {
    const events: EventConcept[] = [];

    if (!node.attributes && !node.expressionAttributes) {
      return events;
    }

    // Check both regular attributes and expression attributes
    const allAttributes = {
      ...node.attributes,
      ...node.expressionAttributes
    };

    for (const [attrName, attrValue] of Object.entries(allAttributes)) {
      const eventName = this.extractEventName(attrName);
      if (eventName) {
        const event: EventConcept = {
          nodeId,
          name: eventName,
          handler: String(attrValue),
          modifiers: this.extractEventModifiers(attrName),
          parameters: this.extractEventParameters(String(attrValue))
        };
        
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Extract event name from attribute name.
   */
  private extractEventName(attrName: string): string | null {
    // Sort prefixes by length (longest first) to ensure proper matching
    const sortedPrefixes = [...this.options.eventPrefixes].sort((a, b) => b.length - a.length);
    
    for (const prefix of sortedPrefixes) {
      if (attrName.startsWith(prefix)) {
        let eventName = attrName.substring(prefix.length);
        
        // Handle modifiers (e.g., @click.prevent -> click, on:click|preventDefault -> click)
        if (eventName.includes('.')) {
          eventName = eventName.split('.')[0];
        }
        if (eventName.includes('|')) {
          eventName = eventName.split('|')[0];
        }
        
        return eventName;
      }
    }
    return null;
  }

  /**
   * Extract event modifiers from attribute name.
   */
  private extractEventModifiers(attrName: string): string[] {
    const modifiers: string[] = [];
    
    // Vue-style modifiers (e.g., @click.prevent)
    if (attrName.includes('.')) {
      const parts = attrName.split('.');
      modifiers.push(...parts.slice(1)); // Skip the event name part
    }
    
    // Svelte-style modifiers (e.g., on:click|preventDefault)
    if (attrName.includes('|')) {
      // Extract the part after the event name, using sorted prefixes
      const sortedPrefixes = [...this.options.eventPrefixes].sort((a, b) => b.length - a.length);
      for (const prefix of sortedPrefixes) {
        if (attrName.startsWith(prefix)) {
          const eventPart = attrName.substring(prefix.length);
          if (eventPart.includes('|')) {
            const parts = eventPart.split('|');
            modifiers.push(...parts.slice(1)); // Skip the event name part
          }
          break;
        }
      }
    }
    
    return modifiers;
  }

  /**
   * Extract parameters from event handler expression.
   */
  private extractEventParameters(handler: string): string[] {
    const parameters: string[] = [];
    
    // Simple parameter extraction for common patterns
    // Look for function calls with parameters: handleClick($event, index)
    const match = handler.match(/\(([^)]+)\)/);
    if (match) {
      const paramStr = match[1];
      parameters.push(...paramStr.split(',').map(p => p.trim()));
    }
    
    return parameters;
  }

  /**
   * Extract styling concepts from a node and merge with existing styling.
   */
  private extractStyling(
    node: TemplateNode,
    nodeId: string,
    existingStyling: StylingConcept
  ): void {
    const staticClasses: string[] = [];
    const dynamicClasses: string[] = [];
    const inlineStyles: Record<string, string> = {};
    const styleBindings: Record<string, string> = {};

    // Extract static classes from class attribute
    if (node.attributes?.class) {
      const classValue = String(node.attributes.class);
      staticClasses.push(...classValue.split(/\s+/).filter(Boolean));
    }

    // Extract dynamic classes from expression attributes
    if (node.expressionAttributes) {
      // React/JSX style: className={expression}
      if (node.expressionAttributes.className) {
        dynamicClasses.push(String(node.expressionAttributes.className));
      }
      
      // Vue style: :class="expression"
      if (node.expressionAttributes[':class']) {
        dynamicClasses.push(String(node.expressionAttributes[':class']));
      }
    }

    // Extract inline styles
    if (node.attributes?.style) {
      const styleValue = String(node.attributes.style);
      Object.assign(inlineStyles, this.parseInlineStyles(styleValue));
    }

    // Extract dynamic style bindings
    if (node.expressionAttributes) {
      // React style: style={expression}
      if (node.expressionAttributes.style) {
        styleBindings.style = String(node.expressionAttributes.style);
      }
      
      // Vue style: :style="expression"
      if (node.expressionAttributes[':style']) {
        styleBindings.style = String(node.expressionAttributes[':style']);
      }
    }

    // Extract extension data for styling extensions (e.g., BEM, Tailwind)
    if (node.extensions) {
      if (!existingStyling.extensionData) {
        existingStyling.extensionData = {};
      }
      
      // Merge extension data - this allows styling extensions to access their configuration
      for (const [extensionKey, extensionData] of Object.entries(node.extensions)) {
        if (!existingStyling.extensionData[extensionKey]) {
          existingStyling.extensionData[extensionKey] = [];
        }
        existingStyling.extensionData[extensionKey].push({
          nodeId,
          data: extensionData
        });
      }
    }

    // Merge with existing styling
    existingStyling.staticClasses.push(...staticClasses);
    existingStyling.dynamicClasses.push(...dynamicClasses);
    Object.assign(existingStyling.inlineStyles, inlineStyles);
    Object.assign(existingStyling.styleBindings || {}, styleBindings);
  }

  /**
   * Parse inline styles from style attribute.
   */
  private parseInlineStyles(styleStr: string): Record<string, string> {
    const styles: Record<string, string> = {};
    
    const declarations = styleStr.split(';').filter(Boolean);
    for (const declaration of declarations) {
      const [property, value] = declaration.split(':').map(s => s.trim());
      if (property && value) {
        styles[property] = value;
      }
    }
    
    return styles;
  }

  /**
   * Extract conditional concept from if node.
   */
  private extractConditional(node: TemplateNode, nodeId: string): ConditionalConcept | null {
    if (!node.condition) {
      this.errorCollector.addWarning('Conditional node missing condition', nodeId, 'analyzer');
      return null;
    }

    return {
      nodeId,
      condition: node.condition,
      thenNodes: node.then || [],
      elseNodes: node.else
    };
  }

  /**
   * Extract iteration concept from for node.
   */
  private extractIteration(node: TemplateNode, nodeId: string): IterationConcept | null {
    if (!node.items || !node.item) {
      this.errorCollector.addWarning(
        'Iteration node missing required properties (items, item)',
        nodeId,
        'analyzer'
      );
      return null;
    }

    return {
      nodeId,
      items: node.items,
      itemVariable: node.item,
      indexVariable: node.index,
      keyExpression: node.key,
      childNodes: node.children || []
    };
  }

  /**
   * Extract slot concept from slot node.
   */
  private extractSlot(node: TemplateNode, nodeId: string): SlotConcept | null {
    if (!node.name) {
      this.errorCollector.addWarning('Slot node missing name', nodeId, 'analyzer');
      return null;
    }

    return {
      nodeId,
      name: node.name,
      fallback: node.fallback
    };
  }

  /**
   * Extract attribute concepts from a node.
   */
  private extractAttributes(node: TemplateNode, nodeId: string): AttributeConcept[] {
    const attributes: AttributeConcept[] = [];

    if (!node.attributes && !node.expressionAttributes) {
      return attributes;
    }

    // Extract static attributes
    if (node.attributes) {
      for (const [name, value] of Object.entries(node.attributes)) {
        // Skip ignored attributes and event attributes
        if (this.shouldIgnoreAttribute(name)) {
          continue;
        }

        attributes.push({
          nodeId,
          name,
          value: value as string | boolean,
          isExpression: false
        });
      }
    }

    // Extract expression attributes
    if (node.expressionAttributes) {
      for (const [name, value] of Object.entries(node.expressionAttributes)) {
        // Skip ignored attributes and event attributes
        if (this.shouldIgnoreAttribute(name)) {
          continue;
        }

        attributes.push({
          nodeId,
          name,
          value: String(value),
          isExpression: true
        });
      }
    }

    return attributes;
  }

  /**
   * Check if an attribute should be ignored.
   */
  private shouldIgnoreAttribute(attrName: string): boolean {
    // Ignore event attributes (handled separately)
    if (this.extractEventName(attrName)) {
      return true;
    }

    // Ignore styling attributes (handled separately)
    if (['class', 'className', 'style', ':class', ':style'].includes(attrName)) {
      return true;
    }

    // Ignore explicitly ignored attributes
    if (this.options.ignoreAttributes.includes(attrName)) {
      return true;
    }

    return false;
  }

  /**
   * Extract component metadata from template.
   */
  private extractMetadata(template: TemplateNode[]): ComponentMetadata {
    // For now, return empty metadata
    // This can be enhanced to extract component name, props, etc.
    return {};
  }

  /**
   * Create an empty styling concept.
   */
  private createEmptyStylingConcept(nodeId: string): StylingConcept {
    return {
      nodeId,
      staticClasses: [],
      dynamicClasses: [],
      inlineStyles: {},
      styleBindings: {}
    };
  }
}