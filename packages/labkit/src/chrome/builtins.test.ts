import { describe, expect, it } from 'vitest';
import { builtinContributions } from './builtins';
import type { TrialChromeContext } from './types';
import type { Instrument } from '../instrument/types';

const ctx: TrialChromeContext = {
  trialId: 't1',
  instrumentName: 'Stub',
  isLastTrial: false,
  zoom: 1,
  setZoom: () => {},
  canUndo: true,
  canRedo: false,
  undo: () => {},
  redo: () => {},
  configFields: [],
  config: {},
  setConfig: () => {},
  savedSnapshots: [],
  saveSnapshot: () => {},
  loadSnapshot: () => {},
  clone: () => {},
  reset: () => {},
  close: () => {},
  activeToolId: null,
  setActiveTool: () => {},
};

const bare: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

function ids(instrument: Instrument, c: TrialChromeContext = ctx): string[] {
  return builtinContributions(instrument, c).map((x) => x.id);
}

describe('builtinContributions', () => {
  it('always contributes the trial actions', () => {
    expect(ids(bare)).toEqual(['snapshot', 'clone', 'reset', 'close']);
  });

  it('contributes undo and redo only when the instrument declares undo', () => {
    expect(ids(bare)).not.toContain('undo');
    expect(ids({ ...bare, undo: {} })).toContain('undo');
    expect(ids({ ...bare, undo: {} })).toContain('redo');
  });

  it('puts zoom controls in the viewport region, not the toolbar', () => {
    const withCanvas: Instrument = { ...bare, canvas: { layers: [] } };
    const zoomIn = builtinContributions(withCanvas, ctx).find((c) => c.id === 'zoom-in');
    expect(zoomIn?.region).toBe('viewport');
  });

  it('contributes no viewport controls when the view is not 2D', () => {
    const withCanvas: Instrument = { ...bare, canvas: { layers: [] } };
    const orbit = { ...ctx, zoom: null };
    expect(ids(withCanvas, orbit)).not.toContain('zoom-in');
  });

  it('contributes a settings section only when the schema has fields', () => {
    expect(ids(bare)).not.toContain('settings');
    const withFields = {
      ...ctx,
      configFields: [{ key: 'n', label: 'N', type: 'number' as const, default: 1 }],
    };
    expect(ids(bare, withFields)).toContain('settings');
  });

  it('reflects undo availability in the item, not by omitting it', () => {
    const withUndo: Instrument = { ...bare, undo: {} };
    const list = builtinContributions(withUndo, { ...ctx, canUndo: false });
    const undo = list.find((c) => c.id === 'undo');
    expect(undo?.item).toMatchObject({ disabled: true });
  });

  it('marks close as danger and disables it on the last trial', () => {
    const list = builtinContributions(bare, { ...ctx, isLastTrial: true });
    expect(list.find((c) => c.id === 'close')?.item).toMatchObject({
      danger: true,
      disabled: true,
    });
  });

  it('offers the snapshot loader only once a snapshot has been taken', () => {
    expect(ids(bare)).not.toContain('snapshot-load');
    const withSaves = {
      ...ctx,
      savedSnapshots: [
        {
          id: 's1',
          name: 'First',
          trialId: 't1',
          instrumentName: 'Stub',
          config: {},
          state: {},
          savedAt: 1,
        },
      ],
    };
    expect(ids(bare, withSaves)).toContain('snapshot-load');
  });

  it('produces no duplicate ids for a fully-declared instrument', () => {
    const full: Instrument = {
      ...bare,
      undo: {},
      canvas: { layers: [] },
      layers: { ids: ['a'] },
    };
    const list = builtinContributions(full, ctx);
    expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
  });
});
