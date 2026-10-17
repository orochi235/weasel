import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { Dialog } from './Dialog';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = '.own-flex { flex: 0 0 auto; min-height: 37px; padding: 3px; overflow: visible; }';
  document.head.prepend(style);
});

// The consumer's sheet is first in the document, so a body default left outside `:where()`
// ties with it on specificity and wins on order.
test('bodyClassName can replace every default the body sets', () => {
  renderWithIcons(<Dialog isOpen title="Sized" bodyClassName="own-flex">body</Dialog>);
  const body = getComputedStyle(screen.getByText('body'));
  expect(body.flexGrow).toBe('0');
  expect(body.minHeight).toBe('37px');
  expect(body.paddingTop).toBe('3px');
  expect(body.overflowY).toBe('visible');
});

test('a click outside closes the dialog only when isDismissable is set', async () => {
  const onOpenChange = vi.fn();
  const { rerender } = renderWithIcons(<Dialog isOpen onOpenChange={onOpenChange} title="Stay">body</Dialog>);
  await userEvent.click(document.querySelector('[data-weasel-overlay]')!);
  expect(onOpenChange).not.toHaveBeenCalled();
  rerender(<Dialog isOpen isDismissable onOpenChange={onOpenChange} title="Stay">body</Dialog>);
  await userEvent.click(document.querySelector('[data-weasel-overlay]')!);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
