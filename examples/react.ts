import { TemplateEngine } from '../src/engine/TemplateEngine';
import { ReactExtension } from '../src/extensions/react';
import { ExtendedTemplateNode } from '../src/types/extensions';
import { TemplateOptions } from '../src/types';
import { ReactExtensionOptions } from '../src/types/extensions';

const verbose = true;

const templateEngine = new TemplateEngine();
const reactExtension = new ReactExtension(verbose);

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const initialTodos: Todo[] = [
  { id: 1, text: 'Learn JavaScript', completed: false },
  { id: 2, text: 'Build a todo app', completed: false },
];

const todoAppTemplate: ExtendedTemplateNode[] = [
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
                onClick: '() => handleRemoveTodo()',
              },
            },
          },
        })),
      },
      {
        tag: 'script',
        children: [
          {
            type: 'text',
            content: `
                function handleAddTodo() {
                    const todoList = document.getElementById('todoList');
                    const newTodoText = document.getElementById('todoInput').value;
                    const newTodoItem = document.createElement('li');
                    
                    newTodoItem.textContent = newTodoText;
                    todoList.appendChild(newTodoItem);
                    
                    document.getElementById('todoInput').value = ''; // Clear the input field
                }
            `,
          },
        ],
        extensions: {
          react: {
            ignore: true,
          },
        },
      },
    ],
  },
];

// Define the props interface for the component
const propsInterface = `
interface TodoProps {
  initialTodos: Todo[];
  onAddTodo: (text: string) => void;
  onRemoveTodo: (id: number) => void;
}
`;

// Render
(async () => {
  // Render plain HTML version
  await templateEngine.render(todoAppTemplate, {
    name: 'html-todo-app',
    writeOutputFile: true,
  } as TemplateOptions);

  // Render React version with TypeScript support
  await templateEngine.render(todoAppTemplate, {
    name: 'react-todo-app',
    componentName: 'TodoApp',
    extensions: [reactExtension],
    outputDir: 'dist/react',
    writeOutputFile: true,
    verbose,
    importStatements: [
      "import React, { useState } from 'react';",
      "import { DefaultButton } from './components/Button';",
      "import { TodoCard } from './components/TodoCard';",
      "import { Todo } from './types';",
    ],
    propsInterface,
    fileExtension: '.tsx',
  } as TemplateOptions & ReactExtensionOptions);
})(); 