import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import { FIRST_RUN_KEY, showFirstRunNotice } from './firstRunNotice';
import { renderWithIcons } from './testIcons';

afterEach(() => {
  act(() => defaultToastQueue.clear());
  localStorage.removeItem(FIRST_RUN_KEY);
});

const TITLE = 'WeaselDraw is an alpha';

describe('showFirstRunNotice', () => {
  it('shows the notice on the first run and records that it did', () => {
    renderWithIcons(<ToastRegion />);
    act(() => showFirstRunNotice());
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(localStorage.getItem(FIRST_RUN_KEY)).not.toBeNull();
  });

  it('stays quiet on every run after', () => {
    localStorage.setItem(FIRST_RUN_KEY, '1');
    renderWithIcons(<ToastRegion />);
    act(() => showFirstRunNotice());
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('shows one notice when asked twice, as a StrictMode mount does', () => {
    renderWithIcons(<ToastRegion />);
    act(() => { showFirstRunNotice(); showFirstRunNotice(); });
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
  });

  it('still shows when the store cannot be read or written', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    renderWithIcons(<ToastRegion />);
    act(() => showFirstRunNotice(broken));
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });
});
