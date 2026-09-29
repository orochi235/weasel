/**
 * `<Canvas paintInto>` follows its target: moved to another element, later
 * frames reach the new element's context and the old one's renderer is freed.
 * One recording context per element, so a frame is attributable to the buffer
 * it landed in.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { RenderLayer } from '../core/layers/render';
import { makeGLRecorder, type GLRecorder } from '../renderer/test-utils/glRecorder';

let recorders: Map<HTMLCanvasElement, GLRecorder>;
const original = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  recorders = new Map();
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, kind: string) {
    if (kind !== 'webgl2') return null;
    let rec = recorders.get(this);
    if (!rec) { rec = makeGLRecorder(); recorders.set(this, rec); }
    return rec.gl;
  }) as HTMLCanvasElement['getContext'];
});

afterEach(() => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = original;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const settle = async () => { await frame(); await frame(); await frame(); };

const rectLayer: RenderLayer<unknown> = {
  id: 'probe',
  label: 'Probe',
  space: 'screen',
  draw: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 4, height: 4 }, fill: { fill: 'solid', color: '#f00' } }],
};

const KINDS = ['Program', 'Buffer', 'Texture'] as const;

/** A frame is a renderer clearing its rect of the buffer. */
const frames = (rec: GLRecorder | undefined): number =>
  rec ? rec.calls.filter((c) => c.name === 'clear').length : 0;

/** Handles created by `create<Kind>` that no `delete<Kind>` has freed. */
function live(rec: GLRecorder, kind: (typeof KINDS)[number]): unknown[] {
  const created = rec.calls.filter((c) => c.name === `create${kind}`).map((c) => c.result);
  const deleted = new Set(rec.calls.filter((c) => c.name === `delete${kind}`).map((c) => c.args[0]));
  return created.filter((h) => !deleted.has(h));
}

describe('<Canvas paintInto> moved to another element', () => {
  it('paints later frames into the new element and frees the old one\'s renderer', async () => {
    const a = document.createElement('canvas');
    const b = document.createElement('canvas');
    const input = document.createElement('div');
    document.body.append(a, b, input);

    const props = { width: 50, height: 40, layers: { probe: rectLayer }, inputElement: input };
    const { rerender, unmount } = render(<Canvas {...props} paintInto={{ canvas: a, x: 0, y: 0 }} />);
    await settle();
    const recA = recorders.get(a)!;
    expect(frames(recA), 'frames into a before the move').toBeGreaterThan(0);
    for (const kind of KINDS) expect(live(recA, kind).length, `${kind}s on a`).toBeGreaterThan(0);

    rerender(<Canvas {...props} paintInto={{ canvas: b, x: 0, y: 0 }} />);
    await settle();
    expect(frames(recorders.get(b)), 'frames into b after the move').toBeGreaterThan(0);
    for (const kind of KINDS) expect(live(recA, kind), `live ${kind}s on a after the move`).toEqual([]);

    const framesOnA = frames(recA);
    rerender(<Canvas {...props} paintInto={{ canvas: b, x: 5, y: 5 }} />);
    await settle();
    expect(frames(recA), 'no frame reaches a once it moved').toBe(framesOnA);

    unmount();
    const recB = recorders.get(b)!;
    for (const kind of KINDS) expect(live(recB, kind), `live ${kind}s on b after unmount`).toEqual([]);
    a.remove(); b.remove(); input.remove();
  });
});
