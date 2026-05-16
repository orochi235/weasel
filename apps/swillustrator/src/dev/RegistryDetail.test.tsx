import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { RegistryDetail } from './RegistryDetail';
import type { TreeEntry } from './registryData';

describe('RegistryDetail', () => {
  it('renders a Tool entry with id and route signatures', () => {
    const entry: TreeEntry = {
      kind: 'tool',
      id: 'rect',
      label: 'useRectTool',
      routes: ['initial.click.empty', 'initial.drag.empty:shift'],
    };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getAllByText(/rect/).length).toBeGreaterThan(0);
    expect(screen.getByText('initial.click.empty')).toBeTruthy();
    expect(screen.getByText('initial.drag.empty:shift')).toBeTruthy();
  });

  it('renders an Action entry with shortcut', () => {
    const entry: TreeEntry = { kind: 'action', id: 'delete', label: 'Delete', shortcut: 'Backspace' };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText('Backspace')).toBeTruthy();
  });

  it('renders a Bundle with clickable members that fire onNavigate', () => {
    const entry: TreeEntry = {
      kind: 'bundle', id: 'minimal', label: 'Minimal',
      tools: ['select', 'hand'],
    };
    const onNavigate = vi.fn();
    render(<RegistryDetail entry={entry} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('select'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toEqual({ kind: 'tool', id: 'select' });
  });

  it('renders an Icon entry with a visual preview', () => {
    const Component = () => <svg data-testid="icon-svg" width={16} height={16} />;
    const entry: TreeEntry = { kind: 'icon', id: 'TestIcon', label: 'TestIcon', source: 'action', Component };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getAllByTestId('icon-svg').length).toBeGreaterThanOrEqual(2);
  });

  it('renders a ShapeKind entry with id', () => {
    const entry: TreeEntry = { kind: 'shapeKind', id: 'rect', label: 'rect' };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText('rect')).toBeTruthy();
  });

  it('renders an OpFactory entry with id', () => {
    const entry: TreeEntry = { kind: 'opFactory', id: 'createInsertOp', label: 'createInsertOp' };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText('createInsertOp')).toBeTruthy();
  });

  it('renders a PublicExport entry with id', () => {
    const entry: TreeEntry = { kind: 'publicExport', id: 'SceneCanvas', label: 'SceneCanvas' };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText('SceneCanvas')).toBeTruthy();
  });
});
