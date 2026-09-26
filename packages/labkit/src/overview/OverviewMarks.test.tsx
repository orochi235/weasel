/**
 * The overview draws every target's marks where that target sits on the stage,
 * and redraws when one is added. jsdom lays nothing out, so the target's rect
 * and the stage's are mocked; the stage's camera is the identity there.
 */
import { act, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useAnnotations } from '../annotations/AnnotationsContext';
import type { AnnotationsApi } from '../annotations/types';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { TrialOverview } from './TrialOverview';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;

let restore: (() => void) | null = null;
afterEach(() => restore?.());

/** Stage 400×300, the pane at stage (50, 20) and 200×100. */
function mount() {
  const pane = { current: null as HTMLDivElement | null };
  let api: AnnotationsApi | null = null;
  function Body() {
    api = useAnnotations();
    return (
      <div
        ref={(el) => {
          pane.current = el;
        }}
        data-testid="pane"
      />
    );
  }
  const marked = defineInstrument<Record<string, never>, Record<string, never>>({
    name: 'Marked',
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: () => <Body />,
    stage: {
      size: { width: 400, height: 300 },
      overlay: () => <TrialOverview width={200} height={150} render={() => <div />} />,
    },
    annotations: {
      targets: () => [{ id: 'pane', ref: pane, content: { w: 200, h: 100 } }],
    },
  });
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this === pane.current) return rect(50, 20, 200, 100);
    return rect(0, 0, 0, 0);
  };
  restore = () => {
    HTMLElement.prototype.getBoundingClientRect = original;
  };
  const r = render(<Lab instruments={[marked]} defaultInstrument="Marked" />);
  return { ...r, api: () => api as AnnotationsApi };
}

const px = (el: HTMLElement, name: string) => Number.parseFloat(el.style.getPropertyValue(name));

describe('marks on the overview', () => {
  it('draws nothing for a target with no marks', () => {
    const h = mount();
    expect(h.container.querySelector('.lk-overview__marks')).toBeNull();
  });

  it("places a target's marks at the target's rect, through the fit", () => {
    const h = mount();
    act(() => {
      h.api().add({ target: 'pane', kind: 'rect', frac: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } });
    });
    const marks = h.container.querySelector<HTMLElement>('.lk-overview__marks[data-target="pane"]');
    expect(marks).not.toBeNull();
    if (!marks) return;
    // Content 400×300 into 200×150, 6px in: scale 0.46, camera at
    // (200 - 100 / 0.46, 150 - 75 / 0.46).
    const s = 0.46;
    expect(px(marks, '--lk-overview-mx')).toBeCloseTo((50 - (200 - 100 / s)) * s);
    expect(px(marks, '--lk-overview-my')).toBeCloseTo((20 - (150 - 75 / s)) * s);
    expect(px(marks, '--lk-overview-mw')).toBeCloseTo(200 * s);
    expect(px(marks, '--lk-overview-mh')).toBeCloseTo(100 * s);
    expect(marks.querySelector('svg path')).not.toBeNull();
  });
});
