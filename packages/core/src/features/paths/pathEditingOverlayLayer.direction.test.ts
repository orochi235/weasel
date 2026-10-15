import { describe, expect, it } from 'vitest';
import { polygonFromPoints } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { createPathEditingOverlayLayer, PATH_DIRECTION_CHROME_ID } from './pathEditingOverlayLayer';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600 };
const COLOR = '#ff00ff';

const layer = createPathEditingOverlayLayer({
  getEditingId: () => 'p',
  getPose: () => polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]),
  style: { directionColor: COLOR },
});

const draw = (shown: (id: string) => boolean) =>
  layer.draw({ getIsVisible: () => shown }, VIEW, DIMS) as DrawCommand[];

const inColor = (cmds: DrawCommand[]) => cmds.filter((c) =>
  c.kind === 'path' && (c.fill?.paint as { color?: string } | undefined)?.color === COLOR);

describe('direction chrome', () => {
  it('draws one arrow per segment, the closing one included, only while its id is visible', () => {
    expect(inColor(draw((id) => id !== PATH_DIRECTION_CHROME_ID))).toHaveLength(0);
    const arrows = inColor(draw(() => true));
    expect(arrows).toHaveLength(3);
    // The first edge runs +x from (0, 0) to (100, 0): its arrow's tip is past the midpoint.
    const tip = arrows[0].kind === 'path' && arrows[0].path.kind === 'polygon' ? arrows[0].path.coords[0] : NaN;
    expect(tip).toBeGreaterThan(50);
  });
});
