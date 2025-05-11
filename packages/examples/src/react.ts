import { TemplateEngine, TemplateOptions } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { ExtendedTemplateNode, ReactExtension as ReactTypes } from '@js-template-engine/core';

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
                onClick: `() => handleRemoveTodo(${todo.id})`,
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
  handleAddTodo: (text: string) => void;
  handleRemoveTodo: (id: number) => void;
}
`;

// Render
(async () => {
  // Render plain HTML version
  await templateEngine.render(todoAppTemplate, {
    name: 'html-todo-app',
    writeOutputFile: true,
    outputDir: 'output'
  } as TemplateOptions);

  // Render React version with TypeScript support
  await templateEngine.render(todoAppTemplate, {
    name: 'react-todo-app',
    componentName: 'TodoApp',
    extensions: [reactExtension],
    outputDir: 'output/react',
    writeOutputFile: true,
    verbose,
    importStatements: [
      "import React, { useState } from 'react';",
      "import { DefaultButton } from './components/Button';",
      "import { TodoCard } from './components/TodoCard';",
      "import { Todo } from './types';",
    ],
    propsInterface,
    props: '{ initialTodos, handleAddTodo, handleRemoveTodo }',
    fileExtension: '.tsx',
  } as TemplateOptions & ReactTypes.Options);
})(); 