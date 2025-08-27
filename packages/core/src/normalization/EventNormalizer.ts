/**
 * Cross-Framework Event Normalization for advanced processing: Enhanced Concept Processing
 *
 * Normalizes event names across React, Vue, and Svelte frameworks as defined
 * in the advanced processing plan with the EVENT_NORMALIZATION mapping.
 */

import { ErrorCollector } from '../metadata';
import type { EventConcept } from '../concepts';

/**
 * Framework-specific event mapping interface.
 */
export interface FrameworkEventMapping {
  /** Vue event syntax */
  vue: string;
  /** React event syntax */
  react: string;
  /** Svelte event syntax */
  svelte: string;
}

/**
 * Event normalization mapping as defined in advanced processing.
 */
export interface EventNormalization {
  [commonEventName: string]: FrameworkEventMapping;
}

/**
 * Normalized event result.
 */
export interface NormalizedEvent {
  /** Original event concept */
  original: EventConcept;
  /** Normalized common event name */
  commonName: string;
  /** Framework-specific attribute name */
  frameworkAttribute: string;
  /** Event modifiers */
  modifiers: string[];
  /** Whether normalization was applied */
  wasNormalized: boolean;
}

/**
 * Event normalization options.
 */
export interface EventNormalizationOptions {
  /** Target framework */
  framework: 'vue' | 'react' | 'svelte';
  /** Whether to preserve original modifiers */
  preserveModifiers?: boolean;
  /** Custom event mappings */
  customMappings?: EventNormalization;
  /** Whether to validate events */
  validateEvents?: boolean;
}

/**
 * advanced processing event normalization mapping.
 */
export const EVENT_NORMALIZATION: EventNormalization = {
  click: { vue: '@click', react: 'onClick', svelte: 'on:click' },
  change: { vue: '@change', react: 'onChange', svelte: 'on:change' },
  submit: { vue: '@submit', react: 'onSubmit', svelte: 'on:submit' },
  input: { vue: '@input', react: 'onInput', svelte: 'on:input' },
  focus: { vue: '@focus', react: 'onFocus', svelte: 'on:focus' },
  blur: { vue: '@blur', react: 'onBlur', svelte: 'on:blur' },
  keydown: { vue: '@keydown', react: 'onKeyDown', svelte: 'on:keydown' },
  keyup: { vue: '@keyup', react: 'onKeyUp', svelte: 'on:keyup' },
  mousedown: {
    vue: '@mousedown',
    react: 'onMouseDown',
    svelte: 'on:mousedown',
  },
  mouseup: { vue: '@mouseup', react: 'onMouseUp', svelte: 'on:mouseup' },
  mouseover: {
    vue: '@mouseover',
    react: 'onMouseOver',
    svelte: 'on:mouseover',
  },
  mouseout: { vue: '@mouseout', react: 'onMouseOut', svelte: 'on:mouseout' },
  mouseenter: {
    vue: '@mouseenter',
    react: 'onMouseEnter',
    svelte: 'on:mouseenter',
  },
  mouseleave: {
    vue: '@mouseleave',
    react: 'onMouseLeave',
    svelte: 'on:mouseleave',
  },
  load: { vue: '@load', react: 'onLoad', svelte: 'on:load' },
  error: { vue: '@error', react: 'onError', svelte: 'on:error' },
  resize: { vue: '@resize', react: 'onResize', svelte: 'on:resize' },
  scroll: { vue: '@scroll', react: 'onScroll', svelte: 'on:scroll' },
};

/**
 * Cross-framework event normalizer.
 */
export class EventNormalizer {
  private errorCollector: ErrorCollector;
  private normalizationMap: EventNormalization;

  constructor(
    customMappings?: EventNormalization,
    errorCollector?: ErrorCollector
  ) {
    this.errorCollector = errorCollector || new ErrorCollector();
    this.normalizationMap = { ...EVENT_NORMALIZATION, ...customMappings };
  }

  /**
   * Normalize events for a specific framework.
   */
  normalizeEvents(
    events: EventConcept[],
    options: EventNormalizationOptions
  ): NormalizedEvent[] {
    return events.map((event) => this.normalizeEvent(event, options));
  }

  /**
   * Normalize a single event for the target framework.
   */
  normalizeEvent(
    event: EventConcept,
    options: EventNormalizationOptions
  ): NormalizedEvent {
    const {
      framework,
      preserveModifiers = true,
      validateEvents = true,
    } = options;

    // Extract common event name from the event
    const commonName = this.extractCommonEventName(event.name);

    // Find normalization mapping
    const mapping = this.findEventMapping(commonName, options.customMappings);

    if (!mapping) {
      if (validateEvents) {
        this.errorCollector.addWarning(
          `No normalization mapping found for event: ${commonName}`,
          event.nodeId,
          'event-normalizer'
        );
      }

      // Return original if no mapping found
      return {
        original: event,
        commonName,
        frameworkAttribute: event.name,
        modifiers: event.modifiers || [],
        wasNormalized: false,
      };
    }

    // Get framework-specific attribute
    const frameworkAttribute = mapping[framework];

    // Process modifiers
    const modifiers = preserveModifiers ? event.modifiers || [] : [];

    // Validate event for framework compatibility
    if (validateEvents) {
      this.validateEventForFramework(event, framework, mapping);
    }

    return {
      original: event,
      commonName,
      frameworkAttribute,
      modifiers,
      wasNormalized: true,
    };
  }

  /**
   * Extract common event name from framework-specific event name.
   */
  extractCommonEventName(eventName: string): string {
    // Remove framework-specific prefixes
    let commonName = eventName;

    // Vue: @click -> click
    if (commonName.startsWith('@')) {
      commonName = commonName.substring(1);
    }

    // React: onClick -> click
    if (commonName.startsWith('on') && commonName.length > 2) {
      commonName = commonName.substring(2).toLowerCase();
    }

    // Svelte: on:click -> click
    if (commonName.startsWith('on:')) {
      commonName = commonName.substring(3);
    }

    // Vue verbose: v-on:click -> click
    if (commonName.startsWith('v-on:')) {
      commonName = commonName.substring(5);
    }

    // Handle modifiers (remove them for common name)
    commonName = commonName.split('.')[0]; // Vue modifiers
    commonName = commonName.split('|')[0]; // Svelte modifiers

    return commonName.toLowerCase();
  }

  /**
   * Find event mapping for common event name.
   */
  findEventMapping(
    commonName: string,
    customMappings?: EventNormalization
  ): FrameworkEventMapping | null {
    // Check custom mappings first
    if (customMappings && customMappings[commonName]) {
      return customMappings[commonName];
    }

    // Check default mappings
    return this.normalizationMap[commonName] || null;
  }

  /**
   * Reverse lookup: find common name from framework-specific event.
   */
  findCommonNameFromFramework(
    frameworkEvent: string,
    framework: 'vue' | 'react' | 'svelte'
  ): string | null {
    for (const [commonName, mapping] of Object.entries(this.normalizationMap)) {
      if (mapping[framework] === frameworkEvent) {
        return commonName;
      }
    }
    return null;
  }

  /**
   * Get all supported events for a framework.
   */
  getSupportedEvents(framework: 'vue' | 'react' | 'svelte'): string[] {
    return Object.entries(this.normalizationMap).map(
      ([_, mapping]) => mapping[framework]
    );
  }

  /**
   * Get all common event names.
   */
  getCommonEventNames(): string[] {
    return Object.keys(this.normalizationMap);
  }

  /**
   * Validate event compatibility with target framework.
   */
  private validateEventForFramework(
    event: EventConcept,
    framework: 'vue' | 'react' | 'svelte',
    mapping: FrameworkEventMapping
  ): void {
    // Framework-specific validation rules
    switch (framework) {
      case 'react':
        this.validateReactEvent(event, mapping);
        break;
      case 'vue':
        this.validateVueEvent(event, mapping);
        break;
      case 'svelte':
        this.validateSvelteEvent(event, mapping);
        break;
    }
  }

  /**
   * Validate React-specific event compatibility.
   */
  private validateReactEvent(
    event: EventConcept,
    mapping: FrameworkEventMapping
  ): void {
    // React events should be camelCase and start with 'on'
    if (!mapping.react.startsWith('on')) {
      this.errorCollector.addWarning(
        `React event ${mapping.react} should start with 'on'`,
        event.nodeId,
        'event-normalizer'
      );
    }

    // Check for unsupported modifiers in React
    if (event.modifiers && event.modifiers.length > 0) {
      this.errorCollector.addWarning(
        `React doesn't support event modifiers directly: ${event.modifiers.join(', ')}`,
        event.nodeId,
        'event-normalizer'
      );
    }
  }

  /**
   * Validate Vue-specific event compatibility.
   */
  private validateVueEvent(
    event: EventConcept,
    mapping: FrameworkEventMapping
  ): void {
    // Vue events should start with '@'
    if (!mapping.vue.startsWith('@')) {
      this.errorCollector.addWarning(
        `Vue event ${mapping.vue} should start with '@'`,
        event.nodeId,
        'event-normalizer'
      );
    }

    // Validate Vue modifiers
    if (event.modifiers) {
      const validVueModifiers = [
        'stop',
        'prevent',
        'capture',
        'self',
        'once',
        'passive',
        'left',
        'right',
        'middle',
        'ctrl',
        'alt',
        'shift',
        'meta',
      ];

      for (const modifier of event.modifiers) {
        if (!validVueModifiers.includes(modifier)) {
          this.errorCollector.addWarning(
            `Unknown Vue event modifier: ${modifier}`,
            event.nodeId,
            'event-normalizer'
          );
        }
      }
    }
  }

  /**
   * Validate Svelte-specific event compatibility.
   */
  private validateSvelteEvent(
    event: EventConcept,
    mapping: FrameworkEventMapping
  ): void {
    // Svelte events should start with 'on:'
    if (!mapping.svelte.startsWith('on:')) {
      this.errorCollector.addWarning(
        `Svelte event ${mapping.svelte} should start with 'on:'`,
        event.nodeId,
        'event-normalizer'
      );
    }

    // Validate Svelte modifiers
    if (event.modifiers) {
      const validSvelteModifiers = [
        'preventDefault',
        'stopPropagation',
        'passive',
        'capture',
        'once',
        'self',
        'trusted',
      ];

      for (const modifier of event.modifiers) {
        if (!validSvelteModifiers.includes(modifier)) {
          this.errorCollector.addWarning(
            `Unknown Svelte event modifier: ${modifier}`,
            event.nodeId,
            'event-normalizer'
          );
        }
      }
    }
  }

  /**
   * Add custom event mapping.
   */
  addCustomMapping(commonName: string, mapping: FrameworkEventMapping): void {
    this.normalizationMap[commonName] = mapping;
  }

  /**
   * Remove event mapping.
   */
  removeMapping(commonName: string): void {
    delete this.normalizationMap[commonName];
  }

  /**
   * Get current normalization mappings.
   */
  getMappings(): EventNormalization {
    return { ...this.normalizationMap };
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
  }
}

/**
 * Default event normalizer instance.
 */
export const defaultEventNormalizer = new EventNormalizer();
