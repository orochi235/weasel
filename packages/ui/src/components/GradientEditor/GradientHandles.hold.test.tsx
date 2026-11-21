import { beforeAll, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { GradientPaint } from '@weasel-js/paint';
import { describeHold } from '../Disabled/testing/holdCases.fixtures';
import { GradientHandles } from './GradientHandles';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

const LINEAR: GradientPaint = {
  kind: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 50, y: 0 },
  stops: [{ offset: 0, color: '#000000ff' }, { offset: 1, color: '#ffffffff' }],
  units: 'local',
};
const same = (p: { x: number; y: number }) => p;

describeHold('GradientHandles', (mount, own) => {
  const onChange = vi.fn();
  const onInput = vi.fn();
  mount(<GradientHandles value={LINEAR} toScreen={same} toLocal={same} onChange={onChange} onInput={onInput} width={100} height={100} {...own} />);
  const end = () => screen.getByLabelText('Gradient end');
  return {
    targets: () => screen.getAllByRole('button'),
    tryAll: () => {
      fireEvent.keyDown(end(), { key: 'ArrowRight' });
      fireEvent.pointerDown(end(), { clientX: 50, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(end(), { clientX: 80, clientY: 30, pointerId: 1 });
      fireEvent.pointerUp(end(), { clientX: 80, clientY: 30, pointerId: 1 });
    },
    changed: () => onChange.mock.calls.length + onInput.mock.calls.length > 0,
  };
});
