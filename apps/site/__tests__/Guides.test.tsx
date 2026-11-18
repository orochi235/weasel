import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { PackageEntry } from '@shared/packageDocs';
import { Guides } from '../Packages/Guides';

afterEach(cleanup);

const pkg = (slug: string): PackageEntry => ({
  name: 'geom',
  specifier: '@weasel-js/geom',
  version: '1.0.0',
  since: null,
  description: '',
  entries: ['@weasel-js/geom'],
  uses: [],
  guides: [{ slug, title: 'The guide' }],
  demos: [],
  load: async () => ({ readme: [], guides: {} }),
});

it('draws an empty body for a guide the loaded doc lacks, though its slug names an Object member', async () => {
  const { container } = render(<Guides pkg={pkg('constructor')} slug="constructor" />);
  await screen.findByRole('heading', { level: 3, name: 'The guide' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(container.textContent).toBe('The guide');
});
