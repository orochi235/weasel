import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useState } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { fraction, percent, tag, type Tagged } from '@weasel-js/quantity';
import { BandEditor } from './BandEditor';
import type { Band } from './bands';

const MIN = 0;
const MAX = 100;
/** Every element reports this rect, so client x 0…400 maps onto unit 0…1. */
const TRACK_WIDTH = 400;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 40,
      width: TRACK_WIDTH, height: 40, toJSON: () => {},
    } as DOMRect;
  };
});

function bands(): Band<string>[] {
  return [
    { from: 0, data: 'a' },
    { from: 20, data: 'b' },
    { from: 60, data: 'c' },
  ];
}

function froms<T>(next: Band<T>[]): number[] {
  return next.map((b) => Math.round(b.from * 1e6) / 1e6);
}

function setup(overrides: Partial<Parameters<typeof BandEditor<string>>[0]> = {}) {
  const onInput = vi.fn();
  const onChange = vi.fn();
  const onSelect = vi.fn();
  const result = render(
    <BandEditor
      value={bands()}
      min={MIN}
      max={MAX}
      scale="linear"
      onInput={onInput}
      onChange={onChange}
      onSelect={onSelect}
      {...overrides}
    />,
  );
  const seams = () => [...result.container.querySelectorAll<HTMLElement>('[role="slider"]')];
  const bodies = () => [...result.container.querySelectorAll<HTMLElement>('[data-band-index]')];
  const ruler = () => result.container.querySelector<HTMLElement>('[data-band-ruler]')!;
  return { ...result, onInput, onChange, onSelect, seams, bodies, ruler };
}

/** `x` is a client coordinate; the stubbed track runs 0…400. */
function drag(el: Element, x: number, moves: number[], init: MouseEventInit = {}): void {
  fireEvent.pointerDown(el, { clientX: x, clientY: 20, button: 0, ...init });
  for (const to of moves) fireEvent.pointerMove(document, { clientX: to, clientY: 20, ...init });
  fireEvent.pointerUp(document, { clientX: moves.at(-1) ?? x, clientY: 20 });
}

describe('BandEditor rendering', () => {
  it('draws one body per band and one seam between each pair', () => {
    const { seams, bodies } = setup();
    expect(bodies()).toHaveLength(3);
    expect(seams()).toHaveLength(2);
    expect(seams().map((s) => s.getAttribute('aria-valuenow'))).toEqual(['20', '60']);
  });

  it('normalizes the first band to min on read', () => {
    const { bodies } = setup({ value: [{ from: 42, data: 'a' }, { from: 60, data: 'b' }] });
    expect(bodies()[0].style.getPropertyValue('--be-from')).toBe('0%');
  });

  it('renders each payload through renderBand', () => {
    const { getByText } = setup({ renderBand: (band) => <span>{band.data.toUpperCase()}</span> });
    expect(getByText('A')).toBeInTheDocument();
    expect(getByText('C')).toBeInTheDocument();
  });

  it('positions bands and seams through the scale', () => {
    const { bodies, seams } = setup();
    expect(bodies()[1].style.getPropertyValue('--be-from')).toBe('20%');
    expect(bodies()[1].style.getPropertyValue('--be-to')).toBe('60%');
    expect(seams()[0].style.getPropertyValue('--be-at')).toBe('20%');
  });
});

describe('drag in flight', () => {
  const ghosts = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-band-ghost]')];

  it('moves a dragged seam with the pointer when no onInput is wired, and leaves a ghost where it started', () => {
    const { container, seams } = setup({ onInput: undefined });
    fireEvent.pointerDown(seams()[0], { clientX: 80, clientY: 20, button: 0 });
    fireEvent.pointerMove(document, { clientX: 160, clientY: 20 });
    expect(seams()[0].style.getPropertyValue('--be-at')).toBe('40%');
    expect(ghosts(container).map((g) => g.style.getPropertyValue('--be-at'))).toEqual(['20%']);
    fireEvent.pointerUp(document, { clientX: 160, clientY: 20 });
    expect(ghosts(container)).toHaveLength(0);
  });

  it('moves a dragged band body with the pointer and ghosts its starting span', () => {
    const { container, bodies } = setup({ onInput: undefined });
    fireEvent.pointerDown(bodies()[1], { clientX: 120, clientY: 20, button: 0 });
    fireEvent.pointerMove(document, { clientX: 140, clientY: 20 });
    expect(bodies()[1].style.getPropertyValue('--be-from')).toBe('25%');
    const [ghost] = ghosts(container);
    expect(ghost?.style.getPropertyValue('--be-from')).toBe('20%');
    expect(ghost?.style.getPropertyValue('--be-to')).toBe('60%');
    fireEvent.pointerUp(document, { clientX: 140, clientY: 20 });
    expect(ghosts(container)).toHaveLength(0);
  });

  it('shows no ghost before the pointer moves', () => {
    const { container, seams } = setup();
    fireEvent.pointerDown(seams()[0], { clientX: 80, clientY: 20, button: 0 });
    expect(ghosts(container)).toHaveLength(0);
    fireEvent.pointerUp(document, { clientX: 80, clientY: 20 });
  });
});

describe('seam drag', () => {
  it('previews on every move and commits once at the end', () => {
    const { seams, onInput, onChange } = setup();
    drag(seams()[0], 80, [120, 160]);
    expect(onInput).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(froms(onInput.mock.calls[0][0])).toEqual([0, 30, 60]);
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 40, 60]);
  });

  it('does not commit a gesture that never moved', () => {
    const { seams, onChange } = setup();
    fireEvent.pointerDown(seams()[0], { clientX: 80, clientY: 20, button: 0 });
    fireEvent.pointerUp(document, { clientX: 80, clientY: 20 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops at the neighbouring seam instead of crossing it', () => {
    const { seams, onChange } = setup();
    drag(seams()[0], 80, [390]);
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 60, 60]);
  });

  it('stops at min rather than running off the left end', () => {
    const { seams, onChange } = setup();
    drag(seams()[0], 80, [-500]);
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 0, 60]);
  });

  it('keeps the band count through a drag that would have crossed', () => {
    const { seams, onChange } = setup();
    drag(seams()[1], 240, [10]);
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(3);
    expect(froms(next)).toEqual([0, 20, 20]);
  });

  it('snaps a seam to a nearby tick, and alt defeats it', () => {
    const ticks = [{ at: 25 }];
    const near = setup({ ticks });
    // 104px is unit .26 — 4px from the tick at .25, inside the 6px radius.
    drag(near.seams()[0], 80, [104]);
    expect(froms(near.onChange.mock.calls[0][0])).toEqual([0, 25, 60]);

    const alt = setup({ ticks });
    drag(alt.seams()[0], 80, [104], { altKey: true });
    expect(froms(alt.onChange.mock.calls[0][0])).toEqual([0, 26, 60]);

    const off = setup({ ticks, snap: false });
    drag(off.seams()[0], 80, [104]);
    expect(froms(off.onChange.mock.calls[0][0])).toEqual([0, 26, 60]);
  });
});

describe('seam drag teardown', () => {
  it('pointercancel ends the drag — later moves no longer track the seam', () => {
    const { seams, onInput, onChange } = setup();
    fireEvent.pointerDown(seams()[0], { clientX: 80, clientY: 20, button: 0 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 20 });
    expect(onInput).toHaveBeenCalledTimes(1);
    fireEvent.pointerCancel(document, {});
    fireEvent.pointerMove(document, { clientX: 300, clientY: 20 });
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('unmounting mid-drag detaches the document listeners', () => {
    const { seams, unmount } = setup();
    fireEvent.pointerDown(seams()[0], { clientX: 80, clientY: 20, button: 0 });
    const remove = vi.spyOn(document, 'removeEventListener');
    unmount();
    const removed = remove.mock.calls.map((c) => c[0]);
    expect(removed).toContain('pointermove');
    expect(removed).toContain('pointerup');
    remove.mockRestore();
  });
});

describe('band body drag', () => {
  it('moves both seams, preserving the band span', () => {
    const { bodies, onChange } = setup();
    drag(bodies()[1], 100, [140]);
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 30, 70]);
  });

  it('lets a neighbour absorb the move but never disappear entirely', () => {
    const { bodies, onChange } = setup();
    drag(bodies()[1], 100, [-800]);
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 0, 40]);
  });

  it('does nothing when the first band is dragged — its left edge is min', () => {
    const { bodies, onInput, onChange } = setup();
    drag(bodies()[0], 40, [200]);
    expect(onInput).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing when the last band is dragged — its right edge is max', () => {
    const { bodies, onChange } = setup();
    drag(bodies()[2], 300, [200]);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('split', () => {
  it('splits the band under the pointer when the ruler is clicked', () => {
    const { ruler, onChange } = setup();
    fireEvent.pointerDown(ruler(), { clientX: 40, clientY: 5, button: 0 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(4);
    expect(froms(next)).toEqual([0, 10, 20, 60]);
  });

  it('duplicates the split band payload by default', () => {
    const { ruler, onChange } = setup();
    fireEvent.pointerDown(ruler(), { clientX: 160, clientY: 5, button: 0 });
    expect(onChange.mock.calls[0][0].map((b: Band<string>) => b.data)).toEqual(['a', 'b', 'b', 'c']);
  });

  it('mints the new payload through splitBand when given one', () => {
    const { ruler, onChange } = setup({ splitBand: (at, from) => `${from}${at}` });
    fireEvent.pointerDown(ruler(), { clientX: 40, clientY: 5, button: 0 });
    expect(onChange.mock.calls[0][0].map((b: Band<string>) => b.data)).toEqual(['a', 'a10', 'b', 'c']);
  });
});

describe('selection', () => {
  it('selects the band that was clicked', () => {
    const { bodies, onSelect } = setup();
    fireEvent.pointerDown(bodies()[2], { clientX: 300, clientY: 20, button: 0 });
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('follows focus, so a band reached by keyboard is the one x acts on', () => {
    const { bodies, onSelect } = setup();
    fireEvent.focus(bodies()[1]);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('marks the selected band pressed', () => {
    const { bodies } = setup({ selectedIndex: 1 });
    expect(bodies().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('does not re-announce a selection that is already current', () => {
    const { bodies, onSelect } = setup({ selectedIndex: 1 });
    fireEvent.pointerDown(bodies()[1], { clientX: 160, clientY: 20, button: 0 });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('keyboard', () => {
  it('steps a focused seam by one percent of the track, ten with shift', () => {
    const { seams, onChange } = setup();
    fireEvent.keyDown(seams()[0], { key: 'ArrowRight' });
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 21, 60]);

    fireEvent.keyDown(seams()[0], { key: 'ArrowRight', shiftKey: true });
    expect(froms(onChange.mock.calls[1][0])).toEqual([0, 30, 60]);

    fireEvent.keyDown(seams()[0], { key: 'ArrowLeft', shiftKey: true });
    expect(froms(onChange.mock.calls[2][0])).toEqual([0, 10, 60]);
  });

  it('clamps a stepped seam at its neighbour', () => {
    const { seams, onChange } = setup({
      value: [{ from: 0, data: 'a' }, { from: 20, data: 'b' }, { from: 95, data: 'c' }],
    });
    fireEvent.keyDown(seams()[1], { key: 'ArrowRight', shiftKey: true });
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 20, 100]);
  });

  it('emits nothing for a seam already against its bound', () => {
    const { seams, onChange } = setup({ value: [{ from: 0, data: 'a' }, { from: 0, data: 'b' }] });
    fireEvent.keyDown(seams()[0], { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('merges the selected band into its left neighbour on Delete and on x', () => {
    for (const key of ['Delete', 'x']) {
      const { bodies, onChange, onSelect } = setup({ selectedIndex: 2 });
      fireEvent.keyDown(bodies()[2], { key });
      const next = onChange.mock.calls[0][0];
      expect(next).toHaveLength(2);
      expect(next.map((b: Band<string>) => b.data)).toEqual(['a', 'b']);
      expect(onSelect).toHaveBeenCalledWith(1);
    }
  });

  it('leaves the merge key alone when it belongs to a control inside a band', () => {
    const { container, onChange } = setup({
      selectedIndex: 2,
      renderBand: (band: Band<string>) => <input readOnly defaultValue={band.data} />,
    });
    const input = container.querySelector('input')!;
    fireEvent.keyDown(input, { key: 'x' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves Cmd/Ctrl+X alone so cut still reaches the platform', () => {
    const { bodies, onChange } = setup({ selectedIndex: 2 });
    fireEvent.keyDown(bodies()[2], { key: 'x', metaKey: true });
    fireEvent.keyDown(bodies()[2], { key: 'x', ctrlKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Home and End send a focused seam to its bounds', () => {
    const { seams, onChange } = setup();
    fireEvent.keyDown(seams()[0], { key: 'End' });
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 60, 60]);
    fireEvent.keyDown(seams()[1], { key: 'Home' });
    expect(froms(onChange.mock.calls[1][0])).toEqual([0, 20, 20]);
  });

  it('refuses to merge the first band away', () => {
    const { bodies, onChange } = setup({ selectedIndex: 0 });
    fireEvent.keyDown(bodies()[0], { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing when no band is selected', () => {
    const { bodies, onChange } = setup({ selectedIndex: null });
    fireEvent.keyDown(bodies()[1], { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('puts bands and seams in left-to-right tab order', () => {
    const { container } = setup();
    const stops = [...container.querySelectorAll<HTMLElement>('[data-band-index], [role="slider"]')];
    expect(stops.map((el) => el.getAttribute('aria-label'))).toEqual([
      'Band 1', 'Seam 1', 'Band 2', 'Seam 2', 'Band 3',
    ]);
    expect(stops.every((el) => el.tabIndex >= 0)).toBe(true);
  });
});

describe('log scale', () => {
  const LOG_MIN = 1 / 64;
  const LOG_MAX = 1 / 2;

  it('is the default, and puts the geometric midpoint at the middle of the track', () => {
    const { container } = render(
      <BandEditor
        value={[{ from: LOG_MIN, data: 'a' }, { from: 1 / 8, data: 'b' }]}
        min={LOG_MIN}
        max={LOG_MAX}
        onChange={() => {}}
      />,
    );
    const seam = container.querySelector<HTMLElement>('[role="slider"]')!;
    expect(seam.style.getPropertyValue('--be-at')).toBe('60%');
  });

  it('falls back to a linear scale rather than NaN positions when min is not positive', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(
      <BandEditor
        value={[{ from: 0, data: 'a' }, { from: 25, data: 'b' }]}
        min={0}
        max={100}
        onChange={() => {}}
      />,
    );
    expect(container.querySelector<HTMLElement>('[role="slider"]')!.style.getPropertyValue('--be-at')).toBe('25%');
    warn.mockRestore();
  });
});

describe('controlled round trip', () => {
  function Harness() {
    const [value, setValue] = useState<Band<string>[]>(bands());
    const [selected, setSelected] = useState<number | null>(null);
    return (
      <BandEditor
        value={value}
        min={MIN}
        max={MAX}
        scale="linear"
        onChange={setValue}
        selectedIndex={selected}
        onSelect={setSelected}
        renderBand={(band) => <span>{band.data}</span>}
      />
    );
  }

  it('splits, then merges the split band back away', () => {
    const { container } = render(<Harness />);
    const ruler = container.querySelector<HTMLElement>('[data-band-ruler]')!;
    fireEvent.pointerDown(ruler, { clientX: 40, clientY: 5, button: 0 });
    expect(container.querySelectorAll('[data-band-index]')).toHaveLength(4);

    const added = container.querySelectorAll<HTMLElement>('[data-band-index]')[1];
    fireEvent.focus(added);
    fireEvent.keyDown(added, { key: 'x' });
    expect(container.querySelectorAll('[data-band-index]')).toHaveLength(3);
    expect(
      [...container.querySelectorAll<HTMLElement>('[role="slider"]')].map((s) =>
        s.getAttribute('aria-valuenow'),
      ),
    ).toEqual(['20', '60']);
  });
});

describe('seam drag pointer session', () => {
  it('commits a release that lands outside the editor', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const { seams, onChange } = setup();
    fireEvent.pointerDown(seams()[0], { clientX: 80, clientY: 20, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 160, clientY: 20, buttons: 1 });
    fireEvent.pointerUp(outside, { clientX: 900, clientY: 900, bubbles: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 40, 60]);
    outside.remove();
  });

  // Chrome releases capture a beat before it delivers pointerup, so ending the
  // gesture here throws away a release that has already been dispatched. The
  // other half of the rule — a detached origin does cancel — is owned by
  // pointerSession.test.ts.
  it('keeps dragging when capture is lost and the seam is still in the document', () => {
    const { seams, onInput } = setup();
    const seam = seams()[0];
    fireEvent.pointerDown(seam, { clientX: 80, clientY: 20, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 20, buttons: 1 });
    expect(onInput).toHaveBeenCalledTimes(1);
    fireEvent(seam, new PointerEvent('lostpointercapture', { pointerId: 0, bubbles: true }));
    fireEvent.pointerMove(document, { clientX: 160, clientY: 20, buttons: 1 });
    expect(onInput).toHaveBeenCalledTimes(2);
  });

  it('treats a move with no button held as the release it missed', () => {
    const { seams, onInput, onChange } = setup();
    fireEvent.pointerDown(seams()[0], { clientX: 80, clientY: 20, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 160, clientY: 20, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 20, buttons: 0 });
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 40, 60]);
  });

  it('ends a band-body drag on the release it missed', () => {
    const { bodies, onChange } = setup();
    fireEvent.pointerDown(bodies()[1], { clientX: 100, clientY: 20, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 140, clientY: 20, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 20, buttons: 0 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(froms(onChange.mock.calls[0][0])).toEqual([0, 30, 70]);
  });
});

// PROXY ASSERTION — see Ruler.test.tsx for why this is asserted rather than the
// browser behaviour it stands in for. A band body is a `<button>` whose content
// the consumer renders, and capture would kill the click on it.
describe('BandEditor pointer capture', () => {
  it('never captures the pointer', () => {
    const capture = vi.fn();
    Element.prototype.setPointerCapture = capture;
    const { seams } = setup();
    fireEvent.pointerDown(seams()[0], { clientX: 80, clientY: 20, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 160, clientY: 20, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 160, clientY: 20 });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('BandEditor quantities', () => {
  const tagged = (): Band<string, Tagged>[] => [
    { from: tag(1 / 64, fraction()), data: 'a' },
    { from: tag(1 / 12, fraction()), data: 'b' },
  ];

  it('speaks each seam through the display rather than as a raw float', () => {
    const { seams } = setup({
      min: 1 / 64,
      max: 1 / 2,
      value: [
        { from: 1 / 64, data: 'a' },
        { from: 1 / 12, data: 'b' },
      ],
      display: fraction(),
    });
    expect(seams()[0]!.getAttribute('aria-valuetext')).toBe('1 over 12');
  });

  it('speaks a seam at three decimals with no display', () => {
    const { seams } = setup({ value: [{ from: 0, data: 'a' }, { from: 100 / 3, data: 'b' }] });
    expect(seams()[0]!.getAttribute('aria-valuetext')).toBe('33.333');
  });

  it('labels an unlabeled tick through the display', () => {
    const { container } = setup({ ticks: [{ at: 25 }, { at: 50, label: 'half' }], display: percent() });
    const labels = [...container.querySelectorAll('[data-tick-at]')].map((t) => t.textContent);
    expect(labels).toEqual(['2,500%', 'half']);
  });

  it('keeps a tagged from tagged through an edit', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BandEditor<string, Tagged> value={tagged()} min={1 / 64} max={1 / 2} scale="linear" onChange={onChange} />,
    );
    const seam = container.querySelector<HTMLElement>('[role="slider"]')!;
    expect(seam.getAttribute('aria-valuetext')).toBe('1 over 12');
    fireEvent.keyDown(seam, { key: 'End' });
    const next = onChange.mock.calls[0]![0] as Band<string, Tagged>[];
    expect(next[1]!.from).toEqual({ value: 1 / 2, display: { kind: 'fraction' } });
    expect(next[0]!.from.display).toEqual({ kind: 'fraction' });
  });

  it("gives a split band its parent's tag", () => {
    const onChange = vi.fn();
    const { container } = render(
      <BandEditor<string, Tagged> value={tagged()} min={0} max={1} scale="linear" onChange={onChange} />,
    );
    fireEvent.pointerDown(container.querySelector('[data-band-ruler]')!, { clientX: 300, clientY: 20, button: 0 });
    const next = onChange.mock.calls[0]![0] as Band<string, Tagged>[];
    expect(next).toHaveLength(3);
    expect(next.every((b) => b.from.display?.kind === 'fraction')).toBe(true);
    expect(next[2]!.from.value).toBeCloseTo(0.75);
  });
});
