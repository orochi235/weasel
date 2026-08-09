# DTCG Token Source of Truth — Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DTCG JSON the single hand-edited source for every `--wzl-*` design token, with one generator producing the CSS, the TS objects, the `TokenName` union, and the Storybook manifest — and bundle the two OFL fonts instead of fetching them from Google.

**Architecture:** `packages/theme/tokens/weasel/` holds DTCG files (primitives + one semantic layer per mode). A pure resolver in `packages/theme/src/dtcg/` flattens, merges, resolves `{refs}`, and applies our one custom extension. A build script drives the resolver and writes three committed artifacts into `packages/theme/src/generated/`. Nothing else in the repo hand-maintains a token list. Rendering is unchanged at the end of this plan — no consumer migrates yet.

**Tech Stack:** TypeScript, Node 22+ (native type stripping — the repo already runs `node script.ts` for `gen:font`), Vitest, tsup. No new runtime dependencies; no new dev dependencies.

**Spec:** `docs/superpowers/specs/2026-08-08-dtcg-pluggable-theming-design.md` (§1, §2, §8). Plan B covers the runtime API, the alias migration, and the HUD bridge. Plan C covers labkit convergence.

---

## Prerequisites

- `pyftsubset` on PATH (verified present at `/opt/homebrew/bin/pyftsubset`). Used once, in Task 2.
- Network access for one download in Task 1 (the upstream Oswald release).

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `packages/theme/fonts/oswald-latin-variable.woff2` | UI/display face, vendored |
| `packages/theme/fonts/inter-latin.woff2` | Body face, vendored |
| `packages/theme/fonts/OFL-Oswald.txt` | Oswald's license, as OFL requires |
| `packages/theme/fonts/OFL-Inter.txt` | Inter's license |
| `packages/theme/fonts/README.md` | Provenance — exact subsetting commands |
| `packages/theme/NOTICE` | Names the bundled OFL fonts |
| `packages/labkit/LICENSE` | Currently missing entirely |
| `packages/theme/src/fonts.css` | `@font-face` rules; opt-in side-effect entry |
| `packages/theme/tokens/weasel/theme.json` | Theme manifest: name, modes, `color-scheme` per mode |
| `packages/theme/tokens/weasel/primitives.tokens.json` | Mode-invariant tokens |
| `packages/theme/tokens/weasel/modes/dark.tokens.json` | The 10 mode-varying semantics |
| `packages/theme/tokens/weasel/modes/light.tokens.json` | Same 10, light values |
| `packages/theme/src/dtcg/types.ts` | DTCG shapes + our one `$extensions` key |
| `packages/theme/src/dtcg/flatten.ts` | Typed-group JSON → flat `Record<name, RawToken>` |
| `packages/theme/src/dtcg/resolve.ts` | Merge modes, resolve refs, apply alpha |
| `packages/theme/src/dtcg/color.ts` | `hexToRgba` |
| `packages/theme/scripts/build-tokens.ts` | Emits the three generated artifacts |
| `packages/theme/src/generated/tokens.css` | Generated — replaces the hand-written one |
| `packages/theme/src/generated/themes.ts` | Generated — replaces `DEFAULT_TOKENS` |
| `packages/theme/src/generated/manifest.ts` | Generated — replaces the Storybook Vite plugin |

**Modified:** `packages/theme/package.json`, `packages/theme/src/index.ts`, `packages/theme/README.md`, `packages/labkit/package.json`, `packages/labkit/src/theme/base.less`, `.storybook/main.ts`, `.storybook/addons/css-vars/preview.tsx`, `packages/ui/.storybook/main.ts`, `vitest.config.ts`, `vite.config.ts`, `apps/draw/vite.config.ts`, `tsconfig.json`, `packages/labkit/tsconfig.dts.json`, `docs/TODO.md`, `docs/conventions.md`.

**Deleted:** `packages/theme/src/tokens.css`, `packages/theme/src/tokens.ts`, `packages/theme/src/tokens.test.ts`, `scripts/vite-plugin-weasel-tokens.ts`, `.storybook/addons/css-vars/virtual.d.ts`, `packages/labkit/src/fonts/oswald-latin-variable.woff2`.

## Naming Rule (read before Task 4)

The DTCG file groups tokens **by `$type` only**. The type group carries `$type`
for its children and contributes nothing to the name:

```
color.fg-muted   →  --wzl-fg-muted
dimension.radius-sm  →  --wzl-radius-sm
```

CSS name = `--wzl-` + the leaf key, verbatim. Reference syntax uses the full
DTCG path including the type group: `{color.gray-300}`.

This exists because the current names don't nest cleanly — `--wzl-accent` and
`--wzl-accent-base` are both real, distinct tokens, and DTCG forbids a token
that is also a group. Flat leaf keys inside typed groups give exact parity with
today's 72 names and need no mapping table.

---

## Task 1: Vendor Oswald, fix the labkit compliance gap

`packages/labkit` publishes `oswald-latin-variable.woff2` in both `src/` and
`dist/` with no `LICENSE`, no `OFL.txt`, and no attribution. This task fixes
that and single-sources the font. Follow the convention already set by
`assets/fonts/inter/` — font file + `LICENSE.txt` + `README.md` with a
Provenance section giving the exact command.

**Files:**
- Create: `packages/theme/fonts/oswald-latin-variable.woff2`
- Create: `packages/theme/fonts/OFL-Oswald.txt`
- Create: `packages/theme/fonts/README.md`
- Create: `packages/labkit/LICENSE`
- Delete: `packages/labkit/src/fonts/oswald-latin-variable.woff2`

- [ ] **Step 1: Fetch upstream Oswald and its license**

The existing labkit copy has no recorded provenance, so re-derive it rather
than moving a file of unknown origin.

```bash
cd /Users/mike/src/weasel
mkdir -p packages/theme/fonts /tmp/oswald
curl -sL -o /tmp/oswald/Oswald.ttf \
  https://raw.githubusercontent.com/googlefonts/OswaldFont/main/fonts/ttf/Oswald%5Bwght%5D.ttf
curl -sL -o packages/theme/fonts/OFL-Oswald.txt \
  https://raw.githubusercontent.com/googlefonts/OswaldFont/main/OFL.txt
head -3 packages/theme/fonts/OFL-Oswald.txt
```

Expected: the copyright line
`Copyright 2016 The Oswald Project Authors (https://github.com/googlefonts/OswaldFont)`.
Confirm there is **no** "with Reserved Font Name" clause — there isn't one, which
is why subsetting below is allowed to keep the name Oswald.

- [ ] **Step 2: Subset to Latin, variable weight, woff2**

```bash
pyftsubset /tmp/oswald/Oswald.ttf \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --layout-features="kern" \
  --no-hinting \
  --flavor=woff2 \
  --output-file=packages/theme/fonts/oswald-latin-variable.woff2
ls -l packages/theme/fonts/oswald-latin-variable.woff2
```

Expected: a file in the 25–35 kB range. The unicode range is Google Fonts'
standard `latin` subset.

- [ ] **Step 3: Write the provenance README**

Create `packages/theme/fonts/README.md`:

```markdown
# Bundled fonts

Two OFL-1.1 faces, vendored so the kit never fetches a stylesheet from a
third-party host at runtime.

| file | token | role |
|---|---|---|
| `oswald-latin-variable.woff2` | `--wzl-font-ui`, `--wzl-font-display` | condensed UI/display face |
| `inter-latin.woff2` | `--wzl-font-body` | body/prose face |

Loading them is opt-in: `import '@weasel-js/theme/fonts.css'`. Skip it and the
token font stacks fall back to `system-ui`.

## Provenance — Oswald

Upstream `fonts/ttf/Oswald[wght].ttf` from
https://github.com/googlefonts/OswaldFont, subset to the Google Fonts `latin`
range:

```sh
pyftsubset "Oswald[wght].ttf" \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --layout-features="kern" \
  --no-hinting \
  --flavor=woff2 \
  --output-file=oswald-latin-variable.woff2
```

Variable weight axis is preserved (`font-weight: 200 700`). `--no-hinting`
matches the treatment of `assets/fonts/inter/inter.ttf`; nothing in the kit
reads hints.

Oswald's OFL notice carries **no Reserved Font Name**, so a subset may keep the
family name.

## Provenance — Inter

Re-flavored from `assets/fonts/inter/inter.ttf`, which is already Inter v4.1
`Inter-Regular.ttf` subset to U+0020–00FF and de-hinted (see that directory's
README for the original command):

```sh
pyftsubset assets/fonts/inter/inter.ttf \
  --unicodes="U+0020-00FF" \
  --layout-features="kern" \
  --no-hinting \
  --flavor=woff2 \
  --output-file=inter-latin.woff2
```

## License

Both faces are SIL Open Font License 1.1 — `OFL-Oswald.txt` and `OFL-Inter.txt`,
redistributed with the fonts as the license requires. The OFL covers these font
binaries only; the package's code is MIT (see `../LICENSE`).
```

- [ ] **Step 4: Give labkit the LICENSE it is missing**

Every other package has one; labkit is the only exception, and it currently
publishes a font with no license file of any kind.

```bash
cp packages/theme/LICENSE packages/labkit/LICENSE
node -e "const p=require('./packages/labkit/package.json'); console.log(p.files)"
```

Expected: `[ 'dist', 'src', 'README.md' ]` — note `LICENSE` is not listed. npm
always includes `LICENSE` regardless of `files`, so no change is needed there.

- [ ] **Step 5: Delete labkit's unsourced copy**

```bash
git rm packages/labkit/src/fonts/oswald-latin-variable.woff2
```

labkit's `build:fonts` script and `base.less` still reference it; Task 3 repoints
them. The build is briefly broken between here and Task 3 — that is fine within
a task sequence, and Step 6 does not run the labkit build.

- [ ] **Step 6: Commit**

```bash
git add packages/theme/fonts packages/labkit/LICENSE
git commit -m "feat(theme): vendor Oswald, add labkit LICENSE

labkit published oswald-latin-variable.woff2 in src/ and dist/ with no
LICENSE, no OFL.txt, and no attribution. Re-derives the subset from
upstream with a recorded command, following the assets/fonts/inter
convention, and adds the LICENSE file labkit never had."
```

---

## Task 2: Vendor Inter as a webfont

**Files:**
- Create: `packages/theme/fonts/inter-latin.woff2`
- Create: `packages/theme/fonts/OFL-Inter.txt`

- [ ] **Step 1: Re-flavor the existing subset**

`assets/fonts/inter/inter.ttf` is already Inter v4.1 Regular subset to
U+0020–00FF and de-hinted. Only the container format changes.

```bash
cd /Users/mike/src/weasel
pyftsubset assets/fonts/inter/inter.ttf \
  --unicodes="U+0020-00FF" \
  --layout-features="kern" \
  --no-hinting \
  --flavor=woff2 \
  --output-file=packages/theme/fonts/inter-latin.woff2
cp assets/fonts/inter/LICENSE.txt packages/theme/fonts/OFL-Inter.txt
ls -l packages/theme/fonts/inter-latin.woff2
```

Expected: roughly 15–20 kB (woff2 compresses the 27 kB TTF).

- [ ] **Step 2: Verify it is a real woff2**

```bash
node -e "
const b = require('node:fs').readFileSync('packages/theme/fonts/inter-latin.woff2');
console.log(b.subarray(0,4).toString('latin1'));
"
```

Expected: `wOF2`

- [ ] **Step 3: Commit**

```bash
git add packages/theme/fonts/inter-latin.woff2 packages/theme/fonts/OFL-Inter.txt
git commit -m "feat(theme): vendor Inter webfont subset"
```

---

## Task 3: `fonts.css` entry, drop the Google Fonts import

**Files:**
- Create: `packages/theme/src/fonts.css`
- Create: `packages/theme/NOTICE`
- Modify: `packages/theme/src/tokens.css:10` (delete the `@import`)
- Modify: `packages/theme/package.json`
- Modify: `packages/labkit/package.json`
- Modify: `packages/labkit/src/theme/base.less`

- [ ] **Step 1: Write `packages/theme/src/fonts.css`**

```css
/* Opt-in webfont loading. Import this only if you want the kit's intended
 * faces; the token font stacks fall back to system-ui without it.
 * Licenses: ../fonts/OFL-Oswald.txt, ../fonts/OFL-Inter.txt */

@font-face {
  font-family: 'Oswald';
  font-style: normal;
  font-weight: 200 700;
  font-display: swap;
  src: url('../fonts/oswald-latin-variable.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('../fonts/inter-latin.woff2') format('woff2');
}
```

- [ ] **Step 2: Delete the remote import**

Remove line 10 of `packages/theme/src/tokens.css` entirely:

```css
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@200;300;400&display=swap');
```

- [ ] **Step 3: Verify no remote import remains anywhere**

```bash
grep -rn "fonts.googleapis.com\|fonts.gstatic.com" packages apps .storybook 2>/dev/null | grep -v node_modules | grep -v storybook-static
```

Expected: no output.

- [ ] **Step 4: Export the new entry and ship the fonts**

In `packages/theme/package.json`, add to `exports`:

```json
    "./fonts.css": "./dist/fonts.css",
```

add `"fonts"` to `files`:

```json
  "files": [
    "dist",
    "fonts",
    "NOTICE",
    "README.md",
    "LICENSE"
  ],
```

and extend the build script so both stylesheets and the font directory reach
`dist`:

```json
    "build": "tsup && cp src/tokens.css dist/tokens.css && cp src/fonts.css dist/fonts.css"
```

`fonts/` is referenced from `dist/fonts.css` as `../fonts/…`, which resolves
correctly from the published package root — that is why the fonts are shipped at
the package root rather than inside `dist`.

- [ ] **Step 5: Write `packages/theme/NOTICE`**

```
@weasel-js/theme

The package's source code is licensed under the MIT License (see LICENSE).

This package additionally redistributes two font binaries under the SIL Open
Font License, Version 1.1. The OFL applies to these files only:

  fonts/oswald-latin-variable.woff2
    Copyright 2016 The Oswald Project Authors
    https://github.com/googlefonts/OswaldFont
    License: fonts/OFL-Oswald.txt

  fonts/inter-latin.woff2
    Copyright (c) 2016 The Inter Project Authors
    https://github.com/rsms/inter
    License: fonts/OFL-Inter.txt

See fonts/README.md for the exact subsetting commands used.
```

- [ ] **Step 6: Point labkit at the shared font**

Add the dependency in `packages/labkit/package.json`:

```json
    "@weasel-js/theme": "0.7.2",
```

and change `build:fonts` to copy from the shared location instead of its own
deleted `src/fonts/`:

```json
    "build:fonts": "mkdir -p dist/fonts && cp ../theme/fonts/*.woff2 dist/fonts/"
```

- [ ] **Step 7: Correct labkit's declared weight axis**

`packages/labkit/src/theme/base.less:4-16` declares the `@font-face`. Its
`src: url('./fonts/oswald-latin-variable.woff2')` and its `unicode-range` both
already match the new file — the filename is unchanged and Task 1's subset
covers the same range, including the `U+0304, U+0308, U+0329` combining marks
this block lists.

One line is wrong and should be corrected while here. Line 7 claims:

```less
  font-weight: 100 900;
```

Oswald's variable axis is `wght 200–700`; 100 and 900 were never available and
the browser was clamping. Change it to:

```less
  font-weight: 200 700;
```

- [ ] **Step 8: Verify labkit builds again**

```bash
npm run build -w @weasel-js/theme && npm run build -w @weasel-js/labkit
ls -l packages/labkit/dist/fonts/ packages/theme/dist/fonts.css
```

Expected: `packages/labkit/dist/fonts/` contains both woff2 files; `dist/fonts.css`
exists.

- [ ] **Step 9: Commit**

```bash
git add packages/theme packages/labkit
git commit -m "feat(theme): opt-in fonts.css entry, drop Google Fonts @import

tokens.css fetched Oswald from fonts.googleapis.com on import, which a
published package should not do — privacy, offline, CSP, and FOUT all
suffer. Fonts are now bundled and loaded via an explicit
@weasel-js/theme/fonts.css import. labkit single-sources from the same
files rather than carrying its own copy."
```

---

## Task 4: Author the DTCG source

Pure transcription of the current `tokens.css`. No value changes. Read the
Naming Rule above first.

**Files:**
- Create: `packages/theme/tokens/weasel/theme.json`
- Create: `packages/theme/tokens/weasel/primitives.tokens.json`
- Create: `packages/theme/tokens/weasel/modes/dark.tokens.json`
- Create: `packages/theme/tokens/weasel/modes/light.tokens.json`
- Test: `packages/theme/src/dtcg/source.test.ts`

- [ ] **Step 1: Write the failing parity test**

This is the guard against dropping a token during transcription. The literal
list is the 72 names currently declared in `tokens.css`.

Create `packages/theme/src/dtcg/source.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenTokens } from './flatten';

const here = dirname(fileURLToPath(import.meta.url));
const tokensDir = resolve(here, '../../tokens/weasel');

const readJson = (p: string) => JSON.parse(readFileSync(resolve(tokensDir, p), 'utf8'));

/** Every `--wzl-*` name declared in the pre-DTCG tokens.css. */
const LEGACY_NAMES = [
  'gray-50', 'gray-100', 'gray-200', 'gray-300', 'gray-400',
  'gray-500', 'gray-600', 'gray-700', 'gray-800', 'gray-900',
  'accent-soft', 'accent-base', 'accent-strong',
  'danger-base', 'warning-base', 'success-base',
  'radius-sm', 'radius-md', 'border-w', 'line-width', 'curve-width', 'tb-height',
  'motion-fast', 'motion-medium',
  'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic', 'ease-out-back',
  'line-subtle', 'line', 'line-strong', 'curve-color',
  'font-ui', 'font-display', 'font-body', 'font-mono',
  'font-weight-light', 'font-weight-normal', 'font-weight-bold',
  'surface', 'surface-raised', 'surface-sunken',
  'fg', 'fg-muted', 'fg-subtle', 'fg-on-accent',
  'border', 'border-strong',
  'accent', 'accent-fg', 'accent-hover',
  'danger', 'warning', 'success', 'focus-ring', 'glass-tint',
  'text', 'text-muted', 'bg', 'muted',
  'panel-bg', 'panel-border', 'input-bg',
  'track-bg', 'track-border',
  'thumb-fill', 'thumb-border', 'thumb-text',
  'button-fill', 'button-fill-hover', 'button-fill-pressed', 'button-text',
].sort();

describe('DTCG source', () => {
  it('declares exactly the token names the legacy tokens.css declared', () => {
    const names = new Set([
      ...Object.keys(flattenTokens(readJson('primitives.tokens.json'))),
      ...Object.keys(flattenTokens(readJson('modes/dark.tokens.json'))),
    ]);
    expect([...names].sort()).toEqual(LEGACY_NAMES);
  });

  it('declares the same token names in every mode', () => {
    const dark = Object.keys(flattenTokens(readJson('modes/dark.tokens.json'))).sort();
    const light = Object.keys(flattenTokens(readJson('modes/light.tokens.json'))).sort();
    expect(light).toEqual(dark);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/dtcg/source.test.ts
```

Expected: FAIL — cannot resolve `./flatten` (written in Task 5) and the token
files do not exist.

- [ ] **Step 3: Write `theme.json`**

```json
{
  "$schema": "../theme-manifest.schema.json",
  "name": "weasel",
  "defaultMode": "dark",
  "modes": {
    "dark":  { "colorScheme": "dark" },
    "light": { "colorScheme": "light" }
  }
}
```

`colorScheme` is not a token — it becomes the `color-scheme:` CSS property in
each mode's rule block, matching what `tokens.css` does today.

- [ ] **Step 4: Write `primitives.tokens.json`**

Everything that does not vary by mode. Prose from the current CSS comments moves
into `$description`, which the generator emits as comments and the Storybook
panel displays.

```json
{
  "color": {
    "$type": "color",
    "gray-50":  { "$value": "#f5f5f6" },
    "gray-100": { "$value": "#e6e7e9" },
    "gray-200": { "$value": "#c9cbcf" },
    "gray-300": { "$value": "#9ea1a8" },
    "gray-400": { "$value": "#6f737b" },
    "gray-500": { "$value": "#4d5058" },
    "gray-600": { "$value": "#383b42" },
    "gray-700": { "$value": "#25272c" },
    "gray-800": { "$value": "#181a1e" },
    "gray-900": { "$value": "#0e0f12" },

    "accent-soft":   { "$value": "#1d1454" },
    "accent-base":   { "$value": "#2e1f7a", "$description": "Midnight blue-violet. Deep and saturated; anchors primary actions on light and dark surfaces alike." },
    "accent-strong": { "$value": "#5841b8" },

    "danger-base":  { "$value": "#d94a3f" },
    "warning-base": { "$value": "#d99a3f" },
    "success-base": { "$value": "#2ec27e" },

    "fg-on-accent": { "$value": "{color.gray-50}" },

    "line-subtle": { "$value": "{color.fg}", "$extensions": { "com.weasel.alpha": 0.10 }, "$description": "Barely-there separators (table rows)." },
    "line":        { "$value": "{color.fg}", "$extensions": { "com.weasel.alpha": 0.20 }, "$description": "Primary gridlines on sunken surfaces." },
    "line-strong": { "$value": "{color.fg}", "$extensions": { "com.weasel.alpha": 0.40 }, "$description": "Axes and emphasized dividers." },

    "curve-color": { "$value": "{color.accent-strong}", "$description": "Drawn data curves. Routes through the bright accent because accent-base is too dim on sunken surfaces." },

    "accent":       { "$value": "{color.accent-base}" },
    "accent-hover": { "$value": "{color.accent-strong}" },
    "danger":       { "$value": "{color.danger-base}" },
    "warning":      { "$value": "{color.warning-base}" },
    "success":      { "$value": "{color.success-base}" },
    "focus-ring":   { "$value": "{color.accent-strong}" },
    "glass-tint":   { "$value": "{color.accent}", "$description": "Frosted-glass tint. Components compose it as color-mix(in srgb, var(--wzl-glass-tint) 78%, transparent) with backdrop-filter: blur(3px)." },

    "text":                { "$value": "{color.fg}" },
    "text-muted":          { "$value": "{color.fg-muted}" },
    "bg":                  { "$value": "{color.surface}" },
    "muted":               { "$value": "{color.fg-muted}" },
    "panel-bg":            { "$value": "{color.surface}" },
    "panel-border":        { "$value": "{color.border}" },
    "input-bg":            { "$value": "{color.surface-sunken}" },
    "track-bg":            { "$value": "{color.surface-sunken}" },
    "track-border":        { "$value": "{color.border}" },
    "thumb-fill":          { "$value": "{color.fg-muted}" },
    "thumb-border":        { "$value": "{color.border-strong}" },
    "button-fill":         { "$value": "{color.surface-raised}" },
    "button-fill-hover":   { "$value": "{color.fg}", "$extensions": { "com.weasel.alpha": 0.10 } },
    "button-fill-pressed": { "$value": "{color.fg}", "$extensions": { "com.weasel.alpha": 0.18 } },
    "button-text":         { "$value": "{color.fg}" }
  },

  "dimension": {
    "$type": "dimension",
    "radius-sm":   { "$value": "3px" },
    "radius-md":   { "$value": "5px" },
    "border-w":    { "$value": "1px" },
    "line-width":  { "$value": "2px", "$description": "Structural lines — gridlines, dividers, axes." },
    "curve-width": { "$value": "3px", "$description": "Drawn data curves. Heavier than structural lines so data reads as primary content." },
    "tb-height":   { "$value": "28px", "$description": "Height of a horizontal toolbar strip (ActionsBar, OptionsBar, ToggleBar, ToolOptionsBar)." }
  },

  "duration": {
    "$type": "duration",
    "motion-fast":   { "$value": "120ms", "$description": "Micro-interactions — hover, focus, pressed." },
    "motion-medium": { "$value": "240ms", "$description": "Entrances and exits — toasts, popovers, panels." }
  },

  "cubicBezier": {
    "$type": "cubicBezier",
    "ease-in-cubic":     { "$value": [0.32, 0, 0.67, 0] },
    "ease-out-cubic":    { "$value": [0.33, 1, 0.68, 1] },
    "ease-in-out-cubic": { "$value": [0.65, 0, 0.35, 1] },
    "ease-out-back":     { "$value": [0.34, 1.56, 0.64, 1] }
  },

  "fontFamily": {
    "$type": "fontFamily",
    "font-ui":      { "$value": ["Oswald", "Helvetica Neue Condensed", "Arial Narrow", "system-ui", "sans-serif"], "$description": "Condensed UI/display face. Loaded weights are 200/300/400 only; heavier cuts get blocky at any size." },
    "font-display": { "$value": ["Oswald", "Helvetica Neue Condensed", "Arial Narrow", "system-ui", "sans-serif"] },
    "font-body":    { "$value": ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
    "font-mono":    { "$value": ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"] }
  },

  "fontWeight": {
    "$type": "fontWeight",
    "font-weight-light":  { "$value": 200 },
    "font-weight-normal": { "$value": 300 },
    "font-weight-bold":   { "$value": 400 }
  }
}
```

Note `line-*` and `button-fill-hover/pressed` reference `{color.fg}`, which lives
in the mode files — the merge happens before resolution, so they auto-tint per
mode exactly as the current `color-mix()` does.

- [ ] **Step 5: Write `modes/dark.tokens.json`**

The 10 tokens that genuinely differ between modes, at their dark values.

```json
{
  "color": {
    "$type": "color",
    "surface":        { "$value": "{color.gray-800}" },
    "surface-raised": { "$value": "{color.gray-700}" },
    "surface-sunken": { "$value": "{color.gray-900}" },
    "fg":             { "$value": "{color.gray-100}" },
    "fg-muted":       { "$value": "{color.gray-300}" },
    "fg-subtle":      { "$value": "{color.gray-400}" },
    "border":         { "$value": "{color.gray-700}" },
    "border-strong":  { "$value": "{color.gray-600}" },
    "accent-fg":      { "$value": "{color.accent-strong}", "$description": "Accent for foreground use — text, icons, selected labels drawn on a surface. accent is a fill; the midnight base is too dim to read as text on dark surfaces." },
    "thumb-text":     { "$value": "{color.gray-900}" }
  }
}
```

- [ ] **Step 6: Write `modes/light.tokens.json`**

```json
{
  "color": {
    "$type": "color",
    "surface":        { "$value": "{color.gray-50}" },
    "surface-raised": { "$value": "{color.gray-100}" },
    "surface-sunken": { "$value": "{color.gray-200}" },
    "fg":             { "$value": "{color.gray-900}" },
    "fg-muted":       { "$value": "{color.gray-600}" },
    "fg-subtle":      { "$value": "{color.gray-500}" },
    "border":         { "$value": "{color.gray-200}" },
    "border-strong":  { "$value": "{color.gray-300}" },
    "accent-fg":      { "$value": "{color.accent-base}", "$description": "Flips to the deep base in light mode, where it is the legible one." },
    "thumb-text":     { "$value": "{color.gray-50}" }
  }
}
```

- [ ] **Step 7: Commit (test still red — `flatten` lands in Task 5)**

```bash
git add packages/theme/tokens packages/theme/src/dtcg/source.test.ts
git commit -m "feat(theme): author DTCG token source for the weasel theme"
```

---

## Task 5: `flattenTokens`

**Files:**
- Create: `packages/theme/src/dtcg/types.ts`
- Create: `packages/theme/src/dtcg/flatten.ts`
- Test: `packages/theme/src/dtcg/flatten.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/theme/src/dtcg/flatten.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { flattenTokens } from './flatten';

describe('flattenTokens', () => {
  it('drops the type group from the name and inherits $type', () => {
    const out = flattenTokens({
      color: { $type: 'color', 'fg-muted': { $value: '#9ea1a8' } },
    });
    expect(out).toEqual({
      'fg-muted': { type: 'color', value: '#9ea1a8', alpha: undefined, description: undefined },
    });
  });

  it('carries $description and the alpha extension through', () => {
    const out = flattenTokens({
      color: {
        $type: 'color',
        line: { $value: '{color.fg}', $description: 'gridlines', $extensions: { 'com.weasel.alpha': 0.2 } },
      },
    });
    expect(out.line.alpha).toBe(0.2);
    expect(out.line.description).toBe('gridlines');
    expect(out.line.value).toBe('{color.fg}');
  });

  it('preserves array and numeric values verbatim', () => {
    const out = flattenTokens({
      cubicBezier: { $type: 'cubicBezier', 'ease-out-cubic': { $value: [0.33, 1, 0.68, 1] } },
      fontWeight: { $type: 'fontWeight', 'font-weight-bold': { $value: 400 } },
    });
    expect(out['ease-out-cubic'].value).toEqual([0.33, 1, 0.68, 1]);
    expect(out['font-weight-bold'].value).toBe(400);
  });

  it('throws when a token has no resolvable $type', () => {
    expect(() => flattenTokens({ color: { fg: { $value: '#fff' } } }))
      .toThrow(/fg.*\$type/);
  });

  it('throws on a duplicate leaf name across type groups', () => {
    expect(() =>
      flattenTokens({
        color: { $type: 'color', line: { $value: '#fff' } },
        dimension: { $type: 'dimension', line: { $value: '2px' } },
      }),
    ).toThrow(/duplicate.*line/i);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/dtcg/flatten.test.ts
```

Expected: FAIL — `Failed to resolve import "./flatten"`.

- [ ] **Step 3: Write `types.ts`**

```ts
/** The one `$extensions` key this kit defines. */
export const ALPHA_EXT = 'com.weasel.alpha';

export type TokenValue = string | number | readonly (string | number)[];

export interface RawToken {
  readonly type: string;
  readonly value: TokenValue;
  /** Multiply the referenced color's alpha by this, 0–1. */
  readonly alpha: number | undefined;
  readonly description: string | undefined;
}

export type FlatTokens = Record<string, RawToken>;

/** A resolved theme: every token name mapped to its final CSS-ready string.
 *  Named ...Map, not ...Tokens, to stay distinct from hud's public `ResolvedTokens`. */
export type ResolvedTokenMap = Record<string, string>;
```

- [ ] **Step 4: Write `flatten.ts`**

```ts
import { ALPHA_EXT, type FlatTokens, type RawToken, type TokenValue } from './types';

interface DtcgToken {
  $value: TokenValue;
  $type?: string;
  $description?: string;
  $extensions?: Record<string, unknown>;
}

const isToken = (v: unknown): v is DtcgToken =>
  typeof v === 'object' && v !== null && '$value' in v;

/**
 * Collapse a DTCG document into flat token names.
 *
 * Groups exist only to carry `$type`; they contribute nothing to the name, so
 * `color.fg-muted` becomes `fg-muted` and in turn `--wzl-fg-muted`. See the
 * Naming Rule in the plan: `--wzl-accent` and `--wzl-accent-base` are both real
 * tokens, and DTCG forbids a token that is also a group.
 */
export function flattenTokens(doc: Record<string, unknown>): FlatTokens {
  const out: FlatTokens = {};

  for (const [groupName, group] of Object.entries(doc)) {
    if (groupName.startsWith('$')) continue;
    if (typeof group !== 'object' || group === null) continue;

    const g = group as Record<string, unknown> & { $type?: string };
    const groupType = g.$type;

    for (const [leaf, node] of Object.entries(g)) {
      if (leaf.startsWith('$')) continue;
      if (!isToken(node)) continue;

      const type = node.$type ?? groupType;
      if (!type) throw new Error(`Token "${leaf}" has no $type and its group "${groupName}" declares none`);
      if (leaf in out) throw new Error(`Duplicate token name "${leaf}" — leaf keys must be unique across type groups`);

      const alphaRaw = node.$extensions?.[ALPHA_EXT];
      const token: RawToken = {
        type,
        value: node.$value,
        alpha: typeof alphaRaw === 'number' ? alphaRaw : undefined,
        description: node.$description,
      };
      out[leaf] = token;
    }
  }

  return out;
}
```

- [ ] **Step 5: Run both test files**

```bash
npx vitest run --project=weasel-ui packages/theme/src/dtcg/
```

Expected: PASS — `flatten.test.ts` (5 tests) and `source.test.ts` (2 tests). The
source parity test proves the Task 4 transcription lost nothing.

- [ ] **Step 6: Commit**

```bash
git add packages/theme/src/dtcg
git commit -m "feat(theme): flatten DTCG typed groups to token names"
```

---

## Task 6: `resolveTheme`

**Files:**
- Create: `packages/theme/src/dtcg/color.ts`
- Create: `packages/theme/src/dtcg/resolve.ts`
- Test: `packages/theme/src/dtcg/color.test.ts`
- Test: `packages/theme/src/dtcg/resolve.test.ts`

- [ ] **Step 1: Write the failing color test**

Create `packages/theme/src/dtcg/color.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hexToRgba } from './color';

describe('hexToRgba', () => {
  it('expands 6-digit hex', () => {
    expect(hexToRgba('#e6e7e9', 0.2)).toBe('rgba(230, 231, 233, 0.2)');
  });

  it('expands 3-digit shorthand', () => {
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('throws on a non-hex input rather than guessing', () => {
    expect(() => hexToRgba('rebeccapurple', 0.5)).toThrow(/hex/i);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/dtcg/color.test.ts
```

Expected: FAIL — `Failed to resolve import "./color"`.

- [ ] **Step 3: Write `color.ts`**

```ts
/**
 * Hex → `rgba()`. The JS side of the alpha extension; the CSS side emits
 * `color-mix()` instead so DOM chrome keeps tracking a downstream override of
 * the referenced token.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Expected a hex color, got "${hex}"`);

  const body = m[1];
  const full = body.length === 3 ? body.replace(/./g, (c) => c + c) : body;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
npx vitest run --project=weasel-ui packages/theme/src/dtcg/color.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing resolver test**

Create `packages/theme/src/dtcg/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveTokens } from './resolve';
import type { FlatTokens } from './types';

const t = (value: string, extra: Partial<FlatTokens[string]> = {}): FlatTokens[string] => ({
  type: 'color', value, alpha: undefined, description: undefined, ...extra,
});

describe('resolveTokens', () => {
  it('resolves a reference chain to a literal', () => {
    const out = resolveTokens({ 'gray-100': t('#e6e7e9'), fg: t('{color.gray-100}'), text: t('{color.fg}') });
    expect(out.text).toBe('#e6e7e9');
  });

  it('applies the alpha extension against the resolved target', () => {
    const out = resolveTokens({ 'gray-100': t('#e6e7e9'), fg: t('{color.gray-100}'), line: t('{color.fg}', { alpha: 0.2 }) });
    expect(out.line).toBe('rgba(230, 231, 233, 0.2)');
  });

  it('serializes a font family list as a CSS font stack', () => {
    const out = resolveTokens({
      'font-ui': { type: 'fontFamily', value: ['Oswald', 'Arial Narrow', 'sans-serif'], alpha: undefined, description: undefined },
    });
    expect(out['font-ui']).toBe("'Oswald', 'Arial Narrow', sans-serif");
  });

  it('serializes a cubic bezier', () => {
    const out = resolveTokens({
      'ease-out-cubic': { type: 'cubicBezier', value: [0.33, 1, 0.68, 1], alpha: undefined, description: undefined },
    });
    expect(out['ease-out-cubic']).toBe('cubic-bezier(0.33, 1, 0.68, 1)');
  });

  it('throws naming the token when a reference is unresolvable', () => {
    expect(() => resolveTokens({ fg: t('{color.nope}') })).toThrow(/fg.*nope/);
  });

  it('throws naming the cycle rather than recursing forever', () => {
    expect(() => resolveTokens({ a: t('{color.b}'), b: t('{color.a}') })).toThrow(/cycle/i);
  });
});
```

- [ ] **Step 6: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/dtcg/resolve.test.ts
```

Expected: FAIL — `Failed to resolve import "./resolve"`.

- [ ] **Step 7: Write `resolve.ts`**

```ts
import { hexToRgba } from './color';
import type { FlatTokens, ResolvedTokenMap, TokenValue } from './types';

/** `{color.gray-100}` → `gray-100`. The type group is dropped, per the naming rule. */
const REF = /^\{([^}]+)\}$/;

function refTarget(value: TokenValue): string | null {
  if (typeof value !== 'string') return null;
  const m = REF.exec(value.trim());
  if (!m) return null;
  const path = m[1];
  const dot = path.indexOf('.');
  return dot === -1 ? path : path.slice(dot + 1);
}

function serialize(type: string, value: TokenValue): string {
  if (Array.isArray(value)) {
    if (type === 'cubicBezier') return `cubic-bezier(${value.join(', ')})`;
    if (type === 'fontFamily') {
      // Quote family names containing spaces; leave generic keywords bare.
      return value
        .map((f) => (typeof f === 'string' && /\s/.test(f) && !f.startsWith('-') ? `'${f}'` : String(f)))
        .join(', ');
    }
    return value.join(', ');
  }
  return String(value);
}

/**
 * Resolve flat tokens to final CSS-ready strings.
 *
 * Merge modes before calling: this function has no notion of modes, only of a
 * complete token set.
 */
export function resolveTokens(tokens: FlatTokens): ResolvedTokenMap {
  const out: ResolvedTokenMap = {};
  const inProgress = new Set<string>();

  const resolveOne = (name: string): string => {
    const cached = out[name];
    if (cached !== undefined) return cached;

    const token = tokens[name];
    if (!token) throw new Error(`Unknown token "${name}"`);

    if (inProgress.has(name)) {
      throw new Error(`Reference cycle at token "${name}" (${[...inProgress].join(' → ')})`);
    }
    inProgress.add(name);

    const target = refTarget(token.value);
    let value: string;
    if (target === null) {
      value = serialize(token.type, token.value);
    } else if (!tokens[target]) {
      throw new Error(`Token "${name}" references "${target}", which is not defined`);
    } else {
      value = resolveOne(target);
    }

    if (token.alpha !== undefined) value = hexToRgba(value, token.alpha);

    inProgress.delete(name);
    out[name] = value;
    return value;
  };

  for (const name of Object.keys(tokens)) resolveOne(name);
  return out;
}

/** Merge a mode's tokens over the mode-invariant set. Later wins. */
export function mergeTokens(base: FlatTokens, mode: FlatTokens): FlatTokens {
  return { ...base, ...mode };
}
```

Note the `inProgress` guard runs before the cache check can help, so a
self-referential token throws instead of returning a stale value.

- [ ] **Step 8: Run the resolver tests**

```bash
npx vitest run --project=weasel-ui packages/theme/src/dtcg/resolve.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 9: Commit**

```bash
git add packages/theme/src/dtcg
git commit -m "feat(theme): pure DTCG resolver — refs, cycles, alpha extension"
```

---

## Task 7: The generator

**Files:**
- Create: `packages/theme/scripts/build-tokens.ts`
- Create (generated): `packages/theme/src/generated/tokens.css`
- Create (generated): `packages/theme/src/generated/themes.ts`
- Create (generated): `packages/theme/src/generated/manifest.ts`
- Test: `packages/theme/src/generated/generated.test.ts`

- [ ] **Step 1: Write the failing test against the generated output**

These assertions pin the values that matter, including the two the old
hand-mirrored `DEFAULT_TOKENS` got wrong.

Create `packages/theme/src/generated/generated.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from './themes';
import { TOKEN_MANIFEST } from './manifest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'tokens.css'), 'utf8');

describe('generated themes.ts', () => {
  it('exposes both modes of the weasel theme', () => {
    expect(Object.keys(THEMES.weasel.modes).sort()).toEqual(['dark', 'light']);
  });

  it('resolves aliases to literals', () => {
    expect(THEMES.weasel.modes.dark['--wzl-surface']).toBe('#181a1e');
    expect(THEMES.weasel.modes.light['--wzl-surface']).toBe('#f5f5f6');
  });

  it('computes alpha tokens exactly instead of approximating them', () => {
    expect(THEMES.weasel.modes.dark['--wzl-line']).toBe('rgba(230, 231, 233, 0.2)');
    expect(THEMES.weasel.modes.light['--wzl-line']).toBe('rgba(14, 15, 18, 0.2)');
  });

  it('flips accent-fg per mode', () => {
    expect(THEMES.weasel.modes.dark['--wzl-accent-fg']).toBe('#5841b8');
    expect(THEMES.weasel.modes.light['--wzl-accent-fg']).toBe('#2e1f7a');
  });
});

describe('generated tokens.css', () => {
  it('emits color-mix for alpha tokens so DOM overrides still tint', () => {
    expect(css).toContain('--wzl-line: color-mix(in srgb, var(--wzl-fg) 20%, transparent);');
  });

  it('keeps var() indirection rather than inlining literals', () => {
    expect(css).toContain('--wzl-surface: var(--wzl-gray-800);');
  });

  it('emits a color-scheme per mode', () => {
    expect(css).toMatch(/\[data-wzl-mode='light'\][\s\S]*color-scheme: light;/);
  });

  it('carries no remote @import', () => {
    expect(css).not.toContain('@import');
  });
});

describe('generated manifest.ts', () => {
  it('lists every token with its type and group', () => {
    const line = TOKEN_MANIFEST.find((t) => t.name === '--wzl-line');
    expect(line).toMatchObject({ type: 'color', group: 'line' });
  });

  it('carries descriptions through for the Storybook panel', () => {
    const tb = TOKEN_MANIFEST.find((t) => t.name === '--wzl-tb-height');
    expect(tb?.description).toMatch(/toolbar/i);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/generated/
```

Expected: FAIL — the `./themes` and `./manifest` modules do not exist.

- [ ] **Step 3: Write the generator**

Create `packages/theme/scripts/build-tokens.ts`:

```ts
/**
 * Generates every token artifact from the DTCG source. Run via
 * `npm run gen:tokens -w @weasel-js/theme`; CI re-runs it and fails on a diff,
 * so the committed output under src/generated/ is never edited by hand.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenTokens } from '../src/dtcg/flatten.ts';
import { resolveTokens, mergeTokens } from '../src/dtcg/resolve.ts';
import type { FlatTokens } from '../src/dtcg/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_DIR = resolve(here, '../tokens');
const OUT_DIR = resolve(here, '../src/generated');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

interface ThemeManifest {
  name: string;
  defaultMode: string;
  modes: Record<string, { colorScheme: 'dark' | 'light' }>;
}

/** `{color.gray-100}` → `var(--wzl-gray-100)`; literals pass through. */
function cssValue(name: string, tokens: FlatTokens): string {
  const token = tokens[name];
  const raw = token.value;
  const isRef = typeof raw === 'string' && /^\{[^}]+\}$/.test(raw.trim());

  if (isRef) {
    const path = (raw as string).trim().slice(1, -1);
    const dot = path.indexOf('.');
    const target = dot === -1 ? path : path.slice(dot + 1);
    if (token.alpha !== undefined) {
      const pct = Math.round(token.alpha * 100);
      return `color-mix(in srgb, var(--wzl-${target}) ${pct}%, transparent)`;
    }
    return `var(--wzl-${target})`;
  }

  // Non-ref with alpha would be an authoring error; resolveTokens catches it.
  return resolveTokens({ [name]: token })[name];
}

function loadTheme(dir: string) {
  const manifest: ThemeManifest = readJson(resolve(dir, 'theme.json'));
  const primitives = flattenTokens(readJson(resolve(dir, 'primitives.tokens.json')));
  const modes: Record<string, FlatTokens> = {};
  for (const mode of Object.keys(manifest.modes)) {
    modes[mode] = flattenTokens(readJson(resolve(dir, 'modes', `${mode}.tokens.json`)));
  }
  return { manifest, primitives, modes };
}

function emitCss(themes: ReturnType<typeof loadTheme>[]): string {
  const lines: string[] = [
    '/* GENERATED by packages/theme/scripts/build-tokens.ts — do not edit.',
    ' * Source: packages/theme/tokens/<theme>/',
    ' */',
    '',
  ];

  for (const { manifest, primitives, modes } of themes) {
    const defaults = mergeTokens(primitives, modes[manifest.defaultMode]);

    lines.push(':root {');
    for (const name of Object.keys(defaults)) {
      const desc = defaults[name].description;
      if (desc) lines.push(`  /* ${desc} */`);
      lines.push(`  --wzl-${name}: ${cssValue(name, defaults)};`);
    }
    lines.push('}', '');

    lines.push(':root {');
    lines.push('  font-family: var(--wzl-font-ui);');
    lines.push('  font-weight: var(--wzl-font-weight-normal);');
    lines.push('}', '');

    for (const [mode, cfg] of Object.entries(manifest.modes)) {
      const merged = mergeTokens(primitives, modes[mode]);
      lines.push(`[data-wzl-theme='${manifest.name}'][data-wzl-mode='${mode}'],`);
      lines.push(`[data-wzl-mode='${mode}'] {`);
      lines.push(`  color-scheme: ${cfg.colorScheme};`);
      for (const name of Object.keys(modes[mode])) {
        lines.push(`  --wzl-${name}: ${cssValue(name, merged)};`);
      }
      lines.push('}', '');
    }
  }

  return lines.join('\n');
}

function emitThemes(themes: ReturnType<typeof loadTheme>[]): string {
  const entries = themes.map(({ manifest, primitives, modes }) => {
    const modeEntries = Object.keys(manifest.modes).map((mode) => {
      const resolved = resolveTokens(mergeTokens(primitives, modes[mode]));
      const body = Object.entries(resolved)
        .map(([n, v]) => `      '--wzl-${n}': ${JSON.stringify(v)},`)
        .join('\n');
      return `    ${JSON.stringify(mode)}: {\n${body}\n    },`;
    });
    return [
      `  ${JSON.stringify(manifest.name)}: {`,
      `    name: ${JSON.stringify(manifest.name)},`,
      `    defaultMode: ${JSON.stringify(manifest.defaultMode)},`,
      '    modes: {',
      modeEntries.join('\n'),
      '    },',
      '  },',
    ].join('\n');
  });

  const names = themes
    .flatMap(({ manifest, primitives, modes }) =>
      Object.keys(mergeTokens(primitives, modes[manifest.defaultMode])),
    )
    .map((n) => `  | '--wzl-${n}'`);

  return [
    '// GENERATED by packages/theme/scripts/build-tokens.ts — do not edit.',
    '',
    'export type TokenName =',
    [...new Set(names)].sort().join('\n') + ';',
    '',
    'export interface GeneratedTheme {',
    '  readonly name: string;',
    '  readonly defaultMode: string;',
    '  readonly modes: Readonly<Record<string, Readonly<Record<TokenName, string>>>>;',
    '}',
    '',
    'export const THEMES = {',
    entries.join('\n'),
    '} as const satisfies Record<string, GeneratedTheme>;',
    '',
  ].join('\n');
}

function emitManifest(themes: ReturnType<typeof loadTheme>[]): string {
  const { manifest, primitives, modes } = themes[0];
  const all = mergeTokens(primitives, modes[manifest.defaultMode]);
  const resolved = resolveTokens(all);

  const rows = Object.entries(all).map(([name, token]) => {
    const group = name.includes('-') ? name.slice(0, name.indexOf('-')) : name;
    return `  { name: '--wzl-${name}', type: ${JSON.stringify(token.type)}, group: ${JSON.stringify(group)}, defaultValue: ${JSON.stringify(resolved[name])}, description: ${JSON.stringify(token.description ?? '')} },`;
  });

  return [
    '// GENERATED by packages/theme/scripts/build-tokens.ts — do not edit.',
    '',
    'export interface TokenManifestEntry {',
    '  readonly name: string;',
    '  readonly type: string;',
    '  readonly group: string;',
    '  readonly defaultValue: string;',
    '  readonly description: string;',
    '}',
    '',
    'export const TOKEN_MANIFEST: readonly TokenManifestEntry[] = [',
    rows.join('\n'),
    '];',
    '',
  ].join('\n');
}

const themeDirs = readdirSync(TOKENS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => resolve(TOKENS_DIR, d.name))
  .sort((a, b) => basename(a).localeCompare(basename(b)));

const themes = themeDirs.map(loadTheme);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'tokens.css'), emitCss(themes));
writeFileSync(resolve(OUT_DIR, 'themes.ts'), emitThemes(themes));
writeFileSync(resolve(OUT_DIR, 'manifest.ts'), emitManifest(themes));

console.log(`Generated ${themes.length} theme(s) → ${OUT_DIR}`);
```

The `[data-wzl-mode='…']` selector is emitted alongside the theme-qualified one
so a bare mode attribute keeps working without naming a theme — that is how
today's `[data-theme='light']` behaves, and dropping it would be a silent
behavior change.

- [ ] **Step 4: Add the script and run it**

In `packages/theme/package.json` add:

```json
    "gen:tokens": "node scripts/build-tokens.ts",
```

and make it run before every build:

```json
    "build": "npm run gen:tokens && tsup && cp src/tokens.css dist/tokens.css && cp src/fonts.css dist/fonts.css"
```

Then:

```bash
npm run gen:tokens -w @weasel-js/theme
ls -l packages/theme/src/generated/
```

Expected: `tokens.css`, `themes.ts`, `manifest.ts` all written.

- [ ] **Step 5: Run the generated-output tests**

```bash
npx vitest run --project=weasel-ui packages/theme/src/generated/
```

Expected: PASS (9 tests). If `--wzl-line` in light mode is not
`rgba(14, 15, 18, 0.2)`, the mode merge is resolving `{color.fg}` against the
wrong layer — check `mergeTokens` argument order.

- [ ] **Step 6: Commit**

```bash
git add packages/theme/scripts packages/theme/src/generated packages/theme/package.json
git commit -m "feat(theme): generate tokens.css, themes.ts, and the manifest from DTCG"
```

---

## Task 8: Swap consumers onto the generated output

**Files:**
- Delete: `packages/theme/src/tokens.css`, `packages/theme/src/tokens.ts`, `packages/theme/src/tokens.test.ts`
- Modify: `packages/theme/src/index.ts`, `packages/theme/package.json`
- Modify: `vitest.config.ts:23`, `vite.config.ts:74`, `apps/draw/vite.config.ts:28`, `.storybook/main.ts:51`, `packages/ui/.storybook/main.ts:22`

- [ ] **Step 1: Repoint every alias at the generated stylesheet**

Five configs alias `@weasel-js/theme/tokens.css` to
`packages/theme/src/tokens.css`. Change each replacement path to
`packages/theme/src/generated/tokens.css`:

```bash
grep -rn "packages/theme/src/tokens.css" --include="*.ts" . | grep -v node_modules
```

Expected before: 5 hits (`vitest.config.ts`, `vite.config.ts`,
`apps/draw/vite.config.ts`, `.storybook/main.ts`,
`packages/ui/.storybook/main.ts`). Update all five, then re-run the grep and
expect no output.

Also update `tsconfig.json:53` and `packages/labkit/tsconfig.dts.json:34`, which
map the same specifier.

- [ ] **Step 2: Rewrite the package entry**

`packages/theme/src/index.ts` becomes:

```ts
export { THEMES, type TokenName, type GeneratedTheme } from './generated/themes';
export { TOKEN_MANIFEST, type TokenManifestEntry } from './generated/manifest';

/**
 * Default token values for the built-in theme's default mode.
 *
 * Retained under its original name because `@weasel-js/hud` reads it as a
 * boot-window fallback. Plan B replaces that consumer with a resolved theme.
 */
export const DEFAULT_TOKENS = THEMES.weasel.modes[THEMES.weasel.defaultMode];
```

- [ ] **Step 3: Update the build to copy the generated CSS**

In `packages/theme/package.json`:

```json
    "build": "npm run gen:tokens && tsup && cp src/generated/tokens.css dist/tokens.css && cp src/fonts.css dist/fonts.css"
```

- [ ] **Step 4: Delete the hand-maintained files**

```bash
git rm packages/theme/src/tokens.css packages/theme/src/tokens.ts packages/theme/src/tokens.test.ts
```

`tokens.test.ts` checked key parity between the CSS and the TS mirror. Both are
now emitted from one source by one function, so the test asserts a property that
can no longer fail — Task 9 replaces it with the check that can.

- [ ] **Step 5: Verify hud still resolves its tokens**

`packages/hud/src/theme.ts` imports `DEFAULT_TOKENS` and `TokenName` and indexes
16 deprecated aliases. All 16 still exist in the generated set, so this must pass
untouched.

```bash
npx vitest run --project=weasel-ui packages/hud
npm run typecheck
```

Expected: hud tests PASS; typecheck clean.

- [ ] **Step 6: Verify nothing rendered changed**

```bash
npm run test:visual
```

Expected: all baselines pass. The generated CSS keeps `var()` indirection and
`color-mix()`, so computed values are identical. A failure here means the
generator inlined something it should have left as a reference.

If the runner reports missing browsers, run `npx playwright install chromium`
first.

- [ ] **Step 7: Commit**

```bash
git add -u && git add packages/theme/src/index.ts
git commit -m "refactor(theme): serve tokens from the generated source

Deletes the hand-written tokens.css and the hand-mirrored tokens.ts.
DEFAULT_TOKENS is now a view onto the generated theme rather than a
parallel transcription whose color-mix values were, by its own header,
'plausible hex approximations'."
```

---

## Task 9: Storybook manifest, generator determinism check

**Files:**
- Delete: `scripts/vite-plugin-weasel-tokens.ts`
- Modify: `.storybook/main.ts`, `.storybook/addons/css-vars/preview.tsx`, `.storybook/addons/css-vars/virtual.d.ts`, `packages/ui/.storybook/main.ts`
- Create: `packages/theme/src/generated/determinism.test.ts`

- [ ] **Step 1: Write the failing determinism test**

Create `packages/theme/src/generated/determinism.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '../..');
const FILES = ['tokens.css', 'themes.ts', 'manifest.ts'];

describe('generated output', () => {
  it('is exactly what the generator produces from the current source', () => {
    const before = FILES.map((f) => readFileSync(resolve(here, f), 'utf8'));
    execFileSync('node', ['scripts/build-tokens.ts'], { cwd: pkgRoot, stdio: 'pipe' });
    const after = FILES.map((f) => readFileSync(resolve(here, f), 'utf8'));

    for (const [i, name] of FILES.entries()) {
      expect(after[i], `${name} is stale — run \`npm run gen:tokens -w @weasel-js/theme\` and commit`).toBe(before[i]);
    }
  });
});
```

This is the replacement for the deleted key-parity test: it catches hand-editing
generated files and forgetting to regenerate after a source change.

- [ ] **Step 2: Run it**

```bash
npx vitest run --project=weasel-ui packages/theme/src/generated/determinism.test.ts
```

Expected: PASS immediately — Task 7 just generated these files. To confirm the
test can actually fail, append a space to `src/generated/tokens.css`, re-run
(expect FAIL), then regenerate.

- [ ] **Step 3: Repoint the Storybook addon at the manifest**

In `.storybook/addons/css-vars/preview.tsx:17`, replace:

```ts
import tokens from 'virtual:weasel-tokens';
```

with:

```ts
import { TOKEN_MANIFEST } from '@weasel-js/theme';

const tokens = TOKEN_MANIFEST;
```

The addon reads `.name`, `.defaultValue`, and `.group` on each entry — all three
are present on `TokenManifestEntry`, so no other change is needed. Check
`manager.tsx` for a second copy of the token list; it is built by a separate
bundle and may inline its own.

- [ ] **Step 4: Drop the plugin**

Remove the import and the `plugins:` entry from `.storybook/main.ts` (lines 7
and 56 — leave `traitSchemasPlugin`), remove the equivalent from
`packages/ui/.storybook/main.ts`, delete
`.storybook/addons/css-vars/virtual.d.ts`, then:

```bash
git rm scripts/vite-plugin-weasel-tokens.ts .storybook/addons/css-vars/virtual.d.ts
grep -rn "virtual:weasel-tokens\|weaselTokensPlugin" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Expected: no output.

- [ ] **Step 5: Verify Storybook builds and the panel populates**

```bash
npm run build-storybook 2>&1 | tail -20
```

Expected: build completes with no unresolved-import errors.

- [ ] **Step 6: Full verification**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: all clean. `npm test` covers the `weasel-ui` project, which is where
the theme tests run.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(theme): Storybook reads the generated manifest

Deletes vite-plugin-weasel-tokens.ts — 125 lines of regex that parsed
tokens.css off disk to rebuild a list the generator now emits directly.
Adds the determinism check that replaces the old key-parity test."
```

---

## Task 10: Documentation and changeset

**Files:**
- Modify: `packages/theme/README.md`, `docs/TODO.md`, `docs/conventions.md`
- Create: `.changeset/<generated-name>.md`

- [ ] **Step 1: Rewrite `packages/theme/README.md`**

Replace the Usage section:

```markdown
## Usage

```ts
import { THEMES, TOKEN_MANIFEST, type TokenName } from '@weasel-js/theme';
import '@weasel-js/theme/tokens.css';   // required — component styles read these
import '@weasel-js/theme/fonts.css';    // optional — bundled Oswald + Inter
```

Skip `fonts.css` and the token font stacks fall back to `system-ui`. Nothing is
fetched from a third-party host either way.

## Editing tokens

`src/generated/` is generated — never edit it. Change `tokens/weasel/*.json`,
then:

```sh
npm run gen:tokens -w @weasel-js/theme
```

CI re-runs the generator and fails if the committed output differs.

## Licenses

Code is MIT. The two bundled fonts are SIL OFL 1.1 — see `NOTICE` and
`fonts/README.md`.
```

- [ ] **Step 2: Update the P1 TODO entry**

In `docs/TODO.md`, the Theming section's P1 item (around line 509) lists five
sub-questions. (a), (c), and (e) are now settled. Replace the entry's body with
the settled answers and a pointer to the remaining plans:

```markdown
- **(P1) Make theming resilient and implementation-agnostic.** Spec:
  `docs/superpowers/specs/2026-08-08-dtcg-pluggable-theming-design.md`.

  Plan A (DTCG source of truth) is complete: `packages/theme/tokens/` is the
  only hand-edited token artifact, and one generator emits the CSS, the TS
  objects, the `TokenName` union, and the Storybook manifest. Fonts are bundled
  under OFL rather than fetched from Google.

  Remaining: **Plan B** — runtime API (`resolveTheme` / `applyTheme` /
  `defineTheme`), the React entry, HUD bridge removal, the deprecated-alias
  migration and its three new semantic tokens, the `data-theme` rename.
  **Plan C** — labkit convergence: `--lk-*` and the `lessc` pipeline collapse
  into the shared source, and `interstellar` becomes the proof case for a
  third-party pluggable theme.
```

- [ ] **Step 3: Note the token-editing convention**

Add to `docs/conventions.md`, under a `## Design tokens` heading:

```markdown
## Design tokens

`--wzl-*` tokens are generated. Edit `packages/theme/tokens/<theme>/*.json`
(DTCG) and run `npm run gen:tokens -w @weasel-js/theme`; never edit
`packages/theme/src/generated/`.

Token names are flat leaf keys inside `$type` groups — `color.fg-muted` becomes
`--wzl-fg-muted`. The type group is a `$type` carrier and contributes nothing to
the name, because `--wzl-accent` and `--wzl-accent-base` are both real tokens and
DTCG forbids a token that is also a group.
```

- [ ] **Step 4: Write the changeset**

```bash
npx changeset
```

Select `@weasel-js/theme` and `@weasel-js/labkit`. Prose:

```
Design tokens are now generated from DTCG source under
packages/theme/tokens/. The hand-written tokens.css and the hand-mirrored
DEFAULT_TOKENS object are gone; both are emitted from one source, so the
color-mix values that were previously "plausible hex approximations" are
now exact.

Oswald and Inter ship with the package under OFL 1.1 and load via a new
opt-in `@weasel-js/theme/fonts.css` entry. tokens.css no longer @imports a
stylesheet from fonts.googleapis.com. labkit consumes the same font files
instead of its own unlicensed copy, and gains the LICENSE file it was
missing.
```

Version numbers are not discussed — pick a bump and move on.

- [ ] **Step 5: Final gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all clean. This is the same sequence `prepublishOnly` runs, minus the
manifest and consumer-smoke checks — run those too if the build touched
packaging:

```bash
npm run check:manifests && npm run test:smoke:consumer
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(theme): document the generated token workflow"
```

---

## Done when

- `packages/theme/tokens/` is the only hand-edited token artifact in the repo.
- `packages/theme/src/generated/` is reproducible from it, and CI proves it.
- No file anywhere fetches a stylesheet from a third-party host.
- Every bundled font ships with its license and a recorded subsetting command.
- `npm run test:visual` passes unchanged — nothing rendered moved.
