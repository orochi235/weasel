import { expect, it } from 'vitest';
import { resolveTextStyle } from '@weasel-js/text';
import { mountOverlayBoxes, placeOverlay } from './overlayPlace';

it('lets presses through a clipping node\'s scroll box once its pose goes null', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const overlay = document.createElement('div');
  const boxes = mountOverlayBoxes(container, overlay);
  const style = resolveTextStyle({ fontSize: 16 });
  const pose = { x: 0, y: 0, width: 200, height: 40, fontSize: 16, clip: { left: 4, top: 4, right: 4, bottom: 4 } };
  placeOverlay(overlay, boxes, pose, null, style);
  expect(boxes.scroll.style.pointerEvents).toBe('auto');
  placeOverlay(overlay, boxes, null, null, style);
  expect(overlay.style.display).toBe('none');
  expect(boxes.scroll.style.pointerEvents).toBe('none');
  placeOverlay(overlay, boxes, pose, null, style);
  expect(boxes.scroll.style.pointerEvents).toBe('auto');
  boxes.remove();
});
