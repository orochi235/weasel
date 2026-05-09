import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { mat3 } from './mat3';
import type { DrawCommand } from './DrawCommand';

describe('WeaselRenderer.render — kind: group', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('clears the framebuffer at the start of render', () => {
    r.render([]);
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('clear');
  });

  it('walks an empty group without throwing', () => {
    const cmd: DrawCommand = { kind: 'group', children: [] };
    expect(() => r.render([cmd])).not.toThrow();
  });

  it('walks nested groups recursively', () => {
    const cmd: DrawCommand = {
      kind: 'group',
      transform: mat3.translate(mat3.identity(), 10, 0),
      children: [
        {
          kind: 'group',
          transform: mat3.translate(mat3.identity(), 0, 20),
          children: [],
        },
      ],
    };
    expect(() => r.render([cmd])).not.toThrow();
  });
});

import type { RectPath } from '@orochi235/weasel';

describe('WeaselRenderer.render — kind: path (nonzero solid)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('binds the path-fill program before drawing a path', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('useProgram');
  });

  it('issues a drawElements call with the mesh index count', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);
    const draw = recorder.calls.find((c) => c.name === 'drawElements');
    expect(draw).toBeDefined();
    expect(draw!.args[1]).toBe(6);                                 // 2 triangles × 3
    expect(draw!.args[2]).toBe(recorder.gl.UNSIGNED_INT);
  });

  it('skips paths with no fill', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path }]);
    const draw = recorder.calls.find((c) => c.name === 'drawElements');
    expect(draw).toBeUndefined();
  });
});
