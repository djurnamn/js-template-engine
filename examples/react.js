// Example of using the TemplateEngine class to render a simple JSX component with using the React extension.
// You can run this example with `npm run example:react` or `yarn example:react`.

const { TemplateEngine, ReactExtension } = require("../src");
const verbose = true;

const templateEngine = new TemplateEngine();
const reactExtension = new ReactExtension(verbose);

const initialTodos = [
  { id: 1, text: "Learn JavaScript", completed: false },
  { id: 2, text: "Build a todo app", completed: false },
];

const todoAppTemplate = [
  {
    tag: "div",
    attributes: { class: "todo-app" },
    children: [
      {
        tag: "input",
        attributes: {
          type: "text",
          id: "todoInput",
          placeholder: "Add a new todo",
        },
      },
      {
        tag: "button",
        attributes: {
          onclick: "handleAddTodo",
        },
        children: [{ type: "text", content: "Add" }],
        extensions: {
          react: {
            tag: "DefaultButton",
            attributes: {
              color: "primary",
              label: "Add",
            },
            expressionAttributes: {
              onClick: "handleAddTodo",
            },
          },
        },
      },
      {
        tag: "ul",
        attributes: { id: "todoList" },
        children: initialTodos.map((todo) => ({
          tag: "li",
          children: [{ type: "text", content: todo.text }],
          attributes: {
            onclick: "this.parentNode.removeChild(this);",
          },
          extensions: {
            react: {
              tag: "TodoCard",
              expressionAttributes: {
                onClick: "() => handleRemoveTodo()",
              },
            },
          },
        })),
      },
      {
        tag: "script",
        children: [
          {
            type: "text",
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

// Render
(async () => {
  await templateEngine.render(todoAppTemplate, {
    name: "html-todo-app",
    writeOutputFile: true,
  });

  await templateEngine.render(todoAppTemplate, {
    name: "react-todo-app",
    extensions: [reactExtension], // Only React extension is needed for this example
    outputDir: "dist", // React extension defaults to "dist/react"
    writeOutputFile: true,
    verbose,
  });
})();
