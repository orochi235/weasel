import { describe, it, expect } from 'vitest';
import type { SceneCanvasProps } from './SceneCanvas';
import type { ViewApi } from 'interactions/actions/depSchema';
import type { View } from 'core/viewport/view';

type Viewport = NonNullable<SceneCanvasProps<unknown, string, unknown>['viewport']>;

// A `() => void` signature still *accepts* a callback that returns a `View` —
// TypeScript discards returns assigned to a void-returning signature. So
// assigning a fitting callback proves nothing about the declaration; the
// declared return type is what has to admit a `View`, and these two constants
// are `false` (and so fail to compile) if it narrows back to `void`.
const propCarriesTheTarget: View extends ReturnType<NonNullable<Viewport['recenter']>>
  ? true
  : false = true;
const depCarriesTheTarget: View extends ReturnType<NonNullable<ViewApi['recenter']>>
  ? true
  : false = true;

describe('viewport.recenter', () => {
  it('declares a return type the kit can animate to', () => {
    expect(propCarriesTheTarget).toBe(true);
    expect(depCarriesTheTarget).toBe(true);
  });

  it('accepts a callback that returns the target view, and one that returns nothing', () => {
    const fitting: Viewport['recenter'] = () => ({ x: 1, y: 2, scale: { x: 3, y: 3 } } as View);
    const dispatching: Viewport['recenter'] = () => { /* sets the view itself */ };
    expect(fitting!()).toEqual({ x: 1, y: 2, scale: { x: 3, y: 3 } });
    expect(dispatching!()).toBeUndefined();
  });
});
