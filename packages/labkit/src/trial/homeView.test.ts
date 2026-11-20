import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { cameraOf } from './homeView';

const palette = {
  palette: [{ id: 'a', label: 'A' }],
  onDrop: (_w: unknown, _i: unknown, s: unknown) => s,
};

function instrument(extra: Partial<Instrument>): Instrument {
  return { name: 'Dropper', initialState: () => ({}), render: () => null, ...extra } as Instrument;
}

describe('cameraOf', () => {
  it('throws for dragDrop without a canvas, which nothing could drop on', () => {
    expect(() => cameraOf(instrument({ dragDrop: palette }))).toThrow(
      /`dragDrop` without `canvas`/,
    );
    expect(() =>
      cameraOf(instrument({ dragDrop: palette, stage: {} as Instrument['stage'] })),
    ).toThrow(/`dragDrop` without `canvas`/);
  });

  it('takes dragDrop beside a canvas', () => {
    expect(cameraOf(instrument({ dragDrop: palette, canvas: { layers: [] } }))?.kind).toBe(
      'canvas',
    );
  });
});
