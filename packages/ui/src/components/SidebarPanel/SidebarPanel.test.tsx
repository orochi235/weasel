import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarPanel } from './SidebarPanel';

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

  it('draws the fold mark, not a text triangle, and shows the panel’s state on it', () => {
    const { container, rerender } = render(
      <SidebarPanel title="Properties" onToggleCollapse={() => {}}>body</SidebarPanel>,
    );
    const btn = screen.getByRole('button');
    expect(btn.textContent).toBe('Properties');
    const sign = () => container.querySelector('svg path')?.getAttribute('d');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(sign()).toBe('M3 6.5 H10');
    rerender(
      <SidebarPanel title="Properties" collapsed onToggleCollapse={() => {}}>body</SidebarPanel>,
    );
    expect(sign()).toBe('M3 6.5 H10 M6.5 3 V10');
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

// The CSS-module proxy answers any key, so the class only proves the static
// title asked for the box; the stylesheet read proves the box shares the
// collapsible title's inset.
describe('SidebarPanel static title', () => {
  it('sits in the same inset box as the collapsible title', () => {
    render(<SidebarPanel title="Properties">body</SidebarPanel>);
    expect(screen.getByText('Properties').className).toMatch(/titleBox/);
    const css = readFileSync(resolve(__dirname, 'SidebarPanel.module.css'), 'utf8');
    expect(css).toMatch(/\.titleBox\s*\{[^}]*padding: var\(--wzl-space-2\) var\(--wzl-space-4\);/);
    expect(css).not.toMatch(/\.titleButton\s*\{[^}]*padding:/);
  });

  it('gives the collapsible title the same box', () => {
    render(<SidebarPanel title="Properties" onToggleCollapse={() => {}}>body</SidebarPanel>);
    expect(screen.getByRole('button').className).toMatch(/titleBox/);
  });
});
