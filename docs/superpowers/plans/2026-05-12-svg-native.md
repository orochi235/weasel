# Swillustrator SVG-native persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Swillustrator round-trip its full feature surface through SVG via a `swill:` XML namespace, fixing the audit-flagged gaps (paper-size, groups, text style, warnings) and adding direct bridge tests. weasel-svg stays domain-neutral: it learns to pass *any* declared namespace through opaquely, and all `swill:` semantics live in `apps/swillustrator/src/svgInterop.ts`.

**Architecture:** Three layers, three files: `packages/weasel-svg` (extend types + parse + serialize for **generic** namespace pass-through — no `swill`-specific knowledge), `apps/swillustrator/src/svgInterop.ts` (Obj ↔ SvgNode bridge — declares the `swill` namespace, encodes/decodes paper-size, group-id, line-height via the generic `meta` / `documentMeta` bags), `apps/swillustrator/src/App.tsx` (Save/Open wiring — call setDoc, walk groupsRef). Layers (the spec's later "T3 layers" work) deferred to a follow-up plan after a separate brainstorm.

**Tech Stack:** TypeScript, React 18+, Vitest, weasel-svg.

**Spec:** `docs/superpowers/specs/2026-05-12-svg-native-design.md`.
**Audit:** `docs/superpowers/specs/2026-05-12-svg-native-audit.md`.

---

## Preamble: scope and deferrals

This plan covers the foundation (T0) plus five of the six task slots called out in the spec (T1, T2, T4, T5, T6). **Layers round-trip (the spec's deferred T3) is explicitly deferred** — per the spec it "needs its own brainstorm before plan" because Swillustrator does not yet have a persisted layer model. The encoding (`<swill:layers>` + `swill:layer-id`) is reserved by this plan (we will not collide with it) but no parse/serialize/bridge code is added for it here. A follow-up brainstorm + plan will land layers once Swillustrator's layer data model exists.

Audit gaps **explicitly covered** by this plan:
- "Paper size is written to the SVG via `viewBox` but ignored on read" → Task 2.
- "`Document.size` is not restored on Open" → Task 2.
- "No `width` / `height` attributes emitted" → Task 2.
- "No document title round-trip" → Task 2.
- "Groups flatten on import" → Task 3.
- "Groups are not emitted on export" → Task 3.
- "Swillustrator surfacing of warnings: `console.warn` … no toast" → Task 5.
- "Bridge round-trip — there is no test for `svgInterop.ts` at all" → Tasks 1 and 6.

Audit gaps **explicitly deferred**:
- Element-level opacity, fill/stroke-opacity, gradient downgrade, stroke styling (`cap`/`join`/`dash`/`miterLimit`), `<text>` `runs[]`, text element opacity, path-vs-rect identity drift, `PathObj.closed` magic constant, `pathBounds` overestimating cubic bounds, text dimensions guessed for external SVG, `text-anchor` middle/end origin shift — these are listed in the audit as "Recommended fixes" but are not in the spec's scope. Each remains a follow-up.
- Layers, as called out above.

### Key design decisions baked into this plan

- **Namespace prefix: `swill:`.** XML namespace URI: `https://swillustrator.app/svg-ext`. The npm package name `@orochi235/weasel-svg` is **unchanged** — only the XML prefix and URI use `swill`.
- **weasel-svg is domain-neutral.** It surfaces declared namespaces as opaque `meta` bags. It never knows what `swill:paperSize` means. All `swill:` semantics live in `svgInterop.ts`.
- **Multi-group membership is forbidden — enforced at the model level.** Each Swillustrator object belongs to at most one group. The Swillustrator group adapter (`insertGroup` / `addToGroup` in `App.tsx`) strips any prior memberships when a member is added to a new group (Task 3 Step 7a–7c). A defense-in-depth assertion at the persistence boundary in `objsToSvgNodes` (Task 3 Step 6) catches any direct-mutation bug that bypasses the adapter; it should never fire in practice with the model-level fix in place. `objsToSvgNodes` does not need a "first-group-wins" disambiguator.
- **Paper-size enum on disk = `letter`, not `us-letter`.** Matches Swillustrator's internal `PAPER_PRESETS` keys (`letter`, `a4`, `legal`). No transform on the way to/from SVG.
- **No legacy `data-weasel-line-height` reader.** Spec's Migration section confirms zero installed base. Both read and write use `swill:line-height`.

---

## File map

Files this plan creates:
- `packages/weasel-svg/src/__fixtures__/swillustrator-minimal.svg` — one rect, one text (Task 2).
- `packages/weasel-svg/src/__fixtures__/swillustrator-groups.svg` — two groups with three shapes each (Task 3).
- `packages/weasel-svg/src/__fixtures__/swillustrator-papers.svg` — one of each paper-size enum (Task 2).
- `apps/swillustrator/src/svgInterop.test.ts` — direct bridge tests (Task 1 baseline; extended in Tasks 3, 4).
- `apps/swillustrator/src/groupMembership.ts` — pure helper that strips members from prior groups; enforces single-group-membership at the model level (Task 3).
- `apps/swillustrator/src/groupMembership.test.ts` — unit tests for `stripPriorMemberships` and the Swillustrator group-adapter wiring (Task 3).
- `apps/swillustrator/src/Toasts.tsx` — toast component for surfacing parse warnings (Task 5).
- `apps/swillustrator/src/Toasts.module.css` *or* additions to `swillustrator.css` — CSS for the toast (Task 5).

Files this plan modifies:
- `packages/weasel-svg/src/types.ts` — add `meta?: NamespaceMeta` on every `SvgNode` variant; add `documentMeta?: NamespaceMeta` on `ParseResult` and `SerializeOptions`; add `namespaces?: Record<string, string>` to `ParseOptions` and `SerializeOptions`; add `viewBox` / `width` / `height` / `title` to `ParseResult` and `SerializeOptions` (Task 0 + Task 2).
- `packages/weasel-svg/src/parse.ts` — generic: collect declared-namespace attrs into `meta` per element and `documentMeta` for root attrs/children (Task 0). Also surface `viewBox`, `width`, `height`, `<title>` (standard SVG; Task 2).
- `packages/weasel-svg/src/serialize.ts` — generic: write `xmlns:<prefix>="..."` for each declared namespace, emit `meta.<prefix>.attrs` as `<prefix>:<name>="..."` on each element, emit `documentMeta.<prefix>.attrs`/`elements` on the root (Task 0). Also emit `width`/`height`/`<title>` (Task 2).
- `packages/weasel-svg/src/index.ts` — re-export `NamespaceMeta` type (Task 0).
- `packages/weasel-svg/src/roundtrip.test.ts` — add T0 generic-namespace round-trip cases; add T2 paper-size/title/groups/text-style cases.
- `apps/swillustrator/src/svgInterop.ts` — declare the `swill` namespace; encode/decode paper-size + units + line-height + group-id via `meta` and `documentMeta`; stop flattening groups; surface `Group[]` alongside `Obj[]` from open; enforce single-group-membership invariant.
- `apps/swillustrator/src/App.tsx` — `onSaveSvg` passes `namespaces: { swill: SWILL_NS }` and `documentMeta` containing paper-size; `onOpenSvg` reads `documentMeta.swill.attrs.paperSize`, calls `setDoc`, populates `groupsRef`, surfaces warnings via the new toast. Group adapter's `insertGroup` / `addToGroup` strip prior memberships (single-group-membership invariant) via `stripPriorMemberships`.

---

## Task ordering

0. **Task 0** — Generic namespace pass-through in weasel-svg. Foundation for everything that follows.
1. **Task 1** — Bridge baseline tests. Pin current behavior before we change it.
2. **Task 2** — Paper-size + doc-title round-trip (spec's T1). Smallest substrate change; first consumer of T0's plumbing.
3. **Task 3** — Groups round-trip (spec's T2). Biggest behavior change in the bridge. Includes single-group-membership enforcement.
4. **Task 4** — Text style round-trip (spec's T4). Additive extension to text serialization.
5. **Task 5** — Warning toast (spec's T5). UI-only.
6. **Task 6** — Bridge tests, full coverage (spec's T6 finish). Fill the remaining Obj × SvgNode cells and edge cases.
7. **Task 7** — Final regression sweep + manual smoke checklist.

---

## Task 0: Generic namespace pass-through in weasel-svg

Goal: extend weasel-svg's parse + serialize so that *any* declared XML namespace round-trips losslessly as opaque structured data. weasel-svg gains zero domain knowledge — no `swill:`, no `weasel:`, no app-specific feature flags. Consumers (svgInterop, future external consumers) hang their semantics off the resulting `meta` / `documentMeta` bags.

This is the foundation: T2 (paper-size), T3 (groups), and T4 (text style) all build on the types and behavior defined here.

**Files:**
- Modify: `packages/weasel-svg/src/types.ts`
- Modify: `packages/weasel-svg/src/parse.ts`
- Modify: `packages/weasel-svg/src/serialize.ts`
- Modify: `packages/weasel-svg/src/index.ts`
- Modify: `packages/weasel-svg/src/__fixtures__/fixtures.ts`
- Modify: `packages/weasel-svg/src/roundtrip.test.ts`

- [ ] **Step 1: Define the `NamespaceMeta` shape in types.ts**

In `/Users/mike/src/weasel/packages/weasel-svg/src/types.ts`, add at the top of the file (after any existing imports):

```ts
/**
 * Opaque pass-through bag for namespaced XML content.
 *
 * weasel-svg does not interpret the contents — it only ensures that any
 * attributes or child elements in a *declared* XML namespace round-trip
 * losslessly through parse → serialize. Consumers (e.g. an app-specific
 * bridge layer) hang their domain semantics off this structure.
 *
 * Keyed by namespace prefix (the prefix is a write-time choice; the URI
 * is the canonical identifier and is supplied via `ParseOptions.namespaces`
 * / `SerializeOptions.namespaces`).
 */
export interface NamespaceMeta {
  [prefix: string]: {
    /** Local-name → string-value map for attributes in this namespace. */
    attrs?: Record<string, string>;
    /**
     * Child elements in this namespace, keyed by local name. Each entry
     * is an array because a namespace can host multiple sibling elements
     * with the same tag (e.g. `<swill:layer/><swill:layer/>`).
     */
    elements?: Record<string, NamespacedElement[]>;
  };
}

/** Opaque structured representation of a namespaced element. */
export interface NamespacedElement {
  /** Attribute local-name → string-value. */
  attrs: Record<string, string>;
  /** Text content, when the element contains only text (no child elements). */
  text?: string;
  /** Nested namespaced children, keyed by local name (recursive). */
  children?: Record<string, NamespacedElement[]>;
}
```

- [ ] **Step 2: Extend `SvgNode` variants and `ParseResult` / `SerializeOptions`**

Still in `/Users/mike/src/weasel/packages/weasel-svg/src/types.ts`:

a) Add `meta?: NamespaceMeta` to each `SvgNode` variant. Locate the existing `SvgGroupNode`, `SvgPathNode`, `SvgTextNode` interfaces and add the field:

```ts
export interface SvgGroupNode {
  kind: 'group';
  children: SvgNode[];
  transform?: Matrix;
  opacity?: number;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

export interface SvgPathNode {
  kind: 'path';
  path: Path;
  fill?: SvgPaint;
  stroke?: SvgStroke;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

export interface SvgTextNode {
  kind: 'text';
  x: number; y: number; width: number; height: number;
  text: string;
  style?: TextStyle;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}
```

(If any of these interfaces already differ from the snippets above, keep their existing shape and only add `meta?: NamespaceMeta`.)

b) Add a `ParseOptions` interface (it does not exist yet — `parseSvg` currently takes no options) and extend `ParseResult`:

```ts
export interface ParseOptions {
  /**
   * Map of prefix → URI for XML namespaces the caller wants surfaced.
   * Attributes / child elements in any declared namespace are collected
   * into `SvgNode.meta` (per element) or `ParseResult.documentMeta` (root).
   * Undeclared namespaces are preserved in the DOM but not promoted into
   * the structured `meta` bag; they are silently dropped at serialize time.
   */
  namespaces?: Record<string, string>;
}

export interface ParseResult {
  nodes: SvgNode[];
  /** Non-fatal notices (unsupported elements, unrecognized attributes). */
  warnings: string[];
  /** Root `viewBox`, when present and parseable. */
  viewBox?: { x: number; y: number; width: number; height: number };
  /** `<title>` element text at the root, if present. */
  title?: string;
  /**
   * Opaque per-document bag for declared namespaces. Holds root-level
   * namespaced attributes (`documentMeta.<prefix>.attrs`) and namespaced
   * root children (`documentMeta.<prefix>.elements`).
   */
  documentMeta?: NamespaceMeta;
}
```

c) Extend `SerializeOptions`:

```ts
export interface SerializeOptions {
  /** Override the root `viewBox`. Default: tight bbox of `nodes`. */
  viewBox?: { x: number; y: number; width: number; height: number };
  /** Explicit pixel width / height on the root `<svg>`. */
  width?: number;
  height?: number;
  /** `<title>` element text. Emitted as the first child of `<svg>`. */
  title?: string;
  /**
   * Map of prefix → URI for XML namespaces to declare on the root
   * `<svg>`. The serializer reads `documentMeta[prefix]` and
   * `node.meta[prefix]` to write the actual attributes and elements.
   */
  namespaces?: Record<string, string>;
  /**
   * Opaque per-document namespaced extras. Each `<prefix>.attrs` becomes
   * `<prefix>:<name>="..."` attributes on the root `<svg>`. Each
   * `<prefix>.elements[localName]` becomes `<prefix>:<localName>...>`
   * children placed immediately after `<title>` and before any geometry.
   */
  documentMeta?: NamespaceMeta;
  /** Pretty-print with newlines + indentation. Default `false`. */
  pretty?: boolean;
}
```

- [ ] **Step 3: Re-export the new types from index.ts**

In `/Users/mike/src/weasel/packages/weasel-svg/src/index.ts`, find the existing `export type { ... }` block and add `NamespaceMeta`, `NamespacedElement`, `ParseOptions` to the list:

```ts
export type {
  NamespaceMeta, NamespacedElement, ParseOptions, ParseResult, SerializeOptions,
  SvgGroupNode, SvgNode, SvgPathNode, SvgTextNode, /* ...keep the rest... */
} from './types';
```

- [ ] **Step 4: Write a failing round-trip test for generic namespace pass-through**

Append to `/Users/mike/src/weasel/packages/weasel-svg/src/__fixtures__/fixtures.ts`:

```ts
/** Generic two-namespace fixture: proves weasel-svg passes through arbitrary
 *  namespaces without knowing what they mean. Uses two unrelated prefixes
 *  (`foo` and `bar`) so we exercise multi-namespace isolation. */
export const TWO_NAMESPACES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:foo="https://example.com/foo" xmlns:bar="https://example.com/bar" viewBox="0 0 100 100" foo:rootAttr="alpha" bar:rootAttr="beta">
  <foo:registry>
    <foo:item id="a" name="Alpha"/>
    <foo:item id="b" name="Beta"/>
  </foo:registry>
  <g foo:group="g1" bar:tag="left">
    <path d="M 0 0 L 10 0 L 10 10 L 0 10 Z" fill="#000" foo:annotation="leaf"/>
  </g>
</svg>`;
```

Append to `/Users/mike/src/weasel/packages/weasel-svg/src/roundtrip.test.ts`, inside the existing `describe('round-trip', ...)` block:

```ts
  it('generic namespace pass-through: two declared namespaces stay isolated', () => {
    const namespaces = {
      foo: 'https://example.com/foo',
      bar: 'https://example.com/bar',
    };
    const first = parseSvg(F.TWO_NAMESPACES_SVG, { namespaces });
    expect(first.warnings).toEqual([]);

    // Document-level: each prefix has its own attrs bucket.
    expect(first.documentMeta?.foo?.attrs?.rootAttr).toBe('alpha');
    expect(first.documentMeta?.bar?.attrs?.rootAttr).toBe('beta');
    // Document-level: foo has a <registry> element with two <item> children;
    // bar has no document-level elements.
    expect(first.documentMeta?.foo?.elements?.registry).toBeDefined();
    expect(first.documentMeta?.foo?.elements!.registry[0].children?.item).toHaveLength(2);
    expect(first.documentMeta?.foo?.elements!.registry[0].children!.item[0].attrs.id).toBe('a');
    expect(first.documentMeta?.bar?.elements).toBeUndefined();

    // Per-element: <g> has foo:group + bar:tag; the inner <path> has foo:annotation.
    const g = first.nodes[0];
    if (g.kind !== 'group') throw new Error('expected group');
    expect(g.meta?.foo?.attrs?.group).toBe('g1');
    expect(g.meta?.bar?.attrs?.tag).toBe('left');
    const leaf = g.children[0];
    expect(leaf.meta?.foo?.attrs?.annotation).toBe('leaf');

    // Serialize back: prefixes survive, attribute values survive, the
    // <registry> sub-tree comes back. Undeclared namespaces would be
    // silently dropped — but we declared both.
    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      namespaces,
      documentMeta: first.documentMeta,
    });
    expect(out).toContain('xmlns:foo="https://example.com/foo"');
    expect(out).toContain('xmlns:bar="https://example.com/bar"');
    expect(out).toContain('foo:rootAttr="alpha"');
    expect(out).toContain('bar:rootAttr="beta"');
    expect(out).toContain('foo:group="g1"');
    expect(out).toContain('bar:tag="left"');
    expect(out).toContain('foo:annotation="leaf"');
    expect(out).toContain('<foo:registry>');
    expect(out).toContain('<foo:item id="a" name="Alpha"');

    // Second parse equals first parse on every namespaced field.
    const second = parseSvg(out, { namespaces });
    expect(second.documentMeta).toEqual(first.documentMeta);
    const g2 = second.nodes[0];
    if (g2.kind !== 'group') throw new Error('expected group');
    expect(g2.meta).toEqual(g.meta);
    expect(g2.children[0].meta).toEqual(leaf.meta);
  });

  it('generic namespace pass-through: undeclared namespaces are dropped on serialize', () => {
    // Parse declaring only `foo`. The `bar:*` content lives in the source
    // XML DOM but is not promoted into `meta`. When we re-serialize, the
    // bar attributes vanish — there is no `meta.bar` for the writer to find.
    const first = parseSvg(F.TWO_NAMESPACES_SVG, { namespaces: { foo: 'https://example.com/foo' } });
    expect(first.documentMeta?.foo).toBeDefined();
    expect(first.documentMeta?.bar).toBeUndefined();
    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      namespaces: { foo: 'https://example.com/foo' },
      documentMeta: first.documentMeta,
    });
    expect(out).toContain('foo:rootAttr="alpha"');
    expect(out).not.toContain('bar:rootAttr');
    expect(out).not.toContain('xmlns:bar');
  });
```

- [ ] **Step 5: Run the new tests, verify they fail**

Run: `cd /Users/mike/src/weasel && npx vitest run packages/weasel-svg/src/roundtrip.test.ts -t "generic namespace"`
Expected: FAIL — `parseSvg` doesn't accept an options arg yet, `documentMeta` is undefined, `node.meta` is undefined, `serializeSvg` doesn't accept `namespaces` / `documentMeta`. Two failing tests.

- [ ] **Step 6: Implement generic namespace collection in parse.ts**

In `/Users/mike/src/weasel/packages/weasel-svg/src/parse.ts`:

a) Change the `parseSvg` signature to accept options and surface the new fields:

```ts
import type {
  Matrix, NamespaceMeta, NamespacedElement, ParseOptions, ParseResult,
  SvgGroupNode, SvgNode, SvgPaint, SvgPathNode, SvgStroke, SvgTextNode,
} from './types';

export function parseSvg(svg: string, opts: ParseOptions = {}): ParseResult {
  const warnings: string[] = [];
  const onWarn = (m: string): void => { warnings.push(m); };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch (e) {
    return { nodes: [], warnings: [`failed to parse SVG: ${(e as Error).message}`] };
  }
  const errEl = doc.getElementsByTagName('parsererror')[0];
  if (errEl) {
    return { nodes: [], warnings: [`SVG parse error: ${errEl.textContent ?? 'unknown'}`] };
  }
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') {
    return { nodes: [], warnings: ['root element is not <svg>'] };
  }

  const namespaces = opts.namespaces ?? {};
  // Build a URI → prefix index for fast lookup during traversal.
  const uriToPrefix = new Map<string, string>();
  for (const [prefix, uri] of Object.entries(namespaces)) {
    uriToPrefix.set(uri, prefix);
  }

  const viewBox = parseViewBoxAttr(root.getAttribute('viewBox'));
  const title = readTitleChild(root);
  const documentMeta = collectDocumentMeta(root, uriToPrefix);

  const gradients = collectGradients(root, onWarn);
  const nodes = parseChildren(root, IDENTITY_MATRIX, gradients, onWarn, uriToPrefix);

  const result: ParseResult = { nodes, warnings };
  if (viewBox) result.viewBox = viewBox;
  if (title != null) result.title = title;
  if (documentMeta) result.documentMeta = documentMeta;
  return result;
}

function parseViewBoxAttr(raw: string | null): { x: number; y: number; width: number; height: number } | undefined {
  if (!raw) return undefined;
  const tokens = raw.trim().split(/[\s,]+/).map(parseFloat);
  if (tokens.length !== 4 || tokens.some((n) => !Number.isFinite(n))) return undefined;
  const [x, y, width, height] = tokens;
  return { x, y, width, height };
}

function readTitleChild(root: Element): string | undefined {
  for (let i = 0; i < root.children.length; i++) {
    const c = root.children[i];
    if (c.tagName.toLowerCase() === 'title' && (!c.namespaceURI || c.namespaceURI === 'http://www.w3.org/2000/svg')) {
      return c.textContent ?? '';
    }
  }
  return undefined;
}
```

b) Add the document-meta collector. The root `<svg>` element can carry namespaced attributes (e.g. `swill:paperSize`) and namespaced child elements (e.g. `<swill:layers>`). Place this helper near the other element-walking helpers:

```ts
function collectDocumentMeta(
  root: Element,
  uriToPrefix: Map<string, string>,
): NamespaceMeta | undefined {
  const meta: NamespaceMeta = {};

  // Root-level namespaced attributes.
  for (let i = 0; i < root.attributes.length; i++) {
    const a = root.attributes[i];
    if (!a.namespaceURI) continue;
    const prefix = uriToPrefix.get(a.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    (bucket.attrs ??= {})[a.localName] = a.value;
  }

  // Root-level namespaced child elements. The body of these is collected
  // recursively as a generic XML-element tree; geometry inside them is NOT
  // promoted to SvgNodes (that's the consumer's job if they want it).
  for (let i = 0; i < root.children.length; i++) {
    const c = root.children[i];
    if (!c.namespaceURI) continue;
    const prefix = uriToPrefix.get(c.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    const elements = (bucket.elements ??= {});
    const list = (elements[c.localName] ??= []);
    list.push(collectNamespacedElement(c, uriToPrefix));
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

function collectNamespacedElement(
  el: Element,
  uriToPrefix: Map<string, string>,
): NamespacedElement {
  const result: NamespacedElement = { attrs: {} };
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    // For namespaced *elements* we collect every attribute (namespaced or
    // not) under the element — unlike root attrs where we filter by NS.
    // Treat `xmlns:*` as structural and skip.
    if (a.name.startsWith('xmlns')) continue;
    result.attrs[a.localName] = a.value;
  }

  let hasChildElements = false;
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (!c.namespaceURI) continue;
    const prefix = uriToPrefix.get(c.namespaceURI);
    if (!prefix) continue;  // child in undeclared NS: drop
    hasChildElements = true;
    const children = (result.children ??= {});
    const list = (children[c.localName] ??= []);
    list.push(collectNamespacedElement(c, uriToPrefix));
  }

  if (!hasChildElements && el.textContent != null && el.textContent.trim() !== '') {
    result.text = el.textContent;
  }

  return result;
}

/** Per-element namespace meta: walked at every parsed SVG element. */
function collectElementMeta(
  el: Element,
  uriToPrefix: Map<string, string>,
): NamespaceMeta | undefined {
  if (uriToPrefix.size === 0) return undefined;
  const meta: NamespaceMeta = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (!a.namespaceURI) continue;
    const prefix = uriToPrefix.get(a.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    (bucket.attrs ??= {})[a.localName] = a.value;
  }
  // Namespaced child elements on a *standard* SVG element (e.g. a <g>) are
  // also surfaced under elements[] in the same shape used at the root.
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (!c.namespaceURI) continue;
    const prefix = uriToPrefix.get(c.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    const elements = (bucket.elements ??= {});
    const list = (elements[c.localName] ??= []);
    list.push(collectNamespacedElement(c, uriToPrefix));
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}
```

c) Thread `uriToPrefix` through `parseChildren` / `parseElement` and attach `meta` to every returned node. Update the existing signatures:

```ts
function parseChildren(
  parent: Element,
  ctm: Matrix,
  gradients: Map<string, SvgPaint>,
  onWarn: (m: string) => void,
  uriToPrefix: Map<string, string>,
): SvgNode[] {
  const out: SvgNode[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const c = parent.children[i];
    // Skip namespaced children — they belong to `meta.elements`, not nodes.
    if (c.namespaceURI && c.namespaceURI !== 'http://www.w3.org/2000/svg') continue;
    const node = parseElement(c, ctm, gradients, onWarn, uriToPrefix);
    if (node) out.push(node);
  }
  return out;
}
```

And in `parseElement`, before returning each node, attach its element meta:

```ts
  // ... existing logic that builds `group` / `pathNode` / `textNode` ...
  const meta = collectElementMeta(el, uriToPrefix);
  if (meta) node.meta = meta;
  return node;
```

(Apply this assignment to each of the three node-producing branches — `<g>`, `<path>` / `<rect>` / `<polygon>` etc., and `<text>`. Use whichever local variable name the branch already uses for the produced node.)

- [ ] **Step 7: Implement generic namespace emission in serialize.ts**

In `/Users/mike/src/weasel/packages/weasel-svg/src/serialize.ts`:

a) Update the `serializeSvg` signature and rewrite root assembly:

```ts
import type {
  NamespaceMeta, NamespacedElement, SerializeOptions, SvgGroupNode, SvgNode,
  /* keep existing imports */
} from './types';

export function serializeSvg(nodes: SvgNode[], opts: SerializeOptions = {}): string {
  const registry = new GradientRegistry();
  registerGradients(nodes, registry);

  const bounds = opts.viewBox ?? computeBounds(nodes);
  const vb = `${trimNumber(bounds.x)} ${trimNumber(bounds.y)} ${trimNumber(bounds.width)} ${trimNumber(bounds.height)}`;
  const namespaces = opts.namespaces ?? {};

  const rootAttrs: string[] = [
    `xmlns="http://www.w3.org/2000/svg"`,
  ];
  for (const [prefix, uri] of Object.entries(namespaces)) {
    rootAttrs.push(`xmlns:${prefix}="${escapeAttr(uri)}"`);
  }
  rootAttrs.push(`viewBox="${vb}"`);
  if (opts.width != null) rootAttrs.push(`width="${trimNumber(opts.width)}"`);
  if (opts.height != null) rootAttrs.push(`height="${trimNumber(opts.height)}"`);
  // documentMeta attrs onto the root, in declared-namespace order.
  if (opts.documentMeta) {
    for (const prefix of Object.keys(namespaces)) {
      const bucket = opts.documentMeta[prefix];
      if (!bucket?.attrs) continue;
      for (const [name, value] of Object.entries(bucket.attrs)) {
        rootAttrs.push(`${prefix}:${name}="${escapeAttr(value)}"`);
      }
    }
  }

  const titleXml = opts.title != null ? `<title>${escapeText(opts.title)}</title>` : '';

  // documentMeta elements after <title>, before <defs> and geometry.
  let docMetaXml = '';
  if (opts.documentMeta) {
    for (const prefix of Object.keys(namespaces)) {
      const bucket = opts.documentMeta[prefix];
      if (!bucket?.elements) continue;
      for (const [localName, list] of Object.entries(bucket.elements)) {
        for (const el of list) docMetaXml += namespacedElementXml(prefix, localName, el);
      }
    }
  }

  const defsXml = registry.toDefsXml();
  const bodyXml = nodes.map((n) => nodeXml(n, registry, namespaces)).join('');

  return `<svg ${rootAttrs.join(' ')}>${titleXml}${docMetaXml}${defsXml}${bodyXml}</svg>`;
}

function namespacedElementXml(prefix: string, localName: string, el: NamespacedElement): string {
  const attrs: string[] = [];
  for (const [name, value] of Object.entries(el.attrs)) {
    attrs.push(`${name}="${escapeAttr(value)}"`);
  }
  const head = attrs.length > 0 ? `<${prefix}:${localName} ${attrs.join(' ')}>` : `<${prefix}:${localName}>`;
  let body = '';
  if (el.children) {
    for (const [childName, list] of Object.entries(el.children)) {
      for (const child of list) body += namespacedElementXml(prefix, childName, child);
    }
  } else if (el.text != null) {
    body = escapeText(el.text);
  }
  return `${head}${body}</${prefix}:${localName}>`;
}
```

b) Update `nodeXml`, `groupXml`, `pathXml`, `textXml` to accept `namespaces` and emit per-element `meta` attrs:

```ts
function nodeXml(node: SvgNode, registry: GradientRegistry, namespaces: Record<string, string>): string {
  if (node.kind === 'group') return groupXml(node, registry, namespaces);
  if (node.kind === 'path') return pathXml(node, registry, namespaces);
  return textXml(node, registry, namespaces);
}

function metaAttrsXml(meta: NamespaceMeta | undefined, namespaces: Record<string, string>): string {
  if (!meta) return '';
  const parts: string[] = [];
  for (const prefix of Object.keys(namespaces)) {
    const bucket = meta[prefix];
    if (!bucket?.attrs) continue;
    for (const [name, value] of Object.entries(bucket.attrs)) {
      parts.push(`${prefix}:${name}="${escapeAttr(value)}"`);
    }
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function metaElementsXml(meta: NamespaceMeta | undefined, namespaces: Record<string, string>): string {
  if (!meta) return '';
  let out = '';
  for (const prefix of Object.keys(namespaces)) {
    const bucket = meta[prefix];
    if (!bucket?.elements) continue;
    for (const [localName, list] of Object.entries(bucket.elements)) {
      for (const el of list) out += namespacedElementXml(prefix, localName, el);
    }
  }
  return out;
}
```

Inside `groupXml` (and analogous bodies for `pathXml`, `textXml`), splice the meta attrs into the opening tag and append `metaElementsXml` after the children:

```ts
function groupXml(node: SvgGroupNode, registry: GradientRegistry, namespaces: Record<string, string>): string {
  const attrs: string[] = [];
  if (node.transform) {
    const m = formatMatrix(node.transform);
    if (m) attrs.push(`transform="${m}"`);
  }
  if (node.opacity != null && node.opacity !== 1) attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  const head = attrs.length > 0 ? `<g ${attrs.join(' ')}${metaAttrsXml(node.meta, namespaces)}>` : `<g${metaAttrsXml(node.meta, namespaces)}>`;
  const childXml = node.children.map((c) => nodeXml(c, registry, namespaces)).join('');
  return `${head}${childXml}${metaElementsXml(node.meta, namespaces)}</g>`;
}
```

Apply the same pattern (`metaAttrsXml` on the open tag, `metaElementsXml` before close) to `pathXml` and `textXml`.

- [ ] **Step 8: Run the new round-trip tests, verify they pass**

Run: `cd /Users/mike/src/weasel && npx vitest run packages/weasel-svg/src/roundtrip.test.ts -t "generic namespace"`
Expected: both new tests pass.

- [ ] **Step 9: Run the full weasel-svg test file, verify no regressions**

Run: `cd /Users/mike/src/weasel && npx vitest run packages/weasel-svg/`
Expected: every existing test still passes. If a test fails because it called `parseSvg(svg)` and the new signature broke it, that's impossible — the new param is optional. If it fails on a type error, check that the `meta?: NamespaceMeta` additions didn't accidentally make a field non-optional anywhere.

- [ ] **Step 10: Typecheck**

Run: `cd /Users/mike/src/weasel && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 11: Commit**

```bash
git add packages/weasel-svg/src/types.ts packages/weasel-svg/src/parse.ts packages/weasel-svg/src/serialize.ts packages/weasel-svg/src/index.ts packages/weasel-svg/src/__fixtures__/fixtures.ts packages/weasel-svg/src/roundtrip.test.ts
git commit -m "feat(weasel-svg): generic namespace pass-through via meta / documentMeta"
```

---

## Task 1: Bridge baseline tests (svgInterop.ts as-is)

Goal: lock in the current `objToSvgNode` / `svgNodesToObjs` behavior with direct tests so Tasks 3 and 4 changes show up as deliberate edits, not regressions.

**Files:**
- Create: `apps/swillustrator/src/svgInterop.test.ts`

- [ ] **Step 1: Read svgInterop.ts to confirm exported API**

Run: `grep -n "^export" /Users/mike/src/weasel/apps/swillustrator/src/svgInterop.ts`
Expected output includes: `export function objToSvgNode`, `export function svgNodesToObjs`, `export function downloadSvg`, `export function pickSvgFile`. The `Obj` type is declared but not exported; tests will redeclare a minimal compatible shape inline.

- [ ] **Step 2: Confirm vitest config picks up tests under apps/swillustrator/src**

Run: `cat /Users/mike/src/weasel/apps/swillustrator/vitest.config.ts 2>/dev/null || cat /Users/mike/src/weasel/vitest.config.ts 2>/dev/null | head -40`
Expected: a config that includes `apps/**/*.test.ts` or `**/*.test.ts`. If neither apps/swillustrator/vitest.config.ts nor a permissive root config exists, fall back to adding the file under `/Users/mike/src/weasel/apps/swillustrator/src/` and run vitest from `/Users/mike/src/weasel/apps/swillustrator/` directly (root `package.json` `test` script will pick it up via Vitest workspaces if present).

- [ ] **Step 3: Write the baseline test file**

Create `/Users/mike/src/weasel/apps/swillustrator/src/svgInterop.test.ts`:

```ts
/**
 * Direct tests on the Obj ↔ SvgNode bridge. The baseline pins current
 * behavior so later tasks (groups, text style, namespace metadata) show
 * up as intentional edits to these expectations.
 */

import { describe, it, expect } from 'vitest';
import type { SvgNode, SvgPathNode, SvgTextNode, SvgGroupNode } from '@orochi235/weasel-svg';
import { objToSvgNode, svgNodesToObjs } from './svgInterop';

// Minimal local mirror of svgInterop's internal Obj union. Keep in sync
// with the file under test; baseline tests don't need every field, just
// the structurally-required ones the bridge reads.
interface RectObjT { id: string; kind: 'rect'; x: number; y: number; width: number; height: number; fill: string; stroke: string; strokeWidth: number }
interface TextObjT { id: string; kind: 'text'; x: number; y: number; width: number; height: number; text: string }
interface PathObjT {
  id: string; kind: 'path'; x: number; y: number; width: number; height: number;
  path: { kind: 'polygon'; commands: Uint8Array; coords: Float32Array; fillRule: 'nonzero' };
  closed: boolean; fill: string; stroke: string; strokeWidth: number;
}

function ids(): () => string {
  let n = 0;
  return () => `i${n++}`;
}

describe('objToSvgNode', () => {
  it('lowers a RectObj to an SvgPathNode with a RectPath and solid fill', () => {
    const rect: RectObjT = {
      id: 'r1', kind: 'rect',
      x: 10, y: 20, width: 30, height: 40,
      fill: '#ff0000', stroke: '#000000', strokeWidth: 2,
    };
    const node = objToSvgNode(rect as never) as SvgPathNode;
    expect(node.kind).toBe('path');
    expect(node.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 30, height: 40 });
    expect(node.fill).toEqual({ kind: 'solid', color: '#ff0000' });
    expect(node.stroke).toEqual({ paint: { kind: 'solid', color: '#000000' }, width: 2 });
  });

  it('skips stroke emission when strokeWidth is 0', () => {
    const rect: RectObjT = {
      id: 'r2', kind: 'rect',
      x: 0, y: 0, width: 10, height: 10,
      fill: '#abcdef', stroke: '#000000', strokeWidth: 0,
    };
    const node = objToSvgNode(rect as never) as SvgPathNode;
    expect(node.stroke).toBeUndefined();
  });

  it('lowers a TextObj to an SvgTextNode preserving geometry and text', () => {
    const text: TextObjT = {
      id: 't1', kind: 'text',
      x: 5, y: 6, width: 100, height: 20,
      text: 'hello',
    };
    const node = objToSvgNode(text as never) as SvgTextNode;
    expect(node.kind).toBe('text');
    expect(node).toMatchObject({ x: 5, y: 6, width: 100, height: 20, text: 'hello' });
  });

  it('emits fill=none on an open PathObj', () => {
    const path: PathObjT = {
      id: 'p1', kind: 'path',
      x: 0, y: 0, width: 50, height: 50,
      path: { kind: 'polygon', commands: new Uint8Array([0, 1, 1]), coords: new Float32Array([0, 0, 50, 0, 50, 50]), fillRule: 'nonzero' },
      closed: false,
      fill: '#ff0000', stroke: '#000000', strokeWidth: 1,
    };
    const node = objToSvgNode(path as never) as SvgPathNode;
    expect(node.fill).toEqual({ kind: 'none' });
  });

  it('emits a solid fill on a closed PathObj', () => {
    const path: PathObjT = {
      id: 'p2', kind: 'path',
      x: 0, y: 0, width: 50, height: 50,
      path: { kind: 'polygon', commands: new Uint8Array([0, 1, 1, 4]), coords: new Float32Array([0, 0, 50, 0, 50, 50]), fillRule: 'nonzero' },
      closed: true,
      fill: '#00ff00', stroke: '#000000', strokeWidth: 1,
    };
    const node = objToSvgNode(path as never) as SvgPathNode;
    expect(node.fill).toEqual({ kind: 'solid', color: '#00ff00' });
  });
});

describe('svgNodesToObjs (baseline — pre-namespace, pre-groups-preservation)', () => {
  it('lowers an SvgPathNode (rect) to a RectObj', () => {
    const node: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 1, y: 2, width: 3, height: 4 },
      fill: { kind: 'solid', color: '#aabbcc' },
      stroke: { paint: { kind: 'solid', color: '#112233' }, width: 1.5 },
    };
    const out = svgNodesToObjs([node], ids());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: 'rect', x: 1, y: 2, width: 3, height: 4,
      fill: '#aabbcc', stroke: '#112233', strokeWidth: 1.5,
    });
  });

  it('lowers an SvgTextNode to a TextObj', () => {
    const node: SvgTextNode = {
      kind: 'text',
      x: 10, y: 11, width: 200, height: 30,
      text: 'hi',
    };
    const out = svgNodesToObjs([node], ids());
    expect(out[0]).toMatchObject({ kind: 'text', x: 10, y: 11, text: 'hi' });
  });

  it('baseline: flattens groups inlining their children', () => {
    // NOTE: This expectation will be flipped in Task 3 — groups will be
    // preserved structurally. The baseline test exists so Task 3 shows
    // up as a deliberate change.
    const inner: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#000000' },
    };
    const group: SvgGroupNode = { kind: 'group', children: [inner] };
    const out = svgNodesToObjs([group], ids());
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('rect');
  });

  it('downgrades a gradient fill to black solid (lossy edge)', () => {
    const node: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      // Gradient paint shape is opaque to the bridge; cast covers it.
      fill: { kind: 'gradient', paint: { fill: 'linear', stops: [] } as never },
    };
    const out = svgNodesToObjs([node as SvgNode], ids());
    expect((out[0] as RectObjT).fill).toBe('#000000');
  });

  it('treats SvgPathNode without stroke as strokeWidth=0', () => {
    const node: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#abcdef' },
    };
    const out = svgNodesToObjs([node], ids());
    expect((out[0] as RectObjT).strokeWidth).toBe(0);
    expect((out[0] as RectObjT).stroke).toBe('#000000');
  });
});
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/svgInterop.test.ts`
Expected: all 9 tests pass. If vitest doesn't pick up the file, check the workspace `vitest.config.ts` `test.include` glob — apps/swillustrator was added to the workspace in prior work; if missing, append `'apps/swillustrator/src/**/*.test.ts'` to the include array.

- [ ] **Step 5: Commit**

```bash
git add apps/swillustrator/src/svgInterop.test.ts
git commit -m "test(svgInterop): pin baseline Obj ↔ SvgNode behavior"
```

---

## Task 2: Paper-size + doc-title round-trip (spec's T1)

Goal: weasel-svg's parse + serialize already learned to round-trip declared namespaces in T0. This task adds standard-SVG `viewBox` / `width` / `height` / `<title>` to the same surface, then teaches `svgInterop.ts` to declare the `swill` namespace and encode `paperSize` / `units` into `documentMeta.swill.attrs`.

**Files:**
- Create: `packages/weasel-svg/src/__fixtures__/swillustrator-minimal.svg`
- Create: `packages/weasel-svg/src/__fixtures__/swillustrator-papers.svg`
- Modify: `packages/weasel-svg/src/parse.ts` (only if T0 didn't already handle `viewBox` / `<title>` / `width` / `height` — likely it did; double-check)
- Modify: `packages/weasel-svg/src/serialize.ts` (likewise for `width` / `height` / `<title>`)
- Modify: `packages/weasel-svg/src/__fixtures__/fixtures.ts`
- Modify: `packages/weasel-svg/src/roundtrip.test.ts`
- Modify: `apps/swillustrator/src/svgInterop.ts`
- Modify: `apps/swillustrator/src/App.tsx` (lines around 1276-1297)

- [ ] **Step 1: Add the swill namespace constant in svgInterop.ts**

In `/Users/mike/src/weasel/apps/swillustrator/src/svgInterop.ts`, near the top of the file (after the imports):

```ts
/**
 * The `swill:` XML namespace, used to ride Swillustrator-specific metadata
 * (paper-size, group-id, line-height, future: layers, parametric origin)
 * on top of standard SVG. weasel-svg has no knowledge of this URI — it
 * only knows the prefix → URI mapping we pass it via parse / serialize
 * options. All semantics live in this file.
 *
 * URI does not need to resolve; it's a stable identifier only.
 */
export const SWILL_NS = 'https://swillustrator.app/svg-ext';
export const SWILL_NAMESPACES = { swill: SWILL_NS } as const;
```

- [ ] **Step 2: Add the fixture strings**

Append to `/Users/mike/src/weasel/packages/weasel-svg/src/__fixtures__/fixtures.ts`:

```ts
export const SWILLUSTRATOR_MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:swill="https://swillustrator.app/svg-ext" viewBox="0 0 816 1056" width="816" height="1056" swill:paperSize="letter" swill:units="px">
  <title>My Doc</title>
  <path d="M 100 100 L 200 100 L 200 200 L 100 200 Z" fill="#3366ff" stroke="none"/>
  <text x="120" y="160" dominant-baseline="text-before-edge" data-weasel-width="60" data-weasel-height="20" font-size="16" font-family="sans-serif" fill="#000000">Hello</text>
</svg>`;

export const SWILLUSTRATOR_PAPERS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:swill="https://swillustrator.app/svg-ext" viewBox="0 0 794 1123" width="794" height="1123" swill:paperSize="a4" swill:units="px">
  <path d="M 10 10 L 50 10 L 50 50 L 10 50 Z" fill="#000000" stroke="none"/>
</svg>`;
```

- [ ] **Step 3: Write failing round-trip test for paper-size + title (weasel-svg side)**

Append to `/Users/mike/src/weasel/packages/weasel-svg/src/roundtrip.test.ts`:

```ts
  it('document-level metadata: viewBox, swill:paperSize, swill:units, title', () => {
    const namespaces = { swill: 'https://swillustrator.app/svg-ext' };
    const first = parseSvg(F.SWILLUSTRATOR_MINIMAL_SVG, { namespaces });
    expect(first.viewBox).toEqual({ x: 0, y: 0, width: 816, height: 1056 });
    expect(first.documentMeta?.swill?.attrs?.paperSize).toBe('letter');
    expect(first.documentMeta?.swill?.attrs?.units).toBe('px');
    expect(first.title).toBe('My Doc');

    const out = serializeSvg(first.nodes, {
      viewBox: first.viewBox,
      width: first.viewBox!.width,
      height: first.viewBox!.height,
      title: first.title,
      namespaces,
      documentMeta: first.documentMeta,
    });
    expect(out).toContain('xmlns:swill="https://swillustrator.app/svg-ext"');
    expect(out).toContain('width="816"');
    expect(out).toContain('height="1056"');
    expect(out).toContain('swill:paperSize="letter"');
    expect(out).toContain('swill:units="px"');
    expect(out).toContain('<title>My Doc</title>');

    const second = parseSvg(out, { namespaces });
    expect(second.viewBox).toEqual(first.viewBox);
    expect(second.documentMeta?.swill?.attrs?.paperSize).toBe('letter');
    expect(second.title).toBe('My Doc');
  });

  it('paper-size preset: A4', () => {
    const namespaces = { swill: 'https://swillustrator.app/svg-ext' };
    const r = parseSvg(F.SWILLUSTRATOR_PAPERS_SVG, { namespaces });
    expect(r.documentMeta?.swill?.attrs?.paperSize).toBe('a4');
    expect(r.viewBox).toEqual({ x: 0, y: 0, width: 794, height: 1123 });
  });
```

- [ ] **Step 4: Run the new tests, verify they pass**

Run: `cd /Users/mike/src/weasel && npx vitest run packages/weasel-svg/src/roundtrip.test.ts -t "document-level metadata|paper-size preset"`

Expected: both pass. If `viewBox` is undefined or `width`/`height` aren't emitted, T0 didn't include the standard-SVG additions — go back and add them: `parseSvg` should surface `viewBox` (T0 Step 6 already does this) and `<title>` (T0 Step 6 already does this); `serializeSvg` should emit `width`/`height`/`<title>` (T0 Step 7 already does this). The point of this step is to verify the integration end-to-end.

- [ ] **Step 5: Wire setDoc and save-options into App.tsx**

In `/Users/mike/src/weasel/apps/swillustrator/src/App.tsx`, update the svgInterop import to bring in the namespace constants:

```tsx
import { objToSvgNode, svgNodesToObjs, downloadSvg, pickSvgFile, SWILL_NS, SWILL_NAMESPACES } from './svgInterop';
```

Replace the `onSaveSvg` block (currently lines 1276-1282):

```tsx
        onSaveSvg={() => {
          const svgNodes = itemsRef.current.map(objToSvgNode);
          const svg = serializeSvg(svgNodes, {
            viewBox: { x: 0, y: 0, width: doc.size.width, height: doc.size.height },
            width: doc.size.width,
            height: doc.size.height,
            title: docTitle || undefined,
            namespaces: SWILL_NAMESPACES,
            documentMeta: {
              swill: {
                attrs: {
                  paperSize: paperSize,  // 'letter' | 'a4' | 'legal' — verbatim
                  units: 'px',
                },
              },
            },
          });
          downloadSvg(svg, `${docTitle || 'untitled'}.svg`);
        }}
```

Replace the `onOpenSvg` block (currently lines 1283-1297):

```tsx
        onOpenSvg={async () => {
          const text = await pickSvgFile();
          if (text == null) return;
          const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES });
          if (parsed.warnings.length > 0) {
            // eslint-disable-next-line no-console
            console.warn('Open SVG warnings:', parsed.warnings);
          }
          const next = svgNodesToObjs(parsed.nodes, () => `i${nextId.current++}`);
          itemsRef.current = next;
          groupsRef.current = [];
          historyRef.current?.clear();
          selection.set([]);
          if (parsed.viewBox) {
            setDoc({ size: { width: parsed.viewBox.width, height: parsed.viewBox.height } });
          }
          if (parsed.title != null) setDocTitle(parsed.title);
          // Paper-size preset: if the file declared one, pick it up. The
          // PaperSize type is keyed by the same strings ('letter' | 'a4' |
          // 'legal') we write on disk, so no transform is needed.
          const persistedPaperSize = parsed.documentMeta?.swill?.attrs?.paperSize;
          if (persistedPaperSize === 'letter' || persistedPaperSize === 'a4' || persistedPaperSize === 'legal') {
            setDoc((d) => ({ ...d, size: { ...PAPER_PRESETS[persistedPaperSize] } }));
          }
          publish();
        }}
```

(Note: `groupsRef.current = []` stays in place for Task 2; Task 3 will replace it. The warning-to-console call also stays; Task 5 replaces it with a toast. The `setDoc` for the paper-size preset comes *after* the viewBox-derived `setDoc` so the named preset wins when present.)

- [ ] **Step 6: Typecheck**

Run: `cd /Users/mike/src/weasel && npx tsc --noEmit`
Expected: zero errors. If `PAPER_PRESETS`, `setDoc`, or `setDocTitle` aren't in scope inside the prop closure, check the App component — they're declared at component top level. If `paperSize` is unused warning appears, ignore.

- [ ] **Step 7: Run the full test suite**

Run: `cd /Users/mike/src/weasel && npx vitest run`
Expected: all tests pass, including the two new round-trip cases.

- [ ] **Step 8: Commit**

```bash
git add packages/weasel-svg/src/__fixtures__/fixtures.ts packages/weasel-svg/src/roundtrip.test.ts apps/swillustrator/src/svgInterop.ts apps/swillustrator/src/App.tsx
git commit -m "feat(svg-native): paper-size, units, and title round-trip via swill namespace"
```

- [ ] **Step 9: Write the on-disk fixture files for documentation**

Create `/Users/mike/src/weasel/packages/weasel-svg/src/__fixtures__/swillustrator-minimal.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:swill="https://swillustrator.app/svg-ext" viewBox="0 0 816 1056" width="816" height="1056" swill:paperSize="letter" swill:units="px">
  <title>My Doc</title>
  <path d="M 100 100 L 200 100 L 200 200 L 100 200 Z" fill="#3366ff" stroke="none"/>
  <text x="120" y="160" dominant-baseline="text-before-edge" data-weasel-width="60" data-weasel-height="20" font-size="16" font-family="sans-serif" fill="#000000">Hello</text>
</svg>
```

Create `/Users/mike/src/weasel/packages/weasel-svg/src/__fixtures__/swillustrator-papers.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:swill="https://swillustrator.app/svg-ext" viewBox="0 0 794 1123" width="794" height="1123" swill:paperSize="a4" swill:units="px">
  <path d="M 10 10 L 50 10 L 50 50 L 10 50 Z" fill="#000000" stroke="none"/>
</svg>
```

- [ ] **Step 10: Commit the on-disk fixtures**

```bash
git add packages/weasel-svg/src/__fixtures__/swillustrator-minimal.svg packages/weasel-svg/src/__fixtures__/swillustrator-papers.svg
git commit -m "docs(weasel-svg): on-disk fixtures for swillustrator-authored SVGs"
```

---

## Task 3: Groups round-trip (spec's T2)

Goal: stop flattening `<g>` on import; emit `<g swill:group-id="...">` on export. Swillustrator's `groupsRef` populates from the parsed tree and drives the saved tree.

The `swill:group-id` attribute rides on T0's generic plumbing — no new kit-level knowledge of "group-id" is needed. The serializer sees `node.meta.swill.attrs['group-id']` and writes it; the parser sees the same on the way back.

This task also includes a small but important step: enforce **single-group-membership at the model level**. Each object belongs to at most one group. The kit's `Group` interface (`src/features/groups/types.ts`) currently permits multi-membership in principle, but Swillustrator's encoding requires a tree — and the spec's design decision is to forbid multi-membership outright (virtual groups will be a separate later concept tracked elsewhere). Without this invariant, two groups could each claim the same object id and the writer would need a tiebreaker. The invariant removes the ambiguity.

Enforcement strategy (option C from the design discussion): the Swillustrator group adapter in `App.tsx` is the single source of truth for the group model. Its `insertGroup` and `addToGroup` methods strip prior memberships before adding members to a new group. A throw-on-violation check in `objsToSvgNodes` is retained as belt-and-braces — it documents the invariant and catches any code path that mutates `Group.members` directly, bypassing the adapter. With the adapter fix in place, that check should never fire in practice.

**Files:**
- Create: `packages/weasel-svg/src/__fixtures__/swillustrator-groups.svg`
- Modify: `packages/weasel-svg/src/__fixtures__/fixtures.ts`
- Modify: `packages/weasel-svg/src/roundtrip.test.ts`
- Modify: `apps/swillustrator/src/svgInterop.ts`
- Modify: `apps/swillustrator/src/svgInterop.test.ts`
- Modify: `apps/swillustrator/src/App.tsx`

- [ ] **Step 0: Confirm the single-group-membership invariant in Swillustrator and decide on enforcement point**

Run: `grep -n "addToGroup\|insertGroup\|createGroup\|getGroupsForMember" /Users/mike/src/weasel/apps/swillustrator/src/App.tsx`
Expected: the Swillustrator group adapter (around lines 547–566) implements `insertGroup`, `addToGroup`, `removeFromGroup`, `removeGroup`, `getGroup`, `getGroupsForMember`. The `useGroup` hook in `src/interactions/actions/group/group.ts` builds a new group from the current selection and dispatches `createCreateGroupOp`, which calls back into Swillustrator's `insertGroup`. The kit-level `Group` model (in `src/features/groups/`) permits multi-membership for general consumers; Swillustrator's policy is stricter.

The enforcement decision (option C from the design discussion): forbid multi-membership **at the model level**, in Swillustrator's group adapter. `insertGroup` and `addToGroup` strip any prior memberships from other groups before binding members to the new group. Three enforcement points work together:

1. **On import** (`svgNodesToObjsWithGroups`): the SVG is a tree, so each object id appears in at most one group's children. No work needed.
2. **On in-memory mutation** (`insertGroup` / `addToGroup` in `App.tsx`): when a member is added to a group, it is removed from every other group it currently belongs to. This is the model-level fix and the primary enforcement point. Steps 7a–7c implement and test it.
3. **At the persistence boundary** (`objsToSvgNodes` in `svgInterop.ts`): a defense-in-depth assertion that throws if any object id is claimed by more than one group. With the adapter fix in place this should never fire in practice; it stays as belt-and-braces in case some other code path mutates `Group.members` directly (e.g. an op that splices the array without going through the adapter). Step 6 includes this assertion.

For the scope of this plan, both Step 6's persistence-boundary assertion and Steps 7a–7c's adapter fix land together.

- [ ] **Step 1: Add the groups fixture string**

Append to `/Users/mike/src/weasel/packages/weasel-svg/src/__fixtures__/fixtures.ts`:

```ts
export const SWILLUSTRATOR_GROUPS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:swill="https://swillustrator.app/svg-ext" viewBox="0 0 400 400">
  <g swill:group-id="g1">
    <path d="M 10 10 L 60 10 L 60 60 L 10 60 Z" fill="#ff0000" stroke="none"/>
    <path d="M 70 10 L 120 10 L 120 60 L 70 60 Z" fill="#00ff00" stroke="none"/>
    <path d="M 130 10 L 180 10 L 180 60 L 130 60 Z" fill="#0000ff" stroke="none"/>
  </g>
  <g swill:group-id="g2">
    <path d="M 10 100 L 60 100 L 60 150 L 10 150 Z" fill="#ffff00" stroke="none"/>
    <path d="M 70 100 L 120 100 L 120 150 L 70 150 Z" fill="#ff00ff" stroke="none"/>
    <path d="M 130 100 L 180 100 L 180 150 L 130 150 Z" fill="#00ffff" stroke="none"/>
  </g>
</svg>`;
```

- [ ] **Step 2: Write failing round-trip test for groups with swill:group-id**

Append to `/Users/mike/src/weasel/packages/weasel-svg/src/roundtrip.test.ts`:

```ts
  it('groups with swill:group-id round-trip', () => {
    const namespaces = { swill: 'https://swillustrator.app/svg-ext' };
    const first = parseSvg(F.SWILLUSTRATOR_GROUPS_SVG, { namespaces });
    expect(first.warnings).toEqual([]);
    expect(first.nodes).toHaveLength(2);
    expect(first.nodes[0].kind).toBe('group');
    const g0 = first.nodes[0];
    if (g0.kind !== 'group') throw new Error('expected group');
    expect(g0.meta?.swill?.attrs?.['group-id']).toBe('g1');
    expect(g0.children).toHaveLength(3);

    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 400, height: 400 },
      namespaces,
    });
    expect(out).toContain('swill:group-id="g1"');
    expect(out).toContain('swill:group-id="g2"');

    const second = parseSvg(out, { namespaces });
    expect(second.nodes).toHaveLength(2);
    const s0 = second.nodes[0];
    if (s0.kind !== 'group') throw new Error('expected group');
    expect(s0.meta?.swill?.attrs?.['group-id']).toBe('g1');
    expect(s0.children).toHaveLength(3);
  });
```

- [ ] **Step 3: Run the test, verify it passes**

Run: `cd /Users/mike/src/weasel && npx vitest run packages/weasel-svg/src/roundtrip.test.ts -t "swill:group-id"`
Expected: PASS — T0's generic pass-through already handles `swill:group-id` as an opaque per-element attribute. This test confirms the end-to-end path works without any kit-level changes. If it fails, the `meta` collection in T0 has a bug — fix it there.

- [ ] **Step 4: Write failing bridge test for group preservation**

Modify `/Users/mike/src/weasel/apps/swillustrator/src/svgInterop.test.ts`. **Delete** the existing baseline test `it('baseline: flattens groups inlining their children', ...)` — its expectation is about to flip. **Add** the following inside a new `describe('svgNodesToObjsWithGroups')` block:

```ts
describe('svgNodesToObjsWithGroups — groups preserved', () => {
  it('returns a Group record for each SvgGroupNode and inlines members', () => {
    const child: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#000000' },
    };
    const g: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'g1' } } },
      children: [child],
    };
    const result = svgNodesToObjsWithGroups([g], ids());
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe('rect');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toBe('g1');
    expect(result.groups[0].members).toEqual([result.items[0].id]);
  });

  it('handles nested groups by including child group ids in the parent member list', () => {
    const leaf: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#abc' },
    };
    const inner: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'inner' } } },
      children: [leaf],
    };
    const outer: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'outer' } } },
      children: [inner],
    };
    const result = svgNodesToObjsWithGroups([outer], ids());
    expect(result.items).toHaveLength(1);
    expect(result.groups.map((g) => g.id).sort()).toEqual(['inner', 'outer']);
    const innerGroup = result.groups.find((g) => g.id === 'inner');
    const outerGroup = result.groups.find((g) => g.id === 'outer');
    expect(innerGroup!.members).toEqual([result.items[0].id]);
    expect(outerGroup!.members).toEqual(['inner']);
  });

  it('groups without swill:group-id synthesize an id from the nextId fn', () => {
    const leaf: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#fff' },
    };
    const g: SvgGroupNode = { kind: 'group', children: [leaf] };
    const result = svgNodesToObjsWithGroups([g], ids());
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toMatch(/^i\d+$/);
    expect(result.groups[0].members).toEqual([result.items[0].id]);
  });
});

describe('objsToSvgNodes — groups emitted', () => {
  it('builds an SvgGroupNode wrapping the members of a Group', () => {
    const items = [
      { id: 'a', kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
      { id: 'b', kind: 'rect' as const, x: 20, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
    ];
    const groups = [{ id: 'g1', members: ['a', 'b'] }];
    const nodes = objsToSvgNodes(items as never, groups);
    expect(nodes).toHaveLength(1);
    const n0 = nodes[0];
    expect(n0.kind).toBe('group');
    if (n0.kind !== 'group') throw new Error('expected group');
    expect(n0.meta?.swill?.attrs?.['group-id']).toBe('g1');
    expect(n0.children).toHaveLength(2);
  });

  it('emits items not in any group at the document root', () => {
    const items = [
      { id: 'a', kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
      { id: 'b', kind: 'rect' as const, x: 20, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
    ];
    const groups = [{ id: 'g1', members: ['a'] }];
    const nodes = objsToSvgNodes(items as never, groups);
    // One group (wrapping 'a') + one root-level path ('b').
    expect(nodes).toHaveLength(2);
    expect(nodes[0].kind).toBe('group');
    expect(nodes[1].kind).toBe('path');
  });

  it('nests SvgGroupNodes for nested Groups', () => {
    const items = [
      { id: 'a', kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
    ];
    const groups = [
      { id: 'inner', members: ['a'] },
      { id: 'outer', members: ['inner'] },
    ];
    const nodes = objsToSvgNodes(items as never, groups);
    expect(nodes).toHaveLength(1);
    const outer = nodes[0];
    if (outer.kind !== 'group') throw new Error('expected outer group');
    expect(outer.meta?.swill?.attrs?.['group-id']).toBe('outer');
    expect(outer.children).toHaveLength(1);
    const inner = outer.children[0];
    if (inner.kind !== 'group') throw new Error('expected inner group');
    expect(inner.meta?.swill?.attrs?.['group-id']).toBe('inner');
  });

  it('rejects multi-group membership at the persistence boundary', () => {
    const items = [
      { id: 'a', kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
    ];
    // 'a' is claimed by two groups — this violates the single-membership invariant.
    const groups = [
      { id: 'g1', members: ['a'] },
      { id: 'g2', members: ['a'] },
    ];
    expect(() => objsToSvgNodes(items as never, groups)).toThrow(/multi-group membership/i);
  });
});
```

At the top of the file, update the imports:

```ts
import { objToSvgNode, svgNodesToObjs, svgNodesToObjsWithGroups, objsToSvgNodes } from './svgInterop';
```

- [ ] **Step 5: Run bridge tests, verify they fail**

Run: `cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/svgInterop.test.ts`
Expected: FAIL — `svgNodesToObjsWithGroups` / `objsToSvgNodes` are not exported yet.

- [ ] **Step 6: Implement svgNodesToObjsWithGroups and objsToSvgNodes**

In `/Users/mike/src/weasel/apps/swillustrator/src/svgInterop.ts`:

a) Add `Group` to the imports and to the local type set:

```ts
import type { Path, PolygonPath, TextStyle } from '@orochi235/weasel';
import type {
  SvgNode,
  SvgGroupNode,
  SvgPathNode,
  SvgTextNode,
} from '@orochi235/weasel-svg';

interface Group { id: string; members: string[] }
```

b) Add the new `objsToSvgNodes` after `objToSvgNode`:

```ts
/**
 * Lower a Swillustrator scene (items + groups) to an SvgNode[] tree.
 * Items that belong to a group are emitted inside that group's
 * SvgGroupNode; items not in any group sit at the root.
 *
 * Nested groups are supported via Group.members containing group ids.
 * A group id appears in the output tree exactly once (under its parent,
 * or at root if it has no parent group).
 *
 * Single-group-membership invariant: each item / group id appears in at
 * most one parent group's `members[]`. The function throws if the input
 * violates this; the model layer is expected to maintain it.
 */
export function objsToSvgNodes(items: readonly Obj[], groups: readonly Group[]): SvgNode[] {
  const itemsById = new Map<string, Obj>();
  for (const o of items) itemsById.set(o.id, o);
  const groupsById = new Map<string, Group>();
  for (const g of groups) groupsById.set(g.id, g);

  // Enforce single-group-membership: each child id appears in at most one
  // parent. If two groups claim the same id, fail loudly — Swillustrator's
  // model layer must guarantee this invariant, and a violation here means
  // a bug in group ops, not an encoding ambiguity to silently disambiguate.
  const parentOf = new Map<string, string>();
  for (const g of groups) {
    for (const m of g.members) {
      const existing = parentOf.get(m);
      if (existing) {
        throw new Error(
          `multi-group membership detected: '${m}' belongs to both '${existing}' and '${g.id}'. ` +
          `Swillustrator's group model forbids multi-membership.`,
        );
      }
      parentOf.set(m, g.id);
    }
  }

  const buildGroup = (g: Group): SvgGroupNode => {
    const children: SvgNode[] = [];
    for (const m of g.members) {
      const childGroup = groupsById.get(m);
      if (childGroup) {
        children.push(buildGroup(childGroup));
        continue;
      }
      const childItem = itemsById.get(m);
      if (childItem) children.push(objToSvgNode(childItem));
    }
    const node: SvgGroupNode = { kind: 'group', children };
    node.meta = { swill: { attrs: { 'group-id': g.id } } };
    return node;
  };

  const out: SvgNode[] = [];
  // Root-level groups: groups that aren't a member of any other group.
  for (const g of groups) {
    if (!parentOf.has(g.id)) out.push(buildGroup(g));
  }
  // Root-level items: items not claimed by any group.
  for (const o of items) {
    if (!parentOf.has(o.id)) out.push(objToSvgNode(o));
  }
  return out;
}
```

c) Add `svgNodesToObjsWithGroups` adjacent to `svgNodesToObjs`. Refactor the existing `svgNodesToObjs` to delegate:

```ts
/**
 * Walk an SvgNode tree and emit a Swillustrator scene (items + groups).
 * Each SvgGroupNode becomes a Group record. The group id is taken from
 * `n.meta?.swill?.attrs?.['group-id']` when set, else synthesized via
 * `nextId()`. Nested groups produce nested Group.members lists.
 */
export function svgNodesToObjsWithGroups(
  nodes: readonly SvgNode[],
  nextId: () => string,
): { items: Obj[]; groups: Group[] } {
  const items: Obj[] = [];
  const groups: Group[] = [];

  const visit = (n: SvgNode): string => {
    if (n.kind === 'group') {
      const gid = n.meta?.swill?.attrs?.['group-id'] ?? nextId();
      const memberIds: string[] = [];
      for (const c of n.children) memberIds.push(visit(c));
      groups.push({ id: gid, members: memberIds });
      return gid;
    }
    if (n.kind === 'text') {
      const o: TextObj = {
        id: nextId(),
        kind: 'text',
        x: n.x, y: n.y, width: n.width, height: n.height,
        text: n.text,
      };
      if (n.style) o.style = n.style;
      items.push(o);
      return o.id;
    }
    const fill = colorFromPaint(n.fill, '#000000');
    const stroke = n.stroke ? colorFromPaint(n.stroke.paint, '#000000') : '#000000';
    const strokeWidth = n.stroke?.width ?? 0;
    if (n.path.kind === 'rect') {
      const o: RectObj = {
        id: nextId(),
        kind: 'rect',
        x: n.path.x, y: n.path.y, width: n.path.width, height: n.path.height,
        fill, stroke, strokeWidth,
      };
      items.push(o);
      return o.id;
    }
    const path = n.path as PolygonPath;
    const bounds = pathBounds(path);
    const closed = isClosedPolygon(path);
    const o: PathObj = {
      id: nextId(),
      kind: 'path',
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      path, closed, fill, stroke, strokeWidth,
    };
    items.push(o);
    return o.id;
  };
  nodes.forEach(visit);
  return { items, groups };
}

export function svgNodesToObjs(
  nodes: readonly SvgNode[],
  nextId: () => string,
): Obj[] {
  return svgNodesToObjsWithGroups(nodes, nextId).items;
}
```

- [ ] **Step 7: Run bridge tests, verify they pass**

Run: `cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/svgInterop.test.ts`
Expected: all tests in the file pass, including the new `svgNodesToObjsWithGroups` and `objsToSvgNodes` tests, plus the multi-group-rejection test.

- [ ] **Step 7a: Extract a `createGroupAdapter` factory in groupMembership.ts (no strip yet)**

Create `/Users/mike/src/weasel/apps/swillustrator/src/groupMembership.ts`. This is a verbatim extraction of the groups portion of the App.tsx adapter (lines ~547–566) — same behavior, no strip yet. The strip lands in Step 7c, after Step 7b's test fails.

```ts
import type { Group } from '@orochi235/weasel';

/** Mutable reference shape — matches how App.tsx stores its `groupsRef`. */
export interface GroupsRef {
  current: Group[];
}

/** The subset of the App.tsx adapter that owns the group model. Exported as
 *  a factory so tests can exercise the same logic the app uses. */
export interface GroupModelAdapter {
  getGroup(id: string): Group | undefined;
  getGroupsForMember(id: string): string[];
  insertGroup(g: Group): void;
  removeGroup(id: string): void;
  addToGroup(gid: string, ids: string[]): void;
  removeFromGroup(gid: string, ids: string[]): void;
}

export function createGroupAdapter(groupsRef: GroupsRef): GroupModelAdapter {
  return {
    getGroup: (id) => groupsRef.current.find((g) => g.id === id),
    getGroupsForMember: (id) =>
      groupsRef.current.filter((g) => g.members.includes(id)).map((g) => g.id),
    insertGroup: (g) => {
      if (groupsRef.current.find((x) => x.id === g.id)) return;
      groupsRef.current.push({ ...g, members: [...g.members] });
    },
    removeGroup: (id) => {
      const i = groupsRef.current.findIndex((g) => g.id === id);
      if (i >= 0) groupsRef.current.splice(i, 1);
    },
    addToGroup: (gid, ids) => {
      const g = groupsRef.current.find((x) => x.id === gid);
      if (!g) return;
      for (const id of ids) if (!g.members.includes(id)) g.members.push(id);
    },
    removeFromGroup: (gid, ids) => {
      const g = groupsRef.current.find((x) => x.id === gid);
      if (!g) return;
      g.members = g.members.filter((m) => !ids.includes(m));
    },
  };
}
```

- [ ] **Step 7b: Write a failing test that proves create-handler strips prior memberships**

Create `/Users/mike/src/weasel/apps/swillustrator/src/groupMembership.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Group } from '@orochi235/weasel';
import { createGroupAdapter, type GroupsRef } from './groupMembership';

describe('group adapter — single-membership enforcement on create', () => {
  it('insertGroup strips ids that were in a prior group', () => {
    const groupsRef: GroupsRef = { current: [{ id: 'old', members: ['a', 'b', 'c'] }] };
    const adapter = createGroupAdapter(groupsRef);
    adapter.insertGroup({ id: 'new', members: ['a', 'b'] });
    expect(groupsRef.current.find((g) => g.id === 'old')!.members).toEqual(['c']);
    expect(groupsRef.current.find((g) => g.id === 'new')!.members).toEqual(['a', 'b']);
  });

  it('insertGroup strips members from multiple prior groups', () => {
    const groupsRef: GroupsRef = {
      current: [
        { id: 'g1', members: ['a', 'b'] },
        { id: 'g2', members: ['c', 'd'] },
      ],
    };
    const adapter = createGroupAdapter(groupsRef);
    adapter.insertGroup({ id: 'g3', members: ['b', 'c'] });
    expect(groupsRef.current.find((g) => g.id === 'g1')!.members).toEqual(['a']);
    expect(groupsRef.current.find((g) => g.id === 'g2')!.members).toEqual(['d']);
    expect(groupsRef.current.find((g) => g.id === 'g3')!.members).toEqual(['b', 'c']);
  });

  it('addToGroup strips ids that were in a prior group', () => {
    const groupsRef: GroupsRef = {
      current: [
        { id: 'old', members: ['a', 'b'] },
        { id: 'target', members: ['c'] },
      ],
    };
    const adapter = createGroupAdapter(groupsRef);
    adapter.addToGroup('target', ['a']);
    expect(groupsRef.current.find((g) => g.id === 'old')!.members).toEqual(['b']);
    expect(groupsRef.current.find((g) => g.id === 'target')!.members).toEqual(['c', 'a']);
  });

  it('insertGroup leaves untouched groups alone', () => {
    const groupsRef: GroupsRef = {
      current: [
        { id: 'g1', members: ['x', 'y'] },
        { id: 'g2', members: ['z'] },
      ],
    };
    const adapter = createGroupAdapter(groupsRef);
    adapter.insertGroup({ id: 'g3', members: ['x'] });
    expect(groupsRef.current.find((g) => g.id === 'g2')!.members).toEqual(['z']);
  });
});
```

Run: `cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/groupMembership.test.ts`
Expected: FAIL — `createGroupAdapter` from Step 7a does not strip prior memberships, so the `old` group still claims `a` and `b` after the new group is inserted. The failure message should look like `expected ['a', 'b', 'c'] to equal ['c']`.

- [ ] **Step 7c: Add `stripPriorMemberships`, wire it through `createGroupAdapter` and App.tsx**

In `/Users/mike/src/weasel/apps/swillustrator/src/groupMembership.ts`, add the helper above `createGroupAdapter`:

```ts
/**
 * Strip the given member ids from every group except `targetGroupId`.
 * Mutates each affected group's `members` array. No-op for empty input.
 *
 * Swillustrator forbids multi-group membership at the model level. When a
 * group claims members, this helper yanks those members out of any group
 * that previously held them. The persistence-boundary check in
 * `objsToSvgNodes` (svgInterop.ts) is defense-in-depth on top of this; with
 * the strip in place it should never fire in practice.
 */
export function stripPriorMemberships(
  groups: Group[],
  memberIds: readonly string[],
  targetGroupId: string,
): void {
  if (memberIds.length === 0) return;
  const toStrip = new Set(memberIds);
  for (const g of groups) {
    if (g.id === targetGroupId) continue;
    if (g.members.some((m) => toStrip.has(m))) {
      g.members = g.members.filter((m) => !toStrip.has(m));
    }
  }
}
```

Then update `createGroupAdapter`'s `insertGroup` and `addToGroup` to call it:

```ts
    insertGroup: (g) => {
      if (groupsRef.current.find((x) => x.id === g.id)) return;
      stripPriorMemberships(groupsRef.current, g.members, g.id);
      groupsRef.current.push({ ...g, members: [...g.members] });
    },
    // ...
    addToGroup: (gid, ids) => {
      const g = groupsRef.current.find((x) => x.id === gid);
      if (!g) return;
      stripPriorMemberships(groupsRef.current, ids, gid);
      for (const id of ids) if (!g.members.includes(id)) g.members.push(id);
    },
```

In `/Users/mike/src/weasel/apps/swillustrator/src/App.tsx`, add the import near the other local imports:

```tsx
import { createGroupAdapter } from './groupMembership';
```

Then replace the inline groups portion of the adapter (around lines 547–566, the methods `getGroup` / `getGroupsForMember` / `insertGroup` / `removeGroup` / `addToGroup` / `removeFromGroup`) with a spread of the factory's result. The surrounding adapter object stays unchanged; only those six methods move:

```tsx
      // --- groups (virtual) ---
      ...createGroupAdapter(groupsRef),
      // --- clipboard / insert ---
```

Run: `cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/groupMembership.test.ts && npx tsc --noEmit`
Expected: all four tests in `groupMembership.test.ts` pass; typecheck is clean. The `objsToSvgNodes` multi-membership assertion from Step 6 is still in place as belt-and-braces — it should never fire in practice with the model-level fix here, but it documents the invariant and catches direct mutations to `Group.members` that bypass `createGroupAdapter`.

- [ ] **Step 8: Wire groupsRef on Save and Open in App.tsx**

In `/Users/mike/src/weasel/apps/swillustrator/src/App.tsx`:

a) Update the import line for svgInterop:

```tsx
import {
  objToSvgNode, objsToSvgNodes, svgNodesToObjs, svgNodesToObjsWithGroups,
  downloadSvg, pickSvgFile, SWILL_NS, SWILL_NAMESPACES,
} from './svgInterop';
```

b) Replace `onSaveSvg` to use the group-aware emitter:

```tsx
        onSaveSvg={() => {
          const svgNodes = objsToSvgNodes(itemsRef.current, groupsRef.current);
          const svg = serializeSvg(svgNodes, {
            viewBox: { x: 0, y: 0, width: doc.size.width, height: doc.size.height },
            width: doc.size.width,
            height: doc.size.height,
            title: docTitle || undefined,
            namespaces: SWILL_NAMESPACES,
            documentMeta: {
              swill: {
                attrs: {
                  paperSize: paperSize,
                  units: 'px',
                },
              },
            },
          });
          downloadSvg(svg, `${docTitle || 'untitled'}.svg`);
        }}
```

c) Replace `onOpenSvg` to populate `groupsRef`:

```tsx
        onOpenSvg={async () => {
          const text = await pickSvgFile();
          if (text == null) return;
          const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES });
          if (parsed.warnings.length > 0) {
            // eslint-disable-next-line no-console
            console.warn('Open SVG warnings:', parsed.warnings);
          }
          const { items: nextItems, groups: nextGroups } = svgNodesToObjsWithGroups(
            parsed.nodes,
            () => `i${nextId.current++}`,
          );
          itemsRef.current = nextItems;
          groupsRef.current = nextGroups;
          setGroups(nextGroups.slice());
          historyRef.current?.clear();
          selection.set([]);
          if (parsed.viewBox) {
            setDoc({ size: { width: parsed.viewBox.width, height: parsed.viewBox.height } });
          }
          if (parsed.title != null) setDocTitle(parsed.title);
          const persistedPaperSize = parsed.documentMeta?.swill?.attrs?.paperSize;
          if (persistedPaperSize === 'letter' || persistedPaperSize === 'a4' || persistedPaperSize === 'legal') {
            setDoc((d) => ({ ...d, size: { ...PAPER_PRESETS[persistedPaperSize] } }));
          }
          publish();
        }}
```

- [ ] **Step 9: Typecheck and re-run all tests**

Run: `cd /Users/mike/src/weasel && npx tsc --noEmit && npx vitest run`
Expected: clean typecheck; all bridge + round-trip tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/weasel-svg/src/__fixtures__/fixtures.ts packages/weasel-svg/src/roundtrip.test.ts apps/swillustrator/src/svgInterop.ts apps/swillustrator/src/svgInterop.test.ts apps/swillustrator/src/groupMembership.ts apps/swillustrator/src/groupMembership.test.ts apps/swillustrator/src/App.tsx
git commit -m "feat(svg-native): preserve groups end-to-end via swill:group-id; forbid multi-group membership"
```

- [ ] **Step 11: Add the on-disk groups fixture**

Create `/Users/mike/src/weasel/packages/weasel-svg/src/__fixtures__/swillustrator-groups.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:swill="https://swillustrator.app/svg-ext" viewBox="0 0 400 400">
  <g swill:group-id="g1">
    <path d="M 10 10 L 60 10 L 60 60 L 10 60 Z" fill="#ff0000" stroke="none"/>
    <path d="M 70 10 L 120 10 L 120 60 L 70 60 Z" fill="#00ff00" stroke="none"/>
    <path d="M 130 10 L 180 10 L 180 60 L 130 60 Z" fill="#0000ff" stroke="none"/>
  </g>
  <g swill:group-id="g2">
    <path d="M 10 100 L 60 100 L 60 150 L 10 150 Z" fill="#ffff00" stroke="none"/>
    <path d="M 70 100 L 120 100 L 120 150 L 70 150 Z" fill="#ff00ff" stroke="none"/>
    <path d="M 130 100 L 180 100 L 180 150 L 130 150 Z" fill="#00ffff" stroke="none"/>
  </g>
</svg>
```

```bash
git add packages/weasel-svg/src/__fixtures__/swillustrator-groups.svg
git commit -m "docs(weasel-svg): on-disk fixture for swillustrator groups"
```

---

## Task 4: Text style round-trip (spec's T4)

Goal: every `TextStyle` field a Swillustrator user can set survives a save→open cycle. `lineHeight` is encoded via `meta.swill.attrs['line-height']` (T0's plumbing). No legacy `data-weasel-line-height` reader — per the spec's Migration section there is no installed base to compat against.

`TextStyle` fields (from `/Users/mike/src/weasel/src/features/text/textStyle.ts`):
- `fontSize` → `font-size="<n>"` (already supported, keep)
- `fontFamily` → `font-family="..."` (already supported, keep)
- `fontWeight` → `font-weight="<n|str>"` (already supported, keep)
- `fontStyle` → `font-style="italic"` only when non-normal (already supported, keep)
- `align` → `text-anchor="start|middle|end"` (already supported, keep)
- `lineHeight` → `swill:line-height="<n>"` via `node.meta.swill.attrs['line-height']` (was `data-weasel-line-height` — **migrate, no compat fallback**)
- `fill` → solid → `fill="#rrggbb"` (+ optional `fill-opacity` already supported); gradient via `<defs>` (already supported, keep)
- `caretColor`, `selectionBackground`, `selectionColor` → **not persisted** (edit-overlay-only chrome, not document content). Document the choice inline.

**Files:**
- Modify: `packages/weasel-svg/src/parse.ts`
- Modify: `packages/weasel-svg/src/serialize.ts`
- Modify: `packages/weasel-svg/src/__fixtures__/fixtures.ts`
- Modify: `packages/weasel-svg/src/roundtrip.test.ts`
- Modify: `apps/swillustrator/src/svgInterop.ts`
- Modify: `apps/swillustrator/src/svgInterop.test.ts`

- [ ] **Step 1: Add a text-style fixture with every persisted field set**

Append to `/Users/mike/src/weasel/packages/weasel-svg/src/__fixtures__/fixtures.ts`:

```ts
export const TEXT_STYLE_FULL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:swill="https://swillustrator.app/svg-ext" viewBox="0 0 200 100">
  <text x="10" y="20" dominant-baseline="text-before-edge" data-weasel-width="180" data-weasel-height="60" font-size="18" font-family="Inter, sans-serif" font-weight="700" font-style="italic" text-anchor="middle" fill="#b03030" swill:line-height="1.4">Styled</text>
</svg>`;
```

- [ ] **Step 2: Write failing round-trip test**

Append to `/Users/mike/src/weasel/packages/weasel-svg/src/roundtrip.test.ts`:

```ts
  it('text style: font-size/family/weight/italic/align + fill round-trip', () => {
    const namespaces = { swill: 'https://swillustrator.app/svg-ext' };
    const first = parseSvg(F.TEXT_STYLE_FULL_SVG, { namespaces });
    expect(first.warnings).toEqual([]);
    expect(first.nodes).toHaveLength(1);
    const t = first.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.fontSize).toBe(18);
    expect(t.style?.fontFamily).toBe('Inter, sans-serif');
    expect(t.style?.fontWeight).toBe(700);
    expect(t.style?.fontStyle).toBe('italic');
    expect(t.style?.align).toBe('center');
    expect(t.style?.fill).toEqual({ fill: 'solid', color: '#b03030' });
    // lineHeight rides on meta.swill.attrs['line-height'] — interpreted by
    // svgInterop, not by weasel-svg. From weasel-svg's perspective the
    // value is just a string in the meta bag.
    expect(t.meta?.swill?.attrs?.['line-height']).toBe('1.4');

    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 200, height: 100 },
      namespaces,
    });
    expect(out).toContain('font-size="18"');
    expect(out).toContain('font-family="Inter, sans-serif"');
    expect(out).toContain('font-weight="700"');
    expect(out).toContain('font-style="italic"');
    expect(out).toContain('text-anchor="middle"');
    expect(out).toContain('swill:line-height="1.4"');
    expect(out).toContain('fill="#b03030"');
    // Legacy attribute is gone — no compat-write either.
    expect(out).not.toContain('data-weasel-line-height');

    const second = parseSvg(out, { namespaces });
    const t2 = second.nodes[0];
    if (t2.kind !== 'text') throw new Error('expected text');
    expect(t2.style).toEqual(t.style);
    expect(t2.meta?.swill?.attrs?.['line-height']).toBe('1.4');
  });
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `cd /Users/mike/src/weasel && npx vitest run packages/weasel-svg/src/roundtrip.test.ts -t "text style"`
Expected: FAIL — the serializer still emits `data-weasel-line-height` (carried over from the pre-namespace implementation). The parser still reads from `data-weasel-line-height` into `style.lineHeight`. We need to (a) remove both, (b) push the line-height value into the generic meta path on write, (c) leave reading on the meta path (svgInterop will interpret it).

- [ ] **Step 4: Remove the legacy line-height attribute handling in parse.ts**

In `/Users/mike/src/weasel/packages/weasel-svg/src/parse.ts`, inside `readTextStyle` (or wherever the `data-weasel-line-height` attribute is read), delete the block:

```ts
  // DELETE THIS:
  const lh = el.getAttribute('data-weasel-line-height');
  if (lh != null) {
    const n = parseFloat(lh);
    if (Number.isFinite(n)) style.lineHeight = n;
  }
```

The line-height is now part of the generic `meta` bag — it does not become a `TextStyle.lineHeight` field at the weasel-svg layer. svgInterop is responsible for translating between `style.lineHeight` (Swillustrator's in-memory shape) and `meta.swill.attrs['line-height']` (the on-disk shape).

- [ ] **Step 5: Remove the legacy line-height emission in serialize.ts**

In `/Users/mike/src/weasel/packages/weasel-svg/src/serialize.ts`, inside `textXml`, delete the block:

```ts
  // DELETE THIS:
  if (style?.lineHeight != null) {
    attrs.push(`data-weasel-line-height="${trimNumber(style.lineHeight)}"`);
  }
```

The line-height will now be emitted via `metaAttrsXml(node.meta, namespaces)` (already in place from T0).

- [ ] **Step 6: Teach svgInterop to translate `style.lineHeight` ↔ `meta.swill.attrs['line-height']`**

In `/Users/mike/src/weasel/apps/swillustrator/src/svgInterop.ts`, inside `objToSvgNode` (the text branch), after building the `SvgTextNode`, attach the meta if `style.lineHeight` is set:

```ts
  // Existing text-branch:
  const node: SvgTextNode = {
    kind: 'text',
    x: obj.x, y: obj.y, width: obj.width, height: obj.height,
    text: obj.text,
  };
  if (obj.style) {
    // Pass the style through — but lift lineHeight out into the meta bag,
    // since weasel-svg no longer knows about lineHeight.
    const { lineHeight, ...rest } = obj.style;
    if (Object.keys(rest).length > 0) node.style = rest as TextStyle;
    if (lineHeight != null) {
      node.meta = { swill: { attrs: { 'line-height': String(lineHeight) } } };
    }
  }
  return node;
```

In `svgNodesToObjsWithGroups`, in the text branch, lift the meta back into the style:

```ts
    if (n.kind === 'text') {
      const o: TextObj = {
        id: nextId(),
        kind: 'text',
        x: n.x, y: n.y, width: n.width, height: n.height,
        text: n.text,
      };
      // Reconstitute the full TextStyle from weasel-svg's style + the
      // namespaced lineHeight from the meta bag.
      const lhStr = n.meta?.swill?.attrs?.['line-height'];
      const lh = lhStr != null ? parseFloat(lhStr) : undefined;
      if (n.style || (lh != null && Number.isFinite(lh))) {
        o.style = { ...(n.style ?? {}) };
        if (lh != null && Number.isFinite(lh)) o.style.lineHeight = lh;
      }
      items.push(o);
      return o.id;
    }
```

- [ ] **Step 7: Run round-trip tests, verify they pass**

Run: `cd /Users/mike/src/weasel && npx vitest run packages/weasel-svg/src/roundtrip.test.ts`
Expected: all tests pass, including the new "text style" test.

- [ ] **Step 8: Add a bridge test confirming the style survives Obj ↔ SvgNode**

Append to `/Users/mike/src/weasel/apps/swillustrator/src/svgInterop.test.ts`:

```ts
describe('text style round-trip via the bridge', () => {
  it('emits and reads back every persisted TextStyle field including lineHeight', () => {
    const text = {
      id: 't1', kind: 'text' as const,
      x: 0, y: 0, width: 100, height: 20, text: 'Hi',
      style: {
        fontSize: 18,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        fontStyle: 'italic' as const,
        align: 'center' as const,
        lineHeight: 1.4,
        fill: { fill: 'solid' as const, color: '#b03030' },
      },
    };
    const node = objToSvgNode(text as never);
    expect(node.kind).toBe('text');
    if (node.kind !== 'text') throw new Error('expected text');
    // lineHeight rides in meta, not style.
    expect(node.style?.lineHeight).toBeUndefined();
    expect(node.meta?.swill?.attrs?.['line-height']).toBe('1.4');

    const back = svgNodesToObjs([node], ids());
    expect(back).toHaveLength(1);
    const t = back[0] as { kind: 'text'; style?: { lineHeight?: number } };
    expect(t.style?.lineHeight).toBe(1.4);
    expect(t.style).toEqual(text.style);
  });
});
```

- [ ] **Step 9: Run bridge tests, verify they pass**

Run: `cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/svgInterop.test.ts`
Expected: all tests pass, including the new text-style bridge test.

- [ ] **Step 10: Commit**

```bash
git add packages/weasel-svg/src/parse.ts packages/weasel-svg/src/serialize.ts packages/weasel-svg/src/__fixtures__/fixtures.ts packages/weasel-svg/src/roundtrip.test.ts apps/swillustrator/src/svgInterop.ts apps/swillustrator/src/svgInterop.test.ts
git commit -m "feat(svg-native): text style round-trip; lineHeight via swill:line-height"
```

---

## Task 5: Warning toast (spec's T5)

Goal: replace the `console.warn('Open SVG warnings:', ...)` with a visible-on-screen toast component listing each warning, dismissible by the user. Lives in the Swillustrator UI layer; no bridge or weasel-svg change.

**Files:**
- Create: `apps/swillustrator/src/Toasts.tsx`
- Create: `apps/swillustrator/src/Toasts.module.css` (or additions to `swillustrator.css` — see Step 1)
- Modify: `apps/swillustrator/src/App.tsx`

- [ ] **Step 1: Inspect existing CSS module patterns in apps/swillustrator**

Run: `ls /Users/mike/src/weasel/apps/swillustrator/src/*.css /Users/mike/src/weasel/apps/swillustrator/src/*.module.css 2>/dev/null && grep -n "modules" /Users/mike/src/weasel/apps/swillustrator/vite.config.ts 2>/dev/null`
Expected: `swillustrator.css` exists (global). There is no existing `*.module.css`. The plan introduces the first CSS module. If Vite's default CSS-module convention isn't enabled in the app's `vite.config.ts`, switch to the fallback approach in Step 2b. Vite's default does enable CSS modules for `*.module.css` files, so the most likely path is Step 2a.

- [ ] **Step 2a: Create the toast component (CSS module variant)**

If Vite's default CSS-module handling works for `*.module.css`, create `/Users/mike/src/weasel/apps/swillustrator/src/Toasts.module.css`:

```css
.container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
  max-width: 360px;
}

.toast {
  background: #fff8e1;
  border: 1px solid #c97c5d;
  color: #3a2e22;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.title {
  font-weight: 600;
  margin-bottom: 4px;
}

.list {
  margin: 0;
  padding-left: 18px;
}

.close {
  background: none;
  border: none;
  color: #3a2e22;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
}

.close:hover { color: #b03030; }
```

Then create `/Users/mike/src/weasel/apps/swillustrator/src/Toasts.tsx`:

```tsx
/**
 * Transient on-screen notifications. Used to surface non-fatal events
 * (e.g. SVG parse warnings) that the user should see but that shouldn't
 * block the workflow. Auto-dismisses after a timeout; the close button
 * lets the user dismiss earlier.
 */
import { useEffect } from 'react';
import styles from './Toasts.module.css';

export interface Toast {
  id: number;
  title: string;
  messages: string[];
}

export interface ToastsProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  /** Auto-dismiss delay in ms. Default 8000. */
  ttlMs?: number;
}

export function Toasts({ toasts, onDismiss, ttlMs = 8000 }: ToastsProps): JSX.Element | null {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => onDismiss(t.id), ttlMs));
    return () => { for (const t of timers) clearTimeout(t); };
  }, [toasts, onDismiss, ttlMs]);

  if (toasts.length === 0) return null;
  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast}>
          <div>
            <div className={styles.title}>{t.title}</div>
            {t.messages.length > 0 && (
              <ul className={styles.list}>
                {t.messages.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            )}
          </div>
          <button
            className={styles.close}
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
          >×</button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2b (fallback): create the toast component with global CSS classes**

If Step 1 reveals that CSS modules aren't enabled, do not create `Toasts.module.css`. Instead, append to `/Users/mike/src/weasel/apps/swillustrator/src/swillustrator.css`:

```css
.swill-toast-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
  max-width: 360px;
}

.swill-toast {
  background: #fff8e1;
  border: 1px solid #c97c5d;
  color: #3a2e22;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.swill-toast-title { font-weight: 600; margin-bottom: 4px; }
.swill-toast-list { margin: 0; padding-left: 18px; }
.swill-toast-close {
  background: none; border: none; color: #3a2e22;
  cursor: pointer; font-size: 16px; padding: 0 4px; line-height: 1;
}
.swill-toast-close:hover { color: #b03030; }
```

Create `/Users/mike/src/weasel/apps/swillustrator/src/Toasts.tsx` using `className="swill-toast"` etc. in place of `styles.toast`. The rest of the component logic is identical to Step 2a.

- [ ] **Step 3: Wire the toast into App.tsx**

In `/Users/mike/src/weasel/apps/swillustrator/src/App.tsx`:

a) Add imports near the other imports (line ~102):

```tsx
import { Toasts, type Toast } from './Toasts';
```

b) Add the toast state alongside the other `useState` calls near the top of the `App` component (after the existing `useState` block, ~line 270):

```tsx
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const pushToast = useCallback((title: string, messages: string[]) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, title, messages }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
```

(`useRef` and `useCallback` are already imported earlier in the file; if `useRef` isn't, add it to the existing React import line.)

c) Replace the `console.warn` lines inside `onOpenSvg` (added in Tasks 2 and 3) with:

```tsx
          if (parsed.warnings.length > 0) {
            pushToast('SVG opened with warnings', parsed.warnings);
          }
```

d) Render `<Toasts ... />` near the end of the App component's JSX, just before the closing `</div>` of the outermost wrapper (search for the final `</div>` after the right sidebar; insert before it):

```tsx
      <Toasts toasts={toasts} onDismiss={dismissToast} />
```

- [ ] **Step 4: Smoke-test the toast manually**

Run: `cd /Users/mike/src/weasel/apps/swillustrator && npm run dev` (or the workspace equivalent).
Manual: open the Swillustrator UI, click Open, select an SVG containing an unsupported element (`<filter>`, `<image>`, or `<mask>` — you can hand-edit one). The toast appears with the warning text. The auto-dismiss timer fires after 8s; the × button dismisses immediately.

- [ ] **Step 5: Write a smoke test on the Toasts component itself**

Create `/Users/mike/src/weasel/apps/swillustrator/src/Toasts.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toasts } from './Toasts';

describe('Toasts', () => {
  it('renders nothing for an empty list', () => {
    const { container } = render(<Toasts toasts={[]} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one entry per toast with title + messages', () => {
    render(
      <Toasts
        toasts={[{ id: 1, title: 'Warnings', messages: ['a', 'b'] }]}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('Warnings')).toBeTruthy();
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <Toasts
        toasts={[{ id: 7, title: 'X', messages: [] }]}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledWith(7);
  });

  it('auto-dismisses after ttlMs', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toasts
        toasts={[{ id: 3, title: 'X', messages: [] }]}
        onDismiss={onDismiss}
        ttlMs={1000}
      />,
    );
    act(() => { vi.advanceTimersByTime(1100); });
    expect(onDismiss).toHaveBeenCalledWith(3);
    vi.useRealTimers();
  });
});
```

Note: this test depends on `@testing-library/react`. Check it's already a dev dependency:

Run: `cd /Users/mike/src/weasel && grep -l "@testing-library/react" package.json apps/swillustrator/package.json 2>/dev/null`
Expected: either the root or the app `package.json` lists it. If not, the test file may need to be skipped or the manual smoke from Step 4 is the only verification. Document the omission inline in the test file with a `describe.skip(...)` and a comment explaining the dependency gap.

- [ ] **Step 6: Run the toast tests, verify they pass**

Run: `cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/Toasts.test.tsx`
Expected: 4 tests pass (or skip + comment if `@testing-library/react` isn't installed).

- [ ] **Step 7: Commit**

```bash
git add apps/swillustrator/src/Toasts.tsx apps/swillustrator/src/Toasts.module.css apps/swillustrator/src/Toasts.test.tsx apps/swillustrator/src/App.tsx
# OR (fallback variant): apps/swillustrator/src/Toasts.tsx apps/swillustrator/src/Toasts.test.tsx apps/swillustrator/src/swillustrator.css apps/swillustrator/src/App.tsx
git commit -m "feat(swillustrator): surface SVG parse warnings via toast"
```

---

## Task 6: Bridge tests, full Obj × SvgNode coverage (spec's T6 finish)

Goal: round out `svgInterop.test.ts` with every Obj × SvgNode cell plus the edge cases the audit calls out. Tasks 1, 3, 4 already added the rect/text/path/group/style cells; this task fills the gaps.

**Files:**
- Modify: `apps/swillustrator/src/svgInterop.test.ts`

- [ ] **Step 1: Audit the coverage matrix**

The Obj × SvgNode cells are:
- RectObj → SvgPathNode (RectPath) — covered Task 1.
- TextObj → SvgTextNode — covered Tasks 1, 4.
- Closed PathObj → SvgPathNode (PolygonPath, solid fill) — covered Task 1.
- Open PathObj → SvgPathNode (PolygonPath, fill=none) — covered Task 1.
- SvgPathNode (RectPath) → RectObj — covered Task 1.
- SvgPathNode (PolygonPath) → PathObj — **not yet covered** (Task 1 covered Rect only).
- SvgTextNode → TextObj — covered Task 1.
- SvgGroupNode → Group + members — covered Task 3.
- Multi-group rejection — covered Task 3.
- Edge: SvgPathNode with gradient fill → black solid — covered Task 1.
- Edge: SvgPathNode with no stroke → strokeWidth=0 — covered Task 1.

This task adds the missing PolygonPath inbound cell plus four edge cases.

- [ ] **Step 2: Add the missing tests**

Append to `/Users/mike/src/weasel/apps/swillustrator/src/svgInterop.test.ts`:

```ts
describe('svgNodesToObjs — coverage gaps', () => {
  it('lowers an SvgPathNode (PolygonPath, closed) to a closed PathObj', () => {
    const node: SvgPathNode = {
      kind: 'path',
      // M h v h Z — equivalent to a 50x50 box, but as a polygon
      path: {
        kind: 'polygon',
        commands: new Uint8Array([0, 1, 1, 1, 4]),  // PATH_M, PATH_L*3, PATH_Z
        coords: new Float32Array([0, 0, 50, 0, 50, 50, 0, 50]),
        fillRule: 'nonzero',
      },
      fill: { kind: 'solid', color: '#7fb069' },
      stroke: { paint: { kind: 'solid', color: '#000' }, width: 2 },
    };
    const out = svgNodesToObjs([node], ids());
    expect(out).toHaveLength(1);
    const o = out[0] as { kind: 'path'; closed: boolean; fill: string; strokeWidth: number };
    expect(o.kind).toBe('path');
    expect(o.closed).toBe(true);
    expect(o.fill).toBe('#7fb069');
    expect(o.strokeWidth).toBe(2);
  });

  it('lowers an SvgPathNode (PolygonPath, open) to an open PathObj', () => {
    const node: SvgPathNode = {
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([0, 1, 1]),  // PATH_M, PATH_L, PATH_L, no Z
        coords: new Float32Array([0, 0, 50, 50, 100, 0]),
        fillRule: 'nonzero',
      },
      fill: { kind: 'none' },
      stroke: { paint: { kind: 'solid', color: '#000' }, width: 1 },
    };
    const out = svgNodesToObjs([node], ids());
    const o = out[0] as { kind: 'path'; closed: boolean; fill: string };
    expect(o.closed).toBe(false);
    // Open paths upcast their fill string to the bridge's fallback when
    // SvgPaint.kind === 'none'. Document the behavior; it's a known edge
    // not fixed in this plan.
    expect(o.fill).toBe('#000000');
  });

  it('returns an empty list for an empty input array', () => {
    const out = svgNodesToObjs([], ids());
    expect(out).toEqual([]);
  });

  it('handles a deeply nested mixed tree', () => {
    const leaf: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
      fill: { kind: 'solid', color: '#abc' },
    };
    const innerText: SvgTextNode = { kind: 'text', x: 0, y: 0, width: 10, height: 10, text: 'x' };
    const inner: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'inner' } } },
      children: [leaf, innerText],
    };
    const outer: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'outer' } } },
      children: [inner],
    };
    const result = svgNodesToObjsWithGroups([outer], ids());
    expect(result.items).toHaveLength(2);  // leaf + text
    expect(result.groups.map((g) => g.id).sort()).toEqual(['inner', 'outer']);
    expect(result.groups.find((g) => g.id === 'outer')?.members).toEqual(['inner']);
    expect(result.groups.find((g) => g.id === 'inner')?.members).toHaveLength(2);
  });

  it('preserves text style across a group boundary', () => {
    const t: SvgTextNode = {
      kind: 'text', x: 0, y: 0, width: 100, height: 20, text: 'hi',
      style: { fontSize: 24, fill: { fill: 'solid', color: '#b03030' } },
    };
    const g: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'g1' } } },
      children: [t],
    };
    const result = svgNodesToObjsWithGroups([g], ids());
    const item = result.items[0] as { kind: 'text'; style?: unknown };
    expect(item.style).toEqual(t.style);
  });
});

describe('objToSvgNode — coverage gaps', () => {
  it('passes the TextStyle through verbatim (no field stripping besides lineHeight)', () => {
    const text = {
      id: 'x', kind: 'text' as const,
      x: 0, y: 0, width: 100, height: 20, text: 'Hi',
      style: { fontSize: 12, align: 'right' as const },
    };
    const node = objToSvgNode(text as never);
    if (node.kind !== 'text') throw new Error('expected text');
    expect(node.style).toEqual({ fontSize: 12, align: 'right' });
    // No lineHeight in the input → no meta bag.
    expect(node.meta).toBeUndefined();
  });

  it('round-trips an open PathObj losslessly through both directions', () => {
    const original = {
      id: 'p', kind: 'path' as const,
      x: 0, y: 0, width: 100, height: 50,
      path: {
        kind: 'polygon' as const,
        commands: new Uint8Array([0, 1, 1]),
        coords: new Float32Array([0, 0, 50, 50, 100, 0]),
        fillRule: 'nonzero' as const,
      },
      closed: false, fill: '#aaa', stroke: '#000', strokeWidth: 2,
    };
    const node = objToSvgNode(original as never);
    expect(node.kind).toBe('path');
    const out = svgNodesToObjs([node], ids());
    const back = out[0] as { kind: 'path'; closed: boolean; strokeWidth: number };
    expect(back.kind).toBe('path');
    expect(back.closed).toBe(false);
    expect(back.strokeWidth).toBe(2);
  });
});
```

- [ ] **Step 3: Run all bridge tests, verify they pass**

Run: `cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/svgInterop.test.ts`
Expected: every test in the file passes (Tasks 1, 3, 4 + these additions).

- [ ] **Step 4: Commit**

```bash
git add apps/swillustrator/src/svgInterop.test.ts
git commit -m "test(svgInterop): cover PolygonPath inbound + nested-tree edges"
```

---

## Task 7: Final regression sweep + manual smoke

Goal: confirm the full workspace is green, the production build still works, and a hand round-trip through the UI produces a byte-clean result.

- [ ] **Step 1: Run the full typecheck**

Run: `cd /Users/mike/src/weasel && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Run the full test suite**

Run: `cd /Users/mike/src/weasel && npx vitest run`
Expected: all packages green — weasel-svg roundtrip + warnings + path-parser, swillustrator svgInterop + Toasts, plus any other workspace tests untouched by this plan.

- [ ] **Step 3: Run the production build (matches CI's release gate)**

Run: `cd /Users/mike/src/weasel && npm run prepublishOnly 2>/dev/null || (npx tsc --noEmit && npx vitest run && npx tsup build)`
Expected: clean build for `weasel-svg` (and any other published package). If a `prepublishOnly` script doesn't exist at the root, the fallback chain runs the same commands CI does.

- [ ] **Step 4: Manual UI smoke checklist**

Run: `cd /Users/mike/src/weasel/apps/swillustrator && npm run dev`

Walk through:
- Set paper size to A4 via the right-sidebar selector. Verify `doc.size` changes (page area resizes).
- Draw a rect, a text block, and a path. Group two of them (Cmd-G).
- Set the doc title to "Smoke Test".
- Save (`onSaveSvg`). Open the downloaded `Smoke Test.svg` in a text editor:
  - Root has `xmlns:swill="https://swillustrator.app/svg-ext"`, `width="794"`, `height="1123"`, `swill:paperSize="a4"`, `swill:units="px"`.
  - First child is `<title>Smoke Test</title>`.
  - One `<g swill:group-id="..."` wraps the two grouped shapes.
- File → New → Letter (resets the document).
- File → Open, pick `Smoke Test.svg`. Verify:
  - Paper size selector shows A4.
  - Doc title field shows "Smoke Test".
  - Both shapes are present; the grouped pair is still a group (Cmd-Shift-G ungroups it; selecting one selects both before that).
- Open a file with an unsupported element (e.g. an SVG containing `<filter>`). The toast appears listing the warning; the document still opens.

- [ ] **Step 5: Cross-tool render check (Inkscape / Chrome)**

Open `Smoke Test.svg` in Chrome / Safari / Firefox: shapes render correctly; no `swill:` content visible in the rendered output.

If Inkscape is available, open `Smoke Test.svg` in it: groups appear as Inkscape groups; the `swill:group-id` attributes survive a save-as round-trip (open the resulting file in a text editor to confirm).

Document any cross-tool surprises here as a follow-up issue; do not block this plan on them — the spec's "Risk / open items" section already calls out Inkscape and Figma spot-checks.

- [ ] **Step 6: Final commit (if any tweaks were needed)**

If the smoke surfaced any small fixes:

```bash
git add -p
git commit -m "fix(svg-native): smoke-surfaced tweaks"
```

Otherwise this task ends without a commit.

---

## Self-review (already performed during writing)

- **Spec coverage:** T0 (Task 0 — generic namespace pass-through), T1 paper-size (Task 2), T2 groups + single-membership enforcement (Task 3), T4 text style (Task 4), T5 warnings (Task 5), T6 bridge tests (Tasks 1, 6). Layers (the spec's deferred "T3") explicitly deferred with rationale in the preamble. Acceptance criteria — paper-size, groups, text style round-trip; warnings surfaced; `swill` namespace declared on root; standard-SVG content stays standard; weasel-svg API stays domain-neutral — addressed by Tasks 0–5. Fixtures (`swillustrator-minimal.svg`, `swillustrator-groups.svg`, `swillustrator-papers.svg`) created in Tasks 2 and 3.
- **Placeholders:** none of "TBD", "implement later", "similar to Task N without code", or generic error-handling stubs. Every step has either a concrete code change, a shell command with expected output, or a manual verification step.
- **Type consistency:** `NamespaceMeta`, `NamespacedElement`, `ParseOptions`, and `meta?: NamespaceMeta` on every `SvgNode` are introduced in Task 0 Step 1–2 and consumed in every subsequent task. `ParseResult.viewBox`/`title`/`documentMeta` and the matching `SerializeOptions` fields likewise land in Task 0 and are consumed in Tasks 2–4. `svgNodesToObjsWithGroups` / `objsToSvgNodes` declared in Task 3 Step 6 and consumed in Task 3 Step 8, Task 4 Step 6, Task 6 Step 2. `SWILL_NS` / `SWILL_NAMESPACES` declared in Task 2 Step 1 and used in Tasks 2, 3, 4. Multi-group rejection assertion declared in Task 3 Step 6 and tested in Task 3 Step 4. Model-level single-membership enforcement (`stripPriorMemberships`) declared in Task 3 Step 7a, tested in Step 7b, wired into the App.tsx adapter in Step 7c.
- **Step content:** every step gives the engineer the actual code, the actual file path, and the actual command + expected output. Manual steps (Task 5 Step 4, Task 7 Steps 4–5) are explicit walkthroughs.
- **Namespace discipline:** weasel-svg's surface contains no string `swill` or `swillustrator`. All app-specific knowledge lives in `apps/swillustrator/src/svgInterop.ts` and `apps/swillustrator/src/App.tsx`.
