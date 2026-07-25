# SVG Parser Cascade Context — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@weasel-js/svg`'s per-attribute `readInheritedAttr` DOM walk-ups with a resolved `StyleContext` threaded through the recursive parse, and use it to fix text cascade + add `currentColor` resolution.

**Architecture:** A new `cascade.ts` module owns the `StyleContext` type and a `deriveStyle(parent, el)` fold. `parse.ts` threads a `StyleContext` alongside the existing `ctm` (transform matrix): each `<g>`/`<svg>`/leaf folds its own presentation attrs onto the inherited cascade once, top-down, and leaf parsers read resolved values instead of walking the DOM. Text reads from the same context (fixing a cascade bug); `currentColor` resolves against the inherited `color`.

**Tech Stack:** TypeScript, Vitest, the platform `DOMParser` (jsdom in tests). Spec: `docs/superpowers/specs/2026-07-25-svg-cascade-context-design.md`.

**Working directory:** all paths absolute under `/Users/mike/src/weasel/`. Run all commands from `/Users/mike/src/weasel`.

---

## File structure

- **Create** `packages/svg/src/cascade.ts` — `StyleContext`, `EMPTY_STYLE`, `deriveStyle`, `ownProp`, `readStyleProp` (moved from `parse.ts`), `resolveCurrentColor`.
- **Create** `packages/svg/src/cascade.test.ts` — unit tests for the cascade primitive.
- **Modify** `packages/svg/src/parse.ts` — thread `StyleContext`; migrate `readPaint`/`readStroke`/`readTextStyle`/`readTspanRun` and the inline `fill-rule`/`<line>` sites; delete `readInheritedAttr`; move `readStyleProp` out.
- **Modify** `packages/svg/src/parse.test.ts` — new text-cascade + currentColor cases.
- **Modify** `docs/TODO.md` — retire the completed cascade item, leaving the `<style>`/selectors follow-up.

---

## Task 1: Cascade primitive (`cascade.ts`)

**Files:**
- Create: `packages/svg/src/cascade.ts`
- Test: `packages/svg/src/cascade.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/svg/src/cascade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveStyle, EMPTY_STYLE, ownProp, readStyleProp, resolveCurrentColor } from './cascade';

/** Parse an SVG string and return a lookup by element id. */
function els(svg: string): (id: string) => Element {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return (id) => {
    const found = doc.getElementById(id);
    if (!found) throw new Error(`no #${id}`);
    return found;
  };
}

describe('deriveStyle', () => {
  it('folds an element own fill onto the parent cascade', () => {
    const get = els('<svg><rect id="r" fill="#ff0000"/></svg>');
    const style = deriveStyle(EMPTY_STYLE, get('r'));
    expect(style['fill']).toBe('#ff0000');
  });

  it('own value overrides an inherited value', () => {
    const get = els('<svg id="s" fill="#000000"><rect id="r" fill="#ff0000"/></svg>');
    const parent = deriveStyle(EMPTY_STYLE, get('s'));
    const style = deriveStyle(parent, get('r'));
    expect(style['fill']).toBe('#ff0000');
  });

  it('absent property keeps the parent value (and returns the same object)', () => {
    const get = els('<svg id="s" fill="#00ff00"><g id="g"/></svg>');
    const parent = deriveStyle(EMPTY_STYLE, get('s'));
    const style = deriveStyle(parent, get('g'));
    expect(style['fill']).toBe('#00ff00');
    expect(style).toBe(parent); // no own inheritable attrs → no clone
  });

  it('the `inherit` keyword keeps the parent value', () => {
    const get = els('<svg id="s" fill="#00ff00"><rect id="r" fill="inherit"/></svg>');
    const parent = deriveStyle(EMPTY_STYLE, get('s'));
    const style = deriveStyle(parent, get('r'));
    expect(style['fill']).toBe('#00ff00');
  });

  it('resolves to the nearest ancestor across multiple levels', () => {
    const get = els('<svg id="s" fill="#111111"><g id="g" fill="#222222"><rect id="r"/></g></svg>');
    const a = deriveStyle(EMPTY_STYLE, get('s'));
    const b = deriveStyle(a, get('g'));
    const c = deriveStyle(b, get('r'));
    expect(c['fill']).toBe('#222222');
  });

  it('style="" beats the presentation attribute on the same element', () => {
    const get = els('<svg><rect id="r" fill="#111111" style="fill:#999999"/></svg>');
    const style = deriveStyle(EMPTY_STYLE, get('r'));
    expect(style['fill']).toBe('#999999');
  });
});

describe('readStyleProp', () => {
  it('extracts a declaration and trims it', () => {
    const get = els('<svg><rect id="r" style="fill: #abcabc ; stroke:#000"/></svg>');
    expect(readStyleProp(get('r'), 'fill')).toBe('#abcabc');
    expect(readStyleProp(get('r'), 'stroke')).toBe('#000');
  });
  it('returns null when the property is absent', () => {
    const get = els('<svg><rect id="r" style="stroke:#000"/></svg>');
    expect(readStyleProp(get('r'), 'fill')).toBeNull();
  });
});

describe('ownProp', () => {
  it('prefers style="" over the attribute', () => {
    const get = els('<svg><rect id="r" fill="#111111" style="fill:#999999"/></svg>');
    expect(ownProp(get('r'), 'fill')).toBe('#999999');
  });
  it('falls back to the attribute', () => {
    const get = els('<svg><rect id="r" fill="#111111"/></svg>');
    expect(ownProp(get('r'), 'fill')).toBe('#111111');
  });
});

describe('resolveCurrentColor', () => {
  it('resolves currentColor to the cascade color', () => {
    expect(resolveCurrentColor('currentColor', { color: '#00ff00' })).toBe('#00ff00');
  });
  it('is case-insensitive and trims', () => {
    expect(resolveCurrentColor('  CURRENTCOLOR ', { color: '#00ff00' })).toBe('#00ff00');
  });
  it('defaults to black when color is unset', () => {
    expect(resolveCurrentColor('currentColor', EMPTY_STYLE)).toBe('#000000');
  });
  it('passes other values through unchanged', () => {
    expect(resolveCurrentColor('#123456', { color: '#00ff00' })).toBe('#123456');
  });
  it('returns null for null input', () => {
    expect(resolveCurrentColor(null, EMPTY_STYLE)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/svg/src/cascade.test.ts`
Expected: FAIL — cannot resolve `./cascade`.

- [ ] **Step 3: Write the implementation**

Create `packages/svg/src/cascade.ts`:

```ts
/**
 * SVG presentation-attribute cascade.
 *
 * Most SVG paint/text properties inherit down the element tree. Rather than
 * re-walking the DOM parent chain per attribute at leaf-emit time, the parser
 * threads a resolved `StyleContext` down through the recursion (alongside the
 * transform matrix): at each element we fold the element's own attributes onto
 * the inherited cascade once, and leaves read resolved values directly.
 */

/**
 * Raw resolved value of each inheritable presentation property in effect at a
 * point in the tree. An absent key means the property is unset all the way up,
 * and the consumer applies its own default (matching the pre-cascade
 * `readInheritedAttr` → null contract). Values are raw SVG strings; callers
 * parse them (color, number, keyword, …).
 */
export type StyleContext = Readonly<Record<string, string>>;

/** The empty cascade — seeds the root. */
export const EMPTY_STYLE: StyleContext = {};

/**
 * Inheritable presentation properties the leaf/text parsers consume. Extend
 * this list (and teach the consuming leaf to read the new key) to inherit a
 * new property — no per-attribute DOM walk required.
 */
const INHERITABLE = [
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-miterlimit',
  'color',
  'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor',
] as const;

/**
 * Extract a single `style="prop:value"` declaration. Returns the trimmed value
 * or null when absent. Regex scan — not a full CSS parser; no `!important`.
 */
export function readStyleProp(el: Element, prop: string): string | null {
  const style = el.getAttribute('style');
  if (!style) return null;
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const m = re.exec(style);
  if (!m) return null;
  return m[1].trim();
}

/**
 * Resolve an element's own value for a property: `style=""` beats the
 * presentation attribute on the same element (SVG2 specificity).
 */
export function ownProp(el: Element, prop: string): string | null {
  return readStyleProp(el, prop) ?? el.getAttribute(prop);
}

/**
 * Fold an element's own presentation attributes onto the inherited cascade.
 * A property that is absent or literally `inherit` keeps the parent value;
 * any other own value overrides. Returns the parent unchanged (same object)
 * when the element sets no inheritable property, avoiding a needless clone.
 */
export function deriveStyle(parent: StyleContext, el: Element): StyleContext {
  let next: Record<string, string> | null = null;
  for (const prop of INHERITABLE) {
    const own = ownProp(el, prop);
    if (own == null || own === 'inherit') continue;
    if (!next) next = { ...parent };
    next[prop] = own;
  }
  return next ?? parent;
}

/**
 * Resolve a paint value that may be the `currentColor` keyword against the
 * cascade's `color`. Non-currentColor values pass through; null passes through.
 * `color`'s SVG initial value is black.
 */
export function resolveCurrentColor(raw: string | null, style: StyleContext): string | null {
  if (raw == null) return null;
  if (raw.trim().toLowerCase() === 'currentcolor') return style['color'] ?? '#000000';
  return raw;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/svg/src/cascade.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add packages/svg/src/cascade.ts packages/svg/src/cascade.test.ts
git commit -m "feat(svg): add StyleContext cascade primitive

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Thread `StyleContext` through `parse.ts` (behavior-preserving refactor)

This is one atomic refactor guarded by the **existing** `parse.test.ts` + `roundtrip.test.ts` suites — no new tests; the gate is that they stay green. `currentColor` and text cascade are added in Tasks 3–4.

**Files:**
- Modify: `packages/svg/src/parse.ts`
- Test (regression gate): `packages/svg/src/parse.test.ts`, `packages/svg/src/roundtrip.test.ts`

- [ ] **Step 1: Confirm the existing suite is green before touching anything**

Run: `npx vitest run packages/svg/src`
Expected: PASS (baseline).

- [ ] **Step 2: Import the cascade module and delete the moved/retired helpers**

In `parse.ts`, add to the import block (near line 27):

```ts
import { collectGradients, type GradientTable } from './gradients';
import { deriveStyle, EMPTY_STYLE, ownProp, type StyleContext } from './cascade';
```

Delete `readStyleProp` (parse.ts:417–427) and `readInheritedAttr` (parse.ts:443–456) entirely — `readStyleProp` now lives in `cascade.ts` and `readInheritedAttr` is replaced by context lookups below.

- [ ] **Step 3: Add the `style` parameter to `parseChildren` and thread it**

Replace `parseChildren` (parse.ts:212–233) with:

```ts
function parseChildren(
  parent: Element,
  ctm: Matrix,
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (m: string) => void,
  uriToPrefix: Map<string, string>,
): SvgNode[] {
  const out: SvgNode[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const el = parent.children[i];
    const ns = el.namespaceURI;
    if (ns && ns !== 'http://www.w3.org/2000/svg') continue;
    const node = parseElement(el, ctm, style, gradients, onWarn, uriToPrefix);
    if (node) {
      if (Array.isArray(node)) out.push(...node);
      else out.push(node);
    }
  }
  return out;
}
```

- [ ] **Step 4: Add the `style` parameter to `parseElement`; derive at group/svg/leaf**

Change the `parseElement` signature (parse.ts:235–241) to insert `style` after `ctm`:

```ts
function parseElement(
  el: Element,
  ctm: Matrix,
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (m: string) => void,
  uriToPrefix: Map<string, string>,
): SvgNode | SvgNode[] | null {
```

In the `<g>` branch (parse.ts:244–254), derive and pass the child style:

```ts
  if (tag === 'g') {
    const local = parseTransform(el.getAttribute('transform'), onWarn);
    const childCtm = multiply(ctm, local);
    const childStyle = deriveStyle(style, el);
    const children = parseChildren(el, childCtm, childStyle, gradients, onWarn, uriToPrefix);
    const opacity = readOpacityAttr(el, 'opacity');
    const group: SvgNode = { kind: 'group', children };
    if (opacity != null) group.opacity = opacity;
    const meta = collectElementMeta(el, uriToPrefix);
    if (meta) group.meta = meta;
    return group;
  }
```

In the nested-`<svg>` branch (parse.ts:255–258):

```ts
  if (SUPPORTED_GROUP_TAGS.has(tag)) {
    // Nested <svg> — transparent group; inheritance flows through it.
    const childStyle = deriveStyle(style, el);
    return parseChildren(el, ctm, childStyle, gradients, onWarn, uriToPrefix);
  }
```

In the `text` branch (parse.ts:259–266), forward `style`:

```ts
  if (tag === 'text') {
    const textNode = parseTextElement(el, ctm, style, gradients, onWarn);
    if (textNode && !Array.isArray(textNode) && textNode.kind === 'text') {
      const meta = collectElementMeta(el, uriToPrefix);
      if (meta) textNode.meta = meta;
    }
    return textNode;
  }
```

- [ ] **Step 5: Migrate the leaf paint/stroke/fill-rule/line sites to the context**

In `parseElement`'s leaf section, replace the block at parse.ts:297–315 (from `const fill = readPaint(...)` through the `<line>` gate) with:

```ts
  const leafStyle = deriveStyle(style, el);
  const fill = readPaint(leafStyle, 'fill', '#000000', gradients, onWarn);
  const stroke = readStroke(leafStyle, gradients, onWarn);
  const opacity = readOpacityAttr(el, 'opacity');
  // `fill-rule` defaults to `nonzero`; only stamp when explicitly `evenodd`
  // and the lowered geometry is a PolygonPath (RectPath has no fillRule slot).
  const fillRuleRaw = leafStyle['fill-rule'] ?? null;
  if (fillRuleRaw === 'evenodd' && path.kind === 'polygon') {
    path = { ...path, fillRule: 'evenodd' };
  }
  const node: SvgPathNode = { kind: 'path', path, fill };
  if (stroke) node.stroke = stroke;
  if (opacity != null) node.opacity = opacity;
  if (rotation != null) node.rotation = rotation;
  // Lines are stroke-only by SVG convention; force fill=none if neither the
  // line nor an ancestor group specifies a fill.
  if (tag === 'line' && (leafStyle['fill'] ?? null) == null) {
    node.fill = { kind: 'none' };
  }
```

(The `<polyline>` no-op comment block at parse.ts:316–320 and the `meta`/`return node` tail at 321–323 are unchanged.)

- [ ] **Step 6: Migrate `readPaint` to take a `StyleContext`**

Replace `readPaint` (parse.ts:458–494) with (note: signature drops `el`, gains `style`; `currentColor` is added in Task 3 — this version is behavior-identical):

```ts
function readPaint(
  style: StyleContext,
  attr: 'fill' | 'stroke',
  defaultColor: string,
  gradients: GradientTable,
  onWarn: (msg: string) => void,
): SvgPaint {
  const raw = style[attr] ?? null;
  const opacityRaw = style[`${attr}-opacity`];
  const opacity = opacityRaw != null ? clamp01(parseFloat(opacityRaw)) : undefined;
  if (raw == null) {
    if (attr === 'stroke') return { kind: 'none' };
    const out: SvgPaint = { kind: 'solid', color: defaultColor };
    if (opacity != null) (out as { opacity?: number }).opacity = opacity;
    return out;
  }
  const parsed = parsePaintAttr(raw);
  if (!parsed) {
    onWarn(`unrecognized ${attr} value: ${raw}`);
    return { kind: 'solid', color: defaultColor };
  }
  if (parsed.kind === 'none') return { kind: 'none' };
  if (parsed.kind === 'ref') {
    const paint = gradients.get(parsed.id);
    if (!paint) {
      onWarn(`${attr} references unknown gradient #${parsed.id}`);
      return { kind: 'solid', color: defaultColor };
    }
    return { kind: 'gradient', paint };
  }
  const out: SvgPaint = { kind: 'solid', color: parsed.color };
  const a = opacity ?? (parsed.alpha < 1 ? parsed.alpha : undefined);
  if (a != null) (out as { opacity?: number }).opacity = a;
  return out;
}
```

- [ ] **Step 7: Migrate `readStroke` to take a `StyleContext`**

Replace `readStroke` (parse.ts:496–543) with (every `readInheritedAttr(el, X)` → `style[X] ?? null`; body otherwise identical):

```ts
function readStroke(
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (msg: string) => void,
): SvgStroke | undefined {
  const inheritedStroke = style['stroke'] ?? null;
  const inheritedWidth = style['stroke-width'] ?? null;
  if (inheritedStroke == null && inheritedWidth == null) return undefined;
  const paint = readPaint(style, 'stroke', '#000000', gradients, onWarn);
  if (paint.kind === 'none') return undefined;
  const width = inheritedWidth != null ? parseFloat(inheritedWidth) : 1;
  const stroke: SvgStroke = { paint, width };
  const opacityRaw = style['stroke-opacity'];
  if (opacityRaw != null) {
    const a = clamp01(parseFloat(opacityRaw));
    if (Number.isFinite(a)) stroke.opacity = a;
  }
  const cap = style['stroke-linecap'] ?? null;
  if (cap === 'butt' || cap === 'round' || cap === 'square') {
    stroke.cap = cap;
  } else if (cap != null) {
    onWarn(`unsupported stroke-linecap: ${cap}`);
  }
  const join = style['stroke-linejoin'] ?? null;
  if (join === 'miter' || join === 'round' || join === 'bevel') {
    stroke.join = join;
  } else if (join === 'arcs' || join === 'miter-clip') {
    onWarn(`stroke-linejoin "${join}" not supported; falling back to miter`);
    stroke.join = 'miter';
  } else if (join != null) {
    onWarn(`unsupported stroke-linejoin: ${join}`);
  }
  const dashAttr = style['stroke-dasharray'] ?? null;
  if (dashAttr != null && dashAttr.trim() !== '' && dashAttr.trim() !== 'none') {
    const parsed = parseDashArray(dashAttr);
    if (parsed) stroke.dash = parsed;
    else onWarn(`unrecognized stroke-dasharray: ${dashAttr}`);
  }
  const miterAttr = style['stroke-miterlimit'] ?? null;
  if (miterAttr != null) {
    const m = parseFloat(miterAttr);
    if (Number.isFinite(m) && m >= 1) stroke.miterLimit = m;
    else onWarn(`unrecognized stroke-miterlimit: ${miterAttr}`);
  }
  return stroke;
}
```

- [ ] **Step 8: Seed the root cascade in `parseSvg`**

In `parseSvg`, replace the `parseChildren` call (parse.ts:72) with:

```ts
  const gradients = collectGradients(root, onWarn);
  const rootStyle = deriveStyle(EMPTY_STYLE, root);
  const nodes = parseChildren(root, IDENTITY_MATRIX, rootStyle, gradients, onWarn, uriToPrefix);
```

(Seeding from `root` preserves inheritance from presentation attrs on the `<svg>` element itself, e.g. `<svg fill="red">`.)

- [ ] **Step 9: Run the full package suite (regression gate)**

Run: `npx vitest run packages/svg/src`
Expected: PASS — `parse.test.ts`, `roundtrip.test.ts`, `warnings.test.ts`, `path-commands.test.ts`, and `cascade.test.ts` all green. If any fail, the refactor changed behavior — fix before committing.

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit -p packages/svg/tsconfig.json` (or, if the package has no own tsconfig, `npx tsc --noEmit` from repo root).
Expected: no errors — confirms no dangling `el` references or missing `readInheritedAttr`.

- [ ] **Step 11: Commit**

```bash
git add packages/svg/src/parse.ts
git commit -m "refactor(svg): thread StyleContext through parse, retire readInheritedAttr

Behavior-preserving: existing parse/roundtrip suites stay green.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `currentColor` resolution

**Files:**
- Modify: `packages/svg/src/parse.ts:readPaint` (one line)
- Test: `packages/svg/src/parse.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/svg/src/parse.test.ts` (uses the existing `firstPath(svg)` helper that drills to the first path leaf):

```ts
describe('currentColor', () => {
  it('resolves fill="currentColor" against an inherited color', () => {
    const p = firstPath('<svg><g color="#00ff00"><rect width="4" height="4" fill="currentColor"/></g></svg>');
    expect(p.fill).toMatchObject({ color: '#00ff00' });
  });

  it('defaults currentColor to black when color is unset', () => {
    const p = firstPath('<svg><rect width="4" height="4" fill="currentColor"/></svg>');
    expect(p.fill).toMatchObject({ color: '#000000' });
  });

  it('resolves stroke="currentColor" against an inherited color', () => {
    const p = firstPath('<svg><g color="#0000ff"><rect width="4" height="4" stroke="currentColor" stroke-width="2"/></g></svg>');
    expect(p.stroke?.paint).toMatchObject({ color: '#0000ff' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/svg/src/parse.test.ts -t currentColor`
Expected: FAIL — `currentColor` currently reaches `parsePaintAttr` unresolved (unrecognized value → falls back to default black, so the inherited-color case fails).

- [ ] **Step 3: Wire `resolveCurrentColor` into `readPaint`**

In `parse.ts`, extend the cascade import:

```ts
import { deriveStyle, EMPTY_STYLE, ownProp, resolveCurrentColor, type StyleContext } from './cascade';
```

In `readPaint`, change the `raw` line from:

```ts
  const raw = style[attr] ?? null;
```

to:

```ts
  const raw = resolveCurrentColor(style[attr] ?? null, style);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/svg/src/parse.test.ts -t currentColor`
Expected: PASS.

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run packages/svg/src`
Expected: PASS.

```bash
git add packages/svg/src/parse.ts packages/svg/src/parse.test.ts
git commit -m "feat(svg): resolve currentColor against the inherited color cascade

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Text cascade fix

Text currently reads font/fill self-only via `el.getAttribute`, ignoring `<g>` inheritance and `style=""`. Route `readTextStyle` through the threaded context; keep `<tspan>` runs as self-relative overrides (the delta model) but give them `style=""` support via `ownProp`.

**Files:**
- Modify: `packages/svg/src/parse.ts` (`parseTextElement`, `readTextStyle`, `readTspanRun`)
- Test: `packages/svg/src/parse.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/svg/src/parse.test.ts` (defines a local `firstText` helper):

```ts
import type { SvgTextNode } from './types';

function firstText(svg: string): SvgTextNode {
  const { nodes } = parseSvg(svg);
  const walk = (ns: typeof nodes): SvgTextNode | null => {
    for (const n of ns) {
      if (n.kind === 'text') return n;
      if (n.kind === 'group') {
        const t = walk(n.children);
        if (t) return t;
      }
    }
    return null;
  };
  const t = walk(nodes);
  if (!t) throw new Error('no <text> node produced');
  return t;
}

describe('text cascade', () => {
  it('inherits fill from an ancestor <g>', () => {
    const t = firstText('<svg><g fill="#ff0000"><text x="0" y="10">hi</text></g></svg>');
    expect(t.style?.fill).toMatchObject({ color: '#ff0000' });
  });

  it('inherits font-family from an ancestor <g>', () => {
    const t = firstText('<svg><g font-family="Georgia"><text x="0" y="10">hi</text></g></svg>');
    expect(t.style?.fontFamily).toBe('Georgia');
  });

  it('honors style="" on the text element', () => {
    const t = firstText('<svg><text x="0" y="10" style="font-family:Georgia">hi</text></svg>');
    expect(t.style?.fontFamily).toBe('Georgia');
  });

  it('a <tspan> inherits the base font from an ancestor <g> via the text style', () => {
    const t = firstText('<svg><g font-family="Georgia"><text x="0" y="10"><tspan>a</tspan></text></g></svg>');
    expect(t.style?.fontFamily).toBe('Georgia');
    // The run carries no redundant fontFamily override — the base style holds it.
    expect(t.runs).toBeUndefined();
  });

  it('resolves text fill="currentColor" against inherited color', () => {
    const t = firstText('<svg><g color="#00ff00"><text x="0" y="10" fill="currentColor">hi</text></g></svg>');
    expect(t.style?.fill).toMatchObject({ color: '#00ff00' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/svg/src/parse.test.ts -t "text cascade"`
Expected: FAIL — inherited fill/font not picked up (text reads self-only today).

- [ ] **Step 3: Thread the context into `parseTextElement`**

Change the `parseTextElement` signature (parse.ts:583–588) to insert `style` after `ctm`:

```ts
function parseTextElement(
  el: Element,
  ctm: Matrix,
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): SvgNode | null {
```

Inside the body, the local variable currently named `style` (the parsed `TextStyle`, parse.ts:609) collides with the new param — rename it. Replace parse.ts:609–611:

```ts
  const leafStyle = deriveStyle(style, el);
  const textStyle = readTextStyle(leafStyle, el, gradients, onWarn);
  const fontSize = textStyle.fontSize ?? 16;
  const lineHeight = textStyle.lineHeight ?? 1.2;
```

Then update the two later references to the old local at parse.ts:671:

```ts
  if (Object.keys(textStyle).length > 0) node.style = textStyle;
```

(The `hasStyling`/`runs` logic at parse.ts:663–670 is unchanged — it inspects `runs`, not the renamed local.)

- [ ] **Step 4: Migrate `readTextStyle` to read from the context**

Replace `readTextStyle` (parse.ts:720–768) with (reads from `StyleContext`; keeps `el` only for the self-only `stroke` warning; internal accumulator renamed `out` to avoid shadowing):

```ts
function readTextStyle(
  style: StyleContext,
  el: Element,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): TextStyle {
  const out: TextStyle = {};
  const sz = style['font-size'];
  if (sz != null) {
    const n = parseFloat(sz);
    if (Number.isFinite(n)) out.fontSize = n;
  }
  const ff = style['font-family'];
  if (ff) out.fontFamily = ff;
  const fw = style['font-weight'];
  if (fw != null) {
    const n = parseFloat(fw);
    out.fontWeight = Number.isFinite(n) ? n : fw;
  }
  const fs = style['font-style'];
  if (fs === 'italic' || fs === 'normal') out.fontStyle = fs;
  const anchor = style['text-anchor'];
  if (anchor === 'start') out.align = 'left';
  else if (anchor === 'middle') out.align = 'center';
  else if (anchor === 'end') out.align = 'right';
  const fillRaw = resolveCurrentColor(style['fill'] ?? null, style);
  if (fillRaw) {
    const parsed = parsePaintAttr(fillRaw);
    if (parsed?.kind === 'solid') {
      out.fill = { fill: 'solid', color: parsed.color } as FillStyle;
    } else if (parsed?.kind === 'ref') {
      const paint = gradients.get(parsed.id);
      if (paint) out.fill = paint;
    }
    // parsed.kind === 'none' → leave fill undefined (defaults to black downstream).
  }
  if (el.hasAttribute('stroke')) {
    onWarn('<text stroke="..."> not supported on text; ignoring');
  }
  return out;
}
```

- [ ] **Step 5: Give `<tspan>` runs style="" support via `ownProp`**

Replace `readTspanRun` (parse.ts:693–718) — swap each `el.getAttribute(x)` for `ownProp(el, x)`; logic otherwise identical (runs stay self-relative overrides):

```ts
function readTspanRun(el: Element, gradients: GradientTable): StyledRun {
  const text = el.textContent ?? '';
  const run: StyledRun = { text };
  const fw = ownProp(el, 'font-weight');
  if (fw === 'bold' || fw === '700' || fw === 'bolder') run.bold = true;
  const fs = ownProp(el, 'font-style');
  if (fs === 'italic' || fs === 'oblique') run.italic = true;
  const ff = ownProp(el, 'font-family');
  if (ff) run.fontFamily = ff;
  const sz = ownProp(el, 'font-size');
  if (sz != null) {
    const n = parseFloat(sz);
    if (Number.isFinite(n)) run.fontSize = n;
  }
  const fillAttr = ownProp(el, 'fill');
  if (fillAttr) {
    const parsed = parsePaintAttr(fillAttr);
    if (parsed?.kind === 'solid') {
      run.fill = { fill: 'solid', color: parsed.color };
    } else if (parsed?.kind === 'ref') {
      const paint = gradients.get(parsed.id);
      if (paint) run.fill = paint;
    }
  }
  return run;
}
```

- [ ] **Step 6: Run the text-cascade tests**

Run: `npx vitest run packages/svg/src/parse.test.ts -t "text cascade"`
Expected: PASS.

- [ ] **Step 7: Full suite + typecheck + commit**

Run: `npx vitest run packages/svg/src`
Expected: PASS (all files, including `roundtrip.test.ts`).

Run: `npx tsc --noEmit` (repo root)
Expected: no errors.

```bash
git add packages/svg/src/parse.ts packages/svg/src/parse.test.ts
git commit -m "fix(svg): text and <tspan> honor the presentation-attribute cascade

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Final gate + retire the TODO item

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Run the release-gate checks**

Run: `npx tsc --noEmit && npx vitest run packages/svg/src`
Expected: PASS on both. (Full-repo `npx vitest run` is fine too if the package suite is green and you want the broader safety net.)

- [ ] **Step 2: Update the TODO entry**

In `docs/TODO.md`, under **Paths & booleans**, the "Generic CSS cascade for `@weasel-js/svg`'s parser" P2 item is now done. Per the completed-entry retention policy, delete the P2 bullet body and its High-priority-index line (line ~29: `Generic CSS cascade for @weasel-js/svg's parser → Paths & booleans`), and leave a single P3 follow-up capturing the genuinely-remaining scope:

```markdown
- **(P3) `<style>`-element and class-selector support for `@weasel-js/svg`.**
  The presentation-attribute cascade now threads a resolved `StyleContext`
  through the recursive parse (`packages/svg/src/cascade.ts`, shipped
  2026-07-25) — inheritance, `inherit`, `style=""`, text cascade, and
  `currentColor` all resolve without per-attribute DOM walks. Still
  unsupported: `<style>` elements and class/selector matching (the cascade
  handles inheritance, not selector specificity). `style=""` remains a regex
  scan, not a full CSS parser (`!important` unsupported). Add when a real
  consumer imports an SVG that styles via `<style>`/classes.
```

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs: retire SVG cascade TODO; leave <style>/selectors follow-up

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** threaded context (Task 2), delete walk-ups (Task 2 Step 2/6/7), text cascade (Task 4), currentColor (Task 3), `opacity`/`transform` untouched (never added to `INHERITABLE`; `readOpacityAttr`/`parseTransform` unmodified), `style=""` stays regex (moved verbatim), `<style>`/selectors out (Task 5 follow-up), tests + roundtrip gate (Tasks 2/3/4). All covered.
- **Type consistency:** `StyleContext` param inserted after `ctm` uniformly across `parseChildren`/`parseElement`/`parseTextElement`; `readPaint`/`readStroke` take `StyleContext` as first arg; `readTextStyle(style, el, gradients, onWarn)`; helper names `deriveStyle`/`ownProp`/`readStyleProp`/`resolveCurrentColor`/`EMPTY_STYLE` match between `cascade.ts` and every `parse.ts` call site.
- **Naming hazard flagged:** `parseTextElement`'s existing local `style` (a `TextStyle`) is renamed `textStyle` to avoid colliding with the new `StyleContext` param (Task 4 Step 3).
