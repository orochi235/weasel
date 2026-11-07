import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import type { ActionDeps, CanvasExtensionApi, ContributionFrameCtx, ImmediateInvoker, View } from '@weasel-js/core';
import { createRulers } from '@weasel-js/guides';
import { IMPERIAL_INCHES } from '@weasel-js/quantity';
import { Rulers } from './Rulers';

const VIEW: View = { x: 0, y: 0, scale: { x: 10, y: 10 } };

function painted() {
  const rulers = createRulers({ guides: { addGuide: () => {}, removeGuide: () => {} }, root: { system: IMPERIAL_INCHES }, majorPx: 140 });
  const api = {
    registerLayer: () => () => {}, requestRedraw: () => {}, getSurfaceRect: () => ({ x: 0, y: 0, width: 400, height: 300 }),
  } as unknown as CanvasExtensionApi;
  rulers.contribution.attach!(api, { get: () => undefined });
  const paint = (view: View) => rulers.contribution.beforePaint!({ view } as ContributionFrameCtx);
  const hover = (world: { x: number; y: number }) => {
    const pointer = rulers.contribution.actions!.find((a) => a.id === 'rulers.pointer')!;
    (pointer.invoker as ImmediateInvoker).run({} as ActionDeps, { world, over: true } as never);
  };
  return { rulers, paint, hover };
}

const labels = (svg: Element) => [...svg.querySelectorAll('text')].map((t) => t.textContent);

describe('Rulers', () => {
  it('draws nothing before the canvas paints', () => {
    const { rulers } = painted();
    const { container } = render(<Rulers rulers={rulers} />);
    expect(container.firstChild).toBeNull();
  });

  it('labels each ruler in the unit it reads, named in the corner', () => {
    const { rulers, paint } = painted();
    paint(VIEW);
    const { container } = render(<Rulers rulers={rulers} />);
    const [top, left, corner] = [...container.querySelectorAll('svg')];
    expect(labels(top!)).toEqual(['0', '1', '2', '3']);
    expect(labels(left!)).toEqual(['0', '1', '2']);
    expect(labels(corner!)).toEqual(['ft']);
  });

  it('follows the view as it pans and the pointer as it moves', () => {
    const { rulers, paint, hover } = painted();
    paint(VIEW);
    const { container } = render(<Rulers rulers={rulers} />);
    act(() => paint({ ...VIEW, x: 12 }));
    expect(labels(container.querySelector('svg')!)[0]).toBe('1');
    expect(container.querySelector('line[x1="5.5"]')).toBeNull();
    act(() => hover({ x: 12.5, y: 3 }));
    expect(container.querySelector('svg line[x1="5.5"]')).not.toBeNull();
  });
});
