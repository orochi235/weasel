import { describe, it, expect, vi } from 'vitest';
import { act, render, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Disabled, ReadOnly } from '../Disabled';
import { Slider } from './Slider';
import { useDetents } from './useDetents';
import { stubRect } from './testing/stubRect';
import type { SliderProps } from './types';

function renderHeld(wrap: (node: ReactNode) => ReactNode, props: Partial<SliderProps> = {}) {
  const onInput = vi.fn();
  const onChange = vi.fn();
  const view = render(
    <>{wrap(<Slider aria-label="Level" min={0} max={100} thumbs={[{ value: 10 }]} onInput={onInput} onChange={onChange} {...props} />)}</>,
  );
  const thumb = screen.getByRole('slider');
  const track = thumb.parentElement as HTMLElement;
  stubRect(track, { left: 0, width: 200 });
  return { ...view, thumb, track, onInput, onChange };
}

const drag = ({ thumb }: ReturnType<typeof renderHeld>) => {
  fireEvent.pointerDown(thumb, { clientX: 20, clientY: 12, button: 0 });
  fireEvent.pointerMove(document, { clientX: 120, clientY: 12 });
  fireEvent.pointerUp(document, { clientX: 120, clientY: 12 });
};
const step = ({ thumb }: ReturnType<typeof renderHeld>) => fireEvent.keyDown(thumb, { key: 'ArrowRight' });
const press = ({ track }: ReturnType<typeof renderHeld>) => {
  fireEvent.pointerDown(track, { clientX: 150, clientY: 12, button: 0 });
  fireEvent.pointerUp(document, { clientX: 150, clientY: 12 });
};
const INPUTS = { drag, step, press };

/** A drag from the thumb, an arrow key, and a press on bare track: none of them may reach the slider's callbacks. */
function expectRefusesEverything(held: ReturnType<typeof renderHeld>) {
  for (const input of Object.values(INPUTS)) input(held);
  expect(held.onInput).not.toHaveBeenCalled();
  expect(held.onChange).not.toHaveBeenCalled();
}

describe('Slider held', () => {
  // Each input the held cases refuse does reach an unheld slider, so their silence is the hold's doing.
  it.each(Object.entries(INPUTS))('an unheld slider takes a %s', (_, input) => {
    const free = renderHeld((n) => n);
    input(free);
    expect(free.onInput).toHaveBeenCalled();
    expect(free.onChange).toHaveBeenCalled();
    expect(free.thumb.getAttribute('tabindex')).toBe('0');
    expect(free.thumb.hasAttribute('aria-disabled')).toBe(false);
  });

  it('disabled with no reason refuses everything and leaves the tab order', () => {
    const held = renderHeld((n) => n, { disabled: true });
    expectRefusesEverything(held);
    expect(held.thumb.getAttribute('tabindex')).toBe('-1');
    expect(held.thumb.getAttribute('aria-disabled')).toBe('true');
    expect(held.thumb.hasAttribute('aria-describedby')).toBe(false);
  });

  it('disabled for a reason refuses everything, stays focusable, and says why', () => {
    const held = renderHeld((n) => n, { disabled: true, disabledReason: 'Nothing selected' });
    expectRefusesEverything(held);
    expect(held.thumb.getAttribute('tabindex')).toBe('0');
    expect(held.thumb.getAttribute('aria-disabled')).toBe('true');
    expect(held.thumb).toHaveAccessibleDescription('Nothing selected');
    act(() => held.thumb.focus());
    expect(screen.getByRole('tooltip').textContent).toBe('Nothing selected');
  });

  it('read-only refuses everything and stays focusable', () => {
    const held = renderHeld((n) => <ReadOnly reason="Shared">{n}</ReadOnly>);
    expectRefusesEverything(held);
    expect(held.thumb.getAttribute('tabindex')).toBe('0');
    expect(held.thumb.getAttribute('aria-readonly')).toBe('true');
    expect(held.thumb).toHaveAccessibleDescription('Shared');
  });

  it('a Disabled scope reaches it, the nearest reason wins, and disabled={false} inside adds nothing', () => {
    const held = renderHeld((n) => <Disabled reason="Locked"><Disabled reason="Busy">{n}</Disabled></Disabled>, { disabled: false });
    expectRefusesEverything(held);
    expect(held.thumb).toHaveAccessibleDescription('Busy');
  });

  it('nested scopes with no reason anywhere take it out of the tab order', () => {
    const held = renderHeld((n) => <Disabled><Disabled when={false} reason="Never">{n}</Disabled></Disabled>);
    expectRefusesEverything(held);
    expect(held.thumb.getAttribute('tabindex')).toBe('-1');
  });

  it('disabled beats read-only', () => {
    const { thumb } = renderHeld((n) => <ReadOnly><Disabled>{n}</Disabled></ReadOnly>);
    expect(thumb.getAttribute('aria-disabled')).toBe('true');
    expect(thumb.hasAttribute('aria-readonly')).toBe(false);
  });

  it.each([false, true])('with disabled=%s, a region drag and a right-click removal are refused only when held', (disabled) => {
    const onInput = vi.fn();
    const onRemoveThumb = vi.fn(() => true);
    render(
      <Slider
        aria-label="Span"
        disabled={disabled}
        min={0}
        max={100}
        thumbs={[{ value: 20 }, { value: 80 }]}
        constraint="ordered"
        regionDrag
        renderRegion={() => <span>mid</span>}
        onRemoveThumb={onRemoveThumb}
        onInput={onInput}
      />,
    );
    fireEvent.contextMenu(screen.getAllByRole('slider')[0]);
    const region = screen.getAllByText('mid')[1].parentElement as HTMLElement;
    stubRect(region.parentElement as HTMLElement, { left: 0, width: 200 });
    fireEvent.pointerDown(region, { clientX: 100, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12 });
    fireEvent.pointerUp(document, { clientX: 150, clientY: 12 });
    expect(onRemoveThumb).toHaveBeenCalledTimes(disabled ? 0 : 1);
    expect(onInput.mock.calls.length > 1).toBe(!disabled);
  });

  it('holds a slider driven by useDetents', () => {
    const onInput = vi.fn();
    function Rate() {
      return <Slider aria-label="Rate" {...useDetents({ items: [0.5, 1, 2], value: 1, onInput })} />;
    }
    render(<Disabled reason="Playing"><Rate /></Disabled>);
    const thumb = screen.getByRole('slider');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onInput).not.toHaveBeenCalled();
    expect(thumb).toHaveAccessibleDescription('Playing');
  });
});
