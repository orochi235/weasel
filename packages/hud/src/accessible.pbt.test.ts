/**
 * Property tests of what assistive tech is shown of a HUD: the tree a context menu declares, against the open
 * levels of its controller, and the hidden DOM mirroring the focused widget's tree through focus changes, rebuilt
 * trees, and moves of the active node alone.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createMenuController, type MenuController } from '@weasel-js/menu';
import { mirrorFocusedTree } from './accessibleMirror';
import { createHud } from './hud';
import { accessibleMenu } from './menu/accessibleMenu';
import { menuLevel, openPath, runs, tally, timeoutFor } from './pbt.fixture';
import type { HudAccessibleNode, Widget } from './widget';

const RUNS = 150;

describe('accessibleMenu', () => {
  it('holds every row of each open level in order, with its role and states, the open submenu nested under its row', () => {
    const seen = tally();
    fc.assert(fc.property(menuLevel(3), fc.array(fc.nat(), { maxLength: 4 }), fc.option(fc.nat(), { nil: undefined }), (entries, path, hover) => {
      const c = createMenuController({ entries, onClose: () => {} });
      openPath(c, path);
      if (hover !== undefined) {
        const level = c.stack().length - 1;
        const rows = c.entriesAt(level).flatMap((e, i) => (e.kind === 'separator' ? [] : [i]));
        if (rows.length) c.hover(level, rows[hover % rows.length]!);
      }
      const tree = accessibleMenu(c);
      expect(tree.role).toBe('menu');
      let actives = 0;
      const walk = (node: HudAccessibleNode, ctl: MenuController, level: number) => {
        const es = ctl.entriesAt(level);
        expect(node.children!.map((n) => n.key)).toEqual(es.map((e) => e.key));
        node.children!.forEach((n, i) => {
          const e = es[i]!;
          if (n.active) actives++;
          if (e.kind === 'separator') { expect(n).toEqual({ role: 'separator', key: e.key }); seen.hit('separator'); return; }
          const role = e.kind === 'item' && e.checked !== undefined ? (e.radio ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem';
          expect(n.role).toBe(role);
          expect(n.label!.startsWith(e.label)).toBe(true);
          expect(n.disabled === true).toBe(e.disabled === true || e.kind === 'color');
          if (e.kind === 'item') expect(n.checked).toBe(e.checked);
          const open = e.kind === 'submenu' && ctl.stack()[level] === i && ctl.stack().length > level + 1;
          if (e.kind === 'submenu') expect(n.expanded).toBe(open);
          else expect(n.expanded).toBeUndefined();
          if (open) {
            seen.hit('open submenu');
            expect(n.children).toHaveLength(1);
            expect(n.children![0]!.role).toBe('menu');
            walk(n.children![0]!, ctl, level + 1);
          } else expect(n.children).toBeUndefined();
          const deepest = level === ctl.stack().length - 1;
          expect(n.active === true).toBe(deepest && ctl.stack()[level] === i);
        });
      };
      walk(tree, c, 0);
      expect(actives).toBe(c.stack().at(-1) === null ? 0 : 1);
      if (actives) seen.hit('active');
    }), runs(RUNS * 2));
    for (const k of ['separator', 'open submenu', 'active']) seen.atLeast(k, 20);
  }, timeoutFor(RUNS * 2, 10));
});

/** Keys unique among siblings, some holding the `-` the mirror joins ids with, or a space. */
const KEYS = ['a', 'b', 'a-b', 'b-a', 'menu', 'a-menu', 'x y', '0'];
const ROLES = ['menu', 'menuitem', 'listbox', 'option', 'separator', 'group'];

function tree(depth: number): fc.Arbitrary<HudAccessibleNode> {
  const kids = depth <= 0 ? fc.constant(undefined) : fc.option(
    fc.uniqueArray(fc.constantFrom(...KEYS), { minLength: 1, maxLength: 4 })
      .chain((keys) => fc.tuple(...keys.map((k) => tree(depth - 1).map((n) => ({ ...n, key: k }))))),
    { nil: undefined },
  );
  return fc.record({
    role: fc.constantFrom(...ROLES),
    key: fc.constant('root'),
    label: fc.option(fc.string({ maxLength: 6 }), { nil: undefined }),
    checked: fc.option(fc.boolean(), { nil: undefined }),
    selected: fc.option(fc.boolean(), { nil: undefined }),
    disabled: fc.option(fc.boolean(), { nil: undefined }),
    expanded: fc.option(fc.boolean(), { nil: undefined }),
    children: kids,
  }).map((n) => Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined)) as unknown as HudAccessibleNode);
}

const preorder = (n: HudAccessibleNode): HudAccessibleNode[] => [n, ...(n.children ?? []).flatMap(preorder)];

/** `node` with only its `at`th node in preorder active, or none past the end. */
function activate(node: HudAccessibleNode, at: number): HudAccessibleNode {
  let i = 0;
  const walk = (n: HudAccessibleNode): HudAccessibleNode => {
    const { active: _, ...rest } = n;
    const here = i++ === at && at > 0;
    return { ...rest, ...(here ? { active: true } : {}), ...(n.children ? { children: n.children.map(walk) } : {}) };
  };
  return walk(node);
}

interface Live { node: HudAccessibleNode; subs: Set<() => void>; widget: Widget }
function live(node: HudAccessibleNode, id: string): Live {
  const l: Live = { node, subs: new Set(), widget: null as never };
  l.widget = {
    id, bounds: { x: 0, y: 0, w: 10, h: 10 }, hidden: false, focusable: true,
    draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
    accessibleTree: { read: () => l.node, subscribe: (fn) => { l.subs.add(fn); return () => l.subs.delete(fn); } },
  };
  return l;
}
const set = (l: Live, node: HudAccessibleNode) => { l.node = node; for (const fn of l.subs) fn(); };

function checkMirror(canvas: HTMLElement, focused: Live | null): HTMLElement | null {
  const owns = canvas.getAttribute('aria-owns');
  if (!focused) {
    expect(owns).toBeNull();
    expect(canvas.getAttribute('aria-activedescendant')).toBeNull();
    return null;
  }
  const root = document.getElementById(owns!)!;
  expect(root).not.toBeNull();
  const els = [root, ...root.querySelectorAll<HTMLElement>('*')];
  const nodes = preorder(focused.node);
  expect(els).toHaveLength(nodes.length);
  expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
  for (const e of els) expect(document.querySelectorAll(`[id="${CSS.escape(e.id)}"]`)).toHaveLength(1);
  nodes.forEach((n, i) => {
    const el = els[i]!;
    expect(el.getAttribute('role')).toBe(n.role);
    expect(el.children).toHaveLength(n.children?.length ?? 0);
    if (n.children?.length) expect(el.getAttribute('aria-label')).toBe(n.label || null);
    else expect(el.textContent).toBe(n.label ?? '');
    expect(el.getAttribute('aria-checked')).toBe(n.checked === undefined ? null : String(n.checked));
    expect(el.getAttribute('aria-selected')).toBe(n.selected === undefined ? null : String(n.selected));
    expect(el.getAttribute('aria-disabled')).toBe(n.disabled ? 'true' : null);
    expect(el.getAttribute('aria-expanded')).toBe(n.expanded === undefined ? null : String(n.expanded));
  });
  const a = nodes.findIndex((n) => n.active);
  const pointers = els.filter((e) => e.hasAttribute('aria-activedescendant'));
  if (a < 0) {
    expect(canvas.getAttribute('aria-activedescendant')).toBeNull();
    expect(pointers).toEqual([]);
  } else {
    const target = document.getElementById(canvas.getAttribute('aria-activedescendant')!);
    expect(target).toBe(els[a]);
    expect(pointers).toEqual([els[a]!.parentElement]);
    expect(pointers[0]!.getAttribute('aria-activedescendant')).toBe(els[a]!.id);
  }
  return root;
}

describe('mirrorFocusedTree (stateful)', () => {
  it('mirrors exactly the focused tree, ids unique, and moves only the pointer when the active node alone moves', () => {
    const seen = tally();
    const step = fc.oneof(
      fc.record({ kind: fc.constant('focus' as const), which: fc.constantFrom(0, 1, null) }),
      fc.record({ kind: fc.constant('replace' as const), which: fc.constantFrom(0, 1), node: tree(3), at: fc.nat({ max: 20 }) }),
      fc.record({ kind: fc.constant('move' as const), which: fc.constantFrom(0, 1), at: fc.nat({ max: 20 }) }),
    );
    fc.assert(fc.property(tree(3), tree(3), fc.array(step, { maxLength: 12 }), (t0, t1, steps) => {
      const canvas = document.createElement('canvas');
      document.body.appendChild(canvas);
      const hud = createHud();
      const ws = [live(activate(t0, 1), 'w0'), live(activate(t1, 2), 'w1')];
      for (const w of ws) hud.add(w.widget);
      const detach = mirrorFocusedTree(canvas, hud);
      try {
        let focused: Live | null = null;
        checkMirror(canvas, focused);
        for (const s of steps) {
          if (s.kind === 'focus') {
            focused = s.which === null ? null : ws[s.which]!;
            hud.focus(focused?.widget ?? null);
          } else if (s.kind === 'replace') {
            set(ws[s.which]!, activate(s.node, s.at));
          } else {
            const w = ws[s.which]!;
            const before = focused === w ? checkMirror(canvas, w) : null;
            const all = before ? [before, ...before.querySelectorAll('*')] : [];
            set(w, activate(w.node, s.at));
            if (before) {
              const after = checkMirror(canvas, w)!;
              expect([after, ...after.querySelectorAll('*')]).toEqual(all);
              all.forEach((el, i) => expect([after, ...after.querySelectorAll('*')][i]).toBe(el));
              seen.hit('moved in place');
            }
          }
          checkMirror(canvas, focused);
          if (focused && preorder(focused.node).some((n) => n.active)) seen.hit('active');
        }
      } finally {
        detach();
        canvas.remove();
      }
      expect(document.body.children).toHaveLength(0);
    }), runs(RUNS));
    seen.atLeast('moved in place', 20);
    seen.atLeast('active', 20);
  }, timeoutFor(RUNS, 30));
});
