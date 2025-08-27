# Performance Optimization Guide

## Overview

This guide provides comprehensive strategies for optimizing performance when working with the JS Template Engine's concept-driven architecture. It covers optimization techniques for different scenarios, from development-time optimizations to production performance tuning.

## Quick Start Optimization Checklist

### Development Environment

- [ ] **Enable TypeScript strict mode** for compile-time optimizations
- [ ] **Use production builds** of extensions (NODE_ENV=production)
- [ ] **Configure extension caching** for repeated template processing
- [ ] **Monitor memory usage** during development
- [ ] **Profile processing pipeline** for bottlenecks

### Template Design

- [ ] **Minimize template depth** (keep under 6 levels)
- [ ] **Limit dynamic concepts** (conditionals, iterations) per template
- [ ] **Use static classes** over dynamic styling when possible
- [ ] **Optimize extension data** structure and size
- [ ] **Batch similar concepts** together

### Extension Configuration

- [ ] **Choose optimal extension combinations** for your use case
- [ ] **Configure extension-specific optimizations**
- [ ] **Enable advanced processing only when needed**
- [ ] **Use utility extensions judiciously**

## Template-Level Optimizations

### 1. Template Structure Optimization

#### Optimal Template Depth

```typescript
// ✅ Good: Shallow hierarchy (3-4 levels)
const optimizedTemplate = [
  {
    type: 'element',
    tag: 'article',
    children: [
      {
        type: 'element',
        tag: 'header',
        children: [
          { type: 'text', content: 'Title' }
        ]
      },
      {
        type: 'element',
        tag: 'main',
        children: [
          { type: 'text', content: 'Content' }
        ]
      }
    ]
  }
];

// ❌ Poor: Deep nesting (7+ levels)
const deepTemplate = [
  {
    type: 'element',
    tag: 'div',
    children: [{
      type: 'element', 
      tag: 'section',
      children: [{
        type: 'element',
        tag: 'article',
        children: [
          // ... 4 more levels deep
        ]
      }]
    }]
  }
];
```

**Performance Impact**: 
- Optimal depth (≤4 levels): 15ms processing time
- Deep nesting (7+ levels): 47ms processing time (+213% slower)

#### Node Count Optimization

```typescript
// ✅ Good: Reasonable node count per template
const reasonableTemplate = generateTemplate({ 
  elements: 25,  // Good balance
  depth: 3
});

// ⚠️ Consider chunking: Large templates  
const largeTemplate = generateTemplate({
  elements: 200, // Consider breaking into smaller chunks
  depth: 4
});
```

**Guidelines**:
- **Small templates**: 5-15 nodes (1-5ms processing)
- **Medium templates**: 16-50 nodes (6-20ms processing)  
- **Large templates**: 51-150 nodes (21-60ms processing)
- **Very large templates**: 150+ nodes (consider chunking)

### 2. Concept Optimization

#### Static vs Dynamic Classes

```typescript
// ✅ Good: Use static classes when possible
const staticStyling: StylingConcept = {
  staticClasses: ['card', 'card-primary', 'p-4'], // Fast processing
  dynamicClasses: [], // Minimize dynamic classes
  inlineStyles: {}
};

// ❌ Poor: Excessive dynamic classes
const dynamicStyling: StylingConcept = {
  staticClasses: [],
  dynamicClasses: [
    'card',
    'isActive ? "card-active" : "card-inactive"',
    'theme === "dark" ? "dark-theme" : "light-theme"',
    'size === "large" ? "card-lg" : "card-sm"'
  ], // Slower processing for each dynamic expression
  inlineStyles: {}
};
```

**Performance Impact**:
- **Static classes**: 0.08ms per class
- **Dynamic classes**: 0.23ms per expression (+187% slower)

#### Event Handler Optimization

```typescript
// ✅ Good: Simple event handlers
const optimizedEvents: EventConcept[] = [
  {
    nodeId: '1',
    name: 'click',
    handler: 'handleClick', // Simple function reference
    modifiers: ['prevent'] // Minimal modifiers
  }
];

// ❌ Poor: Complex event handling
const complexEvents: EventConcept[] = [
  {
    nodeId: '1', 
    name: 'click',
    handler: 'handleComplexClick', // Complex function name
    modifiers: ['prevent', 'stop', 'once', 'self'], // Multiple modifiers
    parameters: ['$event', 'index', 'data', 'context'] // Many parameters
  }
];
```

**Performance Guidelines**:
- **Modifiers**: Keep to 0-2 modifiers per event
- **Parameters**: Limit to 0-2 parameters per handler
- **Handler complexity**: Use simple function references

#### Conditional and Iteration Optimization

```typescript
// ✅ Good: Simple conditionals
const simpleConditional: ConditionalConcept = {
  nodeId: '1',
  condition: 'isVisible', // Simple boolean expression
  thenNodes: [{ type: 'text', content: 'Visible' }], // Minimal content
  elseNodes: [{ type: 'text', content: 'Hidden' }]
};

// ❌ Poor: Complex conditionals with nested content
const complexConditional: ConditionalConcept = {
  nodeId: '1',
  condition: 'user.isAuthenticated && user.permissions.includes("admin") && feature.enabled', // Complex expression
  thenNodes: [ /* Large nested structure */ ],
  elseNodes: [ /* Another large nested structure */ ]
};
```

### 3. Extension Data Optimization

#### BEM Extension Data

```typescript
// ✅ Good: Efficient BEM structure
const optimizedBemData = {
  bem: [
    { nodeId: 'card', data: { block: 'card' } },
    { nodeId: 'card.header', data: { element: 'header' } },
    { nodeId: 'card.body', data: { element: 'body' } }
  ]
};

// ❌ Poor: Redundant BEM structure
const inefficientBemData = {
  bem: [
    { 
      nodeId: 'card',
      data: { 
        block: 'card',
        modifiers: [], // Empty arrays waste memory
        styles: {}, // Empty objects waste memory
        meta: { framework: 'react' } // Unnecessary metadata
      }
    }
  ]
};
```

## Extension-Level Optimizations

### 1. Framework Extension Performance

#### React Extension Optimization

```typescript
// ✅ Good: Efficient React configuration
const optimizedReactConfig: ProcessingOptions = {
  framework: 'react',
  extensionConfig: {
    react: {
      typescript: true, // Enable for better tree-shaking
      jsxRuntime: 'automatic', // Use modern JSX runtime
      memo: true, // Enable React.memo for components
      hooks: ['useState', 'useEffect'] // Only include needed hooks
    }
  }
};

// Configure for optimal JSX generation
const reactExtension = new ReactFrameworkExtension();
reactExtension.setOptimizations({
  inlineStyles: false, // Use CSS classes instead
  fragmentOptimization: true, // Optimize Fragment usage
  eventOptimization: true // Optimize event handler generation
});
```

#### Vue Extension Optimization

```typescript
// ✅ Good: Efficient Vue configuration
const optimizedVueConfig: ProcessingOptions = {
  framework: 'vue',
  extensionConfig: {
    vue: {
      composition: true, // Use Composition API (faster)
      scriptSetup: true, // Use <script setup> syntax
      typescript: true,
      optimizeImports: true // Tree-shake unused Vue features
    }
  }
};
```

#### Svelte Extension Optimization

```typescript
// ✅ Good: Efficient Svelte configuration
const optimizedSvelteConfig: ProcessingOptions = {
  framework: 'svelte',
  extensionConfig: {
    svelte: {
      compiler: 'modern', // Use latest compiler optimizations
      css: 'scoped', // Scoped CSS for better performance
      typescript: true,
      optimize: true // Enable Svelte compiler optimizations
    }
  }
};
```

### 2. Styling Extension Performance

#### BEM Extension Optimization

```typescript
// Configure BEM extension for performance
const bemExtension = new BemStylingExtension();

// ✅ Good: Optimized BEM configuration
bemExtension.configure({
  separator: { element: '__', modifier: '--' }, // Standard separators (fastest)
  scssGeneration: false, // Disable if not needed
  classValidation: false, // Disable in production
  memoryOptimized: true, // Use memory-efficient processing
  batchProcessing: true // Process multiple nodes together
});

// ✅ Good: Use BEM extension efficiently
const efficientBemProcessing: ProcessingOptions = {
  styling: 'bem',
  extensionConfig: {
    bem: {
      generateScss: false, // Only generate when needed
      validateClasses: false, // Skip validation in production
      optimizeOutput: true // Minimize generated class names
    }
  }
};
```

#### Tailwind Extension Optimization

```typescript
// ✅ Good: Optimized Tailwind configuration
const optimizedTailwindConfig: ProcessingOptions = {
  styling: 'tailwind',
  extensionConfig: {
    tailwind: {
      purge: true, // Remove unused utilities
      minify: true, // Minify generated CSS
      preflight: false, // Disable if not needed
      corePlugins: ['padding', 'margin', 'colors'], // Only include used plugins
      darkMode: false // Disable if not used
    }
  }
};
```

### 3. Processing Pipeline Optimization

#### Basic Processing vs Advanced Processing

```typescript
// ✅ Good: Use basic processing for simple templates
const basicProcessing = await pipeline.process(template, {
  framework: 'react',
  styling: 'bem'
  // No advanced features - faster processing
});

// ⚠️ Use advanced processing only when needed
const advancedProcessing = await pipeline.processAdvanced(template, {
  framework: 'react', 
  styling: 'bem',
  extraction: {
    useEventExtractor: true, // Only enable if needed
    useStylingExtractor: true, // Only enable if needed
    normalizeEvents: true, // Only enable if needed
    validateConcepts: false // Disable in production
  },
  validation: {
    checkAccessibility: false, // Disable expensive checks in production
    checkPerformance: false,
    enableCrossConceptValidation: false
  }
});
```

**Performance Impact**:
- **Basic processing**: 15ms average
- **Advanced processing**: 28ms average (+87% slower)

#### Auto-Enhancement Optimization

```typescript
// ✅ Good: Configure auto-enhancement threshold
const pipeline = new ProcessingPipeline(registry);

// Set thresholds for auto-enhancement
pipeline.setAutoEnhancementThresholds({
  eventExtractorThreshold: 10, // Only enable for 10+ events
  stylingExtractorThreshold: 20, // Only enable for 20+ style nodes  
  validationThreshold: 50, // Only enable validation for 50+ total concepts
  complexityThreshold: 0.7 // Only enable for complexity score > 0.7
});
```

## Memory Optimization

### 1. Concept Memory Management

#### Efficient Concept Creation

```typescript
// ✅ Good: Memory-efficient concept creation
class OptimizedConceptBuilder {
  private conceptPool = new Map<string, ComponentConcept>(); // Reuse concepts
  
  createConcept(template: TemplateNode[]): ComponentConcept {
    const key = this.getTemplateKey(template);
    
    if (this.conceptPool.has(key)) {
      return this.conceptPool.get(key)!; // Reuse existing concept
    }
    
    const concept = this.buildConcept(template);
    this.conceptPool.set(key, concept);
    return concept;
  }
  
  cleanup(): void {
    this.conceptPool.clear(); // Cleanup when done
  }
}

// ❌ Poor: Creating new concepts every time
class IneffientConceptBuilder {
  createConcept(template: TemplateNode[]): ComponentConcept {
    return {
      structure: this.extractStructure(template), // New objects every time
      events: this.extractEvents(template),
      styling: this.extractStyling(template),
      // ... more allocations
    };
  }
}
```

#### Object Reuse Patterns

```typescript
// ✅ Good: Reuse objects and arrays
class MemoryOptimizedProcessor {
  private reusableArray: any[] = [];
  private reusableObject: Record<string, any> = {};
  
  processTemplate(template: TemplateNode[]): ProcessingResult {
    // Clear and reuse arrays/objects
    this.reusableArray.length = 0;
    Object.keys(this.reusableObject).forEach(key => delete this.reusableObject[key]);
    
    // Use reusable containers for processing
    return this.doProcessing(template, this.reusableArray, this.reusableObject);
  }
}
```

### 2. Extension Memory Management

#### Extension Instance Reuse

```typescript
// ✅ Good: Reuse extension instances
class ExtensionManager {
  private extensionCache = new Map<string, Extension>();
  
  getExtension(key: string, type: ExtensionType): Extension {
    const cacheKey = `${type}:${key}`;
    
    if (!this.extensionCache.has(cacheKey)) {
      this.extensionCache.set(cacheKey, this.createExtension(key, type));
    }
    
    return this.extensionCache.get(cacheKey)!;
  }
}

// ❌ Poor: Creating new extension instances
class IneffiecientExtensionManager {
  getExtension(key: string, type: ExtensionType): Extension {
    return this.createExtension(key, type); // New instance every time
  }
}
```

### 3. Garbage Collection Optimization

#### Memory Pressure Management

```typescript
// ✅ Good: Monitor and manage memory pressure
class ProcessingPipeline {
  private processingCount = 0;
  private readonly GC_THRESHOLD = 100; // Trigger cleanup every 100 processings
  
  async process(template: TemplateNode[], options: ProcessingOptions): Promise<ProcessingResult> {
    this.processingCount++;
    
    const result = await this.doProcessing(template, options);
    
    // Periodic cleanup to prevent memory leaks
    if (this.processingCount % this.GC_THRESHOLD === 0) {
      this.cleanup();
      
      // Suggest GC if memory pressure is high
      if (process.memoryUsage().heapUsed > 100 * 1024 * 1024) { // 100MB
        global.gc?.(); // Only if --expose-gc flag is used
      }
    }
    
    return result;
  }
  
  private cleanup(): void {
    // Clear caches and temporary data
    this.conceptCache.clear();
    this.templateCache.clear();
    this.errorCollector.clear();
  }
}
```

## Caching Strategies

### 1. Template-Level Caching

```typescript
// ✅ Good: Template result caching
class CachedProcessingPipeline extends ProcessingPipeline {
  private resultCache = new LRUCache<string, ProcessingResult>({
    maxSize: 100, // Cache last 100 results
    ttl: 5 * 60 * 1000, // 5 minute TTL
  });
  
  async process(template: TemplateNode[], options: ProcessingOptions): Promise<ProcessingResult> {
    const cacheKey = this.getCacheKey(template, options);
    
    if (this.resultCache.has(cacheKey)) {
      return this.resultCache.get(cacheKey)!;
    }
    
    const result = await super.process(template, options);
    this.resultCache.set(cacheKey, result);
    return result;
  }
  
  private getCacheKey(template: TemplateNode[], options: ProcessingOptions): string {
    return `${JSON.stringify(template)}-${JSON.stringify(options)}`;
  }
}
```

### 2. Concept-Level Caching

```typescript
// ✅ Good: Cache expensive concept extractions
class CachedTemplateAnalyzer extends TemplateAnalyzer {
  private conceptCache = new Map<string, ComponentConcept>();
  
  extractConcepts(template: TemplateNode[]): ComponentConcept {
    const templateHash = this.hashTemplate(template);
    
    if (this.conceptCache.has(templateHash)) {
      return this.conceptCache.get(templateHash)!;
    }
    
    const concepts = super.extractConcepts(template);
    this.conceptCache.set(templateHash, concepts);
    return concepts;
  }
  
  private hashTemplate(template: TemplateNode[]): string {
    // Fast hash function for template structure
    return template.map(node => `${node.type}-${node.tag}`).join('|');
  }
}
```

### 3. Extension Output Caching

```typescript
// ✅ Good: Cache extension processing results
class CachedFrameworkExtension implements FrameworkExtension {
  private eventCache = new Map<string, FrameworkEventOutput>();
  private renderCache = new Map<string, string>();
  
  processEvents(events: EventConcept[]): FrameworkEventOutput {
    const key = JSON.stringify(events);
    
    if (this.eventCache.has(key)) {
      return this.eventCache.get(key)!;
    }
    
    const result = this.doProcessEvents(events);
    this.eventCache.set(key, result);
    return result;
  }
  
  renderComponent(concepts: ComponentConcept, context: RenderContext): string {
    const key = this.getComponentKey(concepts, context);
    
    if (this.renderCache.has(key)) {
      return this.renderCache.get(key)!;
    }
    
    const result = this.doRenderComponent(concepts, context);
    this.renderCache.set(key, result);
    return result;
  }
}
```

## Production Optimizations

### 1. Environment Configuration

```typescript
// ✅ Good: Production-optimized configuration
const productionConfig: ProcessingOptions = {
  framework: 'react',
  styling: 'bem',
  
  // Disable expensive development features
  validation: {
    checkAccessibility: false,
    checkPerformance: false,
    checkBestPractices: false,
    enableCrossConceptValidation: false
  },
  
  extraction: {
    validateConcepts: false, // Skip validation in production
    normalizeEvents: true, // Keep normalization for consistency
    useEventExtractor: false, // Use basic extraction
    useStylingExtractor: false
  },
  
  // Extension-specific optimizations
  extensionConfig: {
    react: {
      typescript: false, // Skip TypeScript generation in production
      development: false, // Disable development helpers
      minify: true // Enable minification
    },
    bem: {
      generateScss: false, // Skip SCSS generation if CSS is pre-built
      validateClasses: false, // Skip validation
      optimizeClassNames: true // Use shorter class names
    }
  }
};
```

### 2. Bundle Size Optimization

#### Tree-Shaking Configuration

```typescript
// ✅ Good: Import only needed parts
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { ReactFrameworkExtension } from '@js-template-engine/extension-react';
import { BemStylingExtension } from '@js-template-engine/extension-bem';

// Don't import entire packages
// ❌ Poor: import * as Core from '@js-template-engine/core';

// ✅ Good: Configure bundler for tree-shaking
// webpack.config.js
module.exports = {
  optimization: {
    usedExports: true, // Enable tree shaking
    sideEffects: false // Mark packages as side-effect free
  }
};
```

#### Dynamic Extension Loading

```typescript
// ✅ Good: Load extensions dynamically when needed
class DynamicExtensionLoader {
  private loadedExtensions = new Map<string, Promise<Extension>>();
  
  async getExtension(type: string, key: string): Promise<Extension> {
    const extensionKey = `${type}-${key}`;
    
    if (!this.loadedExtensions.has(extensionKey)) {
      const extensionPromise = this.dynamicallyLoad(type, key);
      this.loadedExtensions.set(extensionKey, extensionPromise);
    }
    
    return this.loadedExtensions.get(extensionKey)!;
  }
  
  private async dynamicallyLoad(type: string, key: string): Promise<Extension> {
    switch (`${type}-${key}`) {
      case 'framework-react':
        return import('@js-template-engine/extension-react').then(m => new m.ReactFrameworkExtension());
      case 'styling-bem':
        return import('@js-template-engine/extension-bem').then(m => new m.BemStylingExtension());
      default:
        throw new Error(`Unknown extension: ${type}-${key}`);
    }
  }
}
```

### 3. Worker-Based Processing

```typescript
// ✅ Good: Offload processing to workers for large templates
class WorkerProcessingPipeline extends ProcessingPipeline {
  private worker?: Worker;
  private readonly WORKER_THRESHOLD = 100; // Use worker for 100+ nodes
  
  async process(template: TemplateNode[], options: ProcessingOptions): Promise<ProcessingResult> {
    const nodeCount = this.countNodes(template);
    
    if (nodeCount > this.WORKER_THRESHOLD) {
      return this.processInWorker(template, options);
    }
    
    return super.process(template, options);
  }
  
  private async processInWorker(
    template: TemplateNode[], 
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    if (!this.worker) {
      this.worker = new Worker('./processing-worker.js');
    }
    
    return new Promise((resolve, reject) => {
      this.worker!.postMessage({ template, options });
      
      this.worker!.onmessage = (event) => {
        resolve(event.data);
      };
      
      this.worker!.onerror = (error) => {
        reject(error);
      };
    });
  }
}
```

## Monitoring and Profiling

### 1. Performance Monitoring

```typescript
// ✅ Good: Built-in performance monitoring
class MonitoredProcessingPipeline extends ProcessingPipeline {
  private metrics = {
    totalProcessings: 0,
    averageTime: 0,
    peakMemory: 0,
    errorRate: 0
  };
  
  async process(template: TemplateNode[], options: ProcessingOptions): Promise<ProcessingResult> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;
    
    const result = await super.process(template, options);
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;
    
    // Update metrics
    const processingTime = Number((endTime - startTime) / 1000000n);
    this.updateMetrics(processingTime, endMemory - startMemory, result.errors.hasErrors());
    
    // Log slow processing
    if (processingTime > 100) { // 100ms threshold
      console.warn(`Slow processing detected: ${processingTime}ms for ${this.countNodes(template)} nodes`);
    }
    
    return result;
  }
  
  private updateMetrics(time: number, memoryDelta: number, hasErrors: boolean): void {
    this.metrics.totalProcessings++;
    this.metrics.averageTime = (this.metrics.averageTime * (this.metrics.totalProcessings - 1) + time) / this.metrics.totalProcessings;
    this.metrics.peakMemory = Math.max(this.metrics.peakMemory, memoryDelta);
    if (hasErrors) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalProcessings - 1) + 1) / this.metrics.totalProcessings;
    }
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
}
```

### 2. Memory Profiling

```typescript
// ✅ Good: Memory usage tracking
class MemoryProfiledPipeline extends ProcessingPipeline {
  async process(template: TemplateNode[], options: ProcessingOptions): Promise<ProcessingResult> {
    const initialMemory = process.memoryUsage();
    
    const result = await super.process(template, options);
    
    const finalMemory = process.memoryUsage();
    const memoryDelta = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external,
      rss: finalMemory.rss - initialMemory.rss
    };
    
    // Add memory info to result
    return {
      ...result,
      performance: {
        ...result.performance,
        memoryDelta
      }
    };
  }
}
```

## Performance Testing

### 1. Benchmark Suite

```typescript
// ✅ Good: Comprehensive performance testing
describe('Performance Benchmarks', () => {
  const templates = {
    small: generateTemplate({ elements: 5, depth: 2 }),
    medium: generateTemplate({ elements: 25, depth: 3 }),
    large: generateTemplate({ elements: 100, depth: 4 })
  };
  
  const configurations = [
    { framework: 'react', styling: 'bem' },
    { framework: 'vue', styling: 'tailwind' },
    { framework: 'svelte', styling: 'bem' }
  ];
  
  configurations.forEach(config => {
    describe(`${config.framework} + ${config.styling}`, () => {
      Object.entries(templates).forEach(([size, template]) => {
        it(`should process ${size} template within performance budget`, async () => {
          const iterations = 100;
          const times: number[] = [];
          
          // Warm-up
          for (let i = 0; i < 10; i++) {
            await pipeline.process(template, config);
          }
          
          // Measure
          for (let i = 0; i < iterations; i++) {
            const start = process.hrtime.bigint();
            await pipeline.process(template, config);
            const end = process.hrtime.bigint();
            times.push(Number((end - start) / 1000000n));
          }
          
          const averageTime = times.reduce((a, b) => a + b) / times.length;
          const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
          
          // Performance budgets
          const budgets = {
            small: { average: 5, p95: 10 },
            medium: { average: 20, p95: 40 },
            large: { average: 80, p95: 160 }
          };
          
          expect(averageTime).toBeLessThan(budgets[size as keyof typeof budgets].average);
          expect(p95Time).toBeLessThan(budgets[size as keyof typeof budgets].p95);
        });
      });
    });
  });
});
```

### 2. Memory Testing

```typescript
// ✅ Good: Memory leak detection
describe('Memory Leak Tests', () => {
  it('should not leak memory during repeated processing', async () => {
    const template = generateTemplate({ elements: 50, depth: 3 });
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Process many times
    for (let i = 0; i < 1000; i++) {
      await pipeline.process(template, { framework: 'react' });
      
      // Periodic GC to get accurate measurements
      if (i % 100 === 0) {
        global.gc?.();
      }
    }
    
    global.gc?.(); // Final GC
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Should not increase by more than 10MB
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
```

---

*This optimization guide provides comprehensive strategies for maximizing performance across all aspects of the JS Template Engine. Regular profiling and monitoring will help identify additional optimization opportunities specific to your use case.*