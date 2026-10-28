import { screen } from '@testing-library/react';
import { keySpecFromKey } from '@weasel-js/ui/components/Keycaps';
import { renderWithIcons } from '../testIcons';
import { RegistryDetail } from './RegistryDetail';
import { icon } from '../icons.gen';
import { RouteBadge } from './detail/RouteBadge';
import type { ActionEntry, TreeEntry } from './registryEntries';

describe('RegistryDetail', () => {
  it('pairs each fact about an entry with its label in a description list', () => {
    const entry: TreeEntry = { kind: 'propertiesKind', id: 'rect', label: 'rect', trait: 'properties', leafPaths: [] };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    const dt = screen.getByText('trait', { selector: 'dt' });
    expect(dt.nextElementSibling?.tagName).toBe('DD');
    expect(dt.nextElementSibling!.textContent).toBe('properties');
  });

  it('says whether a preset is an atom and names the presets it includes', () => {
    const entry: TreeEntry = { kind: 'bundle', id: 'pick', label: 'Pick', atom: false, tools: ['select'], includes: ['select', 'outline'] };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('bundle')).toBeInTheDocument();
    expect(screen.getByText('outline')).toBeInTheDocument();
  });

  it('names a bundle\'s members without linking them: tools are the devtools panel\'s', () => {
    const entry: TreeEntry = {
      kind: 'bundle', id: 'view', label: 'View', atom: false,
      tools: ['select', 'hand'], includes: [],
    };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getAllByText('select').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'select' })).toBeNull();
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
