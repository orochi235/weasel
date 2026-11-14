import { vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { seedMeshPatch, type MeshGradientPaint } from '@weasel-js/core/mesh';
import { describeHold, unlessDisabled } from '../Disabled/testing/holdCases';
import { MeshEditor } from './MeshEditor';

const MESH = seedMeshPatch('#ff0000ff') as MeshGradientPaint;

// Its corner fields and its space switch hold themselves through the scope it opens; a field says so as React Aria does.
describeHold('MeshEditor', (mount, own) => {
  const onChange = vi.fn();
  const onInput = vi.fn();
  mount(<MeshEditor value={MESH} onChange={onChange} onInput={onInput} {...own} />);
  return {
    targets: () => [1, 2, 3, 4].map((i) => screen.getByLabelText(`Patch 1 corner ${i}`)),
    tryAll: () => {
      unlessDisabled(screen.getByLabelText('Patch 1 corner 2'), (el) => {
        fireEvent.input(el, { target: { value: '#00ff00' } });
        fireEvent.blur(el);
      });
      unlessDisabled(screen.getByRole('radio', { name: 'OKLab' }), (el) => fireEvent.click(el));
    },
    changed: () => onChange.mock.calls.length + onInput.mock.calls.length > 0,
  };
}, { ariaHeld: false });
