/** Counterexamples the second-pass long-run scene property test shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { addPage } from '../pages/pageEdits';

const make = () => createScene<Record<string, unknown>, string>({ systemLayers: [{ id: 'base' }] });

describe('long scene runs, shrunk counterexamples', () => {
  it('a removed page run, undone from a history reloaded from JSON, comes back with its layout', () => {
    const a = make();
    addPage(a, { id: 'p1', width: 100, height: 80 });
    const before = JSON.parse(JSON.stringify(a.toJSON()));
    a.remove(a.roots[0]!);
    const b = make();
    b.loadState(JSON.parse(JSON.stringify(a.toJSON())));
    b.restoreHistory(JSON.parse(JSON.stringify(a.serializeHistory())));
    b.undo();
    expect(JSON.parse(JSON.stringify(b.toJSON()))).toEqual(before);
  });

  it('an add at index Infinity, undone and redone from a history reloaded from JSON, lands at the end again', () => {
    const a = make();
    addPage(a, { id: 'page-1', width: 100, height: 80 });
    a.add({ kind: 'mark', layer: 'base', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {}, index: Infinity });
    const want = JSON.parse(JSON.stringify(a.toJSON()));
    const b = make();
    b.loadState(want);
    b.restoreHistory(JSON.parse(JSON.stringify(a.serializeHistory())));
    b.jumpToHistoryIndex(0);
    b.jumpToHistoryIndex(2);
    expect(JSON.parse(JSON.stringify(b.toJSON()))).toEqual(want);
  });
});
