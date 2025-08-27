import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';

/**
 * Performance baseline tests for the JS Template Engine
 * Establishes performance expectations for realistic template sizes
 */

describe('Performance Baseline Tests', () => {
  let registry: ExtensionRegistry;
  let pipeline: ProcessingPipeline;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    registry.registerFramework(new ReactExtension());
    registry.registerStyling(new TailwindExtension());
    pipeline = new ProcessingPipeline(registry);
  });

  it('should process small templates quickly (< 100ms)', async () => {
    const smallTemplate = [
      {
        type: 'element' as const,
        tag: 'div',
        attributes: { class: 'p-4 bg-blue-500' },
        children: [
          { type: 'text' as const, content: 'Hello World' }
        ]
      }
    ];

    const startTime = performance.now();
    
    const result = await pipeline.process(smallTemplate, {
      framework: 'react'
    });
    
    const duration = performance.now() - startTime;
    
    expect(result.errors.getErrors().length).toBe(0);
    expect(result.output).toContain('Hello World');
    expect(duration).toBeLessThan(100);
  });

  it('should process medium templates efficiently (< 300ms)', async () => {
    // Create a more complex template with nested elements
    const mediumTemplate = [
      {
        type: 'element' as const,
        tag: 'div',
        attributes: { class: 'container mx-auto p-8' },
        children: [
          {
            type: 'element' as const,
            tag: 'header',
            attributes: { class: 'mb-6' },
            children: [
              {
                type: 'element' as const,
                tag: 'h1',
                attributes: { class: 'text-3xl font-bold' },
                children: [{ type: 'text' as const, content: 'Performance Test' }]
              }
            ]
          },
          {
            type: 'element' as const,
            tag: 'main',
            attributes: { class: 'grid grid-cols-3 gap-4' },
            children: Array.from({ length: 10 }, (_, i) => ({
              type: 'element' as const,
              tag: 'div',
              attributes: { class: `card-${i} p-4 border rounded` },
              children: [
                {
                  type: 'element' as const,
                  tag: 'h2',
                  attributes: { class: 'text-xl mb-2' },
                  children: [{ type: 'text' as const, content: `Card ${i + 1}` }]
                },
                {
                  type: 'element' as const,
                  tag: 'p',
                  attributes: { class: 'text-gray-600' },
                  children: [{ type: 'text' as const, content: `This is card number ${i + 1} with some content.` }]
                }
              ]
            }))
          }
        ]
      }
    ];

    const startTime = performance.now();
    
    const result = await pipeline.process(mediumTemplate, {
      framework: 'react'
    });
    
    const duration = performance.now() - startTime;
    
    expect(result.errors.getErrors().length).toBe(0);
    expect(result.output).toContain('Performance Test');
    expect(result.output).toContain('Card 1');
    expect(result.output).toContain('Card 10');
    expect(duration).toBeLessThan(300);
  });

  it('should handle multiple framework processing efficiently', async () => {
    const vueRegistry = new ExtensionRegistry();
    vueRegistry.registerFramework(new VueExtension());
    vueRegistry.registerStyling(new TailwindExtension());
    const vuePipeline = new ProcessingPipeline(vueRegistry);

    const template = [
      {
        type: 'element' as const,
        tag: 'div',
        attributes: { class: 'flex items-center justify-center h-screen' },
        children: [
          {
            type: 'element' as const,
            tag: 'button',
            attributes: { 
              class: 'px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600',
              '@click': 'handleClick'
            },
            children: [{ type: 'text' as const, content: 'Click Me' }]
          }
        ]
      }
    ];

    const reactStart = performance.now();
    const reactResult = await pipeline.process(template, { framework: 'react' });
    const reactDuration = performance.now() - reactStart;

    const vueStart = performance.now();
    const vueResult = await vuePipeline.process(template, { framework: 'vue' });
    const vueDuration = performance.now() - vueStart;

    expect(reactResult.errors.getErrors().length).toBe(0);
    expect(vueResult.errors.getErrors().length).toBe(0);
    expect(reactDuration).toBeLessThan(200);
    expect(vueDuration).toBeLessThan(200);
  });

  it('should provide performance metrics in metadata', async () => {
    const template = [
      {
        type: 'element' as const,
        tag: 'div',
        attributes: { class: 'test-performance' },
        children: [
          { type: 'text' as const, content: 'Performance metrics test' }
        ]
      }
    ];

    const result = await pipeline.process(template, {
      framework: 'react'
    });

    expect(result.errors.getErrors().length).toBe(0);
    expect(result.metadata).toHaveProperty('processingTime');
    expect(result.metadata.processingTime).toBeTypeOf('number');
    expect(result.metadata.extensionsUsed).toContain('react');
  });
});