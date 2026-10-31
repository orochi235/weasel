import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { renderWithIcons } from '../../testing/withIcons';
import { stubRect } from '../Slider/testing/stubRect';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const schema: PrefGroup = {
  name: 'Root',
  children: { level: pref.number('Level', 0.2, { min: -1, max: 1, step: 0.01, control: 'slider', stops: [0] }) },
};

it('catches a form slider on its leaf’s stops and stores the value it settles on, once', () => {
  const onChange = vi.fn();
  renderWithIcons(<PrefsForm schema={schema} values={{ level: 0.2 }} onChange={onChange} />);
  const el = screen.getByRole('slider', { name: 'Level' }) as HTMLInputElement;
  // 200px of track puts the 8px pull at 0.08 either side of the stop.
  stubRect(el, { width: 200 });
  fireEvent.pointerDown(el);
  for (const at of ['0.1', '0.03']) fireEvent.input(el, { target: { value: at } });
  expect(el.value).toBe('0');
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(el);
  expect(onChange.mock.calls).toEqual([['level', 0]]);
});
