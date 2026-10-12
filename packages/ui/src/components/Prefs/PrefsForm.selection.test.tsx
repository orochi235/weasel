import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';
import { MARKED, shownPath } from './selection';

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
  [...container.querySelectorAll(MARKED)].map((el) => el.getAttribute('data-pref-path'));

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
  it('marks the row or group it names', () => {
    const { container, rerender } = render(<PrefsForm schema={SCHEMA} onChange={() => {}} selected={['canvas.showGrid']} />);
    expect(marked(container)).toEqual(['canvas.showGrid']);
    rerender(<PrefsForm schema={SCHEMA} onChange={() => {}} selected={['canvas.snapping']} />);
    expect(marked(container)).toEqual(['canvas.snapping']);
    rerender(<PrefsForm schema={SCHEMA} onChange={() => {}} selected={['nowhere']} />);
    expect(marked(container)).toEqual([]);
  });

  it('opens the rail group that holds it, and leaves the reader free to open another afterward', () => {
    const { container, rerender } = render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} />);
    expect(screen.queryByText('Author')).toBeNull();
    rerender(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} selected={['io.author']} />);
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
      const view = (selected?: string) => <PrefsForm schema={SCHEMA} onChange={() => {}} selected={selected === undefined ? undefined : [selected]} onSelect={onSelect} />;
      const { rerender } = render(view());
      rerender(view('io.author'));
      expect(scrolled).toEqual(['io.author']);
      fireEvent.pointerDown(screen.getByText('Show grid'));
      expect(onSelect).toHaveBeenLastCalledWith('canvas.showGrid', { toggle: false });
      rerender(view('canvas.showGrid'));
      expect(scrolled).toEqual(['io.author']);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe('a run of tabs', () => {
  const TABS: PrefGroup = {
    name: 'Preferences',
    children: {
      light: { name: 'Light', as: 'tab', children: { ink: { kind: 'string', name: 'Ink', description: '', default: '' } } },
      dark: { name: 'Dark', as: 'tab', children: { glow: { kind: 'string', name: 'Glow', description: '', default: '' } } },
    },
  };

  it('marks nothing while nothing is selected, the open tab included', () => {
    const { container } = render(<PrefsForm layout="rail" schema={TABS} onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Light' })).toHaveAttribute('data-pref-path', 'light');
    expect(marked(container)).toEqual([]);
  });

  it('marks a selected tab on its panel while it is open, and on the tab once the reader leaves it', () => {
    const { container } = render(<PrefsForm layout="rail" schema={TABS} onChange={() => {}} selected={['dark']} />);
    expect(marked(container).length).toBe(1);
    expect(container.querySelector(MARKED)).toHaveAttribute('role', 'tabpanel');
    fireEvent.click(screen.getByRole('tab', { name: 'Light' }));
    expect(marked(container)).toEqual(['dark']);
    expect(container.querySelector(MARKED)).toHaveAttribute('role', 'tab');
  });
});

describe('onSelect', () => {
  it('reports the row pressed, and the group when the press lands on its heading', () => {
    const onSelect = vi.fn();
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getByText('Enabled'));
    expect(onSelect).toHaveBeenLastCalledWith('canvas.snapping.enabled', { toggle: false });
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Snapping' }));
    expect(onSelect).toHaveBeenLastCalledWith('canvas.snapping', { toggle: false });
  });

  it('reports the group whose rail entry is pressed', () => {
    const onSelect = vi.fn();
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Import / Export' }));
    expect(onSelect).toHaveBeenLastCalledWith('io', { toggle: false });
  });

  it('reports the root, as the empty path, from the rail entry for its own leaves', () => {
    const onSelect = vi.fn();
    const schema: PrefGroup = {
      name: 'Preferences',
      children: { ...SCHEMA.children, loose: { kind: 'boolean', name: 'Loose', description: '', default: false } },
    };
    render(<PrefsForm layout="rail" schema={schema} selected={['io']} onChange={() => {}} onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Preferences' }));
    expect(onSelect).toHaveBeenLastCalledWith('', { toggle: false });
  });

  it('reports focus into a row whose last press ended without a click', () => {
    const onSelect = vi.fn();
    render(<PrefsForm schema={SCHEMA} onChange={() => {}} onSelect={onSelect} />);
    // A press that becomes a drag: the pointer comes up somewhere else and no click follows.
    fireEvent.pointerDown(screen.getByText('Show grid'));
    fireEvent.pointerUp(document.body);
    onSelect.mockClear();
    fireEvent.focus(screen.getByRole('checkbox', { name: 'Show grid' }));
    expect(onSelect).toHaveBeenCalledWith('canvas.showGrid', { toggle: false });
  });

  it('does not report the focus a press causes as a second pick', () => {
    const onSelect = vi.fn();
    render(<PrefsForm schema={SCHEMA} onChange={() => {}} onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getByText('Show grid'));
    fireEvent.focus(screen.getByRole('checkbox', { name: 'Show grid' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
