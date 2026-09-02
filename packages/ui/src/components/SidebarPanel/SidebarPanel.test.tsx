import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarPanel } from './SidebarPanel';
import { ICON_PATHS } from '../../icons';

// jsdom neither lays out nor resolves transforms, so nothing here asserts that
// the chevron spins concentrically — that is measured from real pixels in the
// Playwright proof. These cover markup only.
describe('SidebarPanel', () => {
  it('renders a static title with no toggle when onToggleCollapse is omitted', () => {
    render(<SidebarPanel title="Properties">body</SidebarPanel>);
    expect(screen.getByText('Properties')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the collapse toggle as a button reporting aria-expanded', () => {
    const onToggleCollapse = vi.fn();
    const { rerender } = render(
      <SidebarPanel title="Properties" onToggleCollapse={onToggleCollapse}>body</SidebarPanel>,
    );
    const btn = screen.getByRole('button', { expanded: true });
    fireEvent.click(btn);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);

    rerender(
      <SidebarPanel title="Properties" collapsed onToggleCollapse={onToggleCollapse}>body</SidebarPanel>,
    );
    expect(screen.getByRole('button', { expanded: false })).toBeTruthy();
    expect(screen.queryByText('body')).toBeNull();
  });

  it('draws the chevron as the icon-set glyph, not a text triangle', () => {
    const { container } = render(
      <SidebarPanel title="Properties" onToggleCollapse={() => {}}>body</SidebarPanel>,
    );
    const btn = screen.getByRole('button');
    expect(btn.textContent).toBe('Properties');
    expect(btn.textContent).not.toMatch(/[▲-▿]/);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    // The glyph body is the generated `chevron` path — the same one the
    // Playwright proof measured for concentricity. jsdom rewrites the
    // self-closing tag, so match the `d` rather than the whole body.
    const d = ICON_PATHS.chevron.match(/ d="([^"]+)"/)![1];
    expect(svg!.querySelector('path')?.getAttribute('d')).toBe(d);
  });

  it('sizes the chevron at 16px so it reads beside the 11px title', () => {
    const { container } = render(
      <SidebarPanel title="Properties" onToggleCollapse={() => {}}>body</SidebarPanel>,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
  });

  it('marks the chevron collapsed so CSS can rotate it', () => {
    const { container, rerender } = render(
      <SidebarPanel title="Properties" onToggleCollapse={() => {}}>body</SidebarPanel>,
    );
    const open = container.querySelector('svg')!.getAttribute('class') ?? '';
    rerender(
      <SidebarPanel title="Properties" collapsed onToggleCollapse={() => {}}>body</SidebarPanel>,
    );
    const shut = container.querySelector('svg')!.getAttribute('class') ?? '';
    expect(shut).not.toBe(open);
    expect(shut.split(' ')).toEqual(expect.arrayContaining(open.split(' ')));
  });

  it('renders the hide button only when onHide is given', () => {
    const onHide = vi.fn();
    const { rerender } = render(<SidebarPanel title="Properties">body</SidebarPanel>);
    expect(screen.queryByRole('button', { name: 'Hide panel' })).toBeNull();
    rerender(<SidebarPanel title="Properties" onHide={onHide}>body</SidebarPanel>);
    fireEvent.click(screen.getByRole('button', { name: 'Hide panel' }));
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
