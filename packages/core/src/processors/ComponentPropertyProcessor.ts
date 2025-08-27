/**
 * Component Property Processor for advanced processing: Template Properties Abstraction
 *
 * Handles merging of component properties (script, props, imports, component name)
 * using configurable strategies as defined in the advanced processing plan.
 */

import { ErrorCollector } from '../metadata';

/**
 * Import definition interface for organizing imports.
 */
export interface ImportDefinition {
  /** Module to import from */
  from: string;
  /** Default import name */
  default?: string;
  /** Named imports */
  named?: string[];
  /** Namespace import (import * as name) */
  namespace?: string;
  /** Type-only import */
  typeOnly?: boolean;
}

/**
 * Component properties interface representing all mergeable properties.
 */
export interface ComponentProperties {
  /** Component name */
  name: string;
  /** Component props definition */
  props: Record<string, string>;
  /** Import statements */
  imports: ImportDefinition[];
  /** Script/logic content */
  script: string;
}

/**
 * Script merge strategy configuration.
 */
export interface ScriptMergeStrategy {
  /** Merge mode */
  mode: 'prepend' | 'append' | 'replace' | 'merge';
  /** Separator between scripts */
  separator?: string;
  /** Include debug comments */
  includeComments?: boolean;
}

/**
 * Props merge strategy configuration.
 */
export interface PropMergeStrategy {
  /** Merge mode */
  mode: 'merge' | 'override' | 'framework-first' | 'common-first';
  /** Conflict resolution strategy */
  conflictResolution: 'error' | 'warn' | 'framework-wins' | 'common-wins';
}

/**
 * Import merge strategy configuration.
 */
export interface ImportMergeStrategy {
  /** Merge mode */
  mode: 'merge' | 'override' | 'framework-first' | 'common-first';
  /** Enable deduplication */
  deduplication: boolean;
  /** Group imports by source */
  grouping: boolean;
}

/**
 * Component resolution strategy configuration.
 */
export interface ComponentResolutionStrategy {
  /** Script merging strategy */
  script: ScriptMergeStrategy;
  /** Props merging strategy */
  props: PropMergeStrategy;
  /** Imports merging strategy */
  imports: ImportMergeStrategy;
}

/**
 * Component definition with common and framework-specific parts.
 */
export interface ComponentDefinition {
  /** Common properties */
  common?: Partial<ComponentProperties>;
  /** Framework-specific properties */
  framework?: Partial<ComponentProperties>;
}

/**
 * Render options for component name resolution.
 */
export interface RenderOptions {
  /** Framework being used */
  framework: string;
  /** Component metadata */
  component?: {
    name?: string;
    extensions?: Record<string, { name?: string }>;
    [key: string]: any;
  };
}

/**
 * Component property processor implementing advanced processing merge strategies.
 */
export class ComponentPropertyProcessor {
  private errorCollector: ErrorCollector;
  private strategy: ComponentResolutionStrategy;

  constructor(
    strategy: ComponentResolutionStrategy,
    errorCollector?: ErrorCollector
  ) {
    this.strategy = strategy;
    this.errorCollector = errorCollector || new ErrorCollector();
  }

  /**
   * Resolve component name with proper priority:
   * 1. renderOptions.component.name
   * 2. frameworkSpecificOverride (component.extensions.react.name)
   * 3. component.name (common)
   * 4. defaultName
   */
  resolveComponentName(
    options: RenderOptions,
    component: ComponentDefinition,
    defaultName = 'Component'
  ): string {
    // Priority 1: Explicit options override
    if (options.component?.name) {
      return options.component.name;
    }

    // Priority 2: Framework-specific override
    const frameworkSpecific =
      options.component?.extensions?.[options.framework]?.name;
    if (frameworkSpecific) {
      return frameworkSpecific;
    }

    // Priority 3: Common component name
    if (component.common?.name) {
      return component.common.name;
    }

    // Priority 4: Default
    return defaultName;
  }

  /**
   * Merge component properties using configured strategies.
   */
  mergeComponentProperties(
    component: ComponentDefinition,
    options: RenderOptions
  ): ComponentProperties {
    const common = component.common || {};
    const framework = component.framework || {};

    return {
      name: this.resolveComponentName(options, component),
      props: this.mergeProps(
        common.props || {},
        framework.props || {},
        this.strategy.props
      ),
      imports: this.mergeImports(
        common.imports || [],
        framework.imports || [],
        this.strategy.imports
      ),
      script: this.mergeScript(
        common.script || '',
        framework.script || '',
        this.strategy.script
      ),
    };
  }

  /**
   * Merge props using the configured strategy.
   */
  mergeProps(
    commonProps: Record<string, string>,
    frameworkProps: Record<string, string>,
    strategy: PropMergeStrategy
  ): Record<string, string> {
    switch (strategy.mode) {
      case 'merge':
        return this.mergePropsWithConflictResolution(
          commonProps,
          frameworkProps,
          strategy.conflictResolution
        );
      case 'override':
        return frameworkProps;
      case 'framework-first':
        return { ...commonProps, ...frameworkProps };
      case 'common-first':
        return { ...frameworkProps, ...commonProps };
      default:
        this.errorCollector.addWarning(
          `Unknown props merge mode: ${(strategy as any).mode}`,
          'component-processor',
          'props-merge'
        );
        return { ...commonProps, ...frameworkProps };
    }
  }

  /**
   * Merge props with conflict resolution.
   */
  private mergePropsWithConflictResolution(
    commonProps: Record<string, string>,
    frameworkProps: Record<string, string>,
    conflictResolution: PropMergeStrategy['conflictResolution']
  ): Record<string, string> {
    const result = { ...commonProps };
    const conflicts: string[] = [];

    for (const [key, value] of Object.entries(frameworkProps)) {
      if (key in commonProps && commonProps[key] !== value) {
        conflicts.push(key);
      }
      result[key] = value;
    }

    if (conflicts.length > 0) {
      const conflictMsg = `Props conflicts detected: ${conflicts.join(', ')}`;

      switch (conflictResolution) {
        case 'error':
          this.errorCollector.addSimpleError(
            conflictMsg,
            'component-processor'
          );
          break;
        case 'warn':
          this.errorCollector.addWarning(conflictMsg, 'component-processor');
          break;
        case 'framework-wins':
          // Already handled - framework props override
          this.errorCollector.addWarning(
            `${conflictMsg} (framework values used)`,
            'component-processor',
            'props-conflict'
          );
          break;
        case 'common-wins':
          // Restore common values for conflicts
          for (const key of conflicts) {
            result[key] = commonProps[key];
          }
          this.errorCollector.addWarning(
            `${conflictMsg} (common values used)`,
            'component-processor',
            'props-conflict'
          );
          break;
      }
    }

    return result;
  }

  /**
   * Merge script content using the configured strategy.
   */
  mergeScript(
    commonScript: string,
    frameworkScript: string,
    strategy: ScriptMergeStrategy
  ): string {
    const separator = strategy.separator ?? '\n\n';
    const comment = strategy.includeComments
      ? `\n// Merged: ${strategy.mode}\n`
      : '';

    switch (strategy.mode) {
      case 'prepend':
        return frameworkScript + separator + comment + commonScript;
      case 'append':
        return commonScript + separator + comment + frameworkScript;
      case 'replace':
        return frameworkScript;
      case 'merge':
        return this.intelligentMerge(commonScript, frameworkScript, comment);
      default:
        this.errorCollector.addWarning(
          `Unknown script merge mode: ${(strategy as any).mode}`,
          'component-processor',
          'script-merge'
        );
        return commonScript + separator + frameworkScript;
    }
  }

  /**
   * Intelligent merge of script content (simplified implementation).
   * Future enhancement: detect function declarations, variable assignments, imports.
   */
  private intelligentMerge(
    common: string,
    framework: string,
    comment: string
  ): string {
    if (!common.trim()) return framework;
    if (!framework.trim()) return common;

    // Basic intelligent merging implementation
    const commonLines = common.split('\n');
    const frameworkLines = framework.split('\n');

    // Detect and handle imports
    const commonImports = commonLines.filter((line) =>
      line.trim().startsWith('import')
    );
    const frameworkImports = frameworkLines.filter((line) =>
      line.trim().startsWith('import')
    );
    const commonCode = commonLines
      .filter((line) => !line.trim().startsWith('import'))
      .join('\n');
    const frameworkCode = frameworkLines
      .filter((line) => !line.trim().startsWith('import'))
      .join('\n');

    // Merge imports, removing duplicates
    const allImports = Array.from(
      new Set([...commonImports, ...frameworkImports])
    );

    // Detect function declarations and variable assignments
    const hasCommonFunctions =
      commonCode.includes('function ') ||
      commonCode.includes('const ') ||
      commonCode.includes('let ');
    const hasFrameworkFunctions =
      frameworkCode.includes('function ') ||
      frameworkCode.includes('const ') ||
      frameworkCode.includes('let ');

    // Build final result
    let result = '';

    if (allImports.length > 0) {
      result += allImports.join('\n') + '\n\n';
    }

    if (hasCommonFunctions && hasFrameworkFunctions) {
      result += commonCode.trim() + '\n\n' + comment + frameworkCode.trim();
    } else {
      result += common.trim() + '\n\n' + comment + framework.trim();
    }

    return result;
  }

  /**
   * Merge imports using the configured strategy.
   */
  mergeImports(
    commonImports: ImportDefinition[],
    frameworkImports: ImportDefinition[],
    strategy: ImportMergeStrategy
  ): ImportDefinition[] {
    switch (strategy.mode) {
      case 'override':
        return frameworkImports;
      case 'framework-first':
        return this.processImports(
          [...frameworkImports, ...commonImports],
          strategy
        );
      case 'common-first':
        return this.processImports(
          [...commonImports, ...frameworkImports],
          strategy
        );
      case 'merge':
      default:
        return this.processImports(
          [...commonImports, ...frameworkImports],
          strategy
        );
    }
  }

  /**
   * Process imports with deduplication and grouping.
   */
  private processImports(
    imports: ImportDefinition[],
    strategy: ImportMergeStrategy
  ): ImportDefinition[] {
    let result = imports;

    if (strategy.deduplication) {
      result = this.deduplicateImports(result);
    }

    if (strategy.grouping) {
      result = this.groupImports(result);
    }

    return result;
  }

  /**
   * Deduplicate imports by merging same-source imports.
   */
  private deduplicateImports(imports: ImportDefinition[]): ImportDefinition[] {
    const importMap = new Map<string, ImportDefinition>();

    for (const imp of imports) {
      const existing = importMap.get(imp.from);

      if (!existing) {
        importMap.set(imp.from, { ...imp });
        continue;
      }

      // Merge imports from same source
      const merged: ImportDefinition = {
        from: imp.from,
        typeOnly: existing.typeOnly || imp.typeOnly,
      };

      // Handle default imports (last one wins)
      if (imp.default) {
        merged.default = imp.default;
      } else if (existing.default) {
        merged.default = existing.default;
      }

      // Handle namespace imports (last one wins)
      if (imp.namespace) {
        merged.namespace = imp.namespace;
      } else if (existing.namespace) {
        merged.namespace = existing.namespace;
      }

      // Merge named imports
      const namedSet = new Set<string>();
      if (existing.named) {
        existing.named.forEach((name) => namedSet.add(name));
      }
      if (imp.named) {
        imp.named.forEach((name) => namedSet.add(name));
      }
      if (namedSet.size > 0) {
        merged.named = Array.from(namedSet).sort();
      }

      importMap.set(imp.from, merged);
    }

    return Array.from(importMap.values());
  }

  /**
   * Group imports by type and source.
   */
  private groupImports(imports: ImportDefinition[]): ImportDefinition[] {
    // Sort imports: type-only first, then by source
    return imports.sort((a, b) => {
      if (a.typeOnly && !b.typeOnly) return -1;
      if (!a.typeOnly && b.typeOnly) return 1;
      return a.from.localeCompare(b.from);
    });
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
 * Default merge strategies following advanced processing specifications.
 */
export const DEFAULT_MERGE_STRATEGIES: ComponentResolutionStrategy = {
  script: {
    mode: 'append',
    separator: '\n\n',
    includeComments: false,
  },
  props: {
    mode: 'merge',
    conflictResolution: 'warn',
  },
  imports: {
    mode: 'merge',
    deduplication: true,
    grouping: true,
  },
};
