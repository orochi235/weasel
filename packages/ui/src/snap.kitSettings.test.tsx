import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Track } from '@weasel-js/animator';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import { BandEditor } from './components/BandEditor/BandEditor';
import { useScale, useSpan } from './components/Slider/useSpan';
import { Lane } from './components/Timeline/Lane';
import { buildLanes } from './components/Timeline/lanes';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 40, width: TRACK_WIDTH, height: 40, toJSON: () => {} } as DOMRect;
  };
});

afterEach(cleanup);

const under = (settings: KitSettingsOverrides | undefined, node: ReactNode) =>
  settings === undefined ? node : <KitSettingsProvider value={settings}>{node}</KitSettingsProvider>;

describe('targets.snapRadiusPx', () => {
  // The track is 500px over 0…100, so 130px is 26 — 5px from the tick at 25.
  const bandSeamAfter = (settings: KitSettingsOverrides | undefined): number => {
    const onChange = vi.fn();
    const { container } = render(under(settings, (
      <BandEditor value={[{ from: 0, data: 'a' }, { from: 20, data: 'b' }]} min={0} max={100} scale="linear"
        ticks={[{ at: 25 }]} onChange={onChange} />
    )));
    const seam = container.querySelector('[role="slider"]')!;
    fireEvent.pointerDown(seam, { clientX: 100, clientY: 20, button: 0 });
    fireEvent.pointerMove(document, { clientX: 130, clientY: 20 });
    fireEvent.pointerUp(document, { clientX: 130, clientY: 20 });
    return Math.round(onChange.mock.calls[0][0][1].from * 1e6) / 1e6;
  };

  it("snaps a BandEditor seam inside the constant with no provider, and inside the provider's radius", () => {
    expect(bandSeamAfter(undefined)).toBe(25);
    cleanup();
    expect(bandSeamAfter({ targets: { snapRadiusPx: 2 } })).toBe(26);
  });

  // 1000ms over 500px: the key at 500ms dragged 51px lands at 602, 1px from the snap time at 600.
  const laneKeyAfter = (settings: KitSettingsOverrides | undefined): number => {
    const onKeyCommit = vi.fn();
    const track = { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }], onTick: () => {} } as Track;
    render(under(settings, (
      <Lane window={{ from: 0, to: 1000 }} mode="dope" selection={null} onSelect={() => {}} onKeyInput={() => {}}
        onKeyCommit={onKeyCommit} onInsert={() => {}} onToggleExpand={() => {}} expanded={false} snapTimes={[600]}
        row={buildLanes([track], new Set())[0]} />
    )));
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerMove(document, { clientX: 301, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 301, clientY: 10 });
    return onKeyCommit.mock.calls[0][1];
  };

  it("snaps a Timeline key inside the constant with no provider, and inside the provider's radius", () => {
    expect(laneKeyAfter(undefined)).toBe(600);
    cleanup();
    expect(laneKeyAfter({ targets: { snapRadiusPx: 0.5 } })).toBe(602);
  });
});

describe('targets.sliderStopSnapPx', () => {
  // A 100px track over 0…100: a pointer at .53 is 3px from the stop at 50.
  const valueAt = (settings: KitSettingsOverrides | undefined): number => {
    const wrapper = ({ children }: { children: ReactNode }) => under(settings, children);
    const { result } = renderHook(() => useScale(useSpan({ stops: [0, 50, 100], min: 0, max: 100 }), false, 1), { wrapper });
    return result.current.valueAt(0.53, 100);
  };

  it("snaps to a stop inside the constant with no provider, and inside the provider's radius", () => {
    expect(valueAt(undefined)).toBe(50);
    expect(valueAt({ targets: { sliderStopSnapPx: 2 } })).toBe(53);
  });
});
