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
<script>
  import { defineComponent } from 'vue';
  import { ref } from 'vue';


  export default defineComponent({
    name: 'TodoApp',
    props: {

    },

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

  });
</script>
<style scoped></style>
