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

    // Generate script section
    const scriptContent = `
<script lang="ts">
${composition ? 'import { defineComponent } from \'vue\';' : ''}
${useSetup ? 'import { ref } from \'vue\';' : ''}

${composition ? 'export default defineComponent({' : 'export default {'}
  name: '${componentName}',
  props: {
    // Add your props here
  },
  ${useSetup ? `
  setup() {
    const handleAddTodo = () => {
      const todoList = document.getElementById('todoList');
      const newTodoText = document.getElementById('todoInput').value;
      const newTodoItem = document.createElement('li');
      newTodoItem.textContent = newTodoText;
      todoList?.appendChild(newTodoItem);
      document.getElementById('todoInput').value = ''; // Clear the input field
    };

    const handleRemoveTodo = (id: number) => {
      const todoList = document.getElementById('todoList');
      const todoItem = document.getElementById(\`todo-\${id}\`);
      if (todoItem && todoList) {
        todoList.removeChild(todoItem);
      }
    };

    return {
      handleAddTodo,
      handleRemoveTodo
    };
  }` : `
  methods: {
    handleAddTodo() {
      const todoList = document.getElementById('todoList');
      const newTodoText = document.getElementById('todoInput').value;
      const newTodoItem = document.createElement('li');
      newTodoItem.textContent = newTodoText;
      todoList?.appendChild(newTodoItem);
      document.getElementById('todoInput').value = ''; // Clear the input field
    },
    handleRemoveTodo(id: number) {
      const todoList = document.getElementById('todoList');
      const todoItem = document.getElementById(\`todo-\${id}\`);
      if (todoItem && todoList) {
        todoList.removeChild(todoItem);
      }
    }
  }`}
${composition ? '});' : '}'}
</script>`;

    // Generate style section with basic styles
    const defaultStyles = `
.todo-app {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.todo-app input {
  padding: 8px;
  margin-right: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.todo-app button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.todo-app button:hover {
  background-color: #45a049;
}

.todo-app ul {
  list-style: none;
  padding: 0;
  margin-top: 20px;
}

.todo-app li {
  padding: 8px;
  margin: 4px 0;
  background-color: #f9f9f9;
  border-radius: 4px;
  cursor: pointer;
}

.todo-app li:hover {
  background-color: #f0f0f0;
}`;

    const styleContent = `
<style ${scoped ? 'scoped' : ''}>
${styleOutput || defaultStyles}
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