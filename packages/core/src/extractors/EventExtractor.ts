/**
 * Advanced Event Concept Extractor
 * 
 * Advanced event extraction with cross-framework normalization and validation.
 * Provides comprehensive event analysis and framework-specific processing.
 */

import { ErrorCollector } from '../metadata';
import { EventNormalizer, type EventNormalizationOptions } from '../normalization';
import type { EventConcept } from '../concepts';

/**
 * Template node interface for event extraction.
 */
interface TemplateNode {
  type?: 'element' | 'text' | 'comment' | 'if' | 'for' | 'slot' | 'fragment';
  tag?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, any>;
  children?: TemplateNode[];
  extensions?: Record<string, any>;
}

/**
 * Event extraction options.
 */
export interface EventExtractionOptions {
  /** Framework for normalization */
  framework?: 'vue' | 'react' | 'svelte';
  /** Custom event prefixes to recognize */
  eventPrefixes?: string[];
  /** Whether to normalize events */
  normalizeEvents?: boolean;
  /** Whether to validate events */
  validateEvents?: boolean;
  /** Whether to extract modifiers */
  extractModifiers?: boolean;
  /** Whether to extract parameters */
  extractParameters?: boolean;
  /** Custom event patterns */
  customPatterns?: RegExp[];
}

/**
 * Event extraction result with metadata.
 */
export interface EventExtractionResult {
  /** Extracted event concepts */
  events: EventConcept[];
  /** Normalization applied */
  normalized: boolean;
  /** Number of events normalized */
  normalizedCount: number;
  /** Validation warnings */
  warnings: string[];
  /** Extraction metadata */
  metadata: {
    /** Total nodes processed */
    nodesProcessed: number;
    /** Event attributes found */
    eventAttributesFound: number;
    /** Framework patterns detected */
    frameworkPatterns: string[];
  };
}

/**
 * Advanced event concept extractor with cross-framework support.
 */
export class EventExtractor {
  private errorCollector: ErrorCollector;
  private eventNormalizer: EventNormalizer;
  private defaultEventPrefixes = ['on', '@', 'v-on:', 'on:', 'bind:'];

  constructor(errorCollector?: ErrorCollector, eventNormalizer?: EventNormalizer) {
    this.errorCollector = errorCollector || new ErrorCollector();
    this.eventNormalizer = eventNormalizer || new EventNormalizer();
  }

  /**
   * Extract events from template nodes with advanced processing.
   */
  extractEvents(
    nodes: TemplateNode[],
    options: EventExtractionOptions = {}
  ): EventExtractionResult {
    const {
      framework = 'react',
      eventPrefixes = this.defaultEventPrefixes,
      normalizeEvents = true,
      validateEvents = true,
      extractModifiers = true,
      extractParameters = true,
      customPatterns = []
    } = options;

    const events: EventConcept[] = [];
    const warnings: string[] = [];
    const frameworkPatterns: string[] = [];
    let nodesProcessed = 0;
    let eventAttributesFound = 0;

    // Process all nodes recursively
    this.processNodes(nodes, events, {
      eventPrefixes,
      extractModifiers,
      extractParameters,
      customPatterns,
      frameworkPatterns,
      nodeCounter: { count: 0 },
      attributeCounter: { count: 0 }
    });

    nodesProcessed = this.getNodeCount(nodes);
    eventAttributesFound = events.length;

    // Normalize events if requested
    let normalizedCount = 0;
    if (normalizeEvents && framework) {
      const normalizationOptions: EventNormalizationOptions = {
        framework,
        validateEvents,
        preserveModifiers: extractModifiers
      };

      const normalizedEvents = this.eventNormalizer.normalizeEvents(events, normalizationOptions);
      normalizedCount = normalizedEvents.filter(ne => ne.wasNormalized).length;

      // Update events with normalized names
      for (let i = 0; i < events.length; i++) {
        const normalized = normalizedEvents[i];
        if (normalized.wasNormalized) {
          events[i] = {
            ...events[i],
            name: normalized.commonName,
            modifiers: normalized.modifiers
          };
        }
      }
    }

    // Collect validation warnings
    const normalizerErrors = this.eventNormalizer.getErrors();
    warnings.push(...normalizerErrors.getErrorsBySeverity('warning').map(w => w.message));

    return {
      events,
      normalized: normalizeEvents,
      normalizedCount,
      warnings,
      metadata: {
        nodesProcessed,
        eventAttributesFound,
        frameworkPatterns: [...new Set(frameworkPatterns)]
      }
    };
  }

  /**
   * Process nodes recursively to extract events.
   */
  private processNodes(
    nodes: TemplateNode[],
    events: EventConcept[],
    context: {
      eventPrefixes: string[];
      extractModifiers: boolean;
      extractParameters: boolean;
      customPatterns: RegExp[];
      frameworkPatterns: string[];
      nodeCounter: { count: number };
      attributeCounter: { count: number };
    }
  ): void {
    for (const [index, node] of nodes.entries()) {
      context.nodeCounter.count++;
      const nodeId = this.generateNodeId(nodes, index);

      // Extract events from current node
      const nodeEvents = this.extractEventsFromNode(node, nodeId, context);
      events.push(...nodeEvents);

      // Process children recursively
      if (node.children) {
        this.processNodes(node.children, events, context);
      }

      // Handle special node types
      if (node.type === 'if') {
        // Process conditional branches
        const conditionalNode = node as any;
        if (conditionalNode.then) {
          this.processNodes(conditionalNode.then, events, context);
        }
        if (conditionalNode.else) {
          this.processNodes(conditionalNode.else, events, context);
        }
      }
    }
  }

  /**
   * Extract events from a single node.
   */
  private extractEventsFromNode(
    node: TemplateNode,
    nodeId: string,
    context: {
      eventPrefixes: string[];
      extractModifiers: boolean;
      extractParameters: boolean;
      customPatterns: RegExp[];
      frameworkPatterns: string[];
      attributeCounter: { count: number };
    }
  ): EventConcept[] {
    const events: EventConcept[] = [];

    if (!node.attributes && !node.expressionAttributes) {
      return events;
    }

    // Combine regular and expression attributes
    const allAttributes = {
      ...node.attributes,
      ...node.expressionAttributes
    };

    for (const [attrName, attrValue] of Object.entries(allAttributes)) {
      const eventInfo = this.parseEventAttribute(attrName, context);
      
      if (eventInfo) {
        context.attributeCounter.count++;
        context.frameworkPatterns.push(eventInfo.pattern);

        const event: EventConcept = {
          nodeId,
          name: eventInfo.eventName,
          handler: String(attrValue),
          modifiers: context.extractModifiers ? eventInfo.modifiers : undefined,
          parameters: context.extractParameters ? this.extractEventParameters(String(attrValue)) : undefined
        };

        events.push(event);
      }
    }

    return events;
  }

  /**
   * Parse event attribute to determine if it's an event and extract details.
   */
  private parseEventAttribute(
    attrName: string,
    context: {
      eventPrefixes: string[];
      customPatterns: RegExp[];
    }
  ): { eventName: string; modifiers: string[]; pattern: string } | null {
    // Check custom patterns first
    for (const pattern of context.customPatterns) {
      if (pattern.test(attrName)) {
        return {
          eventName: attrName,
          modifiers: [],
          pattern: 'custom'
        };
      }
    }

    // Check standard event prefixes
    const sortedPrefixes = [...context.eventPrefixes].sort((a, b) => b.length - a.length);
    
    for (const prefix of sortedPrefixes) {
      if (attrName.startsWith(prefix)) {
        const eventPart = attrName.substring(prefix.length);
        const { eventName, modifiers } = this.parseEventPart(eventPart);
        
        return {
          eventName,
          modifiers,
          pattern: prefix
        };
      }
    }

    return null;
  }

  /**
   * Parse the event part after the prefix to extract name and modifiers.
   */
  private parseEventPart(eventPart: string): { eventName: string; modifiers: string[] } {
    let eventName = eventPart;
    let modifiers: string[] = [];

    // Handle Vue-style modifiers (e.g., click.prevent.stop)
    if (eventName.includes('.')) {
      const parts = eventName.split('.');
      eventName = parts[0];
      modifiers = parts.slice(1);
    }

    // Handle Svelte-style modifiers (e.g., click|preventDefault)
    if (eventName.includes('|')) {
      const parts = eventName.split('|');
      eventName = parts[0];
      modifiers = parts.slice(1);
    }

    return { eventName, modifiers };
  }

  /**
   * Extract parameters from event handler expression.
   */
  private extractEventParameters(handler: string): string[] {
    const parameters: string[] = [];

    // Match function calls with parameters
    const functionCallMatch = handler.match(/\w+\s*\(([^)]*)\)/);
    if (functionCallMatch && functionCallMatch[1]) {
      const paramStr = functionCallMatch[1];
      parameters.push(...paramStr.split(',').map(p => p.trim()).filter(Boolean));
    }

    // Match arrow functions with parameters
    const arrowFunctionMatch = handler.match(/\(([^)]*)\)\s*=>/);
    if (arrowFunctionMatch && arrowFunctionMatch[1]) {
      const paramStr = arrowFunctionMatch[1];
      parameters.push(...paramStr.split(',').map(p => p.trim()).filter(Boolean));
    }

    return parameters;
  }

  /**
   * Generate node ID for debugging.
   */
  private generateNodeId(nodes: TemplateNode[], index: number): string {
    return `node-${index}`;
  }

  /**
   * Count total nodes in tree.
   */
  private getNodeCount(nodes: TemplateNode[]): number {
    let count = 0;
    
    for (const node of nodes) {
      count++;
      if (node.children) {
        count += this.getNodeCount(node.children);
      }
    }
    
    return count;
  }

  /**
   * Extract events from a single node (public API).
   */
  extractEventsFromSingleNode(
    node: TemplateNode,
    nodeId: string,
    options: EventExtractionOptions = {}
  ): EventConcept[] {
    const context = {
      eventPrefixes: options.eventPrefixes || this.defaultEventPrefixes,
      extractModifiers: options.extractModifiers ?? true,
      extractParameters: options.extractParameters ?? true,
      customPatterns: options.customPatterns || [],
      frameworkPatterns: [],
      attributeCounter: { count: 0 }
    };

    return this.extractEventsFromNode(node, nodeId, context);
  }

  /**
   * Validate event compatibility with framework.
   */
  validateEventForFramework(
    event: EventConcept,
    framework: 'vue' | 'react' | 'svelte'
  ): string[] {
    const warnings: string[] = [];

    // Framework-specific validation
    switch (framework) {
      case 'react':
        if (event.modifiers && event.modifiers.length > 0) {
          warnings.push(`React doesn't support event modifiers: ${event.modifiers.join(', ')}`);
        }
        break;
      
      case 'vue':
        if (event.modifiers) {
          const validModifiers = ['stop', 'prevent', 'capture', 'self', 'once', 'passive'];
          const invalid = event.modifiers.filter(m => !validModifiers.includes(m));
          if (invalid.length > 0) {
            warnings.push(`Invalid Vue modifiers: ${invalid.join(', ')}`);
          }
        }
        break;
      
      case 'svelte':
        if (event.modifiers) {
          const validModifiers = ['preventDefault', 'stopPropagation', 'passive', 'capture', 'once'];
          const invalid = event.modifiers.filter(m => !validModifiers.includes(m));
          if (invalid.length > 0) {
            warnings.push(`Invalid Svelte modifiers: ${invalid.join(', ')}`);
          }
        }
        break;
    }

    return warnings;
  }

  /**
   * Get collected errors from processing.
   */
  getErrors(): ErrorCollector {
    return this.errorCollector;
  }

  /**
   * Clear errors from previous processing.
   */
  clearErrors(): void {
    this.errorCollector.clear();
    this.eventNormalizer.clearErrors();
  }
}