import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';
import { shownPath } from './selection';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: { name: 'Canvas', children: {
      showGrid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
      snapping: { name: 'Snapping', children: {
        enabled: { kind: 'boolean', name: 'Enabled', description: '', default: true },
      } },
    } },
    io: { name: 'Import / Export', children: {
      author: { kind: 'string', name: 'Author', description: '', default: '' },
      stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: {
        width: { kind: 'number', name: 'Width', description: '', default: 1 },
      } },
    } },
  },
};

const marked = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-selected]')].map((el) => el.getAttribute('data-pref-path'));

describe('shownPath', () => {
  it('is the path of a leaf or a group, the leaf a field lies inside, and null for one the schema lacks', () => {
    expect(shownPath(SCHEMA, 'canvas.showGrid')).toBe('canvas.showGrid');
    expect(shownPath(SCHEMA, 'canvas.snapping')).toBe('canvas.snapping');
    expect(shownPath(SCHEMA, 'io.stroke.width')).toBe('io.stroke');
    expect(shownPath(SCHEMA, 'canvas.gone')).toBeNull();
    expect(shownPath(SCHEMA, undefined)).toBeNull();
  });
});

describe('a selected path', () => {
  it('marks the one row or group it names', () => {
    const { container, rerender } = render(<PrefsForm schema={SCHEMA} onChange={() => {}} selected="canvas.showGrid" />);
    expect(marked(container)).toEqual(['canvas.showGrid']);
    rerender(<PrefsForm schema={SCHEMA} onChange={() => {}} selected="canvas.snapping" />);
    expect(marked(container)).toEqual(['canvas.snapping']);
    rerender(<PrefsForm schema={SCHEMA} onChange={() => {}} selected="nowhere" />);
    expect(marked(container)).toEqual([]);
  });

  it('opens the rail group that holds it, and leaves the reader free to open another afterward', () => {
    const { container, rerender } = render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} />);
    expect(screen.queryByText('Author')).toBeNull();
    rerender(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} selected="io.author" />);
    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(marked(container)).toEqual(['io.author']);
    fireEvent.click(screen.getByRole('button', { name: /Canvas/ }));
    expect(screen.getByText('Show grid')).toBeInTheDocument();
    expect(screen.queryByText('Author')).toBeNull();
  });

  it('scrolls to it when it changes, but not when the reader picked it here', () => {
    const scrolled: Array<string | null> = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this.getAttribute('data-pref-path')); };
    try {
      const onSelect = vi.fn();
      const view = (selected?: string) => <PrefsForm schema={SCHEMA} onChange={() => {}} selected={selected} onSelect={onSelect} />;
      const { rerender } = render(view());
      rerender(view('io.author'));
      expect(scrolled).toEqual(['io.author']);
      fireEvent.pointerDown(screen.getByText('Show grid'));
      expect(onSelect).toHaveBeenLastCalledWith('canvas.showGrid');
      rerender(view('canvas.showGrid'));
      expect(scrolled).toEqual(['io.author']);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe('onSelect', () => {
  it('reports the row pressed, and the group when the press lands on its heading', () => {
    const onSelect = vi.fn();
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getByText('Enabled'));
    expect(onSelect).toHaveBeenLastCalledWith('canvas.snapping.enabled');
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Snapping' }));
    expect(onSelect).toHaveBeenLastCalledWith('canvas.snapping');
  });

  it('reports the group whose rail entry is pressed', () => {
    const onSelect = vi.fn();
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Import / Export' }));
    expect(onSelect).toHaveBeenLastCalledWith('io');
  });
});
