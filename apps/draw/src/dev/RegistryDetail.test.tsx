import { screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { keySpecFromKey } from '@weasel-js/ui/components/Keycaps';
import { renderWithIcons } from '../testIcons';
import { RegistryDetail } from './RegistryDetail';
import { icon } from '../icons.gen';
import { RouteBadge } from './detail/RouteBadge';
import { collectBundles } from './registryData';
import type { ActionEntry, TreeEntry } from './registryEntries';

describe('RegistryDetail', () => {
  it('renders a Tool entry with id and route signatures', () => {
    const entry: TreeEntry = {
      kind: 'tool',
      id: 'rect',
      label: 'useRectTool',
      routes: ['[initial] click => empty', '[initial] drag => empty +shift'],
      declaredRoutes: [
        { route: '[initial] click => empty' },
        { route: '[initial] drag => empty +shift' },
      ],
      slot: 'registry',
      surface: {
        gestures: {
          click: true, doubleClick: false, pointerDown: false, drag: true,
          wheel: false, key: false, keyHeld: false, contextMenu: false,
          multiTouchTap: false,
        },
        outputs: { cursor: true, overlay: false },
      },
      capabilities: {
        onActivate: false, onDeactivate: false,
      },
    };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getAllByText(/rect/).length).toBeGreaterThan(0);
    // Routes are rendered as a DataGrid with per-route columns; assert the
    // expected per-row cell contents appear.
    expect(screen.getAllByText('initial').length).toBeGreaterThan(0);
    expect(screen.getAllByText('click').length).toBeGreaterThan(0);
    expect(screen.getAllByText('drag').length).toBeGreaterThan(0);
    expect(screen.getAllByText('empty').length).toBeGreaterThan(0);
    // Modifiers cell renders required modifiers as +name chips.
    expect(screen.getByText('+shift')).toBeTruthy();
  });

  it('renders an Action entry with shortcut', () => {
    const entry: TreeEntry = { kind: 'action', id: 'delete', label: 'Delete', bindingShortcut: { key: 'd' } };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('D')).toBeTruthy();
  });

  it('pairs each fact about an entry with its label in a description list', () => {
    const entry: TreeEntry = { kind: 'action', id: 'delete', label: 'Delete', group: 'edit' };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    const valueOf = (label: string) => {
      const dt = screen.getByText(label, { selector: 'dt' });
      expect(dt.nextElementSibling?.tagName).toBe('DD');
      return dt.nextElementSibling!.textContent;
    };
    expect(valueOf('label')).toBe('Delete');
    expect(valueOf('group')).toBe('edit');
  });

  it('names the bundle diff list by its heading, one row per other bundle', () => {
    const entry = { kind: 'bundle', id: 'probe', label: 'Probe', tools: ['probeOnly'] } as unknown as TreeEntry;
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    const heading = screen.getByRole('heading', { name: 'Diff vs other bundles' });
    const list = document.querySelector(`dl[aria-labelledby="${heading.id}"]`)!;
    const values = [...list.querySelectorAll('dd')];
    expect(values.length).toBe(collectBundles().length);
    for (const dd of values) expect(dd.textContent).toContain('+probeOnly');
  });

  it('renders a Bundle with clickable members that fire onNavigate', () => {
    const entry: TreeEntry = {
      kind: 'bundle', id: 'minimal', label: 'Minimal',
      tools: ['select', 'hand'],
    };
    const onNavigate = vi.fn();
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'select' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toEqual({ kind: 'tool', id: 'select' });
  });

  it('renders an Icon entry with a visual preview', () => {
    const ref = icon('core:undo');
    const entry: TreeEntry = { kind: 'icon', id: ref, label: ref, source: 'action', ref };
    const { container } = renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
  });

  it('renders a ShapeKind entry with id', () => {
    const entry: TreeEntry = { kind: 'shapeKind', id: 'rect', label: 'rect', trait: 'shape' };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('rect')).toBeTruthy();
  });

  it('renders a RoutingKind entry with id and source', () => {
    const entry: TreeEntry = {
      kind: 'routingKind', id: 'rect', label: 'rect', trait: 'routing', source: 'default', shapeKindId: 'rect',
    };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getAllByText('rect').length).toBeGreaterThan(0);
    expect(screen.getByText('default')).toBeTruthy();
    expect(screen.getByText('routing-kind')).toBeTruthy();
  });

  it('renders an OpFactory entry with id', () => {
    const entry: TreeEntry = { kind: 'opFactory', id: 'createInsertOp', label: 'createInsertOp' };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('createInsertOp')).toBeTruthy();
  });

  // `ingest` binds drop and paste with every modifier `'optional'`. A
  // formatter that only reports modifiers set to `true` renders both as the
  // empty string and the action vanishes from the gesture's binding list.
  it.each([
    ['drop', '[*:*] drop ?shift ?alt ?ctrl ?meta'],
    ['paste', '[*:*] paste ?shift ?alt ?ctrl ?meta'],
  ])(
    'lists the ingest action on the %s gesture as %s',
    (gestureKind, route) => {
      const ANY_MODS = {
        alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional',
      } as const;
      const ingest: ActionEntry = {
        kind: 'action', id: 'ingest', label: 'Insert external content',
        defaultBinding: [
          { kind: 'drop', mods: ANY_MODS },
          { kind: 'paste', mods: ANY_MODS },
        ],
      };
      const entry: TreeEntry = { kind: 'gesture', id: gestureKind, label: gestureKind };
      renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[ingest]} onNavigate={() => {}} />);
      expect(screen.getByText(route)).toBeTruthy();
    },
  );

});

describe('RouteBadge v3', () => {
  it('renders bracketed phase + gesture + target + modifier', () => {
    renderWithIcons(<RouteBadge route="[initial] click => empty +shift" />);
    expect(screen.getByText('initial')).toBeTruthy();
    expect(screen.getByText('click')).toBeTruthy();
    expect(screen.getByText('empty')).toBeTruthy();
    expect(screen.getByText('⇧')).toBeTruthy();
  });

  it('renders multi-phase list', () => {
    renderWithIcons(<RouteBadge route="[initial,engaged] contextMenu => empty" />);
    expect(screen.getByText('initial')).toBeTruthy();
    expect(screen.getByText('engaged')).toBeTruthy();
  });

  it('renders [*] as the wildcard phase', () => {
    renderWithIcons(<RouteBadge route="[*] click => empty" />);
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('renders optional modifier inverted', () => {
    const { container } = renderWithIcons(<RouteBadge route="[initial] keyDown(ArrowDown) ?shift" />);
    const cap = container.querySelector('[data-inverted]');
    expect(cap?.textContent).toBe('⇧');
  });

  it('renders "*" target as a muted tag — wildcards stay visible so the route reads as the full wiring', () => {
    const { container } = renderWithIcons(<RouteBadge route="[initial] click" />);
    const tag = container.querySelector('code');
    expect(tag?.textContent).toBe('*');
    expect(tag?.className).toMatch(/routeMuted/);
  });

  it('renders keyDown arg as a default KeyCap with the canonical label (no parens)', () => {
    const { container } = renderWithIcons(<RouteBadge route="[initial] keyDown(Escape)" />);
    const cap = container.querySelector('kbd:not([data-variant])');
    // Compare against keySpecFromKey rather than a literal glyph — the label
    // is platform-dependent (⎋ on macOS, Esc elsewhere), and the detected
    // platform follows the host OS via jsdom's user agent. The contract under
    // test is that the arg routes through keySpecFromKey into a KeyCap.
    expect(cap?.textContent).toBe(keySpecFromKey('Escape').label);
    // No parenthesized fallback rendering when arg is a key.
    expect(container.textContent).not.toMatch(/\(Escape\)/);
  });

  it('keeps parens for non-key args (e.g. wheel direction)', () => {
    const { container } = renderWithIcons(<RouteBadge route="[initial] wheel(up)" />);
    expect(container.textContent).toMatch(/wheel\(up\)/);
  });

  it('renders keyHeld arg as a default KeyCap (same path as keyDown)', () => {
    const { container } = renderWithIcons(<RouteBadge route="[initial] keyHeld(Space)" />);
    const cap = container.querySelector('kbd:not([data-variant])');
    expect(cap?.textContent).toBe(keySpecFromKey(' ').label);
  });
});
