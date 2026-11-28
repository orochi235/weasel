import { cleanup, render, screen } from '@testing-library/react';
import { pref } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const SCHEMA = pref.group('', {
  account: pref.group('Account', { name: pref.string('Name', ''), seats: pref.number('Seats', 1) }),
});

it("shows a leaf's message from `errors` under its row, and marks only that row invalid", () => {
  const { container } = render(
    <PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} errors={new Map([['account.name', 'Name is required']])} />,
  );
  expect(screen.getByRole('alert').textContent).toBe('Name is required');
  const invalid = [...container.querySelectorAll('[data-property-row][data-invalid]')];
  expect(invalid).toHaveLength(1);
  expect(invalid[0]!.textContent).toContain('Name');
  expect(invalid[0]!.textContent).not.toContain('Seats');
  expect(screen.getByRole('textbox', { name: 'Name' }).getAttribute('aria-invalid')).toBe('true');
  expect(container.querySelectorAll('input[aria-invalid]')).toHaveLength(1);
});
