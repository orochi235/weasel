import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useWheelPassThrough } from './useWheelPassThrough';

afterEach(() => {
  document.body.replaceChildren();
});

it('hit-tests the document the lens layer lives in, not the module’s own', () => {
  const frame = document.body.appendChild(document.createElement('iframe'));
  const doc = frame.contentDocument as Document;
  const layer = doc.body.appendChild(doc.createElement('div'));
  layer.className = 'lk-lens-layer';
  const input = layer.appendChild(doc.createElement('div'));
  const beneath = doc.body.appendChild(doc.createElement('div'));
  doc.elementFromPoint = vi.fn(() => beneath);
  document.elementFromPoint = vi.fn(() => null);
  const heard = vi.fn();
  beneath.addEventListener('wheel', heard);
  renderHook(() => useWheelPassThrough(input, layer));
  const View = doc.defaultView as Window & typeof globalThis;
  input.dispatchEvent(
    new View.WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }),
  );
  expect(heard).toHaveBeenCalledTimes(1);
});
