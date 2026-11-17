import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { NodePropertiesEntry } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { makeScene, routing, selectionOf } from '../../../testing/rectScene';

const member = (name: string) => ({ kind: 'number' as const, name, description: name, default: 0, min: 0, max: 100 });

it('draws and settles a kind through the same entry when a later one of that name overrides an earlier', () => {
  const early = vi.fn((next: { pose: unknown; data: unknown }) => next);
  const late = vi.fn((next: { pose: unknown; data: unknown }) => next);
  const properties: NodePropertiesEntry[] = [
    { name: 'rect', schema: { name: 'Properties', members: { 'pose.x': member('Early X') } }, settle: early },
    { name: 'rect', schema: { name: 'Properties', members: { 'pose.x': member('Late X') } }, settle: late },
  ];
  render(<SelectionPanel scene={makeScene()} selection={selectionOf(['a'])} properties={properties} routing={routing} />);
  const field = screen.getByLabelText('Late X');
  fireEvent.change(field, { target: { value: '20' } });
  fireEvent.blur(field);
  expect(late).toHaveBeenCalled();
  expect(early).not.toHaveBeenCalled();
});
