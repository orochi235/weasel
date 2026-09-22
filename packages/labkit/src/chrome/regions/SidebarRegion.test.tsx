import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RegionContribution, TrialChromeContext } from '../types';
import { SidebarRegion } from './SidebarRegion';

const ctx = { collapsedSections: {}, setSectionCollapsed: () => {} } as unknown as TrialChromeContext;

describe('<SidebarRegion> stance and tone', () => {
  it('puts a section’s stance and tone on the section', () => {
    const contributions: RegionContribution<TrialChromeContext>[] = [
      { id: 'a', region: 'sidebar', item: { title: 'Plain', body: 'x' } },
      { id: 'b', region: 'sidebar', item: { title: 'Debug', body: 'y', stance: 'debug', tone: '#224a63' } },
    ];
    const { container } = render(<SidebarRegion contributions={contributions} ctx={ctx} />);
    const [plain, debug] = [...container.querySelectorAll<HTMLElement>('.lk-sidebar-section')];
    expect(plain.hasAttribute('data-stance')).toBe(false);
    expect(debug.dataset.stance).toBe('debug');
    expect(debug.style.getPropertyValue('--wzl-tone')).toBe('#224a63');
  });
});
