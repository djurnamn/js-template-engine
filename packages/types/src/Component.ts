import type { TemplateNode } from './index';

/**
 * Type definition for import statements.
 * Can be a simple string or a structured import definition.
 */
export type ImportDefinition =
  | string
  | {
      /** The module path to import from. */
      from: string;
      /** The default export to import. */
      default?: string;
      /** Array of named exports to import. */
      named?: string[];
    };

/**
 * Interface defining a component's metadata and configuration.
 * Contains information about the component's structure, props, and behavior.
 */
export interface Component {
  /** The name of the component. */
  name?: string;
  /** TypeScript-style prop type definitions. */
  props?: Record<string, string>;
  /** JavaScript/TypeScript script content for the component. */
  script?: string;
  /** Import statements for the component. */
  imports?: ImportDefinition[];
  /** Extension-specific data for the component. */
  extensions?: Record<string, any>;
  /** CSS/SCSS style content for the component. */
  style?: string;
}

/**
 * Interface for component-specific options.
 * Controls how components are processed and named.
 */
export interface ComponentOptions {
  /** The name of the component. */
  name?: string;
  /** Alternative name for the component. */
  componentName?: string;
}

/**
 * Sanitizes a component name to ensure it's valid for use in code.
 * Converts invalid characters to valid PascalCase format.
 * @param name - The raw component name to sanitize.
 * @returns A sanitized PascalCase component name.
 */
export function sanitizeComponentName(name: string): string {
  return (
    name
      // Replace invalid characters with spaces
      .replace(/[^a-zA-Z0-9\s-]/g, ' ')
      // Replace multiple spaces with a single space
      .replace(/\s+/g, ' ')
      // Replace hyphens with spaces
      .replace(/-/g, ' ')
      // Trim spaces
      .trim()
      // Convert to PascalCase, preserving existing uppercase letters
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  );
}

/**
 * Resolves the final component name from various sources.
 * Uses a priority order: component.name > options.name > options.componentName > defaultName.
 * @param context - The root handler context containing component information.
 * @param options - The component options.
 * @param defaultName - The default name to use if no other name is provided.
 * @returns The resolved and sanitized component name.
 */
export function resolveComponentName(
  component: Component | undefined,
  options: { name?: string; componentName?: string },
  defaultName = 'Component'
): string {
  const rawName =
    component?.name || options.name || options.componentName || defaultName;
  return sanitizeComponentName(rawName);
}

/**
 * Resolves component props into a formatted string representation.
 * @param component - The component to extract props from.
 * @returns A formatted string representation of the component props, or empty string if no props.
 */
export function resolveComponentProps(component?: Component): string {
  if (!component?.props || Object.keys(component.props).length === 0) return '';
  const entries = Object.entries(component.props)
    .map(([key, type]) => `    ${key}: ${type}`)
    .join(',\n');
  return `  props: {\n${entries}\n  },`;
}

/**
 * Resolves and merges component imports with default imports.
 * Handles both string-based and structured import definitions.
 * @param component - The component to extract imports from.
 * @param defaultImports - Default imports to include alongside component imports.
 * @returns An array of formatted import statements.
 */
export function resolveComponentImports(
  component?: Component,
  defaultImports: ImportDefinition[] = []
): string[] {
  const allImports = [...(component?.imports || []), ...defaultImports];
  const importMap = new Map<string, { named: Set<string>; default?: string }>();

  for (const imp of allImports) {
    if (typeof imp === 'string') {
      // Match both default and named imports
      const match = imp.match(
        /import\s+(?:([^,{]+)(?:,\s*{([^}]+)})?)?\s+from\s+['"]([^'"]+)['"]|import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/
      );
      if (!match) {
        // Keep non-matching imports as-is
        importMap.set(imp, { named: new Set() });
        continue;
      }

      const [, defaultImport, namedWithDefault, from, namedOnly, namedFrom] =
        match;
      const modulePath = from || namedFrom;
      const namedImports = (namedWithDefault || namedOnly || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (!importMap.has(modulePath)) {
        importMap.set(modulePath, { named: new Set() });
      }

      const module = importMap.get(modulePath)!;
      if (defaultImport) {
        module.default = defaultImport.trim();
      }
      namedImports.forEach((name) => module.named.add(name));
    } else if (imp && typeof imp === 'object' && imp.from) {
      if (!importMap.has(imp.from)) {
        importMap.set(imp.from, { named: new Set() });
      }
      const module = importMap.get(imp.from)!;
      if (imp.default) {
        module.default = imp.default;
      }
      if (Array.isArray(imp.named)) {
        imp.named.forEach((name) => module.named.add(name));
      }
    }
  }

  // Reconstruct merged imports
  const result: string[] = [];
  for (const [from, { named, default: defaultImport }] of importMap.entries()) {
    if (named.size || defaultImport) {
      const parts: string[] = [];
      if (defaultImport) {
        parts.push(defaultImport);
      }
      if (named.size) {
        // Sort named imports alphabetically
        const sortedNamed = Array.from(named).sort();
        parts.push(`{ ${sortedNamed.join(', ')} }`);
      }
      result.push(`import ${parts.join(', ')} from "${from}";`);
    } else {
      // Keep non-matching imports as-is, but ensure they end with semicolon
      result.push(from.endsWith(';') ? from : `${from};`);
    }
  }

  return result;
}
