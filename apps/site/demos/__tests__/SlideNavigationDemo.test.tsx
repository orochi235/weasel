import { act, cleanup, screen } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SlideNavigationDemo } from '../SlideNavigationDemo';

const press = (key: string) => {
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })); });
  act(() => { document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key })); });
};

// jsdom lays nothing out; the `view` dep measures the canvas element.
beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => 360 });
});
afterAll(() => {
  delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>)['clientWidth'];
  delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>)['clientHeight'];
});
afterEach(cleanup);

describe('SlideNavigationDemo', () => {
  it('steps through its slides with the keys', () => {
    render(<SlideNavigationDemo />);
    expect(screen.getByText('Slide 1 of 4')).toBeTruthy();
    press('ArrowRight');
    expect(screen.getByText('Slide 2 of 4')).toBeTruthy();
    press('End');
    expect(screen.getByText('Slide 4 of 4')).toBeTruthy();
    press('ArrowLeft');
    expect(screen.getByText('Slide 3 of 4')).toBeTruthy();
  });
});
