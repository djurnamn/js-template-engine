<template>
  <div class="todo-app">
    <input type="text" id="todoInput" placeholder="Add a new todo" /><button
      :onClick="handleAddTodo"
      color="primary"
      label="Add"
    >
      Add
    </button>
    <ul id="todoList">
      <li :onClick="() => handleRemoveTodo(1)">Learn JavaScript</li>
      <li :onClick="() => handleRemoveTodo(2)">Build a todo app</li>
    </ul>
  </div>
</template>

<script lang="js">
  import { computed, defineComponent, onMounted, ref, watch } from "vue";

  export default defineComponent({
    name: "TodoApp",

    setup() {
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
          const todoItem = document.getElementById(`todo-${id}`);
          if (todoItem) {
            todoList?.removeChild(todoItem);
          }
        }
    }
  });
</script>
