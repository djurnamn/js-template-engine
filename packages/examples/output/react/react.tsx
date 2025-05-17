import React, { useState } from "react";
import { DefaultButton } from "./components/Button";
import { TodoCard } from "./components/TodoCard";
import { Todo } from "./types";

interface TodoappProps {}

const Todoapp: React.FC<TodoappProps> = ({
  initialTodos,
  handleAddTodo,
  handleRemoveTodo,
}) => {
  function handleAddTodo() {
    const todoList = document.getElementById("todoList");
    const newTodoText = document.getElementById("todoInput").value;
    const newTodoItem = document.createElement("li");

    newTodoItem.textContent = newTodoText;
    todoList.appendChild(newTodoItem);

    document.getElementById("todoInput").value = ""; // Clear the input field
  }

  function handleRemoveTodo(id: number) {
    const todoList = document.getElementById("todoList");
    const todoItem = document.getElementById(`todo-${id}`);
    if (todoItem) {
      todoList?.removeChild(todoItem);
    }
  }

  return (
    <div className="todo-app">
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
