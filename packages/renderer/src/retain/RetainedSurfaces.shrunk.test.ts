/** Counterexamples the retained-surface property test shrank to, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import { makeGLRecorder } from '../testing/glRecorder';
import { webglDevice } from '../gpu/webgl/WebGLDevice';
import { RetainedSurfaces } from './RetainedSurfaces';
import type { RetainedKey } from './retainedKey';

const key = (): RetainedKey => ({
  children: [], transform: mat3.identity(), alpha: 1, colorMatrix: new Float32Array(20), viewMatrix: undefined, clips: [],
});

describe('RetainedSurfaces, shrunk', () => {
  it('keeps no pixels for a key once a reserve has drawn over them and nothing committed', () => {
    const store = new RetainedSurfaces(webglDevice(makeGLRecorder().gl), Infinity);
    const k = key();
    store.beginFrame([]);
    store.reserve('a', 64, 48, { x: 0, y: 0, width: 10, height: 10 })!.commit(k);
    expect(store.lookup('a', 64, 48, k).kind).toBe('kept');
    // A draw that stops between reserve and commit leaves the surface's pixels drawn under no key.
    store.reserve('a', 64, 48, { x: 0, y: 0, width: 20, height: 10 });
    expect(store.lookup('a', 64, 48, k).kind).toBe('redraw');
  });
});
