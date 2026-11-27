import { useState, type ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import type { EventTrack, SampledTrack, Track } from '@weasel-js/animator';
import { Timeline, type KeyEditorCtx, type TimelineProps } from './Timeline';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 20,
      width: TRACK_WIDTH, height: 20, toJSON: () => {},
    } as DOMRect;
  };
});

const tracks = (): Track[] => ([
  { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }], onTick: () => {} },
  { kind: 'event', label: 'step', events: [{ t: 250, fire: () => {} }] },
] as Track[]);

const base = { duration: 1000, playhead: 0, onChange: () => {}, onSeek: () => {} };

const keysOf = (out: readonly Track[]): { t: number; value: number }[] =>
  (out[0] as SampledTrack<number>).keys.map(({ t, value }) => ({ t, value }));

describe('Timeline key drags echoed through onInput', () => {
  let setOutside: (next: Track[]) => void = () => {};
  function Echo({ onChange, onCancel, mode, renderKeyEditor }: {
    onChange?: (next: Track[]) => void;
    onCancel?: () => void;
    mode?: TimelineProps['mode'];
    renderKeyEditor?: (ctx: KeyEditorCtx) => ReactNode;
  }) {
    const [value, setValue] = useState(tracks);
    setOutside = setValue;
    return (
      <Timeline
        {...base} tracks={value} mode={mode} onInput={setValue} onCancel={onCancel} renderKeyEditor={renderKeyEditor}
        onChange={(next) => { onChange?.(next); setValue(next); }}
      />
    );
  }
  const drag = (index: number, from: number, to: number): void => {
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[index], { clientX: from, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: to, clientY: 10, altKey: true });
  };

  it('moves the dragged key, not the neighbor it was previewed past', () => {
    const onChange = vi.fn();
    renderWithIcons(<Echo onChange={onChange} />);
    drag(0, 0, 350);
    fireEvent.pointerUp(document, { clientX: 350, clientY: 10, altKey: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(keysOf(onChange.mock.calls[0][0])).toEqual([{ t: 500, value: 10 }, { t: 700, value: 0 }]);
  });

  it('commits a drag whose last preview already showed where it lands', () => {
    const onChange = vi.fn();
    renderWithIcons(<Echo onChange={onChange} />);
    drag(1, 250, 300);
    fireEvent.pointerUp(document, { clientX: 300, clientY: 10, altKey: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(keysOf(onChange.mock.calls[0][0])).toEqual([{ t: 0, value: 0 }, { t: 600, value: 10 }]);
  });

  it('puts a canceled drag back where it began', () => {
    const onCancel = vi.fn();
    renderWithIcons(<Echo onCancel={onCancel} />);
    drag(1, 250, 350);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('timeline-key').map((k) => k.getAttribute('aria-label'))).toEqual(
      ['x key at 0ms', 'x key at 500ms'],
    );
  });


  it('keeps an edit made to another track while the drag was held', () => {
    const onChange = vi.fn();
    renderWithIcons(<Echo onChange={onChange} />);
    drag(1, 250, 300);
    act(() => setOutside([tracks()[0], { kind: 'event', label: 'step', events: [{ t: 400, fire: () => {} }] } as Track]));
    fireEvent.pointerMove(document, { clientX: 320, clientY: 10, altKey: true });
    fireEvent.pointerUp(document, { clientX: 320, clientY: 10, altKey: true });
    const out = onChange.mock.calls[0][0] as Track[];
    expect(keysOf(out)).toEqual([{ t: 0, value: 0 }, { t: 640, value: 10 }]);
    expect((out[1] as EventTrack).events.map((e) => e.t)).toEqual([400]);
  });

  it('keeps the key editor on a graphed key while its preview re-sorts it past a neighbor', () => {
    const editor = ({ key }: KeyEditorCtx) => <span data-testid="edited">{key.t}</span>;
    renderWithIcons(<Echo mode="graph" renderKeyEditor={editor} />);
    const graphKey = (i: number) => document.querySelectorAll('[data-keyframe-index]')[i];
    fireEvent.pointerDown(graphKey(0), { clientX: 0, clientY: 18.4, button: 0 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 18.4, altKey: true });
    expect(screen.getByTestId('edited')).toHaveTextContent('700');
    fireEvent.pointerUp(document, { clientX: 350, clientY: 18.4, altKey: true });
    expect(screen.getByTestId('edited')).toHaveTextContent('700');
  });
});

describe('Timeline Delete on a lane away from its keys', () => {
  it('deletes nothing from a focused segment while a key on another row is selected', () => {
    const two = (): Track[] => [tracks()[0], { ...tracks()[0], label: 'y' } as Track];
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={two()} selection={{ trackPath: [0], keyIndex: 1 }} onChange={onChange} />);
    const segment = screen.getAllByTestId('timeline-segment')[1];
    segment.focus();
    fireEvent.keyDown(segment, { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Timeline ruler under a window held by the consumer', () => {
  it('leaves the wheel to the page when nothing hears the window change', () => {
    renderWithIcons(<Timeline {...base} tracks={tracks()} window={{ from: 0, to: 500 }} />);
    expect(fireEvent.wheel(screen.getByTestId('timeline-ruler'), { deltaY: 100, clientX: 250 })).toBe(true);
  });

  it('still takes the wheel for a window the consumer hears', () => {
    const onWindowChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} window={{ from: 0, to: 500 }} onWindowChange={onWindowChange} />);
    expect(fireEvent.wheel(screen.getByTestId('timeline-ruler'), { deltaY: 100, clientX: 250 })).toBe(false);
    expect(onWindowChange).toHaveBeenCalledTimes(1);
  });
});
