<template>
  <div class="todo-app">
    <input type="text" id="todoInput" placeholder="Add a new todo" /><button
      onclick="handleAddTodo"
      color="primary"
      label="Add"
      :onClick="handleAddTodo"
    >
      Add
    </button>
    <ul id="todoList">
      <li :onClick="() => handleRemoveTodo(1)">Learn JavaScript</li>
      <li :onClick="() => handleRemoveTodo(2)">Build a todo app</li>
    </ul>
  </div>
</template>
<script lang="ts">
  import { defineComponent } from "vue";
  import { ref } from "vue";

  export default defineComponent({
    name: "TodoApp",
    props: {
      // Add your props here
    },

    setup() {
      const handleAddTodo = () => {
        const todoList = document.getElementById("todoList");
        const newTodoText = document.getElementById("todoInput").value;
        const newTodoItem = document.createElement("li");
        newTodoItem.textContent = newTodoText;
        todoList?.appendChild(newTodoItem);
        document.getElementById("todoInput").value = ""; // Clear the input field
      };

      const handleRemoveTodo = (id: number) => {
        const todoList = document.getElementById("todoList");
        const todoItem = document.getElementById(`todo-${id}`);
        if (todoItem && todoList) {
          todoList.removeChild(todoItem);
        }
      };

      return {
        handleAddTodo,
        handleRemoveTodo,
      };
    },
  });
</script>
<style scoped>
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
    background-color: #4caf50;
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
  }
</style>
