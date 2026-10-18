import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    floor: { kind: 'number', name: 'Floor', description: '', default: 0 },
    size: { kind: 'number', name: 'Size', description: '', default: 50, min: 0, minAt: (read) => read('floor') as number },
  },
};

describe('a number leaf with a minAt', () => {
  it('holds a typed value to the bound read from the form\'s values', () => {
    const onChange = vi.fn();
    render(<PrefsForm layout="list" schema={SCHEMA} values={{ floor: 20, size: 50 }} onChange={onChange} />);
    const size = screen.getByLabelText('Size');
    fireEvent.change(size, { target: { value: '5' } });
    fireEvent.blur(size);
    expect(onChange).toHaveBeenLastCalledWith('size', 20);
  });
});
