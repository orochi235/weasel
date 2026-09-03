import { describe, expect, it, vi } from 'vitest';
import { capturePlan, composeCaptureSvg } from './capture';
import { createAnnotationStore } from './store';
import type { AnnotationTargetInfo, CaptureSource } from './types';

const SVG_BASE = '<svg viewBox="0 0 100 60"><rect width="100" height="60" fill="#f00"/></svg>';

function targets(): AnnotationTargetInfo[] {
  return [
    {
      id: 'flat',
      content: { w: 100, h: 60 },
      base: (): CaptureSource => ({ kind: 'svg', markup: SVG_BASE }),
    },
    { id: 'bare', content: { w: 100, h: 60 } },
  ];
}

describe('a target that can be captured', () => {
  it('reports every target, in declaration order, base or no base', () => {
    const store = createAnnotationStore({ targets });
    expect(store.targets().map((t) => t.id)).toEqual(['flat', 'bare']);
    expect(store.targets()[1]?.base).toBeUndefined();
  });

  it('does not call a target base until a capture asks for it', () => {
    const base = vi.fn((): CaptureSource => ({ kind: 'svg', markup: SVG_BASE }));
    const store = createAnnotationStore({
      targets: () => [{ id: 'flat', content: { w: 100, h: 60 }, base }],
    });
    store.add({ target: 'flat', kind: 'rect', frac: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } });
    store.query();
    store.targets();
    expect(base).not.toHaveBeenCalled();
  });
});

describe('which route an export takes', () => {
  const svg: CaptureSource = { kind: 'svg', markup: SVG_BASE };
  const image: CaptureSource = { kind: 'image', src: 'data:image/png;base64,AA' };

  // The two rasterizing halves are browser-only and are asserted in
  // `tests/visual/annotations-capture.spec.ts`. jsdom's canvas has no 2D
  // context, so a test of them here could not fail for the right reason.
  it('stays vector for an SVG format, whatever the base is', () => {
    expect(capturePlan(svg, 'svg')).toBe('svg-document');
    expect(capturePlan(image, 'svg')).toBe('svg-document');
    expect(capturePlan(undefined, 'svg')).toBe('svg-document');
  });

  it('nests an SVG base rather than rasterizing it twice', () => {
    expect(capturePlan(svg, 'png')).toBe('svg-document');
  });

  it('stacks rasters for a raster base, or for no base at all', () => {
    expect(capturePlan(image, 'png')).toBe('raster-stack');
    expect(capturePlan({ kind: 'canvas', canvas: {} as HTMLCanvasElement }, 'png')).toBe(
      'raster-stack',
    );
    expect(capturePlan(undefined, 'png')).toBe('raster-stack');
  });
});

describe('the composed document', () => {
  const draw = { content: { w: 100, h: 60 }, config: {} };

  function sceneWithMark() {
    const store = createAnnotationStore({ targets });
    store.add({ target: 'flat', kind: 'rect', frac: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } });
    return store.sceneFor('flat');
  }

  it('frames the content box, and carries the scale as width and height', () => {
    const out = composeCaptureSvg({ scene: sceneWithMark(), draw, scale: 4 });
    expect(out).toContain('viewBox="0 0 100 60"');
    expect(out).toContain('width="400"');
    expect(out).toContain('height="240"');
  });

  it('nests the base and re-frames it onto the content box', () => {
    const out = composeCaptureSvg({
      base: { kind: 'svg', markup: SVG_BASE },
      scene: sceneWithMark(),
      draw,
      scale: 2,
    });
    // Scale 2, so the outer viewport is 200x120 and the base's own 100x60 is
    // unambiguously the re-framing rather than a coincidence.
    expect(out).toContain('fill="#f00"');
    expect(out).toMatch(/<svg[^>]*x="0"[^>]*y="0"[^>]*width="100"[^>]*height="60"/);
    expect(out).toContain('#e5484d');
  });

  it('re-frames a base whose declared size disagrees with its viewBox', () => {
    const out = composeCaptureSvg({
      base: { kind: 'svg', markup: '<svg viewBox="0 0 100 60" width="520"><rect/></svg>' },
      scene: sceneWithMark(),
      draw,
      scale: 1,
    });
    expect(out).not.toContain('width="520"');
  });

  it('exports marks on transparency when a target hands over no base', () => {
    const out = composeCaptureSvg({ scene: sceneWithMark(), draw, scale: 1 });
    expect(out).toContain('#e5484d');
    expect(out.match(/<svg/g)).toHaveLength(2);
  });

  it('embeds a raster base as an image, warning when it is only a reference', () => {
    const warn = vi.fn();
    const out = composeCaptureSvg({
      base: { kind: 'image', src: 'https://example.test/brick.png' },
      scene: sceneWithMark(),
      draw,
      scale: 1,
      onWarn: warn,
    });
    expect(out).toContain('https://example.test/brick.png');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not self-contained'));
  });

  it('refuses markup that is not an SVG document', () => {
    expect(() =>
      composeCaptureSvg({
        base: { kind: 'svg', markup: '<div>not svg</div>' },
        scene: sceneWithMark(),
        draw,
        scale: 1,
      }),
    ).toThrow(/not an <svg> document/);
  });
});

describe('capturing through the store', () => {
  it('rejects a target the instrument does not declare', async () => {
    const store = createAnnotationStore({ targets });
    await expect(store.capture('nope')).rejects.toThrow(/no annotation target/);
  });
});
