import { describe, expect, it } from 'vitest';
import { circlePath, polylineFromPoints } from '@weasel-js/geom';
import { brushOverlayCommands } from './brushOverlay';

const STYLE = { fill: 'rgba(0, 0, 255, 0.2)', stroke: '#0000ff', lineWidth: 1 };

describe('brushOverlayCommands', () => {
  it('paints the swept area as a round-capped band as wide as the brush, then its rim', () => {
    const pts = [{ x: 0, y: 0 }, { x: 40, y: 0 }];
    expect(brushOverlayCommands(pts, 10, STYLE)).toEqual([
      {
        kind: 'path',
        path: polylineFromPoints(pts),
        stroke: { paint: { color: STYLE.fill }, width: 20, cap: 'round', join: 'round' },
      },
      {
        kind: 'path',
        path: circlePath(40, 0, 10),
        stroke: { paint: { color: STYLE.stroke }, width: 1 },
      },
    ]);
  });

  it('fills a single dab, which has no band to stroke', () => {
    const [dab, rim] = brushOverlayCommands([{ x: 5, y: 6 }], 4, STYLE);
    expect(dab).toEqual({ kind: 'path', path: circlePath(5, 6, 4), fill: { paint: { color: STYLE.fill } } });
    expect(rim).toMatchObject({ path: circlePath(5, 6, 4) });
  });

  it('paints nothing for an empty path', () => {
    expect(brushOverlayCommands([], 4, STYLE)).toEqual([]);
  });
});
