import '../../labTestSetup';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { defineInstrument, Lab } from '@weasel-js/labkit';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { composeConfig } from './composeConfig';
import { ComposeInstrument } from './ComposeInstrument';
import { polarPoint } from './splineGeometry';

const realCTM = SVGSVGElement.prototype.getScreenCTM;
beforeAll(() => {
  SVGSVGElement.prototype.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) as DOMMatrix;
});
afterAll(() => {
  SVGSVGElement.prototype.getScreenCTM = realCTM;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const SPLINE = [defineInstrument({
  ...ComposeInstrument,
  defaultConfig: () => {
    const config = composeConfig.defaults();
    return { ...config, shape: { ...config.shape, base: 'octant-spline' as const } };
  },
})];

const fire = (el: Element, type: string, init: PointerEventInit) =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, buttons: 1, pointerId: 1, button: 0, ...init }));

describe("the spline editor's drag", () => {
  it('is one undo step, however long it pauses', async () => {
    await renderSettled(<Lab instruments={SPLINE} />, { wrapper: withIcons });
    const svg = document.querySelector('svg[viewBox="-8 -80 90 90"]')!;
    const host = svg.parentElement!;
    const label = () => screen.queryByText(/^\(0\.25, /);
    expect(label()).toHaveTextContent('(0.25, 30.0) w1.0');
    vi.useFakeTimers({ toFake: ['Date'] });
    const at = polarPoint('octant', 0.25, 30);
    act(() => {
      fire(host, 'pointerdown', { clientX: at.x, clientY: at.y });
      fire(host, 'pointermove', { clientX: at.x + 6, clientY: at.y });
      fire(host, 'pointermove', { clientX: at.x + 9, clientY: at.y });
    });
    expect(label()).toBeNull();
    vi.setSystemTime(Date.now() + 2000);
    act(() => {
      fire(host, 'pointermove', { clientX: at.x + 14, clientY: at.y });
      fire(host, 'pointerup', { clientX: at.x + 14, clientY: at.y, buttons: 0 });
    });
    expect(label()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(label()).toHaveTextContent('(0.25, 30.0) w1.0');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
