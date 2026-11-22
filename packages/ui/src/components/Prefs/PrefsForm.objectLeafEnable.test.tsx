import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const stroke = {
  kind: 'object',
  name: 'Stroke',
  description: '',
  default: { on: false, width: 1 },
  enableIf: { path: 'stroke.on' },
  children: {
    on: { kind: 'boolean', name: 'Stroke on', description: '', default: false },
    width: { kind: 'number', name: 'Width', description: '', default: 1 },
  },
} as PrefLeaf;

const schema: PrefGroup = { name: '', children: { stroke } };

describe("an object leaf its own enableIf turns off, in PrefsForm", () => {
  it('turns back on from its own switch, with its other fields held', () => {
    const onChange = vi.fn();
    render(<PrefsForm layout="list" schema={schema} values={{ stroke: { on: false, width: 1 } }} onChange={onChange} />);
    const on = screen.getByRole('checkbox', { name: 'Stroke on' });
    expect(on).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeDisabled();
    fireEvent.click(on);
    expect(onChange).toHaveBeenLastCalledWith('stroke', { on: true, width: 1 });
  });
});
