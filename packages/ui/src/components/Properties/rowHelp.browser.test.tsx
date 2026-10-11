import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PropertyField } from './PropertyField';

// Which element Tab lands on, and whether a focus came from the keyboard, are the browser's to say:
// jsdom has no tab order and reads every focus as one a key made.

afterEach(cleanup);

const tip = (): HTMLElement | null => screen.queryByRole('tooltip');
const settle = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

function Rows() {
  return (
    <>
      <button type="button">Before</button>
      <PropertyField kind="string" label="Author" value="a" onChange={() => {}} description="Who made it." />
      <PropertyField kind="string" label="Title" value="t" onChange={() => {}} description="What it is called." />
      <button type="button">After</button>
    </>
  );
}

test('Tab crosses a described row in one stop, and the help opens for the control it lands on', async () => {
  render(<Rows />);
  screen.getByRole('button', { name: 'Before' }).focus();
  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Author' }));
  expect(document.activeElement).toHaveAccessibleDescription('Who made it.');
  await expect.poll(() => tip()?.textContent).toBe('Who made it.');

  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title' }));
  await expect.poll(() => tip()?.textContent).toBe('What it is called.');

  await userEvent.keyboard('{Escape}');
  await expect.poll(tip).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title' }));

  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
});

test('a click on a described row\'s control opens no help', async () => {
  render(<Rows />);
  await userEvent.click(screen.getByRole('textbox', { name: 'Author' }));
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Author' }));
  await settle(900);
  expect(tip()).toBeNull();
});
