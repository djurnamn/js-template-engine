import { TemplateEngine } from '@js-template-engine/core';
import type { RenderOptions, ExtendedTemplate } from '@js-template-engine/types';
import { ReactExtension } from '@js-template-engine/extension-react';
import type { ReactExtension as ReactTypes } from '@js-template-engine/extension-react/src/types';

const verbose = true;

const reactExtension = new ReactExtension(verbose);
const templateEngine = new TemplateEngine([reactExtension]);

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const initialTodos: Todo[] = [
  { id: 1, text: 'Learn JavaScript', completed: false },
  { id: 2, text: 'Build a todo app', completed: false },
];

const todoAppTemplate: ExtendedTemplate = {
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
      react: {
        script: `
          const [todos, setTodos] = React.useState([
            { id: 1, text: 'Learn JavaScript' },
            { id: 2, text: 'Build a todo app' }
          ]);

          const handleAddTodo = () => {
            const input = document.getElementById('todoInput') as HTMLInputElement;
            if (input.value.trim()) {
              setTodos([...todos, { id: Date.now(), text: input.value }]);
              input.value = '';
            }
          };

          const handleRemoveTodo = (id: number) => {
            setTodos(todos.filter(todo => todo.id !== id));
          };
        `
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
            react: {
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
          children: initialTodos.map((todo) => ({
            tag: 'li',
            children: [{ type: 'text', content: todo.text }],
            attributes: {
              onclick: 'this.parentNode.removeChild(this);',
            },
            extensions: {
              react: {
                tag: 'TodoCard',
                expressionAttributes: {
                  onClick: `() => handleRemoveTodo(${todo.id})`,
                },
              },
            },
          })),
        },
      ],
    },
  ]
};

// Define the props interface for the component
const propsInterface = `
interface TodoProps {
  initialTodos: Todo[];
  handleAddTodo: (text: string) => void;
  handleRemoveTodo: (id: number) => void;
}
`;

// Render
(async () => {
  await templateEngine.render(todoAppTemplate, {
    name: 'react',
    writeOutputFile: true,
    verbose,
    outputDir: 'output',
    styles: {
      outputFormat: 'scss'
    },
    importStatements: [
      "import React, { useState } from 'react';",
      "import { DefaultButton } from './components/Button';",
      "import { TodoCard } from './components/TodoCard';",
      "import { Todo } from './types';",
    ],
    propsInterface,
    props: '{ initialTodos, handleAddTodo, handleRemoveTodo }',
    fileExtension: '.tsx',
  } as RenderOptions & ReactTypes.Options);
})(); 