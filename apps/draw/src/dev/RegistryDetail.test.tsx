import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { keySpecFromKey } from '@weasel-js/ui';
import { RegistryDetail, RouteBadge } from './RegistryDetail';
import type { TreeEntry } from './registryData';

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
        initScratch: false, onActivate: false, onDeactivate: false,
      },
    };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
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
    const entry: TreeEntry = { kind: 'action', id: 'delete', label: 'Delete', shortcutParts: ['⌫'] };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('⌫')).toBeTruthy();
  });

  it('renders a Bundle with clickable members that fire onNavigate', () => {
    const entry: TreeEntry = {
      kind: 'bundle', id: 'minimal', label: 'Minimal',
      tools: ['select', 'hand'],
    };
    const onNavigate = vi.fn();
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'select' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toEqual({ kind: 'tool', id: 'select' });
  });

  it('renders an Icon entry with a visual preview', () => {
    const Component = () => <svg data-testid="icon-svg" width={16} height={16} />;
    const entry: TreeEntry = { kind: 'icon', id: 'TestIcon', label: 'TestIcon', source: 'action', Component };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getAllByTestId('icon-svg').length).toBeGreaterThanOrEqual(2);
  });

  it('renders a ShapeKind entry with id', () => {
    const entry: TreeEntry = { kind: 'shapeKind', id: 'rect', label: 'rect', trait: 'shape' };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('rect')).toBeTruthy();
  });

  it('renders a RoutingKind entry with id and source', () => {
    const entry: TreeEntry = {
      kind: 'routingKind', id: 'rect', label: 'rect', trait: 'routing', source: 'default', shapeKindId: 'rect',
    };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getAllByText('rect').length).toBeGreaterThan(0);
    expect(screen.getByText('default')).toBeTruthy();
    expect(screen.getByText('routing-kind')).toBeTruthy();
  });

  it('renders an OpFactory entry with id', () => {
    const entry: TreeEntry = { kind: 'opFactory', id: 'createInsertOp', label: 'createInsertOp' };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('createInsertOp')).toBeTruthy();
  });

});

describe('RouteBadge v3', () => {
  it('renders bracketed phase + gesture + target + modifier', () => {
    render(<RouteBadge route="[initial] click => empty +shift" />);
    expect(screen.getByText('initial')).toBeTruthy();
    expect(screen.getByText('click')).toBeTruthy();
    expect(screen.getByText('empty')).toBeTruthy();
    expect(screen.getByText('⇧')).toBeTruthy();
  });

  it('renders multi-phase list', () => {
    render(<RouteBadge route="[initial,engaged] contextMenu => empty" />);
    expect(screen.getByText('initial')).toBeTruthy();
    expect(screen.getByText('engaged')).toBeTruthy();
  });

  it('renders [*] as the wildcard phase', () => {
    render(<RouteBadge route="[*] click => empty" />);
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('renders optional modifier inverted', () => {
    const { container } = render(<RouteBadge route="[initial] keyDown(ArrowDown) ?shift" />);
    const cap = container.querySelector('[data-inverted]');
    expect(cap?.textContent).toBe('⇧');
  });

  it('renders "*" target as a muted tag — wildcards stay visible so the route reads as the full wiring', () => {
    const { container } = render(<RouteBadge route="[initial] click" />);
    const tag = container.querySelector('code');
    expect(tag?.textContent).toBe('*');
    expect(tag?.className).toMatch(/routeMuted/);
  });

  it('renders keyDown arg as a minimal KeyCap with the canonical label (no parens)', () => {
    const { container } = render(<RouteBadge route="[initial] keyDown(Escape)" />);
    const cap = container.querySelector('kbd[data-variant="minimal"]');
    // Compare against keySpecFromKey rather than a literal glyph — the label
    // is platform-dependent (⎋ on macOS, Esc elsewhere), and the detected
    // platform follows the host OS via jsdom's user agent. The contract under
    // test is that the arg routes through keySpecFromKey into a KeyCap.
    expect(cap?.textContent).toBe(keySpecFromKey('Escape').label);
    // No parenthesized fallback rendering when arg is a key.
    expect(container.textContent).not.toMatch(/\(Escape\)/);
  });

  it('keeps parens for non-key args (e.g. wheel direction)', () => {
    const { container } = render(<RouteBadge route="[initial] wheel(up)" />);
    expect(container.textContent).toMatch(/wheel\(up\)/);
  });

  it('renders keyHeld arg as a minimal KeyCap (same path as keyDown)', () => {
    const { container } = render(<RouteBadge route="[initial] keyHeld(Space)" />);
    const cap = container.querySelector('kbd[data-variant="minimal"]');
    expect(cap?.textContent).toBe(keySpecFromKey(' ').label);
  });
});
