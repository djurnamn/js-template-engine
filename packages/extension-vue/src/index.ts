import type { BaseExtensionOptions } from '@js-template-engine/types';
import type { VueExtensionOptions } from './types';
import { createLogger } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  RootHandlerContext as BaseRootHandlerContext,
} from '@js-template-engine/types';

import {
  resolveComponentName,
  resolveComponentProps,
  resolveComponentImports,
} from '@js-template-engine/types';

const logger = createLogger(false, 'vue-extension');


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

export interface VueRootHandlerOptions
  extends Omit<VueExtensionOptions, 'script'> {
  componentName?: string;
  script?: string;
  styleOutput?: string;
  isSetup?: boolean;
  isComposition?: boolean;
  isScoped?: boolean;
  imports?: Array<{ from: string; imports: string[] }>;
  propsInterface?: string;
}

/**
 * Type guard to check if a node is an element node.
 * @param node - The node to check.
 * @returns True if the node is an element node.
 */
function isElementNode(
  node: TemplateNode
): node is Extract<TemplateNode, { type?: 'element' }> {
  return node.type === 'element' || node.type === undefined;
}

export class VueExtension
  implements Extension<VueExtensionOptions, VueNodeExtensions>
{
  public key = 'vue';
  public isRenderer = true;
  private logger: ReturnType<typeof createLogger>;

  options: VueExtensionOptions = {};

  constructor(verbose = false) {
    this.logger = createLogger(verbose, 'vue-extension');
  }

  attributeFormatter(
    attr: string,
    val: string | number | boolean,
    isExpression?: boolean
  ): string {
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
      .replace(/[^a-zA-Z0-9_\-]/g, '-') // remove special chars
      .replace(/-+/g, '-') // collapse multiple dashes
      .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
      .replace(/"/g, '&quot;') // escape quotes
      .replace(/<script.*?>.*?<\/script>/gi, '')
      .trim();
  }

  private dedupeImports(
    imports: Array<{ from: string; imports: string[] }>
  ): string[] {
    const map = new Map<string, Set<string>>();
    for (const imp of imports) {
      if (!imp || typeof imp.from !== 'string' || !Array.isArray(imp.imports))
        continue;
      if (!map.has(imp.from)) map.set(imp.from, new Set());
      for (const i of imp.imports) map.get(imp.from)!.add(i);
    }
    return Array.from(map.entries()).map(
      ([from, symbols]) =>
        `import { ${Array.from(symbols).sort().join(', ')} } from "${from}";`
    );
  }

  /**
   * Processes Vue-specific node transformations including attributes, directives, event handlers, slots, and control flow.
   * Handles both static and dynamic attributes, Vue directives, event bindings, slot transformations, and special nodes.
   * @param node - The template node to process.
   * @returns The processed template node with Vue-specific transformations applied.
   */
  nodeHandler(node: TemplateNode): TemplateNode {
    // Handle slot nodes - transform to Vue slot elements
    if (node.type === 'slot') {
      const slotNode: TemplateNode = {
        type: 'element',
        tag: 'slot',
        attributes: {
          name: node.name
        },
        children: node.fallback || [],
        extensions: node.extensions
      };
      
      // Apply any Vue-specific slot extensions
      if (node.extensions?.vue) {
        return this.nodeHandler(slotNode);
      }
      
      return slotNode;
    }
    
    // Handle fragment nodes - transform to Vue template
    if (node.type === 'fragment') {
      return {
        type: 'element',
        tag: 'template',
        children: node.children,
        extensions: node.extensions
      };
    }
    
    // Handle comment nodes - pass through as HTML comment
    if (node.type === 'comment') {
      return {
        type: 'text',
        content: `<!-- ${node.content} -->`,
        extensions: node.extensions
      };
    }
    
    // Handle conditional nodes - transform to Vue v-if/v-else
    if (node.type === 'if') {
      const nodes: TemplateNode[] = [];
      
      // Create v-if element for then branch
      if (node.then.length === 1 && (node.then[0].type === 'element' || node.then[0].type === undefined)) {
        const thenNode = { ...node.then[0] };
        thenNode.attributes = { ...thenNode.attributes, 'v-if': node.condition };
        nodes.push(thenNode);
      } else {
        // Wrap multiple nodes in template
        nodes.push({
          type: 'element',
          tag: 'template',
          attributes: { 'v-if': node.condition },
          children: node.then
        });
      }
      
      // Create v-else element for else branch
      if (node.else && node.else.length > 0) {
        if (node.else.length === 1 && (node.else[0].type === 'element' || node.else[0].type === undefined)) {
          const elseNode = { ...node.else[0] };
          elseNode.attributes = { ...elseNode.attributes, 'v-else': '' };
          nodes.push(elseNode);
        } else {
          // Wrap multiple nodes in template
          nodes.push({
            type: 'element',
            tag: 'template',
            attributes: { 'v-else': '' },
            children: node.else
          });
        }
      }
      
      // Return as fragment
      return {
        type: 'fragment',
        children: nodes,
        extensions: node.extensions
      };
    }
    
    // Handle for nodes - transform to Vue v-for
    if (node.type === 'for') {
      const vForExpression = node.index ? 
        `(${node.item}, ${node.index}) in ${node.items}` :
        `${node.item} in ${node.items}`;
      
      if (node.children.length === 1 && (node.children[0].type === 'element' || node.children[0].type === undefined)) {
        // Single element - add v-for directly
        const forNode = { ...node.children[0] };
        forNode.attributes = { 
          ...forNode.attributes, 
          'v-for': vForExpression,
          ':key': node.key || (node.index || 'index')
        };
        return forNode;
      } else {
        // Multiple elements - wrap in template
        return {
          type: 'element',
          tag: 'template',
          attributes: { 
            'v-for': vForExpression,
            ':key': node.key || (node.index || 'index')
          },
          children: node.children,
          extensions: node.extensions
        };
      }
    }
    
    if (!node.extensions?.vue) return node;
    if (!isElementNode(node)) return node;

    const ext = node.extensions.vue;
    const updatedNode = { ...node, attributes: { ...node.attributes } };

    // --- Process expression attributes (new format) ---
    if (ext.expressionAttributes) {
      for (const [key, value] of Object.entries(ext.expressionAttributes)) {
        // Handle Vue-specific prefixes
        if (key.startsWith('@')) {
          // Event handlers
          updatedNode.attributes[key] = String(value);
        } else if (key.startsWith('v-')) {
          // Directives
          updatedNode.attributes[key] = String(value);
        } else if (key.startsWith(':') || key.startsWith('v-bind:')) {
          // Dynamic bindings
          const attrName = key.startsWith('v-bind:') ? ':' + key.slice(7) : key;
          updatedNode.attributes[attrName] = String(value);
        } else {
          // Regular dynamic attributes
          updatedNode.attributes[`:${key}`] = String(value);
        }
      }
    }

    // --- Merging static and dynamic class/style bindings ---
    // Handle class
    let staticClass = ext.attributes?.class || updatedNode.attributes.class;
    let dynamicClass =
      ext.bindAttributes?.[':class'] ||
      ext.bindAttributes?.['class'] ||
      ext.bindAttributes?.['v-bind:class'] ||
      ext.expressionAttributes?.[':class'] ||
      ext.expressionAttributes?.['class'];

    // Handle class bindings
    if (staticClass !== undefined && dynamicClass !== undefined) {
      // Emit both static and dynamic classes
      updatedNode.attributes.class = staticClass;
      updatedNode.attributes[':class'] = dynamicClass;
    } else if (staticClass !== undefined) {
      // Only static class
      updatedNode.attributes.class = staticClass;
      delete updatedNode.attributes[':class'];
    } else if (dynamicClass !== undefined) {
      // Only dynamic class
      updatedNode.attributes[':class'] = dynamicClass;
      delete updatedNode.attributes.class;
    } else {
      // No classes
      delete updatedNode.attributes.class;
      delete updatedNode.attributes[':class'];
    }

    // Remove handled class keys from bindAttributes
    if (ext.bindAttributes) {
      delete ext.bindAttributes[':class'];
      delete ext.bindAttributes['class'];
      delete ext.bindAttributes['v-bind:class'];
    }

    // Handle style
    let staticStyle = ext.attributes?.style || updatedNode.attributes.style;
    let dynamicStyle =
      ext.bindAttributes?.[':style'] ||
      ext.bindAttributes?.['style'] ||
      ext.bindAttributes?.['v-bind:style'] ||
      ext.expressionAttributes?.[':style'] ||
      ext.expressionAttributes?.['style'];

    // Handle style bindings
    if (staticStyle !== undefined && dynamicStyle !== undefined) {
      // Emit both static and dynamic styles
      updatedNode.attributes.style = staticStyle;
      updatedNode.attributes[':style'] = dynamicStyle;
    } else if (staticStyle !== undefined) {
      // Only static style
      updatedNode.attributes.style = staticStyle;
      delete updatedNode.attributes[':style'];
    } else if (dynamicStyle !== undefined) {
      // Only dynamic style
      updatedNode.attributes[':style'] = dynamicStyle;
      delete updatedNode.attributes.style;
    } else {
      // No styles
      delete updatedNode.attributes.style;
      delete updatedNode.attributes[':style'];
    }

    // Remove handled style keys from bindAttributes
    if (ext.bindAttributes) {
      delete ext.bindAttributes[':style'];
      delete ext.bindAttributes['style'];
      delete ext.bindAttributes['v-bind:style'];
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
        const attrName = key.startsWith('v-bind:')
          ? ':' + key.slice(7)
          : key.startsWith(':')
            ? key
            : ':' + key;
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
      const isDynamic =
        key.startsWith(':') || key.startsWith('@') || key.startsWith('v-');
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

  private transformPropsToRuntime(
    props: Record<string, string>
  ): PropDefinition[] {
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

  rootHandler(
    template: string,
    options: VueExtensionOptions,
    context: VueRootHandlerContext
  ): string {
    const resolvedName = resolveComponentName(context, options) || 'Component';
    const componentName = this.sanitizeAttributeValue(resolvedName);

    // Combine vanilla and framework-specific script content
    const scriptContent = [
      context.component?.script,
      context.component?.extensions?.vue?.script,
      options.script,
    ]
      .filter(Boolean)
      .join('\n\n')
      .replace(/<\/?script[^>]*>/g, '')
      .trim();

    const styleOutput =
      context.component?.extensions?.vue?.styleOutput ||
      context.styleOutput ||
      '';
    const styleLanguage =
      context.component?.extensions?.vue?.styleLanguage ??
      context.component?.extensions?.vue?.styles?.outputFormat ??
      options.styles?.outputFormat ??
      'css';
    const isScoped =
      context.component?.extensions?.vue?.scoped ?? options.scoped ?? false;
    const isComposition =
      context.component?.extensions?.vue?.compositionAPI ??
      context.component?.extensions?.vue?.composition ??
      options.composition ??
      false;
    const useSetup =
      context.component?.extensions?.vue?.setupScript ??
      context.component?.extensions?.vue?.setup ??
      options.setup ??
      false;
    const useTypeScript = (options.language ?? 'javascript') === 'typescript';

    // --- Props Handling ---
    const propsMeta = context.props || [];
    const componentProps = context.component?.props || {};
    const hasProps =
      propsMeta.length > 0 || Object.keys(componentProps).length > 0;
    const hasScriptContent = Boolean(scriptContent);
    const hasComponentImports = Boolean(
      context.component?.imports && context.component.imports.length > 0
    );

    // Transform component props to runtime props if needed
    const runtimeProps = hasProps
      ? [...propsMeta, ...this.transformPropsToRuntime(componentProps)]
      : [];

    // --- Props Interface Generation ---
    let interfaceBlock = '';
    if (hasProps && useTypeScript) {
      const lines = [
        `interface ${componentName}Props {`,
        ...runtimeProps.map((p: PropDefinition) => {
          let tsType: string;
          switch (p.type) {
            case String:
              tsType = 'string';
              break;
            case Number:
              tsType = 'number';
              break;
            case Boolean:
              tsType = 'boolean';
              break;
            case Function:
              tsType = '(e: Event) => void';
              break;
            case Array:
              tsType = 'any[]';
              break;
            case Object:
              tsType = 'Record<string, any>';
              break;
            default:
              tsType = 'any';
          }
          return `  ${p.name}: ${tsType};`;
        }),
        `}`,
      ];
      interfaceBlock = lines.join('\n') + '\n\n';
    }

    // --- Import Handling ---
    const defaultImports: string[] = [];
    if (hasProps || isComposition || useSetup) {
      defaultImports.push('import { defineComponent } from "vue";');
      if (isComposition || useSetup) {
        defaultImports.push(
          'import { ref, computed, watch, onMounted } from "vue";'
        );
      }
    }

    const importStatements = resolveComponentImports(
      context.component,
      defaultImports
    );

    // --- Props Logic ---
    let propsBlock = '';
    if (hasProps) {
      if (useSetup) {
        if (useTypeScript) {
          propsBlock = `defineProps<${componentName}Props>();\n`;
        } else {
          const runtimePropsConfig = runtimeProps
            .map(
              (p: PropDefinition) =>
                `${p.name}: { type: ${p.type.name}, required: true }`
            )
            .join(',\n  ');
          propsBlock = `const props = defineProps({\n  ${runtimePropsConfig}\n});\n`;
        }
      } else {
        // For Options API, always use runtime props syntax regardless of TypeScript
        const runtimePropsConfig = runtimeProps
          .map(
            (p: PropDefinition) =>
              `${p.name}: { type: ${p.type.name}, required: true }`
          )
          .join(',\n    ');
        propsBlock = `  props: {\n    ${runtimePropsConfig}\n  },`;
      }
    }

    // --- Script Block ---
    let scriptBlock = '';
    const shouldRenderScript =
      hasProps || hasScriptContent || importStatements.length > 0;
    if (shouldRenderScript) {
      if (useSetup) {
        scriptBlock = `<script setup lang="${useTypeScript ? 'ts' : 'js'}">\n${importStatements.join('\n')}\n\n${interfaceBlock}${propsBlock}${scriptContent}\n</script>`;
      } else {
        const setupFn = isComposition
          ? `\n  setup() {\n    ${scriptContent}\n  }`
          : '';
        scriptBlock = `<script lang="${useTypeScript ? 'ts' : 'js'}">\n${importStatements.join('\n')}\n\n${interfaceBlock}export default defineComponent({\n  name: "${componentName}",\n  ${propsBlock}${setupFn ? setupFn + '\n' : ''}});\n</script>`;
      }
    } else {
      // For minimal SFCs, only include a script block if we have imports
      if (importStatements.length > 0) {
        scriptBlock = `<script lang="${useTypeScript ? 'ts' : 'js'}">\n${importStatements.join('\n')}\n\nexport default defineComponent({\n  name: "${componentName}"\n});\n</script>`;
      } else {
        // For truly minimal SFCs with no imports, props, or script content, include a minimal script block
        scriptBlock = `<script lang="${useTypeScript ? 'ts' : 'js'}">\nexport default defineComponent({\n  name: "${componentName}"\n});\n</script>`;
      }
    }

    // --- Style Block ---
    let styleBlock = '';
    if (styleOutput && styleOutput.trim() && styleLanguage !== 'inline') {
      const attrs = [];
      if (isScoped) attrs.push('scoped');
      if (styleLanguage && styleLanguage !== 'css') attrs.push(`lang="${styleLanguage}"`);
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
    return [templateBlock, scriptBlock, styleBlock]
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * Determines the appropriate file extension for Vue components (always .vue).
   */
  public getFileExtension(options: { language?: 'typescript' | 'javascript' }): string {
    return '.vue';
  }

  /**
   * Determines the appropriate Prettier parser for Vue components (always vue).
   */
  public getPrettierParser(options: { language?: 'typescript' | 'javascript' }): string {
    return 'vue';
  }
}
