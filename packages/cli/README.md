# @js-template-engine/cli

[![npm version](https://img.shields.io/badge/npm-1.0.1-blue.svg)](https://www.npmjs.com/package/@js-template-engine/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> **Production-ready CLI for the JS Template Engine - Transform component templates into framework-specific code with a single command.**

Perfect for rapid prototyping, component library development, and maintaining consistency across multiple frameworks in production applications.

## 🚀 Installation

### Global Installation (Recommended)

```bash
npm install -g @js-template-engine/cli
# or
yarn global add @js-template-engine/cli
# or  
pnpm add -g @js-template-engine/cli
```

### Local Project Installation

```bash
npm install --save-dev @js-template-engine/cli
# or
yarn add --dev @js-template-engine/cli
# or
pnpm add -D @js-template-engine/cli
```

### Verify Installation

```bash
js-template-engine --version
js-template-engine --help
```

## 📚 Progressive Usage Guide

### **Level 1: Basic Component Generation**

Start with simple components to understand the fundamentals.

#### Simple Button Component

Create a basic button template:

```json
// templates/button.json
{
  "component": {
    "name": "Button",
    "props": {
      "children": "React.ReactNode",
      "onClick": "() => void"
    }
  },
  "template": [
    {
      "tag": "button",
      "attributes": {
        "type": "button",
        "class": "btn"
      },
      "children": [
        {
          "type": "slot",
          "name": "children"
        }
      ],
      "extensions": {
        "react": {
          "expressionAttributes": {
            "onClick": "props.onClick"
          }
        },
        "vue": {
          "expressionAttributes": {
            "@click": "onClick"
          }
        }
      }
    }
  ]
}
```

**Generate React Component:**

```bash
js-template-engine render templates/button.json \
  --framework react \
  --output ./src/components \
  --name Button
```

**Generate Vue Component:**

```bash
js-template-engine render templates/button.json \
  --framework vue \
  --output ./src/components \
  --name Button
```

**Generated React Output (`Button.tsx`):**

```tsx
export interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button type="button" className="btn" onClick={onClick}>
      {children}
    </button>
  );
}
```

### **Level 2: Components with Events and Styling**

Add event handling, styling variants, and BEM methodology.

#### Enhanced Input Component with Validation

```json
// templates/input.json
{
  "component": {
    "name": "Input",
    "props": {
      "value": "string",
      "onChange": "(value: string) => void",
      "onBlur": "() => void",
      "placeholder": "string",
      "error": "string",
      "variant": "\"primary\" | \"secondary\" | \"error\""
    }
  },
  "template": [
    {
      "tag": "div",
      "attributes": {
        "class": "input-wrapper"
      },
      "children": [
        {
          "tag": "input",
          "attributes": {
            "type": "text",
            "class": "input"
          },
          "extensions": {
            "react": {
              "expressionAttributes": {
                "value": "props.value",
                "onChange": "(e) => props.onChange(e.target.value)",
                "onBlur": "props.onBlur",
                "placeholder": "props.placeholder",
                "className": "clsx('input', props.variant && `input--${props.variant}`, props.error && 'input--error')"
              }
            },
            "vue": {
              "expressionAttributes": {
                ":value": "value",
                "@input": "onChange($event.target.value)",
                "@blur": "onBlur",
                ":placeholder": "placeholder",
                ":class": "`input ${variant ? `input--${variant}` : ''} ${error ? 'input--error' : ''}`"
              }
            },
            "bem": {
              "block": "input",
              "modifiers": ["{{variant}}", "{{error ? 'error' : ''}}"]
            }
          }
        },
        {
          "type": "if",
          "condition": "error",
          "then": [
            {
              "tag": "span",
              "attributes": {
                "class": "input__error"
              },
              "children": [
                {
                  "type": "text",
                  "content": "{{error}}"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

**Generate with BEM Styling:**

```bash
js-template-engine render templates/input.json \
  --framework react \
  --styling bem \
  --output ./src/components \
  --name Input
```

**Generated Output:**

```tsx
// Input.tsx
export interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  variant?: "primary" | "secondary" | "error";
}

export function Input({ value, onChange, onBlur, placeholder, error, variant }: InputProps) {
  return (
    <div className="input-wrapper">
      <input 
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={clsx(
          'input',
          variant && `input--${variant}`,
          error && 'input--error'
        )}
      />
      {error && (
        <span className="input__error">
          {error}
        </span>
      )}
    </div>
  );
}
```

```scss
// Input.scss (BEM styling)
.input-wrapper {
  position: relative;
  width: 100%;
}

.input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &--primary {
    border-color: #3b82f6;
  }

  &--secondary {
    border-color: #6b7280;
  }

  &--error {
    border-color: #ef4444;
    
    &:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
  }

  &__error {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: #ef4444;
  }
}
```

### **Level 3: Complex Forms with Multiple Frameworks**

Build sophisticated form components with validation, dynamic fields, and framework-specific optimizations.

#### Dynamic Contact Form

```json
// templates/contact-form.json
{
  "component": {
    "name": "ContactForm",
    "props": {
      "initialValues": "{ name: string; email: string; message: string; priority: 'low' | 'medium' | 'high' }",
      "onSubmit": "(values: FormValues) => void",
      "loading": "boolean",
      "errors": "Partial<FormValues>",
      "showPriority": "boolean"
    }
  },
  "template": [
    {
      "tag": "form",
      "attributes": {
        "class": "contact-form"
      },
      "extensions": {
        "react": {
          "expressionAttributes": {
            "onSubmit": "(e) => { e.preventDefault(); props.onSubmit?.(formValues); }"
          }
        },
        "vue": {
          "expressionAttributes": {
            "@submit.prevent": "onSubmit"
          }
        }
      },
      "children": [
        {
          "tag": "div",
          "attributes": {
            "class": "contact-form__group"
          },
          "children": [
            {
              "tag": "label",
              "attributes": {
                "for": "name",
                "class": "contact-form__label"
              },
              "children": [
                {
                  "type": "text",
                  "content": "Full Name *"
                }
              ]
            },
            {
              "tag": "input",
              "attributes": {
                "id": "name",
                "type": "text",
                "class": "contact-form__input",
                "required": true
              },
              "extensions": {
                "react": {
                  "expressionAttributes": {
                    "value": "formValues.name",
                    "onChange": "(e) => setFormValues(prev => ({ ...prev, name: e.target.value }))",
                    "className": "clsx('contact-form__input', props.errors?.name && 'contact-form__input--error')"
                  }
                },
                "vue": {
                  "expressionAttributes": {
                    "v-model": "formValues.name",
                    ":class": "`contact-form__input ${errors?.name ? 'contact-form__input--error' : ''}`"
                  }
                }
              }
            },
            {
              "type": "if",
              "condition": "errors?.name",
              "then": [
                {
                  "tag": "span",
                  "attributes": {
                    "class": "contact-form__error"
                  },
                  "children": [
                    {
                      "type": "text",
                      "content": "{{errors.name}}"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "tag": "div",
          "attributes": {
            "class": "contact-form__group"
          },
          "children": [
            {
              "tag": "label",
              "attributes": {
                "for": "email",
                "class": "contact-form__label"
              },
              "children": [
                {
                  "type": "text",
                  "content": "Email Address *"
                }
              ]
            },
            {
              "tag": "input",
              "attributes": {
                "id": "email",
                "type": "email",
                "class": "contact-form__input",
                "required": true
              },
              "extensions": {
                "react": {
                  "expressionAttributes": {
                    "value": "formValues.email",
                    "onChange": "(e) => setFormValues(prev => ({ ...prev, email: e.target.value }))",
                    "className": "clsx('contact-form__input', props.errors?.email && 'contact-form__input--error')"
                  }
                },
                "vue": {
                  "expressionAttributes": {
                    "v-model": "formValues.email",
                    ":class": "`contact-form__input ${errors?.email ? 'contact-form__input--error' : ''}`"
                  }
                }
              }
            }
          ]
        },
        {
          "type": "if",
          "condition": "showPriority",
          "then": [
            {
              "tag": "div",
              "attributes": {
                "class": "contact-form__group"
              },
              "children": [
                {
                  "tag": "label",
                  "attributes": {
                    "for": "priority",
                    "class": "contact-form__label"
                  },
                  "children": [
                    {
                      "type": "text",
                      "content": "Priority"
                    }
                  ]
                },
                {
                  "tag": "select",
                  "attributes": {
                    "id": "priority",
                    "class": "contact-form__select"
                  },
                  "extensions": {
                    "react": {
                      "expressionAttributes": {
                        "value": "formValues.priority",
                        "onChange": "(e) => setFormValues(prev => ({ ...prev, priority: e.target.value }))"
                      }
                    },
                    "vue": {
                      "expressionAttributes": {
                        "v-model": "formValues.priority"
                      }
                    }
                  },
                  "children": [
                    {
                      "tag": "option",
                      "attributes": {
                        "value": "low"
                      },
                      "children": [
                        {
                          "type": "text",
                          "content": "Low Priority"
                        }
                      ]
                    },
                    {
                      "tag": "option",
                      "attributes": {
                        "value": "medium"
                      },
                      "children": [
                        {
                          "type": "text",
                          "content": "Medium Priority"
                        }
                      ]
                    },
                    {
                      "tag": "option",
                      "attributes": {
                        "value": "high"
                      },
                      "children": [
                        {
                          "type": "text",
                          "content": "High Priority"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "tag": "div",
          "attributes": {
            "class": "contact-form__group"
          },
          "children": [
            {
              "tag": "label",
              "attributes": {
                "for": "message",
                "class": "contact-form__label"
              },
              "children": [
                {
                  "type": "text",
                  "content": "Message *"
                }
              ]
            },
            {
              "tag": "textarea",
              "attributes": {
                "id": "message",
                "class": "contact-form__textarea",
                "rows": 4,
                "required": true
              },
              "extensions": {
                "react": {
                  "expressionAttributes": {
                    "value": "formValues.message",
                    "onChange": "(e) => setFormValues(prev => ({ ...prev, message: e.target.value }))"
                  }
                },
                "vue": {
                  "expressionAttributes": {
                    "v-model": "formValues.message"
                  }
                }
              }
            }
          ]
        },
        {
          "tag": "div",
          "attributes": {
            "class": "contact-form__actions"
          },
          "children": [
            {
              "tag": "button",
              "attributes": {
                "type": "submit",
                "class": "contact-form__submit"
              },
              "extensions": {
                "react": {
                  "expressionAttributes": {
                    "disabled": "props.loading",
                    "className": "clsx('contact-form__submit', props.loading && 'contact-form__submit--loading')"
                  }
                },
                "vue": {
                  "expressionAttributes": {
                    ":disabled": "loading",
                    ":class": "`contact-form__submit ${loading ? 'contact-form__submit--loading' : ''}`"
                  }
                }
              },
              "children": [
                {
                  "type": "if",
                  "condition": "loading",
                  "then": [
                    {
                      "type": "text",
                      "content": "Sending..."
                    }
                  ],
                  "else": [
                    {
                      "type": "text",
                      "content": "Send Message"
                    }
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
```

**Generate for React with Tailwind:**

```bash
js-template-engine render templates/contact-form.json \
  --framework react \
  --styling tailwind \
  --output ./src/components/forms \
  --name ContactForm
```

**Generate for Vue with BEM:**

```bash
js-template-engine render templates/contact-form.json \
  --framework vue \
  --styling bem \
  --output ./src/components/forms \
  --name ContactForm
```

### **Level 4: Expert - Custom Extensions and Performance Optimization**

Advanced usage with custom extensions, build optimization, and monorepo workflows.

#### E-commerce Product Card with Multiple Extensions

```json
// templates/product-card.json
{
  "component": {
    "name": "ProductCard",
    "props": {
      "product": "{ id: string; name: string; price: number; image: string; rating: number; onSale?: boolean; badges?: string[] }",
      "onAddToCart": "(productId: string) => void",
      "onWishlist": "(productId: string) => void",
      "currency": "string",
      "layout": "\"compact\" | \"detailed\" | \"list\"",
      "showRating": "boolean",
      "showBadges": "boolean"
    }
  },
  "template": [
    {
      "tag": "article",
      "attributes": {
        "class": "product-card"
      },
      "extensions": {
        "bem": {
          "block": "product-card",
          "modifiers": ["{{layout}}", "{{product.onSale ? 'on-sale' : ''}}"]
        },
        "tailwind": {
          "classes": [
            "relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md",
            "{{layout === 'compact' ? 'max-w-xs' : layout === 'detailed' ? 'max-w-md' : 'flex max-w-2xl'}}"
          ]
        }
      },
      "children": [
        {
          "type": "if",
          "condition": "product.onSale",
          "then": [
            {
              "tag": "div",
              "attributes": {
                "class": "product-card__sale-badge"
              },
              "extensions": {
                "tailwind": {
                  "classes": ["absolute left-2 top-2 z-10 rounded-full bg-red-500 px-2 py-1 text-xs font-semibold text-white"]
                }
              },
              "children": [
                {
                  "type": "text",
                  "content": "SALE"
                }
              ]
            }
          ]
        },
        {
          "tag": "div",
          "attributes": {
            "class": "product-card__image-container"
          },
          "extensions": {
            "tailwind": {
              "classes": ["{{layout === 'list' ? 'w-48 flex-shrink-0' : 'aspect-square w-full'}}"]
            }
          },
          "children": [
            {
              "tag": "img",
              "attributes": {
                "class": "product-card__image"
              },
              "extensions": {
                "react": {
                  "expressionAttributes": {
                    "src": "props.product.image",
                    "alt": "props.product.name"
                  }
                },
                "vue": {
                  "expressionAttributes": {
                    ":src": "product.image",
                    ":alt": "product.name"
                  }
                },
                "tailwind": {
                  "classes": ["h-full w-full object-cover"]
                }
              }
            },
            {
              "tag": "button",
              "attributes": {
                "class": "product-card__wishlist-btn",
                "aria-label": "Add to wishlist"
              },
              "extensions": {
                "react": {
                  "expressionAttributes": {
                    "onClick": "(e) => { e.preventDefault(); props.onWishlist(props.product.id); }"
                  }
                },
                "vue": {
                  "expressionAttributes": {
                    "@click.prevent": "onWishlist(product.id)"
                  }
                },
                "tailwind": {
                  "classes": ["absolute right-2 top-2 rounded-full bg-white p-2 shadow-md transition-colors hover:bg-gray-50"]
                }
              },
              "children": [
                {
                  "tag": "svg",
                  "attributes": {
                    "class": "h-4 w-4",
                    "fill": "none",
                    "stroke": "currentColor",
                    "viewBox": "0 0 24 24"
                  },
                  "children": [
                    {
                      "tag": "path",
                      "attributes": {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        "d": "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "tag": "div",
          "attributes": {
            "class": "product-card__content"
          },
          "extensions": {
            "tailwind": {
              "classes": ["flex-1 p-4"]
            }
          },
          "children": [
            {
              "type": "if",
              "condition": "showBadges && product.badges && product.badges.length > 0",
              "then": [
                {
                  "tag": "div",
                  "attributes": {
                    "class": "product-card__badges"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["mb-2 flex flex-wrap gap-1"]
                    }
                  },
                  "children": [
                    {
                      "type": "for",
                      "items": "product.badges",
                      "item": "badge",
                      "key": "badge",
                      "children": [
                        {
                          "tag": "span",
                          "attributes": {
                            "class": "product-card__badge"
                          },
                          "extensions": {
                            "tailwind": {
                              "classes": ["rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800"]
                            }
                          },
                          "children": [
                            {
                              "type": "text",
                              "content": "{{badge}}"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "tag": "h3",
              "attributes": {
                "class": "product-card__name"
              },
              "extensions": {
                "tailwind": {
                  "classes": ["font-semibold text-gray-900 line-clamp-2"]
                }
              },
              "children": [
                {
                  "type": "text",
                  "content": "{{product.name}}"
                }
              ]
            },
            {
              "type": "if",
              "condition": "showRating",
              "then": [
                {
                  "tag": "div",
                  "attributes": {
                    "class": "product-card__rating"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["mt-1 flex items-center"]
                    }
                  },
                  "children": [
                    {
                      "tag": "div",
                      "attributes": {
                        "class": "product-card__stars"
                      },
                      "extensions": {
                        "react": {
                          "expressionAttributes": {
                            "title": "`${props.product.rating} out of 5 stars`"
                          }
                        }
                      },
                      "children": [
                        {
                          "type": "text",
                          "content": "★★★★☆"
                        }
                      ]
                    },
                    {
                      "tag": "span",
                      "attributes": {
                        "class": "product-card__rating-text"
                      },
                      "extensions": {
                        "tailwind": {
                          "classes": ["ml-1 text-sm text-gray-600"]
                        }
                      },
                      "children": [
                        {
                          "type": "text",
                          "content": "({{product.rating}})"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "tag": "div",
              "attributes": {
                "class": "product-card__price"
              },
              "extensions": {
                "tailwind": {
                  "classes": ["mt-2 text-lg font-bold text-gray-900"]
                }
              },
              "children": [
                {
                  "type": "text",
                  "content": "{{currency}}{{product.price}}"
                }
              ]
            },
            {
              "tag": "button",
              "attributes": {
                "class": "product-card__add-to-cart"
              },
              "extensions": {
                "react": {
                  "expressionAttributes": {
                    "onClick": "() => props.onAddToCart(props.product.id)"
                  }
                },
                "vue": {
                  "expressionAttributes": {
                    "@click": "onAddToCart(product.id)"
                  }
                },
                "tailwind": {
                  "classes": ["mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"]
                }
              },
              "children": [
                {
                  "type": "text",
                  "content": "Add to Cart"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

**Advanced Build Script:**

```bash
#!/bin/bash
# build-product-components.sh

# Generate for multiple frameworks and styling systems
frameworks=("react" "vue" "svelte")
styling_systems=("tailwind" "bem" "css")

for framework in "${frameworks[@]}"; do
  for styling in "${styling_systems[@]}"; do
    echo "Building ${framework} components with ${styling} styling..."
    
    js-template-engine render templates/product-card.json \
      --framework "$framework" \
      --styling "$styling" \
      --output "./dist/${framework}-${styling}" \
      --name ProductCard \
      --language typescript \
      --verbose
      
    echo "✅ Built ${framework} + ${styling} variant"
  done
done

echo "🎉 All component variants built successfully!"
```

## ⚙️ Configuration & Advanced Options

### Template Configuration File

Create a `template.config.ts` for project-wide settings:

```typescript
// template.config.ts
import { ExtensionConfig } from '@js-template-engine/cli';

export default {
  extensions: [
    '@js-template-engine/extension-react',
    '@js-template-engine/extension-vue',
    '@js-template-engine/extension-svelte',
    '@js-template-engine/extension-bem',
    '@js-template-engine/extension-tailwind'
  ],
  defaults: {
    framework: 'react',
    styling: 'tailwind',
    language: 'typescript',
    outputDir: './src/components'
  },
  templates: {
    // Template-specific overrides
    'product-card': {
      framework: 'react',
      styling: 'tailwind'
    },
    'navigation': {
      framework: 'vue',
      styling: 'bem'
    }
  }
} as ExtensionConfig;
```

### Package.json Scripts

```json
{
  "scripts": {
    "build:components": "js-template-engine render templates/**/*.json --config template.config.ts",
    "build:react": "js-template-engine render templates/**/*.json --framework react --output ./src/react",
    "build:vue": "js-template-engine render templates/**/*.json --framework vue --output ./src/vue",
    "dev:components": "js-template-engine render templates/**/*.json --watch --verbose",
    "validate:templates": "js-template-engine validate templates/**/*.json"
  }
}
```

## 🔧 Command Reference

### `render` Command

```bash
js-template-engine render <template-path> [options]
```

**Options:**

| Option | Alias | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--framework` | `-f` | string | Target framework (react, vue, svelte) | `react` |
| `--styling` | `-s` | string | Styling system (bem, tailwind, css) | `css` |
| `--output` | `-o` | string | Output directory | `./output` |
| `--name` | `-n` | string | Component name | Auto-detected |
| `--language` | `-l` | string | Language (typescript, javascript) | `typescript` |
| `--config` | `-c` | string | Config file path | `./template.config` |
| `--verbose` | `-v` | boolean | Verbose logging | `false` |
| `--watch` | `-w` | boolean | Watch for changes | `false` |
| `--clean` | | boolean | Clean output directory | `false` |

### `validate` Command

```bash
js-template-engine validate <template-path> [options]
```

Validates template syntax and structure.

### `init` Command

```bash
js-template-engine init [project-name]
```

Initialize a new template project with examples.

## 🚀 Performance Tips

### 1. Batch Processing
```bash
# Process multiple templates at once
js-template-engine render templates/**/*.json --framework react
```

### 2. Use Configuration Files
```bash
# Avoid repeating options
js-template-engine render templates/button.json --config template.config.ts
```

### 3. Watch Mode for Development
```bash
# Auto-rebuild on changes
js-template-engine render templates/**/*.json --watch --verbose
```

### 4. Parallel Builds
```bash
# Use parallel processing for multiple frameworks
js-template-engine render templates/**/*.json --framework react --output ./dist/react &
js-template-engine render templates/**/*.json --framework vue --output ./dist/vue &
wait
```

## 🧪 Testing Integration

### With Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts']
  }
});
```

```typescript
// test/component-generation.test.ts
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('Component Generation', () => {
  it('generates React button component', () => {
    execSync('js-template-engine render templates/button.json --framework react --output ./test-output');
    
    expect(existsSync('./test-output/Button.tsx')).toBe(true);
    
    const content = readFileSync('./test-output/Button.tsx', 'utf-8');
    expect(content).toContain('export interface ButtonProps');
    expect(content).toContain('export function Button');
  });
});
```

## 🆘 Troubleshooting

### Common Issues

**Q: "Command not found: js-template-engine"**
```bash
# Check if installed globally
npm list -g @js-template-engine/cli

# Or use npx
npx @js-template-engine/cli render template.json
```

**Q: "Template validation failed"**
```bash
# Validate template syntax
js-template-engine validate templates/my-template.json --verbose

# Common issues:
# - Missing required properties in component definition
# - Invalid JSON syntax
# - Unsupported extension configurations
```

**Q: "Generated component has TypeScript errors"**
```bash
# Check framework-specific props configuration
# Ensure proper TypeScript types in component.props
# Verify expressionAttributes syntax
```

**Q: "Extensions not loading"**
```bash
# Check template.config.ts extensions array
# Verify extension packages are installed
# Use --verbose flag to see extension loading process
```

## 📚 Related Documentation

- **[Core Engine](../core/README.md)** - Template processing engine
- **[Create UI Kit](../create-ui-kit/README.md)** - Component library scaffolding
- **[React Extension](../extension-react/README.md)** - React-specific features
- **[Vue Extension](../extension-vue/README.md)** - Vue component generation
- **[BEM Extension](../extension-bem/README.md)** - BEM methodology support
- **[Tailwind Extension](../extension-tailwind/README.md)** - Tailwind CSS integration

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT - see [LICENSE](../../LICENSE) for details.

---

**Need help?** [Open an issue](https://github.com/djurnamn/js-template-engine/issues) or [start a discussion](https://github.com/djurnamn/js-template-engine/discussions)!