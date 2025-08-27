# JS Template Engine Technical Documentation

This directory contains comprehensive technical documentation for developers and maintainers of the JS Template Engine concept-driven architecture.

## Overview

The JS Template Engine has undergone a major architectural transformation from a legacy template-based system to a modern **concept-driven architecture**. This new system abstracts common UI patterns into reusable concepts that can be processed by different framework and styling extensions.

## Documentation Structure

### 🏗️ Architecture
- [`concept-driven-design.md`](./architecture/concept-driven-design.md) - Core architectural principles and design rationale
- [`processing-pipeline.md`](./architecture/processing-pipeline.md) - Deep dive into ProcessingPipeline orchestration
- [`extension-coordination.md`](./architecture/extension-coordination.md) - How extensions work together seamlessly

### 👨‍💻 Development
- [`extension-development.md`](./development/extension-development.md) - Complete guide to building new extensions
- [`contributing.md`](./development/contributing.md) - Development workflow and contribution guidelines
- [`testing-strategy.md`](./development/testing-strategy.md) - Testing approaches and patterns

### ⚡ Performance
- [`benchmarks.md`](./performance/benchmarks.md) - Performance characteristics and test results
- [`optimization-guide.md`](./performance/optimization-guide.md) - Best practices for optimal performance

## Quick Start for Developers

1. **Understanding the Architecture**: Start with [concept-driven-design.md](./architecture/concept-driven-design.md) to understand why the system was rewritten and how it works.

2. **Extension Development**: If you're building extensions, jump to [extension-development.md](./development/extension-development.md).

3. **Performance Optimization**: For performance-critical scenarios, see [optimization-guide.md](./performance/optimization-guide.md).

## System Status

**Current Achievement**: 91.25% integration test success rate
- **350+ unit tests** across all packages
- **4 major processing order fixes** in recent iterations
- **BEM integration** successfully implemented
- **Framework extensions** for React, Vue, and Svelte
- **Styling extensions** for BEM and Tailwind

## Key Technical Concepts

- **Concept-Driven Processing**: Templates are analyzed and converted to structured concepts (events, styling, conditionals, iterations, slots, attributes)
- **Extension Coordination**: Type-safe extension registry manages framework, styling, and utility extensions
- **Processing Pipeline**: Central orchestrator handles concept extraction, extension processing, and output generation
- **Per-Element Styling**: Advanced styling support with element-specific class assignment

## Architecture Benefits

- **Order Independence**: Extensions process concepts without dependency on processing order
- **Type Safety**: Full TypeScript support with strict extension interfaces
- **Extensibility**: Clean separation allows easy addition of new frameworks and styling approaches
- **Consistency**: Unified concept model ensures consistent behavior across all extensions
- **Performance**: Optimized processing pipeline with performance tracking

## Getting Help

- Check the [extension development guide](./development/extension-development.md) for detailed implementation examples
- See [contributing.md](./development/contributing.md) for development setup instructions
- Review [testing-strategy.md](./development/testing-strategy.md) for testing patterns

---

*This documentation reflects the current state of the concept-driven rewrite and is actively maintained by the development team.*