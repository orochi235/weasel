import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { Action } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { PrefsForm } from '../../Prefs/PrefsForm';
import { renderWithIcons } from '../../../testing/withIcons';
import { LabActions } from './labActions';

afterEach(cleanup);

const schema = { name: 'T', children: { undo: pref.action('lab.undo', { name: 'Undo' }), go: pref.action('extra.go', { name: 'Go' }) } };

describe('LabActions', () => {
  it('registers the lab actions and a lab’s extra ones', () => {
    const onPress = vi.fn();
    const run = vi.fn();
    const extra: Action[] = [{ id: 'extra.go', label: 'Go', invoker: { timing: 'immediate', run } }];
    renderWithIcons(
      <LabActions onPress={onPress} extra={extra}>
        <PrefsForm schema={schema} values={{}} onChange={() => {}} />
      </LabActions>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onPress).toHaveBeenCalledWith('undo');
    const go = screen.getByRole('button', { name: 'Go' });
    expect(go).not.toHaveAttribute('data-missing');
    fireEvent.click(go);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
