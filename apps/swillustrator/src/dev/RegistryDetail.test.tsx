import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { RegistryDetail, RouteBadge } from './RegistryDetail';
import type { TreeEntry } from './registryData';

describe('RegistryDetail', () => {
  it('renders a Tool entry with id and route signatures', () => {
    const entry: TreeEntry = {
      kind: 'tool',
      id: 'rect',
      label: 'useRectTool',
      routes: ['[initial] click => empty', '[initial] drag => empty +shift'],
      slot: 'registry',
      phases: {
        initial: {
          gestures: {
            click: true, pointerDown: false, dblTap: false, drag: true,
            wheel: false, keyDown: false, keyUp: false,
          },
          outputs: { cursor: true, overlay: false, claimsAll: false },
        },
      },
      capabilities: {
        initScratch: false, onActivate: false, onDeactivate: false, hitOverride: false,
      },
    };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getAllByText(/rect/).length).toBeGreaterThan(0);
    // Routes are decomposed by RouteBadge into per-segment chips; assert
    // each segment appears at least once across both routes.
    expect(screen.getAllByText('initial').length).toBeGreaterThan(0);
    expect(screen.getAllByText('click').length).toBeGreaterThan(0);
    expect(screen.getAllByText('drag').length).toBeGreaterThan(0);
    expect(screen.getAllByText('empty').length).toBeGreaterThan(0);
    // RouteBadge renders the modifier suffix as a KeySequence keycap.
    expect(screen.getByText('⇧')).toBeTruthy();
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
    const entry: TreeEntry = { kind: 'shapeKind', id: 'rect', label: 'rect' };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('rect')).toBeTruthy();
  });

  it('renders an OpFactory entry with id', () => {
    const entry: TreeEntry = { kind: 'opFactory', id: 'createInsertOp', label: 'createInsertOp' };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('createInsertOp')).toBeTruthy();
  });

  it('renders a PublicExport entry with id', () => {
    const entry: TreeEntry = { kind: 'publicExport', id: 'SceneCanvas', label: 'SceneCanvas', source: 'base' };
    render(<RegistryDetail entry={entry} tools={[]} actions={[]} onNavigate={() => {}} />);
    expect(screen.getByText('SceneCanvas')).toBeTruthy();
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

  it('elides "*" target — no target chip rendered', () => {
    const { container } = render(<RouteBadge route="[initial] click" />);
    // No target tag; only phase + gesture chips visible.
    const tags = container.querySelectorAll('code');
    expect(tags.length).toBe(0);
  });
});
