import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { withIcons } from '../testing/withIcons';
import { icon } from '../icons.gen';
import { resolveIcon } from './resolveIcon';

it('draws a qualified name, at the size asked for', () => {
  const { container } = render(<>{resolveIcon(icon('close'), 16)}</>, { wrapper: withIcons });
  expect(container.querySelector('svg')).toHaveAttribute('width', '16');
});

it('takes a qualified string read from data', () => {
  const { container } = render(<>{resolveIcon('ui:close')}</>, { wrapper: withIcons });
  expect(container.querySelector('svg')).toHaveAttribute('width', '14');
});

it('draws nothing for a bare or malformed string', () => {
  expect(resolveIcon(undefined)).toBeUndefined();
  expect(resolveIcon('bold')).toBeUndefined();
  expect(resolveIcon('toString')).toBeUndefined();
  expect(resolveIcon('ui:a:b')).toBeUndefined();
});
