# Extension Coordination System

## Overview

The JS Template Engine's extension coordination system manages the interaction between framework, styling, and utility extensions through a type-safe registry and standardized interfaces. This system ensures extensions work together seamlessly while maintaining strict separation of concerns.

## Extension Registry Architecture

### Type-Safe Extension Management

```typescript
export class ExtensionRegistry {
  private frameworks = new Map<string, FrameworkExtension>();
  private styling = new Map<string, StylingExtension>();
  private utilities = new Map<string, UtilityExtension>();
  
  registerFramework(extension: FrameworkExtension): ValidationResult
  registerStyling(extension: StylingExtension): ValidationResult  
  registerUtility(extension: UtilityExtension): ValidationResult
}
```

The registry provides **type-safe** extension management with three distinct categories:

1. **Framework Extensions**: Generate framework-specific output (React, Vue, Svelte)
2. **Styling Extensions**: Process styling concepts (BEM, Tailwind)
3. **Utility Extensions**: Post-process concepts and output (optimization, validation)

### Extension Validation

Each extension undergoes comprehensive validation before registration:

```typescript
validateExtension(extension: Extension): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate metadata
  if (!extension.metadata?.key?.match(/^[a-z][a-z0-9\-]*[a-z0-9]$/)) {
    errors.push('Extension key must be lowercase alphanumeric with hyphens');
  }
  
  // Type-specific validation
  if (extension.metadata.type === 'framework') {
    const frameworkExt = extension as FrameworkExtension;
    if (!['react', 'vue', 'svelte'].includes(frameworkExt.framework)) {
      errors.push('Framework must be: react, vue, or svelte');
    }
    
    // Check required methods
    const requiredMethods = [
      'processEvents', 'processConditionals', 'processIterations',
      'processSlots', 'processAttributes', 'renderComponent'
    ];
    
    for (const method of requiredMethods) {
      if (typeof (frameworkExt as any)[method] !== 'function') {
        errors.push(`Framework extension must implement: ${method}`);
      }
    }
  }
  
  return { isValid: errors.length === 0, errors, warnings };
}
```

## Extension Types and Interfaces

### Framework Extensions

Framework extensions implement the `FrameworkExtension` interface:

```typescript
interface FrameworkExtension {
  metadata: ExtensionMetadata & { type: 'framework' };
  framework: 'react' | 'vue' | 'svelte';
  
  // Concept processing methods
  processEvents(events: EventConcept[]): FrameworkEventOutput;
  processConditionals(conditionals: ConditionalConcept[]): FrameworkConditionalOutput;
  processIterations(iterations: IterationConcept[]): FrameworkIterationOutput;
  processSlots(slots: SlotConcept[]): FrameworkSlotOutput;
  processAttributes(attributes: AttributeConcept[]): FrameworkAttributeOutput;
  
  // Final rendering
  renderComponent(concepts: ComponentConcept, context: RenderContext): string;
}
```

**Responsibilities**:
- Process behavioral concepts (events, conditionals, iterations, slots)
- Transform HTML attributes to framework-specific attributes
- Generate final component code

**Current Implementations**:
- `ReactFrameworkExtension`: Generates JSX components
- `VueFrameworkExtension`: Generates Single File Components
- `SvelteFrameworkExtension`: Generates Svelte components

### Styling Extensions

Styling extensions implement the `StylingExtension` interface:

```typescript
interface StylingExtension {
  metadata: ExtensionMetadata & { type: 'styling' };
  styling: 'bem' | 'tailwind' | 'css-modules' | 'styled-components';
  
  processStyles(styling: StylingConcept): StyleOutput;
}

interface StyleOutput {
  styles: string;              // Generated CSS/SCSS
  imports: string[];           // Required imports
  updatedStyling?: StylingConcept; // Updated styling concept
}
```

**Responsibilities**:
- Generate CSS classes and stylesheets
- Update styling concepts with generated classes
- Provide per-element styling support

**Current Implementations**:
- `BemStylingExtension`: Generates BEM classes and SCSS
- `TailwindStylingExtension`: Processes utility classes and generates CSS

### Utility Extensions

Utility extensions implement the `UtilityExtension` interface:

```typescript
interface UtilityExtension {
  metadata: ExtensionMetadata & { type: 'utility' };
  
  process(concepts: ComponentConcept): ComponentConcept;
}
```

**Responsibilities**:
- Post-process concepts for optimization
- Add functionality not covered by framework/styling extensions
- Perform validation and analysis

## Extension Coordination Mechanisms

### 1. Per-Element Styling Coordination

The most sophisticated coordination feature allows styling extensions to apply classes to specific elements:

```typescript
// BEM extension generates per-element classes
const stylingConcept: StylingConcept = {
  perElementClasses: {
    'header': ['navigation'],
    'header.logo': ['navigation__logo'],
    'header.menu': ['navigation__menu', 'navigation__menu--expanded']
  },
  extensionData: {
    bem: [
      { nodeId: 'header', data: { block: 'navigation' } },
      { nodeId: 'header.logo', data: { element: 'logo' } },
      { nodeId: 'header.menu', data: { element: 'menu', modifier: 'expanded' } }
    ]
  }
};

// Framework extension accesses per-element classes during rendering
renderStructuralElement(concept: StructuralConcept): string {
  let perElementClasses: string[] = [];
  
  if (concept.nodeId && this.concepts?.styling?.perElementClasses) {
    const elementClasses = this.concepts.styling.perElementClasses[concept.nodeId];
    if (elementClasses?.length > 0) {
      perElementClasses = elementClasses;
    }
  }
  
  // Apply classes to specific element
  const className = perElementClasses.join(' ');
  return `<${concept.tag} className="${className}">${children}</${concept.tag}>`;
}
```

### 2. Extension Data Sharing

Extensions share data through the `extensionData` mechanism:

```typescript
// Styling extension stores metadata for framework extension
const stylingConcept: StylingConcept = {
  extensionData: {
    bem: [
      {
        nodeId: 'card-1',
        data: {
          block: 'card',
          element: 'header',
          modifiers: ['primary', 'large']
        }
      }
    ],
    tailwind: {
      utilities: ['bg-blue-500', 'text-white', 'p-4'],
      responsive: { md: ['text-lg'], lg: ['text-xl'] }
    }
  }
};
```

### 3. Processing Order Coordination

Extensions are processed in a specific order to ensure proper coordination:

```typescript
// 1. Styling extensions process first (generate classes)
if (options.styling) {
  const stylingExtension = this.registry.getStyling(options.styling);
  const styleResult = stylingExtension.processStyles(concepts.styling);
  processedConcepts.styling = styleResult.updatedStyling;
}

// 2. Framework extensions use generated classes
if (options.framework) {
  const frameworkExtension = this.registry.getFramework(options.framework);
  // Framework can access styling.perElementClasses
  output = frameworkExtension.renderComponent(processedConcepts, context);
}

// 3. Utility extensions perform final post-processing
if (options.utilities) {
  for (const utilityKey of options.utilities) {
    const utilityExtension = this.registry.getUtility(utilityKey);
    processedConcepts = utilityExtension.process(processedConcepts);
  }
}
```

## Extension Interaction Patterns

### 1. BEM + React Coordination

**BEM Extension** generates classes:
```typescript
processStyles(styling: StylingConcept): StyleOutput {
  const perElementClasses = {
    'card-header': ['card__header'],
    'card-title': ['card__title', 'card__title--large'],
    'card-content': ['card__content']
  };
  
  return {
    styles: this.generateScss(perElementClasses),
    updatedStyling: {
      ...styling,
      perElementClasses
    }
  };
}
```

**React Extension** uses classes:
```typescript
renderStructuralElement(concept: StructuralConcept): string {
  const elementClasses = this.concepts?.styling?.perElementClasses?.[concept.nodeId] || [];
  const className = elementClasses.join(' ');
  
  return `<${concept.tag} className="${className}">${children}</${concept.tag}>`;
}
```

### 2. Tailwind + Vue Coordination

**Tailwind Extension** processes utilities:
```typescript
processStyles(styling: StylingConcept): StyleOutput {
  const utilities = this.extractUtilities(styling.staticClasses);
  const generatedCss = this.generateCssFromUtilities(utilities);
  
  return {
    styles: generatedCss,
    imports: ['@tailwindcss/base', '@tailwindcss/components'],
    updatedStyling: styling
  };
}
```

**Vue Extension** generates template:
```typescript
renderComponent(concepts: ComponentConcept): string {
  const template = this.renderTemplate(concepts);
  const style = this.getStylesFromConcepts(concepts);
  
  return `<template>\n${template}\n</template>\n<style>\n${style}\n</style>`;
}
```

## Extension Metadata System

### Standard Metadata

All extensions include standardized metadata:

```typescript
interface ExtensionMetadata {
  type: 'framework' | 'styling' | 'utility';
  key: string;        // Unique identifier (e.g., 'react', 'bem')
  name: string;       // Human-readable name
  version: string;    // Semantic version
  description?: string;
  author?: string;
  dependencies?: string[];
  aliases?: string[]; // Alternative keys
}
```

### Example Extension Metadata

```typescript
// React Framework Extension
export class ReactFrameworkExtension implements FrameworkExtension {
  public metadata: ExtensionMetadata & { type: 'framework' } = {
    type: 'framework',
    key: 'react',
    name: 'React Framework Extension',
    version: '1.0.0',
    description: 'Generates React JSX components',
    aliases: ['jsx', 'react-jsx']
  };
  
  public framework = 'react' as const;
}

// BEM Styling Extension  
export class BemStylingExtension implements StylingExtension {
  public metadata: ExtensionMetadata & { type: 'styling' } = {
    type: 'styling',
    key: 'bem',
    name: 'BEM Styling Extension',
    version: '1.0.0',
    description: 'Generates BEM classes and SCSS',
    aliases: ['css-bem', 'block-element-modifier']
  };
  
  public styling = 'bem' as const;
}
```

## Advanced Coordination Features

### 1. Cross-Framework Validation

The `FrameworkConsistencyChecker` ensures concepts work across all frameworks:

```typescript
class FrameworkConsistencyChecker {
  checkConsistency(concepts: ComponentConcept): ConsistencyReport {
    return {
      events: this.validateEvents(concepts.events),
      styling: this.validateStyling(concepts.styling),
      conditionals: this.validateConditionals(concepts.conditionals),
      iterations: this.validateIterations(concepts.iterations),
      slots: this.validateSlots(concepts.slots)
    };
  }
  
  private validateEvents(events: EventConcept[]): ValidationResult {
    // Ensure events work in React, Vue, and Svelte
    for (const event of events) {
      if (!this.isValidAcrossFrameworks(event)) {
        return { isValid: false, errors: [`Event ${event.name} not supported in all frameworks`] };
      }
    }
    return { isValid: true, errors: [] };
  }
}
```

### 2. Extension Dependencies

Extensions can declare dependencies on other extensions:

```typescript
interface ExtensionMetadata {
  dependencies?: {
    required?: string[];     // Must be present
    optional?: string[];     // Enhance functionality if present
    conflicts?: string[];    // Cannot be used together
  };
}

// Example: Advanced BEM extension that requires React
const advancedBemExtension = {
  metadata: {
    key: 'bem-advanced',
    dependencies: {
      required: ['react'],
      conflicts: ['tailwind']
    }
  }
};
```

### 3. Extension Configuration

Extensions support runtime configuration:

```typescript
interface ProcessingOptions {
  framework?: string;
  styling?: string;
  utilities?: string[];
  
  // Extension-specific configuration
  extensionConfig?: {
    bem?: {
      separator?: { element: string; modifier: string; };
      generateScss?: boolean;
    };
    react?: {
      typescript?: boolean;
      jsxRuntime?: 'classic' | 'automatic';
    };
    tailwind?: {
      purge?: boolean;
      darkMode?: boolean;
    };
  };
}
```

## Error Handling and Validation

### Extension Registration Errors

```typescript
const registry = new ExtensionRegistry();

// Duplicate extension key
const result = registry.registerFramework(duplicateExtension);
if (!result.isValid) {
  console.error(`Registration failed: ${result.errors.join(', ')}`);
}

// Missing required methods
const invalidExtension = { metadata: { key: 'invalid', type: 'framework' } };
const result2 = registry.registerFramework(invalidExtension);
// Error: "Framework extension must implement: processEvents"
```

### Runtime Coordination Errors

```typescript
// Missing framework extension
const result = await pipeline.process(template, { framework: 'nonexistent' });
if (result.errors.hasWarnings()) {
  console.warn("Framework extension 'nonexistent' not found");
}

// Extension compatibility issues
if (options.styling === 'bem' && options.utilities?.includes('tailwind-purge')) {
  result.errors.addWarning('BEM and Tailwind purge may have conflicts');
}
```

## Future Extension Coordination

The coordination system supports upcoming features:

### 1. Dynamic Extension Loading

```typescript
const registry = new ExtensionRegistry();

// Load extensions at runtime
await registry.loadExtension('./custom-framework-extension.js');
await registry.loadExtensionFromNpm('@company/custom-styling-extension');
```

### 2. Extension Composition

```typescript
// Compose multiple styling extensions
const compositeExtension = registry.compose(['bem', 'tailwind'], {
  strategy: 'merge',
  priority: ['tailwind', 'bem'] // Tailwind classes take precedence
});
```

### 3. Extension Hooks

```typescript
interface ExtensionHooks {
  beforeProcessing?(concepts: ComponentConcept): ComponentConcept;
  afterProcessing?(result: ProcessingResult): ProcessingResult;
  onError?(error: Error): void;
}
```

## Performance Impact

The coordination system is designed for minimal performance overhead:

- **Extension lookup**: O(1) hash map operations
- **Validation**: Only performed during registration
- **Coordination**: Minimal overhead through shared concept references
- **Per-element styling**: Efficient node ID-based lookup

## Best Practices

### 1. Extension Design

- Keep extensions focused on single responsibility
- Use concept sharing for coordination, not direct communication
- Implement proper error handling and validation
- Follow naming conventions (lowercase, hyphen-separated)

### 2. Coordination Patterns

- Store shared data in `extensionData` 
- Use `perElementClasses` for element-specific styling
- Process extensions in correct order (styling → framework → utility)
- Validate cross-framework compatibility

### 3. Performance Optimization

- Minimize concept mutations
- Cache expensive computations
- Use efficient data structures for element lookups
- Avoid deep concept cloning when possible

---

*The extension coordination system enables seamless integration of different extension types while maintaining clean separation of concerns and optimal performance.*