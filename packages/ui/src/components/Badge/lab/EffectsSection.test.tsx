import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithIcons } from '../../../testing/withIcons';
import { EffectsSection } from './EffectsSection';
import type { LabEffect } from './snapshot';
import { addEffect, setEffects } from './transitions';

function Held() {
  const [shape, setShape] = useState<{ labEffects: LabEffect[]; nextId: number }>(() => addEffect({ labEffects: [], nextId: 1 }, 'shadow'));
  return (
    <EffectsSection
      effects={shape.labEffects}
      nextId={shape.nextId}
      onAdd={(type) => setShape((sh) => addEffect(sh, type))}
      onEffects={(update) => setShape((sh) => ({ ...sh, labEffects: update(sh.labEffects) }))}
      onList={(next) => setShape((sh) => setEffects(sh, next))}
    />
  );
}

const open = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Drag to reorder ${name}` }));

describe('EffectsSection', () => {
  it('shows only the open card’s type and params', () => {
    renderWithIcons(<Held />);
    expect(screen.queryByRole('combobox', { name: 'type' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Add effect' }), { target: { value: 'bevel' } });
    expect(screen.getByRole('combobox', { name: 'type' })).toHaveValue('bevel');
    open('Shadow');
    expect(screen.getByRole('combobox', { name: 'type' })).toHaveValue('shadow');
    expect(screen.getAllByRole('combobox', { name: 'type' })).toHaveLength(1);
  });

  it('retypes the open card, its kind and name following', () => {
    renderWithIcons(<Held />);
    open('Shadow');
    expect(screen.getByText('Background')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'type' }), { target: { value: 'spikes' } });
    expect(screen.getByText('Offset')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name of card 1' })).toHaveValue('Spikes');
  });

  it('duplicates a card under a fresh id, and removes one', () => {
    renderWithIcons(<Held />);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Shadow' }));
    expect(screen.getByRole('textbox', { name: 'Name of card 2' })).toHaveValue('Shadow copy');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Shadow copy' }));
    expect(screen.getAllByRole('textbox', { name: /^Name of card/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Shadow' }));
    expect(screen.getAllByRole('textbox', { name: /^Name of card/ }).map((el) => (el as HTMLInputElement).value))
      .toEqual(['Shadow copy', 'Shadow copy copy']);
  });
});
