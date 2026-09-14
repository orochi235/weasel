import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
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

  it('while inspecting, a click leaves the components as they were', async () => {
    render(<ThemePreview variants={[{ label: 'Draft', theme }]} selection={{}} inspecting onInspect={() => {}} />);
    const checkbox = screen.getAllByRole('checkbox', { name: 'Checkbox' })[0];
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  // A proxy: jsdom cannot drag the Slider, so this asserts the press never reaches it.
  it('while inspecting, a press is stopped before any component sees it', () => {
    render(<ThemePreview variants={[{ label: 'Draft', theme }]} selection={{}} inspecting onInspect={() => {}} />);
    const thumb = screen.getAllByRole('slider', { name: 'Slider' })[0];
    for (const make of [createEvent.pointerDown, createEvent.mouseDown]) {
      const event = make(thumb);
      fireEvent(thumb, event);
      expect(event.defaultPrevented).toBe(true);
    }
  });
});
