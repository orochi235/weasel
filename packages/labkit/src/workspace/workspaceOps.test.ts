import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import type { WorkspaceRecord } from '../state/types';
import { addWorkspace, cloneWorkspace, closeWorkspace, resetWorkspace } from './workspaceOps';

interface CounterState {
  count: number;
}
interface CounterConfig {
  step: number;
}

const counter: Instrument<CounterState, CounterConfig> = {
  name: 'Counter',
  defaultConfig: () => ({ step: 1 }),
  initialState: (config) => ({ count: 0 * config.step }),
  render: () => null,
};

const counterWithCanvas: Instrument<CounterState, CounterConfig> = {
  ...counter,
  name: 'CounterCanvas',
  canvas: {
    layers: [],
    initialView: { zoom: 2, pan: { x: 5, y: 7 } },
  },
};

const instruments: Instrument[] = [counter as Instrument, counterWithCanvas as Instrument];

function head<T>(arr: T[]): T {
  const first = arr[0];
  if (first === undefined) throw new Error('expected non-empty array');
  return first;
}

describe('addWorkspace', () => {
  it('appends a new record using defaultConfig and initialState', () => {
    const out = addWorkspace([], instruments, 'Counter');
    expect(out).toHaveLength(1);
    expect(out[0]?.instrumentName).toBe('Counter');
    expect(out[0]?.config).toEqual({ step: 1 });
    expect(out[0]?.state).toEqual({ count: 0 });
  });

  it('assigns a unique id', () => {
    const a = addWorkspace([], instruments, 'Counter');
    const b = addWorkspace(a, instruments, 'Counter');
    expect(b).toHaveLength(2);
    expect(b[0]?.id).not.toBe(b[1]?.id);
  });

  it('uses canvas.initialView when present', () => {
    const out = addWorkspace([], instruments, 'CounterCanvas');
    expect(out[0]?.view).toEqual({ zoom: 2, pan: { x: 5, y: 7 } });
  });

  it('defaults view when canvas absent', () => {
    const out = addWorkspace([], instruments, 'Counter');
    expect(out[0]?.view).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
  });

  it('throws when instrumentName is unknown', () => {
    expect(() => addWorkspace([], instruments, 'Missing')).toThrow();
  });

  it('does not mutate input array', () => {
    const arr: WorkspaceRecord[] = [];
    addWorkspace(arr, instruments, 'Counter');
    expect(arr).toHaveLength(0);
  });
});

describe('cloneWorkspace', () => {
  it('inserts clone immediately after source with new id', () => {
    const a = addWorkspace([], instruments, 'Counter');
    const sourceId = head(a).id;
    const cloned = cloneWorkspace(a, sourceId);
    expect(cloned).toHaveLength(2);
    expect(cloned[0]?.id).toBe(sourceId);
    expect(cloned[1]?.id).not.toBe(sourceId);
    expect(cloned[1]?.instrumentName).toBe('Counter');
  });

  it('deep-copies config/state/view', () => {
    const a = addWorkspace([], instruments, 'Counter');
    const cloned = cloneWorkspace(a, head(a).id);
    expect(cloned[1]?.config).not.toBe(cloned[0]?.config);
    expect(cloned[1]?.state).not.toBe(cloned[0]?.state);
    expect(cloned[1]?.view).not.toBe(cloned[0]?.view);
  });

  it('does not mutate input', () => {
    const a = addWorkspace([], instruments, 'Counter');
    const before = a.length;
    cloneWorkspace(a, head(a).id);
    expect(a).toHaveLength(before);
  });
});

describe('closeWorkspace', () => {
  it('removes the workspace with the given id', () => {
    let arr = addWorkspace([], instruments, 'Counter');
    arr = addWorkspace(arr, instruments, 'Counter');
    const closed = closeWorkspace(arr, head(arr).id);
    expect(closed).toHaveLength(1);
    expect(closed[0]?.id).toBe(arr[1]?.id);
  });

  it('is a no-op when only one workspace remains', () => {
    const arr = addWorkspace([], instruments, 'Counter');
    const closed = closeWorkspace(arr, head(arr).id);
    expect(closed).toEqual(arr);
  });
});

describe('resetWorkspace', () => {
  it('resets config and state to defaults; preserves instrumentName', () => {
    const arr = addWorkspace([], instruments, 'Counter');
    const id = head(arr).id;
    head(arr).config = { step: 99 } as CounterConfig;
    head(arr).state = { count: 42 } as CounterState;
    const reset = resetWorkspace(arr, id, instruments);
    expect(reset[0]?.config).toEqual({ step: 1 });
    expect(reset[0]?.state).toEqual({ count: 0 });
    expect(reset[0]?.instrumentName).toBe('Counter');
  });

  it('resets view to canvas.initialView when present', () => {
    const arr = addWorkspace([], instruments, 'CounterCanvas');
    head(arr).view = { zoom: 9, pan: { x: 9, y: 9 } };
    const reset = resetWorkspace(arr, head(arr).id, instruments);
    expect(reset[0]?.view).toEqual({ zoom: 2, pan: { x: 5, y: 7 } });
  });

  it('does not mutate input', () => {
    const arr = addWorkspace([], instruments, 'Counter');
    head(arr).config = { step: 99 } as CounterConfig;
    resetWorkspace(arr, head(arr).id, instruments);
    expect((arr[0]?.config as CounterConfig).step).toBe(99);
  });
});
