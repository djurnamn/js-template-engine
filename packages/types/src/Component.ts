import type { TemplateNode } from './index';

export type ImportDefinition =
  | string
  | {
      from: string;
      default?: string;
      named?: string[];
    };

export interface Component {
  name?: string;
  props?: Record<string, string>;
  script?: string;
  imports?: ImportDefinition[];
  extensions?: Record<string, any>;
  typescript?: boolean;
  style?: string;
}

export interface RootHandlerContext {
  component?: Component;
  styleOutput?: string;
  [key: string]: any;
}

export interface ComponentOptions {
  name?: string;
  componentName?: string;
}

export function sanitizeComponentName(name: string): string {
  return name
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
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export function resolveComponentName(
  context: RootHandlerContext,
  options: ComponentOptions,
  defaultName = 'Component'
): string {
  const component = context.component;
  const rawName = component?.name || options.name || options.componentName || defaultName;
  return sanitizeComponentName(rawName);
}

export function resolveComponentProps(component?: Component): string {
  if (!component?.props || Object.keys(component.props).length === 0) return '';
  const entries = Object.entries(component.props)
    .map(([key, type]) => `    ${key}: ${type}`)
    .join(',\n');
  return `  props: {\n${entries}\n  },`;
}

export function resolveComponentImports(
  component?: Component,
  defaultImports: ImportDefinition[] = []
): string[] {
  const allImports = [...(component?.imports || []), ...defaultImports];
  const importMap = new Map<string, { named: Set<string>; default?: string }>();

  for (const imp of allImports) {
    if (typeof imp === 'string') {
      // Match both default and named imports
      const match = imp.match(/import\s+(?:([^,{]+)(?:,\s*{([^}]+)})?)?\s+from\s+['"]([^'"]+)['"]|import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/);
      if (!match) {
        // Keep non-matching imports as-is
        importMap.set(imp, { named: new Set() });
        continue;
      }

      const [, defaultImport, namedWithDefault, from, namedOnly, namedFrom] = match;
      const modulePath = from || namedFrom;
      const namedImports = (namedWithDefault || namedOnly || '').split(',').map(s => s.trim()).filter(Boolean);

      if (!importMap.has(modulePath)) {
        importMap.set(modulePath, { named: new Set() });
      }

      const module = importMap.get(modulePath)!;
      if (defaultImport) {
        module.default = defaultImport.trim();
      }
      namedImports.forEach(name => module.named.add(name));
    } else if (imp && typeof imp === 'object' && imp.from) {
      if (!importMap.has(imp.from)) {
        importMap.set(imp.from, { named: new Set() });
      }
      const module = importMap.get(imp.from)!;
      if (imp.default) {
        module.default = imp.default;
      }
      if (Array.isArray(imp.named)) {
        imp.named.forEach(name => module.named.add(name));
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
        parts.push(`{ ${Array.from(named).join(', ')} }`);
      }
      result.push(`import ${parts.join(', ')} from "${from}"`);
    } else {
      // Keep non-matching imports as-is
      result.push(from);
    }
  }

  return result;
}
