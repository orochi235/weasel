import { describe, expect, it, vi } from 'vitest';
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
