import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pressable } from 'react-aria-components';
import { ComboBox } from '../ComboBox';
import { Callout, CalloutTrigger } from './Callout';
import { renderWithIcons } from '../../testing/withIcons';

const OPTIONS = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }];
const RECT = { x: 0, y: 0, width: 10, height: 10 };

function Composed({ onDismiss, combo }: { onDismiss: () => void; combo?: boolean }) {
  return (
    <CalloutTrigger>
      <Pressable>
        <button type="button">Explain</button>
      </Pressable>
      <Callout title="Heads up" onDismiss={onDismiss}>
        {combo ? <ComboBox aria-label="Fruit" options={OPTIONS} /> : 'Body text'}
      </Callout>
    </CalloutTrigger>
  );
}

/** Open the combo box's menu, then press Escape, which closes the menu and leaves the callout up. */
async function escapeTheMenu(): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
}

describe('Callout onDismiss and Escape', () => {
  it('stays quiet for an Escape that closed a menu inside a pinned callout', async () => {
    const onDismiss = vi.fn();
    renderWithIcons(
      <Callout isOpen anchorRect={RECT} title="Note" onDismiss={onDismiss}>
        <ComboBox aria-label="Fruit" options={OPTIONS} />
      </Callout>,
    );
    await escapeTheMenu();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('stays quiet for an Escape that closed a menu inside a composed callout', async () => {
    const onDismiss = vi.fn();
    renderWithIcons(<Composed onDismiss={onDismiss} combo />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    await escapeTheMenu();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not hold that Escape against a later close by other means', async () => {
    const onDismiss = vi.fn();
    const onOpenChange = vi.fn();
    renderWithIcons(
      <>
        <button type="button">outside</button>
        <Callout isOpen anchorRect={RECT} title="Note" onDismiss={onDismiss} onOpenChange={onOpenChange}>
          <ComboBox aria-label="Fruit" options={OPTIONS} />
        </Callout>
      </>,
    );
    await escapeTheMenu();
    await new Promise((r) => setTimeout(r, 0));
    await userEvent.setup().click(screen.getByRole('button', { name: 'outside' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('reports the Escape that closes a composed callout', () => {
    const onDismiss = vi.fn();
    renderWithIcons(<Composed onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
