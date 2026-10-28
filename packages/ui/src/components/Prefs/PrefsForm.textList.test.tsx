import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PrefGroup, PrefListControl } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const schema = (control?: PrefListControl): PrefGroup => ({
  name: 'Root',
  children: {
    tags: {
      kind: 'list', name: 'Tags', description: '', default: [], ...(control ? { control } : {}),
      item: { kind: 'string', name: 'Tag', description: '', default: '' },
    },
  },
});

it('draws a text list as a field per entry unless it asks for tokens', () => {
  renderWithIcons(<PrefsForm schema={schema()} values={{ tags: ['a'] }} onChange={() => {}} />);
  expect(screen.getByRole('textbox', { name: 'Tag 1' })).toBeInTheDocument();
});

it('draws a text list with control tokens as chips, adding what is typed', () => {
  const onChange = vi.fn();
  renderWithIcons(<PrefsForm schema={schema('tokens')} values={{ tags: ['a'] }} onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'a' })).toBeInTheDocument();
  const add = screen.getByRole('textbox', { name: 'Add to Tag' });
  fireEvent.change(add, { target: { value: 'b' } });
  fireEvent.keyDown(add, { key: 'Enter' });
  expect(onChange).toHaveBeenLastCalledWith('tags', ['a', 'b']);
});
