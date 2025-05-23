import { TemplateEngine } from '@js-template-engine/core';
import type { RenderOptions, ExtendedTemplate } from '@js-template-engine/types';
import { VueExtension } from '@js-template-engine/extension-vue';
import type { Options as VueOptions } from '@js-template-engine/extension-vue/dist/types';

const verbose = true;
const vueExtension = new VueExtension();
vueExtension.options.componentName = 'TodoApp';

const engine = new TemplateEngine([vueExtension]);

const template: ExtendedTemplate = {
  component: {
    name: 'TodoApp',
    props: {},
    script: `
      function handleAddTodo() {
        const todoList = document.getElementById('todoList');
        const newTodoText = document.getElementById('todoInput').value;
        const newTodoItem = document.createElement('li');

        newTodoItem.textContent = newTodoText;
        todoList.appendChild(newTodoItem);

        document.getElementById('todoInput').value = ''; // Clear the input field
      }

      function handleRemoveTodo(id: number) {
        const todoList = document.getElementById('todoList');
        const todoItem = document.getElementById(\`todo-\${id}\`);
        if (todoItem) {
          todoList?.removeChild(todoItem);
        }
      }
    `,
    extensions: {
      vue: {
        composition: true,
        useSetup: true,
        scoped: true
      }
    }
  },
  template: [
    {
      tag: 'div',
      attributes: { class: 'todo-app' },
      children: [
        {
          tag: 'input',
          attributes: {
            type: 'text',
            id: 'todoInput',
            placeholder: 'Add a new todo',
          },
        },
        {
          tag: 'button',
          attributes: {
            onclick: 'handleAddTodo',
          },
          children: [{ type: 'text', content: 'Add' }],
          extensions: {
            vue: {
              tag: 'DefaultButton',
              attributes: {
                color: 'primary',
                label: 'Add',
              },
              expressionAttributes: {
                onClick: 'handleAddTodo',
              },
            },
          },
        },
        {
          tag: 'ul',
          attributes: { id: 'todoList' },
          children: [
            {
              tag: 'li',
              children: [{ type: 'text', content: 'Learn JavaScript' }],
              extensions: {
                vue: {
                  tag: 'TodoCard',
                  expressionAttributes: {
                    onClick: '() => handleRemoveTodo(1)',
                  },
                },
              },
            },
            {
              tag: 'li',
              children: [{ type: 'text', content: 'Build a todo app' }],
              extensions: {
                vue: {
                  tag: 'TodoCard',
                  expressionAttributes: {
                    onClick: '() => handleRemoveTodo(2)',
                  },
                },
              },
            }
          ],
        },
      ],
    },
  ]
};

const propsInterface = `
interface TodoProps {
  initialTodos: Todo[];
  handleAddTodo: (text: string) => void;
  handleRemoveTodo: (id: number) => void;
}
`;

(async () => {
  await engine.render(template, {
    name: 'vue',
    writeOutputFile: true,
    verbose,
    outputDir: 'output',
    fileExtension: '.vue',
    styles: {
      outputFormat: 'scss'
    },
    propsInterface,
    props: '{ initialTodos, handleAddTodo, handleRemoveTodo }',
    importStatements: [
      "import { DefaultButton } from './components/Button';",
      "import { TodoCard } from './components/TodoCard';",
      "import { Todo } from './types';",
    ],
  } as RenderOptions & VueOptions);

  console.log('[render] Done. Output saved to dist directory');
})();
