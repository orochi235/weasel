/**
 * Property tests of `domFocusScope` over random subtrees of buttons, links, inputs, radio groups, and `tabindex`
 * divs, some disabled, some under `hidden`, `inert`, or a closed `<details>`: its tab order is a model's, Tab walks
 * that order from either end and then lets focus go, and focus never lands outside the scope.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { domFocusScope } from './domFocusScope';

const RUNS = 150;

type Leaf =
  | { kind: 'button'; tabindex?: number; disabled: boolean }
  | { kind: 'text' | 'hidden-input'; disabled: boolean }
  | { kind: 'radio'; name: 'p' | 'q'; checked: boolean }
  | { kind: 'link'; href: boolean; tabindex?: number }
  | { kind: 'div'; tabindex?: number };
type Box = { kind: 'box' | 'hidden' | 'inert' | 'details'; open: boolean; summary: boolean; children: Node_[] };
type Node_ = Leaf | Box;

const tabindex = fc.option(fc.constantFrom(-1, 0, 0, 1, 2, 3), { nil: undefined });
const leaf: fc.Arbitrary<Leaf> = fc.oneof(
  fc.record({ kind: fc.constant('button' as const), tabindex, disabled: fc.boolean() }),
  fc.record({ kind: fc.constantFrom('text' as const, 'hidden-input' as const), disabled: fc.boolean() }),
  fc.record({ kind: fc.constant('radio' as const), name: fc.constantFrom('p' as const, 'q' as const), checked: fc.boolean() }),
  fc.record({ kind: fc.constant('link' as const), href: fc.boolean(), tabindex }),
  fc.record({ kind: fc.constant('div' as const), tabindex }),
);
const tree = fc.letrec<{ node: Node_; list: Node_[] }>((tie) => ({
  node: fc.oneof({ depthSize: 'small' },
    { arbitrary: leaf, weight: 4 },
    { arbitrary: fc.record({ kind: fc.constantFrom('box' as const, 'hidden' as const, 'inert' as const, 'details' as const), open: fc.boolean(), summary: fc.boolean(), children: tie('list') }), weight: 1 }),
  list: fc.array(tie('node'), { maxLength: 4 }),
})).list;

const plain: Leaf = { kind: 'button', disabled: false };
/** Three subtrees with a plain button between each two, so most draws hold several stops. */
const roomy = fc.tuple(tree, tree, tree).map(([a, b, c]) => [...a, plain, ...b, plain, ...c]);

interface Built { el: HTMLElement; tabbable: boolean; index: number; radio?: { name: string; checked: boolean } }

/** Builds the subtree under `parent`, recording each element the model expects Tab to consider, in document order. */
function build(nodes: readonly Node_[], parent: HTMLElement, out: Built[], shut: boolean): void {
  for (const n of nodes) {
    if (n.kind === 'box' || n.kind === 'hidden' || n.kind === 'inert' || n.kind === 'details') {
      const el = document.createElement(n.kind === 'details' ? 'details' : 'div');
      if (n.kind === 'hidden') el.hidden = true;
      if (n.kind === 'inert') el.setAttribute('inert', '');
      if (el instanceof HTMLDetailsElement && n.open) el.open = true;
      parent.append(el);
      const gone = shut || n.kind === 'hidden' || n.kind === 'inert';
      if (n.kind === 'details' && n.summary) {
        const summary = document.createElement('summary');
        summary.tabIndex = 0;
        el.append(summary);
        out.push({ el: summary, tabbable: !gone, index: 0 });
      }
      build(n.children, el, out, gone || (n.kind === 'details' && !n.open));
      continue;
    }
    let el: HTMLElement;
    let focusable: boolean;
    let index = 0;
    let radio: Built['radio'];
    switch (n.kind) {
      case 'button': {
        const b = document.createElement('button');
        b.disabled = n.disabled;
        if (n.tabindex !== undefined) b.tabIndex = n.tabindex;
        el = b; index = n.tabindex ?? 0; focusable = !n.disabled && index >= 0;
        break;
      }
      case 'text': case 'hidden-input': {
        const i = document.createElement('input');
        i.type = n.kind === 'text' ? 'text' : 'hidden';
        i.disabled = n.disabled;
        el = i; focusable = n.kind === 'text' && !n.disabled;
        break;
      }
      case 'radio': {
        const i = document.createElement('input');
        i.type = 'radio'; i.name = n.name; i.checked = n.checked;
        el = i; focusable = true; radio = { name: n.name, checked: n.checked };
        break;
      }
      case 'link': {
        const a = document.createElement('a');
        if (n.href) a.href = '#x';
        if (n.tabindex !== undefined) a.tabIndex = n.tabindex;
        el = a; index = n.tabindex ?? 0;
        focusable = (n.href || n.tabindex !== undefined) && index >= 0;
        break;
      }
      case 'div': {
        const d = document.createElement('div');
        if (n.tabindex !== undefined) d.tabIndex = n.tabindex;
        el = d; index = n.tabindex ?? -1; focusable = n.tabindex !== undefined && index >= 0;
        break;
      }
    }
    el.textContent = '';
    parent.append(el);
    out.push({ el, tabbable: focusable && !shut, index, radio });
  }
}

/** The model's tab order: tabbable elements, one radio per name (its checked one, else its first), positive indices
 *  first and ascending, then document order. */
function modelOrder(built: readonly Built[]): HTMLElement[] {
  const live = built.filter((b) => b.tabbable);
  // A radio's checked state is the DOM's: checking one unchecks the rest of its name.
  const keep = live.filter((b) => {
    if (!b.radio) return true;
    const group = live.filter((o) => o.radio?.name === b.radio!.name);
    const pick = group.find((o) => (o.el as HTMLInputElement).checked) ?? group[0];
    return pick === b;
  });
  const declared = keep.filter((b) => b.index > 0).sort((a, b) => a.index - b.index);
  return [...declared, ...keep.filter((b) => b.index <= 0)].map((b) => b.el);
}

function mount(nodes: readonly Node_[]) {
  const outside = document.createElement('button');
  const root = document.createElement('div');
  document.body.append(outside, root);
  const built: Built[] = [];
  build(nodes, root, built, false);
  return { root, outside, built };
}

afterEach(() => { document.body.replaceChildren(); });

describe('domFocusScope', () => {
  it('orders Tab as the model does', () => {
    const t = tally();
    fc.assert(fc.property(roomy, (nodes) => {
      document.body.replaceChildren();
      const { root, built } = mount(nodes);
      const want = modelOrder(built);
      expect(domFocusScope(root).tabOrder()).toEqual(want);
      if (want.length >= 3) t.count('several');
      if (built.some((b) => b.radio) && want.some((e) => (e as HTMLInputElement).type === 'radio')) t.count('radio');
      if (built.some((b) => !b.tabbable && b.el.tagName !== 'INPUT')) t.count('skipped');
      if (want.length > 0 && built.find((b) => b.el === want[0])!.index > 0) t.count('declared');
    }), runs(RUNS));
    for (const k of ['several', 'radio', 'skipped', 'declared']) t.atLeast(k, 25);
  }, timeoutFor(RUNS, 10));

  it('walks the order from either end, then lets focus go, never outside the scope', () => {
    const t = tally();
    fc.assert(fc.property(roomy, fc.constantFrom<'next' | 'prev'>('next', 'prev'), (nodes, dir) => {
      document.body.replaceChildren();
      const { root, outside } = mount(nodes);
      const scope = domFocusScope(root);
      const order = scope.tabOrder();
      const walk = dir === 'next' ? order : [...order].reverse();
      for (const want of walk) {
        expect(scope.moveFocus(dir)).toBe(want);
        expect(scope.focused).toBe(want);
      }
      expect(scope.moveFocus(dir)).toBeNull();
      expect(scope.focused).toBeNull();
      expect(scope.focus(outside)).toBe(false);
      expect(scope.focused).toBeNull();
      if (order.length) {
        scope.focus(order[0]!);
        expect(scope.focused).toBe(order[0]);
        expect(scope.focus(outside)).toBe(false);
        expect(document.activeElement).toBe(order[0]);
        t.count('walked');
      }
    }), runs(RUNS));
    t.atLeast('walked', 50);
  }, timeoutFor(RUNS, 10));

  it('steps from where a focused element sat once it stops being tabbable', () => {
    const t = tally();
    fc.assert(fc.property(roomy, fc.nat(), fc.constantFrom<'next' | 'prev'>('next', 'prev'), (nodes, pick, dir) => {
      document.body.replaceChildren();
      const { root } = mount(nodes);
      for (const el of root.querySelectorAll<HTMLElement>('[tabindex]')) if (el.tabIndex > 0) el.tabIndex = 0;
      const scope = domFocusScope(root);
      const before = scope.tabOrder();
      if (before.length < 2) return;
      const gone = before[pick % before.length]!;
      scope.focus(gone);
      gone.setAttribute('tabindex', '-1');
      const after = scope.tabOrder();
      const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const want = dir === 'next' ? after.find((el) => follows(gone, el)) ?? null : [...after].reverse().find((el) => follows(el, gone)) ?? null;
      expect(scope.moveFocus(dir)).toBe(want);
      t.count(want === null ? 'off the end' : 'stepped');
    }), runs(RUNS));
    t.atLeast('stepped', 30);
    t.atLeast('off the end', 8);
  }, timeoutFor(RUNS, 10));
});
