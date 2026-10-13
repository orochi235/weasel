import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Slider } from './Slider';

describe('Slider rendering', () => {
  it('renders one thumb per item with left% mapped from value', () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0 }, { value: 0.5 }, { value: 1 }]}
        onInput={() => {}}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].style.left).toBe('0%');
    expect(thumbs[1].style.left).toBe('50%');
    expect(thumbs[2].style.left).toBe('100%');
  });
});

describe('Slider renderTrack', () => {
  it('invokes renderTrack with a TrackCtx and renders its output behind thumbs', () => {
    const renderTrack = vi.fn((_ctx: { trackWidth: number; valueToFraction: (v: number) => number }) => <div data-testid="custom-track">painted</div>);
    const { getByTestId } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onInput={() => {}}
        renderTrack={renderTrack}
      />,
    );
    expect(renderTrack).toHaveBeenCalled();
    const arg = renderTrack.mock.calls[0]![0];
    expect(typeof arg.valueToFraction).toBe('function');
    expect(arg.valueToFraction(0.5)).toBeCloseTo(0.5, 5);
    expect(getByTestId('custom-track')).toBeTruthy();
  });
});

describe('Slider thumb shape variants', () => {
  it('shape="notched" renders the notched class', () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5, shape: 'notched' }]}
        onInput={() => {}}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.className).toContain('notched');
  });

  it('shape={ render } uses the custom render', () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5, shape: { render: () => <span data-testid="x">X</span> } }]}
        onInput={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="x"]')).toBeTruthy();
  });
});

describe('Slider readouts', () => {
  it("'inline-after' renders one entry per thumb after the track", () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.123 }, { value: 0.456 }]}
        readoutPlacement="inline-after"
        onInput={() => {}}
      />,
    );
    const inline = container.querySelector('[data-readout="inline"]')!;
    expect(inline.textContent).toContain('0.123');
    expect(inline.textContent).toContain('0.456');
  });

  it("'below-thumb' renders one absolutely-positioned readout per thumb", () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.25 }, { value: 0.75 }]}
        readoutPlacement="below-thumb"
        onInput={() => {}}
      />,
    );
    const readouts = container.querySelectorAll<HTMLElement>('[data-readout="below"]');
    expect(readouts).toHaveLength(2);
    expect(readouts[0].style.left).toBe('25%');
    expect(readouts[1].style.left).toBe('75%');
  });

  it('renderReadout overrides default formatting', () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        readoutPlacement="inline-after"
        renderReadout={(t) => `[${t.value}]`}
        onInput={() => {}}
      />,
    );
    expect(container.querySelector('[data-readout="inline"]')!.textContent).toContain('[0.5]');
  });
});

describe('Slider value text', () => {
  it('publishes a thumb valueText as aria-valuetext', () => {
    const { container } = render(
      <Slider min={0} max={4} thumbs={[{ value: 2, valueText: '1x' }]} onInput={() => {}} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-valuetext')).toBe('1x');
  });

  it('leaves aria-valuetext off when a thumb has none', () => {
    const { container } = render(<Slider min={0} max={1} thumbs={[{ value: 0.5 }]} onInput={() => {}} />);
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.hasAttribute('aria-valuetext')).toBe(false);
  });
});
