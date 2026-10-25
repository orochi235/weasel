import { cssColorLiteral } from '@weasel-js/paint';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { SidebarPanel } from './SidebarPanel';
import { renderWithIcons } from '../../testing/withIcons';

describe('SidebarPanel', () => {
  it('renders a static title with no toggle when onToggleCollapse is omitted', () => {
    renderWithIcons(<SidebarPanel title="Properties">body</SidebarPanel>);
    expect(screen.getByText('Properties')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws its actions in the header, before the close button, and keeps them while collapsed', () => {
    const { rerender } = renderWithIcons(
      <SidebarPanel title="Path" onToggleCollapse={() => {}} onHide={() => {}} actions={<button type="button">Switch</button>}>
        body
      </SidebarPanel>,
    );
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual(['Path', 'Switch', 'Hide panel']);
    rerender(
      <SidebarPanel title="Path" collapsed onToggleCollapse={() => {}} actions={<button type="button">Switch</button>}>
        body
      </SidebarPanel>,
    );
    expect(screen.getByRole('button', { name: 'Switch' })).toBeTruthy();
  });

  it('renders the collapse toggle as a button reporting aria-expanded', () => {
    const onToggleCollapse = vi.fn();
    const { rerender } = renderWithIcons(
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
    const { container, rerender } = renderWithIcons(
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

  it('names its body with aria-controls while open, and nothing while the body is unmounted', () => {
    const { rerender } = renderWithIcons(
      <SidebarPanel title="Layers" onToggleCollapse={() => {}}>body</SidebarPanel>,
    );
    const id = screen.getByRole('button').getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toBe('body');
    rerender(<SidebarPanel title="Layers" collapsed onToggleCollapse={() => {}}>body</SidebarPanel>);
    expect(screen.getByRole('button').hasAttribute('aria-controls')).toBe(false);
  });

  it('draws trailing controls after the actions and before the close button, folded or not', () => {
    renderWithIcons(
      <SidebarPanel
        title="Path"
        collapsed
        onToggleCollapse={() => {}}
        onHide={() => {}}
        actions={<button type="button">Switch</button>}
        trailing={<button type="button">Undock</button>}
      >
        body
      </SidebarPanel>,
    );
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual(['Path', 'Switch', 'Undock', 'Hide panel']);
  });

  it('marks a filling panel only while it is open', () => {
    const { container, rerender } = renderWithIcons(<SidebarPanel title="List" fill>body</SidebarPanel>);
    const root = () => container.firstElementChild as HTMLElement;
    expect(root().hasAttribute('data-fill')).toBe(true);
    rerender(<SidebarPanel title="List" fill collapsed>body</SidebarPanel>);
    expect(root().hasAttribute('data-fill')).toBe(false);
  });

  it('hands its header to headerRef, and its parts their classes', () => {
    let header: HTMLDivElement | null = null;
    renderWithIcons(
      <SidebarPanel
        title="Notes"
        headerRef={(el) => {
          header = el;
        }}
        headerClassName="bar"
        titleClassName="head"
        bodyClassName="inside"
      >
        body
      </SidebarPanel>,
    );
    expect(header).not.toBeNull();
    expect(header!.classList.contains('bar')).toBe(true);
    expect(screen.getByText('Notes').classList.contains('head')).toBe(true);
    expect(screen.getByText('body').classList.contains('inside')).toBe(true);
  });

  it('carries its stance and tint on its root', () => {
    const { container } = renderWithIcons(
      <SidebarPanel title="Debug" stance="debug" tint={cssColorLiteral('#224a63')}>body</SidebarPanel>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.stance).toBe('debug');
    expect(root.style.getPropertyValue('--wzl-tint')).toBe('#224a63');
  });

  it('renders the hide button only when onHide is given', () => {
    const onHide = vi.fn();
    const { rerender } = renderWithIcons(<SidebarPanel title="Properties">body</SidebarPanel>);
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
    renderWithIcons(<SidebarPanel title="Properties">body</SidebarPanel>);
    expect(screen.getByText('Properties').className).toMatch(/titleBox/);
    const css = readFileSync(resolve(__dirname, 'SidebarPanel.module.css'), 'utf8');
    expect(css).toMatch(/:where\(\.titleBox\)\s*\{[^}]*padding: var\(--wzl-space-2\) var\(--wzl-space-4\);/);
    expect(css).not.toMatch(/\.titleButton\)?\s*\{[^}]*padding:/);
  });

  it('gives the collapsible title the same box', () => {
    renderWithIcons(<SidebarPanel title="Properties" onToggleCollapse={() => {}}>body</SidebarPanel>);
    expect(screen.getByRole('button').className).toMatch(/titleBox/);
  });
});
