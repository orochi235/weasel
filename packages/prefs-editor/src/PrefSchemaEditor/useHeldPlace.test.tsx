import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useHeldPlace } from './useHeldPlace';

it('holds the stage in its own px when an ancestor draws it at twice its size', () => {
  const box = document.createElement('div');
  const shown = box.appendChild(document.createElement('div'));
  for (const [k, v] of Object.entries({ offsetWidth: 100, offsetHeight: 100 })) Object.defineProperty(box, k, { value: v });
  box.getBoundingClientRect = () => DOMRect.fromRect({ x: 10, y: 20, width: 200, height: 200 });
  shown.getBoundingClientRect = () => DOMRect.fromRect({ x: 30, y: 60, width: 40, height: 40 });
  const stage = { current: box };
  const { result, rerender } = renderHook(({ holding }) => useHeldPlace(stage, holding), { initialProps: { holding: false } });
  rerender({ holding: true });
  expect(result.current.style).toEqual({ '--held-x': '10px', '--held-y': '20px' });
});
