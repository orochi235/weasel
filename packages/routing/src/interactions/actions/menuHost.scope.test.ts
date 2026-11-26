import { describe, expect, it, vi } from 'vitest';
import { pref } from '@weasel-js/prefs-schema';
import { ActionsNode } from './ActionsProvider';

function yokes() {
  const root = new ActionsNode(null, true, () => null);
  const tier = (parent: ActionsNode, descends: boolean) => {
    const n = new ActionsNode(parent, descends, () => null);
    n.mount();
    return n;
  };
  root.mount();
  const a = tier(root, true);
  const b = tier(root, true);
  const canvasA = tier(a, false);
  const canvasB = tier(b, false);
  const runA = vi.fn();
  const runB = vi.fn();
  canvasA.registry.register({ id: 'test.only-a', label: 'Only A', invoker: { timing: 'immediate', run: runA } });
  canvasB.registry.register({ id: 'test.only-b', label: 'Only B', invoker: { timing: 'immediate', run: runB } });
  canvasA.activate({ keys: false });
  canvasB.activate({ keys: false });
  return { root, a, b, runA, runB };
}

describe("a yoke's menu host", () => {
  it("lists and runs the yoke's actions, not the tree's last-used scope's", () => {
    const { root, a, runA, runB } = yokes();
    root.menuHost().define({ id: 'm', menu: { name: '', children: { a: pref.action('test.only-a'), b: pref.action('test.only-b') } } });
    const host = a.menuHost();
    expect(host.open({ menu: 'm', client: { x: 0, y: 0 } })).toBe(true);
    const rows = host.current()!.entries;
    expect(rows.map((r) => r.kind === 'item' && r.label)).toEqual(['Only A']);
    const row = rows[0]!;
    if (row.kind === 'item') row.run();
    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).not.toHaveBeenCalled();
  });

  it("shares the tree's declared menus and its open menu", () => {
    const { root, a, b } = yokes();
    a.menuHost().define({ id: 'm', menu: { name: '', children: { b: pref.action('test.only-b') } } });
    expect(b.menuHost().open({ menu: 'm', client: { x: 0, y: 0 } })).toBe(true);
    expect(root.menuHost().current()).toBe(b.menuHost().current());
    a.menuHost().close();
    expect(root.menuHost().current()).toBeNull();
  });
});
