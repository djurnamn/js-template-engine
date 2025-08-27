/**
 * Framework Consistency Checker for advanced processing: Enhanced Concept Processing
 *
 * Checks concept compatibility and consistency across different frameworks.
 * Provides suggestions for framework-specific optimizations and alternatives.
 */

import { ErrorCollector } from '../metadata';
import { EventNormalizer, type FrameworkEventMapping } from '../normalization';
import type {
  ComponentConcept,
  EventConcept,
  StylingConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
} from '../concepts';

/**
 * Framework compatibility result.
 */
export interface FrameworkCompatibilityResult {
  /** Target framework */
  framework: 'vue' | 'react' | 'svelte';
  /** Whether concept is compatible */
  isCompatible: boolean;
  /** Compatibility score (0-100) */
  score: number;
  /** Compatibility warnings */
  warnings: string[];
  /** Suggested alternatives */
  alternatives: string[];
  /** Required adaptations */
  adaptations: string[];
}

/**
 * Cross-framework consistency report.
 */
export interface ConsistencyReport {
  /** Component concepts analyzed */
  concepts: ComponentConcept;
  /** Compatibility results per framework */
  frameworkResults: Record<string, FrameworkCompatibilityResult>;
  /** Overall consistency score */
  overallScore: number;
  /** Cross-framework recommendations */
  recommendations: ConsistencyRecommendation[];
}

/**
 * Consistency recommendation.
 */
export interface ConsistencyRecommendation {
  /** Recommendation type */
  type: 'portability' | 'optimization' | 'best-practice' | 'compatibility';
  /** Recommendation message */
  message: string;
  /** Frameworks affected */
  frameworks: string[];
  /** Priority (1-5, 5 being highest) */
  priority: number;
  /** Implementation steps */
  steps?: string[];
}

/**
 * Framework constraint types.
 */
interface FrameworkConstraints {
  events: {
    supportedModifiers: string[];
    namingConvention: string;
    prefix: string;
  };
  styling: {
    classAttribute: string;
    styleBinding: string;
    supportsModules?: boolean;
    supportsScoped?: boolean;
  };
  conditionals: {
    syntax: string;
    supportsElse: boolean;
  };
  iterations: {
    requiresKey: boolean;
    syntax: string;
  };
  slots: {
    mechanism: string;
    namedSlots: string;
  };
}

/**
 * Framework-specific patterns and constraints.
 */
const FRAMEWORK_CONSTRAINTS: Record<string, FrameworkConstraints> = {
  react: {
    events: {
      supportedModifiers: [],
      namingConvention: 'camelCase',
      prefix: 'on',
    },
    styling: {
      classAttribute: 'className',
      styleBinding: 'style',
      supportsModules: true,
    },
    conditionals: {
      syntax: '{condition && <Component />}',
      supportsElse: false,
    },
    iterations: {
      requiresKey: true,
      syntax: '{items.map((item, index) => <Component key={item.id} />)}',
    },
    slots: {
      mechanism: 'children',
      namedSlots: 'props',
    },
  },
  vue: {
    events: {
      supportedModifiers: [
        'stop',
        'prevent',
        'capture',
        'self',
        'once',
        'passive',
      ],
      namingConvention: 'kebab-case',
      prefix: '@',
    },
    styling: {
      classAttribute: 'class',
      styleBinding: ':style',
      supportsScoped: true,
    },
    conditionals: {
      syntax: 'v-if="condition"',
      supportsElse: true,
    },
    iterations: {
      requiresKey: false,
      syntax: 'v-for="item in items" :key="item.id"',
    },
    slots: {
      mechanism: 'slot',
      namedSlots: 'template #slotName',
    },
  },
  svelte: {
    events: {
      supportedModifiers: [
        'preventDefault',
        'stopPropagation',
        'passive',
        'capture',
        'once',
      ],
      namingConvention: 'kebab-case',
      prefix: 'on:',
    },
    styling: {
      classAttribute: 'class',
      styleBinding: 'style:',
      supportsScoped: true,
    },
    conditionals: {
      syntax: '{#if condition}',
      supportsElse: true,
    },
    iterations: {
      requiresKey: false,
      syntax: '{#each items as item (item.id)}',
    },
    slots: {
      mechanism: 'slot',
      namedSlots: 'slot name="slotName"',
    },
  },
};

/**
 * Framework consistency checker.
 */
export class FrameworkConsistencyChecker {
  private errorCollector: ErrorCollector;
  private eventNormalizer: EventNormalizer;

  constructor(
    errorCollector?: ErrorCollector,
    eventNormalizer?: EventNormalizer
  ) {
    this.errorCollector = errorCollector || new ErrorCollector();
    this.eventNormalizer = eventNormalizer || new EventNormalizer();
  }

  /**
   * Check component concepts for cross-framework consistency.
   */
  checkConsistency(concepts: ComponentConcept): ConsistencyReport {
    const frameworks: ('vue' | 'react' | 'svelte')[] = [
      'vue',
      'react',
      'svelte',
    ];
    const frameworkResults: Record<string, FrameworkCompatibilityResult> = {};

    // Check compatibility with each framework
    for (const framework of frameworks) {
      frameworkResults[framework] = this.checkFrameworkCompatibility(
        concepts,
        framework
      );
    }

    // Calculate overall score
    const scores = Object.values(frameworkResults).map(
      (result) => result.score
    );
    const overallScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Generate cross-framework recommendations
    const recommendations = this.generateConsistencyRecommendations(
      concepts,
      frameworkResults
    );

    return {
      concepts,
      frameworkResults,
      overallScore,
      recommendations,
    };
  }

  /**
   * Check compatibility with a specific framework.
   */
  checkFrameworkCompatibility(
    concepts: ComponentConcept,
    framework: 'vue' | 'react' | 'svelte'
  ): FrameworkCompatibilityResult {
    const warnings: string[] = [];
    const alternatives: string[] = [];
    const adaptations: string[] = [];
    let score = 100;

    // Check event compatibility
    const eventResult = this.checkEventCompatibility(
      concepts.events,
      framework
    );
    warnings.push(...eventResult.warnings);
    alternatives.push(...eventResult.alternatives);
    score = Math.min(score, eventResult.score);

    // Check styling compatibility
    const stylingResult = this.checkStylingCompatibility(
      concepts.styling,
      framework
    );
    warnings.push(...stylingResult.warnings);
    alternatives.push(...stylingResult.alternatives);
    score = Math.min(score, stylingResult.score);

    // Check conditional compatibility
    const conditionalResult = this.checkConditionalCompatibility(
      concepts.conditionals,
      framework
    );
    warnings.push(...conditionalResult.warnings);
    alternatives.push(...conditionalResult.alternatives);
    score = Math.min(score, conditionalResult.score);

    // Check iteration compatibility
    const iterationResult = this.checkIterationCompatibility(
      concepts.iterations,
      framework
    );
    warnings.push(...iterationResult.warnings);
    alternatives.push(...iterationResult.alternatives);
    score = Math.min(score, iterationResult.score);

    // Check slot compatibility
    const slotResult = this.checkSlotCompatibility(concepts.slots, framework);
    warnings.push(...slotResult.warnings);
    alternatives.push(...slotResult.alternatives);
    score = Math.min(score, slotResult.score);

    // Check attribute compatibility
    const attributeResult = this.checkAttributeCompatibility(
      concepts.attributes,
      framework
    );
    warnings.push(...attributeResult.warnings);
    alternatives.push(...attributeResult.alternatives);
    score = Math.min(score, attributeResult.score);

    return {
      framework,
      isCompatible: warnings.length === 0,
      score: Math.max(0, score),
      warnings,
      alternatives,
      adaptations,
    };
  }

  /**
   * Check event compatibility with framework.
   */
  private checkEventCompatibility(
    events: EventConcept[],
    framework: 'vue' | 'react' | 'svelte'
  ): { warnings: string[]; alternatives: string[]; score: number } {
    const warnings: string[] = [];
    const alternatives: string[] = [];
    let score = 100;

    const constraints = FRAMEWORK_CONSTRAINTS[framework].events;

    for (const event of events) {
      // Check event modifiers
      if (event.modifiers && event.modifiers.length > 0) {
        const unsupportedModifiers = event.modifiers.filter(
          (modifier) => !constraints.supportedModifiers.includes(modifier)
        );

        if (unsupportedModifiers.length > 0) {
          warnings.push(
            `${framework} doesn't support modifiers: ${unsupportedModifiers.join(', ')} for event ${event.name}`
          );

          switch (framework) {
            case 'react':
              alternatives.push(
                'Handle modifiers in the event handler function'
              );
              break;
            case 'vue':
              alternatives.push(
                `Use supported Vue modifiers: ${constraints.supportedModifiers.join(', ')}`
              );
              break;
            case 'svelte':
              alternatives.push(
                `Use supported Svelte modifiers: ${constraints.supportedModifiers.join(', ')}`
              );
              break;
          }

          score -= 10;
        }
      }

      // Check event name normalization
      const commonName = this.eventNormalizer.extractCommonEventName(
        event.name
      );
      const mapping = this.eventNormalizer.findEventMapping(commonName);

      if (mapping) {
        const frameworkEvent = mapping[framework];
        if (event.name !== frameworkEvent) {
          alternatives.push(
            `Use ${frameworkEvent} instead of ${event.name} for ${framework}`
          );
        }
      }
    }

    return { warnings, alternatives, score };
  }

  /**
   * Check styling compatibility with framework.
   */
  private checkStylingCompatibility(
    styling: StylingConcept,
    framework: 'vue' | 'react' | 'svelte'
  ): { warnings: string[]; alternatives: string[]; score: number } {
    const warnings: string[] = [];
    const alternatives: string[] = [];
    let score = 100;

    const constraints = FRAMEWORK_CONSTRAINTS[framework].styling;

    // Check class attribute naming
    if (framework === 'react' && styling.staticClasses.length > 0) {
      alternatives.push('Use className instead of class for React');
    }

    // Check style binding approach
    if (
      styling.styleBindings &&
      Object.keys(styling.styleBindings).length > 0
    ) {
      switch (framework) {
        case 'react':
          alternatives.push('Use style prop with object syntax for React');
          break;
        case 'vue':
          alternatives.push('Use :style directive for Vue dynamic styles');
          break;
        case 'svelte':
          alternatives.push('Use style: directives for Svelte dynamic styles');
          break;
      }
    }

    return { warnings, alternatives, score };
  }

  /**
   * Check conditional compatibility with framework.
   */
  private checkConditionalCompatibility(
    conditionals: ConditionalConcept[],
    framework: 'vue' | 'react' | 'svelte'
  ): { warnings: string[]; alternatives: string[]; score: number } {
    const warnings: string[] = [];
    const alternatives: string[] = [];
    let score = 100;

    for (const conditional of conditionals) {
      switch (framework) {
        case 'react':
          alternatives.push(
            'Use {condition && <Component />} syntax for React'
          );
          if (conditional.elseNodes) {
            alternatives.push(
              'Use ternary operator for React if-else: {condition ? <Then /> : <Else />}'
            );
          }
          break;
        case 'vue':
          alternatives.push('Use v-if directive for Vue conditionals');
          if (conditional.elseNodes) {
            alternatives.push('Use v-else directive for Vue else branches');
          }
          break;
        case 'svelte':
          alternatives.push('Use {#if condition} syntax for Svelte');
          if (conditional.elseNodes) {
            alternatives.push('Use {:else} syntax for Svelte else branches');
          }
          break;
      }
    }

    return { warnings, alternatives, score };
  }

  /**
   * Check iteration compatibility with framework.
   */
  private checkIterationCompatibility(
    iterations: IterationConcept[],
    framework: 'vue' | 'react' | 'svelte'
  ): { warnings: string[]; alternatives: string[]; score: number } {
    const warnings: string[] = [];
    const alternatives: string[] = [];
    let score = 100;

    const constraints = FRAMEWORK_CONSTRAINTS[framework].iterations;

    for (const iteration of iterations) {
      // Check key requirement
      if (constraints.requiresKey && !iteration.keyExpression) {
        warnings.push(`${framework} requires key expression for iterations`);
        alternatives.push('Add unique key expression for better performance');
        score -= 15;
      }

      // Provide framework-specific syntax
      alternatives.push(`Use ${constraints.syntax} for ${framework}`);
    }

    return { warnings, alternatives, score };
  }

  /**
   * Check slot compatibility with framework.
   */
  private checkSlotCompatibility(
    slots: SlotConcept[],
    framework: 'vue' | 'react' | 'svelte'
  ): { warnings: string[]; alternatives: string[]; score: number } {
    const warnings: string[] = [];
    const alternatives: string[] = [];
    let score = 100;

    const constraints = FRAMEWORK_CONSTRAINTS[framework].slots;

    if (slots.length > 0) {
      switch (framework) {
        case 'react':
          alternatives.push('Use children prop for React content projection');
          alternatives.push('Use named props for React named slots');
          break;
        case 'vue':
          alternatives.push('Use <slot> elements for Vue content projection');
          alternatives.push('Use <template #slotName> for Vue named slots');
          break;
        case 'svelte':
          alternatives.push(
            'Use <slot> elements for Svelte content projection'
          );
          alternatives.push(
            'Use <slot name="slotName"> for Svelte named slots'
          );
          break;
      }
    }

    return { warnings, alternatives, score };
  }

  /**
   * Check attribute compatibility with framework.
   */
  private checkAttributeCompatibility(
    attributes: AttributeConcept[],
    framework: 'vue' | 'react' | 'svelte'
  ): { warnings: string[]; alternatives: string[]; score: number } {
    const warnings: string[] = [];
    const alternatives: string[] = [];
    let score = 100;

    for (const attr of attributes) {
      // Check framework-specific attribute handling
      if (attr.isExpression) {
        switch (framework) {
          case 'react':
            if (attr.name.includes('-')) {
              warnings.push(
                `React prefers camelCase for attributes: ${attr.name}`
              );
              alternatives.push(`Use ${this.toCamelCase(attr.name)} instead`);
              score -= 5;
            }
            break;
          case 'vue':
            alternatives.push(
              `Use v-bind:${attr.name} or :${attr.name} for Vue dynamic attributes`
            );
            break;
        }
      }
    }

    return { warnings, alternatives, score };
  }

  /**
   * Generate cross-framework consistency recommendations.
   */
  private generateConsistencyRecommendations(
    concepts: ComponentConcept,
    frameworkResults: Record<string, FrameworkCompatibilityResult>
  ): ConsistencyRecommendation[] {
    const recommendations: ConsistencyRecommendation[] = [];

    // Check if there are common issues across frameworks
    const allWarnings = Object.values(frameworkResults).flatMap(
      (result) => result.warnings
    );
    const commonPatterns = this.findCommonPatterns(allWarnings);

    for (const pattern of commonPatterns) {
      recommendations.push({
        type: 'portability',
        message: `Common issue across frameworks: ${pattern}`,
        frameworks: ['vue', 'react', 'svelte'],
        priority: 4,
      });
    }

    // Recommend optimizations for best performance across frameworks
    if (concepts.events.length > 0) {
      recommendations.push({
        type: 'optimization',
        message:
          'Use framework-specific event normalization for better performance',
        frameworks: ['vue', 'react', 'svelte'],
        priority: 3,
        steps: [
          'Implement event name normalization',
          'Use framework-appropriate event modifiers',
          'Consider event delegation for multiple events',
        ],
      });
    }

    // Recommend styling consistency
    if (
      concepts.styling.staticClasses.length > 0 ||
      Object.keys(concepts.styling.inlineStyles).length > 0
    ) {
      recommendations.push({
        type: 'best-practice',
        message: 'Maintain consistent styling approach across frameworks',
        frameworks: ['vue', 'react', 'svelte'],
        priority: 2,
        steps: [
          'Use CSS classes over inline styles when possible',
          'Implement consistent class naming conventions',
          'Consider CSS-in-JS solutions for React, scoped styles for Vue/Svelte',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Find common patterns in warning messages.
   */
  private findCommonPatterns(warnings: string[]): string[] {
    const patterns: Record<string, number> = {};

    for (const warning of warnings) {
      // Extract key phrases from warnings
      const keyPhrases = warning.split(/[,.:;]/).map((phrase) => phrase.trim());
      for (const phrase of keyPhrases) {
        if (phrase.length > 10) {
          // Only consider substantial phrases
          patterns[phrase] = (patterns[phrase] || 0) + 1;
        }
      }
    }

    // Return patterns that appear in multiple warnings
    return Object.entries(patterns)
      .filter(([_, count]) => count > 1)
      .map(([pattern, _]) => pattern);
  }

  /**
   * Convert string to camelCase.
   */
  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Suggest event alternatives for framework.
   */
  suggestEventAlternatives(
    event: EventConcept,
    framework: 'vue' | 'react' | 'svelte'
  ): string[] {
    const alternatives: string[] = [];
    const commonName = this.eventNormalizer.extractCommonEventName(event.name);
    const mapping = this.eventNormalizer.findEventMapping(commonName);

    if (mapping) {
      const frameworkEvent = mapping[framework];
      alternatives.push(`Use ${frameworkEvent} for ${framework}`);
    }

    // Add framework-specific suggestions
    const constraints = FRAMEWORK_CONSTRAINTS[framework].events;
    if (event.modifiers && event.modifiers.length > 0) {
      const supportedModifiers = event.modifiers.filter((modifier) =>
        constraints.supportedModifiers.includes(modifier)
      );

      if (supportedModifiers.length > 0) {
        alternatives.push(
          `Supported modifiers for ${framework}: ${supportedModifiers.join(', ')}`
        );
      }
    }

    return alternatives;
  }

  /**
   * Validate attribute compatibility.
   */
  validateAttributeCompatibility(
    attr: AttributeConcept,
    framework: 'vue' | 'react' | 'svelte'
  ): boolean {
    // Framework-specific attribute validation
    switch (framework) {
      case 'react':
        // React doesn't allow some HTML attributes
        const reactInvalidAttrs = ['for', 'class'];
        return !reactInvalidAttrs.includes(attr.name);
      case 'vue':
        // Vue is more permissive with HTML attributes
        return true;
      case 'svelte':
        // Svelte is also permissive
        return true;
      default:
        return true;
    }
  }

  /**
   * Normalize concepts for framework compatibility.
   */
  normalizeConceptsForFramework(
    concepts: ComponentConcept,
    framework: 'vue' | 'react' | 'svelte'
  ): ComponentConcept {
    const normalized = { ...concepts };

    // Normalize events
    const eventNormalizationOptions = {
      framework,
      preserveModifiers: true,
      validateEvents: true,
    };

    const normalizedEvents = this.eventNormalizer.normalizeEvents(
      concepts.events,
      eventNormalizationOptions
    );

    normalized.events = normalizedEvents.map((ne) => ({
      ...ne.original,
      name: ne.commonName,
      modifiers: ne.modifiers,
    }));

    return normalized;
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
