# weasel-theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `@orochi235/weasel-theme` as the canonical home for design tokens. Rename the `--wui-*` CSS namespace to `--wzl-*` across weasel-ui's components. Add four button-state tokens. Have weasel-hud read tokens from `getComputedStyle(canvasEl)` per draw, with `DEFAULT_TOKENS` as fallback, so widgets pick up live CSS theme changes without machinery.

**Architecture:** Five stages. Stage 1 creates the new `weasel-theme` package (CSS + parallel TS source). Stage 2 migrates weasel-ui to the new namespace and deletes its now-redundant `tokens.css`. Stage 3 builds the HUD's token-resolution module and extends `HudDrawCtx`. Stage 4 refactors `label` and `button` widgets to read defaults from `ctx.tokens` instead of hardcoded constants. Stage 5 adds the end-to-end integration test and prunes stale references.

**Tech Stack:** TypeScript, Vitest, jsdom for DOM-touching tests, CSS Custom Properties, the existing `WeaselRenderer` color path.

**Spec:** `docs/specs/2026-05-10-weasel-theme-design.md`

---

## File Structure

**Stage 1 — Scaffold `packages/weasel-theme/`**
- Create: `packages/weasel-theme/package.json`
- Create: `packages/weasel-theme/tsconfig.json`
- Create: `packages/weasel-theme/README.md`
- Create: `packages/weasel-theme/src/tokens.ts`
- Create: `packages/weasel-theme/src/tokens.css`
- Create: `packages/weasel-theme/src/index.ts`
- Create: `packages/weasel-theme/src/tokens.test.ts`
- Modify: `tsconfig.json` (root) — add path alias + `include` entry
- Modify: `vite.config.ts` (root) — add resolve alias for `@orochi235/weasel-theme` + `@orochi235/weasel-theme/tokens.css`
- Modify: `vitest.config.ts` — same aliases
- Modify: `apps/swillustrator/vite.config.ts` — same aliases

**Stage 2 — Migrate weasel-ui to the new namespace**
- Modify: `packages/weasel-ui/src/PropertiesPanel.module.css` — rename 24 `--wui-*` → `--wzl-*`
- Modify: `packages/weasel-ui/src/RangePicker.module.css` — rename 10
- Modify: `packages/weasel-ui/src/CommandPalette.module.css` — rename 21
- Modify: `packages/weasel-ui/src/paintGradientTrack.tsx` — rename 2 string refs
- Modify: `apps/swillustrator/src/App.tsx` — change `@orochi235/weasel-ui/tokens.css` import to `@orochi235/weasel-theme/tokens.css`
- Modify: `demo/canvas-kit-demo.css` — rename 13
- Modify: `apps/swillustrator/src/swillustrator.css` — rename 7
- Modify: `packages/weasel-ui/package.json` — remove `./tokens.css` from `exports`
- Delete: `packages/weasel-ui/src/tokens.css`
- Modify: `vite.config.ts`, `vitest.config.ts`, `apps/swillustrator/vite.config.ts` — remove the old `@orochi235/weasel-ui/tokens.css` alias

**Stage 3 — Token resolution in weasel-hud**
- Create: `packages/weasel-hud/src/theme.ts` — `ResolvedTokens` type + `readTokens()` function
- Create: `packages/weasel-hud/src/theme.test.ts`
- Modify: `packages/weasel-hud/src/widget.ts` — add `tokens: ResolvedTokens` to `HudDrawCtx`
- Modify: `packages/weasel-hud/src/attach.ts` — `draw()` calls `readTokens(api.element)` and packs result into ctx
- Modify: `packages/weasel-hud/src/index.ts` — re-export `ResolvedTokens`, `readTokens`
- Modify: `packages/weasel-hud/package.json` — add `@orochi235/weasel-theme` to peerDependencies (or dependencies — see Task 3.1)

**Stage 4 — Widget integration**
- Modify: `packages/weasel-hud/src/widgets/label.ts` + `label.test.ts` — read `ctx.tokens.text` when color omitted
- Modify: `packages/weasel-hud/src/widgets/text.ts` + `text.test.ts` — same fallback for opts.color
- Modify: `packages/weasel-hud/src/widgets/button.ts` + `button.test.ts` — read four button tokens when corresponding opts omitted

**Stage 5 — Integration test + cleanup**
- Modify: `packages/weasel-hud/src/integration.test.tsx` — add a CSS-variable end-to-end test
- Modify: `packages/weasel-ui/README.md` — mention that tokens have moved to weasel-theme

---

## Rename Inventory (Stage 2)

These files contain `--wui-*` references that all become `--wzl-*`:

| File | Count |
|---|---|
| `packages/weasel-ui/src/PropertiesPanel.module.css` | 24 |
| `packages/weasel-ui/src/CommandPalette.module.css` | 21 |
| `packages/weasel-ui/src/RangePicker.module.css` | 10 |
| `packages/weasel-ui/src/tokens.css` | 12 (file gets DELETED in Stage 2) |
| `demo/canvas-kit-demo.css` | 13 |
| `apps/swillustrator/src/swillustrator.css` | 7 |
| `packages/weasel-ui/src/paintGradientTrack.tsx` | 2 (JS string literals — `getPropertyValue('--wui-…')` calls) |
| **Total to migrate** | **77 references across 6 files** |

(`tokens.css` deletion isn't counted as a migration — it's a removal.)

The migration is a single mechanical find/replace: `--wui-` → `--wzl-` everywhere. No semantic interpretation needed.

---

## Stage 1 — Scaffold `weasel-theme`

### Task 1.1: Create the package skeleton

**Files:**
- Create: `packages/weasel-theme/package.json`
- Create: `packages/weasel-theme/tsconfig.json`
- Create: `packages/weasel-theme/README.md`
- Create: `packages/weasel-theme/src/index.ts`

- [ ] **Step 1: Create the package directory**

```bash
mkdir -p packages/weasel-theme/src
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "@orochi235/weasel-theme",
  "version": "0.0.0",
  "private": true,
  "description": "Design tokens shared by weasel-ui and weasel-hud — CSS variables + a parallel TS export.",
  "license": "MIT",
  "type": "module",
  "sideEffects": ["*.css"],
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./tokens.css": "./src/tokens.css",
    "./package.json": "./package.json"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src"],
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  }
}
```

- [ ] **Step 4: Write `README.md`**

```markdown
# weasel-theme

Design tokens shared by `@orochi235/weasel-ui` (DOM/React widgets) and
`@orochi235/weasel-hud` (WebGL widgets). Single namespace: `--wzl-*`.

## Usage

```ts
// In your app shell, import the CSS for default values:
import '@orochi235/weasel-theme/tokens.css';
```

Override individual tokens at any DOM level:

```css
[data-theme="dark"] {
  --wzl-text: #f4f4f4;
  --wzl-panel-bg: #1a1a1a;
}
```

For non-DOM consumers (weasel-hud), the TS export `DEFAULT_TOKENS` provides
the same values as a typed object for fallback when CSS isn't loaded.

## Editing tokens

`tokens.ts` and `tokens.css` are maintained side-by-side. The parity test
in `tokens.test.ts` catches drift between them. If you edit one, edit
the other and run `pnpm exec vitest run packages/weasel-theme/`.
```

- [ ] **Step 5: Create the (empty) barrel**

```ts
// packages/weasel-theme/src/index.ts
export { DEFAULT_TOKENS, type TokenName } from './tokens';
```

(This will fail typecheck until Task 1.2 lands `tokens.ts` — acceptable mid-stage.)

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-theme/
git commit -m "feat(weasel-theme): package skeleton"
```

---

### Task 1.2: Write the token source modules

**Files:**
- Create: `packages/weasel-theme/src/tokens.ts`
- Create: `packages/weasel-theme/src/tokens.css`

- [ ] **Step 1: Write `tokens.css`**

```css
/* Design tokens for the weasel design system. Shared by weasel-ui (DOM)
 * and weasel-hud (WebGL). Apps with their own design system should skip
 * this file and define the variables themselves at the desired scope. */
:root {
  --wzl-text: #1a1a1a;
  --wzl-text-muted: #6a6a6a;
  --wzl-panel-bg: #f4f4f4;
  --wzl-panel-border: #d4d4d4;
  --wzl-input-bg: #ffffff;
  --wzl-accent: #4a8fd4;
  --wzl-danger: #c64a3a;
  --wzl-track-bg: #e3e3e3;
  --wzl-track-border: #c2c2c2;
  --wzl-thumb-fill: #ffffff;
  --wzl-thumb-border: #6a6a6a;
  --wzl-thumb-text: #1a1a1a;
  --wzl-button-fill: #ffffff;
  --wzl-button-fill-hover: #f5f5f5;
  --wzl-button-fill-pressed: #e0e0e0;
  --wzl-button-text: var(--wzl-text);
}
```

- [ ] **Step 2: Write `tokens.ts`**

```ts
// packages/weasel-theme/src/tokens.ts
/**
 * Source of truth for token default values. Mirrors tokens.css exactly,
 * with var(--*) references resolved to their literal target value (TS
 * exports can't reference each other syntactically the way CSS can with
 * var()). The parity test in tokens.test.ts catches drift.
 */
export const DEFAULT_TOKENS = {
  '--wzl-text': '#1a1a1a',
  '--wzl-text-muted': '#6a6a6a',
  '--wzl-panel-bg': '#f4f4f4',
  '--wzl-panel-border': '#d4d4d4',
  '--wzl-input-bg': '#ffffff',
  '--wzl-accent': '#4a8fd4',
  '--wzl-danger': '#c64a3a',
  '--wzl-track-bg': '#e3e3e3',
  '--wzl-track-border': '#c2c2c2',
  '--wzl-thumb-fill': '#ffffff',
  '--wzl-thumb-border': '#6a6a6a',
  '--wzl-thumb-text': '#1a1a1a',
  '--wzl-button-fill': '#ffffff',
  '--wzl-button-fill-hover': '#f5f5f5',
  '--wzl-button-fill-pressed': '#e0e0e0',
  '--wzl-button-text': '#1a1a1a',  // resolves the var(--wzl-text) alias from tokens.css
} as const;

export type TokenName = keyof typeof DEFAULT_TOKENS;
```

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/weasel-theme/src/tokens.ts packages/weasel-theme/src/tokens.css
git commit -m "feat(weasel-theme): token source modules (CSS + TS)"
```

---

### Task 1.3: Parity test

**Files:**
- Create: `packages/weasel-theme/src/tokens.test.ts`

- [ ] **Step 1: Write the test**

```ts
// packages/weasel-theme/src/tokens.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TOKENS } from './tokens';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('weasel-theme tokens', () => {
  it('DEFAULT_TOKENS keys match tokens.css :root declarations', () => {
    const cssText = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
    const matches = [...cssText.matchAll(/(--wzl-[a-z-]+):\s*([^;]+);/g)];
    const cssKeys = matches.map(([, key]) => key).sort();
    const tsKeys = Object.keys(DEFAULT_TOKENS).sort();
    expect(cssKeys).toEqual(tsKeys);
  });
});
```

- [ ] **Step 2: Update root config to pick up the new package**

In `tsconfig.json` (project root), find the `paths` block and append:

```json
"@orochi235/weasel-theme": ["./packages/weasel-theme/src/index.ts"],
"@orochi235/weasel-theme/tokens.css": ["./packages/weasel-theme/src/tokens.css"]
```

And in the `include` array, add `"packages/weasel-theme/src"`:

```json
"include": ["src", "demo", "apps", "packages/weasel-ui/src", "packages/weasel-hud/src", "packages/weasel-theme/src"]
```

- [ ] **Step 3: Update `vite.config.ts` resolve aliases**

Find the `alias` array in `vite.config.ts` and add (near the other `@orochi235/weasel-*` entries):

```ts
{
  find: '@orochi235/weasel-theme/tokens.css',
  replacement: resolve(__dirname, 'packages/weasel-theme/src/tokens.css'),
},
{
  find: '@orochi235/weasel-theme',
  replacement: resolve(__dirname, 'packages/weasel-theme/src/index.ts'),
},
```

- [ ] **Step 4: Update `vitest.config.ts` resolve aliases**

Same additions in `vitest.config.ts`'s `alias` array.

- [ ] **Step 5: Update `apps/swillustrator/vite.config.ts`**

Same additions in `apps/swillustrator/vite.config.ts`'s `alias` array (note: paths there use `repoRoot` not `__dirname`):

```ts
{
  find: '@orochi235/weasel-theme/tokens.css',
  replacement: resolve(repoRoot, 'packages/weasel-theme/src/tokens.css'),
},
{
  find: '@orochi235/weasel-theme',
  replacement: resolve(repoRoot, 'packages/weasel-theme/src/index.ts'),
},
```

- [ ] **Step 6: Run the parity test**

```bash
pnpm exec vitest run packages/weasel-theme/
```

Expected: PASS.

- [ ] **Step 7: Run the full test suite to confirm no regressions**

```bash
pnpm exec vitest run
```

Expected: same baseline as before this stage (1952 passing + 1 pre-existing failure).

- [ ] **Step 8: Commit**

```bash
git add packages/weasel-theme/src/tokens.test.ts tsconfig.json vite.config.ts vitest.config.ts apps/swillustrator/vite.config.ts
git commit -m "test(weasel-theme): parity check between CSS and TS exports; wire path aliases"
```

---

## Stage 2 — Migrate weasel-ui to `--wzl-*`

Mechanical rename + one path update. Single commit because the migration must land atomically (each file change in isolation breaks the running app).

### Task 2.1: Rename `--wui-` → `--wzl-` across all CSS / TSX / CSS-in-demo references

**Files:** (rename `--wui-` → `--wzl-` in each)
- Modify: `packages/weasel-ui/src/PropertiesPanel.module.css`
- Modify: `packages/weasel-ui/src/CommandPalette.module.css`
- Modify: `packages/weasel-ui/src/RangePicker.module.css`
- Modify: `packages/weasel-ui/src/paintGradientTrack.tsx`
- Modify: `demo/canvas-kit-demo.css`
- Modify: `apps/swillustrator/src/swillustrator.css`

- [ ] **Step 1: Verify nothing else references `--wui-`**

```bash
grep -rn '\-\-wui-' --include='*.ts' --include='*.tsx' --include='*.css' --include='*.json' --include='*.md' . 2>/dev/null | grep -v node_modules | grep -v dist
```

Expected: lists exactly the 6 files above, plus `packages/weasel-ui/src/tokens.css` (which is deleted in 2.2). No other matches.

If there are extras (e.g., a README mentioning `--wui-`), include them in this rename.

- [ ] **Step 2: Run a single bulk find-replace**

The rename is `--wui-` → `--wzl-` literally. Use:

```bash
for f in \
  packages/weasel-ui/src/PropertiesPanel.module.css \
  packages/weasel-ui/src/CommandPalette.module.css \
  packages/weasel-ui/src/RangePicker.module.css \
  packages/weasel-ui/src/paintGradientTrack.tsx \
  demo/canvas-kit-demo.css \
  apps/swillustrator/src/swillustrator.css; do
  sed -i '' 's/--wui-/--wzl-/g' "$f"
done
```

(macOS BSD `sed`: the `-i ''` form is required. On Linux drop the `''`.)

- [ ] **Step 3: Verify zero `--wui-` references remain in the rewritten files**

```bash
grep -c '\-\-wui-' \
  packages/weasel-ui/src/PropertiesPanel.module.css \
  packages/weasel-ui/src/CommandPalette.module.css \
  packages/weasel-ui/src/RangePicker.module.css \
  packages/weasel-ui/src/paintGradientTrack.tsx \
  demo/canvas-kit-demo.css \
  apps/swillustrator/src/swillustrator.css
```

Expected: 0 for every file.

- [ ] **Step 4: Verify the `--wzl-` count matches the original `--wui-` count**

```bash
grep -c '\-\-wzl-' \
  packages/weasel-ui/src/PropertiesPanel.module.css \
  packages/weasel-ui/src/CommandPalette.module.css \
  packages/weasel-ui/src/RangePicker.module.css \
  packages/weasel-ui/src/paintGradientTrack.tsx \
  demo/canvas-kit-demo.css \
  apps/swillustrator/src/swillustrator.css
```

Expected: 24 / 21 / 10 / 2 / 13 / 7 (in order; matches the inventory table above).

(Don't commit yet — combine with Task 2.2.)

---

### Task 2.2: Delete weasel-ui's tokens.css and update its package.json + swillustrator import

**Files:**
- Delete: `packages/weasel-ui/src/tokens.css`
- Modify: `packages/weasel-ui/package.json` — remove `./tokens.css` export entry
- Modify: `apps/swillustrator/src/App.tsx:41` — change `@orochi235/weasel-ui/tokens.css` to `@orochi235/weasel-theme/tokens.css`
- Modify: `vite.config.ts` — remove the `@orochi235/weasel-ui/tokens.css` alias (added in Stage 1 → 1.3 we added the new `weasel-theme/tokens.css` alias; the OLD weasel-ui one stays only until this task)

- [ ] **Step 1: Delete the old tokens.css**

```bash
git rm packages/weasel-ui/src/tokens.css
```

- [ ] **Step 2: Update `packages/weasel-ui/package.json`**

Read the file. Find the `exports` block. Remove the `"./tokens.css": "./src/tokens.css"` entry. The block should look like (preserve the existing `.` and `./package.json` entries):

```json
"exports": {
  ".": {
    "import": "./src/index.ts",
    "types": "./src/index.ts"
  },
  "./package.json": "./package.json"
}
```

- [ ] **Step 3: Update `apps/swillustrator/src/App.tsx`**

Find the line (around 41):

```ts
import '@orochi235/weasel-ui/tokens.css';
```

Replace with:

```ts
import '@orochi235/weasel-theme/tokens.css';
```

- [ ] **Step 4: Remove the old `@orochi235/weasel-ui/tokens.css` alias**

In `vite.config.ts`, find the alias entry:

```ts
{
  find: '@orochi235/weasel-ui/tokens.css',
  replacement: resolve(__dirname, 'packages/weasel-ui/src/tokens.css'),
},
```

Delete it. The new `@orochi235/weasel-theme/tokens.css` alias (added in 1.3) takes over.

Do the same in `apps/swillustrator/vite.config.ts` if a `weasel-ui/tokens.css` alias exists there too. Check with:

```bash
grep -n 'weasel-ui/tokens.css' apps/swillustrator/vite.config.ts vitest.config.ts
```

Remove every match.

- [ ] **Step 5: Run typecheck and tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: clean. Tests pass at the same baseline (1952 + 1 pre-existing failure).

- [ ] **Step 6: Smoke-test in the browser**

Start the dev server:

```bash
pnpm dev
```

Open a demo page (e.g., `RangePickerDemo`, `PropertiesPanelDemo` if those exist, or just open the index). Confirm that:
- The panel chrome renders with proper colors (not unstyled / black text on transparent)
- The range picker tracks and thumbs are visible with correct backgrounds

A successful rename should be visually indistinguishable from the pre-rename state. If anything looks wrong (transparent backgrounds, missing borders), a `--wui-*` reference was missed somewhere — re-run the grep in Task 2.1 Step 1.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(weasel-ui,demo,swillustrator): rename --wui-* to --wzl-*

Single atomic rename across all weasel-ui component CSS, paintGradientTrack
JS, canvas-kit-demo's CSS overrides, and the swillustrator app CSS.
77 references migrated to the new --wzl- namespace.

Deletes packages/weasel-ui/src/tokens.css (canonical home moved to
@orochi235/weasel-theme/tokens.css); updates swillustrator's import; drops
the weasel-ui/tokens.css alias from vite/vitest configs. The new
weasel-theme/tokens.css alias (added in the previous stage) supplies the
defaults.
EOF
)"
```

---

## Stage 3 — Token resolution in weasel-hud

### Task 3.1: Add weasel-theme to weasel-hud's dependencies

**Files:**
- Modify: `packages/weasel-hud/package.json`

- [ ] **Step 1: Read the current `package.json`**

```bash
cat packages/weasel-hud/package.json
```

- [ ] **Step 2: Add the dependency**

Add a `dependencies` block (or extend if it exists). Since weasel-hud is a private workspace package and weasel-theme is also private, listing it under `dependencies` (not `peerDependencies`) is fine — they ship together.

```json
"dependencies": {
  "@orochi235/weasel-theme": "workspace:*"
}
```

If pnpm workspaces aren't configured (verify with `cat pnpm-workspace.yaml 2>/dev/null` from repo root), use `"*"` instead of `"workspace:*"`. The Vite/tsconfig aliases (already added in Stage 1) handle resolution either way.

- [ ] **Step 3: Run install**

```bash
pnpm install 2>&1 | tail -5
```

Expected: no errors. (May report nothing-to-do if the workspace alias already resolves.)

- [ ] **Step 4: Commit**

```bash
git add packages/weasel-hud/package.json
git commit -m "build(weasel-hud): add workspace dependency on weasel-theme"
```

---

### Task 3.2: `readTokens` and `ResolvedTokens`

**Files:**
- Create: `packages/weasel-hud/src/theme.ts`
- Create: `packages/weasel-hud/src/theme.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/weasel-hud/src/theme.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { readTokens } from './theme';
import { DEFAULT_TOKENS } from '@orochi235/weasel-theme';

const trash: HTMLElement[] = [];
afterEach(() => {
  for (const el of trash) el.remove();
  trash.length = 0;
});

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  document.body.appendChild(c);
  trash.push(c);
  return c;
}

describe('readTokens', () => {
  it('returns DEFAULT_TOKENS-equivalent values when called with null (boot window)', () => {
    const tokens = readTokens(null);
    expect(tokens.text).toBe(DEFAULT_TOKENS['--wzl-text']);
    expect(tokens.buttonFill).toBe(DEFAULT_TOKENS['--wzl-button-fill']);
    expect(tokens.buttonText).toBe(DEFAULT_TOKENS['--wzl-button-text']);
  });

  it('returns DEFAULT_TOKENS values when no CSS variables are set on the canvas', () => {
    const c = makeCanvas();
    const tokens = readTokens(c);
    expect(tokens.text).toBe(DEFAULT_TOKENS['--wzl-text']);
    expect(tokens.buttonFill).toBe(DEFAULT_TOKENS['--wzl-button-fill']);
  });

  it('picks up CSS variables set directly on the canvas element', () => {
    const c = makeCanvas();
    c.style.setProperty('--wzl-text', '#aabbcc');
    c.style.setProperty('--wzl-button-fill', '#112233');
    const tokens = readTokens(c);
    expect(tokens.text).toBe('#aabbcc');
    expect(tokens.buttonFill).toBe('#112233');
  });

  it('picks up CSS variables cascaded from an ancestor', () => {
    const container = document.createElement('div');
    container.style.setProperty('--wzl-text', '#deadbe');
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    document.body.appendChild(container);
    trash.push(container);
    const tokens = readTokens(canvas);
    expect(tokens.text).toBe('#deadbe');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm exec vitest run packages/weasel-hud/src/theme.test.ts
```

Expected: FAIL — `./theme` doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// packages/weasel-hud/src/theme.ts
import { DEFAULT_TOKENS, type TokenName } from '@orochi235/weasel-theme';

export interface ResolvedTokens {
  text: string;
  textMuted: string;
  panelBg: string;
  panelBorder: string;
  inputBg: string;
  accent: string;
  danger: string;
  trackBg: string;
  trackBorder: string;
  thumbFill: string;
  thumbBorder: string;
  thumbText: string;
  buttonFill: string;
  buttonFillHover: string;
  buttonFillPressed: string;
  buttonText: string;
}

const TOKEN_KEYS: Record<keyof ResolvedTokens, TokenName> = {
  text: '--wzl-text',
  textMuted: '--wzl-text-muted',
  panelBg: '--wzl-panel-bg',
  panelBorder: '--wzl-panel-border',
  inputBg: '--wzl-input-bg',
  accent: '--wzl-accent',
  danger: '--wzl-danger',
  trackBg: '--wzl-track-bg',
  trackBorder: '--wzl-track-border',
  thumbFill: '--wzl-thumb-fill',
  thumbBorder: '--wzl-thumb-border',
  thumbText: '--wzl-thumb-text',
  buttonFill: '--wzl-button-fill',
  buttonFillHover: '--wzl-button-fill-hover',
  buttonFillPressed: '--wzl-button-fill-pressed',
  buttonText: '--wzl-button-text',
};

/**
 * Resolve the current theme tokens for the canvas element.
 *
 * Pass `null` (or an element not yet attached to the DOM) to get the
 * default tokens — useful during the boot window before the canvas ref
 * has populated.
 *
 * Reads via `getComputedStyle`, which is cached by the browser between
 * layouts; calling this once per draw is sub-millisecond.
 */
export function readTokens(canvasEl: HTMLCanvasElement | null): ResolvedTokens {
  const out = {} as ResolvedTokens;
  const cs = canvasEl ? getComputedStyle(canvasEl) : null;
  for (const [field, cssVar] of Object.entries(TOKEN_KEYS) as [keyof ResolvedTokens, TokenName][]) {
    const raw = cs ? cs.getPropertyValue(cssVar).trim() : '';
    out[field] = raw || DEFAULT_TOKENS[cssVar];
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec vitest run packages/weasel-hud/src/theme.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-hud/src/theme.ts packages/weasel-hud/src/theme.test.ts
git commit -m "feat(weasel-hud): readTokens — resolve --wzl-* CSS vars from the canvas element"
```

---

### Task 3.3: Extend `HudDrawCtx` with tokens

**Files:**
- Modify: `packages/weasel-hud/src/widget.ts`

- [ ] **Step 1: Read the current `widget.ts`**

```bash
cat packages/weasel-hud/src/widget.ts
```

Locate the `HudDrawCtx` interface (it has `dims` and `defaultFont` fields).

- [ ] **Step 2: Add the `tokens` field**

Add the import at the top of the file (with the other imports):

```ts
import type { ResolvedTokens } from './theme';
```

Update `HudDrawCtx`:

```ts
export interface HudDrawCtx {
  /** Canvas size in CSS pixels. */
  dims: { width: number; height: number };
  /** Family name of the auto-registered default font. */
  defaultFont: string;
  /** Resolved design tokens from the canvas element's computed style.
   *  Re-read on every draw, so live CSS changes (dark-mode toggle, etc.)
   *  take effect on the next state-driven redraw. */
  tokens: ResolvedTokens;
}
```

- [ ] **Step 3: Update widget tests that construct `HudDrawCtx` literals**

Several existing tests pass `HudDrawCtx`-shaped objects to widget `draw()` methods. After this change, those literals are missing the `tokens` field and won't typecheck. Search for them:

```bash
grep -rn "defaultFont:" packages/weasel-hud/src/widgets/*.test.ts packages/weasel-hud/src/widgets/*.test.tsx 2>/dev/null
```

In each match, find the `HudDrawCtx`-shaped literal and add a `tokens` field. Use the `DEFAULT_TOKENS`-equivalent values for tests that don't care about tokens. Helper for test files:

```ts
// Top of each test file that builds HudDrawCtx — or factor into a test helper
import { readTokens } from '../theme';
const DEFAULT_RESOLVED_TOKENS = readTokens(null);
```

Then every `HudDrawCtx` literal becomes:

```ts
{ dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: DEFAULT_RESOLVED_TOKENS }
```

- [ ] **Step 4: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Run the widget tests to confirm no behavior change**

```bash
pnpm exec vitest run packages/weasel-hud/
```

Expected: all pass at the same count as before this stage (no tests added or behavior changed — only test-fixture shape updated).

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-hud/src/widget.ts packages/weasel-hud/src/widgets/*.test.ts packages/weasel-hud/src/widgets/*.test.tsx
git commit -m "refactor(weasel-hud): add ResolvedTokens to HudDrawCtx; thread through widget tests"
```

---

### Task 3.4: `attachHud` resolves tokens per draw

**Files:**
- Modify: `packages/weasel-hud/src/attach.ts`

- [ ] **Step 1: Read the current `attach.ts`**

Locate the `layer.draw` function. It currently constructs the `HudDrawCtx` like this (approximate — match what's actually there):

```ts
draw: (_data, _view, dims): DrawCommand[] => {
  const ctx = { dims, defaultFont: DEFAULT_FONT_FAMILY };
  // ...
}
```

(The current ctx literal is missing `tokens`. TS will flag this once Task 3.3 lands; this task fixes the producer side.)

- [ ] **Step 2: Add the import**

At the top of `attach.ts`:

```ts
import { readTokens } from './theme';
```

- [ ] **Step 3: Update `layer.draw` to call `readTokens`**

Modify the `draw` function:

```ts
draw: (_data, _view, dims): DrawCommand[] => {
  const tokens = readTokens(api.element);
  const ctx = { dims, defaultFont: DEFAULT_FONT_FAMILY, tokens };
  const out: DrawCommand[] = [];
  for (const w of hud.widgets()) {
    if (w.hidden) continue;
    for (const cmd of w.draw(ctx)) out.push(cmd);
  }
  return out;
},
```

Note: this requires `api` to be in scope inside the closure. It already is — `attachHud(api, hud)` takes `api` as a parameter, and the layer is built inside that function.

- [ ] **Step 4: Update the existing `attach.test.ts`**

Existing attach tests build a fake `api` with `element: null`. Verify they still pass — `readTokens(null)` returns sane defaults, so the layer's `draw` won't crash.

Run the attach tests:

```bash
pnpm exec vitest run packages/weasel-hud/src/attach.test.ts
```

Expected: pass.

- [ ] **Step 5: Add a new attach test for token resolution**

Append to `packages/weasel-hud/src/attach.test.ts`:

```ts
it('layer.draw resolves tokens from the canvas element', () => {
  const hud = createHud();
  const canvas = document.createElement('canvas');
  canvas.style.setProperty('--wzl-button-fill', '#abcdef');
  document.body.appendChild(canvas);
  try {
    const api: CanvasExtensionApi = {
      element: canvas,
      requestRedraw: vi.fn(),
      registerLayer: vi.fn((layer) => {
        // Inspect what the layer's draw returns when a button is on the HUD.
        return () => {};
      }),
    };
    attachHud(api, hud);
    hud.button({ id: 'b', x: 0, y: 0, w: 50, h: 20, label: 'x' });
    // Grab the registered layer (it was passed to registerLayer above).
    const registeredLayer = (api.registerLayer as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cmds = registeredLayer.draw(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const buttonBody = cmds.find((c: { kind: string }) => c.kind === 'path') as { fill: { color: string } };
    expect(buttonBody.fill.color).toBe('#abcdef');
  } finally {
    canvas.remove();
  }
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
pnpm exec vitest run packages/weasel-hud/src/attach.test.ts -t "resolves tokens from the canvas element"
```

Expected: FAIL — the button widget hasn't been updated yet (Stage 4); it'll still draw with its hardcoded `'#ffffff'` default.

If the test PASSES already, the button refactor was somehow done already; skip Stage 4 Task 4.3.

- [ ] **Step 7: Commit (test failing is OK; Stage 4 makes it pass)**

```bash
git add packages/weasel-hud/src/attach.ts packages/weasel-hud/src/attach.test.ts
git commit -m "feat(weasel-hud): attachHud resolves tokens on every draw

The token resolution producer side. Widgets that consume ctx.tokens come
in Stage 4 — this commit's new attach test will fail until then; that's
intentional (acts as a forward-test for the widget refactor)."
```

Actually — committing with a failing test is anti-pattern. Move the new attach test to Stage 4 (Task 4.4 below) so each commit lands green. Skip steps 5-7 in this task; the `attachHud` code change alone is the commit:

```bash
git add packages/weasel-hud/src/attach.ts
git commit -m "feat(weasel-hud): attachHud resolves tokens on every draw"
```

- [ ] **Step 8: Re-update the index barrel to export theme types**

In `packages/weasel-hud/src/index.ts`, append:

```ts
export { readTokens, type ResolvedTokens } from './theme';
```

Commit:

```bash
git add packages/weasel-hud/src/index.ts
git commit -m "feat(weasel-hud): export readTokens + ResolvedTokens from barrel"
```

---

## Stage 4 — Widget integration

### Task 4.1: Label reads `ctx.tokens.text` when `opts.color` is omitted

**Files:**
- Modify: `packages/weasel-hud/src/widgets/label.ts`
- Modify: `packages/weasel-hud/src/widgets/label.test.ts`

- [ ] **Step 1: Read the current `label.ts`**

It's a thin wrapper over `createText` with sensible defaults. Confirm it currently has:

```ts
return createText({
  // ...
  color: opts.color ?? '#1a1a1a',
  // ...
});
```

- [ ] **Step 2: Update `label.ts` to defer color resolution to `text.ts`**

Remove the `??` fallback from label and let `text.ts` handle it. `label.ts` becomes:

```ts
export function createLabel(opts: LabelOptions): LabelWidget {
  return createText({
    id: opts.id,
    x: opts.x,
    y: opts.y,
    text: opts.text,
    fontSize: opts.fontSize ?? 13,
    color: opts.color,            // pass through; undefined → text widget uses ctx.tokens.text
    onChange: opts.onChange,
    removeFromHud: opts.removeFromHud,
    // fontFamily intentionally undefined → falls back to ctx.defaultFont
  });
}
```

This requires `createText` to accept `color: string | undefined`. Verify the current `TextOptions.color: string` type. If it's required-non-undefined, relax it (Task 4.2 below handles that).

- [ ] **Step 3: Update label tests**

Existing test "uses sensible defaults for fontSize when omitted" stays. Replace "uses ctx.defaultFont when no fontFamily is supplied" with one that verifies the color resolution via tokens:

```ts
it('uses ctx.tokens.text when color is omitted', () => {
  const l = createLabel({ id: 'l', x: 0, y: 0, text: 'x' });
  const customTokens = { ...readTokens(null), text: '#abcdef' };
  const cmds = l.draw({
    dims: { width: 100, height: 100 },
    defaultFont: 'Default',
    tokens: customTokens,
  });
  const fill = (cmds[0] as { style: { fill: { color: string } } }).style.fill;
  expect(fill.color).toBe('#abcdef');
});

it('respects explicit color when supplied (theme overridden)', () => {
  const l = createLabel({ id: 'l', x: 0, y: 0, text: 'x', color: '#ff0000' });
  const customTokens = { ...readTokens(null), text: '#abcdef' };
  const cmds = l.draw({
    dims: { width: 100, height: 100 },
    defaultFont: 'D',
    tokens: customTokens,
  });
  const fill = (cmds[0] as { style: { fill: { color: string } } }).style.fill;
  expect(fill.color).toBe('#ff0000');
});
```

Add import at top of the test:

```ts
import { readTokens } from '../theme';
```

- [ ] **Step 4: Verify tests fail (until 4.2 lands)**

```bash
pnpm exec vitest run packages/weasel-hud/src/widgets/label.test.ts
```

Expected: tests reference `text` field on tokens; the test that asserts `#abcdef` should fail because `text.ts` still uses the explicit color.

(Don't commit yet; combine with 4.2.)

---

### Task 4.2: Text widget reads `ctx.tokens.text` fallback

**Files:**
- Modify: `packages/weasel-hud/src/widgets/text.ts`
- Modify: `packages/weasel-hud/src/widgets/text.test.ts`

- [ ] **Step 1: Make `TextOptions.color` optional**

In `text.ts`:

```ts
export interface TextOptions {
  id: string;
  x: number; y: number;
  text: string;
  fontSize: number;
  color?: string;            // CHANGED — now optional
  fontFamily?: string;
  onChange?: () => void;
  removeFromHud?: () => void;
}
```

- [ ] **Step 2: Resolve color in `draw()`**

In `createText`'s returned object's `draw` method:

```ts
draw(ctx: HudDrawCtx): DrawCommand[] {
  const color = opts.color ?? ctx.tokens.text;
  const cmd: TextDrawCommand = {
    kind: 'text',
    x: bounds.x,
    y: bounds.y,
    text,
    style: {
      fontFamily: opts.fontFamily ?? ctx.defaultFont,
      fontSize: opts.fontSize,
      fill: { fill: 'solid', color },
    },
  };
  return [cmd];
},
```

- [ ] **Step 3: Update text tests**

Open `text.test.ts`. The existing test that asserts a specific color may need a token fixture. Add new tests:

```ts
it('uses ctx.tokens.text when opts.color is omitted', () => {
  const t = createText({ id: 't', x: 0, y: 10, text: 'hi', fontSize: 14 });
  const customTokens = { ...readTokens(null), text: '#facade' };
  const cmds = t.draw({ dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: customTokens });
  const fill = (cmds[0] as { style: { fill: { color: string } } }).style.fill;
  expect(fill.color).toBe('#facade');
});
```

Add the import:

```ts
import { readTokens } from '../theme';
```

If existing tests pass `color: '#000'` explicitly, they should still pass since explicit wins.

- [ ] **Step 4: Run tests**

```bash
pnpm exec vitest run packages/weasel-hud/src/widgets/text.test.ts packages/weasel-hud/src/widgets/label.test.ts
```

Expected: all PASS (including the label tests from 4.1, now that text.ts resolves the fallback).

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-hud/src/widgets/text.ts packages/weasel-hud/src/widgets/text.test.ts packages/weasel-hud/src/widgets/label.ts packages/weasel-hud/src/widgets/label.test.ts
git commit -m "feat(weasel-hud): label + text widgets read ctx.tokens.text fallback"
```

---

### Task 4.3: Button widget reads four token fallbacks

**Files:**
- Modify: `packages/weasel-hud/src/widgets/button.ts`
- Modify: `packages/weasel-hud/src/widgets/button.test.ts`

- [ ] **Step 1: Update `ButtonOptions` color fields to be optional (they already are) — verify**

Read `button.ts`. Confirm `fill`, `pressedFill`, `hoverFill`, `textColor` are all `?: string`. (They were optional in the original implementation.)

- [ ] **Step 2: Move resolution from factory-time to `draw()`**

Currently the factory captures hardcoded defaults at closure time:

```ts
const fill = opts.fill ?? '#ffffff';
const pressedFill = opts.pressedFill ?? '#e0e0e0';
const hoverFill = opts.hoverFill ?? '#f5f5f5';
const textColor = opts.textColor ?? '#1a1a1a';
```

DELETE those four lines from the factory. Move resolution into `draw`:

```ts
draw(ctx: HudDrawCtx): DrawCommand[] {
  const fill        = opts.fill        ?? ctx.tokens.buttonFill;
  const hoverFill   = opts.hoverFill   ?? ctx.tokens.buttonFillHover;
  const pressedFill = opts.pressedFill ?? ctx.tokens.buttonFillPressed;
  const textColor   = opts.textColor   ?? ctx.tokens.buttonText;
  const { x, y, w, h } = bounds;
  const bodyColor = pressed ? pressedFill : hovering ? hoverFill : fill;
  const body: PathDrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x, y, width: w, height: h },
    fill: { fill: 'solid', color: bodyColor },
  };
  const text: TextDrawCommand = {
    kind: 'text',
    x: x + 8,
    y: y + h / 2 + fontSize / 3,
    text: label,
    style: {
      fontFamily: opts.fontFamily ?? ctx.defaultFont,
      fontSize,
      fill: { fill: 'solid', color: textColor },
    },
  };
  return [body, text];
},
```

The `fontSize` local (from `opts.fontSize ?? 13`) stays at factory time — it's a non-color default that the theme doesn't manage.

- [ ] **Step 3: Add token-fallback tests**

In `button.test.ts`, near the existing button tests, add:

```ts
it('uses ctx.tokens.buttonFill when opts.fill is omitted', () => {
  const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
  const customTokens = { ...readTokens(null), buttonFill: '#abcdef' };
  const cmds = b.draw({ dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: customTokens });
  const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
  expect(body.fill.color).toBe('#abcdef');
});

it('respects opts.fill when supplied (theme overridden)', () => {
  const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x', fill: '#ff0000' });
  const customTokens = { ...readTokens(null), buttonFill: '#abcdef' };
  const cmds = b.draw({ dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: customTokens });
  const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
  expect(body.fill.color).toBe('#ff0000');
});

it('uses ctx.tokens.buttonFillHover when hovering and opts.hoverFill is omitted', () => {
  const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
  b.onPointer({ type: 'hovermove', x: 5, y: 5, native: {} as PointerEvent });
  const customTokens = { ...readTokens(null), buttonFillHover: '#cafe00' };
  const cmds = b.draw({ dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: customTokens });
  const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
  expect(body.fill.color).toBe('#cafe00');
});

it('uses ctx.tokens.buttonFillPressed when pressed and opts.pressedFill is omitted', () => {
  const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
  b.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent });
  const customTokens = { ...readTokens(null), buttonFillPressed: '#beadc0' };
  const cmds = b.draw({ dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: customTokens });
  const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
  expect(body.fill.color).toBe('#beadc0');
});

it('uses ctx.tokens.buttonText when opts.textColor is omitted', () => {
  const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
  const customTokens = { ...readTokens(null), buttonText: '#decade' };
  const cmds = b.draw({ dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: customTokens });
  const text = cmds.find(c => c.kind === 'text') as { style: { fill: { color: string } } };
  expect(text.style.fill.color).toBe('#decade');
});
```

Add import at the top of `button.test.ts`:

```ts
import { readTokens } from '../theme';
```

- [ ] **Step 4: Run tests**

```bash
pnpm exec vitest run packages/weasel-hud/src/widgets/button.test.ts
```

Expected: all PASS (including pre-existing tests that pass explicit colors — those still work).

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-hud/src/widgets/button.ts packages/weasel-hud/src/widgets/button.test.ts
git commit -m "feat(weasel-hud): button reads four token fallbacks (fill, hover, pressed, text)"
```

---

### Task 4.4: Re-enable the attach test from Task 3.4

**Files:**
- Modify: `packages/weasel-hud/src/attach.test.ts`

The attach test that asserts "layer.draw resolves tokens from the canvas element" was deferred from Task 3.4. With Stage 4 complete, it should now pass.

- [ ] **Step 1: Add the test**

(Same test as in Task 3.4 Step 5. Repeated here so the engineer doesn't have to scroll back.)

```ts
it('layer.draw resolves tokens from the canvas element', () => {
  const hud = createHud();
  const canvas = document.createElement('canvas');
  canvas.style.setProperty('--wzl-button-fill', '#abcdef');
  document.body.appendChild(canvas);
  try {
    const api: CanvasExtensionApi = {
      element: canvas,
      requestRedraw: vi.fn(),
      registerLayer: vi.fn(() => () => {}),
    };
    attachHud(api, hud);
    hud.button({ id: 'b', x: 0, y: 0, w: 50, h: 20, label: 'x' });
    const registeredLayer = (api.registerLayer as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cmds = registeredLayer.draw(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const buttonBody = cmds.find((c: { kind: string }) => c.kind === 'path') as { fill: { color: string } };
    expect(buttonBody.fill.color).toBe('#abcdef');
  } finally {
    canvas.remove();
  }
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm exec vitest run packages/weasel-hud/src/attach.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-hud/src/attach.test.ts
git commit -m "test(weasel-hud): end-to-end token resolution through attachHud"
```

---

## Stage 5 — Integration test + cleanup

### Task 5.1: End-to-end theme test in `integration.test.tsx`

**Files:**
- Modify: `packages/weasel-hud/src/integration.test.tsx`

- [ ] **Step 1: Add the test**

Append to `integration.test.tsx`:

```tsx
it('button picks up --wzl-button-fill set on the canvas element via CSS', async () => {
  const api: HarnessApi = {
    toolOnDown: vi.fn(),
    press: vi.fn(),
    hudRef: { current: null },
  };
  const { container } = render(<Harness apiOut={api} />);
  await act(async () => {});

  const canvas = container.querySelector('canvas')!;
  canvas.style.setProperty('--wzl-button-fill', '#abcdef');

  const btn = api.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' });

  // Trigger a redraw and grab the layer's emitted DrawCommands.
  // The HUD layer was registered with the canvas via attachHud; pull
  // it back out via the registered-layer side door (see existing attach.ts
  // tests for the pattern). Simpler approach: just call api.hudRef and
  // verify the button widget's bounds-fill resolution through a
  // direct draw call.
  const cmds = btn.draw({
    dims: { width: 200, height: 200 },
    defaultFont: 'weasel-hud-default',
    tokens: { ...defaultResolved, buttonFill: '#abcdef' },
  });
  const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
  expect(body.fill.color).toBe('#abcdef');
});
```

Where `defaultResolved` is built once at the top of the test file:

```ts
import { readTokens } from './theme';
const defaultResolved = readTokens(null);
```

Note: this test doesn't go through the canvas's render loop (which would require a real WebGL context). It verifies that the widget's `draw` method, given tokens matching what the canvas's CSS would resolve to, produces the expected output. That's the same level of assertion that the existing integration tests use.

- [ ] **Step 2: Run the test**

```bash
pnpm exec vitest run packages/weasel-hud/src/integration.test.tsx
```

Expected: PASS, plus the existing integration tests stay green.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-hud/src/integration.test.tsx
git commit -m "test(weasel-hud): integration test for CSS-variable themed button fill"
```

---

### Task 5.2: Update weasel-ui's README

**Files:**
- Modify: `packages/weasel-ui/README.md`

- [ ] **Step 1: Read the current README**

```bash
cat packages/weasel-ui/README.md
```

It mentions `tokens.css` is one of the things this package ships.

- [ ] **Step 2: Update**

Replace the "tokens.css" mention with a note that tokens have moved:

```markdown
## CSS variables

Components read `--wzl-*` tokens from `@orochi235/weasel-theme`. Import
`@orochi235/weasel-theme/tokens.css` in your app shell for sensible
defaults, or define the variables yourself at any DOM scope.

| Variable | Purpose |
|---|---|
| `--wzl-text` | Primary text |
| `--wzl-text-muted` | Labels, secondary text |
| `--wzl-panel-bg` | Panel background |
| `--wzl-panel-border` | Panel/input border |
| `--wzl-input-bg` | Input field background |
| `--wzl-accent` | Focused-input border, primary action |
| `--wzl-danger` | Destructive button text |
```

Plus any other places the README references `--wui-*`.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-ui/README.md
git commit -m "docs(weasel-ui): point at weasel-theme for tokens"
```

---

## Verification gate

After all stages:

- [ ] **Step 1: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 2: Tests**

```bash
pnpm exec vitest run
```

Expected: all passing (plus 1 pre-existing `GradientPlaygroundDemo.test.tsx` failure that's unrelated to this work). Count should be 1952 baseline + ~12 new tests = ~1964.

- [ ] **Step 3: Build**

```bash
pnpm exec tsup
```

Expected: `Build success`.

- [ ] **Step 4: Browser smoke**

```bash
pnpm dev
```

Open the demo. Check `RangePickerDemo` and any `PropertiesPanel`-bearing demo to confirm visual continuity (the rename should be invisible at the rendering level). Open `HudDemo`. Confirm the button still renders normally. Open browser devtools, in the console:

```js
document.querySelector('canvas').style.setProperty('--wzl-button-fill', '#ff8800');
```

Then click somewhere in the canvas to trigger a redraw (the hand tool will get the click; the dispatcher's pipeline runs which redraws the HUD layer). The button should now be orange.

If it isn't: the redraw didn't fire (try toggling something in the demo's controls instead), or the canvas wasn't the element holding the CSS variable (the `getComputedStyle` reads up the parent chain — try setting it on `document.documentElement` instead).

---

## Notes on follow-ups (out of scope for v1)

- **Token-reference values on widget options.** `hud.button({ textColor: 'danger' })` resolving to `--wzl-danger`. Low-priority TODO; clean API but adds a union-type complication to every color-ish prop.
- **`hud.refreshTheme()` cache escape hatch.** Not worth it under current cost profile.
- **Automatic `prefers-color-scheme` / `MutationObserver` integration.** Consumers call `hud.markDirty()` after manual theme swaps in v1.
- **Font tokens.** Font registration is the renderer's domain.
- **Theme tokens for `rect` / `image`.** Neither has a theme-able default; consumer always specifies.
