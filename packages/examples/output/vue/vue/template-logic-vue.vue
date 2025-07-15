<template>
  <!-- Vue component with template logic node types --><template
    ><header><h1>Vue Demo</h1></header>
    <main v-if="isVisible">
      <article class="item" v-for="(item, index) in items" :key="index">
        <!-- Item content here -->
        <h3>Item Title</h3>
      </article>
    </main></template
  >
</template>

<script lang="ts">
  import { defineComponent } from "vue";

  interface VueTemplateLogicDemoProps {
    items: (e: Event) => void;
    isVisible: boolean;
  }

  export default defineComponent({
    name: "VueTemplateLogicDemo",
    props: {
      items: { type: Function, required: true },
      isVisible: { type: Boolean, required: true },
    },
  });
</script>
