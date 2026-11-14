import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Track } from '@weasel-js/animator';
import { renderWithIcons } from '../../testing/withIcons';
import { Disabled, ReadOnly } from '../Disabled';
import { Timeline, type TimelineProps } from './Timeline';

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 500, bottom: 20, width: 500, height: 20, toJSON: () => {} } as DOMRect;
  };
});

const TRACKS = [
  { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }], onTick: () => {} },
] as Track[];

function renderTimeline(wrap: (node: ReactNode) => ReactNode, props: Partial<TimelineProps> = {}) {
  const calls = {
    onChange: vi.fn(), onInput: vi.fn(), onScrub: vi.fn(), onSelectionChange: vi.fn(), onWindowChange: vi.fn(), onModeChange: vi.fn(),
  };
  renderWithIcons(<>{wrap(<Timeline tracks={TRACKS} duration={1000} playhead={0} {...calls} {...props} />)}</>);
  return calls;
}

const key = () => screen.getAllByTestId('timeline-key')[1]!;

/** A key dragged, stepped, and deleted, a key inserted, the ruler scrubbed and zoomed, and the Graph switch. */
function tryEverything() {
  fireEvent.pointerDown(key(), { clientX: 250, clientY: 10, button: 0 });
  fireEvent.pointerMove(document, { clientX: 400, clientY: 10 });
  fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
  act(() => key().focus());
  fireEvent.keyDown(key(), { key: 'ArrowLeft' });
  fireEvent.keyDown(key(), { key: 'Delete' });
  fireEvent.doubleClick(screen.getByTestId('timeline-lane-track'), { clientX: 100 });
  fireEvent.pointerDown(screen.getByTestId('timeline-ruler'), { clientX: 250, clientY: 5, button: 0 });
  fireEvent.pointerUp(document, { clientX: 250, clientY: 5 });
  fireEvent.wheel(screen.getByTestId('timeline-ruler'), { ctrlKey: true, deltaY: -Math.log(2) / 0.0015, clientX: 0 });
  fireEvent.click(screen.getByRole('switch', { name: 'Graph mode' }));
}

const EDITS = ['onChange', 'onInput', 'onScrub'] as const;
const LOOKS = ['onSelectionChange', 'onWindowChange', 'onModeChange'] as const;

describe('Timeline held', () => {
  it('unheld, every edit, scrub, selection, zoom, and mode change goes through', () => {
    const calls = renderTimeline((n) => n);
    tryEverything();
    for (const name of [...EDITS, ...LOOKS]) expect(calls[name], name).toHaveBeenCalled();
  });

  it('disabled with no reason refuses everything and takes its marks out of the tab order', () => {
    const calls = renderTimeline((n) => n, { disabled: true });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    expect(key().getAttribute('tabindex')).toBe('-1');
    expect(key().getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Graph mode' })).toBeDisabled();
    expect(screen.queryByTestId('timeline-key-ghost')).toBeNull();
  });

  it('disabled for a reason refuses everything, keeps its marks reachable, and says why', () => {
    const calls = renderTimeline((n) => n, { disabled: true, disabledReason: 'Rendering' });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    expect(key().getAttribute('tabindex')).toBe('0');
    expect(key()).toHaveAccessibleDescription('Rendering');
    expect(screen.getByTestId('timeline-root').getAttribute('data-held')).toBe('disabled');
  });

  it('read-only still selects, zooms, and switches to the graph, and edits and scrubs nothing', () => {
    const calls = renderTimeline((n) => <ReadOnly reason="Shared">{n}</ReadOnly>);
    expect(key()).toHaveAccessibleDescription('Shared');
    tryEverything();
    for (const name of EDITS) expect(calls[name], name).not.toHaveBeenCalled();
    for (const name of LOOKS) expect(calls[name], name).toHaveBeenCalled();
  });

  it('read-only, the key editor and the transport are held', () => {
    const onPlay = vi.fn();
    const onLoopChange = vi.fn();
    const onChange = vi.fn();
    renderWithIcons(
      <Timeline
        readOnly tracks={TRACKS} duration={1000} playhead={0} onChange={onChange} onScrub={() => {}}
        selection={{ trackPath: [0], keyIndex: 1 }}
        renderKeyEditor={({ commit, key: k }) => <button type="button" onClick={() => commit({ ...k, value: 3 })}>Set</button>}
        transport={{ paused: true, loop: false, rate: 1, onPlay, onPause: () => {}, onLoopChange, onRateChange: () => {} }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Loop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onLoopChange).not.toHaveBeenCalled();
    expect(onPlay).toHaveBeenCalled();
  });

  it('nested scopes: the nearest reason wins, disabled={false} adds nothing, and disabled beats read-only', () => {
    const calls = renderTimeline(
      (n) => <ReadOnly><Disabled reason="Locked"><Disabled reason="Busy">{n}</Disabled></Disabled></ReadOnly>,
      { disabled: false },
    );
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    expect(key()).toHaveAccessibleDescription('Busy');
  });
});
