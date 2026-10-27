import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

describe('WeaselRenderer.render — color matrix on text + image', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(async () => {
    _resetFontRegistryForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');

    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  // 4×5 row-major color matrix that drops red. Identity except m[0]=0.
  const NO_RED: number[] = [
    0, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ];

  it('maps a glyph color through the group colorMatrix before staging it, leaving the uniform at identity', () => {
    const cmd: DrawCommand = {
      kind: 'group',
      colorMatrix: NO_RED,
      children: [
        { kind: 'text', x: 0, y: 0, runs: [{ text: 'A', fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#fff' } }, letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0 }], align: 'left', style: { fontFamily: 'inter', fontSize: 32 } },
      ],
    };
    r.render([cmd]);
    // A glyph's color is its vertex color alone, so white under NO_RED is staged as cyan.
    const upload = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    )!;
    expect(Array.from((upload.args[2] as Float32Array).slice(2, 6))).toEqual([0, 1, 1, 1]);
    const matrixCalls = recorder.calls.filter((c) => c.name === 'uniformMatrix4fv');
    expect(matrixCalls.length).toBeGreaterThan(0);
    for (const c of matrixCalls) expect((c.args[2] as Float32Array)[0]).toBe(1);
  });

  it('stages each text command in its own color, its fill opacity and group alpha folded in', () => {
    // Glyph colors share one scratch array; a later command must not repaint
    // an earlier one's quads, already staged, in its color.
    const text = (color: string, opacity?: number): DrawCommand => ({
      kind: 'text', x: 0, y: 0,
      runs: [{ text: 'A', fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal', fill: { paint: { kind: 'solid', color, opacity } }, letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0 }],
      align: 'left', style: { fontFamily: 'inter', fontSize: 32 },
    });
    r.render([{ kind: 'group', alpha: 0.5, children: [text('#f00', 0.5)] }, text('#00f')]);
    const upload = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    )!;
    const v = upload.args[2] as Float32Array;
    expect(Array.from(v.slice(2, 6))).toEqual([1, 0, 0, 0.25]);
    const second = 4 * 10;
    expect(Array.from(v.slice(second + 2, second + 6))).toEqual([0, 0, 1, 1]);
  });

  it('uploads u_colorMatrix during an image draw inside a group whose colorMatrix mixes channels', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    // Red takes green's value: off the diagonal, so no vertex tint stands in for it.
    const RED_FROM_GREEN = [...NO_RED];
    RED_FROM_GREEN[1] = 1;
    const cmd: DrawCommand = {
      kind: 'group',
      colorMatrix: RED_FROM_GREEN,
      children: [
        { kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 },
      ],
    };
    r.render([cmd]);
    const matrixCalls = recorder.calls.filter((c) => c.name === 'uniformMatrix4fv');
    const someIsColorMatrix = matrixCalls.some((c) => {
      const arr = c.args[2];
      return arr instanceof Float32Array && arr.length === 16 && arr[0] === 0 && arr[4] === 1 && arr[5] === 1;
    });
    expect(someIsColorMatrix).toBe(true);
  });

  it('stages an image under a colorMatrix that only scales channels as a tint, leaving the uniform at identity', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    r.render([{
      kind: 'group',
      colorMatrix: NO_RED,
      children: [{ kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 }],
    }]);
    const upload = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    )!;
    expect(Array.from((upload.args[2] as Float32Array).slice(2, 6))).toEqual([0, 1, 1, 1]);
    for (const c of recorder.calls.filter((c) => c.name === 'uniformMatrix4fv')) {
      expect((c.args[2] as Float32Array)[0]).toBe(1);
    }
  });

  it('uploads identity u_colorMatrix on text draws with no enclosing group transform', () => {
    const cmd: DrawCommand = {
      kind: 'text', x: 0, y: 0,
      runs: [{ text: 'A', fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#fff' } }, letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0 }],
      align: 'left',
      style: { fontFamily: 'inter', fontSize: 32 },
    };
    r.render([cmd]);
    const matrixCalls = recorder.calls.filter((c) => c.name === 'uniformMatrix4fv');
    const identityUploaded = matrixCalls.some((c) => {
      const arr = c.args[2];
      if (!(arr instanceof Float32Array) || arr.length !== 16) return false;
      // Column-major identity: diagonal ones.
      return arr[0] === 1 && arr[5] === 1 && arr[10] === 1 && arr[15] === 1;
    });
    expect(identityUploaded).toBe(true);
  });

  it('uploads identity u_colorMatrix on image draws with no enclosing group transform', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const cmd: DrawCommand = { kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 };
    r.render([cmd]);
    const matrixCalls = recorder.calls.filter((c) => c.name === 'uniformMatrix4fv');
    const identityUploaded = matrixCalls.some((c) => {
      const arr = c.args[2];
      if (!(arr instanceof Float32Array) || arr.length !== 16) return false;
      return arr[0] === 1 && arr[5] === 1 && arr[10] === 1 && arr[15] === 1;
    });
    expect(identityUploaded).toBe(true);
  });
});
