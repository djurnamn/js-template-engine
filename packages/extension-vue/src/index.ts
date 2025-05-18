import { createLogger } from '@js-template-engine/core';
import { getExtensionOptions } from '@js-template-engine/core';
import { Component, ExtendedTemplate, TemplateNode, BaseExtensionOptions, RootHandlerContext, Extension } from '@js-template-engine/types';
import { VueComponentOptions, Options } from './types';

const logger = createLogger(false, 'vue-extension');

interface VueNode extends TemplateNode {
  extensions?: {
    vue?: VueComponentOptions;
  };
}

interface StyleContext {
  styles?: Record<string, string>;
  [key: string]: any;
}

export class VueExtension implements Extension {
  public readonly key = 'vue';
  private static instance: VueExtension;
  private options: Options;

  constructor(options: Options = {}) {
    this.options = options;
    if (VueExtension.instance) {
      return VueExtension.instance;
    }
    VueExtension.instance = this;
  }

  static getInstance(): VueExtension {
    if (!VueExtension.instance) {
      VueExtension.instance = new VueExtension();
    }
    return VueExtension.instance;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  nodeHandler(node: VueNode): TemplateNode {
    const vueConfig = getExtensionOptions<VueComponentOptions>(node as Component, 'vue');
    if (vueConfig) {
      if (vueConfig.attributes) {
        node.attributes = { ...node.attributes, ...vueConfig.attributes };
      }
      if (vueConfig.expressionAttributes) {
        node.attributes = node.attributes || {};
        if (Array.isArray(vueConfig.expressionAttributes)) {
          // Handle string[] format
          for (const attr of vueConfig.expressionAttributes) {
            node.attributes[`:${attr}`] = attr;
          }
        } else {
          // Handle Record<string, string> format
          for (const [attr, value] of Object.entries(vueConfig.expressionAttributes)) {
            node.attributes[`:${attr}`] = value;
          }
        }
      }
    }
    return node;
  }

  rootHandler = (template: string, options: BaseExtensionOptions, context: RootHandlerContext): string => {
    const { component, styleOutput } = context;
    const vueOptions = this.options as Options;
    const componentName = vueOptions.componentName || 'Component';

    // Get Vue-specific options from component extensions
    const vueConfig = component?.extensions?.vue || {};
    const { composition = false, useSetup = false, scoped = true } = vueConfig;
    const isTypeScript = component?.typescript ?? false;

    // Generate props section
    const propsContent = component?.props 
      ? Object.entries(component.props)
          .map(([key, type]) => `    ${key}: ${type}`)
          .join(',\n')
      : '    // Add your props here';

    // Generate script section
    const scriptContent = `
<script${isTypeScript ? ' lang="ts"' : ''}>
${composition ? 'import { defineComponent } from \'vue\';' : ''}
${useSetup ? 'import { ref } from \'vue\';' : ''}
${component?.imports?.map(imp => `import ${imp};`).join('\n') || ''}

${composition ? 'export default defineComponent({' : 'export default {'}
  name: '${componentName}',
  props: {
${propsContent}
  },
  ${component?.script || ''}
${composition ? '});' : '}'}
</script>`;

    // Generate style section
    const styleContent = `
<style ${scoped ? 'scoped' : ''}>
${styleOutput || ''}
</style>`;

    // Combine template, script, and style
    return `<template>
${template}
</template>${scriptContent}${styleContent}`;
  };

  private renderTemplate(nodes: TemplateNode[] = []): string {
    return nodes.map((node) => {
      if (typeof node === 'string') return this.escapeHtml(node);
      const tag = node.tag || node.tagName;
      if (!tag) return this.escapeHtml(node.content || '');
      const attrs = node.attributes
        ? Object.entries(node.attributes)
            .map(([key, value]) => `${key}="${this.escapeHtml(String(value))}"`)
            .join(' ')
        : '';
      const children = node.children ? this.renderTemplate(node.children) : '';
      return `<${tag}${attrs ? ' ' + attrs : ''}>${children}</${tag}>`;
    }).join('');
  }

  private generateScript(name: string, props: Record<string, string>, imports: string[]): string {
    const propTypes = Object.entries(props)
      .map(([key, type]) => `${key}: ${type}`)
      .join(',\n  ');
    return `
<script lang="ts">
${imports.map(imp => `import ${imp};`).join('\n')}

export default {
  name: '${name}',
  props: {
    ${propTypes}
  }
}
</script>
    `.trim();
  }

  private generateStyle(context: StyleContext): string {
    const styles = context.styles || {};
    if (Object.keys(styles).length === 0) return '';
    return `
<style scoped>
${Object.entries(styles)
  .map(([selector, rules]) => `${selector} { ${rules} }`)
  .join('\n')}
</style>
    `.trim();
  }
}

export type { Options }; 