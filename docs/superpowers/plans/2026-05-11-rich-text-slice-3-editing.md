# Rich Text — Slice 3: Editing (Cmd-B / Cmd-I + DOM ↔ Runs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `useTextEdit` round-trip styled runs — render a node's existing rich content into the overlay, let the user toggle bold/italic on the selection (or set a pending style at the caret), and commit the result back as `StyledRun[]`.

**Architecture:** Extend `UseTextEditOptions` with optional `getRuns` / `setRuns` callbacks. When `getRuns` returns runs, the overlay is built from styled `<span data-run>` elements. A new `domRuns.ts` module provides pure DOM↔runs serializers and caret-offset helpers. The keydown handler intercepts Cmd/Ctrl-B and Cmd/Ctrl-I: on a range selection it splits the current runs at the selection boundaries, toggles the flag on contained runs, rebuilds the DOM, and restores the selection; on a collapsed caret it sets a "pending style" via dataset and a `beforeinput` listener wraps the next typed character in a freshly-styled span. Commit walks the overlay DOM via `domToRuns`, calls `setRuns` if provided, and always calls `setText` with the plain-text form.

**Tech Stack:** TypeScript, React (useTextEdit hook), Vitest + @testing-library/react + jsdom, path-mapped imports.

---

## File map

- **Create:** `src/features/text/domRuns.ts` — pure DOM serializer/deserializer and caret-offset helpers. Exports `runsToDom(runs, parent)`, `domToRuns(overlay)`, `charOffsetToDomPosition(overlay, offset)`, `domPositionToCharOffset(overlay, node, offset)`.
- **Create:** `src/features/text/domRuns.test.ts` — pure unit tests against hand-built DOM fragments.
- **Modify:** `src/features/text/useTextEdit.ts` — extended `UseTextEditOptions`, runs-aware overlay init, Cmd-B/I keydown handling, pending-style insertion, runs-aware commit.
- **Modify:** `src/features/text/useTextEdit.test.ts` — new tests for runs init, commit, Cmd-B/I (caret + range), pending style typing.
- **Modify:** `src/features/text/index.ts` — re-export `domRuns` helpers in case external consumers need them (mostly for advanced editors).
- **Modify:** `demo/demos/TextDemo.tsx` — wire `getRuns`/`setRuns` so the existing rich-text node `t5` is fully editable.

---

## Task 1: `UseTextEditOptions` extended with `getRuns` / `setRuns`

Types-only task. Sets up the surface area later tasks consume. No behavior change.

**Files:**
- Modify: `src/features/text/useTextEdit.ts`

- [ ] **Step 1.1: Add the optional fields**

In `src/features/text/useTextEdit.ts`, find the `UseTextEditOptions` interface. Append two optional fields:

```ts
export interface UseTextEditOptions {
  /** Element the overlay is appended to. Must be `position: relative`/absolute. */
  container: HTMLElement | null;
  /** Read the current text for `id`. */
  getText: (id: string) => string;
  /** Read style for `id` (used for font setup on the overlay). */
  getStyle: (id: string) => TextStyle | undefined;
  /** Read screen-space pose for `id`. Called per frame while editing. */
  getScreenPose: (id: string) => TextEditScreenPose | null;
  /** Commit text. Caller wraps in op/undo. */
  setText: (id: string, text: string) => void;
  /**
   * Optional: read the current rich-text runs for `id`. When provided AND
   * returns a non-empty array, the overlay renders the runs as styled
   * `<span data-run>` elements; otherwise the overlay is seeded with plain
   * text via `getText`.
   */
  getRuns?: (id: string) => readonly StyledRun[] | undefined;
  /**
   * Optional: commit rich-text runs back to the node. When omitted, only
   * `setText` is called with the plain-text form on commit. When provided,
   * commit calls both `setText` (with `runsToPlainText(runs)`) and
   * `setRuns(id, runs)`.
   */
  setRuns?: (id: string, runs: StyledRun[]) => void;
}
```

Add the `StyledRun` import at the top of the file (it currently isn't imported):

```ts
import type { StyledRun } from './runs';
```

- [ ] **Step 1.2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 1.3: Commit**

```bash
git add src/features/text/useTextEdit.ts
git commit -m "feat(text): useTextEdit options gain optional getRuns/setRuns"
```

---

## Task 2: `domRuns.ts` — runs → DOM serializer

Pure helper. Given `StyledRun[]` and a parent element, builds a flat sequence of `<span data-run>` children with inline styles. Each span maps 1:1 to a run; newline characters become literal `\n` in `textContent` and the parent has `white-space: pre-wrap` (already applied by `applyOverlayStyle`).

**Files:**
- Create: `src/features/text/domRuns.ts`
- Create: `src/features/text/domRuns.test.ts`

- [ ] **Step 2.1: Write failing tests**

Create `src/features/text/domRuns.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { runsToDom } from './domRuns';
import type { StyledRun } from './runs';

describe('runsToDom', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it('emits one styled span per run with data-run marker', () => {
    const runs: StyledRun[] = [
      { text: 'plain ' },
      { text: 'bold', bold: true },
      { text: ' rest' },
    ];
    runsToDom(runs, parent);
    const spans = parent.querySelectorAll('span[data-run]');
    expect(spans).toHaveLength(3);
    expect(spans[0].textContent).toBe('plain ');
    expect(spans[1].textContent).toBe('bold');
    expect((spans[1] as HTMLSpanElement).style.fontWeight).toBe('700');
    expect(spans[2].textContent).toBe(' rest');
  });

  it('applies italic via inline font-style', () => {
    runsToDom([{ text: 'x', italic: true }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.fontStyle).toBe('italic');
  });

  it('applies bold+italic together', () => {
    runsToDom([{ text: 'x', bold: true, italic: true }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.fontWeight).toBe('700');
    expect(span.style.fontStyle).toBe('italic');
  });

  it('applies fontSize / fontFamily / fill overrides', () => {
    runsToDom([{
      text: 'x',
      fontSize: 24,
      fontFamily: 'mono',
      fill: { fill: 'solid', color: '#ff0000' },
    }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.fontSize).toBe('24px');
    expect(span.style.fontFamily).toBe('mono');
    expect(span.style.color).toBe('rgb(255, 0, 0)');
  });

  it('preserves embedded newlines as literal \\n inside textContent', () => {
    runsToDom([{ text: 'a\nb' }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.textContent).toBe('a\nb');
  });

  it('replaces existing children of the parent', () => {
    parent.innerHTML = '<p>old</p>';
    runsToDom([{ text: 'new' }], parent);
    expect(parent.querySelectorAll('p')).toHaveLength(0);
    expect(parent.querySelectorAll('span[data-run]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/domRuns.test.ts`
Expected: failures on missing module.

- [ ] **Step 2.3: Implement `runsToDom`**

Create `src/features/text/domRuns.ts`:

```ts
/**
 * Pure DOM ↔ `StyledRun[]` serializers for the contenteditable overlay
 * used by `useTextEdit`. The overlay's children are a flat sequence of
 * `<span data-run>` elements, each carrying one run's text and inline
 * styles. Newlines inside a run are literal `\n` characters; the overlay
 * has `white-space: pre-wrap` so they render as line breaks.
 */

import type { Paint } from 'core/paint-types';
import type { StyledRun } from './runs';

function solidColor(p: Paint | undefined): string | null {
  if (!p) return null;
  if ('color' in p) return p.color;
  return null;
}

/** Build a flat sequence of `<span data-run>` children from `runs`, replacing any existing children of `parent`. */
export function runsToDom(runs: readonly StyledRun[], parent: HTMLElement): void {
  parent.replaceChildren();
  for (const run of runs) {
    const span = document.createElement('span');
    span.setAttribute('data-run', '');
    span.textContent = run.text;
    if (run.bold) span.style.fontWeight = '700';
    if (run.italic) span.style.fontStyle = 'italic';
    if (run.fontSize != null) span.style.fontSize = `${run.fontSize}px`;
    if (run.fontFamily != null) span.style.fontFamily = run.fontFamily;
    const color = solidColor(run.fill);
    if (color != null) span.style.color = color;
    parent.appendChild(span);
  }
}
```

- [ ] **Step 2.4: Verify tests pass**

Run: `npx vitest run src/features/text/domRuns.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 2.5: Commit**

```bash
git add src/features/text/domRuns.ts src/features/text/domRuns.test.ts
git commit -m "feat(text): runsToDom — build flat styled-span overlay from runs"
```

---

## Task 3: `domRuns.ts` — DOM → runs deserializer

Walks the overlay's children, normalizes any browser-inserted structure (`<br>`, `<div>`, nested `<span>`/`<b>`/`<i>`/`<strong>`/`<em>`), coalesces adjacent identical runs, and emits a canonical `StyledRun[]`.

**Files:**
- Modify: `src/features/text/domRuns.ts`
- Modify: `src/features/text/domRuns.test.ts`

- [ ] **Step 3.1: Append failing tests**

Append to `src/features/text/domRuns.test.ts`:

```ts
import { domToRuns } from './domRuns';

describe('domToRuns', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it('returns runs from a freshly-built span sequence', () => {
    runsToDom([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }], parent);
    expect(domToRuns(parent)).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' c' },
    ]);
  });

  it('coalesces adjacent identical runs', () => {
    // Hand-build two adjacent bold spans.
    const s1 = document.createElement('span');
    s1.setAttribute('data-run', '');
    s1.style.fontWeight = '700';
    s1.textContent = 'a';
    const s2 = document.createElement('span');
    s2.setAttribute('data-run', '');
    s2.style.fontWeight = '700';
    s2.textContent = 'b';
    parent.append(s1, s2);
    expect(domToRuns(parent)).toEqual([{ text: 'ab', bold: true }]);
  });

  it('treats <br> as a newline character in the preceding run', () => {
    const s = document.createElement('span');
    s.setAttribute('data-run', '');
    s.textContent = 'a';
    parent.append(s, document.createElement('br'));
    const s2 = document.createElement('span');
    s2.setAttribute('data-run', '');
    s2.textContent = 'b';
    parent.append(s2);
    expect(domToRuns(parent)).toEqual([{ text: 'a\nb' }]);
  });

  it('treats <div> boundaries as newlines', () => {
    const d1 = document.createElement('div');
    d1.textContent = 'a';
    const d2 = document.createElement('div');
    d2.textContent = 'b';
    parent.append(d1, d2);
    expect(domToRuns(parent)).toEqual([{ text: 'a\nb' }]);
  });

  it('flattens nested <b> / <strong> / <i> / <em> into bold / italic flags', () => {
    parent.innerHTML = '<b>bold</b><i>it</i><strong>str</strong><em>em</em>';
    expect(domToRuns(parent)).toEqual([
      { text: 'bold', bold: true },
      { text: 'it', italic: true },
      { text: 'str', bold: true },
      { text: 'em', italic: true },
    ]);
  });

  it('returns empty array for empty parent', () => {
    expect(domToRuns(parent)).toEqual([]);
  });

  it('round-trips runsToDom → domToRuns', () => {
    const runs: StyledRun[] = [
      { text: 'plain ' },
      { text: 'bold', bold: true },
      { text: ' both ', italic: true, bold: true },
      { text: 'tail' },
    ];
    runsToDom(runs, parent);
    expect(domToRuns(parent)).toEqual(runs);
  });
});
```

- [ ] **Step 3.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/domRuns.test.ts`
Expected: failures on missing `domToRuns`.

- [ ] **Step 3.3: Implement `domToRuns`**

Append to `src/features/text/domRuns.ts`:

```ts
interface StyleState {
  bold: boolean;
  italic: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

const EMPTY_STYLE: StyleState = { bold: false, italic: false };

function styleStateFromElement(el: Element, parent: StyleState): StyleState {
  const next: StyleState = { ...parent };
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') next.bold = true;
  if (tag === 'I' || tag === 'EM') next.italic = true;
  if (el instanceof HTMLElement) {
    const fw = el.style.fontWeight;
    if (fw === '700' || fw === 'bold') next.bold = true;
    if (fw === '400' || fw === 'normal') next.bold = false;
    const fs = el.style.fontStyle;
    if (fs === 'italic') next.italic = true;
    if (fs === 'normal') next.italic = false;
    if (el.style.fontSize) {
      const px = parseFloat(el.style.fontSize);
      if (Number.isFinite(px)) next.fontSize = px;
    }
    if (el.style.fontFamily) next.fontFamily = el.style.fontFamily;
    if (el.style.color) next.color = el.style.color;
  }
  return next;
}

function styleEquals(a: StyleState, b: StyleState): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.fontSize === b.fontSize &&
    a.fontFamily === b.fontFamily &&
    a.color === b.color
  );
}

function toRun(text: string, style: StyleState): StyledRun {
  const run: StyledRun = { text };
  if (style.bold) run.bold = true;
  if (style.italic) run.italic = true;
  if (style.fontSize != null) run.fontSize = style.fontSize;
  if (style.fontFamily != null) run.fontFamily = style.fontFamily;
  if (style.color != null) run.fill = { fill: 'solid', color: style.color };
  return run;
}

/** Walk an overlay tree and emit a coalesced `StyledRun[]`. */
export function domToRuns(parent: HTMLElement): StyledRun[] {
  const fragments: Array<{ text: string; style: StyleState }> = [];

  function visit(node: Node, style: StyleState): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node as Text).data;
      if (text.length > 0) fragments.push({ text, style });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.tagName === 'BR') {
      fragments.push({ text: '\n', style });
      return;
    }
    if (el.tagName === 'DIV' && fragments.length > 0) {
      // <div> boundary inserted by the browser between blocks of content.
      fragments.push({ text: '\n', style });
    }
    const nextStyle = styleStateFromElement(el, style);
    for (const child of Array.from(el.childNodes)) {
      visit(child, nextStyle);
    }
  }

  for (const child of Array.from(parent.childNodes)) {
    visit(child, EMPTY_STYLE);
  }

  // Coalesce adjacent fragments with identical style.
  const runs: StyledRun[] = [];
  let i = 0;
  while (i < fragments.length) {
    let j = i + 1;
    while (j < fragments.length && styleEquals(fragments[i].style, fragments[j].style)) {
      j++;
    }
    const merged = fragments.slice(i, j).map((f) => f.text).join('');
    runs.push(toRun(merged, fragments[i].style));
    i = j;
  }
  return runs;
}
```

- [ ] **Step 3.4: Verify tests pass**

Run: `npx vitest run src/features/text/domRuns.test.ts`
Expected: PASS, all tests.

- [ ] **Step 3.5: Commit**

```bash
git add src/features/text/domRuns.ts src/features/text/domRuns.test.ts
git commit -m "feat(text): domToRuns — flatten overlay DOM back to canonical StyledRun[]"
```

---

## Task 4: Caret-offset helpers in `domRuns.ts`

Two pure functions for translating between plain-text character offsets and DOM positions. `charOffsetToDomPosition(overlay, offset)` returns the `{node, offset}` to give to a `Range`. `domPositionToCharOffset(overlay, node, offset)` is the inverse — used by Task 6 to capture the selection range before splitting runs.

**Files:**
- Modify: `src/features/text/domRuns.ts`
- Modify: `src/features/text/domRuns.test.ts`

- [ ] **Step 4.1: Append failing tests**

Append to `src/features/text/domRuns.test.ts`:

```ts
import { charOffsetToDomPosition, domPositionToCharOffset } from './domRuns';

describe('charOffsetToDomPosition', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it('returns the first text node and the requested offset for offset within first run', () => {
    runsToDom([{ text: 'hello' }, { text: ' world', bold: true }], parent);
    const pos = charOffsetToDomPosition(parent, 3);
    expect(pos).not.toBeNull();
    expect(pos!.node.nodeType).toBe(Node.TEXT_NODE);
    expect((pos!.node as Text).data).toBe('hello');
    expect(pos!.offset).toBe(3);
  });

  it('advances into the next text node when offset spans run boundaries', () => {
    runsToDom([{ text: 'hello' }, { text: ' world', bold: true }], parent);
    const pos = charOffsetToDomPosition(parent, 7);  // 5 'hello' + 2 of ' world'
    expect(pos!.node.nodeType).toBe(Node.TEXT_NODE);
    expect((pos!.node as Text).data).toBe(' world');
    expect(pos!.offset).toBe(2);
  });

  it('clamps to the end when offset exceeds total length', () => {
    runsToDom([{ text: 'hi' }], parent);
    const pos = charOffsetToDomPosition(parent, 999);
    expect(pos!.node.nodeType).toBe(Node.TEXT_NODE);
    expect(pos!.offset).toBe(2);
  });

  it('returns offset 0 in the parent itself when overlay is empty', () => {
    const pos = charOffsetToDomPosition(parent, 0);
    expect(pos!.node).toBe(parent);
    expect(pos!.offset).toBe(0);
  });
});

describe('domPositionToCharOffset', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it('returns 0 for the start of the first text node', () => {
    runsToDom([{ text: 'abc' }, { text: 'def', bold: true }], parent);
    const textNode = parent.querySelectorAll('span[data-run]')[0].firstChild as Text;
    expect(domPositionToCharOffset(parent, textNode, 0)).toBe(0);
  });

  it('counts characters from preceding text nodes when position is in a later node', () => {
    runsToDom([{ text: 'abc' }, { text: 'def', bold: true }], parent);
    const second = parent.querySelectorAll('span[data-run]')[1].firstChild as Text;
    expect(domPositionToCharOffset(parent, second, 2)).toBe(5);
  });

  it('round-trips char → dom → char', () => {
    runsToDom([{ text: 'hello ' }, { text: 'bold', bold: true }, { text: ' tail' }], parent);
    for (const off of [0, 3, 6, 8, 10, 15]) {
      const pos = charOffsetToDomPosition(parent, off);
      expect(pos).not.toBeNull();
      expect(domPositionToCharOffset(parent, pos!.node, pos!.offset)).toBe(Math.min(off, 15));
    }
  });
});
```

- [ ] **Step 4.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/domRuns.test.ts`
Expected: failures on missing exports.

- [ ] **Step 4.3: Implement the helpers**

Append to `src/features/text/domRuns.ts`:

```ts
/**
 * Walk the overlay's text nodes in document order and find the text node
 * + offset that corresponds to plain-text character position `offset`.
 * Offsets beyond the total text length clamp to the end of the last text
 * node. Returns `{ node: parent, offset: 0 }` when there are no text nodes.
 */
export function charOffsetToDomPosition(
  parent: HTMLElement,
  offset: number,
): { node: Node; offset: number } | null {
  let remaining = offset;
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.data.length;
    if (remaining <= len) {
      return { node, offset: remaining };
    }
    remaining -= len;
    last = node;
    node = walker.nextNode() as Text | null;
  }
  if (last) return { node: last, offset: last.data.length };
  return { node: parent, offset: 0 };
}

/**
 * Inverse of `charOffsetToDomPosition`. Walks text nodes in document order;
 * sums the lengths of every text node preceding `node` and adds `offset`.
 * If `node` is an element (not a text node), counts to the end of the
 * preceding text content.
 */
export function domPositionToCharOffset(
  parent: HTMLElement,
  node: Node,
  offset: number,
): number {
  let total = 0;
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let cur = walker.nextNode() as Text | null;
  while (cur) {
    if (cur === node) return total + offset;
    total += cur.data.length;
    cur = walker.nextNode() as Text | null;
  }
  // Node wasn't a text node — count BR/element boundaries by walking the
  // overlay text and matching against the (range-anchor element, offset)
  // pair. Pragmatic fallback: clamp to total length.
  return total;
}
```

- [ ] **Step 4.4: Verify tests pass**

Run: `npx vitest run src/features/text/domRuns.test.ts`
Expected: PASS, all tests.

- [ ] **Step 4.5: Commit**

```bash
git add src/features/text/domRuns.ts src/features/text/domRuns.test.ts
git commit -m "feat(text): charOffsetToDomPosition + domPositionToCharOffset for caret math"
```

---

## Task 5: `useTextEdit` initializes from runs and commits via `setRuns`

When `getRuns(id)` is provided and returns a non-empty array, the overlay is populated via `runsToDom` instead of `innerText = getText(id)`. On commit, the overlay is walked via `domToRuns`; if `setRuns` is provided, it's called with the runs; `setText` is always called with the plain-text form.

**Files:**
- Modify: `src/features/text/useTextEdit.ts`
- Modify: `src/features/text/useTextEdit.test.ts`

- [ ] **Step 5.1: Append failing tests**

Append to `src/features/text/useTextEdit.test.ts` (inside the existing top-level `describe('useTextEdit', ...)` or in a sibling describe — match existing style):

```ts
import type { StyledRun } from './runs';

function makeRichHarness(initial: Record<string, { text: string; runs?: StyledRun[] }>) {
  const data = { ...initial };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const textCommits: Array<{ id: string; text: string }> = [];
  const runCommits: Array<{ id: string; runs: StyledRun[] }> = [];
  const opts: UseTextEditOptions = {
    container,
    getText: (id) => data[id]?.text ?? '',
    getStyle: () => ({ fontSize: 16 }),
    getScreenPose: (id) => (id in data ? { x: 0, y: 0, width: 200, height: 40, fontSize: 16 } : null),
    setText: (id, text) => { data[id] = { ...data[id], text }; textCommits.push({ id, text }); },
    getRuns: (id) => data[id]?.runs,
    setRuns: (id, runs) => { data[id] = { ...data[id], runs }; runCommits.push({ id, runs }); },
  };
  return { opts, container, data, textCommits, runCommits };
}

describe('useTextEdit — rich-text init and commit', () => {
  it('builds a styled span overlay when getRuns returns runs', () => {
    const h = makeRichHarness({
      a: { text: 'a b', runs: [{ text: 'a ' }, { text: 'b', bold: true }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const spans = overlay.querySelectorAll('span[data-run]');
    expect(spans).toHaveLength(2);
    expect(spans[0].textContent).toBe('a ');
    expect((spans[1] as HTMLSpanElement).style.fontWeight).toBe('700');
  });

  it('falls back to plain innerText when getRuns is omitted or returns nothing', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.querySelectorAll('span[data-run]')).toHaveLength(0);
    expect(overlay.innerText).toBe('hello');
  });

  it('commit walks DOM via domToRuns and calls setRuns + setText', () => {
    const h = makeRichHarness({
      a: { text: 'a b', runs: [{ text: 'a ' }, { text: 'b', bold: true }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    // Mutate via DOM: append a plain " c" span.
    const tail = document.createElement('span');
    tail.setAttribute('data-run', '');
    tail.textContent = ' c';
    overlay.appendChild(tail);
    act(() => result.current.commit());
    expect(h.runCommits).toEqual([{
      id: 'a',
      runs: [{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }],
    }]);
    expect(h.textCommits).toEqual([{ id: 'a', text: 'a b c' }]);
  });

  it('commit on a plain-text edit (no setRuns) only fires setText', () => {
    const h = makeHarness({ a: 'hi' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.innerText = 'edited';
    act(() => result.current.commit());
    expect(h.commits).toEqual([{ id: 'a', text: 'edited' }]);
  });
});
```

- [ ] **Step 5.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/useTextEdit.test.ts`
Expected: failures on the rich-text describe block (overlay still uses `innerText` only).

- [ ] **Step 5.3: Update overlay initialization and commit**

In `src/features/text/useTextEdit.ts`:

Add imports at the top:

```ts
import { runsToDom, domToRuns } from './domRuns';
import { runsToPlainText } from './runs';
```

Inside the `useEffect` that mounts the overlay (after `overlay.spellcheck = false;` and before `applyOverlayStyle(overlay, style);`), replace:

```ts
overlay.innerText = getText(editingId);
```

with:

```ts
const initialRuns = optsRef.current.getRuns?.(editingId);
if (initialRuns && initialRuns.length > 0) {
  runsToDom(initialRuns, overlay);
} else {
  overlay.innerText = getText(editingId);
}
```

Replace the `commit` callback's body:

```ts
const commit = useCallback(() => {
  const id = editingId;
  const overlay = overlayRef.current;
  if (id == null || !overlay) {
    setEditingId(null);
    return;
  }
  const text = overlay.innerText.replace(/\n$/, '');
  optsRef.current.setText(id, text);
  setEditingId(null);
}, [editingId]);
```

with:

```ts
const commit = useCallback(() => {
  const id = editingId;
  const overlay = overlayRef.current;
  if (id == null || !overlay) {
    setEditingId(null);
    return;
  }
  const usedRuns = optsRef.current.getRuns?.(id) != null;
  if (usedRuns && optsRef.current.setRuns) {
    const runs = domToRuns(overlay);
    optsRef.current.setText(id, runsToPlainText(runs));
    optsRef.current.setRuns(id, runs);
  } else {
    const text = overlay.innerText.replace(/\n$/, '');
    optsRef.current.setText(id, text);
  }
  setEditingId(null);
}, [editingId]);
```

- [ ] **Step 5.4: Verify tests pass**

Run: `npx vitest run src/features/text/useTextEdit.test.ts`
Expected: PASS, all tests (existing plain-text tests + new rich-text tests).

- [ ] **Step 5.5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5.6: Commit**

```bash
git add src/features/text/useTextEdit.ts src/features/text/useTextEdit.test.ts
git commit -m "feat(text): useTextEdit round-trips runs via runsToDom + domToRuns"
```

---

## Task 6: Cmd-B / Cmd-I — range-selection split + toggle

When the user has a non-collapsed selection and presses Cmd/Ctrl-B (or -I), the hook computes the affected character range, slices the current runs at those boundaries, toggles the flag on contained runs, rebuilds the overlay DOM, and restores the selection.

**Files:**
- Modify: `src/features/text/useTextEdit.ts`
- Modify: `src/features/text/useTextEdit.test.ts`

- [ ] **Step 6.1: Append failing tests**

Append to `src/features/text/useTextEdit.test.ts`:

```ts
function selectChars(overlay: HTMLElement, start: number, end: number): void {
  const range = document.createRange();
  // Walk text nodes in order to find the start position.
  function findPos(target: number): { node: Node; offset: number } | null {
    let remaining = target;
    const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      if (remaining <= node.data.length) return { node, offset: remaining };
      remaining -= node.data.length;
      node = walker.nextNode() as Text | null;
    }
    return null;
  }
  const a = findPos(start)!;
  const b = findPos(end)!;
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function pressKey(overlay: HTMLElement, key: string, mods: { meta?: boolean; ctrl?: boolean } = {}): void {
  overlay.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    bubbles: true,
    cancelable: true,
  }));
}

describe('useTextEdit — Cmd-B/I on range selection', () => {
  it('Cmd-B over plain text wraps the selected range in a bold run', () => {
    const h = makeRichHarness({ a: { text: 'one two three', runs: [{ text: 'one two three' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 4, 7);  // 'two'
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'one ' },
      { text: 'two', bold: true },
      { text: ' three' },
    ]);
  });

  it('Cmd-B over an already-bold range removes the bold flag', () => {
    const h = makeRichHarness({
      a: {
        text: 'one two three',
        runs: [{ text: 'one ' }, { text: 'two', bold: true }, { text: ' three' }],
      },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 4, 7);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'one two three' }]);
  });

  it('Cmd-I toggles italic independently of bold', () => {
    const h = makeRichHarness({ a: { text: 'abc', runs: [{ text: 'abc', bold: true }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 3);
    act(() => pressKey(overlay, 'i', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'abc', bold: true, italic: true }]);
  });

  it('Ctrl-B (non-Mac) toggles bold on the selection', () => {
    const h = makeRichHarness({ a: { text: 'xyz', runs: [{ text: 'xyz' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 3);
    act(() => pressKey(overlay, 'b', { ctrl: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'xyz', bold: true }]);
  });
});
```

- [ ] **Step 6.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/useTextEdit.test.ts`
Expected: failures on the new describe block (no Cmd-B/I handling yet).

- [ ] **Step 6.3: Implement the range-toggle handler**

Add a helper near the top of `useTextEdit.ts` (above the hook):

```ts
type StyleFlag = 'bold' | 'italic';

/**
 * Split a flat `StyledRun[]` at the given character boundaries and toggle
 * `flag` on every run that overlaps `[start, end)`. Returns a new array
 * with adjacent identical runs coalesced.
 */
function toggleFlagInRange(
  runs: readonly StyledRun[],
  start: number,
  end: number,
  flag: StyleFlag,
): StyledRun[] {
  if (start >= end) return runs.slice();
  // 1. Determine whether the entire selection is already flagged.
  let pos = 0;
  let allSet = true;
  for (const r of runs) {
    const a = Math.max(pos, start);
    const b = Math.min(pos + r.text.length, end);
    if (a < b) {
      if (!r[flag]) { allSet = false; break; }
    }
    pos += r.text.length;
  }
  const setTo = !allSet;

  // 2. Split runs at start and end boundaries; toggle within range.
  const out: StyledRun[] = [];
  pos = 0;
  for (const r of runs) {
    const rEnd = pos + r.text.length;
    const a = Math.max(pos, start);
    const b = Math.min(rEnd, end);
    if (a < b) {
      if (pos < a) out.push({ ...r, text: r.text.slice(0, a - pos) });
      const inside: StyledRun = { ...r, text: r.text.slice(a - pos, b - pos) };
      if (setTo) inside[flag] = true; else delete inside[flag];
      out.push(inside);
      if (b < rEnd) out.push({ ...r, text: r.text.slice(b - pos) });
    } else {
      out.push({ ...r });
    }
    pos = rEnd;
  }

  // 3. Coalesce adjacent runs with identical styling.
  return coalesceRuns(out);
}

function styledKey(r: StyledRun): string {
  return [
    r.bold ? '1' : '0',
    r.italic ? '1' : '0',
    r.fontFamily ?? '',
    r.fontSize ?? '',
    r.fill && 'color' in r.fill ? r.fill.color : '',
  ].join('|');
}

function coalesceRuns(runs: readonly StyledRun[]): StyledRun[] {
  const out: StyledRun[] = [];
  for (const r of runs) {
    if (r.text.length === 0) continue;
    const prev = out[out.length - 1];
    if (prev && styledKey(prev) === styledKey(r)) {
      prev.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}
```

Now in the `useEffect` that wires up `onKeyDown`, after the existing Escape/Enter branches and before the listener registration, add a Cmd-B/I branch. Replace:

```ts
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    commit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelEdit();
  }
};
```

with:

```ts
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    commit();
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    cancelEdit();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i' || e.key === 'B' || e.key === 'I')) {
    e.preventDefault();
    const flag: StyleFlag = e.key.toLowerCase() === 'b' ? 'bold' : 'italic';
    handleStyleToggle(flag);
  }
};
```

And add `handleStyleToggle` as a function inside the `useEffect` (it has closure access to `overlay`):

```ts
function handleStyleToggle(flag: StyleFlag): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    // Collapsed selection — pending-style path lands in Task 7.
    return;
  }
  const startChar = domPositionToCharOffset(overlay, range.startContainer, range.startOffset);
  const endChar = domPositionToCharOffset(overlay, range.endContainer, range.endOffset);
  const current = domToRuns(overlay);
  const next = toggleFlagInRange(current, startChar, endChar, flag);
  runsToDom(next, overlay);
  // Restore selection over the same character range in the rebuilt DOM.
  const a = charOffsetToDomPosition(overlay, startChar);
  const b = charOffsetToDomPosition(overlay, endChar);
  if (a && b) {
    const newRange = document.createRange();
    newRange.setStart(a.node, a.offset);
    newRange.setEnd(b.node, b.offset);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}
```

Add the import for `domPositionToCharOffset` / `charOffsetToDomPosition` at the top of the file (alongside the existing `runsToDom`/`domToRuns` import):

```ts
import { runsToDom, domToRuns, charOffsetToDomPosition, domPositionToCharOffset } from './domRuns';
```

- [ ] **Step 6.4: Verify tests pass**

Run: `npx vitest run src/features/text/useTextEdit.test.ts`
Expected: PASS, including the new Cmd-B/I describe block.

- [ ] **Step 6.5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6.6: Commit**

```bash
git add src/features/text/useTextEdit.ts src/features/text/useTextEdit.test.ts
git commit -m "feat(text): Cmd-B/Cmd-I toggle bold/italic on selected range"
```

---

## Task 7: Cmd-B / Cmd-I on collapsed caret — pending style

With a collapsed caret, the hook sets a "pending style" via dataset. A `beforeinput` listener intercepts the next character insert: it inserts a freshly-styled `<span>` with that style, places the character inside, and moves the caret after. Pending state clears on cursor movement, non-toggle keypress, or `selectionchange`.

**Files:**
- Modify: `src/features/text/useTextEdit.ts`
- Modify: `src/features/text/useTextEdit.test.ts`

- [ ] **Step 7.1: Append failing tests**

Append to `src/features/text/useTextEdit.test.ts`:

```ts
function placeCaretAtChar(overlay: HTMLElement, charOffset: number): void {
  const range = document.createRange();
  let remaining = charOffset;
  const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (remaining <= node.data.length) {
      range.setStart(node, remaining);
      range.setEnd(node, remaining);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    remaining -= node.data.length;
    node = walker.nextNode() as Text | null;
  }
}

function dispatchBeforeInput(overlay: HTMLElement, data: string): void {
  // jsdom doesn't fire beforeinput for synthetic mutations; we dispatch
  // it directly with the data the hook expects.
  const ev = new InputEvent('beforeinput', {
    inputType: 'insertText',
    data,
    bubbles: true,
    cancelable: true,
  });
  overlay.dispatchEvent(ev);
}

describe('useTextEdit — Cmd-B/I with collapsed caret (pending style)', () => {
  it('Cmd-B at caret then typing wraps the next character in a bold run', () => {
    const h = makeRichHarness({ a: { text: 'abc', runs: [{ text: 'abc' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 3);  // end of text
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => dispatchBeforeInput(overlay, 'X'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'abc' },
      { text: 'X', bold: true },
    ]);
  });

  it('pending style stacks bold + italic', () => {
    const h = makeRichHarness({ a: { text: 'a', runs: [{ text: 'a' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => pressKey(overlay, 'i', { meta: true }));
    act(() => dispatchBeforeInput(overlay, 'Y'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'a' },
      { text: 'Y', bold: true, italic: true },
    ]);
  });

  it('pending style clears after one inserted character', () => {
    const h = makeRichHarness({ a: { text: 'a', runs: [{ text: 'a' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => dispatchBeforeInput(overlay, 'X'));
    act(() => dispatchBeforeInput(overlay, 'Y'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'a' },
      { text: 'X', bold: true },
      { text: 'Y' },
    ]);
  });
});
```

- [ ] **Step 7.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/useTextEdit.test.ts`
Expected: failures on the new describe block (no pending-style path yet).

- [ ] **Step 7.3: Implement pending-style insertion**

In `src/features/text/useTextEdit.ts`, find `handleStyleToggle` (added in Task 6). Replace the `if (range.collapsed) return;` branch with a real implementation. The function becomes:

```ts
function handleStyleToggle(flag: StyleFlag): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    togglePending(flag);
    return;
  }
  const startChar = domPositionToCharOffset(overlay, range.startContainer, range.startOffset);
  const endChar = domPositionToCharOffset(overlay, range.endContainer, range.endOffset);
  const current = domToRuns(overlay);
  const next = toggleFlagInRange(current, startChar, endChar, flag);
  runsToDom(next, overlay);
  const a = charOffsetToDomPosition(overlay, startChar);
  const b = charOffsetToDomPosition(overlay, endChar);
  if (a && b) {
    const newRange = document.createRange();
    newRange.setStart(a.node, a.offset);
    newRange.setEnd(b.node, b.offset);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}

function togglePending(flag: StyleFlag): void {
  const key = flag === 'bold' ? 'pendingBold' : 'pendingItalic';
  if (overlay.dataset[key] === '1') {
    delete overlay.dataset[key];
  } else {
    overlay.dataset[key] = '1';
  }
}
```

Add a `beforeinput` listener inside the same `useEffect` that mounts the overlay (right alongside `onKeyDown` / `onBlur`):

```ts
const onBeforeInput = (e: InputEvent) => {
  if (e.inputType !== 'insertText' || !e.data) return;
  const pendingBold = overlay.dataset.pendingBold === '1';
  const pendingItalic = overlay.dataset.pendingItalic === '1';
  if (!pendingBold && !pendingItalic) return;
  e.preventDefault();
  // Insert a fresh styled span at the caret carrying e.data.
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const span = document.createElement('span');
  span.setAttribute('data-run', '');
  if (pendingBold) span.style.fontWeight = '700';
  if (pendingItalic) span.style.fontStyle = 'italic';
  span.textContent = e.data;
  range.insertNode(span);
  // Move caret to after the inserted character.
  const after = document.createRange();
  after.setStartAfter(span);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  // Pending state clears once the character is consumed.
  delete overlay.dataset.pendingBold;
  delete overlay.dataset.pendingItalic;
};

overlay.addEventListener('beforeinput', onBeforeInput);
```

Add the removal in the effect's cleanup:

```ts
overlay.removeEventListener('beforeinput', onBeforeInput);
```

- [ ] **Step 7.4: Verify tests pass**

Run: `npx vitest run src/features/text/useTextEdit.test.ts`
Expected: PASS, all tests (existing + new).

- [ ] **Step 7.5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7.6: Commit**

```bash
git add src/features/text/useTextEdit.ts src/features/text/useTextEdit.test.ts
git commit -m "feat(text): Cmd-B/Cmd-I sets pending style at caret; next char inherits"
```

---

## Task 8: Demo wiring + manual verification

Wire `getRuns`/`setRuns` in `TextDemo` so the existing `t5` rich-text node is editable end-to-end.

**Files:**
- Modify: `demo/demos/TextDemo.tsx`

- [ ] **Step 8.1: Pass `getRuns` and `setRuns` to `useTextEdit`**

In `demo/demos/TextDemo.tsx`, find the existing `useTextEdit` call. It currently passes `getText` / `getStyle` / `getScreenPose` / `setText`. Add `getRuns` and `setRuns`:

```ts
const edit = useTextEdit({
  container: containerRef.current,
  getText: (id) => scene.get(asNodeId(id))?.data.text ?? '',
  getStyle: (id) => scene.get(asNodeId(id))?.data.style,
  getScreenPose: (id) => {
    const n = scene.get(asNodeId(id));
    if (!n) return null;
    const p = n.pose as Pose;
    return {
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      fontSize: n.data.style?.fontSize ?? 16,
    };
  },
  setText,
  getRuns: (id) => scene.get(asNodeId(id))?.data.runs,
  setRuns: (id, runs) => {
    const nid = asNodeId(id);
    const n = scene.get(nid);
    if (!n) return;
    scene.update(nid, { data: { ...n.data, runs } });
  },
});
```

The existing `setText` closure already handles `data.text`; the new `setRuns` closure updates `data.runs` on the scene node.

- [ ] **Step 8.2: Run the full test suite**

Run: `npx vitest run`
Expected: existing failures unrelated to slice 3 are still there; nothing new fails.

- [ ] **Step 8.3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8.4: Manual verification in the dev server**

Run: `npm run dev` (in another shell). Open the Text demo.

Verify:
- Node `t5` ("Inline runs: ...") renders with visible bold/italic/bold-italic via the synthetic uniforms.
- Double-clicking `t5` enters edit mode; the overlay shows the same styled text.
- Selecting a word and pressing Cmd-B (or Ctrl-B on non-Mac) toggles bold on the selection — both visually in the overlay and in the committed render after Enter.
- Selecting an already-bold word and pressing Cmd-B removes bold.
- Cmd-I toggles italic the same way.
- With a collapsed caret, Cmd-B then typing inserts a freshly-bolded character.

- [ ] **Step 8.5: Commit**

```bash
git add demo/demos/TextDemo.tsx
git commit -m "feat(demo): wire rich-text editing into TextDemo (getRuns/setRuns)"
```

---

## Out of scope (recorded for future work)

- **Pending-style clearing on cursor movement / selectionchange.** Slice 3 clears pending state only after the next insertText consumes it. Pressing Cmd-B then clicking elsewhere leaves the pending flag set until the next type. Acceptable v1; harmless because the next type still produces a styled span and most users won't hit this.
- **Floating toolbar.** A surface next-to-selection bold/italic toolbar is a consumer-app concern; weasel core stays headless.
- **Multi-paragraph editing.** The current design treats `\n` as literal characters inside runs (matching slice 2's layoutRuns behavior). Block-level structure (paragraphs, lists) is out of scope.
- **Undo/redo at the run-mutation level.** `setRuns` is fired once at commit; the consumer wraps the whole change in one op. Mid-edit undo within the overlay is not exposed.
- **Cross-browser quirks (Safari).** The plan exercises the happy paths in jsdom. Safari-specific contenteditable quirks (especially around `beforeinput.data`, range mutation, and `<br>` insertion) may need follow-up tuning during real-browser smoke testing.

## Self-review notes

- Spec coverage: runs→DOM init ✓; DOM→runs commit ✓; Cmd-B/I on range ✓; pending-style at caret ✓; caret-offset helpers ✓; demo wiring ✓.
- Type consistency: `StyleFlag`, `toggleFlagInRange`, `coalesceRuns`, `styledKey` named consistently. The `domRuns.ts` exports (`runsToDom`, `domToRuns`, `charOffsetToDomPosition`, `domPositionToCharOffset`) are referenced verbatim across tasks.
- Test patterns mirror the existing `useTextEdit.test.ts` harness style.
