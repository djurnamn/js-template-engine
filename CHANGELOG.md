# Changelog

All notable changes to the JS Template Engine project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-08-27

### 💥 Breaking Changes

Complete architectural transformation from single-class template processor to concept-driven processing system.

#### **BREAKING**: Core API Redesign

**1.0.1 API:**

```javascript
const {
  TemplateEngine,
  ReactExtension,
  BemExtension,
} = require('js-template-engine');
const templateEngine = new TemplateEngine();
const result = await templateEngine.render(template, {
  extensions: [new ReactExtension()],
});
```

**2.0.0 API:**

```typescript
import {
  ProcessingPipeline,
  ExtensionRegistry,
} from '@js-template-engine/core';
import { ReactFrameworkExtension } from '@js-template-engine/extension-react';

const registry = new ExtensionRegistry();
registry.registerFramework(new ReactFrameworkExtension());
const pipeline = new ProcessingPipeline(registry);
const result = await pipeline.process(template, { framework: 'react' });
```

#### **BREAKING**: Package Structure

- **Removed**: Single `js-template-engine` package
- **New**: Monorepo with `@js-template-engine/*` namespace packages
- **New Packages**: `@js-template-engine/core`, `@js-template-engine/types`, `@js-template-engine/cli`
- **New**: Individual extension packages for each framework/styling system

#### **BREAKING**: Extension System

- **Removed**: Simple `nodeHandler`/`rootHandler` extension interface
- **New**: Concept-specific extension processors (framework, styling, utility)
- **New**: Extension registry with automatic coordination between extensions

### ✨ New Framework Support

#### Vue Framework (Complete New Capability)

Generate Vue Single File Components with:

- **Template section**: Vue directives (v-if, v-for, v-model, @click)
- **Script section**: Composition API and Options API support
- **Style section**: Scoped styles and CSS preprocessing
- **TypeScript support**: Full type safety for Vue components

#### Svelte Framework (Complete New Capability)

Generate native Svelte components with:

- **Reactive statements**: `$:` reactive declarations
- **Event handling**: Svelte event dispatcher integration
- **Store integration**: Svelte stores and context
- **Actions system**: Custom Svelte actions

#### Enhanced React Framework

**1.0.1 React capabilities:**

- Basic JSX generation
- Simple event handlers (`onclick` → `onClick`)
- Basic attribute transformation
- Component wrapper with imports

**2.0.0 React capabilities:**

- **Advanced event handling**: Modifiers (prevent, stop, once, self)
- **Conditional rendering**: Ternary operators and logical AND patterns
- **Array iteration**: Proper `.map()` with React.Fragment and key handling
- **Slot to props**: Transform slots into React props with TypeScript interfaces
- **Hook optimization**: Intelligent useCallback, useMemo import generation
- **Component property merging**: Advanced prop interface generation

### ✨ New Styling Capabilities

#### Tailwind CSS Integration (Complete New Capability)

- **Utility class validation**: Parse and validate Tailwind utilities
- **Responsive breakpoints**: sm:, md:, lg:, xl: breakpoint support
- **Pseudo-class variants**: hover:, focus:, active:, disabled: support
- **CSS output generation**: Convert utilities to actual CSS
- **Multiple output formats**: CSS, SCSS, or pass-through strategies

#### Enhanced BEM Methodology

**1.0.1 BEM capabilities:**

- Basic block\_\_element--modifier class generation
- Hierarchical class inheritance

**2.0.0 BEM capabilities:**

- **Per-element class tracking**: NodeId-based class application
- **Advanced modifier handling**: Both singular and plural modifier forms
- **Cross-framework integration**: Works with React, Vue, and Svelte
- **Performance optimization**: Efficient class generation and caching

### ✨ New Processing Features

#### Concept-Driven Architecture

Transform templates by extracting and processing semantic concepts:

- **Events**: Cross-framework event handler transformation
- **Conditionals**: Framework-specific conditional rendering patterns
- **Iterations**: Proper array mapping for each framework
- **Slots**: Framework-appropriate content projection
- **Styling**: Intelligent class and style processing

#### Advanced Template Logic

**1.0.1 capabilities:**

- Basic slot system with fallback content
- Simple attribute merging

**2.0.0 capabilities:**

- **Conditional rendering**: Native if/else patterns per framework
- **Array iteration**: Framework-specific looping with proper key handling
- **Advanced slots**: Framework-native slot implementations
- **Template fragments**: Multi-root component support
- **Dynamic classes**: Conditional and computed class assignment
- **Expression handling**: Complex JavaScript expression support

#### Validation & Quality

- **Concept validation**: Template analysis for best practices
- **Framework consistency**: Multi-framework compatibility checking
- **Accessibility validation**: Built-in a11y checks
- **Performance tracking**: Detailed processing metrics
- **Error collection**: Comprehensive error handling with severity levels

### ✨ New Developer Tools

#### create-ui-kit CLI Tool (Complete New Capability)

Scaffold complete component libraries with:

- **Multi-framework initialization**: React, Vue, Svelte project setup
- **Extension configuration**: Automated styling and framework setup
- **Build system integration**: Complete tooling setup
- **Documentation generation**: Automated component documentation

#### Enhanced CLI Interface

**1.0.1 CLI capabilities:**

- File and directory processing
- Basic extension selection
- Output directory configuration

**2.0.0 CLI capabilities:**

- **Advanced pipeline configuration**: Multi-stage processing options
- **Extension registry management**: Sophisticated extension loading
- **Multiple output strategies**: Various rendering and output modes
- **Performance profiling**: Built-in benchmarking and analysis
- **Rich error reporting**: Detailed error analysis and suggestions

#### Professional Development Experience

- **TypeScript-first**: Complete type safety across all packages
- **Modern testing**: Vitest with comprehensive coverage reporting
- **Build optimization**: Turbo monorepo with intelligent caching
- **Code quality**: ESLint and Prettier with strict configurations
- **Documentation**: Complete API references and architectural guides

### 🔧 Enhanced Core Functionality

#### Processing Pipeline

**1.0.1**: Direct template-to-output transformation
**2.0.0**: Multi-stage pipeline with validation, concept extraction, and optimization

#### Extension Coordination

**1.0.1**: Independent extension execution
**2.0.0**: Intelligent extension coordination with concept sharing

#### Performance Optimization

**1.0.1**: Basic processing with prettier formatting
**2.0.0**: Caching, intelligent processing stages, and performance profiling

#### Error Handling

**1.0.1**: Basic error reporting
**2.0.0**: Comprehensive error collection with context and severity levels

### 📚 Functional Continuity

These core capabilities remain but work differently:

#### Template Processing

- **Concept**: Transform JSON templates into framework code
- **1.0.1**: Direct node processing with inline extension handling
- **2.0.0**: Concept extraction → validation → processing → rendering pipeline

#### React Support

- **Concept**: Generate React JSX components
- **1.0.1**: Basic JSX with simple attribute transformation
- **2.0.0**: Production-ready components with hooks, TypeScript, and advanced patterns

#### BEM Styling

- **Concept**: Generate BEM methodology CSS classes
- **1.0.1**: Direct class generation during node processing
- **2.0.0**: Concept-driven styling with cross-framework support

#### File Processing

- **Concept**: Process templates from files to output files
- **1.0.1**: Direct file I/O with basic options
- **2.0.0**: CLI-based processing with advanced configuration

### 📖 Migration Guide

#### Package Installation

```bash
# 1.0.1
npm install js-template-engine

# 2.0.0
pnpm install @js-template-engine/core @js-template-engine/extension-react @js-template-engine/extension-bem
```

#### Basic Processing

```javascript
// 1.0.1: Single class approach
const { TemplateEngine } = require('js-template-engine');
const engine = new TemplateEngine();
const result = await engine.render(template, {
  extensions: [new ReactExtension()],
});

// 2.0.0: Pipeline approach
import {
  ProcessingPipeline,
  ExtensionRegistry,
} from '@js-template-engine/core';
import { ReactFrameworkExtension } from '@js-template-engine/extension-react';

const registry = new ExtensionRegistry();
registry.registerFramework(new ReactFrameworkExtension());
const pipeline = new ProcessingPipeline(registry);
const result = await pipeline.process(template, { framework: 'react' });
```

#### CLI Usage

```bash
# 1.0.1: Direct command
npx js-template-engine input.json --output dist

# 2.0.0: Enhanced CLI (same command, enhanced functionality)
npx js-template-engine render input.json --output-dir dist --config ./template.config.ts
```

## [1.0.1] - 2024-02-06

### 🔧 Improved

- Move prettier to dependencies for better package management

## [1.0.0] - 2024-02-06

### 🎉 Initial Release

- **Core template processing**: Transform JSON templates into HTML/JSX
- **React support**: Basic JSX component generation
- **BEM support**: CSS class generation with block\_\_element--modifier pattern
- **CLI interface**: Command-line processing of template files
- **Extension system**: Basic framework and styling extensions

---

[2.0.0]: https://github.com/djurnamn/js-template-engine/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/djurnamn/js-template-engine/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/djurnamn/js-template-engine/releases/tag/v1.0.0
