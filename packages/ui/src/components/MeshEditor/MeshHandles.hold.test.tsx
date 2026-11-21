import { beforeAll, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { seedMeshPatch, type MeshGradientPaint } from '@weasel-js/renderer/mesh';
import { describeHold } from '../Disabled/testing/holdCases.fixtures';
import { MeshHandles } from './MeshHandles';
import '@weasel-js/paint-kinds/mesh';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

const MESH = seedMeshPatch('#ff0000ff') as MeshGradientPaint;
const same = (p: { x: number; y: number }) => p;

describeHold('MeshHandles', (mount, own) => {
  const onChange = vi.fn();
  const onInput = vi.fn();
  mount(<MeshHandles value={MESH} toScreen={same} toLocal={same} onChange={onChange} onInput={onInput} width={100} height={100} {...own} />);
  const corner = () => screen.getByLabelText('Patch 1 corner 1');
  return {
    targets: () => screen.getAllByRole('button'),
    tryAll: () => {
      fireEvent.keyDown(corner(), { key: 'ArrowRight' });
      fireEvent.pointerDown(corner(), { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(corner(), { clientX: 30, clientY: 30, pointerId: 1 });
      fireEvent.pointerUp(corner(), { clientX: 30, clientY: 30, pointerId: 1 });
    },
    changed: () => onChange.mock.calls.length + onInput.mock.calls.length > 0,
  };
});
