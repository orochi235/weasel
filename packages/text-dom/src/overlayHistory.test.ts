import { expect, it } from 'vitest';
import { overlayHistory, type OverlayState } from './overlayHistory';

it('records no step for a change that leaves the runs as they were, whatever order their keys are in', () => {
  const selection = { start: 1, end: 1 };
  let state: OverlayState = { runs: [{ text: 'a', bold: true, italic: true }], selection, style: null };
  const written: OverlayState[] = [];
  const history = overlayHistory({ read: () => state, write: (s) => written.push(s) });
  history.before('other');
  state = { runs: [{ italic: true, bold: true, text: 'a' }], selection, style: null };
  history.after();
  history.undo();
  expect(written).toEqual([]);
});
