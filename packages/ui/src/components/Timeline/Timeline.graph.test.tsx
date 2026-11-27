import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Keyframe, Track } from '@weasel-js/animator';
import { renderWithIcons } from '../../testing/withIcons';
import { Lane } from './Lane';
import { buildLanes } from './lanes';
import { Timeline, type TimelineProps } from './Timeline';

// Every element is 500×20 over 0..1000 ms, so t maps to x = t / 2.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 500, bottom: 20, width: 500, height: 20, toJSON: () => {} } as DOMRect;
  };
});

const sampled = (keys: Keyframe<number>[]): Track => ({ kind: 'sampled', label: 'x', keys, onTick: () => {} }) as Track;
const THREE = (): Track[] => [sampled([{ t: 0, value: 0 }, { t: 400, value: 5 }, { t: 800, value: 10 }])];
const graphKeys = () => [...document.querySelectorAll<SVGElement>('[data-keyframe-index]')];

const laneBase = {
  window: { from: 0, to: 1000 },
  mode: 'graph' as const,
  selection: null,
  onSelectionChange: () => {},
  onKeyInput: () => {},
  onKeyChange: () => {},
  onInsert: () => {},
  onExpandedChange: () => {},
  expanded: false,
  snapTimes: [] as number[],
};
const laneOf = (t: Track) => buildLanes([t], new Set())[0]!;

function Host(props: Partial<TimelineProps>) {
  const [tracks, setTracks] = useState<Track[]>(THREE);
  return (
    <Timeline
      duration={1000} playhead={0} onSeek={() => {}} mode="graph" {...props} tracks={tracks}
      onChange={(next) => { setTracks(next); props.onChange?.(next); }}
      renderKeyEditor={({ key }) => <output data-testid="inspected">{key.t}</output>}
    />
  );
}

describe('Timeline in graph mode', () => {
  it('keeps the selection on a key a drag re-sorts past its neighbor', () => {
    renderWithIcons(<Host />);
    fireEvent.pointerDown(graphKeys()[1]!, { clientX: 200, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 450, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 450, clientY: 10 });
    expect(screen.getByTestId('inspected')).toHaveTextContent('900');
  });

  it('keeps the selection on a key an arrow step re-sorts past its neighbor', () => {
    renderWithIcons(<Host />);
    const key = graphKeys()[1]!;
    act(() => key.focus());
    fireEvent.keyDown(key, { key: 'Enter' });
    for (let i = 0; i < 5; i++) fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', shiftKey: true });
    expect(screen.getByTestId('inspected')).toHaveTextContent('900');
    expect(document.activeElement).toBe(graphKeys()[2]);
  });

  it('read-only, a key and a segment still select', () => {
    const onSelectionChange = vi.fn();
    const onChange = vi.fn();
    renderWithIcons(<Host readOnly onSelectionChange={onSelectionChange} onChange={onChange} />);
    fireEvent.pointerDown(graphKeys()[1]!, { clientX: 200, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 200, clientY: 10 });
    expect(onSelectionChange).toHaveBeenLastCalledWith({ trackPath: [0], keyIndex: 1 });
    act(() => graphKeys()[2]!.focus());
    fireEvent.keyDown(graphKeys()[2]!, { key: 'Enter' });
    expect(onSelectionChange).toHaveBeenLastCalledWith({ trackPath: [0], keyIndex: 2 });
    fireEvent.pointerDown(document.querySelector('svg[role="group"]')!, { clientX: 100, clientY: 14.2, button: 0 });
    expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('read-only, a key dragged past its neighbor moves nothing and keeps its selection', () => {
    const onSelectionChange = vi.fn();
    const onChange = vi.fn();
    renderWithIcons(<Host readOnly onSelectionChange={onSelectionChange} onChange={onChange} />);
    fireEvent.pointerDown(graphKeys()[0]!, { clientX: 0, clientY: 18.4, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 18 });
    fireEvent.pointerUp(document, { clientX: 300, clientY: 18 });
    expect(onChange).not.toHaveBeenCalled();
    expect(onSelectionChange.mock.calls.map(([sel]) => sel?.keyIndex)).toEqual([0]);
  });
});

describe('Timeline Escape', () => {
  it('drops a selected segment only from the lanes or the root, not from the controls beside them', () => {
    renderWithIcons(<Host mode="dope" />);
    fireEvent.click(screen.getAllByTestId('timeline-segment')[0]!);
    expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('switch', { name: 'Graph mode' }), { key: 'Escape' });
    expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Escape' });
    expect(screen.queryByTestId('easing-preview')).toBeNull();
  });
});

describe('Timeline inspector', () => {
  it('reports no edit for a value or easing set to what the key already has', () => {
    const onChange = vi.fn();
    const eased = [sampled([{ t: 0, value: 0 }, { t: 500, value: 10, easing: { bezier: [0.4, 0, 0.2, 1] } }])];
    renderWithIcons(
      <Timeline
        tracks={eased} duration={1000} playhead={0} onSeek={() => {}} onChange={onChange}
        selection={{ trackPath: [0], keyIndex: 1 }}
        renderKeyEditor={({ key, commit, setEasing }) => (
          <>
            <button type="button" onClick={() => commit({ ...key })}>Same value</button>
            <button type="button" onClick={() => setEasing({ bezier: [0.4, 0, 0.2, 1] })}>Same easing</button>
          </>
        )}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Same value' }));
    fireEvent.click(screen.getByRole('button', { name: 'Same easing' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Timeline event marks', () => {
  it('names an event crossing as an event, not a key', () => {
    const events = [{ kind: 'event', label: 'step', events: [{ t: 300, fire: () => {} }] }] as Track[];
    renderWithIcons(<Timeline tracks={events} duration={1000} playhead={0} onSeek={() => {}} onChange={() => {}} />);
    expect(screen.getByTestId('timeline-event')).toHaveAccessibleName('step event at 300 ms');
  });
});

describe('Lane graph gestures', () => {
  const eased = sampled([{ t: 0, value: 0 }, { t: 500, value: 10, easing: { bezier: [0.4, 0, 0.2, 1] } }]);

  it('reports a canceled bezier-handle drag', () => {
    const onCancel = vi.fn();
    const onKeysChange = vi.fn();
    render(<Lane {...laneBase} row={laneOf(eased)} selectedSegment={1} onKeysChange={onKeysChange} onCancel={onCancel} />);
    fireEvent.pointerDown(document.querySelector('[data-handle-index="0"]')!, { clientX: 100, clientY: 18, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 10 });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onKeysChange).not.toHaveBeenCalled();
  });

  it('holds the value range through a drag, so the top key stays under the pointer', () => {
    // Values 0..120 padded 8% each way span 142.86 over the lane's 20 px, from 131.43 at the top.
    const onKeysChange = vi.fn();
    const peaked = sampled([{ t: 0, value: 0 }, { t: 400, value: 120 }, { t: 800, value: 40 }]);
    render(<Lane {...laneBase} row={laneOf(peaked)} onKeysInput={() => {}} onKeysChange={onKeysChange} />);
    fireEvent.pointerDown(graphKeys()[1]!, { clientX: 200, clientY: 1.6, button: 0 });
    for (const y of [1.2, 0.8, 0.4]) fireEvent.pointerMove(document, { clientX: 200, clientY: y });
    fireEvent.pointerUp(document, { clientX: 200, clientY: 0.4 });
    expect(onKeysChange.mock.calls[0][0][1].value).toBeCloseTo(131.43 - (0.4 / 20) * 142.857, 1);
  });
});

