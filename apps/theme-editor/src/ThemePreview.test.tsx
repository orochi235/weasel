import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemePreview } from './ThemePreview';
import { child, lookupOf } from './theme/fixtures';
import { runtimeTheme } from './theme/model';

const theme = runtimeTheme(child, lookupOf(child), 'draft-child');

describe('<ThemePreview>', () => {
  afterEach(cleanup);

  it('applies the draft theme to one pane per mode', () => {
    render(<ThemePreview variants={[{ label: 'Draft', theme }]} selection={{}} />);
    const panes = [...document.querySelectorAll('[data-wzl-theme="draft-child"]')];
    expect(panes.map((p) => p.getAttribute('data-wzl-mode'))).toEqual(['dark', 'light']);
  });

  it('labels each variant once there is more than one', () => {
    render(<ThemePreview variants={[{ label: 'Pinned', theme }, { label: 'Generated', theme: { ...theme, name: 'draft-child-generated' } }]} selection={{}} />);
    expect(screen.getByRole('region', { name: 'Pinned' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Generated' })).toBeInTheDocument();
  });

  it('while inspecting, hands the clicked element and its pane to onInspect', async () => {
    const onInspect = vi.fn();
    render(<ThemePreview variants={[{ label: 'Draft', theme }]} selection={{}} inspecting onInspect={onInspect} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Primary' })[0]);
    expect(onInspect).toHaveBeenCalledTimes(1);
    const [target, pane] = onInspect.mock.calls[0] as [Element, Element];
    expect(pane.contains(target)).toBe(true);
  });
});
