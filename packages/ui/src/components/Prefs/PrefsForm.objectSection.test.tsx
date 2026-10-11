import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefSectionAs } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

/** An object leaf holding one field and a section, which takes `section`'s extras. */
const schema = (section: { as?: PrefSectionAs; description?: string }): PrefGroup => ({
  name: 'Prefs',
  children: {
    stroke: {
      kind: 'object',
      name: 'Stroke',
      description: '',
      default: { width: 1, dash: 0 },
      children: {
        width: { kind: 'number', name: 'Width', description: '', default: 1 },
        more: {
          name: 'More',
          ...section,
          members: { dash: { kind: 'number', name: 'Dash', description: '', default: 0 } },
        },
      },
    },
  },
});

it.each([undefined, 'panel', 'tab'] as const)('draws the description of a section inside an object leaf (as: %s)', (as) => {
  render(<PrefsForm layout="list" schema={schema({ description: 'Rarely needed.', ...(as ? { as } : {}) })} values={{}} onChange={() => {}} />);
  expect(screen.getByText('Rarely needed.')).toBeInTheDocument();
});

it('draws no paragraph for a section with no description', () => {
  const { container } = render(<PrefsForm layout="list" schema={schema({})} values={{}} onChange={() => {}} />);
  expect(screen.getByText('More')).toBeInTheDocument();
  expect(container.querySelector('p')).toBeNull();
});
