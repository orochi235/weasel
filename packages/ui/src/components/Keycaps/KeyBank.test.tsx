import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { KeyBank } from './KeyBank';
import { KeyCap } from './Keycap';

afterEach(() => vi.restoreAllMocks());

it('leaves keys on their first spelling at full size, logging nothing, where text cannot be measured', () => {
  const error = vi.spyOn(console, 'error');
  const { container } = render(
    <KeyBank wrap>
      <KeyCap label="Insert" />
      <KeyCap label="PgUp" />
    </KeyBank>,
  );
  expect([...container.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Insert', 'PgUp']);
  expect(container.querySelector('[data-wrapped]')).toBeNull();
  expect(container.firstElementChild?.getAttribute('style')).toBeNull();
  expect(error).not.toHaveBeenCalled();
});
