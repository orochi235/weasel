import { describe, expect, it } from 'vitest';
import { lockAspectWithModifier } from './lockAspect';
import type {
  GestureContext,
  ResizeAnchor,
  ResizePose,
  ResizeProposed,
  ModifierState,
} from '../../../gestures/types';

type P = ResizePose;

function ctx(origin: P, mods: Partial<ModifierState> = {}): GestureContext<P> {
  return {
    draggedIds: ['a'],
    origin: new Map([['a', origin]]),
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, ...mods },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    adapter: {} as never,
    scratch: {},
  };
}

function proposed(pose: P, anchor: ResizeAnchor): ResizeProposed<P> {
  return { pose, anchor };
}

describe('resize/lockAspectWithModifier', () => {
  const b = lockAspectWithModifier<P>();

  it('no modifier: no-op', () => {
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 100, height: 50 }),
      proposed({ x: 0, y: 0, width: 200, height: 80 }, { x: 'min', y: 'min' }),
    );
    expect(r).toBeUndefined();
  });

  it('SE corner, width-dominant: height follows ratio, NW anchored', () => {
    // origin 100x50 (ratio 2). Proposed 200x60 → dw=100 dh=10 → width wins.
    // → width=200, height=200/2=100. Anchor at origin (0,0).
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 100, height: 50 }, { shift: true }),
      proposed({ x: 0, y: 0, width: 200, height: 60 }, { x: 'min', y: 'min' }),
    );
    expect(r).toEqual({
      pose: { x: 0, y: 0, width: 200, height: 100 },
    });
  });

  it('SE corner, height-dominant: width follows ratio', () => {
    // origin 100x50 (ratio 2). Proposed 110x150 → dw=10 dh=100 → height wins.
    // → height=150, width=150*2=300.
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 100, height: 50 }, { shift: true }),
      proposed({ x: 0, y: 0, width: 110, height: 150 }, { x: 'min', y: 'min' }),
    );
    expect(r).toEqual({
      pose: { x: 0, y: 0, width: 300, height: 150 },
    });
  });

  it('NW corner: anchors at SE corner', () => {
    // origin (10,10) 100x50 (ratio 2). NW drag → anchor SE = (110, 60).
    // Proposed (-40, -10) width=150 height=70 → dw=50 dh=20 → width wins.
    // → width=150, height=75. x = 110-150 = -40; y = 60-75 = -15.
    const r = b.onMove!(
      ctx({ x: 10, y: 10, width: 100, height: 50 }, { shift: true }),
      proposed(
        { x: -40, y: -10, width: 150, height: 70 },
        { x: 'max', y: 'max' },
      ),
    );
    expect(r).toEqual({
      pose: { x: -40, y: -15, width: 150, height: 75 },
    });
  });

  it('east edge (anchor x=min, y=free): height follows width, centered vertically about origin', () => {
    // origin (0,0) 100x50 (ratio 2). East drag → width=200, height=200/2=100.
    // y centered: origin center y = 25; ny = 25 - 50 = -25.
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 100, height: 50 }, { shift: true }),
      proposed(
        { x: 0, y: 0, width: 200, height: 50 },
        { x: 'min', y: 'free' },
      ),
    );
    expect(r).toEqual({
      pose: { x: 0, y: -25, width: 200, height: 100 },
    });
  });

  it('south edge (anchor y=min, x=free): width follows height, centered horizontally', () => {
    // origin 100x50 ratio 2. South drag height=100 → width=200.
    // x centered: origin cx=50; nx=50-100=-50.
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 100, height: 50 }, { shift: true }),
      proposed(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 'free', y: 'min' },
      ),
    );
    expect(r).toEqual({
      pose: { x: -50, y: 0, width: 200, height: 100 },
    });
  });

  it('custom key: alt activates, shift does not', () => {
    const ba = lockAspectWithModifier<P>({ key: 'alt' });
    const noShift = ba.onMove!(
      ctx({ x: 0, y: 0, width: 100, height: 50 }, { shift: true }),
      proposed({ x: 0, y: 0, width: 200, height: 60 }, { x: 'min', y: 'min' }),
    );
    expect(noShift).toBeUndefined();

    const withAlt = ba.onMove!(
      ctx({ x: 0, y: 0, width: 100, height: 50 }, { alt: true }),
      proposed({ x: 0, y: 0, width: 200, height: 60 }, { x: 'min', y: 'min' }),
    );
    expect(withAlt).toEqual({
      pose: { x: 0, y: 0, width: 200, height: 100 },
    });
  });

  it('zero-area origin: no-op', () => {
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 0, height: 50 }, { shift: true }),
      proposed({ x: 0, y: 0, width: 10, height: 60 }, { x: 'min', y: 'min' }),
    );
    expect(r).toBeUndefined();
  });
});
