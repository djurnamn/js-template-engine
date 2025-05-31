import type { BaseExtensionOptions } from '@js-template-engine/types';
import type { ComponentOptions } from '@js-template-engine/types/src/Component';
import { createLogger } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  RootHandlerContext as BaseRootHandlerContext,
} from '@js-template-engine/types';

import {
  resolveComponentName,
  resolveComponentProps,
  resolveComponentImports
} from '@js-template-engine/types';

const logger = createLogger(false, 'vue-extension');

export interface VueExtensionOptions extends BaseExtensionOptions, ComponentOptions {
  fileExtension?: '.vue';
  scriptLang?: 'js' | 'ts';
  styleLang?: 'css' | 'scss' | 'less' | 'stylus';
  scoped?: boolean;
  scriptContent?: string;
  composition?: boolean;
  setup?: boolean;
  attributeFormatter?: (attr: string, val: string | number | boolean, isExpression?: boolean) => string;
}

export interface VueNodeExtensions {
  tag?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, any>;
  directives?: Record<string, any>;
  events?: Record<string, string>;
  bindAttributes?: Record<string, any>;
  eventHandlers?: Record<string, string>;
  slotProps?: Record<string, any>;
}

interface PropDefinition {
  name: string;
  type: Function;
}

interface VueRootHandlerContext extends BaseRootHandlerContext {
  props?: PropDefinition[];
}

export interface VueRootHandlerOptions extends Omit<VueExtensionOptions, 'scriptLang' | 'styleLang'> {
  componentName?: string;
  scriptContent?: string;
  styleOutput?: string;
  isSetup?: boolean;
  isComposition?: boolean;
  scriptLang?: 'js' | 'ts';
  styleLang?: 'css' | 'scss' | 'less' | 'stylus';
  isScoped?: boolean;
  imports?: Array<{ from: string; imports: string[] }>;
  propsInterface?: string;
}

export class VueExtension implements Extension<VueExtensionOptions, VueNodeExtensions> {
  key = 'vue';
  isRenderer = true;

  options: VueExtensionOptions = {
    fileExtension: '.vue',
    attributeFormatter: (attr: string, val: string | number | boolean, isExpression?: boolean) =>
      ` ${attr}="${val}"`
  };

  attributeFormatter(attr: string, val: string | number | boolean, isExpression?: boolean): string {
    return ` ${attr}="${val}"`;
  }

  sanitizeAttributeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_:@\-]/g, '-');
  }

  sanitizeAttributeValue(value: any): string {
    if (typeof value !== 'string') return String(value);
    // Don't sanitize if it's an object literal expression
    if (value.trim().startsWith('{') && value.trim().endsWith('}')) {
      return value;
    }
    return value
      .replace(/[^a-zA-Z0-9_\-]/g, '-')   // remove special chars
      .replace(/-+/g, '-')                // collapse multiple dashes
      .replace(/^-+|-+$/g, '')            // trim leading/trailing dashes
      .replace(/"/g, '&quot;')           // escape quotes
      .replace(/<script.*?>.*?<\/script>/gi, '')
      .trim();
  }

  private dedupeImports(imports: Array<{ from: string; imports: string[] }>): string[] {
    const map = new Map<string, Set<string>>();
    for (const imp of imports) {
      if (!imp || typeof imp.from !== 'string' || !Array.isArray(imp.imports)) continue;
      if (!map.has(imp.from)) map.set(imp.from, new Set());
      for (const i of imp.imports) map.get(imp.from)!.add(i);
    }
    return Array.from(map.entries())
      .map(([from, symbols]) => `import { ${Array.from(symbols).sort().join(', ')} } from "${from}";`);
  }

  nodeHandler(node: TemplateNode): TemplateNode {
    if (!node.extensions?.vue) return node;

    const ext = node.extensions.vue;
    const updatedNode = { ...node, attributes: { ...node.attributes } };

    // --- Merging static and dynamic class/style bindings ---
    // Handle class
    let staticClass = ext.attributes?.class || updatedNode.attributes.class;
    let dynamicClass = ext.bindAttributes?.[":class"] || ext.bindAttributes?.["class"] || ext.bindAttributes?.["v-bind:class"];
    
    // Handle class bindings
    if (staticClass !== undefined && dynamicClass !== undefined) {
      // Emit both static and dynamic classes
      updatedNode.attributes.class = staticClass;
      updatedNode.attributes[":class"] = dynamicClass;
    } else if (staticClass !== undefined) {
      // Only static class
      updatedNode.attributes.class = staticClass;
      delete updatedNode.attributes[":class"];
    } else if (dynamicClass !== undefined) {
      // Only dynamic class
      updatedNode.attributes[":class"] = dynamicClass;
      delete updatedNode.attributes.class;
    } else {
      // No classes
      delete updatedNode.attributes.class;
      delete updatedNode.attributes[":class"];
    }
    
    // Remove handled class keys from bindAttributes
    if (ext.bindAttributes) {
      delete ext.bindAttributes[":class"];
      delete ext.bindAttributes["class"];
      delete ext.bindAttributes["v-bind:class"];
    }

    // Handle style
    let staticStyle = ext.attributes?.style || updatedNode.attributes.style;
    let dynamicStyle = ext.bindAttributes?.[":style"] || ext.bindAttributes?.["style"] || ext.bindAttributes?.["v-bind:style"];
    
    // Handle style bindings
    if (staticStyle !== undefined && dynamicStyle !== undefined) {
      // Emit both static and dynamic styles
      updatedNode.attributes.style = staticStyle;
      updatedNode.attributes[":style"] = dynamicStyle;
    } else if (staticStyle !== undefined) {
      // Only static style
      updatedNode.attributes.style = staticStyle;
      delete updatedNode.attributes[":style"];
    } else if (dynamicStyle !== undefined) {
      // Only dynamic style
      updatedNode.attributes[":style"] = dynamicStyle;
      delete updatedNode.attributes.style;
    } else {
      // No styles
      delete updatedNode.attributes.style;
      delete updatedNode.attributes[":style"];
    }
    
    // Remove handled style keys from bindAttributes
    if (ext.bindAttributes) {
      delete ext.bindAttributes[":style"];
      delete ext.bindAttributes["style"];
      delete ext.bindAttributes["v-bind:style"];
    }

    // --- Other static attributes ---
    if (ext.attributes) {
      for (const [key, value] of Object.entries(ext.attributes)) {
        if (key === 'class' || key === 'style') continue; // already handled
        const safeKey = this.sanitizeAttributeName(key);
        const safeVal = this.sanitizeAttributeValue(value);
        updatedNode.attributes[safeKey] = safeVal;
      }
    }

    // --- Dynamic bindings (other than class/style) ---
    if (ext.bindAttributes) {
      for (const [key, value] of Object.entries(ext.bindAttributes)) {
        const attrName = key.startsWith('v-bind:') ? ':' + key.slice(7) : (key.startsWith(':') ? key : ':' + key);
        updatedNode.attributes[attrName] = String(value);
      }
    }

    // --- Directives ---
    if (ext.directives) {
      for (const [key, value] of Object.entries(ext.directives)) {
        updatedNode.attributes[`v-${key}`] = String(value);
      }
    }

    // --- Event handlers ---
    if (ext.eventHandlers) {
      for (const [key, value] of Object.entries(ext.eventHandlers)) {
        const safeEvent = key.replace(/[^a-zA-Z0-9_\-]/g, '');
        updatedNode.attributes[`@${safeEvent}`] = String(value);
      }
    }

    // --- Slot props ---
    if (ext.slotProps) {
      for (const [key, value] of Object.entries(ext.slotProps)) {
        updatedNode.attributes[`:${key}`] = String(value);
      }
    }

    // --- Sanitize only static attributes (not Vue-specific bindings) ---
    for (const [key, value] of Object.entries(updatedNode.attributes)) {
      const isDynamic = key.startsWith(':') || key.startsWith('@') || key.startsWith('v-');
      const safeKey = this.sanitizeAttributeName(key);
      // Don't sanitize dynamic bindings that contain object literals
      const safeVal = isDynamic ? value : this.sanitizeAttributeValue(value);
      delete (updatedNode.attributes as any)[key];
      (updatedNode.attributes as any)[safeKey] = safeVal;
    }

    // --- Remove unsafe inline handlers ---
    for (const attr in updatedNode.attributes) {
      if (/^on[a-z]+$/i.test(attr)) {
        delete updatedNode.attributes[attr];
      }
    }

    return updatedNode;
  }

  private transformPropsToRuntime(props: Record<string, string>): PropDefinition[] {
    return Object.entries(props).map(([name, type]) => {
      const typeStr = type.trim().toLowerCase();
      let constructor: Function;
      
      switch (typeStr) {
        case 'string':
          constructor = String;
          break;
        case 'number':
          constructor = Number;
          break;
        case 'boolean':
          constructor = Boolean;
          break;
        case 'array':
          constructor = Array;
          break;
        case 'object':
          constructor = Object;
          break;
        default:
          // For function types or any other type, use Function
          constructor = Function;
      }
      
      return { name, type: constructor };
    });
  }

  rootHandler(template: string, options: VueExtensionOptions, context: VueRootHandlerContext): string {
    const resolvedName = resolveComponentName(context, options) || 'Component';
    const componentName = this.sanitizeAttributeValue(resolvedName);
    const scriptContent = (context.component?.extensions?.vue?.scriptContent || options.scriptContent || '').replace(/<\/?script[^>]*>/g, '').trim();
    const styleOutput = context.component?.extensions?.vue?.styleOutput || context.styleOutput || '';
    const styleLang = context.component?.extensions?.vue?.styleLang || options.styleLang || 'css';
    const isScoped = context.component?.extensions?.vue?.scoped ?? options.scoped ?? false;
    const isComposition = context.component?.extensions?.vue?.composition ?? options.composition ?? false;
    const useSetup = context.component?.extensions?.vue?.useSetup ?? options.setup ?? false;
    const scriptLang = options.scriptLang ?? 'ts';
    const useTypeScript = context.component?.typescript ?? false;

    // --- Props Handling ---
    const propsMeta = context.props || [];
    const componentProps = context.component?.props || {};
    const hasProps = propsMeta.length > 0 || Object.keys(componentProps).length > 0;
    const hasScriptContent = Boolean(scriptContent);
    const hasComponentImports = Boolean(context.component?.imports && context.component.imports.length > 0);

    // Transform component props to runtime props if needed
    const runtimeProps = hasProps ? [
      ...propsMeta,
      ...this.transformPropsToRuntime(componentProps)
    ] : [];

    // --- Props Interface Generation ---
    let interfaceBlock = '';
    if (hasProps && useTypeScript) {
      const lines = [
        `interface ${componentName}Props {`,
        ...runtimeProps.map((p: PropDefinition) => {
          let tsType: string;
          switch (p.type) {
            case String:   tsType = 'string'; break;
            case Number:   tsType = 'number'; break;
            case Boolean:  tsType = 'boolean'; break;
            case Function: tsType = '(e: Event) => void'; break;
            case Array:    tsType = 'any[]'; break;
            case Object:   tsType = 'Record<string, any>'; break;
            default:       tsType = 'any';
          }
          return `  ${p.name}: ${tsType};`;
        }),
        `}`
      ];
      interfaceBlock = lines.join('\n') + '\n\n';
    }

    // --- Import Deduplication ---
    const importMap = new Map<string, Set<string>>();
    const defaultImports = new Map<string, string>();
    const sideEffectImports = new Set<string>();

    const addImport = (module: string, symbol: string) => {
      if (!importMap.has(module)) importMap.set(module, new Set());
      importMap.get(module)!.add(symbol);
    };

    // Only add imports if needed
    const shouldImport = hasProps || isComposition || useSetup || hasComponentImports;
    if (shouldImport) {
      // Add Vue core imports
      addImport('vue', 'defineComponent');
      if (isComposition || useSetup) {
        ['ref', 'computed', 'watch', 'onMounted'].forEach(sym => addImport('vue', sym));
      }

      // Process component imports
      if (hasComponentImports && context.component?.imports) {
        for (const imp of context.component.imports) {
          if (typeof imp === 'string') {
            // Handle named imports: import { foo, bar } from 'baz'
            const namedMatch = imp.match(/import\s+{([^}]+)}\s+from\s+["']([^"']+)["']/);
            if (namedMatch) {
              const [, named, from] = namedMatch;
              const symbols = named.split(',').map(s => s.trim());
              symbols.forEach(sym => addImport(from, sym));
              continue;
            }

            // Handle default imports: import foo from 'bar'
            const defaultMatch = imp.match(/import\s+([\w_]+)\s+from\s+["']([^"']+)["']/);
            if (defaultMatch) {
              const [, def, from] = defaultMatch;
              defaultImports.set(from, def);
              continue;
            }

            // Handle mixed imports: import foo, { bar } from 'baz'
            const mixedMatch = imp.match(/import\s+([\w_]+)\s*,\s*{([^}]+)}\s+from\s+["']([^"']+)["']/);
            if (mixedMatch) {
              const [, def, named, from] = mixedMatch;
              defaultImports.set(from, def);
              const symbols = named.split(',').map(s => s.trim());
              symbols.forEach(sym => addImport(from, sym));
              continue;
            }

            // Handle side-effect imports: import 'foo'
            const sideEffectMatch = imp.match(/import\s+["']([^"']+)["']/);
            if (sideEffectMatch) {
              const [, from] = sideEffectMatch;
              sideEffectImports.add(from);
            }
          }
        }
      }
    }

    // Compose import statements with sorted symbols
    const importStatements = [];
    
    // Add side-effect imports first
    for (const from of sideEffectImports) {
      importStatements.push(`import "${from}";`);
    }

    // Add default imports
    for (const [from, def] of defaultImports) {
      if (importMap.has(from)) {
        // If we have both default and named imports, combine them
        const symbols = Array.from(importMap.get(from)!).sort();
        importStatements.push(`import ${def}, { ${symbols.join(', ')} } from "${from}";`);
        importMap.delete(from);
      } else {
        importStatements.push(`import ${def} from "${from}";`);
      }
    }

    // Add remaining named imports
    for (const [from, symbols] of importMap) {
      importStatements.push(`import { ${Array.from(symbols).sort().join(', ')} } from "${from}";`);
    }

    // --- Props Logic ---
    let propsBlock = '';
    if (hasProps) {
      if (useSetup) {
        if (useTypeScript) {
          propsBlock = `defineProps<${componentName}Props>();\n`;
        } else {
          const runtimePropsConfig = runtimeProps
            .map((p: PropDefinition) => `${p.name}: { type: ${p.type.name}, required: true }`)
            .join(',\n  ');
          propsBlock = `const props = defineProps({\n  ${runtimePropsConfig}\n});\n`;
        }
      } else {
        if (useTypeScript) {
          propsBlock = `  props: {\n    ${Object.entries(componentProps)
            .map(([key, type]) => `${key}: { type: ${type}, required: true }`)
            .join(',\n    ')}\n  },`;
        } else {
          const runtimePropsConfig = runtimeProps
            .map((p: PropDefinition) => `${p.name}: { type: ${p.type.name}, required: true }`)
            .join(',\n    ');
          propsBlock = `  props: {\n    ${runtimePropsConfig}\n  },`;
        }
      }
    }

    // Remove any import statements from scriptContent
    const cleanedScriptContent = scriptContent.replace(/^import\s+.*;?$/gm, '').trim();

    // --- Script Block ---
    let scriptBlock = '';
    const shouldRenderScript = hasProps || hasScriptContent || importStatements.length > 0;
    if (shouldRenderScript) {
      if (useSetup) {
        scriptBlock = `<script setup lang="${scriptLang}">\n${importStatements.join('\n')}\n\n${interfaceBlock}${propsBlock}${cleanedScriptContent}\n</script>`;
      } else {
        const generic = hasProps && useTypeScript ? `<${componentName}Props>` : '';
        const setupFn = isComposition ? `\n  setup() {\n    ${cleanedScriptContent}\n  }` : '';
        scriptBlock = `<script lang="${scriptLang}">\n${importStatements.join('\n')}\n\n${interfaceBlock}export default defineComponent${generic}({\n  name: "${componentName}",\n  ${propsBlock}${setupFn ? setupFn + '\n' : ''}});\n</script>`;
      }
    } else {
      // For minimal SFCs, only include a script block if we have imports
      if (importStatements.length > 0) {
        scriptBlock = `<script lang="${scriptLang}">\n${importStatements.join('\n')}\n\nexport default defineComponent({\n  name: "${componentName}"\n});\n</script>`;
      } else {
        // For truly minimal SFCs with no imports, props, or script content, include a minimal script block
        scriptBlock = `<script lang="${scriptLang}">\nexport default defineComponent({\n  name: "${componentName}"\n});\n</script>`;
      }
    }

    // --- Style Block ---
    let styleBlock = '';
    if (styleOutput && styleOutput.trim()) {
      const attrs = [];
      if (isScoped) attrs.push('scoped');
      if (styleLang && styleLang !== 'css') attrs.push(`lang="${styleLang}"`);
      styleBlock = `<style${attrs.length ? ' ' + attrs.join(' ') : ''}>\n${styleOutput.trim()}\n</style>`;
    }

    // --- Template Block with Sanitization ---
    const sanitizeTemplate = (html: string) =>
      html.replace(
        /(data-[\w-]+|class|id)="([^"]+)"/g,
        (_, key, val) => `${key}="${this.sanitizeAttributeValue(val)}"`
      );
    const templateBlock = `<template>\n${sanitizeTemplate(template.trim())}\n</template>`;

    // Only include blocks that have content
    return [templateBlock, scriptBlock, styleBlock].filter(Boolean).join('\n\n');
  }
}
