import { describe, expect, it } from 'vitest';
import { renderWithIcons } from '../../testing/withIcons';
import { KeySequence } from './Keycaps';
import { ShortcutKeys } from './ShortcutKeys';

const chips = (container: HTMLElement) => [...container.querySelectorAll('kbd')].map((k) => k.textContent);
const loupe = { key: '2', leader: [{ label: 'View', shortcut: { key: 'v' } }, { label: 'Loupe', shortcut: { key: 'l' } }] };

describe('KeySequence leader', () => {
  it('draws each keymap leading to the keys by its label, outermost first, as text rather than a key', () => {
    const { container } = renderWithIcons(<KeySequence leader={[{ label: 'View' }, { label: 'Loupe' }]} keys={[{ label: '⌘' }, { label: '2' }]} joins="none" />);
    expect(chips(container)).toEqual(['⌘', '2']);
    expect(container.textContent).toBe('View▸Loupe▸⌘2');
  });
});

describe('ShortcutKeys', () => {
  it('draws a shortcut held as data with the keymaps that lead to it', () => {
    const { container } = renderWithIcons(<ShortcutKeys shortcut={loupe} />);
    expect(chips(container)).toEqual(['2']);
    expect(container.textContent).toBe('View▸Loupe▸2');
  });

  it('reads the leader path out of a legend formatShortcut wrote', () => {
    const { container } = renderWithIcons(<ShortcutKeys legend="View ▸ Loupe ▸ ⌘2" />);
    expect(chips(container)).toEqual(['⌘', '2']);
    expect(container.textContent).toBe('View▸Loupe▸⌘2');
  });

  it('draws a legend with no leader as keys alone', () => {
    const { container } = renderWithIcons(<ShortcutKeys legend="Ctrl+Shift+Z" />);
    expect(chips(container)).toEqual(['Ctrl', 'Shift', 'Z']);
  });
});
