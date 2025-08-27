/**
 * Import Processor for advanced processing: Template Properties Abstraction
 *
 * Dedicated processor for handling import merging, deduplication, and organization.
 * Supports both object-based and string-based import definitions.
 */

import { ErrorCollector } from '../metadata';
import type {
  ImportDefinition,
  ImportMergeStrategy,
} from './ComponentPropertyProcessor';

/**
 * String-based import representation for parsing.
 */
export type ImportString = string;

/**
 * Union type for all import formats.
 */
export type ImportInput = ImportDefinition | ImportString;

/**
 * Import parsing result.
 */
export interface ParsedImport {
  /** Original import string */
  original: string;
  /** Parsed import definition */
  definition: ImportDefinition;
  /** Parse errors if any */
  errors?: string[];
}

/**
 * Import processing options.
 */
export interface ImportProcessingOptions {
  /** Merge strategy */
  strategy: ImportMergeStrategy;
  /** Custom import sorting */
  customSort?: (a: ImportDefinition, b: ImportDefinition) => number;
  /** Validate imports during processing */
  validateImports?: boolean;
}

/**
 * Import validation result.
 */
export interface ImportValidationResult {
  /** Whether import is valid */
  isValid: boolean;
  /** Validation warnings */
  warnings: string[];
  /** Validation errors */
  errors: string[];
}

/**
 * Dedicated import processor implementing advanced import management.
 */
export class ImportProcessor {
  private errorCollector: ErrorCollector;

  constructor(errorCollector?: ErrorCollector) {
    this.errorCollector = errorCollector || new ErrorCollector();
  }

  /**
   * Merge imports from multiple sources using the specified strategy.
   */
  mergeImports(
    commonImports: ImportInput[],
    frameworkImports: ImportInput[],
    options: ImportProcessingOptions
  ): ImportDefinition[] {
    const { strategy } = options;

    // Parse all imports to ImportDefinition format
    const parsedCommon = this.parseImports(commonImports);
    const parsedFramework = this.parseImports(frameworkImports);

    // Apply merge strategy
    let combined: ImportDefinition[];
    switch (strategy.mode) {
      case 'override':
        combined = parsedFramework;
        break;
      case 'framework-first':
        combined = [...parsedFramework, ...parsedCommon];
        break;
      case 'common-first':
        combined = [...parsedCommon, ...parsedFramework];
        break;
      case 'merge':
      default:
        combined = [...parsedCommon, ...parsedFramework];
        break;
    }

    return this.processImports(combined, options);
  }

  /**
   * Process imports with deduplication, grouping, and validation.
   */
  processImports(
    imports: ImportDefinition[],
    options: ImportProcessingOptions
  ): ImportDefinition[] {
    const { strategy } = options;
    let result = [...imports];

    // Validate imports if requested
    if (options.validateImports) {
      result = this.validateAndFilterImports(result);
    }

    // Deduplicate if enabled
    if (strategy.deduplication) {
      result = this.deduplicateImports(result);
    }

    // Group and sort if enabled
    if (strategy.grouping) {
      result = this.groupAndSortImports(result, options.customSort);
    }

    return result;
  }

  /**
   * Parse import inputs into ImportDefinition format.
   */
  parseImports(imports: ImportInput[]): ImportDefinition[] {
    const parsed: ImportDefinition[] = [];

    for (const imp of imports) {
      if (typeof imp === 'string') {
        const parseResult = this.parseImportString(imp);
        if (parseResult.errors?.length) {
          parseResult.errors.forEach((error) => {
            this.errorCollector.addWarning(
              `Import parse error: ${error}`,
              'import-processor',
              'parse'
            );
          });
        }
        parsed.push(parseResult.definition);
      } else {
        parsed.push(imp);
      }
    }

    return parsed;
  }

  /**
   * Parse import string into ImportDefinition.
   */
  parseImportString(importStr: string): ParsedImport {
    const errors: string[] = [];
    const trimmed = importStr.trim();

    // Handle basic import patterns
    try {
      // Remove import keyword and semicolon
      let cleaned = trimmed
        .replace(/^import\s+/, '')
        .replace(/;$/, '')
        .trim();

      // Extract type-only imports
      const typeOnly = cleaned.startsWith('type ');
      if (typeOnly) {
        cleaned = cleaned.replace(/^type\s+/, '').trim();
      }

      // Extract from clause
      const fromMatch = cleaned.match(/\s+from\s+['"`]([^'"`]+)['"`]/);
      if (!fromMatch) {
        errors.push('Missing or invalid from clause');
        return {
          original: importStr,
          definition: { from: '', typeOnly },
          errors,
        };
      }

      const from = fromMatch[1];
      const importPart = cleaned.replace(fromMatch[0], '').trim();

      const definition: ImportDefinition = { from, typeOnly };

      // Parse import patterns
      if (importPart.includes('* as ')) {
        // Namespace import: import * as name from 'module'
        const namespaceMatch = importPart.match(/\*\s+as\s+(\w+)/);
        if (namespaceMatch) {
          definition.namespace = namespaceMatch[1];
        }
      } else if (importPart.includes('{') && importPart.includes('}')) {
        // Named imports: import { a, b, c } from 'module'
        // or mixed: import default, { a, b } from 'module'
        const braceMatch = importPart.match(/\{([^}]+)\}/);
        if (braceMatch) {
          const namedImports = braceMatch[1]
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
          definition.named = namedImports;

          // Check for default import before braces
          const beforeBraces = importPart.split('{')[0].trim();
          if (beforeBraces && beforeBraces !== '') {
            const defaultMatch = beforeBraces.match(/(\w+),?\s*$/);
            if (defaultMatch) {
              definition.default = defaultMatch[1];
            }
          }
        }
      } else if (importPart.trim()) {
        // Default import: import name from 'module'
        const defaultMatch = importPart.match(/^(\w+)$/);
        if (defaultMatch) {
          definition.default = defaultMatch[1];
        }
      }

      return {
        original: importStr,
        definition,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push(
        `Parse error: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        original: importStr,
        definition: { from: '', typeOnly: false },
        errors,
      };
    }
  }

  /**
   * Deduplicate imports by merging imports from the same source.
   */
  deduplicateImports(imports: ImportDefinition[]): ImportDefinition[] {
    const importMap = new Map<string, ImportDefinition>();

    for (const imp of imports) {
      const key = `${imp.from}:${imp.typeOnly ? 'type' : 'value'}`;
      const existing = importMap.get(key);

      if (!existing) {
        importMap.set(key, { ...imp });
        continue;
      }

      // Merge imports from same source and type
      const merged: ImportDefinition = {
        from: imp.from,
        typeOnly: imp.typeOnly,
      };

      // Handle default imports (later definition wins)
      merged.default = imp.default || existing.default;

      // Handle namespace imports (later definition wins)
      merged.namespace = imp.namespace || existing.namespace;

      // Merge named imports
      const namedSet = new Set<string>();
      existing.named?.forEach((name) => namedSet.add(name));
      imp.named?.forEach((name) => namedSet.add(name));

      if (namedSet.size > 0) {
        merged.named = Array.from(namedSet).sort();
      }

      importMap.set(key, merged);
    }

    return Array.from(importMap.values());
  }

  /**
   * Group and sort imports by type and source.
   */
  groupAndSortImports(
    imports: ImportDefinition[],
    customSort?: (a: ImportDefinition, b: ImportDefinition) => number
  ): ImportDefinition[] {
    if (customSort) {
      return [...imports].sort(customSort);
    }

    // Default sorting: type-only first, then by source alphabetically
    return [...imports].sort((a, b) => {
      // Type-only imports first
      if (a.typeOnly && !b.typeOnly) return -1;
      if (!a.typeOnly && b.typeOnly) return 1;

      // Then sort by source
      return a.from.localeCompare(b.from);
    });
  }

  /**
   * Validate imports and filter out invalid ones.
   */
  validateAndFilterImports(imports: ImportDefinition[]): ImportDefinition[] {
    const valid: ImportDefinition[] = [];

    for (const imp of imports) {
      const validation = this.validateImport(imp);

      if (validation.errors.length > 0) {
        validation.errors.forEach((error) => {
          this.errorCollector.addSimpleError(
            `Invalid import from '${imp.from}': ${error}`,
            'import-processor'
          );
        });
        continue; // Skip invalid imports
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach((warning) => {
          this.errorCollector.addWarning(
            `Import warning for '${imp.from}': ${warning}`,
            'import-processor',
            'validation'
          );
        });
      }

      valid.push(imp);
    }

    return valid;
  }

  /**
   * Validate a single import definition.
   */
  validateImport(imp: ImportDefinition): ImportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!imp.from || typeof imp.from !== 'string') {
      errors.push('Missing or invalid from field');
    }

    // Check for empty imports
    const hasDefault = imp.default && imp.default.trim();
    const hasNamed = imp.named && imp.named.length > 0;
    const hasNamespace = imp.namespace && imp.namespace.trim();

    if (!hasDefault && !hasNamed && !hasNamespace) {
      errors.push('Import has no default, named, or namespace imports');
    }

    // Check for conflicting patterns
    if (hasNamespace && (hasDefault || hasNamed)) {
      warnings.push('Namespace import combined with default/named imports');
    }

    // Validate import names
    if (imp.default && !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(imp.default)) {
      errors.push(`Invalid default import name: ${imp.default}`);
    }

    if (imp.namespace && !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(imp.namespace)) {
      errors.push(`Invalid namespace import name: ${imp.namespace}`);
    }

    if (imp.named) {
      for (const named of imp.named) {
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(named)) {
          errors.push(`Invalid named import: ${named}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate import strings from ImportDefinition objects.
   */
  generateImportStrings(imports: ImportDefinition[]): string[] {
    return imports.map((imp) => this.generateImportString(imp));
  }

  /**
   * Generate import string from ImportDefinition.
   */
  generateImportString(imp: ImportDefinition): string {
    const parts: string[] = ['import'];

    if (imp.typeOnly) {
      parts.push('type');
    }

    const importParts: string[] = [];

    // Default import
    if (imp.default) {
      importParts.push(imp.default);
    }

    // Named imports
    if (imp.named && imp.named.length > 0) {
      const namedStr = `{ ${imp.named.join(', ')} }`;
      importParts.push(namedStr);
    }

    // Namespace import
    if (imp.namespace) {
      importParts.push(`* as ${imp.namespace}`);
    }

    if (importParts.length > 0) {
      parts.push(importParts.join(', '));
    }

    parts.push('from');
    parts.push(`'${imp.from}'`);

    return parts.join(' ') + ';';
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
 * Default import processing options.
 */
export const DEFAULT_IMPORT_OPTIONS: ImportProcessingOptions = {
  strategy: {
    mode: 'merge',
    deduplication: true,
    grouping: true,
  },
  validateImports: true,
};
