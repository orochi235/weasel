import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GradientPaint, Paint } from '@weasel-js/core';
import { stubRect } from '../Slider/testing/stubRect';
import { GradientEditor, type GradientEditorProps } from './GradientEditor';

const THREE: GradientPaint = {
  kind: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 100, y: 0 },
  stops: [
    { offset: 0, color: '#ff0000ff' },
    { offset: 0.5, color: '#00ff0080' },
    { offset: 1, color: '#0000ffff' },
  ],
  units: 'local',
};

const TWO: GradientPaint = { ...THREE, stops: [THREE.stops[0], THREE.stops[2]] };

/** The editor holding its own value, the way an app does, with every commit recorded. */
function Live(props: Partial<GradientEditorProps> & { initial: GradientPaint; commits?: (next: Paint) => void }) {
  const { initial, commits, ...rest } = props;
  const [value, setValue] = useState<Paint>(initial);
  return (
    <GradientEditor
      {...rest}
      value={value}
      onInput={setValue}
      onChange={(next) => { setValue(next); commits?.(next); }}
    />
  );
}

const handles = () => screen.getAllByRole('slider', { name: /^Gradient stop/ });
const handle = (place: number) => screen.getByRole('slider', { name: `Gradient stop ${place}` });
const colorInputs = () => document.querySelectorAll('input[type="color"]');
const stopsOf = (fn: ReturnType<typeof vi.fn>) => (fn.mock.calls.at(-1)![0] as GradientPaint).stops;

describe('GradientEditor stops', () => {
  it('draws one handle per stop, each showing its own color, and one editor', () => {
    render(<GradientEditor value={THREE} onChange={() => {}} />);
    expect(handles()).toHaveLength(3);
    expect(handles().map((h) => h.querySelector<HTMLElement>('[data-stop]')!.style.getPropertyValue('--stop')))
      .toEqual(['#ff0000ff', '#00ff0080', '#0000ffff']);
    expect(handles().map((h) => h.getAttribute('aria-valuetext'))).toEqual(['0%', '50%', '100%']);
    expect(colorInputs()).toHaveLength(1);
  });

  it('starts on the first stop along the gradient', () => {
    render(<GradientEditor value={{ ...THREE, stops: [...THREE.stops].reverse() }} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Stop 1 of 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Stop 1')).toHaveValue('#ff0000');
    expect(handle(1).querySelector('[data-stop]')).toHaveAttribute('data-selected');
    expect(handle(2).querySelector('[data-stop]')).not.toHaveAttribute('data-selected');
  });

  it('selects the stop whose handle takes focus', () => {
    render(<GradientEditor value={THREE} onChange={() => {}} />);
    fireEvent.focus(handle(2));
    expect(screen.getByRole('group', { name: 'Stop 2 of 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Stop 2')).toHaveValue('#00ff00');
    expect(screen.getByLabelText('Stop 2 opacity')).toHaveValue('50');
    expect(handle(2).querySelector('[data-stop]')).toHaveAttribute('data-selected');
    expect(colorInputs()).toHaveLength(1);
  });

  it('recolors the selected stop and leaves its opacity alone', () => {
    const onChange = vi.fn();
    render(<GradientEditor value={THREE} onChange={onChange} />);
    fireEvent.focus(handle(2));
    const color = screen.getByLabelText('Stop 2');
    fireEvent.input(color, { target: { value: '#112233' } });
    fireEvent.blur(color);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(stopsOf(onChange)).toEqual([THREE.stops[0], { offset: 0.5, color: '#11223380' }, THREE.stops[2]]);
  });

  it('previews an opacity scrub and commits it once on release', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<GradientEditor value={THREE} onInput={onInput} onChange={onChange} />);
    const opacity = screen.getByLabelText('Stop 1 opacity');
    fireEvent.input(opacity, { target: { value: '25' } });
    expect(stopsOf(onInput)[0]).toEqual({ offset: 0, color: '#ff000040' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(opacity);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(stopsOf(onChange)[0]).toEqual({ offset: 0, color: '#ff000040' });
  });

  it('moves the selected stop to a position typed as a percentage', () => {
    const onChange = vi.fn();
    render(<GradientEditor value={THREE} onChange={onChange} />);
    fireEvent.focus(handle(2));
    const position = screen.getByLabelText('Stop 2 position');
    expect(position).toHaveValue('50%');
    fireEvent.change(position, { target: { value: '20' } });
    fireEvent.blur(position);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(stopsOf(onChange)[1]).toEqual({ offset: 0.2, color: '#00ff0080' });
  });

  it('writes nothing when the position field is left as it was', () => {
    const onChange = vi.fn();
    const third: GradientPaint = { ...TWO, stops: [{ offset: 1 / 3, color: '#ff0000ff' }, TWO.stops[1]] };
    render(<GradientEditor value={third} onChange={onChange} />);
    const position = screen.getByLabelText('Stop 1 position');
    fireEvent.focus(position);
    fireEvent.blur(position);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves a focused handle with the arrow keys', () => {
    const onChange = vi.fn();
    render(<GradientEditor value={THREE} onChange={onChange} />);
    fireEvent.keyDown(handle(2), { key: 'ArrowRight' });
    expect(stopsOf(onChange)[1].offset).toBeCloseTo(0.505);
    fireEvent.keyDown(handle(2), { key: 'ArrowLeft', shiftKey: true });
    expect(stopsOf(onChange)[1].offset).toBeCloseTo(0.45);
  });

  it('keeps the selection on a stop that is moved past its neighbor', () => {
    render(<Live initial={THREE} />);
    const position = screen.getByLabelText('Stop 1 position');
    fireEvent.change(position, { target: { value: '75' } });
    fireEvent.blur(position);
    // Red was first and is second now; it is still the stop being edited.
    expect(screen.getByLabelText('Stop 2')).toHaveValue('#ff0000');
    expect(screen.getByLabelText('Stop 2 position')).toHaveValue('75%');
  });

  describe('removing', () => {
    it('removes the focused stop on Delete and selects its neighbor', () => {
      const commits = vi.fn();
      render(<Live initial={THREE} commits={commits} />);
      fireEvent.focus(handle(2));
      fireEvent.keyDown(handle(2), { key: 'Delete' });
      expect(commits).toHaveBeenCalledTimes(1);
      expect(stopsOf(commits)).toEqual(TWO.stops);
      expect(screen.getByRole('group', { name: 'Stop 1 of 2' })).toBeInTheDocument();
      expect(document.activeElement).toBe(handle(1));
    });

    it('removes on Backspace too', () => {
      const commits = vi.fn();
      render(<Live initial={THREE} commits={commits} />);
      fireEvent.keyDown(handle(3), { key: 'Backspace' });
      expect(stopsOf(commits)).toEqual([THREE.stops[0], THREE.stops[1]]);
    });

    it('removes the selected stop from the editor', () => {
      const commits = vi.fn();
      render(<Live initial={THREE} commits={commits} />);
      fireEvent.focus(handle(3));
      fireEvent.click(screen.getByRole('button', { name: 'Remove stop 3' }));
      expect(stopsOf(commits)).toEqual([THREE.stops[0], THREE.stops[1]]);
      expect(screen.getByRole('group', { name: 'Stop 2 of 2' })).toBeInTheDocument();
      // The button is disabled now, so focus goes to the handle rather than to the page.
      expect(document.activeElement).toBe(handle(2));
    });

    it('keeps the last two stops', () => {
      const onChange = vi.fn();
      render(<GradientEditor value={TWO} onChange={onChange} />);
      expect(screen.getByRole('button', { name: 'Remove stop 1' })).toBeDisabled();
      fireEvent.keyDown(handle(1), { key: 'Delete' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('follows a stop the track removed', () => {
      render(<Live initial={THREE} />);
      fireEvent.focus(handle(3));
      fireEvent.contextMenu(handle(1));
      // The blue stop was third and selected; it is second now, and still the one edited.
      expect(screen.getByLabelText('Stop 2')).toHaveValue('#0000ff');
    });
  });

  it('adds a stop where the track is pressed, in the color there, and selects it', () => {
    const commits = vi.fn();
    render(<Live initial={TWO} commits={commits} />);
    const rail = document.querySelector<HTMLElement>('[data-slider-rail]')!;
    stubRect(rail, { left: 0, width: 200 });
    fireEvent.pointerDown(rail.parentElement!, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    expect(stopsOf(commits)).toHaveLength(3);
    expect(stopsOf(commits)[2].offset).toBeCloseTo(0.5);
    expect(screen.getByRole('group', { name: 'Stop 2 of 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Stop 2')).toHaveValue(stopsOf(commits)[2].color.slice(0, 7));
    expect(document.activeElement).toBe(handle(2));
  });

  describe('a selection the caller owns', () => {
    it('edits the stop it is given, by its index in `stops`', () => {
      render(<GradientEditor value={THREE} selectedStop={2} onChange={() => {}} />);
      expect(screen.getByLabelText('Stop 3')).toHaveValue('#0000ff');
    });

    it('reports a pick and waits to be told', () => {
      const onSelectedStopChange = vi.fn();
      render(<GradientEditor value={THREE} selectedStop={0} onSelectedStopChange={onSelectedStopChange} onChange={() => {}} />);
      fireEvent.focus(handle(2));
      expect(onSelectedStopChange).toHaveBeenCalledWith(1);
      expect(screen.getByLabelText('Stop 1')).toBeInTheDocument();
    });
  });

  describe('disabled', () => {
    it('takes the whole editor out of reach and says so', () => {
      const { container } = render(<GradientEditor value={THREE} disabled onChange={() => {}} />);
      const root = container.firstElementChild!;
      expect(root).toHaveAttribute('aria-disabled', 'true');
      expect(root.querySelector('[inert]')).toContainElement(document.querySelector<HTMLElement>('[data-slider-rail]'));
      expect(root.querySelector('[inert]')).toContainElement(document.querySelector<HTMLElement>('input[type="color"]'));
    });

    it('is not inert otherwise', () => {
      const { container } = render(<GradientEditor value={THREE} onChange={() => {}} />);
      expect(container.querySelector('[inert]')).toBeNull();
      expect(container.firstElementChild).not.toHaveAttribute('aria-disabled');
    });
  });
});
