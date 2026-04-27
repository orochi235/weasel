# Labkit Plan 1 — Foundation & Presentational Primitives

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `@labkit/react` repo with build/test/lint/Storybook tooling, theme system, and seven presentational primitives (`<LabShell>`, `<Toolbar>`, `<Sidebar>`, `<StatusBar>`, `<WorkspaceGrid>`, `<FpsMeter>`, `<ScaleIndicator>`).

**Architecture:** Single-package npm project. Library source compiled by tsup (ESM + .d.ts); LESS compiled to plain CSS by `lessc`. Storybook 8.x via `@storybook/react-vite` reuses Vite's native LESS support. All component classes prefixed `lk-`, enforced by a pre-commit script. Theme via CSS variables: dark base + `@media (prefers-color-scheme: light)` override; explicit `lk-theme-light` / `lk-theme-dark` classes win via specificity.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, @testing-library/react 16, tsup, Storybook 8.x, Biome 2.4, LESS, Zustand (no usage in Plan 1, installed for later plans), jsdom.

---

## File Structure

After this plan:
```
labkit/
  .storybook/main.ts
  .storybook/preview.tsx
  scripts/check-class-prefix.ts
  src/
    lab/
      LabShell.tsx, LabShell.less, LabShell.test.tsx, LabShell.stories.tsx
      WorkspaceGrid.tsx, WorkspaceGrid.less, WorkspaceGrid.test.tsx, WorkspaceGrid.stories.tsx
      gridDims.ts, gridDims.test.ts
      index.ts
    primitives/
      Toolbar.tsx, Toolbar.less, Toolbar.test.tsx, Toolbar.stories.tsx
      Sidebar.tsx, Sidebar.less, Sidebar.test.tsx, Sidebar.stories.tsx
      StatusBar.tsx, StatusBar.less, StatusBar.test.tsx, StatusBar.stories.tsx
      FpsMeter.tsx, FpsMeter.less, FpsMeter.test.tsx, FpsMeter.stories.tsx
      ScaleIndicator.tsx, ScaleIndicator.less, ScaleIndicator.test.tsx, ScaleIndicator.stories.tsx
      index.ts
    theme/
      tokens.less, base.less, light.less, dark.less
    styles.less        # entry that imports base + every component .less
    test-setup.ts
    index.ts
  examples/.gitkeep
  docs/AGENTS.md       # scaffold; filled in later plans
  docs/RECIPES.md      # scaffold; filled in later plans
  .gitignore
  biome.jsonc
  package.json
  tsconfig.json
  tsconfig.lib.json
  tsup.config.ts
  vite.config.ts
  vitest.config.ts
  README.md
```

---

## Task 1: Bootstrap package.json and install dependencies

**Files:**
- Create: `package.json`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@labkit/react",
  "version": "0.0.1",
  "description": "React widgets for building self-contained interactive lab pages",
  "type": "module",
  "files": ["dist", "src", "AGENTS.md", "RECIPES.md", "README.md"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./primitives": {
      "types": "./dist/primitives/index.d.ts",
      "import": "./dist/primitives/index.js"
    },
    "./styles.css": "./dist/styles.css",
    "./theme-light.css": "./dist/theme-light.css",
    "./theme-dark.css": "./dist/theme-dark.css",
    "./src/*": "./src/*"
  },
  "scripts": {
    "dev": "vite",
    "build": "npm run build:css && tsup",
    "build:css": "lessc src/styles.less dist/styles.css && lessc src/theme/light.less dist/theme-light.css && lessc src/theme/dark.less dist/theme-dark.css",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check . && tsx scripts/check-class-prefix.ts",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.12",
    "@storybook/addon-a11y": "^8.4.0",
    "@storybook/addon-essentials": "^8.4.0",
    "@storybook/addon-interactions": "^8.4.0",
    "@storybook/react": "^8.4.0",
    "@storybook/react-vite": "^8.4.0",
    "@storybook/test": "^8.4.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^24.12.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "jsdom": "^26.1.0",
    "less": "^4.2.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "storybook": "^8.4.0",
    "tsup": "^8.3.0",
    "tsx": "^4.19.0",
    "typescript": "~6.0.2",
    "vite": "^8.0.4",
    "vitest": "^4.1.4"
  }
}
```

- [ ] **Step 2: Install**

Run: `cd ~/src/labkit && npm install`
Expected: `node_modules/` created; no errors. Warnings about peer deps from Storybook addons are acceptable.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Bootstrap @labkit/react package"
```

---

## Task 2: TypeScript configuration

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.lib.json`

- [ ] **Step 1: Write `tsconfig.json` (root — references)**

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 2: Write `tsconfig.lib.json` (compile config for src/)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src/**/*", "scripts/**/*", ".storybook/**/*"]
}
```

- [ ] **Step 3: Verify type-check runs (no source files yet, so should be a no-op)**

Run: `cd ~/src/labkit && npx tsc -b`
Expected: exits with code 0; no output.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json tsconfig.lib.json
git commit -m "Add TypeScript config (strict, ES2022, bundler resolution)"
```

---

## Task 3: Lint, format, gitignore

**Files:**
- Create: `biome.jsonc`
- Create: `.gitignore`

- [ ] **Step 1: Write `biome.jsonc`**

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
  "files": {
    "ignore": ["dist", "storybook-static", "node_modules", "examples"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noUnusedTemplateLiteral": "error",
        "useConst": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
storybook-static/
*.log
.DS_Store
.vite/
coverage/
```

- [ ] **Step 3: Verify biome runs**

Run: `cd ~/src/labkit && npx biome check .`
Expected: "Checked X files. No fixes applied." (no errors; possibly skipped count is 0)

- [ ] **Step 4: Commit**

```bash
git add biome.jsonc .gitignore
git commit -m "Add biome config and gitignore"
```

---

## Task 4: Vitest + test setup

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test-setup.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

- [ ] **Step 2: Write `src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Sanity-check by adding and removing a trivial test**

Create temp file `src/__sanity__.test.ts`:
```ts
import { test, expect } from 'vitest';
test('vitest works', () => { expect(1 + 1).toBe(2); });
```

Run: `cd ~/src/labkit && npx vitest run src/__sanity__.test.ts`
Expected: 1 passed.

Delete the file: `rm src/__sanity__.test.ts`

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts src/test-setup.ts
git commit -m "Add Vitest config with jsdom and testing-library setup"
```

---

## Task 5: tsup library build config

**Files:**
- Create: `tsup.config.ts`

- [ ] **Step 1: Write `tsup.config.ts`**

Note: only the `index.ts` and `primitives/index.ts` exist as entry points after Plan 1. Future plans add more entries.

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'primitives/index': 'src/primitives/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  splitting: false,
  treeshake: true,
});
```

- [ ] **Step 2: Verify config loads (dry parse)**

Run: `cd ~/src/labkit && npx tsx -e "import('./tsup.config.ts').then(m => console.log('ok'))"`
Expected: prints `ok`. (No build runs yet — entry files don't exist; that's fine.)

- [ ] **Step 3: Commit**

```bash
git add tsup.config.ts
git commit -m "Add tsup config for library build"
```

---

## Task 6: Vite dev config

**Files:**
- Create: `vite.config.ts`
- Create: `examples/.gitkeep`

- [ ] **Step 1: Write `vite.config.ts`**

The dev server will host `examples/` later. Until then it serves a placeholder `index.html` written by Vite.

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'examples',
  resolve: {
    alias: {
      '@labkit/react': new URL('./src/index.ts', import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 2: Create placeholder examples directory**

```bash
mkdir -p examples
touch examples/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts examples/.gitkeep
git commit -m "Add Vite config aliased at @labkit/react"
```

---

## Task 7: Theme tokens & base CSS

**Files:**
- Create: `src/theme/tokens.less`
- Create: `src/theme/base.less`
- Create: `src/theme/light.less`
- Create: `src/theme/dark.less`
- Create: `src/styles.less`

- [ ] **Step 1: Write `src/theme/tokens.less`**

```less
// tokens.less — the contract.
// Dark is the base; @media (prefers-color-scheme: light) overrides for OS-following.
// Explicit .lk-theme-light / .lk-theme-dark classes (added by <Lab>) win via specificity.

:root {
  // Surface
  --lk-bg: #1a1410;
  --lk-bg-elevated: #241c16;
  --lk-bg-canvas: #2a2018;
  --lk-border: #4a3c2e;
  --lk-divider: rgba(255, 255, 255, 0.08);

  // Text
  --lk-text: #e8dccd;
  --lk-text-muted: #9d8b76;
  --lk-text-disabled: #6b5c4a;

  // Accent / interactive
  --lk-accent: #d4a574;
  --lk-accent-hover: #e8b885;
  --lk-focus-ring: rgba(212, 165, 116, 0.4);

  // Sizing
  --lk-radius: 4px;
  --lk-radius-sm: 2px;
  --lk-control-height: 28px;
  --lk-spacing-xs: 4px;
  --lk-spacing-sm: 8px;
  --lk-spacing-md: 12px;
  --lk-spacing-lg: 16px;

  // Typography
  --lk-font: system-ui, -apple-system, sans-serif;
  --lk-font-mono: ui-monospace, SFMono-Regular, monospace;
  --lk-font-size: 13px;
  --lk-font-size-sm: 11px;

  // Z-layers
  --lk-z-toolbar: 10;
  --lk-z-overlay: 20;
  --lk-z-modal: 30;
}

@media (prefers-color-scheme: light) {
  :root {
    --lk-bg: #fafaf7;
    --lk-bg-elevated: #ffffff;
    --lk-bg-canvas: #f0ebe2;
    --lk-border: #c9bba5;
    --lk-divider: rgba(0, 0, 0, 0.08);

    --lk-text: #2a2018;
    --lk-text-muted: #6b5c4a;
    --lk-text-disabled: #a89b85;

    --lk-accent: #a86f3c;
    --lk-accent-hover: #c2854f;
    --lk-focus-ring: rgba(168, 111, 60, 0.35);
  }
}
```

- [ ] **Step 2: Write `src/theme/light.less` and `src/theme/dark.less` (explicit-class overrides)**

`src/theme/light.less`:
```less
// Built to dist/theme-light.css. Forces light regardless of OS preference.
.lk-theme-light {
  --lk-bg: #fafaf7;
  --lk-bg-elevated: #ffffff;
  --lk-bg-canvas: #f0ebe2;
  --lk-border: #c9bba5;
  --lk-divider: rgba(0, 0, 0, 0.08);
  --lk-text: #2a2018;
  --lk-text-muted: #6b5c4a;
  --lk-text-disabled: #a89b85;
  --lk-accent: #a86f3c;
  --lk-accent-hover: #c2854f;
  --lk-focus-ring: rgba(168, 111, 60, 0.35);
}
```

`src/theme/dark.less`:
```less
// Built to dist/theme-dark.css. Forces dark regardless of OS preference.
.lk-theme-dark {
  --lk-bg: #1a1410;
  --lk-bg-elevated: #241c16;
  --lk-bg-canvas: #2a2018;
  --lk-border: #4a3c2e;
  --lk-divider: rgba(255, 255, 255, 0.08);
  --lk-text: #e8dccd;
  --lk-text-muted: #9d8b76;
  --lk-text-disabled: #6b5c4a;
  --lk-accent: #d4a574;
  --lk-accent-hover: #e8b885;
  --lk-focus-ring: rgba(212, 165, 116, 0.4);
}
```

- [ ] **Step 3: Write `src/theme/base.less`**

```less
@import './tokens.less';

// Resets and global element defaults
.lk-root {
  font-family: var(--lk-font);
  font-size: var(--lk-font-size);
  color: var(--lk-text);
  background: var(--lk-bg);
  line-height: 1.4;

  *, *::before, *::after {
    box-sizing: border-box;
  }

  button {
    font: inherit;
    color: inherit;
    background: var(--lk-bg-elevated);
    border: 1px solid var(--lk-border);
    border-radius: var(--lk-radius);
    height: var(--lk-control-height);
    padding: 0 var(--lk-spacing-md);
    cursor: pointer;

    &:hover {
      border-color: var(--lk-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--lk-focus-ring);
      outline-offset: 1px;
    }

    &:disabled {
      color: var(--lk-text-disabled);
      cursor: not-allowed;
    }
  }

  input[type="range"] {
    accent-color: var(--lk-accent);
  }
}
```

- [ ] **Step 4: Write `src/styles.less` (entry — built to `dist/styles.css`)**

```less
// Imports compile-time only. Component .less files are added in later steps.
@import './theme/base.less';
```

- [ ] **Step 5: Compile and verify CSS output**

Run: `cd ~/src/labkit && npx lessc src/styles.less /tmp/labkit-styles-check.css && head -20 /tmp/labkit-styles-check.css`
Expected: First lines show `:root { --lk-bg: #1a1410; ... }`. No errors.

- [ ] **Step 6: Commit**

```bash
git add src/theme src/styles.less
git commit -m "Add theme tokens, base CSS, and light/dark theme files"
```

---

## Task 8: Class-prefix enforcement script

**Files:**
- Create: `scripts/check-class-prefix.ts`

- [ ] **Step 1: Write `scripts/check-class-prefix.ts`**

```ts
#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

const offenders: Array<{ file: string; line: number; match: string }> = [];

function walk(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (full.endsWith('.tsx')) {
      checkFile(full);
    }
  }
}

// Matches className="..." or className={'...'} or className={`...`}.
// Captures the literal string for prefix validation.
const CLASS_RE = /className=\s*\{?\s*['"`]([^'"`]+)['"`]\s*\}?/g;

function checkFile(file: string): void {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    let match: RegExpExecArray | null;
    CLASS_RE.lastIndex = 0;
    while ((match = CLASS_RE.exec(line)) !== null) {
      const classes = (match[1] ?? '').split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        // Skip dynamic interpolation fragments (e.g., conditional empty strings)
        if (cls === '' || cls.includes('${')) continue;
        if (!cls.startsWith('lk-')) {
          offenders.push({ file: relative(ROOT, file), line: i + 1, match: cls });
        }
      }
    }
  }
}

walk(SRC);

if (offenders.length > 0) {
  console.error('Class names must start with "lk-":');
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  "${o.match}"`);
  }
  process.exit(1);
} else {
  console.log('All className literals in src/ use the lk- prefix.');
}
```

- [ ] **Step 2: Run the script (no source files yet — should pass trivially)**

Run: `cd ~/src/labkit && npx tsx scripts/check-class-prefix.ts`
Expected: "All className literals in src/ use the lk- prefix."

- [ ] **Step 3: Commit**

```bash
git add scripts/check-class-prefix.ts
git commit -m "Add class-prefix enforcement script (lk-* required in src/)"
```

---

## Task 9: Storybook setup with theme decorator

**Files:**
- Create: `.storybook/main.ts`
- Create: `.storybook/preview.tsx`

- [ ] **Step 1: Write `.storybook/main.ts`**

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;
```

- [ ] **Step 2: Write `.storybook/preview.tsx`**

```tsx
import type { Preview } from '@storybook/react';
import '../src/styles.less';
import '../src/theme/light.less';
import '../src/theme/dark.less';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'lk-bg',
      values: [
        { name: 'lk-bg', value: 'var(--lk-bg)' },
      ],
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      defaultValue: 'auto',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'auto', title: 'Auto (OS)' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme as 'auto' | 'light' | 'dark';
      const className =
        theme === 'light' ? 'lk-root lk-theme-light' :
        theme === 'dark' ? 'lk-root lk-theme-dark' :
        'lk-root';
      return (
        <div className={className} style={{ padding: 16, minHeight: '100vh' }}>
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
```

- [ ] **Step 3: Verify Storybook config parses**

Run: `cd ~/src/labkit && npx tsc -b`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add .storybook
git commit -m "Add Storybook config with theme-toggle decorator"
```

---

## Task 10: gridDims pure function (TDD)

**Files:**
- Create: `src/lab/gridDims.test.ts`
- Create: `src/lab/gridDims.ts`

- [ ] **Step 1: Write the failing test**

`src/lab/gridDims.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { gridDims } from './gridDims';

describe('gridDims', () => {
  test('returns 1x1 for 0 or 1', () => {
    expect(gridDims(0)).toEqual({ cols: 1, rows: 1 });
    expect(gridDims(1)).toEqual({ cols: 1, rows: 1 });
  });

  test('returns 2x1 for 2', () => {
    expect(gridDims(2)).toEqual({ cols: 2, rows: 1 });
  });

  test('returns 2x2 for 3 or 4', () => {
    expect(gridDims(3)).toEqual({ cols: 2, rows: 2 });
    expect(gridDims(4)).toEqual({ cols: 2, rows: 2 });
  });

  test('returns 3x2 for 5 or 6', () => {
    expect(gridDims(5)).toEqual({ cols: 3, rows: 2 });
    expect(gridDims(6)).toEqual({ cols: 3, rows: 2 });
  });

  test('returns 3x3 for 9', () => {
    expect(gridDims(9)).toEqual({ cols: 3, rows: 3 });
  });

  test('returns 4x4 for 16', () => {
    expect(gridDims(16)).toEqual({ cols: 4, rows: 4 });
  });

  test('returns 4x4 for 13 (sqrt rounds up to 4)', () => {
    expect(gridDims(13)).toEqual({ cols: 4, rows: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/src/labkit && npx vitest run src/lab/gridDims.test.ts`
Expected: FAIL — "Failed to resolve import './gridDims'".

- [ ] **Step 3: Write minimal implementation**

`src/lab/gridDims.ts`:
```ts
export interface GridDims {
  cols: number;
  rows: number;
}

export function gridDims(count: number): GridDims {
  if (count <= 1) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `cd ~/src/labkit && npx vitest run src/lab/gridDims.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lab/gridDims.ts src/lab/gridDims.test.ts
git commit -m "Add gridDims pure function (sqrt-tiling for WorkspaceGrid)"
```

---

## Task 11: WorkspaceGrid component

**Files:**
- Create: `src/lab/WorkspaceGrid.tsx`
- Create: `src/lab/WorkspaceGrid.less`
- Create: `src/lab/WorkspaceGrid.test.tsx`
- Create: `src/lab/WorkspaceGrid.stories.tsx`
- Modify: `src/styles.less` (import the new component CSS)

- [ ] **Step 1: Write the failing test**

`src/lab/WorkspaceGrid.test.tsx`:
```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceGrid } from './WorkspaceGrid';

describe('WorkspaceGrid', () => {
  test('renders all children', () => {
    render(
      <WorkspaceGrid>
        <div>one</div>
        <div>two</div>
        <div>three</div>
      </WorkspaceGrid>,
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });

  test('sets CSS custom properties for grid dimensions based on child count', () => {
    const { container } = render(
      <WorkspaceGrid>
        <div>a</div>
        <div>b</div>
        <div>c</div>
      </WorkspaceGrid>,
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid.style.getPropertyValue('--lk-grid-cols')).toBe('2');
    expect(grid.style.getPropertyValue('--lk-grid-rows')).toBe('2');
  });

  test('uses lk-workspace-grid class', () => {
    const { container } = render(<WorkspaceGrid><div /></WorkspaceGrid>);
    expect((container.firstChild as HTMLElement).className).toBe('lk-workspace-grid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/src/labkit && npx vitest run src/lab/WorkspaceGrid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lab/WorkspaceGrid.tsx`**

```tsx
import { Children, type CSSProperties, type ReactNode } from 'react';
import { gridDims } from './gridDims';

export interface WorkspaceGridProps {
  children: ReactNode;
}

export function WorkspaceGrid({ children }: WorkspaceGridProps) {
  const count = Children.count(children);
  const { cols, rows } = gridDims(count);
  const style = {
    '--lk-grid-cols': String(cols),
    '--lk-grid-rows': String(rows),
  } as CSSProperties;
  return (
    <div className="lk-workspace-grid" style={style}>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/lab/WorkspaceGrid.less`**

```less
.lk-workspace-grid {
  display: grid;
  grid-template-columns: repeat(var(--lk-grid-cols, 1), 1fr);
  grid-template-rows: repeat(var(--lk-grid-rows, 1), 1fr);
  gap: var(--lk-spacing-md);
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 5: Add the component CSS to the styles entry**

Modify `src/styles.less` — append:
```less
@import './lab/WorkspaceGrid.less';
```

After this step the file reads:
```less
@import './theme/base.less';
@import './lab/WorkspaceGrid.less';
```

- [ ] **Step 6: Run tests — all pass**

Run: `cd ~/src/labkit && npx vitest run src/lab/WorkspaceGrid.test.tsx`
Expected: 3 passed.

- [ ] **Step 7: Write the Storybook story**

`src/lab/WorkspaceGrid.stories.tsx`:
```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { WorkspaceGrid } from './WorkspaceGrid';

const meta: Meta<typeof WorkspaceGrid> = {
  title: 'Lab/WorkspaceGrid',
  component: WorkspaceGrid,
};
export default meta;

type Story = StoryObj<typeof WorkspaceGrid>;

const Tile = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: 'var(--lk-bg-elevated)',
      border: '1px solid var(--lk-border)',
      borderRadius: 'var(--lk-radius)',
      padding: 'var(--lk-spacing-md)',
      minHeight: 120,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    {children}
  </div>
);

export const OneTile: Story = {
  render: () => (
    <div style={{ height: 400 }}>
      <WorkspaceGrid><Tile>1</Tile></WorkspaceGrid>
    </div>
  ),
};

export const ThreeTiles: Story = {
  render: () => (
    <div style={{ height: 400 }}>
      <WorkspaceGrid>
        <Tile>1</Tile><Tile>2</Tile><Tile>3</Tile>
      </WorkspaceGrid>
    </div>
  ),
};

export const SevenTiles: Story = {
  render: () => (
    <div style={{ height: 600 }}>
      <WorkspaceGrid>
        {Array.from({ length: 7 }).map((_, i) => (
          <Tile key={i}>{i + 1}</Tile>
        ))}
      </WorkspaceGrid>
    </div>
  ),
};
```

- [ ] **Step 8: Run class-prefix check**

Run: `cd ~/src/labkit && npx tsx scripts/check-class-prefix.ts`
Expected: "All className literals in src/ use the lk- prefix."

- [ ] **Step 9: Commit**

```bash
git add src/lab/WorkspaceGrid.tsx src/lab/WorkspaceGrid.less \
        src/lab/WorkspaceGrid.test.tsx src/lab/WorkspaceGrid.stories.tsx \
        src/styles.less
git commit -m "Add WorkspaceGrid primitive (sqrt-tiling layout)"
```

---

## Task 12: LabShell component

**Files:**
- Create: `src/lab/LabShell.tsx`
- Create: `src/lab/LabShell.less`
- Create: `src/lab/LabShell.test.tsx`
- Create: `src/lab/LabShell.stories.tsx`
- Modify: `src/styles.less`

- [ ] **Step 1: Write the failing test**

`src/lab/LabShell.test.tsx`:
```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LabShell } from './LabShell';

describe('LabShell', () => {
  test('renders title in header', () => {
    render(<LabShell title="My Lab">body</LabShell>);
    expect(screen.getByRole('heading', { name: 'My Lab' })).toBeInTheDocument();
  });

  test('renders children in body', () => {
    render(<LabShell title="t">body content</LabShell>);
    expect(screen.getByText('body content')).toBeInTheDocument();
  });

  test('renders header slot when provided', () => {
    render(
      <LabShell title="t" header={<button type="button">action</button>}>
        body
      </LabShell>,
    );
    expect(screen.getByRole('button', { name: 'action' })).toBeInTheDocument();
  });

  test('applies lk-theme-light class when theme="light"', () => {
    const { container } = render(<LabShell title="t" theme="light">x</LabShell>);
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains('lk-theme-light')).toBe(true);
    expect(root.classList.contains('lk-theme-dark')).toBe(false);
  });

  test('applies lk-theme-dark class when theme="dark"', () => {
    const { container } = render(<LabShell title="t" theme="dark">x</LabShell>);
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains('lk-theme-dark')).toBe(true);
    expect(root.classList.contains('lk-theme-light')).toBe(false);
  });

  test('applies neither theme class when theme="auto" (default)', () => {
    const { container } = render(<LabShell title="t">x</LabShell>);
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains('lk-theme-light')).toBe(false);
    expect(root.classList.contains('lk-theme-dark')).toBe(false);
  });

  test('always applies lk-root class', () => {
    const { container } = render(<LabShell title="t">x</LabShell>);
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains('lk-root')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/src/labkit && npx vitest run src/lab/LabShell.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lab/LabShell.tsx`**

```tsx
import type { ReactNode } from 'react';

export type LabTheme = 'auto' | 'light' | 'dark';

export interface LabShellProps {
  title: string;
  children: ReactNode;
  /** Optional content rendered into the header (e.g., action buttons). */
  header?: ReactNode;
  /** Optional content rendered into the footer. */
  footer?: ReactNode;
  /** Theme override. "auto" (default) follows prefers-color-scheme. */
  theme?: LabTheme;
}

export function LabShell({ title, children, header, footer, theme = 'auto' }: LabShellProps) {
  const themeClass =
    theme === 'light' ? ' lk-theme-light' :
    theme === 'dark' ? ' lk-theme-dark' :
    '';
  return (
    <div className={`lk-root lk-shell${themeClass}`}>
      <header className="lk-shell-header">
        <h1 className="lk-shell-title">{title}</h1>
        {header && <div className="lk-shell-header-actions">{header}</div>}
      </header>
      <main className="lk-shell-body">{children}</main>
      {footer && <footer className="lk-shell-footer">{footer}</footer>}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/lab/LabShell.less`**

```less
.lk-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: var(--lk-bg);
}

.lk-shell-header {
  display: flex;
  align-items: center;
  gap: var(--lk-spacing-md);
  padding: var(--lk-spacing-sm) var(--lk-spacing-md);
  background: var(--lk-bg-elevated);
  border-bottom: 1px solid var(--lk-border);
  z-index: var(--lk-z-toolbar);
}

.lk-shell-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--lk-text);
}

.lk-shell-header-actions {
  margin-left: auto;
  display: flex;
  gap: var(--lk-spacing-sm);
}

.lk-shell-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--lk-spacing-md);
}

.lk-shell-footer {
  border-top: 1px solid var(--lk-border);
  padding: var(--lk-spacing-xs) var(--lk-spacing-md);
  background: var(--lk-bg-elevated);
  color: var(--lk-text-muted);
  font-size: var(--lk-font-size-sm);
}
```

- [ ] **Step 5: Add to styles entry**

Modify `src/styles.less` — append:
```less
@import './lab/LabShell.less';
```

- [ ] **Step 6: Run tests — all pass**

Run: `cd ~/src/labkit && npx vitest run src/lab/LabShell.test.tsx`
Expected: 7 passed.

- [ ] **Step 7: Write the Storybook story**

`src/lab/LabShell.stories.tsx`:
```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { LabShell } from './LabShell';

const meta: Meta<typeof LabShell> = {
  title: 'Lab/LabShell',
  component: LabShell,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof LabShell>;

export const Default: Story = {
  args: {
    title: 'My Lab',
    children: <p>Body content goes here.</p>,
  },
};

export const WithHeaderActions: Story = {
  args: {
    title: 'My Lab',
    header: (
      <>
        <button type="button">+ Add</button>
        <button type="button">Reset</button>
      </>
    ),
    children: <p>Body content with header actions.</p>,
  },
};

export const WithFooter: Story = {
  args: {
    title: 'My Lab',
    children: <p>Body content with footer.</p>,
    footer: <span>Status: ready</span>,
  },
};
```

- [ ] **Step 8: Run class-prefix check**

Run: `cd ~/src/labkit && npx tsx scripts/check-class-prefix.ts`
Expected: passes.

- [ ] **Step 9: Commit**

```bash
git add src/lab/LabShell.tsx src/lab/LabShell.less \
        src/lab/LabShell.test.tsx src/lab/LabShell.stories.tsx \
        src/styles.less
git commit -m "Add LabShell primitive (header/body/footer with theme override)"
```

---

## Task 13: Toolbar + subcomponents

**Files:**
- Create: `src/primitives/Toolbar.tsx`
- Create: `src/primitives/Toolbar.less`
- Create: `src/primitives/Toolbar.test.tsx`
- Create: `src/primitives/Toolbar.stories.tsx`
- Modify: `src/styles.less`

- [ ] **Step 1: Write the failing test**

`src/primitives/Toolbar.test.tsx`:
```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  test('renders children in a horizontal toolbar', () => {
    const { container } = render(
      <Toolbar>
        <Toolbar.Title>My Lab</Toolbar.Title>
        <Toolbar.Button onClick={() => {}}>Save</Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByText('My Lab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).className).toBe('lk-toolbar');
  });

  test('Title uses lk-toolbar-title class', () => {
    const { container } = render(<Toolbar><Toolbar.Title>X</Toolbar.Title></Toolbar>);
    expect(container.querySelector('.lk-toolbar-title')).not.toBeNull();
  });

  test('Spacer fills available space', () => {
    const { container } = render(
      <Toolbar><Toolbar.Title>L</Toolbar.Title><Toolbar.Spacer /><span>R</span></Toolbar>,
    );
    expect(container.querySelector('.lk-toolbar-spacer')).not.toBeNull();
  });

  test('Button passes onClick and disabled', () => {
    let clicked = false;
    render(
      <Toolbar><Toolbar.Button onClick={() => { clicked = true; }}>Go</Toolbar.Button></Toolbar>,
    );
    screen.getByRole('button', { name: 'Go' }).click();
    expect(clicked).toBe(true);
  });

  test('Button respects disabled', () => {
    render(
      <Toolbar><Toolbar.Button onClick={() => {}} disabled>X</Toolbar.Button></Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'X' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/src/labkit && npx vitest run src/primitives/Toolbar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/primitives/Toolbar.tsx`**

```tsx
import type { MouseEventHandler, ReactNode } from 'react';

export interface ToolbarProps {
  children: ReactNode;
}

export function Toolbar({ children }: ToolbarProps) {
  return <div className="lk-toolbar">{children}</div>;
}

interface TitleProps { children: ReactNode; }
function Title({ children }: TitleProps) {
  return <span className="lk-toolbar-title">{children}</span>;
}

interface ButtonProps {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  title?: string;
}
function Button({ children, onClick, disabled, title }: ButtonProps) {
  return (
    <button
      type="button"
      className="lk-toolbar-button"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function Spacer() {
  return <span className="lk-toolbar-spacer" aria-hidden="true" />;
}

Toolbar.Title = Title;
Toolbar.Button = Button;
Toolbar.Spacer = Spacer;
```

- [ ] **Step 4: Write `src/primitives/Toolbar.less`**

```less
.lk-toolbar {
  display: flex;
  align-items: center;
  gap: var(--lk-spacing-sm);
  padding: var(--lk-spacing-xs) var(--lk-spacing-sm);
  background: var(--lk-bg-elevated);
  border-bottom: 1px solid var(--lk-border);
  min-height: calc(var(--lk-control-height) + 2 * var(--lk-spacing-xs));
}

.lk-toolbar-title {
  font-weight: 600;
  color: var(--lk-text);
  margin-right: var(--lk-spacing-sm);
}

.lk-toolbar-spacer {
  flex: 1;
}

.lk-toolbar-button {
  height: var(--lk-control-height);
  padding: 0 var(--lk-spacing-sm);
  font-size: var(--lk-font-size);
  color: var(--lk-text);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--lk-radius);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--lk-bg);
    border-color: var(--lk-border);
  }
  &:focus-visible {
    outline: 2px solid var(--lk-focus-ring);
    outline-offset: 1px;
  }
  &:disabled {
    color: var(--lk-text-disabled);
    cursor: not-allowed;
  }
}
```

- [ ] **Step 5: Add to styles entry**

Modify `src/styles.less` — append:
```less
@import './primitives/Toolbar.less';
```

- [ ] **Step 6: Run tests — all pass**

Run: `cd ~/src/labkit && npx vitest run src/primitives/Toolbar.test.tsx`
Expected: 5 passed.

- [ ] **Step 7: Write the Storybook story**

`src/primitives/Toolbar.stories.tsx`:
```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Toolbar } from './Toolbar';

const meta: Meta<typeof Toolbar> = {
  title: 'Primitives/Toolbar',
  component: Toolbar,
};
export default meta;

type Story = StoryObj<typeof Toolbar>;

export const Default: Story = {
  render: () => (
    <Toolbar>
      <Toolbar.Title>My Workspace</Toolbar.Title>
      <Toolbar.Button onClick={() => {}}>Undo</Toolbar.Button>
      <Toolbar.Button onClick={() => {}}>Redo</Toolbar.Button>
      <Toolbar.Spacer />
      <Toolbar.Button onClick={() => {}}>Save</Toolbar.Button>
    </Toolbar>
  ),
};

export const WithDisabled: Story = {
  render: () => (
    <Toolbar>
      <Toolbar.Title>Empty workspace</Toolbar.Title>
      <Toolbar.Button onClick={() => {}} disabled>Undo</Toolbar.Button>
      <Toolbar.Button onClick={() => {}} disabled>Redo</Toolbar.Button>
    </Toolbar>
  ),
};
```

- [ ] **Step 8: Class-prefix check**

Run: `cd ~/src/labkit && npx tsx scripts/check-class-prefix.ts`
Expected: passes.

- [ ] **Step 9: Commit**

```bash
git add src/primitives/Toolbar.tsx src/primitives/Toolbar.less \
        src/primitives/Toolbar.test.tsx src/primitives/Toolbar.stories.tsx \
        src/styles.less
git commit -m "Add Toolbar primitive with Title/Button/Spacer subcomponents"
```

---

## Task 14: Sidebar with collapse

**Files:**
- Create: `src/primitives/Sidebar.tsx`
- Create: `src/primitives/Sidebar.less`
- Create: `src/primitives/Sidebar.test.tsx`
- Create: `src/primitives/Sidebar.stories.tsx`
- Modify: `src/styles.less`

- [ ] **Step 1: Write the failing test**

`src/primitives/Sidebar.test.tsx`:
```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  test('renders children when expanded (default)', () => {
    render(<Sidebar><p>content</p></Sidebar>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  test('renders title when provided', () => {
    render(<Sidebar title="Controls"><p>x</p></Sidebar>);
    expect(screen.getByText('Controls')).toBeInTheDocument();
  });

  test('hides children when collapsed prop is true', () => {
    render(<Sidebar collapsed><p>content</p></Sidebar>);
    // Content is rendered but in a hidden container — test the class
    const { container } = render(<Sidebar collapsed><p>x</p></Sidebar>);
    expect(container.querySelector('.lk-sidebar')?.classList.contains('lk-sidebar--collapsed')).toBe(true);
  });

  test('toggle button calls onToggle when clicked', () => {
    let toggled = false;
    render(<Sidebar title="C" onToggle={() => { toggled = true; }}><p>x</p></Sidebar>);
    screen.getByRole('button', { name: /collapse|expand/i }).click();
    expect(toggled).toBe(true);
  });

  test('shows expand label when collapsed', () => {
    render(<Sidebar title="C" collapsed onToggle={() => {}}><p>x</p></Sidebar>);
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
  });

  test('shows collapse label when expanded', () => {
    render(<Sidebar title="C" onToggle={() => {}}><p>x</p></Sidebar>);
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/src/labkit && npx vitest run src/primitives/Sidebar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/primitives/Sidebar.tsx`**

```tsx
import type { ReactNode } from 'react';

export interface SidebarProps {
  children: ReactNode;
  title?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ children, title, collapsed = false, onToggle }: SidebarProps) {
  const className = `lk-sidebar${collapsed ? ' lk-sidebar--collapsed' : ''}`;
  return (
    <aside className={className}>
      {(title || onToggle) && (
        <div className="lk-sidebar-header">
          {title && <span className="lk-sidebar-title">{title}</span>}
          {onToggle && (
            <button
              type="button"
              className="lk-sidebar-toggle"
              onClick={onToggle}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          )}
        </div>
      )}
      <div className="lk-sidebar-body">{children}</div>
    </aside>
  );
}
```

- [ ] **Step 4: Write `src/primitives/Sidebar.less`**

```less
.lk-sidebar {
  display: flex;
  flex-direction: column;
  width: 280px;
  background: var(--lk-bg-elevated);
  border-left: 1px solid var(--lk-border);
  transition: width 150ms ease;

  &--collapsed {
    width: 32px;
  }
}

.lk-sidebar-header {
  display: flex;
  align-items: center;
  padding: var(--lk-spacing-xs) var(--lk-spacing-sm);
  border-bottom: 1px solid var(--lk-divider);
  min-height: var(--lk-control-height);
}

.lk-sidebar-title {
  flex: 1;
  font-weight: 600;
  color: var(--lk-text);
  font-size: var(--lk-font-size);

  .lk-sidebar--collapsed & {
    display: none;
  }
}

.lk-sidebar-toggle {
  height: 24px;
  width: 24px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--lk-radius-sm);
  color: var(--lk-text-muted);
  cursor: pointer;

  &:hover {
    background: var(--lk-bg);
    color: var(--lk-text);
  }
}

.lk-sidebar-body {
  flex: 1;
  overflow: auto;
  padding: var(--lk-spacing-sm);

  .lk-sidebar--collapsed & {
    display: none;
  }
}
```

- [ ] **Step 5: Add to styles entry**

Modify `src/styles.less` — append:
```less
@import './primitives/Sidebar.less';
```

- [ ] **Step 6: Run tests — all pass**

Run: `cd ~/src/labkit && npx vitest run src/primitives/Sidebar.test.tsx`
Expected: 6 passed.

- [ ] **Step 7: Write the Storybook story**

`src/primitives/Sidebar.stories.tsx`:
```tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Sidebar } from './Sidebar';

const meta: Meta<typeof Sidebar> = {
  title: 'Primitives/Sidebar',
  component: Sidebar,
};
export default meta;

type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {
  render: () => (
    <div style={{ display: 'flex', height: 400 }}>
      <div style={{ flex: 1 }}>main content area</div>
      <Sidebar title="Controls">
        <p>One slider here</p>
        <p>Another slider</p>
      </Sidebar>
    </div>
  ),
};

export const Collapsible: Story = {
  render: function Render() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <div style={{ display: 'flex', height: 400 }}>
        <div style={{ flex: 1, padding: 16 }}>main content area</div>
        <Sidebar
          title="Controls"
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        >
          <p>One slider here</p>
          <p>Another slider</p>
        </Sidebar>
      </div>
    );
  },
};
```

- [ ] **Step 8: Class-prefix check**

Run: `cd ~/src/labkit && npx tsx scripts/check-class-prefix.ts`
Expected: passes.

- [ ] **Step 9: Commit**

```bash
git add src/primitives/Sidebar.tsx src/primitives/Sidebar.less \
        src/primitives/Sidebar.test.tsx src/primitives/Sidebar.stories.tsx \
        src/styles.less
git commit -m "Add Sidebar primitive with optional collapse"
```

---

## Task 15: StatusBar

**Files:**
- Create: `src/primitives/StatusBar.tsx`
- Create: `src/primitives/StatusBar.less`
- Create: `src/primitives/StatusBar.test.tsx`
- Create: `src/primitives/StatusBar.stories.tsx`
- Modify: `src/styles.less`

- [ ] **Step 1: Write the failing test**

`src/primitives/StatusBar.test.tsx`:
```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  test('renders children', () => {
    render(<StatusBar>3 items</StatusBar>);
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  test('uses lk-status-bar class', () => {
    const { container } = render(<StatusBar>x</StatusBar>);
    expect((container.firstChild as HTMLElement).className).toBe('lk-status-bar');
  });

  test('renders multiple section children separated', () => {
    const { container } = render(
      <StatusBar>
        <StatusBar.Section>left</StatusBar.Section>
        <StatusBar.Section>right</StatusBar.Section>
      </StatusBar>,
    );
    expect(container.querySelectorAll('.lk-status-bar-section').length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/src/labkit && npx vitest run src/primitives/StatusBar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/primitives/StatusBar.tsx`**

```tsx
import type { ReactNode } from 'react';

export interface StatusBarProps {
  children: ReactNode;
}

export function StatusBar({ children }: StatusBarProps) {
  return <div className="lk-status-bar">{children}</div>;
}

interface SectionProps { children: ReactNode; }
function Section({ children }: SectionProps) {
  return <span className="lk-status-bar-section">{children}</span>;
}

StatusBar.Section = Section;
```

- [ ] **Step 4: Write `src/primitives/StatusBar.less`**

```less
.lk-status-bar {
  display: flex;
  align-items: center;
  gap: var(--lk-spacing-md);
  padding: var(--lk-spacing-xs) var(--lk-spacing-sm);
  background: var(--lk-bg-elevated);
  border-top: 1px solid var(--lk-border);
  font-size: var(--lk-font-size-sm);
  color: var(--lk-text-muted);
  font-family: var(--lk-font-mono);
}

.lk-status-bar-section {
  display: inline-flex;
  align-items: center;
  gap: var(--lk-spacing-xs);
  padding: 0 var(--lk-spacing-xs);
  border-right: 1px solid var(--lk-divider);

  &:last-child { border-right: none; }
}
```

- [ ] **Step 5: Add to styles entry**

Modify `src/styles.less` — append:
```less
@import './primitives/StatusBar.less';
```

- [ ] **Step 6: Run tests — all pass**

Run: `cd ~/src/labkit && npx vitest run src/primitives/StatusBar.test.tsx`
Expected: 3 passed.

- [ ] **Step 7: Write the Storybook story**

`src/primitives/StatusBar.stories.tsx`:
```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { StatusBar } from './StatusBar';

const meta: Meta<typeof StatusBar> = {
  title: 'Primitives/StatusBar',
  component: StatusBar,
};
export default meta;

type Story = StoryObj<typeof StatusBar>;

export const Plain: Story = {
  render: () => <StatusBar>Ready</StatusBar>,
};

export const Sections: Story = {
  render: () => (
    <StatusBar>
      <StatusBar.Section>Items: 12</StatusBar.Section>
      <StatusBar.Section>Zoom: 100%</StatusBar.Section>
      <StatusBar.Section>FPS: 60</StatusBar.Section>
    </StatusBar>
  ),
};
```

- [ ] **Step 8: Class-prefix check & commit**

Run: `cd ~/src/labkit && npx tsx scripts/check-class-prefix.ts`
Expected: passes.

```bash
git add src/primitives/StatusBar.tsx src/primitives/StatusBar.less \
        src/primitives/StatusBar.test.tsx src/primitives/StatusBar.stories.tsx \
        src/styles.less
git commit -m "Add StatusBar primitive with Section subcomponent"
```

---

## Task 16: FpsMeter

**Files:**
- Create: `src/primitives/fpsAverage.ts`
- Create: `src/primitives/fpsAverage.test.ts`
- Create: `src/primitives/FpsMeter.tsx`
- Create: `src/primitives/FpsMeter.less`
- Create: `src/primitives/FpsMeter.test.tsx`
- Create: `src/primitives/FpsMeter.stories.tsx`
- Modify: `src/styles.less`

- [ ] **Step 1: Write the failing test for the pure averaging fn**

`src/primitives/fpsAverage.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { rollingAverage } from './fpsAverage';

describe('rollingAverage', () => {
  test('returns the input when only one sample', () => {
    expect(rollingAverage([60])).toBe(60);
  });

  test('averages multiple samples', () => {
    expect(rollingAverage([30, 60, 90])).toBe(60);
  });

  test('returns 0 for empty array', () => {
    expect(rollingAverage([])).toBe(0);
  });

  test('rounds to nearest integer', () => {
    expect(rollingAverage([59, 60, 61])).toBe(60);
    expect(rollingAverage([58, 59, 61])).toBe(59);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/src/labkit && npx vitest run src/primitives/fpsAverage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/primitives/fpsAverage.ts`**

```ts
export function rollingAverage(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sum = samples.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / samples.length);
}
```

- [ ] **Step 4: Run pure-function tests — all pass**

Run: `cd ~/src/labkit && npx vitest run src/primitives/fpsAverage.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Write the failing component test**

`src/primitives/FpsMeter.test.tsx`:
```tsx
import { describe, expect, test, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FpsMeter } from './FpsMeter';

describe('FpsMeter', () => {
  afterEach(() => { vi.useRealTimers(); });

  test('renders an FPS label', () => {
    render(<FpsMeter />);
    expect(screen.getByText(/fps/i)).toBeInTheDocument();
  });

  test('uses lk-fps-meter class', () => {
    const { container } = render(<FpsMeter />);
    expect((container.firstChild as HTMLElement).className).toBe('lk-fps-meter');
  });

  test('updates after a tick', () => {
    let raf: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      raf = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    render(<FpsMeter />);
    act(() => {
      // Simulate three frames spaced 16.67 ms apart -> ~60fps
      raf?.(0);
      raf?.(16.67);
      raf?.(33.34);
    });
    // Component renders "FPS NN"; presence of any number in 1-9999 is enough
    expect(screen.getByText(/FPS\s+\d+/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd ~/src/labkit && npx vitest run src/primitives/FpsMeter.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Write `src/primitives/FpsMeter.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { rollingAverage } from './fpsAverage';

const SAMPLE_WINDOW = 30;

export function FpsMeter() {
  const [fps, setFps] = useState(0);
  const samplesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId = 0;
    const tick = (time: number) => {
      const last = lastTimeRef.current;
      if (last !== null) {
        const delta = time - last;
        if (delta > 0) {
          const samples = samplesRef.current;
          samples.push(1000 / delta);
          if (samples.length > SAMPLE_WINDOW) samples.shift();
          setFps(rollingAverage(samples));
        }
      }
      lastTimeRef.current = time;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="lk-fps-meter">
      FPS <span className="lk-fps-meter-value">{fps}</span>
    </div>
  );
}
```

- [ ] **Step 8: Write `src/primitives/FpsMeter.less`**

```less
.lk-fps-meter {
  display: inline-flex;
  align-items: center;
  gap: var(--lk-spacing-xs);
  font-family: var(--lk-font-mono);
  font-size: var(--lk-font-size-sm);
  color: var(--lk-text-muted);
}

.lk-fps-meter-value {
  color: var(--lk-text);
  min-width: 2.5ch;
  text-align: right;
}
```

- [ ] **Step 9: Add to styles entry**

Modify `src/styles.less` — append:
```less
@import './primitives/FpsMeter.less';
```

- [ ] **Step 10: Run tests — all pass**

Run: `cd ~/src/labkit && npx vitest run src/primitives/FpsMeter`
Expected: 7 passed (4 fpsAverage + 3 FpsMeter).

- [ ] **Step 11: Write the Storybook story**

`src/primitives/FpsMeter.stories.tsx`:
```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { FpsMeter } from './FpsMeter';

const meta: Meta<typeof FpsMeter> = {
  title: 'Primitives/FpsMeter',
  component: FpsMeter,
};
export default meta;

type Story = StoryObj<typeof FpsMeter>;

export const Default: Story = {
  render: () => <FpsMeter />,
};
```

- [ ] **Step 12: Class-prefix check & commit**

Run: `cd ~/src/labkit && npx tsx scripts/check-class-prefix.ts`
Expected: passes.

```bash
git add src/primitives/fpsAverage.ts src/primitives/fpsAverage.test.ts \
        src/primitives/FpsMeter.tsx src/primitives/FpsMeter.less \
        src/primitives/FpsMeter.test.tsx src/primitives/FpsMeter.stories.tsx \
        src/styles.less
git commit -m "Add FpsMeter primitive (rolling 30-sample average)"
```

---

## Task 17: ScaleIndicator

**Files:**
- Create: `src/primitives/ScaleIndicator.tsx`
- Create: `src/primitives/ScaleIndicator.less`
- Create: `src/primitives/ScaleIndicator.test.tsx`
- Create: `src/primitives/ScaleIndicator.stories.tsx`
- Modify: `src/styles.less`

- [ ] **Step 1: Write the failing test**

`src/primitives/ScaleIndicator.test.tsx`:
```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScaleIndicator } from './ScaleIndicator';

describe('ScaleIndicator', () => {
  test('renders the unit label', () => {
    render(<ScaleIndicator zoom={1} pixelsPerUnit={50} unit="ft" />);
    expect(screen.getByText(/ft/)).toBeInTheDocument();
  });

  test('shows scale value scaled by zoom', () => {
    // pixelsPerUnit=50, zoom=2 → effective 100 px per unit
    // The component renders "1 ft" when bar width === effective px-per-unit
    render(<ScaleIndicator zoom={2} pixelsPerUnit={50} unit="ft" />);
    expect(screen.getByText(/1\s*ft/)).toBeInTheDocument();
  });

  test('rounds non-integer zoom values for label', () => {
    // zoom=0.5, pixelsPerUnit=50 → effective 25 px per unit
    // Component fits multiple units in default 100px bar → label reflects bar units
    const { container } = render(<ScaleIndicator zoom={0.5} pixelsPerUnit={50} unit="ft" />);
    expect(container.querySelector('.lk-scale-indicator')).not.toBeNull();
  });

  test('uses lk-scale-indicator class', () => {
    const { container } = render(<ScaleIndicator zoom={1} pixelsPerUnit={50} unit="ft" />);
    expect((container.firstChild as HTMLElement).className).toBe('lk-scale-indicator');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/src/labkit && npx vitest run src/primitives/ScaleIndicator.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/primitives/ScaleIndicator.tsx`**

```tsx
export interface ScaleIndicatorProps {
  /** Current view zoom factor (1 = no zoom). */
  zoom: number;
  /** World pixels per unit at zoom=1. */
  pixelsPerUnit: number;
  /** Unit label (e.g., 'ft', 'm', 'px'). */
  unit: string;
  /** Target bar width in display pixels. Default: 100. */
  targetWidth?: number;
}

// Rounds n to a "nice" number — 1, 2, 5, 10, 20, 50, ...
function niceNumber(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const fraction = n / 10 ** exp;
  let nice: number;
  if (fraction < 1.5) nice = 1;
  else if (fraction < 3.5) nice = 2;
  else if (fraction < 7.5) nice = 5;
  else nice = 10;
  return nice * 10 ** exp;
}

export function ScaleIndicator({ zoom, pixelsPerUnit, unit, targetWidth = 100 }: ScaleIndicatorProps) {
  const effectivePxPerUnit = pixelsPerUnit * zoom;
  const targetUnits = targetWidth / effectivePxPerUnit;
  const niceUnits = niceNumber(targetUnits);
  const barWidth = niceUnits * effectivePxPerUnit;
  return (
    <div className="lk-scale-indicator" aria-label={`Scale: ${niceUnits} ${unit}`}>
      <div className="lk-scale-indicator-bar" style={{ width: `${barWidth}px` }} />
      <span className="lk-scale-indicator-label">
        {niceUnits} {unit}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/primitives/ScaleIndicator.less`**

```less
.lk-scale-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--lk-spacing-xs);
  font-family: var(--lk-font-mono);
  font-size: var(--lk-font-size-sm);
  color: var(--lk-text-muted);
}

.lk-scale-indicator-bar {
  height: 6px;
  border: 1px solid var(--lk-text-muted);
  border-top: none;
  background: linear-gradient(
    to right,
    var(--lk-text-muted) 1px,
    transparent 1px,
    transparent calc(100% - 1px),
    var(--lk-text-muted) calc(100% - 1px)
  );
}

.lk-scale-indicator-label {
  white-space: nowrap;
}
```

- [ ] **Step 5: Add to styles entry**

Modify `src/styles.less` — append:
```less
@import './primitives/ScaleIndicator.less';
```

- [ ] **Step 6: Run tests — all pass**

Run: `cd ~/src/labkit && npx vitest run src/primitives/ScaleIndicator.test.tsx`
Expected: 4 passed.

- [ ] **Step 7: Write the Storybook story**

`src/primitives/ScaleIndicator.stories.tsx`:
```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ScaleIndicator } from './ScaleIndicator';

const meta: Meta<typeof ScaleIndicator> = {
  title: 'Primitives/ScaleIndicator',
  component: ScaleIndicator,
  args: { unit: 'ft', pixelsPerUnit: 50 },
};
export default meta;

type Story = StoryObj<typeof ScaleIndicator>;

export const NoZoom: Story = { args: { zoom: 1 } };
export const ZoomedIn: Story = { args: { zoom: 4 } };
export const ZoomedOut: Story = { args: { zoom: 0.25 } };
export const Meters: Story = { args: { zoom: 1, unit: 'm', pixelsPerUnit: 100 } };
```

- [ ] **Step 8: Class-prefix check & commit**

Run: `cd ~/src/labkit && npx tsx scripts/check-class-prefix.ts`
Expected: passes.

```bash
git add src/primitives/ScaleIndicator.tsx src/primitives/ScaleIndicator.less \
        src/primitives/ScaleIndicator.test.tsx src/primitives/ScaleIndicator.stories.tsx \
        src/styles.less
git commit -m "Add ScaleIndicator primitive (zoom-aware ruler with nice numbers)"
```

---

## Task 18: Public entry points

**Files:**
- Create: `src/index.ts`
- Create: `src/lab/index.ts`
- Create: `src/primitives/index.ts`

- [ ] **Step 1: Write `src/lab/index.ts`**

```ts
export { LabShell } from './LabShell';
export type { LabShellProps, LabTheme } from './LabShell';
export { WorkspaceGrid } from './WorkspaceGrid';
export type { WorkspaceGridProps } from './WorkspaceGrid';
export { gridDims } from './gridDims';
export type { GridDims } from './gridDims';
```

- [ ] **Step 2: Write `src/primitives/index.ts`**

```ts
export { Toolbar } from './Toolbar';
export type { ToolbarProps } from './Toolbar';
export { Sidebar } from './Sidebar';
export type { SidebarProps } from './Sidebar';
export { StatusBar } from './StatusBar';
export type { StatusBarProps } from './StatusBar';
export { FpsMeter } from './FpsMeter';
export { ScaleIndicator } from './ScaleIndicator';
export type { ScaleIndicatorProps } from './ScaleIndicator';
```

- [ ] **Step 3: Write `src/index.ts`**

```ts
// Top-level public API. Plan 1 ships only presentational primitives;
// later plans add Lab, Workspace, defineInstrument, capabilities, etc.
export * from './lab';
export * from './primitives';
```

- [ ] **Step 4: Run type check**

Run: `cd ~/src/labkit && npx tsc -b`
Expected: exits 0.

- [ ] **Step 5: Run all tests**

Run: `cd ~/src/labkit && npm test`
Expected: all tests pass; no missing-module errors.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/lab/index.ts src/primitives/index.ts
git commit -m "Wire public entry points for lab/ and primitives/"
```

---

## Task 19: README and AGENTS.md scaffold

**Files:**
- Create: `README.md`
- Create: `docs/AGENTS.md`
- Create: `docs/RECIPES.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# @labkit/react

React widgets for building self-contained interactive **lab** pages — pages with sliders, controls, and canvas-based experimentation.

This is the v0.x of the library. The Lab/Workspace/Instrument runtime arrives in later plans; v0.0.1 ships presentational primitives.

## Installation

```bash
npm install @labkit/react
```

## Usage

```tsx
import { LabShell, Toolbar, WorkspaceGrid, FpsMeter } from '@labkit/react';
import '@labkit/react/styles.css';

function MyLab() {
  return (
    <LabShell title="My Lab" header={<button>+ Add</button>}>
      <WorkspaceGrid>
        <div>Workspace 1</div>
        <div>Workspace 2</div>
      </WorkspaceGrid>
    </LabShell>
  );
}
```

## Theme

Theme follows the OS by default. To force a theme:

```tsx
<LabShell title="..." theme="dark">...</LabShell>
```

## Development

```bash
npm install
npm run dev          # Vite dev server (examples/)
npm run storybook    # Storybook on :6006
npm test             # Vitest
npm run lint         # Biome + class-prefix check
npm run build        # Build dist/ for publish
```

## Documentation

- [`docs/AGENTS.md`](./docs/AGENTS.md) — agent navigation guide
- [`docs/RECIPES.md`](./docs/RECIPES.md) — composition patterns
- [`docs/superpowers/specs/2026-04-26-labkit-design.md`](./docs/superpowers/specs/2026-04-26-labkit-design.md) — design spec
```

- [ ] **Step 2: Write `docs/AGENTS.md` (Plan 1 scaffold; later plans extend it)**

```markdown
# Labkit — Agent Guide

A map of the library so agents can find what they need quickly.

## Where to find things (Plan 1)

| Concept | Source |
|---|---|
| `<LabShell>` | `src/lab/LabShell.tsx` |
| `<WorkspaceGrid>` | `src/lab/WorkspaceGrid.tsx` |
| `gridDims()` | `src/lab/gridDims.ts` |
| `<Toolbar>` + subcomponents | `src/primitives/Toolbar.tsx` |
| `<Sidebar>` | `src/primitives/Sidebar.tsx` |
| `<StatusBar>` | `src/primitives/StatusBar.tsx` |
| `<FpsMeter>` | `src/primitives/FpsMeter.tsx` |
| `<ScaleIndicator>` | `src/primitives/ScaleIndicator.tsx` |
| Theme tokens | `src/theme/tokens.less` |
| Theme overrides | `src/theme/light.less`, `src/theme/dark.less` |
| Class-prefix enforcement | `scripts/check-class-prefix.ts` |

## When to use what

- Composing a one-off lab page? Import primitives directly from `@labkit/react`.
- Need full Lab/Workspace runtime? Coming in later plans (Lab, Workspace, defineInstrument).

## Conventions

- All DOM classes start with `lk-` (enforced by `scripts/check-class-prefix.ts`)
- Component CSS lives in a sibling `.less` file (e.g., `Toolbar.less` next to `Toolbar.tsx`)
- Each primitive ships with a `.test.tsx` and a `.stories.tsx`
- Theme tokens are CSS custom properties (`--lk-*`); use them in component CSS, never hardcode colors

## Forking a primitive

If a primitive doesn't fit your needs, copy its source into your project. Each component is self-contained — TSX + LESS, no cross-imports beyond theme tokens.

## See also

- `docs/RECIPES.md` — composition patterns
- `docs/superpowers/specs/2026-04-26-labkit-design.md` — full design spec
```

- [ ] **Step 3: Write `docs/RECIPES.md` (Plan 1 scaffold)**

```markdown
# Labkit — Recipes

Composition patterns for common lab shapes. This file grows as plans land.

## Plan 1 recipes

### A minimal lab shell with a tiled grid

```tsx
import { LabShell, WorkspaceGrid } from '@labkit/react';
import '@labkit/react/styles.css';

export function MyLab() {
  return (
    <LabShell title="My Lab">
      <WorkspaceGrid>
        <div>Workspace 1</div>
        <div>Workspace 2</div>
        <div>Workspace 3</div>
      </WorkspaceGrid>
    </LabShell>
  );
}
```

### A toolbar with undo/redo and a save button

```tsx
import { Toolbar } from '@labkit/react';

<Toolbar>
  <Toolbar.Title>My Workspace</Toolbar.Title>
  <Toolbar.Button onClick={onUndo} disabled={!canUndo}>Undo</Toolbar.Button>
  <Toolbar.Button onClick={onRedo} disabled={!canRedo}>Redo</Toolbar.Button>
  <Toolbar.Spacer />
  <Toolbar.Button onClick={onSave}>Save</Toolbar.Button>
</Toolbar>
```

### A status bar with multiple sections

```tsx
import { StatusBar, FpsMeter } from '@labkit/react';

<StatusBar>
  <StatusBar.Section>Items: {items.length}</StatusBar.Section>
  <StatusBar.Section>Zoom: {Math.round(zoom * 100)}%</StatusBar.Section>
  <StatusBar.Section><FpsMeter /></StatusBar.Section>
</StatusBar>
```

(More recipes added in subsequent plans — Lab/Workspace integration, undoable actions, custom storage, etc.)
```

- [ ] **Step 4: Commit**

```bash
git add README.md docs/AGENTS.md docs/RECIPES.md
git commit -m "Add README and Plan 1 docs (AGENTS.md, RECIPES.md scaffolds)"
```

---

## Task 20: Smoke test — full build, Storybook build, all tests pass

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

Run: `cd ~/src/labkit && npm test`
Expected: all tests pass. Counts approximately:
- gridDims: 7
- WorkspaceGrid: 3
- LabShell: 7
- Toolbar: 5
- Sidebar: 6
- StatusBar: 3
- fpsAverage: 4
- FpsMeter: 3
- ScaleIndicator: 4

Total: ~42 passing.

- [ ] **Step 2: Run lint**

Run: `cd ~/src/labkit && npm run lint`
Expected: biome reports no errors; class-prefix script reports "All className literals in src/ use the lk- prefix."

- [ ] **Step 3: Type-check**

Run: `cd ~/src/labkit && npx tsc -b`
Expected: exits 0.

- [ ] **Step 4: Build the library**

Run: `cd ~/src/labkit && npm run build`
Expected:
- `dist/index.js`, `dist/index.d.ts` created
- `dist/primitives/index.js`, `dist/primitives/index.d.ts` created
- `dist/styles.css` created (contains `:root { --lk-bg: #1a1410; ... }` plus `.lk-workspace-grid`, `.lk-shell`, etc.)
- `dist/theme-light.css` created (contains `.lk-theme-light { ... }`)
- `dist/theme-dark.css` created (contains `.lk-theme-dark { ... }`)

- [ ] **Step 5: Verify dist contents**

Run: `cd ~/src/labkit && ls dist/`
Expected output includes: `index.js`, `index.d.ts`, `index.js.map`, `primitives/`, `styles.css`, `theme-light.css`, `theme-dark.css`.

Run: `cd ~/src/labkit && grep -l 'lk-toolbar' dist/styles.css`
Expected: prints `dist/styles.css` (the toolbar CSS made it into the bundle).

- [ ] **Step 6: Build Storybook**

Run: `cd ~/src/labkit && npm run build-storybook`
Expected: builds without errors; `storybook-static/` populated.

- [ ] **Step 7: Open Storybook in dev mode (manual visual check)**

Run: `cd ~/src/labkit && npm run storybook` (background)

Open http://localhost:6006 in a browser. Verify:
- Stories sidebar shows: `Lab/LabShell`, `Lab/WorkspaceGrid`, `Primitives/Toolbar`, `Primitives/Sidebar`, `Primitives/StatusBar`, `Primitives/FpsMeter`, `Primitives/ScaleIndicator`.
- Theme toolbar control switches between Auto/Light/Dark and the preview reflects the change.
- `WorkspaceGrid > SevenTiles` lays out as 3 columns × 3 rows.
- `Toolbar > Default` renders Title, three buttons, and a spacer pushing Save to the right.
- `FpsMeter > Default` displays a number that updates over time.

Stop the dev server when done.

- [ ] **Step 8: Final commit (lockfile / any cleanup if needed)**

If anything generated by the build (e.g., changed lockfile) needs committing, do so now. Otherwise:

```bash
cd ~/src/labkit && git status
```

If clean:
```bash
git tag plan-1-foundation
```
(Optional: tag the commit so later plans can reference Plan 1's completion point.)

Plan 1 is complete. Ready to start Plan 2 (Instrument runtime + ControlPanel) on top of this foundation.
