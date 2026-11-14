import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { KitSettingsProvider } from '@weasel-js/react';
import type { DropOutside } from './StructurePane';
import { usePreviewDrag } from './usePreviewDrag';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } } } },
};

function Stage({ place }: { place: DropOutside }) {
  const stage = useRef<HTMLDivElement | null>(null);
  const drag = usePreviewDrag({
    stage, schema: () => SCHEMA, place, selected: () => [], onPick: () => {}, onMove: () => {}, onCopy: () => {}, onAlias: () => {},
  });
  return <div ref={stage} onPointerDown={drag.onPointerDown}><div data-pref-path="view.grid">Show grid</div></div>;
}

describe('usePreviewDrag', () => {
  it('ends a live drag when it unmounts, so nothing later reaches the place it dropped on', () => {
    const place: DropOutside = { over: vi.fn(() => false), target: vi.fn(() => null), end: vi.fn() };
    const { unmount } = render(<Stage place={place} />);
    const label = screen.getByText('Show grid');
    fireEvent.pointerDown(label, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(label, { clientX: 60, clientY: 60 });
    expect(place.over).toHaveBeenCalled();
    unmount();
    expect(place.end).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(place.end).toHaveBeenCalledTimes(1);
  });

  it('picks a row up only past the gestures.dragPx kit setting', () => {
    const place: DropOutside = { over: vi.fn(() => false), target: vi.fn(() => null), end: vi.fn() };
    render(<KitSettingsProvider value={{ gestures: { dragPx: 40 } }}><Stage place={place} /></KitSettingsProvider>);
    const label = screen.getByText('Show grid');
    fireEvent.pointerDown(label, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(label, { clientX: 25, clientY: 5 });
    expect(place.over).not.toHaveBeenCalled();
    fireEvent.pointerMove(label, { clientX: 50, clientY: 5 });
    expect(place.over).toHaveBeenCalled();
    fireEvent.pointerUp(label, { clientX: 50, clientY: 5 });
  });
});
