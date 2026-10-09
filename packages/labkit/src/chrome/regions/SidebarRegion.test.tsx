import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RegionContribution, TrialChromeContext } from '../types';
import { SidebarRegion } from './SidebarRegion';

const ctx = {
  collapsedSections: {},
  setSectionCollapsed: () => {},
} as unknown as TrialChromeContext;

describe('<SidebarRegion> stance and tone', () => {
  it('puts a section’s stance and tone on the section', () => {
    const contributions: RegionContribution<TrialChromeContext>[] = [
      { id: 'a', region: 'sidebar', item: { title: 'Plain', body: 'x' } },
      {
        id: 'b',
        region: 'sidebar',
        item: { title: 'Debug', body: 'y', stance: 'debug', tone: '#224a63' },
      },
    ];
    const { container } = render(<SidebarRegion contributions={contributions} ctx={ctx} />);
    const [plain, debug] = [...container.querySelectorAll<HTMLElement>('.lk-sidebar-section')];
    expect(plain.hasAttribute('data-stance')).toBe(false);
    expect(debug.dataset.stance).toBe('debug');
    expect(debug.style.getPropertyValue('--wzl-tone')).toBe('#224a63');
  });
});

describe('<SidebarRegion> actions', () => {
  const contributions: RegionContribution<TrialChromeContext>[] = [
    { id: 'a', region: 'sidebar', item: { title: 'Vars', body: 'x', actions: <button type="button">Jump</button> } },
  ];

  it('draws a section’s actions in its title bar', () => {
    const { container } = render(<SidebarRegion contributions={contributions} ctx={ctx} />);
    const bar = container.querySelector('.lk-sidebar-section__bar') as HTMLElement;
    expect(bar.contains(screen.getByRole('button', { name: 'Jump' }))).toBe(true);
  });

  it('hides them while the section is folded', () => {
    const folded = { ...ctx, collapsedSections: { a: true } } as TrialChromeContext;
    render(<SidebarRegion contributions={contributions} ctx={folded} />);
    expect(screen.queryByRole('button', { name: 'Jump' })).toBeNull();
  });
});
