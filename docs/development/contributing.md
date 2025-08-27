# Contributing to JS Template Engine

## Overview

Welcome to the JS Template Engine project! This guide covers the development workflow, coding standards, and contribution process for maintaining and extending the concept-driven architecture.

## Development Setup

### Prerequisites

- **Node.js** 18+
- **pnpm** 8+ (package manager)
- **TypeScript** 4.9+
- **Git**

### Repository Setup

```bash
# Clone the repository
git clone https://github.com/djurnamn/js-template-engine.git
cd js-template-engine

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

### Project Structure

```
js-template-engine/
├── packages/
│   ├── core/                    # Core processing pipeline
│   ├── types/                   # TypeScript type definitions
│   ├── cli/                     # Command-line interface
│   ├── create-ui-kit/           # UI kit scaffolding tool
│   ├── extension-react/         # React framework extension
│   ├── extension-vue/           # Vue framework extension
│   ├── extension-svelte/        # Svelte framework extension
│   ├── extension-bem/           # BEM styling extension
│   ├── extension-tailwind/      # Tailwind styling extension
│   ├── examples/                # Usage examples
│   └── integration-tests/       # Cross-package integration tests
├── docs/                        # Technical documentation
├── turbo.json                   # Monorepo build configuration
├── pnpm-workspace.yaml         # Workspace definition
└── tsconfig.base.json          # Base TypeScript configuration
```

## Development Workflow

### 1. Issue Tracking

Before starting work:

1. **Check existing issues** for similar problems or features
2. **Create a new issue** if none exists, including:
   - Clear problem description
   - Expected vs. actual behavior
   - Reproduction steps (for bugs)
   - Use cases (for features)

### 2. Branch Strategy

We use a **Git Flow** approach:

```bash
# Feature branches
git checkout -b feature/concept-validation-plugin

# Bug fixes
git checkout -b fix/bem-modifier-parsing

# Documentation updates
git checkout -b docs/extension-development-guide
```

### 3. Development Process

1. **Create feature branch** from `main`
2. **Implement changes** following coding standards
3. **Add/update tests** with 90%+ coverage
4. **Update documentation** as needed
5. **Run quality checks** before committing
6. **Create pull request** with detailed description

### 4. Quality Checks

Run before committing:

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Testing
pnpm test

# Build verification
pnpm build

# Integration tests
cd packages/integration-tests && pnpm test
```

## Coding Standards

### TypeScript Guidelines

#### 1. Strict Type Safety

```typescript
// ✅ Good: Explicit interfaces
interface ProcessingOptions {
  framework?: 'react' | 'vue' | 'svelte';
  styling?: 'bem' | 'tailwind';
  utilities?: string[];
}

// ❌ Bad: Any types
function process(options: any): any {}

// ✅ Good: Generic constraints
interface Extension<T extends ExtensionMetadata> {
  metadata: T;
}

// ❌ Bad: Unconstrained generics
interface Extension<T> {
  metadata: T;
}
```

#### 2. Concept-Driven Naming

```typescript
// ✅ Good: Clear concept separation
interface EventConcept {
  name: string;
  handler: string;
  modifiers?: string[];
}

// ❌ Bad: Implementation-coupled naming
interface ReactClickHandler {
  onClick: string;
  preventDefault?: boolean;
}
```

#### 3. Extension Interface Compliance

```typescript
// ✅ Good: Full interface implementation
export class MyFrameworkExtension implements FrameworkExtension {
  public metadata: ExtensionMetadata & { type: 'framework' } = {
    type: 'framework',
    key: 'my-framework',
    name: 'My Framework Extension',
    version: '1.0.0',
  };

  public framework = 'my-framework' as const;

  processEvents(events: EventConcept[]): FrameworkEventOutput {}
  processConditionals(
    conditionals: ConditionalConcept[]
  ): FrameworkConditionalOutput {}
  // ... other required methods
}
```

### Code Organization

#### 1. Single Responsibility

```typescript
// ✅ Good: Focused classes
class EventNormalizer {
  normalizeEvents(
    events: EventConcept[],
    options: NormalizationOptions
  ): NormalizedEvent[];
}

class EventValidator {
  validateEvents(events: EventConcept[], framework: string): ValidationResult;
}

// ❌ Bad: Mixed responsibilities
class EventProcessor {
  normalizeEvents(events: EventConcept[]): NormalizedEvent[];
  validateEvents(events: EventConcept[]): ValidationResult;
  renderEvents(events: EventConcept[]): string;
}
```

#### 2. Immutable Concept Processing

```typescript
// ✅ Good: Return new concepts
processEvents(events: EventConcept[]): EventConcept[] {
  return events.map(event => ({
    ...event,
    frameworkAttribute: this.transformEventName(event.name)
  }));
}

// ❌ Bad: Mutate input concepts
processEvents(events: EventConcept[]): EventConcept[] {
  events.forEach(event => {
    event.frameworkAttribute = this.transformEventName(event.name);
  });
  return events;
}
```

#### 3. Error Handling

```typescript
// ✅ Good: Comprehensive error context
try {
  return this.processTemplate(template);
} catch (error) {
  this.errorCollector.addError({
    message: `Template processing failed: ${error.message}`,
    nodeId: template.id || 'unknown',
    extension: this.metadata.key,
    severity: 'error',
    context: { templateType: template.type },
  });
  return this.createFallbackOutput();
}

// ❌ Bad: Silent failures or generic errors
try {
  return this.processTemplate(template);
} catch (error) {
  console.error('Error:', error);
  return '';
}
```

## Testing Strategy

### 1. Unit Testing

Test individual methods and classes in isolation:

```typescript
// packages/core/__tests__/pipeline/ProcessingPipeline.test.ts
describe('ProcessingPipeline', () => {
  let pipeline: ProcessingPipeline;
  let mockRegistry: ExtensionRegistry;

  beforeEach(() => {
    mockRegistry = new ExtensionRegistry();
    pipeline = new ProcessingPipeline(mockRegistry);
  });

  describe('process()', () => {
    it('should extract concepts from template', async () => {
      const template = [{ type: 'element', tag: 'div' }];
      const result = await pipeline.process(template);

      expect(result.metadata.conceptsFound).toBeDefined();
      expect(result.errors.hasErrors()).toBe(false);
    });

    it('should handle missing framework extension gracefully', async () => {
      const template = [{ type: 'element', tag: 'div' }];
      const result = await pipeline.process(template, {
        framework: 'nonexistent',
      });

      expect(result.errors.hasWarnings()).toBe(true);
      expect(result.output).toBe('');
    });
  });
});
```

### 2. Integration Testing

Test extension coordination and cross-package functionality:

```typescript
// packages/integration-tests/__tests__/react-bem.integration.test.ts
describe('React + BEM Integration', () => {
  it('should generate React component with BEM classes', async () => {
    const registry = new ExtensionRegistry();
    registry.registerFramework(new ReactFrameworkExtension());
    registry.registerStyling(new BemStylingExtension());

    const pipeline = new ProcessingPipeline(registry);

    const template = [
      {
        type: 'element',
        tag: 'div',
        extensions: { bem: { block: 'card', element: 'header' } },
      },
    ];

    const result = await pipeline.process(template, {
      framework: 'react',
      styling: 'bem',
    });

    expect(result.output).toContain('className="card__header"');
    expect(result.output).toContain('export default');
  });
});
```

### 3. Snapshot Testing

Verify generated output against expected results:

```typescript
describe('ReactFrameworkExtension Output', () => {
  it('should generate expected JSX component', () => {
    const concepts = createTestConcepts();
    const context = createTestContext();

    const output = extension.renderComponent(concepts, context);

    expect(output).toMatchSnapshot();
  });
});
```

### 4. Performance Testing

Monitor processing performance:

```typescript
describe('ProcessingPipeline Performance', () => {
  it('should process complex templates within time limits', async () => {
    const complexTemplate = generateComplexTemplate(1000); // 1000 nodes

    const startTime = process.hrtime.bigint();
    await pipeline.process(complexTemplate);
    const endTime = process.hrtime.bigint();

    const processingTime = Number((endTime - startTime) / 1000000n); // Convert to ms
    expect(processingTime).toBeLessThan(100); // Should process within 100ms
  });
});
```

## Architecture Guidelines

### 1. Concept-First Design

Design around abstract concepts, not framework implementations:

```typescript
// ✅ Good: Framework-agnostic concept
interface ConditionalConcept {
  condition: string;
  thenNodes: TemplateNode[];
  elseNodes?: TemplateNode[];
}

// ❌ Bad: Framework-specific concept
interface ReactConditionalConcept {
  condition: string;
  jsxThenContent: string;
  jsxElseContent?: string;
}
```

### 2. Extension Coordination

Design extensions to work together through shared concepts:

```typescript
// ✅ Good: Extensions share data through concepts
class BemExtension implements StylingExtension {
  processStyles(styling: StylingConcept): StyleOutput {
    return {
      updatedStyling: {
        ...styling,
        perElementClasses: this.generateBemClasses(styling),
      },
    };
  }
}

class ReactExtension implements FrameworkExtension {
  renderComponent(concepts: ComponentConcept): string {
    // Access BEM classes from styling concept
    const classes = concepts.styling.perElementClasses;
    return this.generateJSX(concepts, classes);
  }
}
```

### 3. Performance Considerations

Optimize for the common case while handling edge cases gracefully:

```typescript
// ✅ Good: Efficient concept processing
private timeExtension<T>(fn: () => T): { result: T; time: number } {
  const start = process.hrtime.bigint();
  const result = fn();
  const time = Math.max(1, Number((process.hrtime.bigint() - start) / 1000000n));
  return { result, time };
}

// Use Maps for O(1) lookups
private perElementClasses = new Map<string, string[]>();

// Reuse concept instances when possible
private conceptCache = new WeakMap<TemplateNode, ComponentConcept>();
```

## Documentation Requirements

### 1. Code Documentation

Use JSDoc for public APIs:

````typescript
/**
 * Process styling concepts through the BEM methodology.
 *
 * Generates BEM classes following the Block__Element--Modifier convention
 * and updates the styling concept with per-element classes.
 *
 * @param concepts - The styling concept to process
 * @returns Style output with generated CSS and updated concepts
 *
 * @example
 * ```typescript
 * const styling = { extensionData: { bem: [{ block: 'card' }] } };
 * const result = bemExtension.processStyles(styling);
 * console.log(result.updatedStyling.perElementClasses);
 * ```
 */
processStyles(concepts: StylingConcept): StyleOutput { }
````

### 2. Architecture Documentation

Update technical docs for significant changes:

- Add new concepts to `concept-driven-design.md`
- Document processing changes in `processing-pipeline.md`
- Update extension guides for new extension types

### 3. README Updates

Keep package READMEs current:

- Installation instructions
- Basic usage examples
- Configuration options
- Migration notes

## Pull Request Process

### 1. PR Title Format

Use conventional commit format:

```
feat(core): add concept validation framework
fix(bem): resolve modifier parsing edge case
docs(architecture): update extension coordination guide
test(integration): add Vue + Tailwind test coverage
```

### 2. PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests pass
- [ ] Performance impact assessed

## Documentation

- [ ] Code comments updated
- [ ] Technical docs updated
- [ ] README updated (if needed)

## Checklist

- [ ] Code follows project standards
- [ ] Self-review completed
- [ ] No console.log or debugging code
- [ ] TypeScript errors resolved
```

### 3. Review Process

1. **Automated checks** must pass (CI/CD)
2. **Peer review** by at least one maintainer
3. **Architecture review** for significant changes
4. **Integration testing** for cross-package changes

## Release Process

### 1. Version Management

We use semantic versioning:

- **Patch** (1.0.1): Bug fixes, documentation updates
- **Minor** (1.1.0): New features, backward-compatible changes
- **Major** (2.0.0): Breaking changes, architecture changes

### 2. Changelog Maintenance

Keep `CHANGELOG.md` updated:

```markdown
## [1.1.0] - 2024-01-15

### Added

- Concept validation framework with plugin system
- Per-element styling support for all extensions
- Framework consistency checking

### Changed

- Processing pipeline now validates concepts by default
- Extension registry provides better error messages

### Fixed

- BEM modifier parsing for complex selectors
- React event handler parameter passing
```

### 3. Release Checklist

- [ ] All tests pass (unit + integration)
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped appropriately
- [ ] Git tags created
- [ ] npm packages published
- [ ] GitHub release created

## Getting Help

### 1. Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Architecture discussions and questions
- **Pull Requests**: Code review and technical discussion

### 2. Maintainer Response

We aim for:

- **Issues**: Response within 48 hours
- **Pull Requests**: Initial review within 72 hours
- **Security Issues**: Response within 24 hours

### 3. Documentation

- Check existing documentation first
- Search closed issues for similar problems
- Provide clear reproduction steps for bugs

---

_Thank you for contributing to the JS Template Engine! Your contributions help make the concept-driven architecture more robust and extensible._
