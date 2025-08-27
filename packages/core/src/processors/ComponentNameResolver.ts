/**
 * Component Name Resolver for advanced processing: Template Properties Abstraction
 *
 * Implements component name resolution with proper priority as defined in advanced processing plan:
 * 1. renderOptions.component.name
 * 2. frameworkSpecificOverride (component.extensions.react.name)
 * 3. component.name (common)
 * 4. defaultName
 */

import { ErrorCollector } from '../metadata';

/**
 * Component name context for resolution.
 */
export interface ComponentNameContext {
  /** Component definition with common properties */
  component?: {
    name?: string;
    extensions?: Record<string, { name?: string; [key: string]: any }>;
    [key: string]: any;
  };
  /** Render options with potential overrides */
  renderOptions?: {
    component?: {
      name?: string;
      [key: string]: any;
    };
    framework?: string;
    [key: string]: any;
  };
  /** Framework being used */
  framework: string;
  /** Default name fallback */
  defaultName?: string;
}

/**
 * Name resolution priority levels.
 */
export enum NameResolutionPriority {
  /** Explicit options override */
  OPTIONS_OVERRIDE = 1,
  /** Framework-specific override */
  FRAMEWORK_SPECIFIC = 2,
  /** Common component name */
  COMMON_NAME = 3,
  /** Default fallback */
  DEFAULT_FALLBACK = 4,
}

/**
 * Name resolution result with metadata.
 */
export interface NameResolutionResult {
  /** Resolved component name */
  name: string;
  /** Priority level used */
  priority: NameResolutionPriority;
  /** Source of the name */
  source: string;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Resolution metadata */
  metadata: {
    /** Available alternatives */
    alternatives: string[];
    /** Warnings during resolution */
    warnings: string[];
  };
}

/**
 * Component name resolver implementing advanced processing priority system.
 */
export class ComponentNameResolver {
  private errorCollector: ErrorCollector;

  constructor(errorCollector?: ErrorCollector) {
    this.errorCollector = errorCollector || new ErrorCollector();
  }

  /**
   * Resolve component name with full priority and metadata.
   */
  resolveComponentName(context: ComponentNameContext): NameResolutionResult {
    const {
      component,
      renderOptions,
      framework,
      defaultName = 'Component',
    } = context;
    const alternatives: string[] = [];
    const warnings: string[] = [];

    // Priority 1: Explicit options override
    const optionsName = renderOptions?.component?.name;
    if (optionsName && this.isValidComponentName(optionsName)) {
      this.collectAlternatives(alternatives, component, framework, defaultName);
      return this.createResult(
        optionsName,
        NameResolutionPriority.OPTIONS_OVERRIDE,
        'renderOptions.component.name',
        false,
        alternatives,
        warnings
      );
    }

    if (optionsName && !this.isValidComponentName(optionsName)) {
      warnings.push(`Invalid component name in options: "${optionsName}"`);
      this.errorCollector.addWarning(
        `Invalid component name in options: "${optionsName}"`,
        'component-name-resolver',
        'validation'
      );
    }

    // Priority 2: Framework-specific override
    const frameworkSpecificName = component?.extensions?.[framework]?.name;
    if (
      frameworkSpecificName &&
      this.isValidComponentName(frameworkSpecificName)
    ) {
      this.collectAlternatives(
        alternatives,
        component,
        framework,
        defaultName,
        [frameworkSpecificName]
      );
      return this.createResult(
        frameworkSpecificName,
        NameResolutionPriority.FRAMEWORK_SPECIFIC,
        `component.extensions.${framework}.name`,
        false,
        alternatives,
        warnings
      );
    }

    if (
      frameworkSpecificName &&
      !this.isValidComponentName(frameworkSpecificName)
    ) {
      warnings.push(
        `Invalid framework-specific component name: "${frameworkSpecificName}"`
      );
      this.errorCollector.addWarning(
        `Invalid framework-specific component name: "${frameworkSpecificName}"`,
        'component-name-resolver',
        'validation'
      );
    }

    // Priority 3: Common component name
    const commonName = component?.name;
    if (commonName && this.isValidComponentName(commonName)) {
      this.collectAlternatives(
        alternatives,
        component,
        framework,
        defaultName,
        [commonName]
      );
      return this.createResult(
        commonName,
        NameResolutionPriority.COMMON_NAME,
        'component.name',
        false,
        alternatives,
        warnings
      );
    }

    if (commonName && !this.isValidComponentName(commonName)) {
      warnings.push(`Invalid common component name: "${commonName}"`);
      this.errorCollector.addWarning(
        `Invalid common component name: "${commonName}"`,
        'component-name-resolver',
        'validation'
      );
    }

    // Priority 4: Default fallback
    this.collectAlternatives(alternatives, component, framework, defaultName, [
      defaultName,
    ]);

    if (defaultName !== 'Component') {
      warnings.push(`Using fallback component name: "${defaultName}"`);
    }

    return this.createResult(
      defaultName,
      NameResolutionPriority.DEFAULT_FALLBACK,
      'defaultName',
      true,
      alternatives.filter((alt) => alt !== defaultName),
      warnings
    );
  }

  /**
   * Simple component name resolution (advanced processing compatibility).
   */
  resolveSimple(
    component: ComponentNameContext['component'],
    renderOptions: ComponentNameContext['renderOptions'],
    framework: string,
    defaultName = 'Component'
  ): string {
    const context: ComponentNameContext = {
      component,
      renderOptions,
      framework,
      defaultName,
    };

    return this.resolveComponentName(context).name;
  }

  /**
   * Validate component name according to JavaScript identifier rules.
   */
  isValidComponentName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

    // Must start with uppercase letter (React convention)
    if (!/^[A-Z]/.test(name)) {
      return false;
    }

    // Must be valid JavaScript identifier
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      return false;
    }

    // Cannot be reserved words
    const reservedWords = [
      'break',
      'case',
      'catch',
      'class',
      'const',
      'continue',
      'debugger',
      'default',
      'delete',
      'do',
      'else',
      'enum',
      'export',
      'extends',
      'false',
      'finally',
      'for',
      'function',
      'if',
      'import',
      'in',
      'instanceof',
      'new',
      'null',
      'return',
      'super',
      'switch',
      'this',
      'throw',
      'true',
      'try',
      'typeof',
      'var',
      'void',
      'while',
      'with',
      'yield',
      'let',
      'static',
      'implements',
      'interface',
      'package',
      'private',
      'protected',
      'public',
    ];

    return !reservedWords.includes(name.toLowerCase());
  }

  /**
   * Generate suggested component names based on context.
   */
  generateSuggestions(context: ComponentNameContext): string[] {
    const suggestions: string[] = [];
    const { component, framework } = context;

    // Generate from existing names
    if (component?.name) {
      suggestions.push(this.toPascalCase(component.name));
    }

    // Generate framework-specific suggestions
    const frameworkSuggestions = {
      react: ['ReactComponent', 'Component'],
      vue: ['VueComponent', 'Component'],
      svelte: ['SvelteComponent', 'Component'],
    };

    const fwSuggestions = frameworkSuggestions[
      framework as keyof typeof frameworkSuggestions
    ] || ['Component'];
    suggestions.push(...fwSuggestions);

    // Remove duplicates and filter valid names
    return [...new Set(suggestions)].filter((name) =>
      this.isValidComponentName(name)
    );
  }

  /**
   * Convert string to PascalCase for component names.
   */
  toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
      .replace(/^[a-z]/, (char) => char.toUpperCase());
  }

  /**
   * Create name resolution result.
   */
  private createResult(
    name: string,
    priority: NameResolutionPriority,
    source: string,
    usedFallback: boolean,
    alternatives: string[],
    warnings: string[]
  ): NameResolutionResult {
    return {
      name,
      priority,
      source,
      usedFallback,
      metadata: {
        alternatives: [...new Set(alternatives)],
        warnings,
      },
    };
  }

  /**
   * Collect alternative names for metadata.
   */
  private collectAlternatives(
    alternatives: string[],
    component: ComponentNameContext['component'],
    framework: string,
    defaultName: string,
    exclude: string[] = []
  ): void {
    const candidates = [
      component?.name,
      component?.extensions?.[framework]?.name,
      defaultName,
    ];

    for (const candidate of candidates) {
      if (
        candidate &&
        this.isValidComponentName(candidate) &&
        !exclude.includes(candidate) &&
        !alternatives.includes(candidate)
      ) {
        alternatives.push(candidate);
      }
    }
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
 * Default component name resolver instance.
 */
export const defaultNameResolver = new ComponentNameResolver();
