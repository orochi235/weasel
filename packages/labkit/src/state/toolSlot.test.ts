import { describe, expect, it } from 'vitest';
import { createLabStore } from './store';

function store() {
  return createLabStore({ storageKey: 'test', storage: { read: () => null, write: () => {} } });
}

const record = { id: 't1', instrumentName: 'X', config: {}, state: {}, view: {} };

describe('the tool slot', () => {
  it('starts empty at both levels', () => {
    const s = store();
    expect(s.getState().activeToolId).toBeNull();
  });

  it('sets the lab slot', () => {
    const s = store();
    s.getState().setLabTool('brush');
    expect(s.getState().activeToolId).toBe('brush');
  });

  it('sets a trial slot without touching the lab one', () => {
    const s = store();
    s.getState().addTrial(record);
    s.getState().setLabTool('brush');
    s.getState().setTrialTool('t1', 'eraser');
    expect(s.getState().activeToolId).toBe('brush');
    expect(s.getState().trials[0].activeToolId).toBe('eraser');
  });

  it('leaves a trial slot undefined until it is set', () => {
    const s = store();
    s.getState().addTrial(record);
    expect(s.getState().trials[0].activeToolId).toBeUndefined();
  });
});
