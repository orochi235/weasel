import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TrialChromeContext, TrialContribution } from '../types';
import { SidebarRegion } from './SidebarRegion';
import { StatusRegion } from './StatusRegion';
import { ViewportRegion } from './ViewportRegion';

const Glyph = () => <svg />;
const ctx = {
  trialId: 't1',
  undockedPanels: [],
  collapsedSections: {},
  setSectionCollapsed: () => {},
  undockPanel: () => {},
  dockPanel: () => {},
} as unknown as TrialChromeContext;

describe('SidebarRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<SidebarRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each section with its title and body', () => {
    const contributions: TrialContribution[] = [
      { id: 'settings', region: 'sidebar', item: { title: 'Settings', body: <p>fields</p> } },
      { id: 'layers', region: 'sidebar', item: { title: 'Layers', body: <p>list</p> } },
    ];
    render(<SidebarRegion contributions={contributions} ctx={ctx} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('fields')).toBeInTheDocument();
    expect(screen.getByText('Layers')).toBeInTheDocument();
  });

  it('starts a section collapsed when it asks to', () => {
    render(
      <SidebarRegion
        contributions={[
          {
            id: 's',
            region: 'sidebar',
            item: { title: 'S', defaultCollapsed: true, body: <p>hidden</p> },
          },
        ]}
        ctx={ctx}
      />,
    );
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });

  it('takes the trial’s remembered fold over the section’s default', () => {
    render(
      <SidebarRegion
        contributions={[
          {
            id: 's',
            region: 'sidebar',
            item: { title: 'S', defaultCollapsed: true, body: <p>shown</p> },
          },
        ]}
        ctx={{ ...ctx, collapsedSections: { s: false } }}
      />,
    );
    expect(screen.getByText('shown')).toBeInTheDocument();
  });

  it('reports a toggle rather than keeping the fold itself', () => {
    const setSectionCollapsed = vi.fn();
    render(
      <SidebarRegion
        contributions={[{ id: 's', region: 'sidebar', item: { title: 'S', body: <p>body</p> } }]}
        ctx={{ ...ctx, setSectionCollapsed }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'S' }));
    expect(setSectionCollapsed).toHaveBeenCalledWith('s', true);
  });
});

describe('StatusRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<StatusRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each readout as text', () => {
    render(
      <StatusRegion
        contributions={[{ id: 'zoom', region: 'status', item: { text: '150%' } }]}
        ctx={ctx}
      />,
    );
    expect(screen.getByText('150%')).toBeInTheDocument();
  });
});

describe('ViewportRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<ViewportRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fires a control on click', () => {
    const onActivate = vi.fn();
    render(
      <ViewportRegion
        contributions={[
          { id: 'fit', region: 'viewport', item: { icon: Glyph, label: 'Fit', onActivate } },
        ]}
        ctx={ctx}
      />,
    );
    screen.getByRole('button', { name: 'Fit' }).click();
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('hands onActivate the chrome context', () => {
    const onActivate = vi.fn();
    render(
      <ViewportRegion
        contributions={[
          { id: 'fit', region: 'viewport', item: { icon: Glyph, label: 'Fit', onActivate } },
        ]}
        ctx={ctx}
      />,
    );
    screen.getByRole('button', { name: 'Fit' }).click();
    expect(onActivate).toHaveBeenCalledWith(ctx);
  });
});
