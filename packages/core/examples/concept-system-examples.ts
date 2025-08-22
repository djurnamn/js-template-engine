/**
 * Practical examples demonstrating the new concept-driven extension system.
 * These examples show real-world usage patterns and best practices.
 */

import { TemplateEngine } from '../src/engine/TemplateEngine';
import type { FrameworkExtension, StylingExtension, UtilityExtension } from '../src/extensions';

// ===== MOCK EXTENSIONS FOR EXAMPLES =====

// Mock React Extension
const ReactExtension: FrameworkExtension = {
  metadata: {
    type: 'framework',
    key: 'react',
    name: 'React Extension',
    version: '2.0.0'
  },
  framework: 'react',
  
  processEvents(events) {
    const attributes: Record<string, string> = {};
    for (const event of events) {
      const eventName = 'on' + event.name.charAt(0).toUpperCase() + event.name.slice(1);
      attributes[eventName] = `{${event.handler}}`;
    }
    return { attributes };
  },
  
  processConditionals(conditionals) {
    let syntax = '';
    for (const cond of conditionals) {
      syntax += `{${cond.condition} && (<div>Content</div>)}`;
    }
    return { syntax };
  },
  
  processIterations(iterations) {
    let syntax = '';
    for (const iter of iterations) {
      syntax += `{${iter.items}.map(${iter.itemVariable} => <div key={${iter.keyExpression || 'index'}}>Item</div>)}`;
    }
    return { syntax };
  },
  
  processSlots(slots) {
    const props: Record<string, string> = {};
    let syntax = '';
    for (const slot of slots) {
      const propName = slot.name === 'default' ? 'children' : slot.name;
      props[propName] = 'React.ReactNode';
      syntax += `{props.${propName}}`;
    }
    return { syntax, props };
  },
  
  processAttributes(attributes) {
    const attrs: Record<string, string> = {};
    for (const attr of attributes) {
      if (attr.name === 'class') {
        attrs.className = attr.isExpression ? `{${attr.value}}` : `"${attr.value}"`;
      } else {
        attrs[attr.name] = attr.isExpression ? `{${attr.value}}` : `"${attr.value}"`;
      }
    }
    return { attributes: attrs };
  },
  
  renderComponent(concepts, context) {
    const name = context.component?.name || 'Component';
    return `const ${name} = (props) => {
  return (
    <div className="rendered-component">
      Component content
    </div>
  );
};

export default ${name};`;
  }
};

// Mock BEM Extension
const BemExtension: StylingExtension = {
  metadata: {
    type: 'styling',
    key: 'bem',
    name: 'BEM Extension',
    version: '2.0.0'
  },
  styling: 'bem',
  
  processStyles(concept) {
    const classes = [
      ...concept.staticClasses,
      ...concept.dynamicClasses
    ];
    
    let styles = '';
    for (const cls of classes) {
      styles += `.${cls} {
  /* BEM styles for ${cls} */
}

`;
    }
    
    return { styles };
  }
};

// Mock Linter Utility Extension
const LinterExtension: UtilityExtension = {
  metadata: {
    type: 'utility',
    key: 'linter',
    name: 'Template Linter',
    version: '1.0.0'
  },
  utility: 'linter',
  
  process(concepts) {
    // Add linting metadata
    return {
      ...concepts,
      metadata: {
        ...concepts.metadata,
        linted: true,
        lintWarnings: concepts.events.filter(e => !e.handler).length
      }
    };
  }
};

// ===== EXAMPLE FUNCTIONS =====

/**
 * Example 1: Basic Setup and Simple Template Rendering
 */
export async function basicExample() {
  console.log('\n=== BASIC EXAMPLE ===');
  
  // Create engine with default configuration
  const engine = new TemplateEngine({
    defaultFramework: 'react',
    defaultStyling: 'bem'
  });
  
  // Register extensions
  engine.registerFramework(ReactExtension);
  engine.registerStyling(BemExtension);
  
  // Simple template
  const template = [
    {
      type: 'element' as const,
      tag: 'button',
      attributes: {
        class: 'button button--primary',
        type: 'submit'
      },
      expressionAttributes: {
        onClick: 'handleSubmit'
      },
      children: [
        { type: 'text' as const, content: 'Submit' }
      ]
    }
  ];
  
  // Render template
  const result = await engine.render(template, {
    component: { name: 'SubmitButton' }
  });
  
  console.log('Generated Code:');
  console.log(result.output);
  console.log('\nMetadata:');
  console.log(JSON.stringify(result.metadata, null, 2));
  
  return result;
}

/**
 * Example 2: Complex Template with All Concept Types
 */
export async function complexTemplateExample() {
  console.log('\n=== COMPLEX TEMPLATE EXAMPLE ===');
  
  const engine = new TemplateEngine();
  engine.registerFramework(ReactExtension);
  engine.registerStyling(BemExtension);
  engine.registerUtility(LinterExtension);
  
  // Complex template demonstrating all concept types
  const template = [
    {
      type: 'element' as const,
      tag: 'div',
      attributes: {
        class: 'todo-app',
        id: 'app'
      },
      children: [
        // Header with event
        {
          type: 'element' as const,
          tag: 'header',
          attributes: { class: 'header' },
          children: [
            {
              type: 'element' as const,
              tag: 'h1',
              expressionAttributes: {
                onClick: 'handleTitleClick'
              },
              children: [
                { type: 'text' as const, content: 'Todo App' }
              ]
            }
          ]
        },
        
        // Conditional rendering
        {
          type: 'if' as const,
          condition: 'showAddForm',
          then: [
            {
              type: 'element' as const,
              tag: 'form',
              attributes: { class: 'add-form' },
              expressionAttributes: {
                onSubmit: 'handleAddTodo'
              },
              children: [
                {
                  type: 'element' as const,
                  tag: 'input',
                  attributes: {
                    type: 'text',
                    placeholder: 'Add todo...'
                  },
                  expressionAttributes: {
                    value: 'newTodoText',
                    onChange: 'handleInputChange'
                  }
                }
              ]
            }
          ]
        },
        
        // Iteration
        {
          type: 'for' as const,
          items: 'todos',
          item: 'todo',
          index: 'index',
          key: 'todo.id',
          children: [
            {
              type: 'element' as const,
              tag: 'div',
              attributes: { class: 'todo-item' },
              children: [
                {
                  type: 'slot' as const,
                  name: 'todo-content',
                  fallback: [
                    {
                      type: 'element' as const,
                      tag: 'span',
                      children: [
                        { type: 'text' as const, content: '{{ todo.text }}' }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ];
  
  const result = await engine.render(template, {
    framework: 'react',
    styling: 'bem',
    utilities: ['linter'],
    component: {
      name: 'TodoApp',
      props: {
        todos: 'Todo[]',
        showAddForm: 'boolean'
      }
    }
  });
  
  console.log('Generated Code:');
  console.log(result.output);
  console.log('\nConcepts Found:');
  console.log(`Events: ${result.metadata.conceptsFound.events}`);
  console.log(`Styling: ${result.metadata.conceptsFound.styling}`);
  console.log(`Conditionals: ${result.metadata.conceptsFound.conditionals}`);
  console.log(`Iterations: ${result.metadata.conceptsFound.iterations}`);
  console.log(`Slots: ${result.metadata.conceptsFound.slots}`);
  console.log(`Attributes: ${result.metadata.conceptsFound.attributes}`);
  
  return result;
}

/**
 * Example 3: Multi-Framework Support
 */
export async function multiFrameworkExample() {
  console.log('\n=== MULTI-FRAMEWORK EXAMPLE ===');
  
  // Mock Vue Extension
  const VueExtension: FrameworkExtension = {
    ...ReactExtension,
    metadata: { ...ReactExtension.metadata, key: 'vue' },
    framework: 'vue',
    
    processEvents(events) {
      const attributes: Record<string, string> = {};
      for (const event of events) {
        attributes[`@${event.name}`] = event.handler;
      }
      return { attributes };
    },
    
    renderComponent(concepts, context) {
      const name = context.component?.name || 'Component';
      return `<template>
  <div class="vue-component">
    Component content
  </div>
</template>

<script>
export default {
  name: '${name}'
}
</script>`;
    }
  };
  
  const engine = new TemplateEngine();
  engine.registerFramework(ReactExtension);
  engine.registerFramework(VueExtension);
  engine.registerStyling(BemExtension);
  
  const template = [
    {
      type: 'element' as const,
      tag: 'button',
      attributes: { class: 'btn' },
      expressionAttributes: { onClick: 'handleClick' },
      children: [
        { type: 'text' as const, content: 'Click me' }
      ]
    }
  ];
  
  // Same template, different frameworks
  const reactResult = await engine.render(template, {
    framework: 'react',
    component: { name: 'ReactButton' }
  });
  
  const vueResult = await engine.render(template, {
    framework: 'vue',
    component: { name: 'VueButton' }
  });
  
  console.log('React Output:');
  console.log(reactResult.output);
  console.log('\nVue Output:');
  console.log(vueResult.output);
  
  return { reactResult, vueResult };
}

/**
 * Example 4: Template Analysis Without Rendering
 */
export async function analysisExample() {
  console.log('\n=== TEMPLATE ANALYSIS EXAMPLE ===');
  
  const engine = new TemplateEngine();
  
  const template = [
    {
      type: 'element' as const,
      tag: 'div',
      attributes: {
        class: 'container',
        id: 'main',
        'data-testid': 'container'
      },
      expressionAttributes: {
        onClick: 'handleClick',
        onMouseEnter: 'handleHover'
      },
      children: [
        {
          type: 'if' as const,
          condition: 'isVisible',
          then: [
            {
              type: 'for' as const,
              items: 'items',
              item: 'item',
              children: [
                {
                  type: 'slot' as const,
                  name: 'item-template'
                }
              ]
            }
          ]
        }
      ]
    }
  ];
  
  // Analyze without rendering
  const analysis = await engine.analyze(template);
  
  console.log('Template Analysis:');
  console.log('\nEvents found:');
  analysis.concepts.events.forEach((event: any) => {
    console.log(`- ${event.name}: ${event.handler}`);
  });
  
  console.log('\nStyling:');
  console.log(`- Static classes: ${analysis.concepts.styling.staticClasses.join(', ')}`);
  console.log(`- Dynamic classes: ${analysis.concepts.styling.dynamicClasses.join(', ')}`);
  
  console.log('\nConditionals:');
  analysis.concepts.conditionals.forEach((cond: any) => {
    console.log(`- Condition: ${cond.condition}`);
  });
  
  console.log('\nIterations:');
  analysis.concepts.iterations.forEach((iter: any) => {
    console.log(`- ${iter.itemVariable} in ${iter.items}`);
  });
  
  console.log('\nSlots:');
  analysis.concepts.slots.forEach((slot: any) => {
    console.log(`- Slot: ${slot.name}`);
  });
  
  console.log('\nAttributes:');
  analysis.concepts.attributes.forEach((attr: any) => {
    console.log(`- ${attr.name}: ${attr.value} (expression: ${attr.isExpression})`);
  });
  
  return analysis;
}

/**
 * Example 5: Error Handling and Debugging
 */
export async function errorHandlingExample() {
  console.log('\n=== ERROR HANDLING EXAMPLE ===');
  
  const engine = new TemplateEngine({
    verboseErrors: true
  });
  
  engine.registerFramework(ReactExtension);
  
  // Template with potential issues
  const problematicTemplate = [
    {
      type: 'if' as const,
      // Missing condition - should generate warning
      then: [
        { type: 'text' as const, content: 'Content' }
      ]
    },
    {
      type: 'for' as const,
      items: 'items',
      // Missing item variable - should generate warning
      children: []
    },
    {
      type: 'slot' as const,
      // Missing name - should generate warning
    }
  ];
  
  const result = await engine.render(problematicTemplate, {
    framework: 'react'
  });
  
  console.log('Generated Output:');
  console.log(result.output);
  
  console.log('\nError Analysis:');
  console.log(`Has errors: ${result.errors.hasErrors()}`);
  console.log(`Has warnings: ${result.errors.hasWarnings()}`);
  console.log(`Total issues: ${result.errors.getErrorCount()}`);
  
  if (result.errors.hasWarnings()) {
    console.log('\nWarnings:');
    const warnings = result.errors.getErrorsBySeverity('warning');
    warnings.forEach(warning => {
      console.log(`- ${warning.message} (at ${warning.nodeId})`);
    });
  }
  
  if (result.errors.hasErrors()) {
    console.log('\nErrors:');
    console.log(result.errors.formatErrors());
  }
  
  return result;
}

/**
 * Example 6: Performance Monitoring
 */
export async function performanceExample() {
  console.log('\n=== PERFORMANCE MONITORING EXAMPLE ===');
  
  const engine = new TemplateEngine({
    enablePerformanceTracking: true
  });
  
  engine.registerFramework(ReactExtension);
  engine.registerStyling(BemExtension);
  engine.registerUtility(LinterExtension);
  
  // Large template to show performance metrics
  const largeTemplate = Array.from({ length: 100 }, (_, i) => ({
    type: 'element' as const,
    tag: 'div',
    attributes: {
      class: `item-${i}`,
      id: `item-${i}`
    },
    expressionAttributes: {
      onClick: `handleClick${i}`
    },
    children: [
      {
        type: 'if' as const,
        condition: `isVisible${i}`,
        then: [
          { type: 'text' as const, content: `Item ${i}` }
        ]
      }
    ]
  }));
  
  const result = await engine.render(largeTemplate, {
    framework: 'react',
    styling: 'bem',
    utilities: ['linter']
  });
  
  console.log('Performance Metrics:');
  console.log(`Total time: ${result.performance.totalTime.toFixed(2)}ms`);
  console.log(`Concepts processed: ${result.performance.conceptCount}`);
  
  console.log('\nExtension Performance:');
  Object.entries(result.performance.extensionTimes).forEach(([ext, time]) => {
    const percentage = ((time / result.performance.totalTime) * 100).toFixed(1);
    console.log(`- ${ext}: ${time.toFixed(2)}ms (${percentage}%)`);
  });
  
  if (result.performance.memoryUsage) {
    const heapMB = (result.performance.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
    console.log(`\nMemory usage: ${heapMB}MB`);
  }
  
  return result;
}

/**
 * Example 7: Engine Configuration and Customization
 */
export async function configurationExample() {
  console.log('\n=== CONFIGURATION EXAMPLE ===');
  
  // Custom engine configuration
  const engine = new TemplateEngine({
    defaultFramework: 'react',
    defaultStyling: 'bem',
    defaultUtilities: ['linter'],
    verboseErrors: true,
    enablePerformanceTracking: true,
    analyzerOptions: {
      // Custom event prefixes for framework-specific events
      eventPrefixes: ['on', '@', 'v-on:', 'on:', 'bind:'],
      // Ignore specific attributes
      ignoreAttributes: ['key', 'ref', 'v-show'],
      // Selective concept extraction
      extractEvents: true,
      extractStyling: true,
      extractConditionals: true,
      extractIterations: true,
      extractSlots: true,
      extractAttributes: true
    }
  });
  
  // Register extensions
  engine.registerFramework(ReactExtension);
  engine.registerStyling(BemExtension);
  engine.registerUtility(LinterExtension);
  
  // Get engine status
  const status = engine.getStatus();
  console.log('Engine Status:');
  console.log(`Frameworks: ${status.frameworks.join(', ')}`);
  console.log(`Styling: ${status.styling.join(', ')}`);
  console.log(`Utilities: ${status.utilities.join(', ')}`);
  console.log(`Total extensions: ${engine.getExtensionCount()}`);
  
  // Template with custom event syntax
  const template = [
    {
      type: 'element' as const,
      tag: 'button',
      expressionAttributes: {
        'bind:click': 'customHandler', // Custom event prefix
        'on:hover': 'hoverHandler'
      },
      children: [
        { type: 'text' as const, content: 'Custom Events' }
      ]
    }
  ];
  
  const result = await engine.render(template);
  
  console.log('\nRendered with custom configuration:');
  console.log(result.output);
  
  return { engine, result };
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Running Concept System Examples');
  console.log('===================================');
  
  try {
    await basicExample();
    await complexTemplateExample();
    await multiFrameworkExample();
    await analysisExample();
    await errorHandlingExample();
    await performanceExample();
    await configurationExample();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Example failed:', error);
  }
}

// Export for individual testing
export {
  ReactExtension,
  BemExtension,
  LinterExtension
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}