import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { NumberField, UnitField } from './components/NumberField';
import { I18nProvider } from './useFieldLocale';

it("sets every number field's locale through the I18nProvider ui exports", () => {
  render(
    <I18nProvider locale="de-DE">
      <UnitField value={2.5} onChange={() => {}} aria-label="Unit" />
      <NumberField value={1500.5} label="Plain" />
    </I18nProvider>,
  );
  expect((screen.getByRole('spinbutton', { name: 'Unit' }) as HTMLInputElement).value).toBe('2,5');
  expect((screen.getByLabelText('Plain', { selector: 'input' }) as HTMLInputElement).value).toBe('1.500,5');
});
