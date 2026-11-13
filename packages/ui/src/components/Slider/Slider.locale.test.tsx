import { cleanup, render, screen } from '@testing-library/react';
import { decimal } from '@weasel-js/quantity';
import { afterEach, expect, it } from 'vitest';
import { I18nProvider } from '../../useFieldLocale';
import { Slider } from './Slider';

afterEach(cleanup);

it("shows and speaks its readout in the number fields' locale", () => {
  const { container } = render(
    <I18nProvider locale="de-DE">
      <Slider aria-label="Amount" min={0} max={10} step={0.5} thumbs={[{ value: 2.5 }]}
        readoutPlacement="inline-after" display={decimal({ places: 1 })} onInput={() => {}} />
    </I18nProvider>,
  );
  expect(container.textContent).toBe('2,5');
  expect(screen.getByRole('slider', { name: 'Amount' }).getAttribute('aria-valuetext')).toBe('2,5');
});
