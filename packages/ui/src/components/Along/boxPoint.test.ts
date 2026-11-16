import { expect, it } from 'vitest';
import { boxPoint } from './boxPoint';

it('maps a client point into an HTML frame drawn at twice its size by an ancestor', () => {
  const frame = document.createElement('div');
  Object.defineProperty(frame, 'offsetWidth', { value: 100 });
  Object.defineProperty(frame, 'offsetHeight', { value: 20 });
  frame.getBoundingClientRect = () => DOMRect.fromRect({ x: 10, y: 5, width: 200, height: 40 });
  expect(boxPoint(frame, 110, 25)).toEqual({ x: 50, y: 10 });
});
