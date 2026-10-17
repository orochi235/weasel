import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { icon } from '../../icons.gen';
import type { TrialChromeContext, TrialContribution } from '../types';
import { SidebarRegion } from './SidebarRegion';
import { StatusRegion } from './StatusRegion';
import { ViewportRegion } from './ViewportRegion';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

const Glyph = icon('ui:add');
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
    const { container } = renderWithIcons(<SidebarRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each section with its title and body', () => {
    const contributions: TrialContribution[] = [
      { id: 'settings', region: 'sidebar', item: { title: 'Settings', body: <p>fields</p> } },
      { id: 'layers', region: 'sidebar', item: { title: 'Layers', body: <p>list</p> } },
    ];
    renderWithIcons(<SidebarRegion contributions={contributions} ctx={ctx} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('fields')).toBeInTheDocument();
    expect(screen.getByText('Layers')).toBeInTheDocument();
  });

  it('starts a section collapsed when it asks to', () => {
    renderWithIcons(
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
    renderWithIcons(
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
    renderWithIcons(
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
    const { container } = renderWithIcons(<StatusRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each readout as text', () => {
    renderWithIcons(
      <StatusRegion
        contributions={[{ id: 'zoom', region: 'status', item: { text: '150%' } }]}
        ctx={ctx}
      />,
    );
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('pushes the first readout marked end, and the ones after it, past one spacer', () => {
    const { container } = renderWithIcons(
      <StatusRegion
        contributions={[
          { id: 'a', region: 'status', item: { text: 'A' } },
          { id: 'b', region: 'status', end: true, item: { text: 'B' } },
          { id: 'c', region: 'status', end: true, item: { text: 'C' } },
        ]}
        ctx={ctx}
      />,
    );
    const bar = container.querySelector('footer') as HTMLElement;
    const kids = [...bar.children].map((el) =>
      el.getAttribute('aria-hidden') === 'true' ? '|' : el.textContent,
    );
    expect(kids).toEqual(['A', '|', 'B', 'C']);
  });

  it('keeps a readout title as its hover text', () => {
    renderWithIcons(
      <StatusRegion
        contributions={[{ id: 'z', region: 'status', item: { text: '150%', title: 'zoom' } }]}
        ctx={ctx}
      />,
    );
    expect(screen.getByText('150%').closest('[title]')?.getAttribute('title')).toBe('zoom');
  });
});

describe('ViewportRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = renderWithIcons(<ViewportRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hands onActivate the chrome context', () => {
    const onActivate = vi.fn();
    renderWithIcons(
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

  it('names an item in a kit tooltip, not in a native title', () => {
    renderWithIcons(
      <ViewportRegion
        contributions={[
          {
            id: 'fit',
            region: 'viewport',
            item: { icon: Glyph, label: 'Fit', onActivate: () => {} },
          },
        ]}
        ctx={ctx}
      />,
    );
    const fit = screen.getByRole('button', { name: 'Fit' });
    expect(fit).not.toHaveAttribute('title');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => fit.focus());
    expect(screen.getByRole('tooltip').textContent).toContain('Fit');
  });
});
