/** Counterexamples `accessible.pbt.test.ts` shrank to, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { mirrorFocusedTree } from './accessibleMirror';
import { createHud } from './hud';
import type { HudAccessibleNode, Widget } from './widget';

describe('mirrorFocusedTree counterexamples', () => {
  it('gives two nodes distinct ids where their keys joined with "-" read alike', () => {
    const node: HudAccessibleNode = {
      role: 'menu', key: 'root', children: [
        { role: 'menu', key: '0', children: [
          { role: 'menu', key: 'a', children: [{ role: 'menuitem', key: 'menu', label: 'deep', active: true }] },
          { role: 'menuitem', key: 'a-menu', label: 'shallow' },
        ] },
      ],
    };
    const w: Widget = {
      id: 'w', bounds: { x: 0, y: 0, w: 1, h: 1 }, hidden: false, focusable: true,
      draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
      accessibleTree: { read: () => node, subscribe: () => () => {} },
    };
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const hud = createHud();
    hud.add(w);
    const detach = mirrorFocusedTree(canvas, hud);
    hud.focus(w);
    const ids = [...document.getElementById(canvas.getAttribute('aria-owns')!)!.querySelectorAll('[role]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(document.getElementById(canvas.getAttribute('aria-activedescendant')!)!.textContent).toBe('deep');
    detach();
    canvas.remove();
  });
});
