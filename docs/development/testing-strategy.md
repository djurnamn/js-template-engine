# Testing Strategy

## Overview

The JS Template Engine employs a comprehensive multi-layered testing strategy to ensure reliability, performance, and correctness of the concept-driven architecture. This document outlines our testing approaches, patterns, and best practices.

## Testing Architecture

### Testing Pyramid

```
    /\
   /  \  E2E Tests (Integration)
  /____\  
 /      \  Integration Tests (Cross-package)
/________\
| Unit Tests | (Individual classes/functions)
```

1. **Unit Tests**: Test individual components in isolation (70%)
2. **Integration Tests**: Test extension coordination and package interaction (25%)
3. **End-to-End Tests**: Test complete user workflows (5%)

### Test Organization

```
packages/
├── core/__tests__/
│   ├── analyzer/TemplateAnalyzer.test.ts
│   ├── pipeline/ProcessingPipeline.test.ts
│   ├── registry/ExtensionRegistry.test.ts
│   └── integration/
├── extension-react/__tests__/
│   └── ReactFrameworkExtension.test.ts
├── extension-bem/__tests__/
│   └── BemExtension.test.ts
└── integration-tests/__tests__/
    ├── react.integration.test.ts
    ├── bem.integration.test.ts
    ├── combined.integration.test.ts
    └── performance.integration.test.ts
```

## Unit Testing Strategy

### 1. Concept Processing Tests

Test individual concept processing methods:

```typescript
// packages/extension-react/__tests__/ReactFrameworkExtension.test.ts
describe('ReactFrameworkExtension', () => {
  let extension: ReactFrameworkExtension;

  beforeEach(() => {
    extension = new ReactFrameworkExtension();
  });

  describe('processEvents', () => {
    it('should transform click events to onClick', () => {
      const events: EventConcept[] = [
        { nodeId: '1', name: 'click', handler: 'handleClick' }
      ];

      const result = extension.processEvents(events);

      expect(result.attributes).toEqual({ onClick: 'handleClick' });
    });

    it('should handle event modifiers', () => {
      const events: EventConcept[] = [
        { 
          nodeId: '1', 
          name: 'click', 
          handler: 'handleSubmit',
          modifiers: ['prevent', 'stop']
        }
      ];

      const result = extension.processEvents(events);
      
      expect(result.attributes.onClick).toContain('preventDefault');
      expect(result.attributes.onClick).toContain('stopPropagation');
    });

    it('should handle multiple parameters', () => {
      const events: EventConcept[] = [
        { 
          nodeId: '1', 
          name: 'change', 
          handler: 'handleChange',
          parameters: ['$event', 'index']
        }
      ];

      const result = extension.processEvents(events);
      
      expect(result.attributes.onChange).toContain('(e, index)');
      expect(result.attributes.onChange).toContain('handleChange(e, index)');
    });
  });

  describe('processConditionals', () => {
    it('should generate JSX conditional syntax', () => {
      const conditionals: ConditionalConcept[] = [
        {
          nodeId: '1',
          condition: 'isVisible',
          thenNodes: [{ type: 'text', content: 'Visible content' }]
        }
      ];

      const result = extension.processConditionals(conditionals);

      expect(result.syntax).toBe('{isVisible && (Visible content)}');
    });

    it('should handle if-else conditionals', () => {
      const conditionals: ConditionalConcept[] = [
        {
          nodeId: '1',
          condition: 'isLoggedIn',
          thenNodes: [{ type: 'text', content: 'Welcome!' }],
          elseNodes: [{ type: 'text', content: 'Please login' }]
        }
      ];

      const result = extension.processConditionals(conditionals);

      expect(result.syntax).toBe('{isLoggedIn ? (Welcome!) : (Please login)}');
    });
  });
});
```

### 2. Pipeline Processing Tests

Test the core processing pipeline:

```typescript
// packages/core/__tests__/pipeline/ProcessingPipeline.test.ts
describe('ProcessingPipeline', () => {
  let pipeline: ProcessingPipeline;
  let registry: ExtensionRegistry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    pipeline = new ProcessingPipeline(registry);
  });

  describe('process()', () => {
    it('should extract concepts from simple template', async () => {
      const template = [
        { 
          type: 'element', 
          tag: 'button',
          attributes: { class: 'btn' },
          children: [{ type: 'text', content: 'Click me' }]
        }
      ];

      const result = await pipeline.process(template);

      expect(result.metadata.conceptsFound.styling).toBe(true);
      expect(result.metadata.conceptsFound.attributes).toBe(1);
    });

    it('should handle processing errors gracefully', async () => {
      const invalidTemplate = [
        { type: 'if', condition: '', thenNodes: [] } // Invalid condition
      ];

      const result = await pipeline.process(invalidTemplate);

      expect(result.errors.hasWarnings()).toBe(true);
      expect(result.errors.getErrorsBySeverity('warning')).toHaveLength(1);
    });

    it('should track performance metrics', async () => {
      const template = [{ type: 'element', tag: 'div' }];

      const result = await pipeline.process(template);

      expect(result.performance.totalTime).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('processAdvanced()', () => {
    it('should enable advanced processing features', async () => {
      const template = [
        { 
          type: 'element', 
          tag: 'div',
          attributes: { onclick: 'handleClick' }
        }
      ];

      const result = await pipeline.processAdvanced(template, {
        framework: 'react',
        extraction: {
          useEventExtractor: true,
          validateConcepts: true
        }
      });

      expect(result.advancedMetadata?.processing).toBe(true);
      expect(result.validation).toBeDefined();
    });
  });
});
```

### 3. Extension Registry Tests

Test extension management and validation:

```typescript
// packages/core/__tests__/registry/ExtensionRegistry.test.ts
describe('ExtensionRegistry', () => {
  let registry: ExtensionRegistry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
  });

  describe('registerFramework()', () => {
    it('should register valid framework extension', () => {
      const extension = new ReactFrameworkExtension();
      
      const result = registry.registerFramework(extension);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(registry.hasExtension('react', 'framework')).toBe(true);
    });

    it('should reject duplicate framework keys', () => {
      const ext1 = new ReactFrameworkExtension();
      const ext2 = new ReactFrameworkExtension();

      registry.registerFramework(ext1);
      const result = registry.registerFramework(ext2);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('already registered');
    });

    it('should validate extension metadata', () => {
      const invalidExtension = {
        metadata: { 
          type: 'framework' as const,
          key: 'INVALID-KEY', // Invalid: uppercase
          name: 'Test',
          version: '1.0.0'
        },
        framework: 'react' as const,
        processEvents: () => ({ attributes: {}, imports: [] })
      } as FrameworkExtension;

      const result = registry.registerFramework(invalidExtension);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('lowercase alphanumeric');
    });
  });
});
```

## Integration Testing Strategy

### 1. Cross-Extension Testing

Test how different extensions work together:

```typescript
// packages/integration-tests/__tests__/react-bem.integration.test.ts
describe('React + BEM Integration', () => {
  let registry: ExtensionRegistry;
  let pipeline: ProcessingPipeline;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    registry.registerFramework(new ReactFrameworkExtension());
    registry.registerStyling(new BemStylingExtension());
    pipeline = new ProcessingPipeline(registry);
  });

  it('should generate React component with BEM classes', async () => {
    const template = [
      {
        type: 'element',
        tag: 'div',
        extensions: { 
          bem: { block: 'card', element: 'header' }
        },
        children: [
          { type: 'text', content: 'Card Header' }
        ]
      }
    ];

    const result = await pipeline.process(template, {
      framework: 'react',
      styling: 'bem'
    });

    expect(result.output).toContain('className="card__header"');
    expect(result.output).toContain('export default');
    expect(result.output).toContain('Card Header');
  });

  it('should handle complex BEM structures', async () => {
    const template = [
      {
        type: 'element',
        tag: 'article',
        extensions: { bem: { block: 'card' } },
        children: [
          {
            type: 'element',
            tag: 'header',
            extensions: { bem: { element: 'header', modifiers: ['primary'] } },
            children: [{ type: 'text', content: 'Title' }]
          },
          {
            type: 'element',
            tag: 'div',
            extensions: { bem: { element: 'content' } },
            children: [{ type: 'text', content: 'Content' }]
          }
        ]
      }
    ];

    const result = await pipeline.process(template, {
      framework: 'react',
      styling: 'bem'
    });

    expect(result.output).toContain('className="card"');
    expect(result.output).toContain('className="card__header card__header--primary"');
    expect(result.output).toContain('className="card__content"');
  });
});
```

### 2. Multi-Framework Testing

Ensure concepts work consistently across frameworks:

```typescript
// packages/integration-tests/__tests__/cross-framework.integration.test.ts
describe('Cross-Framework Consistency', () => {
  const testConcept = [
    {
      type: 'element',
      tag: 'button',
      attributes: { onclick: 'handleClick' },
      children: [{ type: 'text', content: 'Click me' }]
    }
  ];

  const frameworks = ['react', 'vue', 'svelte'] as const;

  frameworks.forEach(frameworkName => {
    describe(`${frameworkName} Framework`, () => {
      let registry: ExtensionRegistry;
      let pipeline: ProcessingPipeline;

      beforeEach(() => {
        registry = new ExtensionRegistry();
        // Register appropriate extension for framework
        if (frameworkName === 'react') {
          registry.registerFramework(new ReactFrameworkExtension());
        } else if (frameworkName === 'vue') {
          registry.registerFramework(new VueFrameworkExtension());
        } else if (frameworkName === 'svelte') {
          registry.registerFramework(new SvelteFrameworkExtension());
        }
        pipeline = new ProcessingPipeline(registry);
      });

      it('should handle click events', async () => {
        const result = await pipeline.process(testConcept, {
          framework: frameworkName
        });

        expect(result.output).toContain('handleClick');
        expect(result.errors.hasErrors()).toBe(false);
      });

      it('should render button with text content', async () => {
        const result = await pipeline.process(testConcept, {
          framework: frameworkName
        });

        expect(result.output).toContain('button');
        expect(result.output).toContain('Click me');
      });
    });
  });
});
```

### 3. Performance Integration Tests

Test processing performance under various conditions:

```typescript
// packages/integration-tests/__tests__/performance.integration.test.ts
describe('Performance Integration', () => {
  let registry: ExtensionRegistry;
  let pipeline: ProcessingPipeline;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    registry.registerFramework(new ReactFrameworkExtension());
    registry.registerStyling(new BemStylingExtension());
    pipeline = new ProcessingPipeline(registry);
  });

  describe('Template Complexity', () => {
    it('should handle small templates efficiently', async () => {
      const template = generateTemplate({ elements: 5, depth: 2 });
      
      const result = await pipeline.process(template, {
        framework: 'react',
        styling: 'bem'
      });

      expect(result.performance.totalTime).toBeLessThan(10); // < 10ms
    });

    it('should handle medium templates within limits', async () => {
      const template = generateTemplate({ elements: 50, depth: 4 });
      
      const result = await pipeline.process(template, {
        framework: 'react',
        styling: 'bem'
      });

      expect(result.performance.totalTime).toBeLessThan(50); // < 50ms
    });

    it('should handle large templates efficiently', async () => {
      const template = generateTemplate({ elements: 200, depth: 6 });
      
      const result = await pipeline.process(template, {
        framework: 'react',
        styling: 'bem'
      });

      expect(result.performance.totalTime).toBeLessThan(200); // < 200ms
    });
  });

  describe('Extension Performance', () => {
    it('should track individual extension times', async () => {
      const template = generateTemplate({ elements: 20, depth: 3 });
      
      const result = await pipeline.process(template, {
        framework: 'react',
        styling: 'bem'
      });

      expect(result.performance.extensionTimes.react).toBeGreaterThan(0);
      expect(result.performance.extensionTimes.bem).toBeGreaterThan(0);
      
      // Extensions should be reasonably efficient
      expect(result.performance.extensionTimes.react).toBeLessThan(100);
      expect(result.performance.extensionTimes.bem).toBeLessThan(100);
    });
  });
});
```

## Test Utilities and Helpers

### 1. Template Generation

```typescript
// packages/integration-tests/test-utils/template-generator.ts
export interface TemplateGenerationOptions {
  elements: number;
  depth: number;
  includeEvents?: boolean;
  includeStyling?: boolean;
  includeConditionals?: boolean;
  includeIterations?: boolean;
}

export function generateTemplate(options: TemplateGenerationOptions): TemplateNode[] {
  const { elements, depth, includeEvents = true, includeStyling = true } = options;
  
  return generateNodes(elements, depth, includeEvents, includeStyling);
}

function generateNodes(
  count: number, 
  remainingDepth: number, 
  includeEvents: boolean,
  includeStyling: boolean
): TemplateNode[] {
  const nodes: TemplateNode[] = [];
  
  for (let i = 0; i < count; i++) {
    const node: TemplateNode = {
      type: 'element',
      tag: getRandomTag(),
      attributes: generateAttributes(includeEvents, includeStyling),
      children: remainingDepth > 0 ? 
        generateNodes(Math.floor(count / 2), remainingDepth - 1, includeEvents, includeStyling) : 
        [{ type: 'text', content: `Content ${i}` }]
    };

    if (includeStyling) {
      node.extensions = {
        bem: generateBemExtension()
      };
    }

    nodes.push(node);
  }
  
  return nodes;
}
```

### 2. Concept Builders

```typescript
// packages/core/__tests__/test-utils/concept-builders.ts
export class ConceptBuilder {
  static event(overrides: Partial<EventConcept> = {}): EventConcept {
    return {
      nodeId: 'test-1',
      name: 'click',
      handler: 'handleClick',
      ...overrides
    };
  }

  static conditional(overrides: Partial<ConditionalConcept> = {}): ConditionalConcept {
    return {
      nodeId: 'test-1',
      condition: 'isVisible',
      thenNodes: [{ type: 'text', content: 'Visible' }],
      ...overrides
    };
  }

  static componentConcept(overrides: Partial<ComponentConcept> = {}): ComponentConcept {
    return {
      structure: [],
      events: [],
      styling: this.styling(),
      conditionals: [],
      iterations: [],
      slots: [],
      attributes: [],
      metadata: {},
      ...overrides
    };
  }

  static styling(overrides: Partial<StylingConcept> = {}): StylingConcept {
    return {
      nodeId: 'root',
      staticClasses: [],
      dynamicClasses: [],
      inlineStyles: {},
      perElementClasses: {},
      extensionData: {},
      ...overrides
    };
  }
}
```

### 3. Mock Extensions

```typescript
// packages/core/__tests__/test-utils/mock-extensions.ts
export class MockFrameworkExtension implements FrameworkExtension {
  public metadata: ExtensionMetadata & { type: 'framework' } = {
    type: 'framework',
    key: 'mock-framework',
    name: 'Mock Framework Extension',
    version: '1.0.0'
  };

  public framework = 'mock-framework' as const;
  public processEventsCalled = false;
  public renderComponentCalled = false;

  processEvents(events: EventConcept[]): FrameworkEventOutput {
    this.processEventsCalled = true;
    return { attributes: {}, imports: [] };
  }

  processConditionals(): FrameworkConditionalOutput {
    return { syntax: '', imports: [] };
  }

  processIterations(): FrameworkIterationOutput {
    return { syntax: '', imports: [] };
  }

  processSlots(): FrameworkSlotOutput {
    return { syntax: '', props: {}, imports: [] };
  }

  processAttributes(): FrameworkAttributeOutput {
    return { attributes: {}, imports: [] };
  }

  renderComponent(): string {
    this.renderComponentCalled = true;
    return '<div>Mock Component</div>';
  }
}
```

## Test Coverage and Quality

### 1. Coverage Requirements

- **Unit Tests**: 90% line coverage minimum
- **Branch Coverage**: 85% minimum  
- **Critical Paths**: 100% coverage (error handling, validation)

### 2. Coverage Reporting

```bash
# Generate coverage report
pnpm test:coverage

# View HTML coverage report
open coverage/index.html

# Coverage for specific package
cd packages/core && pnpm test:coverage
```

### 3. Quality Gates

Tests must pass these gates:

```javascript
// vitest.config.ts coverage thresholds
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    }
  }
});
```

## Testing Best Practices

### 1. Test Organization

```typescript
describe('ProcessingPipeline', () => {
  describe('Unit Tests', () => {
    describe('process()', () => {
      it('should handle valid templates');
      it('should handle invalid templates');
      it('should track performance');
    });
  });
  
  describe('Integration Tests', () => {
    describe('with React extension', () => {
      it('should generate JSX components');
    });
    
    describe('with BEM extension', () => {
      it('should apply BEM classes');
    });
  });
});
```

### 2. Test Data Management

```typescript
// Use constants for test data
const VALID_TEMPLATE: TemplateNode[] = [
  { type: 'element', tag: 'div', children: [] }
];

const INVALID_TEMPLATE: TemplateNode[] = [
  { type: 'if', condition: '', thenNodes: [] }
];

// Use factories for complex data
const createComplexTemplate = (nodeCount: number) => 
  generateTemplate({ elements: nodeCount, depth: 3 });
```

### 3. Async Testing

```typescript
// Test async operations properly
describe('async processing', () => {
  it('should handle promises correctly', async () => {
    const result = await pipeline.process(template);
    expect(result).toBeDefined();
  });

  it('should handle rejections gracefully', async () => {
    await expect(
      pipeline.process(invalidTemplate)
    ).resolves.toMatchObject({
      errors: expect.objectContaining({
        hasErrors: expect.any(Function)
      })
    });
  });
});
```

### 4. Error Testing

```typescript
describe('error handling', () => {
  it('should collect processing errors', async () => {
    const template = createInvalidTemplate();
    
    const result = await pipeline.process(template);
    
    expect(result.errors.hasErrors()).toBe(true);
    expect(result.errors.getErrors()).toHaveLength(1);
    expect(result.errors.getErrors()[0].severity).toBe('error');
  });

  it('should continue processing after warnings', async () => {
    const template = createTemplateWithWarnings();
    
    const result = await pipeline.process(template);
    
    expect(result.errors.hasWarnings()).toBe(true);
    expect(result.output).toBeTruthy(); // Should still produce output
  });
});
```

## Continuous Integration

### 1. CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: corepack enable
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### 2. Test Matrix

Test across multiple configurations:

```yaml
strategy:
  matrix:
    node-version: [18, 20]
    os: [ubuntu-latest, windows-latest, macos-latest]
    include:
      - node-version: 18
        os: ubuntu-latest
        coverage: true
```

### 3. Performance Regression Detection

```yaml
- name: Performance Tests
  run: |
    pnpm test:performance
    node scripts/check-performance-regression.js
```

## Future Testing Improvements

### 1. Visual Testing

For generated output verification:

- Snapshot testing for complex generated code
- AST comparison for structural validation
- Output formatting consistency checks

### 2. Property-Based Testing

Using libraries like `fast-check` for comprehensive input validation:

```typescript
import fc from 'fast-check';

describe('ProcessingPipeline Property Tests', () => {
  it('should handle any valid template structure', () => {
    fc.assert(fc.property(
      templateArbitrary,
      (template) => {
        const result = pipeline.process(template);
        expect(result.errors.hasErrors()).toBe(false);
      }
    ));
  });
});
```

### 3. Mutation Testing

Verify test effectiveness by introducing code mutations and ensuring tests catch them.

---

*This comprehensive testing strategy ensures the reliability and maintainability of the JS Template Engine's concept-driven architecture while supporting confident development and refactoring.*