import '@weasel-js/theme/tokens.css';
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Button } from '@weasel-js/ui/components/Button';

afterEach(cleanup);

// Enter and Space activating a button, and a submitter reaching its form by `form`, are the browser's to deliver.
test('Space on a custom disclosure trigger toggles it', async () => {
  function Section() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button aria-expanded={open} aria-controls="panel" onClick={() => setOpen(!open)}>Details</Button>
        <div id="panel" hidden={!open}>Body</div>
      </>
    );
  }
  render(<Section />);
  const trigger = screen.getByRole('button', { name: 'Details' });
  trigger.focus();
  await userEvent.keyboard(' ');
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Body')).toBeVisible();
});

test('Enter on a submitter outside its form submits that form with its name and value', async () => {
  const sent = vi.fn();
  render(
    <>
      <form id="order" onSubmit={(e) => {
        e.preventDefault();
        const by = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        sent(by?.name, by?.value);
      }} />
      <Button type="submit" form="order" name="intent" value="save">Save</Button>
    </>,
  );
  screen.getByRole('button', { name: 'Save' }).focus();
  await userEvent.keyboard('{Enter}');
  expect(sent).toHaveBeenCalledWith('intent', 'save');
});

test('Tab reaches only the roving stop of a toolbar of buttons', async () => {
  render(
    <>
      <button type="button">Before</button>
      <div role="toolbar" aria-label="Align">
        <Button tabIndex={-1}>Left</Button>
        <Button tabIndex={0}>Center</Button>
        <Button tabIndex={-1}>Right</Button>
      </div>
      <button type="button">After</button>
    </>,
  );
  screen.getByRole('button', { name: 'Before' }).focus();
  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Center' })).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
});
