import { createLogger } from '@js-template-engine/core';
import { getExtensionOptions } from '@js-template-engine/core';
import { Component, ExtendedTemplate, TemplateNode, BaseExtensionOptions, RootHandlerContext } from '@js-template-engine/types';
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

export class VueExtension {
  public readonly key = 'vue';
  private static instance: VueExtension;

  constructor(verbose = false) {
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

  rootHandler(template: string, options: BaseExtensionOptions, context: RootHandlerContext): string {
    const component = context.component;
    if (!component) return '';
    const vueConfig = getExtensionOptions<VueComponentOptions>(component as Component, 'vue');
    if (!vueConfig) return '';
    const { name, props = {}, imports = [], customScript, customStyle } = vueConfig;
    if (!name) return '';
    const scriptContent = customScript || this.generateScript(name, props, imports);
    const styleContent = customStyle || this.generateStyle(context as StyleContext);
    // Render template from AST if available, otherwise use the string template
    let templateContent = '';
    if ((component as any).template) {
      templateContent = this.renderTemplate((component as any).template || []);
    } else {
      templateContent = template;
    }
    return `
<template>
  ${templateContent}
</template>

${scriptContent}

${styleContent}
    `.trim();
  }

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