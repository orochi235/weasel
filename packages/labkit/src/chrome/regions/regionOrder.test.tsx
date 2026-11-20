import { screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { icon } from '../../icons.gen';
import type { TrialChromeContext, TrialContribution } from '../types';
import { PaletteRegion } from './PaletteRegion';
import { SidebarRegion } from './SidebarRegion';
import { TitleBarRegion } from './TitleBarRegion';
import { ViewportRegion } from './ViewportRegion';

const Glyph = icon('ui:add');
const ctx = {
  trialId: 't1',
  activeToolId: null,
  setActiveTool: vi.fn(),
  undockedPanels: [],
  collapsedSections: {},
  setSectionCollapsed: () => {},
} as unknown as TrialChromeContext;

type Region = 'titlebar' | 'viewport' | 'palette';
const at =
  (region: Region) =>
  (id: string, over: Partial<TrialContribution> = {}): TrialContribution =>
    ({
      id,
      region,
      item: { icon: Glyph, label: id, onActivate: () => {} },
      ...over,
    }) as TrialContribution;

const names = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));

// The order every region gives `[a, end:b, c, a's group-mate d]`: a group together, end groups last.
describe('every region lays its groups out together, end groups last', () => {
  const declared = (make: (id: string, over?: Partial<TrialContribution>) => TrialContribution) => [
    make('a', { group: 'g' }),
    make('b', { end: true }),
    make('c'),
    make('d', { group: 'g' }),
  ];

  it('viewport', () => {
    renderWithIcons(<ViewportRegion contributions={declared(at('viewport'))} ctx={ctx} />);
    expect(names()).toEqual(['a', 'd', 'c', 'b']);
  });

  it('palette', () => {
    renderWithIcons(<PaletteRegion contributions={declared(at('palette'))} ctx={ctx} />);
    expect(names()).toEqual(['a', 'd', 'c', 'b']);
  });

  it('title bar, in its lead span', () => {
    renderWithIcons(
      <TitleBarRegion placement="lead" contributions={declared(at('titlebar'))} ctx={ctx} />,
    );
    expect(names()).toEqual(['a', 'd', 'c']);
  });

  it('title bar, taking a whole group to its actions when one member sets end', () => {
    const make = at('titlebar');
    renderWithIcons(
      <TitleBarRegion
        contributions={[
          make('a', { group: 'g' }),
          make('b', { end: true }),
          make('d', { group: 'g', end: true }),
        ]}
        ctx={ctx}
      />,
    );
    expect(names()).toEqual(['a', 'd', 'b']);
  });

  it('sidebar', () => {
    const section = (id: string, over: Partial<TrialContribution> = {}): TrialContribution =>
      ({
        id,
        region: 'sidebar',
        item: { title: id, body: <i data-section={id} /> },
        ...over,
      }) as TrialContribution;
    const { container } = renderWithIcons(
      <SidebarRegion
        contributions={[
          section('A', { group: 'g' }),
          section('B', { end: true }),
          section('C'),
          section('D', { group: 'g' }),
        ]}
        ctx={ctx}
      />,
    );
    const order = [...container.querySelectorAll('[data-section]')].map((el) =>
      el.getAttribute('data-section'),
    );
    expect(order).toEqual(['A', 'D', 'C', 'B']);
  });
});
