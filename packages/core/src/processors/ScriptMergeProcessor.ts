/**
 * Script Merge Processor for advanced processing: Template Properties Abstraction
 * 
 * Advanced script merging with intelligent detection and conflict resolution.
 * Supports the date/dayjs + framework-specific example from the advanced processing plan.
 */

import { ErrorCollector } from '../metadata';
import type { ScriptMergeStrategy } from './ComponentPropertyProcessor';

/**
 * Detected script element types for intelligent merging.
 */
export interface ScriptElement {
  /** Element type */
  type: 'import' | 'variable' | 'function' | 'export' | 'expression' | 'comment';
  /** Element name/identifier */
  name?: string;
  /** Full content */
  content: string;
  /** Start position in original script */
  start: number;
  /** End position in original script */
  end: number;
  /** Dependencies (for ordering) */
  dependencies?: string[];
}

/**
 * Script analysis result.
 */
export interface ScriptAnalysis {
  /** Original script content */
  original: string;
  /** Detected elements */
  elements: ScriptElement[];
  /** Detected imports */
  imports: string[];
  /** Detected exports */
  exports: string[];
  /** Detected variables */
  variables: string[];
  /** Detected functions */
  functions: string[];
}

/**
 * Script merge conflict information.
 */
export interface ScriptConflict {
  /** Conflict type */
  type: 'duplicate' | 'naming' | 'dependency';
  /** Element name causing conflict */
  element: string;
  /** Common script value */
  commonValue: string;
  /** Framework script value */
  frameworkValue: string;
  /** Suggested resolution */
  suggestion?: string;
}

/**
 * Script merge result.
 */
export interface ScriptMergeResult {
  /** Merged script content */
  content: string;
  /** Detected conflicts */
  conflicts: ScriptConflict[];
  /** Applied resolution strategy */
  strategy: ScriptMergeStrategy;
  /** Additional metadata */
  metadata: {
    /** Number of elements merged */
    elementsCount: number;
    /** Whether intelligent merge was used */
    intelligentMerge: boolean;
  };
}

/**
 * Advanced script processor with intelligent merging capabilities.
 */
export class ScriptMergeProcessor {
  private errorCollector: ErrorCollector;

  constructor(errorCollector?: ErrorCollector) {
    this.errorCollector = errorCollector || new ErrorCollector();
  }

  /**
   * Merge scripts using the specified strategy with conflict detection.
   */
  mergeScripts(
    commonScript: string,
    frameworkScript: string,
    strategy: ScriptMergeStrategy
  ): ScriptMergeResult {
    const conflicts: ScriptConflict[] = [];
    let content: string;
    let metadata = {
      elementsCount: 0,
      intelligentMerge: false
    };

    switch (strategy.mode) {
      case 'prepend':
        content = this.prependMerge(frameworkScript, commonScript, strategy);
        break;
      case 'append':
        content = this.appendMerge(commonScript, frameworkScript, strategy);
        break;
      case 'replace':
        content = frameworkScript;
        break;
      case 'merge':
        const mergeResult = this.intelligentMerge(commonScript, frameworkScript, strategy);
        content = mergeResult.content;
        conflicts.push(...mergeResult.conflicts);
        metadata = mergeResult.metadata;
        break;
      default:
        this.errorCollector.addWarning(
          `Unknown script merge mode: ${(strategy as any).mode}`,
          'script-processor',
          'merge'
        );
        content = this.appendMerge(commonScript, frameworkScript, strategy);
    }

    return {
      content,
      conflicts,
      strategy,
      metadata
    };
  }

  /**
   * Prepend framework script before common script.
   */
  private prependMerge(
    frameworkScript: string,
    commonScript: string,
    strategy: ScriptMergeStrategy
  ): string {
    const separator = strategy.separator ?? '\n\n';
    const comment = strategy.includeComments ? `\n// Merged: ${strategy.mode}\n` : '';

    if (!frameworkScript.trim()) return commonScript;
    if (!commonScript.trim()) return frameworkScript;

    return frameworkScript + separator + comment + commonScript;
  }

  /**
   * Append framework script after common script.
   */
  private appendMerge(
    commonScript: string,
    frameworkScript: string,
    strategy: ScriptMergeStrategy
  ): string {
    const separator = strategy.separator ?? '\n\n';
    const comment = strategy.includeComments ? `\n// Merged: ${strategy.mode}\n` : '';

    if (!commonScript.trim()) return frameworkScript;
    if (!frameworkScript.trim()) return commonScript;

    return commonScript + separator + comment + frameworkScript;
  }

  /**
   * Intelligent merge with conflict detection and resolution.
   */
  private intelligentMerge(
    commonScript: string,
    frameworkScript: string,
    strategy: ScriptMergeStrategy
  ): ScriptMergeResult {
    const conflicts: ScriptConflict[] = [];
    
    if (!commonScript.trim()) {
      return {
        content: frameworkScript,
        conflicts: [],
        strategy,
        metadata: { elementsCount: 0, intelligentMerge: true }
      };
    }
    
    if (!frameworkScript.trim()) {
      return {
        content: commonScript,
        conflicts: [],
        strategy,
        metadata: { elementsCount: 0, intelligentMerge: true }
      };
    }

    // Analyze both scripts
    const commonAnalysis = this.analyzeScript(commonScript);
    const frameworkAnalysis = this.analyzeScript(frameworkScript);

    // Detect conflicts
    const detectedConflicts = this.detectConflicts(commonAnalysis, frameworkAnalysis);
    conflicts.push(...detectedConflicts);

    // Merge with conflict resolution
    const mergedContent = this.mergeAnalyzedScripts(
      commonAnalysis,
      frameworkAnalysis,
      conflicts,
      strategy
    );

    const totalElements = commonAnalysis.elements.length + frameworkAnalysis.elements.length;

    return {
      content: mergedContent,
      conflicts,
      strategy,
      metadata: {
        elementsCount: totalElements,
        intelligentMerge: true
      }
    };
  }

  /**
   * Analyze script content to extract elements.
   */
  analyzeScript(script: string): ScriptAnalysis {
    const elements: ScriptElement[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const variables: string[] = [];
    const functions: string[] = [];

    const lines = script.split('\n');
    let currentPos = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const start = currentPos;
      const end = currentPos + lines[i].length;

      if (line.startsWith('import ')) {
        const element = this.parseImportLine(line, start, end);
        elements.push(element);
        if (element.name) imports.push(element.name);
      } else if (line.startsWith('export ')) {
        const element = this.parseExportLine(line, start, end);
        elements.push(element);
        if (element.name) exports.push(element.name);
      } else if (this.isVariableDeclaration(line)) {
        const element = this.parseVariableLine(line, start, end);
        elements.push(element);
        if (element.name) variables.push(element.name);
      } else if (this.isFunctionDeclaration(line)) {
        const element = this.parseFunctionLine(line, start, end);
        elements.push(element);
        if (element.name) functions.push(element.name);
      } else if (line.startsWith('//') || line.startsWith('/*')) {
        elements.push({
          type: 'comment',
          content: line,
          start,
          end
        });
      } else if (line.trim()) {
        elements.push({
          type: 'expression',
          content: line,
          start,
          end
        });
      }

      currentPos = end + 1; // +1 for newline
    }

    return {
      original: script,
      elements,
      imports,
      exports,
      variables,
      functions
    };
  }

  /**
   * Parse import line.
   */
  private parseImportLine(line: string, start: number, end: number): ScriptElement {
    // Extract module name from import
    const match = line.match(/from\s+['"`]([^'"`]+)['"`]/);
    const name = match ? match[1] : undefined;

    return {
      type: 'import',
      name,
      content: line,
      start,
      end
    };
  }

  /**
   * Parse export line.
   */
  private parseExportLine(line: string, start: number, end: number): ScriptElement {
    // Extract export name
    const match = line.match(/export\s+(?:default\s+)?(?:function\s+)?(\w+)/);
    const name = match ? match[1] : undefined;

    return {
      type: 'export',
      name,
      content: line,
      start,
      end
    };
  }

  /**
   * Parse variable declaration line.
   */
  private parseVariableLine(line: string, start: number, end: number): ScriptElement {
    // Extract variable name
    const match = line.match(/(?:const|let|var)\s+(\w+)/);
    const name = match ? match[1] : undefined;

    return {
      type: 'variable',
      name,
      content: line,
      start,
      end
    };
  }

  /**
   * Parse function declaration line.
   */
  private parseFunctionLine(line: string, start: number, end: number): ScriptElement {
    // Extract function name
    const match = line.match(/function\s+(\w+)/);
    const name = match ? match[1] : undefined;

    return {
      type: 'function',
      name,
      content: line,
      start,
      end
    };
  }

  /**
   * Check if line is a variable declaration.
   */
  private isVariableDeclaration(line: string): boolean {
    return /^\s*(?:const|let|var)\s+\w+/.test(line);
  }

  /**
   * Check if line is a function declaration.
   */
  private isFunctionDeclaration(line: string): boolean {
    return /^\s*function\s+\w+/.test(line);
  }

  /**
   * Detect conflicts between analyzed scripts.
   */
  private detectConflicts(
    commonAnalysis: ScriptAnalysis,
    frameworkAnalysis: ScriptAnalysis
  ): ScriptConflict[] {
    const conflicts: ScriptConflict[] = [];

    // Check for duplicate imports
    for (const commonImport of commonAnalysis.imports) {
      if (frameworkAnalysis.imports.includes(commonImport)) {
        conflicts.push({
          type: 'duplicate',
          element: commonImport,
          commonValue: 'present',
          frameworkValue: 'present',
          suggestion: 'Remove duplicate import'
        });
      }
    }

    // Check for variable conflicts
    for (const commonVar of commonAnalysis.variables) {
      if (frameworkAnalysis.variables.includes(commonVar)) {
        conflicts.push({
          type: 'naming',
          element: commonVar,
          commonValue: 'defined',
          frameworkValue: 'defined',
          suggestion: `Rename variable ${commonVar} to avoid conflict`
        });
      }
    }

    // Check for function conflicts
    for (const commonFunc of commonAnalysis.functions) {
      if (frameworkAnalysis.functions.includes(commonFunc)) {
        conflicts.push({
          type: 'naming',
          element: commonFunc,
          commonValue: 'defined',
          frameworkValue: 'defined',
          suggestion: `Rename function ${commonFunc} to avoid conflict`
        });
      }
    }

    return conflicts;
  }

  /**
   * Merge analyzed scripts with conflict resolution.
   */
  private mergeAnalyzedScripts(
    commonAnalysis: ScriptAnalysis,
    frameworkAnalysis: ScriptAnalysis,
    conflicts: ScriptConflict[],
    strategy: ScriptMergeStrategy
  ): string {
    const sections: string[] = [];
    const separator = strategy.separator ?? '\n\n';

    // Handle imports first (deduplicate)
    const allImports = this.mergeImports(commonAnalysis.elements, frameworkAnalysis.elements);
    if (allImports.length > 0) {
      sections.push(allImports.join('\n'));
    }

    // Add merge comment if enabled
    if (strategy.includeComments) {
      sections.push(`// Merged: ${strategy.mode} (intelligent)`);
    }

    // Handle variables and functions
    const commonNonImports = commonAnalysis.elements.filter(el => el.type !== 'import');
    const frameworkNonImports = frameworkAnalysis.elements.filter(el => el.type !== 'import');

    if (commonNonImports.length > 0) {
      sections.push(commonNonImports.map(el => el.content).join('\n'));
    }

    if (frameworkNonImports.length > 0) {
      sections.push(frameworkNonImports.map(el => el.content).join('\n'));
    }

    return sections.join(separator);
  }

  /**
   * Merge import elements with deduplication.
   */
  private mergeImports(
    commonElements: ScriptElement[],
    frameworkElements: ScriptElement[]
  ): string[] {
    const imports = new Set<string>();
    
    // Add common imports
    commonElements
      .filter(el => el.type === 'import')
      .forEach(el => imports.add(el.content));

    // Add framework imports (will deduplicate automatically)
    frameworkElements
      .filter(el => el.type === 'import')
      .forEach(el => imports.add(el.content));

    return Array.from(imports);
  }

  /**
   * Create example showing date/dayjs + framework merging.
   */
  createDateExample(): {
    common: string;
    react: string;
    merged: ScriptMergeResult;
  } {
    const common = `// Common date logic
import dayjs from 'dayjs';

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD');
};

const twoDaysFromDate = (date) => {
  return dayjs(date).add(2, 'day').toDate();
};`;

    const react = `// React-specific logic
import React, { useState, useEffect } from 'react';

const useDate = (initialDate) => {
  const [date, setDate] = useState(initialDate);
  
  useEffect(() => {
    console.log('Date changed:', date);
  }, [date]);
  
  return [date, setDate];
};

const onDateChange = (newDate) => {
  setDate(newDate);
};`;

    const strategy: ScriptMergeStrategy = {
      mode: 'merge',
      separator: '\n\n',
      includeComments: true
    };

    const merged = this.mergeScripts(common, react, strategy);

    return { common, react, merged };
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