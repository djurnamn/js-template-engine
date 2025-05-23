import React from "react"; props: { }, const TodoApp: React.FC<TodoAppProps>
  = ({ initialTodos, handleAddTodo, handleRemoveTodo }) => { return (
  <div class="todo-app">
    <input type="text" id="todoInput" placeholder="Add a new todo" /><button
      onclick="handleAddTodo"
    >
      Add
    </button>
    <ul id="todoList">
      <li onclick="this.parentNode.removeChild(this);">Learn JavaScript</li>
      <li onclick="this.parentNode.removeChild(this);">Build a todo app</li>
    </ul>
  </div>
  ); }; export default TodoApp;</TodoAppProps
>
