import { screen } from '@testing-library/react';
import { keyLegendFromKey } from '@weasel-js/gestures';
import { renderWithIcons } from '../testIcons';
import { RegistryDetail } from './RegistryDetail';
import { icon } from '../icons.gen';
import { RouteBadge } from './detail/RouteBadge';
import type { ActionEntry, ToolEntry, TreeEntry } from './registryEntries';
import { collectShapeTrait } from './registryData';

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
    const entry: TreeEntry = { kind: 'opFactory', id: 'insert', label: 'ops.insert' };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('ops.insert')).toBeTruthy();
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
    // Compare against keyLegendFromKey rather than a literal glyph — the label
    // is platform-dependent (⎋ on macOS, Esc elsewhere), and the detected
    // platform follows the host OS via jsdom's user agent. The contract under
    // test is that the arg routes through keyLegendFromKey into a KeyCap.
    expect(cap?.textContent).toBe(keyLegendFromKey('Escape').label);
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
    expect(cap?.textContent).toBe(keyLegendFromKey(' ').label);
  });
});

describe('op kind detail', () => {
  it('names the factory that builds `transform`, not one named after the kind', () => {
    const entry: TreeEntry = { kind: 'opKind', id: 'transform', label: 'transform' };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('ops.setPose')).toBeInTheDocument();
    expect(screen.queryByText('ops.transform')).toBeNull();
    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('labels a shape kind\'s transform link with that factory', () => {
    const entry: TreeEntry = { kind: 'shapeKind', id: 'rect', label: 'rect', trait: 'shape' };
    renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('ops.setPose')).toBeInTheDocument();
    expect(screen.queryByText('ops.transform')).toBeNull();
  });
});

describe('gesture detail', () => {
  const gesture: TreeEntry = { kind: 'gesture', id: 'key', label: 'key' };

  it('does not describe tool bindings as a phase grammar', () => {
    const { container } = renderWithIcons(<RegistryDetail entry={gesture} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(container.textContent).not.toMatch(/phase grammar/);
  });

  it('gives each of an action\'s bindings its own row, even when their routes read the same', () => {
    const zoom: ActionEntry = {
      kind: 'action', id: 'zoomReset', label: 'Reset zoom',
      defaultBinding: [
        { kind: 'key', key: '0', mods: { mod: true } },
        { kind: 'key', key: '0', code: 'Numpad0', mods: { mod: true } },
      ],
    } as unknown as ActionEntry;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      renderWithIcons(<RegistryDetail entry={gesture} tools={[]} actions={[zoom]} onNavigate={() => {}} />);
      expect(screen.getAllByText('Reset zoom')).toHaveLength(2);
      expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key/);
    } finally {
      errors.mockRestore();
    }
  });
});

describe('phase output detail', () => {
  it.each(['overlay', 'cursor'] as const)('describes %s without the removed phase tables', (id) => {
    const entry: TreeEntry = { kind: 'phaseOutput', id, label: id };
    const { container } = renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(container.textContent).not.toMatch(/initial\.overlay|claimsAll|pointerdown/);
  });
});

describe('shape kind detail with no authoring tool', () => {
  it('names no authoring tool and no source for a kind no mounted tool mints', () => {
    const image = collectShapeTrait([]).find((k) => k.id === 'image')!;
    expect(image.tool).toBeUndefined();
    renderWithIcons(<RegistryDetail entry={image} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.queryByText('authored by', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText('source', { selector: 'dt' })).toBeNull();
  });

  it('still names the tool that mints a kind when it is mounted', () => {
    const rect = { kind: 'tool', id: 'rect', hookName: 'useRectTool' } as unknown as ToolEntry;
    expect(collectShapeTrait([rect]).find((k) => k.id === 'rect')?.tool).toBe('rect');
  });
});

describe('op kind detail for a kind with no ops export', () => {
  it('claims no `ops.*` factory for a consumer-registered kind', () => {
    const entry: TreeEntry = { kind: 'opKind', id: 'myapp:stamp', label: 'myapp:stamp' };
    const { container } = renderWithIcons(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(container.textContent).not.toMatch(/ops\.myapp:stamp/);
    expect(container.textContent).not.toMatch(/undefined/);
  });
});
