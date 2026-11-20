import { describe, it, expect } from 'vitest';
import { isNodeRuntime } from './shaper';

describe('isNodeRuntime', () => {
  it('reads the WebAssembly from disk in Node, and fetches it in a browser or an Electron renderer', () => {
    expect(isNodeRuntime({ versions: { node: '24.0.0' } })).toBe(true);
    expect(isNodeRuntime({ versions: { node: '24.0.0' }, type: 'browser' })).toBe(true);
    expect(isNodeRuntime({ versions: { node: '24.0.0' }, type: 'renderer' })).toBe(false);
    expect(isNodeRuntime({ versions: {} })).toBe(false);
    expect(isNodeRuntime(undefined)).toBe(false);
  });
});
