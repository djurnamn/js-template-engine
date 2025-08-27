# Extension Development Guide

## Overview

This guide provides comprehensive instructions for building new extensions for the JS Template Engine's concept-driven architecture. Whether you're creating framework extensions, styling extensions, or utility extensions, this guide covers the complete development process.

## Extension Types

### 1. Framework Extensions
Generate framework-specific output (React, Vue, Svelte, Angular, Solid.js, etc.)

### 2. Styling Extensions  
Process styling concepts (BEM, Tailwind, CSS Modules, Styled Components, etc.)

### 3. Utility Extensions
Post-process concepts and output (optimization, validation, accessibility, etc.)

## Framework Extension Development

Framework extensions are the most complex, handling concept processing and component rendering.

### Basic Structure

```typescript
import type {
  FrameworkExtension,
  ExtensionMetadata,
  RenderContext,
  EventConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
  ComponentConcept
} from '@js-template-engine/core';

export class MyFrameworkExtension implements FrameworkExtension {
  public metadata: ExtensionMetadata & { type: 'framework' } = {
    type: 'framework',
    key: 'my-framework',
    name: 'My Framework Extension',
    version: '1.0.0',
    description: 'Generates components for MyFramework',
    aliases: ['myfw']
  };

  public framework = 'my-framework' as const;

  // Required concept processing methods
  processEvents(events: EventConcept[]): FrameworkEventOutput { /* ... */ }
  processConditionals(conditionals: ConditionalConcept[]): FrameworkConditionalOutput { /* ... */ }
  processIterations(iterations: IterationConcept[]): FrameworkIterationOutput { /* ... */ }
  processSlots(slots: SlotConcept[]): FrameworkSlotOutput { /* ... */ }
  processAttributes(attributes: AttributeConcept[]): FrameworkAttributeOutput { /* ... */ }
  
  // Required rendering method
  renderComponent(concepts: ComponentConcept, context: RenderContext): string { /* ... */ }
}
```

### Event Processing

Transform abstract event concepts into framework-specific syntax:

```typescript
processEvents(events: EventConcept[]): FrameworkEventOutput {
  const processedEvents = events.map(event => {
    // Transform event name to framework convention
    const frameworkEventName = this.transformEventName(event.name);
    
    // Handle event modifiers (prevent, stop, once, etc.)
    const handler = this.formatEventHandler(event.handler, event.modifiers);
    
    return {
      attribute: frameworkEventName,
      handler: handler,
      syntax: `${frameworkEventName}="${handler}"`
    };
  });

  // Return attributes for element rendering
  const attributes: Record<string, string> = {};
  processedEvents.forEach(event => {
    attributes[event.attribute] = event.handler;
  });

  return { attributes, imports: [] };
}

private transformEventName(eventName: string): string {
  // Examples of framework-specific transformations:
  // React: 'click' → 'onClick'  
  // Vue: 'click' → '@click'
  // Svelte: 'click' → 'on:click'
  // Angular: 'click' → '(click)'
  
  switch (this.framework) {
    case 'react':
      return `on${eventName.charAt(0).toUpperCase() + eventName.slice(1)}`;
    case 'vue':
      return `@${eventName}`;
    case 'svelte':
      return `on:${eventName}`;
    case 'angular':
      return `(${eventName})`;
    default:
      return eventName;
  }
}
```

### Conditional Processing

Handle if/else rendering patterns:

```typescript
processConditionals(conditionals: ConditionalConcept[]): FrameworkConditionalOutput {
  const processedConditionals = conditionals.map(conditional => {
    const thenContent = this.renderNodes(conditional.thenNodes);
    const elseContent = conditional.elseNodes ? 
      this.renderNodes(conditional.elseNodes) : null;
    
    return {
      condition: conditional.condition,
      thenContent,
      elseContent,
      syntax: this.generateConditionalSyntax(conditional, thenContent, elseContent)
    };
  });

  const syntax = processedConditionals.map(c => c.syntax).join('\n');
  return { syntax, imports: [] };
}

private generateConditionalSyntax(
  conditional: ConditionalConcept,
  thenContent: string,
  elseContent: string | null
): string {
  // Framework-specific conditional syntax:
  
  // React JSX:
  if (this.framework === 'react') {
    return elseContent ?
      `{${conditional.condition} ? (${thenContent}) : (${elseContent})}` :
      `{${conditional.condition} && (${thenContent})}`;
  }
  
  // Vue template:
  if (this.framework === 'vue') {
    return elseContent ?
      `<template v-if="${conditional.condition}">${thenContent}</template>
       <template v-else>${elseContent}</template>` :
      `<template v-if="${conditional.condition}">${thenContent}</template>`;
  }
  
  // Svelte:
  if (this.framework === 'svelte') {
    return elseContent ?
      `{#if ${conditional.condition}}${thenContent}{:else}${elseContent}{/if}` :
      `{#if ${conditional.condition}}${thenContent}{/if}`;
  }
  
  return thenContent; // Fallback
}
```

### Iteration Processing

Handle list/array rendering:

```typescript
processIterations(iterations: IterationConcept[]): FrameworkIterationOutput {
  const processedIterations = iterations.map(iteration => {
    const childContent = this.renderNodes(iteration.childNodes);
    const keyExpression = iteration.keyExpression || 'index';
    
    return {
      items: iteration.items,
      itemVariable: iteration.itemVariable,
      indexVariable: iteration.indexVariable,
      keyExpression,
      childContent,
      syntax: this.generateIterationSyntax(iteration, childContent, keyExpression)
    };
  });

  const syntax = processedIterations.map(i => i.syntax).join('\n');
  return { syntax, imports: this.getIterationImports() };
}

private generateIterationSyntax(
  iteration: IterationConcept,
  childContent: string,
  keyExpression: string
): string {
  // React:
  if (this.framework === 'react') {
    const mapParams = iteration.indexVariable ?
      `(${iteration.itemVariable}, ${iteration.indexVariable})` :
      iteration.itemVariable;
    
    return `{${iteration.items}.map(${mapParams} => (
      <React.Fragment key={${keyExpression}}>
        ${childContent}
      </React.Fragment>
    ))}`;
  }
  
  // Vue:
  if (this.framework === 'vue') {
    const vForExpression = iteration.indexVariable ?
      `(${iteration.itemVariable}, ${iteration.indexVariable}) in ${iteration.items}` :
      `${iteration.itemVariable} in ${iteration.items}`;
      
    return `<template v-for="${vForExpression}" :key="${keyExpression}">
      ${childContent}
    </template>`;
  }
  
  // Svelte:
  if (this.framework === 'svelte') {
    const eachExpression = iteration.indexVariable ?
      `${iteration.items} as ${iteration.itemVariable}, ${iteration.indexVariable}` :
      `${iteration.items} as ${iteration.itemVariable}`;
      
    return `{#each ${eachExpression} (${keyExpression})}
      ${childContent}
    {/each}`;
  }
  
  return childContent; // Fallback
}
```

### Slot Processing

Handle content projection:

```typescript
processSlots(slots: SlotConcept[]): FrameworkSlotOutput {
  const processedSlots = slots.map(slot => {
    const propName = this.normalizeSlotName(slot.name);
    const fallbackContent = slot.fallback ? this.renderNodes(slot.fallback) : null;
    
    return {
      name: slot.name,
      propName,
      fallback: fallbackContent,
      syntax: this.generateSlotSyntax(propName, fallbackContent)
    };
  });

  const syntax = processedSlots.map(s => s.syntax).join('\n');
  const props: Record<string, string> = {};
  
  // Generate prop types for slots
  processedSlots.forEach(slot => {
    props[slot.propName] = this.getSlotPropType();
  });

  return { syntax, props, imports: [] };
}

private generateSlotSyntax(propName: string, fallback: string | null): string {
  // React:
  if (this.framework === 'react') {
    return fallback ?
      `{props.${propName} || (${fallback})}` :
      `{props.${propName}}`;
  }
  
  // Vue:
  if (this.framework === 'vue') {
    return fallback ?
      `<slot name="${propName}">${fallback}</slot>` :
      `<slot name="${propName}"></slot>`;
  }
  
  // Svelte:
  if (this.framework === 'svelte') {
    return fallback ?
      `<slot name="${propName}">${fallback}</slot>` :
      `<slot name="${propName}"></slot>`;
  }
  
  return '';
}
```

### Component Rendering

Generate the final component output:

```typescript
renderComponent(concepts: ComponentConcept, context: RenderContext): string {
  // 1. Generate component metadata
  const componentName = this.resolveComponentName(context);
  const imports = this.generateImports(concepts, context);
  const props = this.generateProps(concepts);
  
  // 2. Process template
  const template = this.renderTemplate(concepts);
  
  // 3. Generate framework-specific output
  return this.generateComponentOutput({
    name: componentName,
    imports,
    props, 
    template,
    concepts,
    context
  });
}

private generateComponentOutput(config: ComponentConfig): string {
  const { name, imports, props, template } = config;
  
  // React JSX component:
  if (this.framework === 'react') {
    const importSection = imports.join('\n');
    const propsInterface = this.generatePropsInterface(name, props);
    const componentFunction = `
      const ${name}: React.FC<${name}Props> = (props) => {
        return (
          ${template}
        );
      };
    `;
    
    return [importSection, propsInterface, componentFunction, `export default ${name};`]
      .join('\n\n');
  }
  
  // Vue SFC:
  if (this.framework === 'vue') {
    return `
      <template>
        ${template}
      </template>
      
      <script setup lang="ts">
        ${imports.join('\n')}
        
        interface Props {
          ${Object.entries(props).map(([key, type]) => `${key}?: ${type}`).join('\n  ')}
        }
        
        const props = defineProps<Props>();
      </script>
    `;
  }
  
  // Svelte component:
  if (this.framework === 'svelte') {
    const scriptSection = imports.length > 0 ? 
      `<script lang="ts">\n  ${imports.join('\n  ')}\n  ${this.generateSvelteProps(props)}\n</script>\n\n` : 
      '';
    
    return `${scriptSection}${template}`;
  }
  
  return template; // Fallback
}
```

## Styling Extension Development

Styling extensions process styling concepts and generate CSS/SCSS output.

### Basic Structure

```typescript
import type {
  StylingExtension,
  ExtensionMetadata,
  StylingConcept,
  StyleOutput
} from '@js-template-engine/core';

export class MyStylingExtension implements StylingExtension {
  public metadata: ExtensionMetadata & { type: 'styling' } = {
    type: 'styling',
    key: 'my-styling',
    name: 'My Styling Extension',
    version: '1.0.0',
    description: 'Generates custom CSS methodology'
  };

  public styling = 'my-styling' as const;

  processStyles(concepts: StylingConcept): StyleOutput {
    // Generate per-element classes
    const perElementClasses = this.generatePerElementClasses(concepts);
    
    // Generate CSS output
    const styles = this.generateCss(perElementClasses);
    
    // Return updated styling concept
    const updatedStyling: StylingConcept = {
      ...concepts,
      perElementClasses: {
        ...concepts.perElementClasses,
        ...perElementClasses
      }
    };
    
    return {
      styles,
      imports: this.getRequiredImports(),
      updatedStyling
    };
  }
}
```

### Example: Atomic CSS Extension

```typescript
export class AtomicCssExtension implements StylingExtension {
  public metadata: ExtensionMetadata & { type: 'styling' } = {
    type: 'styling',
    key: 'atomic-css',
    name: 'Atomic CSS Extension',
    version: '1.0.0'
  };

  public styling = 'atomic-css' as const;

  processStyles(concepts: StylingConcept): StyleOutput {
    const perElementClasses: Record<string, string[]> = {};
    const generatedClasses = new Set<string>();
    
    // Process extension data to generate atomic classes
    if (concepts.extensionData?.atomic) {
      for (const atomicNode of concepts.extensionData.atomic) {
        const classes: string[] = [];
        
        // Generate atomic classes from style properties
        if (atomicNode.data.styles) {
          for (const [property, value] of Object.entries(atomicNode.data.styles)) {
            const atomicClass = this.generateAtomicClass(property, value);
            classes.push(atomicClass);
            generatedClasses.add(atomicClass);
          }
        }
        
        perElementClasses[atomicNode.nodeId] = classes;
      }
    }
    
    // Generate CSS for atomic classes
    const css = this.generateAtomicCss(generatedClasses);
    
    return {
      styles: css,
      imports: [],
      updatedStyling: {
        ...concepts,
        perElementClasses: {
          ...concepts.perElementClasses,
          ...perElementClasses
        }
      }
    };
  }

  private generateAtomicClass(property: string, value: string): string {
    // Convert CSS property-value to atomic class name
    // e.g., 'color: red' → 'color-red'
    const normalizedProperty = property.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
    const normalizedValue = value.replace(/[^a-zA-Z0-9]/g, '-');
    return `${normalizedProperty}-${normalizedValue}`;
  }

  private generateAtomicCss(classes: Set<string>): string {
    const cssRules: string[] = [];
    
    for (const className of classes) {
      const [property, ...valueParts] = className.split('-');
      const value = valueParts.join('-').replace(/-/g, ' ');
      
      cssRules.push(`.${className} { ${property}: ${value}; }`);
    }
    
    return cssRules.join('\n');
  }
}
```

## Utility Extension Development

Utility extensions perform post-processing operations on concepts.

### Basic Structure

```typescript
import type {
  UtilityExtension,
  ExtensionMetadata,
  ComponentConcept
} from '@js-template-engine/core';

export class MyUtilityExtension implements UtilityExtension {
  public metadata: ExtensionMetadata & { type: 'utility' } = {
    type: 'utility',
    key: 'my-utility',
    name: 'My Utility Extension',
    version: '1.0.0'
  };

  process(concepts: ComponentConcept): ComponentConcept {
    // Process and return modified concepts
    return {
      ...concepts,
      // Apply transformations
    };
  }
}
```

### Example: Accessibility Utility Extension

```typescript
export class AccessibilityUtilityExtension implements UtilityExtension {
  public metadata: ExtensionMetadata & { type: 'utility' } = {
    type: 'utility',
    key: 'accessibility',
    name: 'Accessibility Utility Extension',
    version: '1.0.0',
    description: 'Adds accessibility improvements to components'
  };

  process(concepts: ComponentConcept): ComponentConcept {
    return {
      ...concepts,
      attributes: this.addAccessibilityAttributes(concepts.attributes),
      structure: this.addAriaLabels(concepts.structure),
      events: this.addKeyboardSupport(concepts.events)
    };
  }

  private addAccessibilityAttributes(attributes: AttributeConcept[]): AttributeConcept[] {
    const enhancedAttributes = [...attributes];
    
    // Add missing alt attributes for images
    const hasAltAttribute = attributes.some(attr => attr.name === 'alt');
    if (!hasAltAttribute && this.hasImageElements(concepts.structure)) {
      enhancedAttributes.push({
        nodeId: 'generated-alt',
        name: 'alt',
        value: '',
        isExpression: false
      });
    }
    
    return enhancedAttributes;
  }

  private addAriaLabels(structure: StructuralConcept[]): StructuralConcept[] {
    return structure.map(element => {
      // Add aria-label for buttons without text content
      if (element.tag === 'button' && !this.hasTextContent(element)) {
        return {
          ...element,
          attributes: {
            ...element.attributes,
            'aria-label': element.attributes?.title || 'Button'
          }
        };
      }
      
      return element;
    });
  }

  private addKeyboardSupport(events: EventConcept[]): EventConcept[] {
    const enhancedEvents = [...events];
    
    // Add keyboard support for click events
    for (const event of events) {
      if (event.name === 'click') {
        // Add corresponding keydown event
        enhancedEvents.push({
          nodeId: event.nodeId + '-keyboard',
          name: 'keydown',
          handler: `handleKeyDown(${event.handler})`,
          modifiers: ['enter', 'space']
        });
      }
    }
    
    return enhancedEvents;
  }
}
```

## Extension Testing

### Unit Testing Framework Extensions

```typescript
import { describe, it, expect } from 'vitest';
import { MyFrameworkExtension } from './MyFrameworkExtension';

describe('MyFrameworkExtension', () => {
  const extension = new MyFrameworkExtension();

  describe('processEvents', () => {
    it('should transform click events correctly', () => {
      const events = [
        { nodeId: '1', name: 'click', handler: 'handleClick' }
      ];

      const result = extension.processEvents(events);

      expect(result.attributes).toEqual({
        'onClick': 'handleClick' // or framework-specific format
      });
    });

    it('should handle event modifiers', () => {
      const events = [
        { 
          nodeId: '1', 
          name: 'click', 
          handler: 'handleClick',
          modifiers: ['prevent', 'stop'] 
        }
      ];

      const result = extension.processEvents(events);
      
      expect(result.attributes.onClick).toContain('preventDefault');
      expect(result.attributes.onClick).toContain('stopPropagation');
    });
  });

  describe('renderComponent', () => {
    it('should generate valid component output', () => {
      const concepts = createTestConcepts();
      const context = createTestContext();

      const output = extension.renderComponent(concepts, context);

      expect(output).toContain('<div'); // Basic structure check
      expect(output).toContain('export default'); // Export check
    });
  });
});
```

### Integration Testing

```typescript
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { MyFrameworkExtension } from './MyFrameworkExtension';

describe('MyFrameworkExtension Integration', () => {
  it('should work with BEM styling extension', async () => {
    const registry = new ExtensionRegistry();
    registry.registerFramework(new MyFrameworkExtension());
    registry.registerStyling(new BemStylingExtension());
    
    const pipeline = new ProcessingPipeline(registry);
    
    const template = [
      { 
        type: 'element', 
        tag: 'div',
        extensions: { bem: { block: 'card', element: 'header' } }
      }
    ];
    
    const result = await pipeline.process(template, {
      framework: 'my-framework',
      styling: 'bem'
    });
    
    expect(result.output).toContain('card__header');
    expect(result.errors.hasErrors()).toBe(false);
  });
});
```

## Extension Registration

### Manual Registration

```typescript
import { ExtensionRegistry, ProcessingPipeline } from '@js-template-engine/core';
import { MyFrameworkExtension } from './MyFrameworkExtension';

const registry = new ExtensionRegistry();
const registrationResult = registry.registerFramework(new MyFrameworkExtension());

if (!registrationResult.isValid) {
  console.error('Registration failed:', registrationResult.errors);
}

const pipeline = new ProcessingPipeline(registry);
```

### Package.json Integration

For npm packages, include extension metadata:

```json
{
  "name": "@company/my-framework-extension",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "jsTemplateEngine": {
    "type": "framework",
    "key": "my-framework",
    "entryPoint": "dist/index.js",
    "dependencies": ["@js-template-engine/core"]
  },
  "peerDependencies": {
    "@js-template-engine/core": "^1.0.0"
  }
}
```

## Best Practices

### 1. Extension Design Principles

- **Single Responsibility**: Each extension should handle one concern
- **Framework Agnostic Concepts**: Work with abstract concepts, not framework specifics
- **Error Handling**: Provide meaningful error messages and graceful degradation
- **Performance**: Minimize concept mutations and expensive operations
- **Validation**: Validate inputs and provide helpful warnings

### 2. Concept Processing Guidelines

- **Immutable Concepts**: Don't modify input concepts directly
- **Efficient Lookups**: Use Maps and Sets for O(1) lookups when possible
- **Memory Management**: Avoid unnecessary object creation in hot paths
- **Type Safety**: Use TypeScript strictly for better developer experience

### 3. Output Generation

- **Consistent Formatting**: Follow framework conventions for generated code
- **Readable Output**: Generate human-readable, well-formatted code
- **Import Management**: Handle imports efficiently and avoid duplicates
- **Error Recovery**: Handle missing or invalid concepts gracefully

### 4. Testing Strategy

- **Unit Tests**: Test each concept processing method independently
- **Integration Tests**: Test extension coordination with other extensions
- **Snapshot Tests**: Verify generated output against expected results
- **Error Cases**: Test error handling and edge cases

## Advanced Extension Features

### 1. Custom Processors

Extensions can include custom processors for complex transformations:

```typescript
export class AdvancedFrameworkExtension extends MyFrameworkExtension {
  private customProcessor = new CustomConceptProcessor();

  processEvents(events: EventConcept[]): FrameworkEventOutput {
    // Use custom processor for complex event handling
    const processedEvents = this.customProcessor.processAdvancedEvents(events);
    return super.processEvents(processedEvents);
  }
}
```

### 2. Extension Configuration

Support runtime configuration through options:

```typescript
interface MyExtensionOptions {
  generateTypes?: boolean;
  outputFormat?: 'esm' | 'cjs';
  optimization?: boolean;
}

export class ConfigurableExtension implements FrameworkExtension {
  constructor(private options: MyExtensionOptions = {}) {}

  renderComponent(concepts: ComponentConcept, context: RenderContext): string {
    if (this.options.generateTypes) {
      return this.generateTypedComponent(concepts, context);
    }
    return this.generateBasicComponent(concepts, context);
  }
}
```

### 3. Extension Hooks

Implement hooks for extensibility:

```typescript
export interface ExtensionHooks {
  beforeProcessing?(concepts: ComponentConcept): ComponentConcept;
  afterProcessing?(result: ProcessingResult): ProcessingResult;
}

export class HookableExtension implements FrameworkExtension {
  constructor(private hooks: ExtensionHooks = {}) {}

  renderComponent(concepts: ComponentConcept, context: RenderContext): string {
    const processedConcepts = this.hooks.beforeProcessing?.(concepts) || concepts;
    const output = this.doRenderComponent(processedConcepts, context);
    
    return output;
  }
}
```

## Extension Publishing

### 1. Package Structure

```
my-extension/
├── src/
│   ├── index.ts
│   ├── MyExtension.ts
│   └── types.ts
├── __tests__/
│   └── MyExtension.test.ts
├── dist/
├── package.json
├── README.md
└── tsconfig.json
```

### 2. Build Configuration

```json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "prepublishOnly": "npm run test && npm run build"
  },
  "files": [
    "dist/**/*",
    "README.md"
  ],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

### 3. Documentation

Include comprehensive documentation:

- Extension purpose and capabilities
- Installation and usage instructions
- Configuration options
- Examples and recipes
- Migration guides (if applicable)

---

*This guide provides the foundation for building robust, efficient extensions that integrate seamlessly with the JS Template Engine's concept-driven architecture.*