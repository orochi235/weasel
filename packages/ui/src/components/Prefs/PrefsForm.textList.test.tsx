import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { prefListTexts } from './ListLeaf';

afterEach(cleanup);

const tags = { kind: 'list', name: 'Tags', description: '', default: [], item: { kind: 'string', name: 'Tag', description: '', default: 'untitled' } } as const;
const SCHEMA: PrefGroup = { name: '', children: { tags } };

describe('a text list', () => {
  it('starts a new entry as the item default', () => {
    const onChange = vi.fn();
    render(<PrefsForm schema={SCHEMA} values={{ tags: ['a'] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenLastCalledWith('tags', ['a', 'untitled']);
  });

  it('reads an entry holding nothing as the item default', () => {
    expect(prefListTexts(['a', undefined, null, 3], tags)).toEqual(['a', 'untitled', 'untitled', 'untitled']);
  });
});
