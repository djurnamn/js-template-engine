<template>
  <div class="todo-app">
    <input type="text" id="todoInput" placeholder="Add a new todo" /><button
      onclick="handleAddTodo"
    >
      Add
    </button>
    <ul id="todoList">
      <li>Learn JavaScript</li>
      <li>Build a todo app</li>
    </ul>
  </div>
</template>
<script>


    props: {

    },

  export default {
    name: 'TodoApp',

  };
</script>
