import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CallDetails } from '../Packages/reference/Callable';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const html = (text: string) => [{ kind: 'html' as const, html: `<p>${text}</p>` }];

it('draws two destructured parameters, both named options, without a key clash', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(
    <CallDetails
      params={[
        { name: 'options', optional: false, type: ['A'], doc: html('The first.') },
        { name: 'options', optional: true, type: ['B'], doc: html('The second.') },
      ]}
    />,
  );
  expect([...container.querySelectorAll('dd')].map((dd) => dd.textContent)).toEqual(['The first.', 'The second.']);
  expect(error.mock.calls.filter((call) => String(call[0]).includes('same key'))).toEqual([]);
});
