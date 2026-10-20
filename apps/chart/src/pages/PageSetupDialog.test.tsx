import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { iconsWrapper } from '@weasel-js/ui/testing/withIcons';
import { CHART_PAGE } from '../chartDocument';
import { PageSetupDialog } from './PageSetupDialog';

afterEach(cleanup);

function setup() {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(<PageSetupDialog page={{ name: 'Page 1', size: CHART_PAGE }} onApply={onApply} onClose={onClose} />, { wrapper: iconsWrapper() });
  return { onApply, onClose };
}

/** Opens the select labeled `label` and picks the option named `option`. */
function pick(label: string, option: string): void {
  act(() => { fireEvent.click(screen.getByRole('button', { name: new RegExp(label) })); });
  act(() => { fireEvent.click(screen.getByRole('option', { name: option })); });
}

describe('PageSetupDialog', () => {
  it('shows the page as landscape Letter, its size fixed by the paper', () => {
    setup();
    expect(screen.getByRole('button', { name: /Size/ }).textContent).toContain('Letter');
    expect(screen.getByRole('button', { name: /Orientation/ }).textContent).toContain('Landscape');
  });

  it('applies a paper turned the other way', () => {
    const { onApply, onClose } = setup();
    pick('Size', 'A4');
    pick('Orientation', 'Portrait');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Apply' })); });
    expect(onApply).toHaveBeenCalledWith({ width: 794, height: 1123 });
    expect(onClose).toHaveBeenCalled();
  });
});
