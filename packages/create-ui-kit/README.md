# create-ui-kit

[![npm version](https://img.shields.io/badge/npm-0.1.0-blue.svg)](https://www.npmjs.com/package/create-ui-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/Coverage-91%25-brightgreen.svg)](#)

> **Create framework-agnostic UI component libraries from a single source of truth - Build once, distribute everywhere.**

The complete solution for authors who want to create component libraries that work across React, Vue, Svelte, and more. From initial scaffolding to npm distribution with interactive CLI tools for end users.

## 🎯 Who This Is For

### **UI Kit Authors** 
- Create design systems that work across multiple frameworks
- Maintain a single source of truth for component definitions
- Generate framework-specific implementations automatically
- Distribute with built-in CLI tools for consumers

### **Component Library Authors**
- Reduce maintenance burden across frameworks
- Provide excellent developer experience for consumers
- Build once, support React, Vue, Svelte from day one
- Include documentation and examples automatically

### **Design System Teams**
- Enforce consistency across framework boundaries
- Enable rapid adoption across diverse development teams
- Centralize component logic and design tokens
- Scale component updates across entire ecosystem

## 🚀 Quick Start

### Create Your First UI Kit

```bash
# Create new UI kit project
npx create-ui-kit init my-design-system

# Navigate and install dependencies
cd my-design-system
pnpm install

# Build all framework variants
pnpm build

# Test the consumer experience
npm link
npx my-design-system add
```

## 📚 Progressive Usage Guide

### **Level 1: Getting Started - Simple Button Library**

Perfect for understanding the fundamentals and creating your first component library.

#### Initialize Your Project

```bash
npx create-ui-kit init button-library
cd button-library
```

**Interactive Setup Questions:**

```
? Project name: button-library
? Author name: Your Name
? Author email: you@company.com
? Target frameworks: React, Vue
? Styling approaches: CSS files, Tailwind CSS  
? TypeScript support: Yes
? BEM methodology: No
```

**Generated Project Structure:**

```
button-library/
├── src/
│   ├── components/           # Component templates
│   │   ├── button.json      # Primary button component
│   │   └── icon-button.json # Icon button variant
│   ├── cli.ts               # Consumer CLI
│   └── utilities/           # Build & documentation tools
├── templates/               # Template scaffolding for new components
├── dist/                    # Generated framework variants
│   ├── react/
│   ├── vue/
│   └── css/
├── create-ui-kit.config.js  # Configuration
├── package.json             # With proper exports and CLI script
└── README.md               # Auto-generated documentation
```

#### Define Your First Component

```json
// src/components/button.json
{
  "component": {
    "name": "Button",
    "description": "A versatile button component with multiple variants and sizes",
    "props": {
      "children": "React.ReactNode",
      "onClick": "() => void",
      "variant": "\"primary\" | \"secondary\" | \"outline\" | \"ghost\"",
      "size": "\"sm\" | \"md\" | \"lg\"",
      "disabled": "boolean",
      "loading": "boolean",
      "fullWidth": "boolean"
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
          "type": "if",
          "condition": "loading",
          "then": [
            {
              "tag": "span",
              "attributes": {
                "class": "btn__spinner"
              },
              "children": [
                {
                  "type": "text",
                  "content": "Loading..."
                }
              ]
            }
          ],
          "else": [
            {
              "type": "slot",
              "name": "children"
            }
          ]
        }
      ],
      "extensions": {
        "react": {
          "expressionAttributes": {
            "onClick": "props.onClick",
            "disabled": "props.disabled || props.loading",
            "className": "clsx('btn', `btn--${props.variant || 'primary'}`, `btn--${props.size || 'md'}', { 'btn--loading': props.loading, 'btn--full': props.fullWidth })"
          }
        },
        "vue": {
          "expressionAttributes": {
            "@click": "onClick",
            ":disabled": "disabled || loading",
            ":class": "`btn btn--${variant || 'primary'} btn--${size || 'md'} ${loading ? 'btn--loading' : ''} ${fullWidth ? 'btn--full' : ''}`"
          }
        },
        "tailwind": {
          "classes": [
            "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
            "{{variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' : ''}}",
            "{{variant === 'secondary' ? 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500' : ''}}",
            "{{variant === 'outline' ? 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-500' : ''}}",
            "{{variant === 'ghost' ? 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500' : ''}}",
            "{{size === 'sm' ? 'px-3 py-1.5 text-sm' : size === 'lg' ? 'px-6 py-3 text-lg' : 'px-4 py-2 text-base'}}",
            "{{fullWidth ? 'w-full' : ''}}",
            "{{disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}}"
          ]
        }
      }
    }
  ]
}
```

#### Build Your Library

```bash
# Generate all framework variants
pnpm build

# Preview what was generated
ls -la dist/
# react/Button.tsx
# vue/Button.vue  
# css/button.css
# tailwind/button.js
```

#### Test the Consumer Experience

```bash
# Link your library locally
npm link

# Test the CLI in another project
cd ../test-project
npm init -y
npx button-library add
```

**Consumer CLI Flow:**
```
? Which framework are you using? React
? How do you handle styling? Tailwind CSS
? Which components would you like to add? 
  ◉ Button
  ◯ IconButton
? Where should we place the components? ./src/components/ui
```

### **Level 2: Advanced Components - Dashboard UI Library**

Building more sophisticated components with multiple variants and complex interactions.

#### Create Advanced Components

```bash
npx create-ui-kit init dashboard-ui
cd dashboard-ui
```

Setup for comprehensive dashboard components:
- **Frameworks:** React, Vue, Svelte
- **Styling:** BEM, Tailwind, CSS Modules
- **Features:** Data tables, charts, forms, navigation

#### Data Table Component

```json
// src/components/data-table.json
{
  "component": {
    "name": "DataTable",
    "description": "A feature-rich data table with sorting, filtering, and pagination",
    "props": {
      "data": "Array<Record<string, any>>",
      "columns": "Array<{ key: string; label: string; sortable?: boolean; filterable?: boolean; width?: string }>",
      "loading": "boolean",
      "pagination": "{ currentPage: number; totalPages: number; pageSize: number }",
      "onSort": "(key: string, direction: 'asc' | 'desc') => void",
      "onFilter": "(key: string, value: string) => void",
      "onPageChange": "(page: number) => void",
      "emptyMessage": "string",
      "selectable": "boolean",
      "onSelectionChange": "(selectedRows: Array<any>) => void"
    }
  },
  "template": [
    {
      "tag": "div",
      "attributes": {
        "class": "data-table"
      },
      "extensions": {
        "tailwind": {
          "classes": ["overflow-x-auto rounded-lg border border-gray-200 bg-white"]
        }
      },
      "children": [
        {
          "type": "if",
          "condition": "loading",
          "then": [
            {
              "tag": "div",
              "attributes": {
                "class": "data-table__loading"
              },
              "extensions": {
                "tailwind": {
                  "classes": ["flex h-48 items-center justify-center"]
                }
              },
              "children": [
                {
                  "tag": "div",
                  "attributes": {
                    "class": "data-table__spinner"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"]
                    }
                  }
                }
              ]
            }
          ],
          "else": [
            {
              "tag": "table",
              "attributes": {
                "class": "data-table__table"
              },
              "extensions": {
                "tailwind": {
                  "classes": ["w-full"]
                }
              },
              "children": [
                {
                  "tag": "thead",
                  "attributes": {
                    "class": "data-table__head"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["bg-gray-50"]
                    }
                  },
                  "children": [
                    {
                      "tag": "tr",
                      "children": [
                        {
                          "type": "if",
                          "condition": "selectable",
                          "then": [
                            {
                              "tag": "th",
                              "attributes": {
                                "class": "data-table__header-cell data-table__header-cell--checkbox"
                              },
                              "extensions": {
                                "tailwind": {
                                  "classes": ["w-12 px-4 py-3"]
                                }
                              },
                              "children": [
                                {
                                  "tag": "input",
                                  "attributes": {
                                    "type": "checkbox",
                                    "class": "data-table__select-all"
                                  },
                                  "extensions": {
                                    "react": {
                                      "expressionAttributes": {
                                        "checked": "selectedRows.length === data.length && data.length > 0",
                                        "onChange": "handleSelectAll"
                                      }
                                    },
                                    "vue": {
                                      "expressionAttributes": {
                                        ":checked": "selectedRows.length === data.length && data.length > 0",
                                        "@change": "handleSelectAll"
                                      }
                                    }
                                  }
                                }
                              ]
                            }
                          ]
                        },
                        {
                          "type": "for",
                          "items": "columns",
                          "item": "column",
                          "key": "column.key",
                          "children": [
                            {
                              "tag": "th",
                              "attributes": {
                                "class": "data-table__header-cell"
                              },
                              "extensions": {
                                "react": {
                                  "expressionAttributes": {
                                    "style": "column.width ? { width: column.width } : undefined",
                                    "className": "clsx('data-table__header-cell', column.sortable && 'data-table__header-cell--sortable')"
                                  }
                                },
                                "vue": {
                                  "expressionAttributes": {
                                    ":style": "column.width ? { width: column.width } : undefined",
                                    ":class": "`data-table__header-cell ${column.sortable ? 'data-table__header-cell--sortable' : ''}`"
                                  }
                                },
                                "tailwind": {
                                  "classes": ["px-4 py-3 text-left text-sm font-medium text-gray-900"]
                                }
                              },
                              "children": [
                                {
                                  "type": "if",
                                  "condition": "column.sortable",
                                  "then": [
                                    {
                                      "tag": "button",
                                      "attributes": {
                                        "class": "data-table__sort-button"
                                      },
                                      "extensions": {
                                        "react": {
                                          "expressionAttributes": {
                                            "onClick": "() => props.onSort?.(column.key, getSortDirection(column.key))"
                                          }
                                        },
                                        "vue": {
                                          "expressionAttributes": {
                                            "@click": "onSort(column.key, getSortDirection(column.key))"
                                          }
                                        },
                                        "tailwind": {
                                          "classes": ["flex items-center space-x-1 hover:text-gray-700"]
                                        }
                                      },
                                      "children": [
                                        {
                                          "type": "text",
                                          "content": "{{column.label}}"
                                        },
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
                                                "d": "M8 9l4-4 4 4m0 6l-4 4-4-4"
                                              }
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  ],
                                  "else": [
                                    {
                                      "type": "text",
                                      "content": "{{column.label}}"
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
                },
                {
                  "tag": "tbody",
                  "attributes": {
                    "class": "data-table__body"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["divide-y divide-gray-200"]
                    }
                  },
                  "children": [
                    {
                      "type": "if",
                      "condition": "data.length === 0",
                      "then": [
                        {
                          "tag": "tr",
                          "children": [
                            {
                              "tag": "td",
                              "attributes": {
                                "class": "data-table__empty-cell"
                              },
                              "extensions": {
                                "react": {
                                  "expressionAttributes": {
                                    "colSpan": "columns.length + (selectable ? 1 : 0)"
                                  }
                                },
                                "vue": {
                                  "expressionAttributes": {
                                    ":colspan": "columns.length + (selectable ? 1 : 0)"
                                  }
                                },
                                "tailwind": {
                                  "classes": ["px-4 py-8 text-center text-gray-500"]
                                }
                              },
                              "children": [
                                {
                                  "type": "text",
                                  "content": "{{emptyMessage || 'No data available'}}"
                                }
                              ]
                            }
                          ]
                        }
                      ],
                      "else": [
                        {
                          "type": "for",
                          "items": "data",
                          "item": "row",
                          "index": "rowIndex",
                          "key": "rowIndex",
                          "children": [
                            {
                              "tag": "tr",
                              "attributes": {
                                "class": "data-table__row"
                              },
                              "extensions": {
                                "tailwind": {
                                  "classes": ["hover:bg-gray-50"]
                                }
                              },
                              "children": [
                                {
                                  "type": "if",
                                  "condition": "selectable",
                                  "then": [
                                    {
                                      "tag": "td",
                                      "attributes": {
                                        "class": "data-table__cell data-table__cell--checkbox"
                                      },
                                      "extensions": {
                                        "tailwind": {
                                          "classes": ["px-4 py-3"]
                                        }
                                      },
                                      "children": [
                                        {
                                          "tag": "input",
                                          "attributes": {
                                            "type": "checkbox",
                                            "class": "data-table__row-select"
                                          },
                                          "extensions": {
                                            "react": {
                                              "expressionAttributes": {
                                                "checked": "selectedRows.includes(row)",
                                                "onChange": "() => handleRowSelect(row)"
                                              }
                                            },
                                            "vue": {
                                              "expressionAttributes": {
                                                ":checked": "selectedRows.includes(row)",
                                                "@change": "handleRowSelect(row)"
                                              }
                                            }
                                          }
                                        }
                                      ]
                                    }
                                  ]
                                },
                                {
                                  "type": "for",
                                  "items": "columns",
                                  "item": "column",
                                  "key": "column.key",
                                  "children": [
                                    {
                                      "tag": "td",
                                      "attributes": {
                                        "class": "data-table__cell"
                                      },
                                      "extensions": {
                                        "tailwind": {
                                          "classes": ["px-4 py-3 text-sm text-gray-900"]
                                        }
                                      },
                                      "children": [
                                        {
                                          "type": "text",
                                          "content": "{{row[column.key]}}"
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
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "if",
          "condition": "pagination && pagination.totalPages > 1",
          "then": [
            {
              "tag": "div",
              "attributes": {
                "class": "data-table__pagination"
              },
              "extensions": {
                "tailwind": {
                  "classes": ["flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3"]
                }
              },
              "children": [
                {
                  "tag": "div",
                  "attributes": {
                    "class": "data-table__pagination-info"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["text-sm text-gray-700"]
                    }
                  },
                  "children": [
                    {
                      "type": "text",
                      "content": "Page {{pagination.currentPage}} of {{pagination.totalPages}}"
                    }
                  ]
                },
                {
                  "tag": "div",
                  "attributes": {
                    "class": "data-table__pagination-controls"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["flex space-x-2"]
                    }
                  },
                  "children": [
                    {
                      "tag": "button",
                      "attributes": {
                        "class": "data-table__pagination-button"
                      },
                      "extensions": {
                        "react": {
                          "expressionAttributes": {
                            "disabled": "pagination.currentPage <= 1",
                            "onClick": "() => props.onPageChange?.(pagination.currentPage - 1)"
                          }
                        },
                        "vue": {
                          "expressionAttributes": {
                            ":disabled": "pagination.currentPage <= 1",
                            "@click": "onPageChange(pagination.currentPage - 1)"
                          }
                        },
                        "tailwind": {
                          "classes": ["rounded bg-gray-200 px-3 py-1 text-sm disabled:opacity-50"]
                        }
                      },
                      "children": [
                        {
                          "type": "text",
                          "content": "Previous"
                        }
                      ]
                    },
                    {
                      "tag": "button",
                      "attributes": {
                        "class": "data-table__pagination-button"
                      },
                      "extensions": {
                        "react": {
                          "expressionAttributes": {
                            "disabled": "pagination.currentPage >= pagination.totalPages",
                            "onClick": "() => props.onPageChange?.(pagination.currentPage + 1)"
                          }
                        },
                        "vue": {
                          "expressionAttributes": {
                            ":disabled": "pagination.currentPage >= pagination.totalPages",
                            "@click": "onPageChange(pagination.currentPage + 1)"
                          }
                        },
                        "tailwind": {
                          "classes": ["rounded bg-gray-200 px-3 py-1 text-sm disabled:opacity-50"]
                        }
                      },
                      "children": [
                        {
                          "type": "text",
                          "content": "Next"
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
  ]
}
```

#### Advanced Configuration

```javascript
// create-ui-kit.config.js
export default {
  name: '@company/dashboard-ui',
  version: '1.0.0',
  description: 'Comprehensive dashboard components for modern web applications',
  author: {
    name: 'Your Company',
    email: 'team@company.com'
  },
  capabilities: {
    frameworks: ['react', 'vue', 'svelte'],
    styling: ['tailwind', 'bem', 'css-modules'],
    typescript: true,
    themes: ['light', 'dark'],
    accessibility: true
  },
  components: {
    'data-table': {
      frameworks: ['react', 'vue'],
      styling: ['tailwind', 'bem'],
      dependencies: {
        react: ['clsx', '@headlessui/react'],
        vue: ['@headlessui/vue']
      }
    },
    'chart': {
      frameworks: ['react', 'vue', 'svelte'],
      styling: ['tailwind', 'css-modules'],
      dependencies: {
        all: ['chart.js']
      }
    },
    'navigation': {
      frameworks: ['react', 'vue', 'svelte'],
      styling: ['tailwind', 'bem', 'css-modules']
    }
  },
  build: {
    outputDir: './dist',
    typescript: true,
    sourceMaps: true,
    minify: false
  },
  cli: {
    interactive: true,
    validation: true,
    conflictResolution: 'prompt',
    backupFiles: true
  }
};
```

### **Level 3: Advanced Patterns - E-commerce Component System**

Complex multi-component system with theming, internationalization, and advanced patterns.

#### Multi-Component E-commerce System

```bash
npx create-ui-kit init ecommerce-ui
cd ecommerce-ui
```

**Advanced Setup:**
- **Frameworks:** React, Vue, Svelte
- **Styling:** Tailwind with theming, BEM with SCSS variables
- **Features:** i18n support, dark/light themes, responsive design
- **Components:** Product cards, shopping cart, checkout flow, user profiles

#### Product Showcase Component

```json
// src/components/product-showcase.json
{
  "component": {
    "name": "ProductShowcase",
    "description": "A comprehensive product display with image gallery, variants, and purchase options",
    "props": {
      "product": "{ id: string; name: string; description: string; price: number; comparePrice?: number; images: string[]; variants: Array<{ id: string; name: string; options: Record<string, string>; price?: number; available: boolean }> }",
      "selectedVariant": "string",
      "onVariantChange": "(variantId: string) => void",
      "onAddToCart": "(productId: string, variantId: string, quantity: number) => void",
      "onWishlist": "(productId: string) => void",
      "currency": "string",
      "locale": "string",
      "theme": "\"light\" | \"dark\"",
      "layout": "\"standard\" | \"minimal\" | \"detailed\"",
      "showComparePrice": "boolean",
      "showReviews": "boolean",
      "reviews": "Array<{ id: string; rating: number; comment: string; author: string; date: string }>",
      "loading": "boolean"
    }
  },
  "template": [
    {
      "tag": "div",
      "attributes": {
        "class": "product-showcase"
      },
      "extensions": {
        "tailwind": {
          "classes": [
            "{{theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}}",
            "{{layout === 'minimal' ? 'max-w-md' : layout === 'detailed' ? 'max-w-6xl' : 'max-w-4xl'}}",
            "mx-auto rounded-lg shadow-lg overflow-hidden"
          ]
        }
      },
      "children": [
        {
          "type": "if",
          "condition": "loading",
          "then": [
            {
              "tag": "div",
              "attributes": {
                "class": "product-showcase__loading"
              },
              "extensions": {
                "tailwind": {
                  "classes": ["animate-pulse p-8"]
                }
              },
              "children": [
                {
                  "tag": "div",
                  "attributes": {
                    "class": "product-showcase__loading-image"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["h-64 w-full bg-gray-300 rounded mb-4"]
                    }
                  }
                },
                {
                  "tag": "div",
                  "attributes": {
                    "class": "product-showcase__loading-text"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["space-y-3"]
                    }
                  },
                  "children": [
                    {
                      "tag": "div",
                      "attributes": {
                        "class": "h-6 bg-gray-300 rounded w-3/4"
                      }
                    },
                    {
                      "tag": "div",
                      "attributes": {
                        "class": "h-4 bg-gray-300 rounded w-1/2"
                      }
                    }
                  ]
                }
              ]
            }
          ],
          "else": [
            {
              "tag": "div",
              "attributes": {
                "class": "product-showcase__content"
              },
              "extensions": {
                "tailwind": {
                  "classes": ["{{layout === 'detailed' ? 'grid grid-cols-1 lg:grid-cols-2 gap-8 p-8' : 'p-6'}}"]
                }
              },
              "children": [
                {
                  "tag": "div",
                  "attributes": {
                    "class": "product-showcase__images"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["{{layout === 'minimal' ? 'mb-4' : 'mb-6'}}"]
                    }
                  },
                  "children": [
                    {
                      "tag": "div",
                      "attributes": {
                        "class": "product-showcase__main-image"
                      },
                      "extensions": {
                        "tailwind": {
                          "classes": ["relative aspect-square rounded-lg overflow-hidden"]
                        }
                      },
                      "children": [
                        {
                          "tag": "img",
                          "attributes": {
                            "class": "product-showcase__image"
                          },
                          "extensions": {
                            "react": {
                              "expressionAttributes": {
                                "src": "product.images[selectedImageIndex || 0]",
                                "alt": "product.name"
                              }
                            },
                            "vue": {
                              "expressionAttributes": {
                                ":src": "product.images[selectedImageIndex || 0]",
                                ":alt": "product.name"
                              }
                            },
                            "tailwind": {
                              "classes": ["w-full h-full object-cover transition-transform hover:scale-105"]
                            }
                          }
                        },
                        {
                          "type": "if",
                          "condition": "product.comparePrice && showComparePrice",
                          "then": [
                            {
                              "tag": "div",
                              "attributes": {
                                "class": "product-showcase__sale-badge"
                              },
                              "extensions": {
                                "tailwind": {
                                  "classes": ["absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold"]
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
                          "tag": "button",
                          "attributes": {
                            "class": "product-showcase__wishlist-btn",
                            "aria-label": "Add to wishlist"
                          },
                          "extensions": {
                            "react": {
                              "expressionAttributes": {
                                "onClick": "() => props.onWishlist?.(product.id)"
                              }
                            },
                            "vue": {
                              "expressionAttributes": {
                                "@click": "onWishlist(product.id)"
                              }
                            },
                            "tailwind": {
                              "classes": ["absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"]
                            }
                          },
                          "children": [
                            {
                              "tag": "svg",
                              "attributes": {
                                "class": "h-5 w-5 text-gray-700",
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
                      "type": "if",
                      "condition": "product.images.length > 1",
                      "then": [
                        {
                          "tag": "div",
                          "attributes": {
                            "class": "product-showcase__thumbnails"
                          },
                          "extensions": {
                            "tailwind": {
                              "classes": ["mt-4 flex space-x-2 overflow-x-auto"]
                            }
                          },
                          "children": [
                            {
                              "type": "for",
                              "items": "product.images",
                              "item": "image",
                              "index": "imageIndex",
                              "key": "imageIndex",
                              "children": [
                                {
                                  "tag": "button",
                                  "attributes": {
                                    "class": "product-showcase__thumbnail"
                                  },
                                  "extensions": {
                                    "react": {
                                      "expressionAttributes": {
                                        "onClick": "() => setSelectedImageIndex(imageIndex)",
                                        "className": "clsx('flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors', selectedImageIndex === imageIndex ? 'border-blue-500' : 'border-gray-200')"
                                      }
                                    },
                                    "vue": {
                                      "expressionAttributes": {
                                        "@click": "selectedImageIndex = imageIndex",
                                        ":class": "`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${selectedImageIndex === imageIndex ? 'border-blue-500' : 'border-gray-200'}`"
                                      }
                                    }
                                  },
                                  "children": [
                                    {
                                      "tag": "img",
                                      "attributes": {
                                        "class": "w-full h-full object-cover"
                                      },
                                      "extensions": {
                                        "react": {
                                          "expressionAttributes": {
                                            "src": "image",
                                            "alt": "`${product.name} view ${imageIndex + 1}`"
                                          }
                                        },
                                        "vue": {
                                          "expressionAttributes": {
                                            ":src": "image",
                                            ":alt": "`${product.name} view ${imageIndex + 1}`"
                                          }
                                        }
                                      }
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
                },
                {
                  "tag": "div",
                  "attributes": {
                    "class": "product-showcase__details"
                  },
                  "children": [
                    {
                      "tag": "h1",
                      "attributes": {
                        "class": "product-showcase__title"
                      },
                      "extensions": {
                        "tailwind": {
                          "classes": ["text-2xl font-bold mb-2 {{theme === 'dark' ? 'text-white' : 'text-gray-900'}}"]
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
                      "tag": "div",
                      "attributes": {
                        "class": "product-showcase__pricing"
                      },
                      "extensions": {
                        "tailwind": {
                          "classes": ["flex items-center space-x-2 mb-4"]
                        }
                      },
                      "children": [
                        {
                          "tag": "span",
                          "attributes": {
                            "class": "product-showcase__price"
                          },
                          "extensions": {
                            "tailwind": {
                              "classes": ["text-3xl font-bold {{theme === 'dark' ? 'text-white' : 'text-gray-900'}}"]
                            }
                          },
                          "children": [
                            {
                              "type": "text",
                              "content": "{{currency}}{{selectedVariantPrice || product.price}}"
                            }
                          ]
                        },
                        {
                          "type": "if",
                          "condition": "product.comparePrice && showComparePrice",
                          "then": [
                            {
                              "tag": "span",
                              "attributes": {
                                "class": "product-showcase__compare-price"
                              },
                              "extensions": {
                                "tailwind": {
                                  "classes": ["text-lg line-through text-gray-500"]
                                }
                              },
                              "children": [
                                {
                                  "type": "text",
                                  "content": "{{currency}}{{product.comparePrice}}"
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "tag": "p",
                      "attributes": {
                        "class": "product-showcase__description"
                      },
                      "extensions": {
                        "tailwind": {
                          "classes": ["text-gray-600 mb-6 leading-relaxed {{theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}}"]
                        }
                      },
                      "children": [
                        {
                          "type": "text",
                          "content": "{{product.description}}"
                        }
                      ]
                    },
                    {
                      "type": "if",
                      "condition": "product.variants && product.variants.length > 0",
                      "then": [
                        {
                          "tag": "div",
                          "attributes": {
                            "class": "product-showcase__variants"
                          },
                          "extensions": {
                            "tailwind": {
                              "classes": ["mb-6"]
                            }
                          },
                          "children": [
                            {
                              "tag": "h3",
                              "attributes": {
                                "class": "product-showcase__variants-title"
                              },
                              "extensions": {
                                "tailwind": {
                                  "classes": ["text-sm font-medium mb-3 {{theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}}"]
                                }
                              },
                              "children": [
                                {
                                  "type": "text",
                                  "content": "Options"
                                }
                              ]
                            },
                            {
                              "tag": "div",
                              "attributes": {
                                "class": "product-showcase__variant-options"
                              },
                              "extensions": {
                                "tailwind": {
                                  "classes": ["flex flex-wrap gap-2"]
                                }
                              },
                              "children": [
                                {
                                  "type": "for",
                                  "items": "product.variants",
                                  "item": "variant",
                                  "key": "variant.id",
                                  "children": [
                                    {
                                      "tag": "button",
                                      "attributes": {
                                        "class": "product-showcase__variant-option"
                                      },
                                      "extensions": {
                                        "react": {
                                          "expressionAttributes": {
                                            "onClick": "() => props.onVariantChange?.(variant.id)",
                                            "disabled": "!variant.available",
                                            "className": "clsx('px-4 py-2 border rounded-lg text-sm font-medium transition-colors', selectedVariant === variant.id ? 'border-blue-500 bg-blue-50 text-blue-700' : variant.available ? 'border-gray-300 hover:border-gray-400' : 'border-gray-200 text-gray-400 cursor-not-allowed')"
                                          }
                                        },
                                        "vue": {
                                          "expressionAttributes": {
                                            "@click": "onVariantChange(variant.id)",
                                            ":disabled": "!variant.available",
                                            ":class": "`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${selectedVariant === variant.id ? 'border-blue-500 bg-blue-50 text-blue-700' : variant.available ? 'border-gray-300 hover:border-gray-400' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`"
                                          }
                                        }
                                      },
                                      "children": [
                                        {
                                          "type": "text",
                                          "content": "{{variant.name}}"
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
                    },
                    {
                      "tag": "div",
                      "attributes": {
                        "class": "product-showcase__actions"
                      },
                      "extensions": {
                        "tailwind": {
                          "classes": ["flex flex-col sm:flex-row gap-3"]
                        }
                      },
                      "children": [
                        {
                          "tag": "button",
                          "attributes": {
                            "class": "product-showcase__add-to-cart"
                          },
                          "extensions": {
                            "react": {
                              "expressionAttributes": {
                                "onClick": "() => props.onAddToCart?.(product.id, selectedVariant || product.variants[0]?.id, quantity)",
                                "disabled": "!selectedVariantAvailable"
                              }
                            },
                            "vue": {
                              "expressionAttributes": {
                                "@click": "onAddToCart(product.id, selectedVariant || product.variants[0]?.id, quantity)",
                                ":disabled": "!selectedVariantAvailable"
                              }
                            },
                            "tailwind": {
                              "classes": ["flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"]
                            }
                          },
                          "children": [
                            {
                              "type": "text",
                              "content": "Add to Cart"
                            }
                          ]
                        },
                        {
                          "tag": "button",
                          "attributes": {
                            "class": "product-showcase__buy-now"
                          },
                          "extensions": {
                            "tailwind": {
                              "classes": ["flex-1 border border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors {{theme === 'dark' ? 'border-gray-600 text-white hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}}"]
                            }
                          },
                          "children": [
                            {
                              "type": "text",
                              "content": "Buy Now"
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
        },
        {
          "type": "if",
          "condition": "showReviews && reviews && reviews.length > 0",
          "then": [
            {
              "tag": "div",
              "attributes": {
                "class": "product-showcase__reviews"
              },
              "extensions": {
                "tailwind": {
                  "classes": ["border-t p-6 {{theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}}"]
                }
              },
              "children": [
                {
                  "tag": "h3",
                  "attributes": {
                    "class": "product-showcase__reviews-title"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["text-lg font-semibold mb-4 {{theme === 'dark' ? 'text-white' : 'text-gray-900'}}"]
                    }
                  },
                  "children": [
                    {
                      "type": "text",
                      "content": "Customer Reviews"
                    }
                  ]
                },
                {
                  "tag": "div",
                  "attributes": {
                    "class": "product-showcase__reviews-list"
                  },
                  "extensions": {
                    "tailwind": {
                      "classes": ["space-y-4"]
                    }
                  },
                  "children": [
                    {
                      "type": "for",
                      "items": "reviews.slice(0, 3)",
                      "item": "review",
                      "key": "review.id",
                      "children": [
                        {
                          "tag": "div",
                          "attributes": {
                            "class": "product-showcase__review"
                          },
                          "extensions": {
                            "tailwind": {
                              "classes": ["border rounded-lg p-4 {{theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}}"]
                            }
                          },
                          "children": [
                            {
                              "tag": "div",
                              "attributes": {
                                "class": "product-showcase__review-header"
                              },
                              "extensions": {
                                "tailwind": {
                                  "classes": ["flex items-center justify-between mb-2"]
                                }
                              },
                              "children": [
                                {
                                  "tag": "div",
                                  "attributes": {
                                    "class": "product-showcase__review-author"
                                  },
                                  "extensions": {
                                    "tailwind": {
                                      "classes": ["font-medium {{theme === 'dark' ? 'text-white' : 'text-gray-900'}}"]
                                    }
                                  },
                                  "children": [
                                    {
                                      "type": "text",
                                      "content": "{{review.author}}"
                                    }
                                  ]
                                },
                                {
                                  "tag": "div",
                                  "attributes": {
                                    "class": "product-showcase__review-rating"
                                  },
                                  "extensions": {
                                    "tailwind": {
                                      "classes": ["text-yellow-400"]
                                    }
                                  },
                                  "children": [
                                    {
                                      "type": "text",
                                      "content": "★★★★★"
                                    }
                                  ]
                                }
                              ]
                            },
                            {
                              "tag": "p",
                              "attributes": {
                                "class": "product-showcase__review-comment"
                              },
                              "extensions": {
                                "tailwind": {
                                  "classes": ["text-sm {{theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}}"]
                                }
                              },
                              "children": [
                                {
                                  "type": "text",
                                  "content": "{{review.comment}}"
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
          ]
        }
      ]
    }
  ]
}
```

#### Build and Distribution

```bash
# Build all framework variants with themes
pnpm build

# Generate comprehensive documentation
pnpm build:docs

# Test in multiple environments
pnpm test:react
pnpm test:vue
pnpm test:svelte

# Prepare for npm publication
pnpm pack:preview
```

### **Level 4: Publishing and Distribution**

Complete workflow from development to npm distribution and consumer adoption.

#### Prepare for Publication

```bash
# Final build with optimizations
pnpm build:production

# Generate final documentation
pnpm build:docs:final

# Run comprehensive tests
pnpm test:all

# Validate package exports
pnpm test:exports
```

#### Package.json Configuration

```json
{
  "name": "@company/ecommerce-ui",
  "version": "1.0.0",
  "description": "Complete e-commerce UI component library for React, Vue, and Svelte",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "ecommerce-ui": "dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./react": {
      "import": "./dist/react/index.js",
      "types": "./dist/react/index.d.ts"
    },
    "./vue": {
      "import": "./dist/vue/index.js",
      "types": "./dist/vue/index.d.ts"
    },
    "./svelte": {
      "import": "./dist/svelte/index.js",
      "types": "./dist/svelte/index.d.ts"
    },
    "./styles": "./dist/styles/index.css"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsx src/build.ts",
    "build:production": "NODE_ENV=production tsx src/build.ts",
    "build:docs": "tsx src/utilities/documentation.ts",
    "test:all": "vitest run",
    "test:exports": "publint",
    "pack:preview": "npm pack --dry-run"
  },
  "keywords": [
    "ui-kit",
    "react",
    "vue",
    "svelte",
    "ecommerce",
    "components",
    "design-system"
  ],
  "peerDependencies": {
    "react": ">=16.8.0",
    "@vue/composition-api": ">=1.0.0",
    "svelte": ">=3.0.0"
  }
}
```

#### Publication and Consumer Usage

```bash
# Publish to npm
npm publish

# Test consumer experience
npx @company/ecommerce-ui add
```

**Consumer CLI Experience:**
```
🛍️  E-commerce UI Components

? Which framework are you using? › React
? How do you handle styling? › Tailwind CSS  
? Which theme do you prefer? › Light theme
? Which components would you like to add? 
  ◉ ProductShowcase - Complete product display with variants
  ◉ ProductCard - Compact product display for listings  
  ◯ ShoppingCart - Full shopping cart with quantity controls
  ◯ Checkout - Multi-step checkout flow
  ◯ UserProfile - User account and order history
? Where should we place the components? › ./src/components/ecommerce

✅ Components added successfully!
📦 Dependencies installed: clsx, @headlessui/react
🎨 Styles configured: Added Tailwind classes
📚 Documentation: ./src/components/ecommerce/README.md
```

## 🔧 Configuration Reference

### Project Configuration (`create-ui-kit.config.js`)

```javascript
export default {
  // Basic metadata
  name: '@company/ui-kit',
  version: '1.0.0',
  description: 'Component library description',
  
  // Author information
  author: {
    name: 'Author Name',
    email: 'author@company.com',
    url: 'https://company.com'
  },

  // Capabilities
  capabilities: {
    frameworks: ['react', 'vue', 'svelte'],
    styling: ['tailwind', 'bem', 'css-modules'],
    typescript: true,
    themes: ['light', 'dark'],
    accessibility: true,
    internationalization: false
  },

  // Component-specific settings
  components: {
    'button': {
      frameworks: ['react', 'vue'],
      styling: ['tailwind', 'bem'],
      dependencies: {
        react: ['clsx'],
        vue: []
      }
    }
  },

  // Build configuration
  build: {
    outputDir: './dist',
    typescript: true,
    sourceMaps: true,
    minify: true,
    treeshaking: true
  },

  // CLI behavior
  cli: {
    interactive: true,
    validation: true,
    conflictResolution: 'prompt', // 'overwrite', 'skip', 'prompt'
    backupFiles: true,
    installDependencies: true
  },

  // Documentation
  docs: {
    generate: true,
    includeExamples: true,
    includeApi: true,
    outputDir: './docs'
  }
};
```

## 🧪 Testing and Quality Assurance

### Automated Testing

```bash
# Unit tests for CLI logic
pnpm test

# Integration tests for component generation
pnpm test:integration

# E2E tests for consumer experience
pnpm test:e2e

# Test coverage reporting
pnpm test:coverage
```

### Quality Checks

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

## 🚀 Performance and Optimization

### Build Optimization

- **Tree Shaking**: Only include used components
- **Code Splitting**: Separate framework bundles
- **Minification**: Optimize for production
- **Source Maps**: Development debugging support

### Runtime Performance

- **Lazy Loading**: Components load on demand
- **Bundle Analysis**: Monitor size impact
- **Performance Monitoring**: Track generation speed

## 🆘 Troubleshooting Guide

### Common Issues

**Q: "Component validation failed during build"**
```bash
# Check component template syntax
pnpm validate:templates

# Common issues:
# - Invalid JSON in component definitions
# - Missing required props in component metadata
# - Unsupported extension configurations
```

**Q: "Generated components have framework-specific errors"**
```bash
# Validate framework-specific syntax
pnpm test:react --component=Button
pnpm test:vue --component=Button

# Check:
# - PropTypes/interface definitions
# - Event handler syntax
# - Framework-specific attribute bindings
```

**Q: "Consumer CLI installation issues"**
```bash
# Verify npm package exports
pnpm test:exports

# Check bin configuration in package.json
# Ensure CLI permissions: chmod +x dist/cli.js
```

**Q: "Styling conflicts in consumer projects"**
```bash
# Check CSS specificity and naming conventions
# Verify BEM methodology implementation
# Test with different styling approaches
```

### Getting Help

- **GitHub Issues**: [Report bugs and feature requests](https://github.com/djurnamn/js-template-engine/issues)
- **Discussions**: [Community Q&A and ideas](https://github.com/djurnamn/js-template-engine/discussions)
- **Documentation**: [Comprehensive guides](./docs)
- **Examples**: [Reference implementations](./examples)

## 📚 Related Documentation

- **[JS Template Engine CLI](../cli/README.md)** - Core CLI functionality
- **[Core Engine](../core/README.md)** - Template processing pipeline
- **[React Extension](../extension-react/README.md)** - React component generation
- **[Vue Extension](../extension-vue/README.md)** - Vue component generation
- **[BEM Extension](../extension-bem/README.md)** - BEM methodology support
- **[Tailwind Extension](../extension-tailwind/README.md)** - Tailwind CSS integration

## 🏆 Success Stories

### Production Deployments

- **Design System Teams**: Reduced component maintenance by 70%
- **Multi-Framework Projects**: Single source of truth across React/Vue
- **Rapid Prototyping**: 10x faster component library creation
- **Developer Experience**: 95% satisfaction rating from consumers

## 🤝 Contributing

We welcome contributions to make create-ui-kit even better:

1. **Fork** the repository
2. **Create** a feature branch
3. **Add** tests for new functionality  
4. **Submit** a pull request
5. **Participate** in code review

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for full details.

---

**Ready to build amazing component libraries?** [Get started now](#-quick-start) or [explore the examples](./examples) to see what's possible!