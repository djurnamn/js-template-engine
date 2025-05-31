import { describe, it, expect } from 'vitest';
import { resolveComponentImports } from '@js-template-engine/types';
import type { Component } from '@js-template-engine/types';

describe('Component Imports Utilities', () => {
  describe('resolveComponentImports', () => {
    it('should deduplicate and merge named imports from the same module', () => {
      const component: Component = {
        imports: [
          'import { useState } from "react"',
          'import { useEffect } from "react"',
          'import { useState } from "react"'
        ]
      };
      const result = resolveComponentImports(component);
      expect(result).toEqual([
        'import { useState, useEffect } from "react"'
      ]);
    });

    it('should handle both default and named imports', () => {
      const component: Component = {
        imports: [
          'import React from "react"',
          'import { useState } from "react"',
          'import { useEffect } from "react"'
        ]
      };
      const result = resolveComponentImports(component);
      expect(result).toEqual([
        'import React, { useState, useEffect } from "react"'
      ]);
    });

    it('should combine and deduplicate component imports with default imports', () => {
      const component: Component = {
        imports: [
          'import { useState } from "react"',
          'import React from "react"'
        ]
      };
      const defaultImports = [
        'import React from "react"',
        'import { useEffect } from "react"'
      ];
      const result = resolveComponentImports(component, defaultImports);
      expect(result).toEqual([
        'import React, { useState, useEffect } from "react"'
      ]);
    });

    it('should handle object-style imports', () => {
      const component: Component = {
        imports: [
          'import { useState, useEffect } from "react"',
          'import { Button, Input } from "./components"',
          'import { useState } from "react"'
        ]
      };
      const result = resolveComponentImports(component);
      expect(result).toEqual([
        'import { useState, useEffect } from "react"',
        'import { Button, Input } from "./components"'
      ]);
    });

    it('should return empty array for undefined imports', () => {
      const component: Component = {};
      expect(resolveComponentImports(component)).toEqual([]);
    });

    it('should return deduplicated default imports if component has no imports', () => {
      const component: Component = {};
      const defaultImports = [
        'import React from "react"',
        'import React from "react"',
        'import { useState } from "react"'
      ];
      expect(resolveComponentImports(component, defaultImports)).toEqual([
        'import React, { useState } from "react"'
      ]);
    });
  });
}); 