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

const OBJECT_SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    floor: { kind: 'number', name: 'Floor', description: '', default: 0 },
    stroke: {
      kind: 'object', name: 'Stroke', description: '', default: { width: 1 },
      children: {
        width: { kind: 'number', name: 'Width', description: '', default: 1, min: 0, minAt: (read) => read('floor') as number },
      },
    },
  },
};

describe('a field of an object leaf with a minAt', () => {
  it('holds a typed value to the bound read from the form\'s values', () => {
    const onChange = vi.fn();
    render(<PrefsForm layout="list" schema={OBJECT_SCHEMA} values={{ floor: 3, stroke: { width: 4 } }} onChange={onChange} />);
    const width = screen.getByLabelText('Width');
    fireEvent.change(width, { target: { value: '1' } });
    fireEvent.blur(width);
    expect(onChange).toHaveBeenLastCalledWith('stroke', { width: 3 });
  });
});
