import { describe, expect, it } from 'vitest';
import { pathToAnchors, polygonFromPoints } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { PathEditMarksCtx } from '@weasel-js/core';
import { createDirectionExtension, PATH_DIRECTION_CHROME_ID } from './directionMarks';

const COLOR = '#ff00ff';
const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
const ext = createDirectionExtension({ color: COLOR });

const marks = (shown: (id: string) => boolean) => ext.marks!({
  id: 'p', node: { pose: path, data: null }, path, anchors: pathToAnchors(path),
  view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
  toScreen: (p) => ({ x: p.x * 2, y: p.y * 2 }),
  isVisible: shown, selected: null,
} as PathEditMarksCtx) as DrawCommand[];

const arrows = (cmds: DrawCommand[]) => cmds.filter((c) =>
  c.kind === 'path' && (c.fill?.paint as { color?: string } | undefined)?.color === COLOR);

describe('direction marks', () => {
  it('draws one arrow per segment, the closing one included, and a start ring, only while its id is visible', () => {
    expect(marks((id) => id !== PATH_DIRECTION_CHROME_ID)).toHaveLength(0);
    const all = marks(() => true);
    const drawn = arrows(all);
    expect(drawn).toHaveLength(3);
    expect(all).toHaveLength(4);
    // The first edge runs +x from (0, 0) to (100, 0), the midpoint at 100 on screen: the tip is past it.
    const tip = drawn[0].kind === 'path' && drawn[0].path.kind === 'polygon' ? drawn[0].path.coords[0] : NaN;
    expect(tip).toBeGreaterThan(100);
  });
});
