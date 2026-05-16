import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { RegistryDetail } from './RegistryDetail';
import type { TreeEntry } from './registryData';

describe('RegistryDetail', () => {
  it('renders a Tool entry with id and contributed actions', () => {
    const entry: TreeEntry = {
      kind: 'tool',
      id: 'rect',
      label: 'useRectTool',
      contributesActionIds: ['insert.rect', 'commit.rect'],
    };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getAllByText(/rect/).length).toBeGreaterThan(0);
    expect(screen.getByText('insert.rect')).toBeTruthy();
  });

  it('renders an Action entry with shortcut', () => {
    const entry: TreeEntry = { kind: 'action', id: 'delete', label: 'Delete', shortcut: 'Backspace' };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText('Backspace')).toBeTruthy();
  });

  it('renders a Bundle with clickable members that fire onNavigate', () => {
    const entry: TreeEntry = {
      kind: 'bundle', id: 'minimal', label: 'Minimal',
      tools: ['select', 'hand'], actions: ['escape'],
    };
    const onNavigate = vi.fn();
    render(<RegistryDetail entry={entry} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('select'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toEqual({ kind: 'tool', id: 'select' });
  });
});
