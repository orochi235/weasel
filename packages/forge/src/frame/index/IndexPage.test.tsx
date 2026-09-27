import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { meta, story } from '../../story/define';
import { loadNativeModule } from '../../story/native';
import type { ComponentDeps } from '../../story/types';
import { type IndexEnv, IndexPage } from './IndexPage';

const stories = loadNativeModule(
  { default: meta({ title: 'ui/Dialog' }), Basic: story({ render: () => <p>dialog</p> }) },
  'ui/Dialog',
);

const envOf = (over: Partial<IndexEnv> = {}): IndexEnv => ({
  title: 'ui/Dialog',
  stories,
  descriptions: {},
  globals: {},
  decorators: [],
  open: vi.fn(),
  onError: vi.fn(),
  ...over,
});

const DEPS: ComponentDeps = { source: 'ui/Dialog/Dialog.tsx', uses: ['ui/Badge', 'ui/Foundations/Button'], usedBy: [] };

describe('IndexPage', () => {
  it('lists what the component uses and what uses it, each linking to that component’s index page', () => {
    const env = envOf({ dependencies: { ...DEPS, usedBy: ['draw/CommandBar'] } });
    render(<IndexPage env={env} render={null} />);
    const uses = screen.getByRole('list', { name: 'Uses' });
    const links = within(uses).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['ui/Badge', 'ui/Foundations/Button']);
    expect(links[1]?.getAttribute('href')).toBe('#/ui-foundations-button%3Aindex');
    fireEvent.click(links[1] as HTMLElement);
    expect(env.open).toHaveBeenCalledWith('ui-foundations-button:index');
    const usedBy = screen.getByRole('list', { name: 'Used by' });
    expect(within(usedBy).getByRole('link').textContent).toBe('draw/CommandBar');
  });

  it('says when a list is empty', () => {
    render(<IndexPage env={envOf({ dependencies: DEPS })} render={null} />);
    expect(screen.getByText('No listed component uses it.')).toBeTruthy();
  });

  it('says why a component with no source file lists nothing', () => {
    render(<IndexPage env={envOf({ dependencies: { source: null, uses: [], usedBy: [] } })} render={null} />);
    expect(screen.getByText(/no source file/i)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Uses' })).toBeNull();
  });

  it('labels a gallery and lists no dependencies on it', () => {
    render(<IndexPage env={envOf({ gallery: true, dependencies: DEPS })} render={null} />);
    expect(screen.getByText('Gallery')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Uses' })).toBeNull();
  });

  it('labels a story tagged as a gallery on its own', () => {
    render(<IndexPage env={envOf({ galleries: ['ui-dialog--basic'] })} render={null} />);
    const section = screen.getByRole('region', { name: 'Basic' });
    expect(within(section).getByText('Gallery')).toBeTruthy();
  });

  it('shows no dependency section before the graph arrives', () => {
    render(<IndexPage env={envOf()} render={null} />);
    expect(screen.queryByRole('list', { name: 'Uses' })).toBeNull();
    expect(screen.queryByText(/no source file/i)).toBeNull();
  });
});
