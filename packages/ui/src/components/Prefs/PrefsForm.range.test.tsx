import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    view: { name: 'View', children: {
      grid: flag('Grid'),
      snap: { name: 'Snapping', children: { on: flag('Snap'), guides: flag('Guides') } },
      zoom: flag('Zoom'),
    } },
    io: { name: 'Files', children: { author: flag('Author') } },
  },
};

function form(selected: readonly string[], layout: 'rail' | 'list' = 'list') {
  const onSelect = vi.fn();
  render(<PrefsForm layout={layout} schema={SCHEMA} onChange={() => {}} selected={selected} onSelect={onSelect} />);
  return onSelect;
}

describe('a press with Shift held', () => {
  it('reports the rows drawn from the first selected to the one pressed, and no group between them', () => {
    const onSelect = form(['view.grid']);
    fireEvent.pointerDown(screen.getByText('Zoom'), { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('view.zoom', {
      toggle: false, range: ['view.grid', 'view.snap.on', 'view.snap.guides', 'view.zoom'],
    });
  });

  it('runs from the first selected back to a row above it, that row last', () => {
    const onSelect = form(['view.zoom', 'io.author']);
    fireEvent.pointerDown(screen.getByText('Snap'), { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('view.snap.on', {
      toggle: false, range: ['view.zoom', 'view.snap.guides', 'view.snap.on'],
    });
  });

  it('is a plain pick with nothing selected, or when the first selected is not drawn, as on another page', () => {
    const none = form([]);
    fireEvent.pointerDown(screen.getByText('Zoom'), { shiftKey: true });
    expect(none).toHaveBeenLastCalledWith('view.zoom', { toggle: false });
    cleanup();
    const onSelect = vi.fn();
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} section="view" selected={['io.author']} onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getByText('Zoom'), { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('view.zoom', { toggle: false });
  });

  it('toggles, and reports no range, with Cmd held as well', () => {
    const onSelect = form(['view.grid']);
    fireEvent.pointerDown(screen.getByText('Zoom'), { shiftKey: true, metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('view.zoom', { toggle: true });
  });
});
