import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useDropMotion } from './dropMotion';
import { PATH_ATTR } from './selection';

afterEach(() => { cleanup(); });

function Form() {
  const ref = useRef<HTMLDivElement>(null);
  useDropMotion(ref, true, null, 'root', 'page');
  return <div ref={ref}><div {...{ [PATH_ATTR]: 'a' }} data-test-row="" /></div>;
}

it('slides a row by how far it moved in the form\'s own px when an ancestor draws the form at twice its size', () => {
  const animate = vi.fn();
  const original = HTMLElement.prototype.getBoundingClientRect;
  let rowTop = 40;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.dataset.testRow !== undefined) return DOMRect.fromRect({ x: 0, y: rowTop, width: 200, height: 20 });
    return DOMRect.fromRect({ x: 0, y: 0, width: 400, height: 400 });
  };
  try {
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    const view = render(<Form />);
    const form = view.container.firstElementChild as HTMLElement;
    Object.defineProperty(form, 'offsetWidth', { value: 200 });
    Object.defineProperty(form, 'offsetHeight', { value: 200 });
    view.rerender(<Form />);
    animate.mockClear();
    rowTop = 80;
    view.rerender(<Form />);
    expect(animate.mock.calls[0]?.[0]?.[0]).toEqual({ transform: 'translate(0px, -20px)' });
  } finally {
    HTMLElement.prototype.getBoundingClientRect = original;
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  }
});
