import React, { useState } from "react";
import { DefaultButton } from "./components/Button";
import { TodoCard } from "./components/TodoCard";
import { Todo } from "./types";

interface TodoProps {
  initialTodos: Todo[];
  handleAddTodo: (text: string) => void;
  handleRemoveTodo: (id: number) => void;
}

const Todoapp: React.FC<TodoProps> = ({
  initialTodos,
  handleAddTodo,
  handleRemoveTodo,
}) => {
  return (
    <div class="todo-app">
      <input type="text" id="todoInput" placeholder="Add a new todo" />
      <DefaultButton color="primary" label="Add" onClick={handleAddTodo}>
        Add
      </DefaultButton>
      <ul id="todoList">
        <TodoCard onClick={() => handleRemoveTodo(1)}>
          Learn JavaScript
        </TodoCard>
        <TodoCard onClick={() => handleRemoveTodo(2)}>
          Build a todo app
        </TodoCard>
      </ul>
    </div>
  );
};

export default Todoapp;
