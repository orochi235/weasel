import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIcons } from '../../testing/withIcons';
import { DialogRow } from './DialogRow';

function setup() {
  const calls: string[] = [];
  renderWithIcons(
    <DialogRow
      label="Globs"
      summary="a"
      onOpen={() => calls.push('open')}
      onDone={() => calls.push('done')}
      onCancel={() => calls.push('cancel')}
    >
      {() => <input aria-label="glob" />}
    </DialogRow>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit Globs' }));
  return calls;
}

describe('DialogRow given onCancel', () => {
  it('reports opening, and Done as done', () => {
    const calls = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(calls).toEqual(['open', 'done']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('draws a Cancel button beside Done, which cancels', () => {
    const calls = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(calls).toEqual(['open', 'cancel']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancels on Escape', () => {
    const calls = setup();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'glob' }), { key: 'Escape' });
    expect(calls).toEqual(['open', 'cancel']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DialogRow without onCancel', () => {
  it('draws no Cancel button, and Escape still closes it as done', () => {
    const onDone = vi.fn();
    renderWithIcons(
      <DialogRow label="Globs" summary="a" onDone={onDone}>
        {() => <input aria-label="glob" />}
      </DialogRow>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Globs' }));
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'glob' }), { key: 'Escape' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
