import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Disabled } from '../Disabled';
import { LabeledRow } from '../inspector/SelectionPanel/LabeledRow';
import { PropertyRow } from './PropertyRow';
import { RowScope, usePropertyRow } from './rowScope';

function Peek() {
  const row = usePropertyRow();
  return <output>{row ? `${String(row.label)} changed=${String(row.changed === true)}` : 'none'}</output>;
}

describe('RowScope', () => {
  it('gives the row inside it its state', () => {
    const { container } = render(
      <RowScope changed error="too big">
        <PropertyRow label="Gap">
          <input aria-label="Gap" />
        </PropertyRow>
      </RowScope>,
    );
    const row = container.querySelector('[data-property-row]') as HTMLElement;
    expect(row).toHaveAttribute('data-changed');
    expect(row).toHaveAttribute('data-invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('too big');
  });

  it('lets an inner scope override the fields it names, an undefined one included', () => {
    const { container } = render(
      <RowScope changed onReset={() => {}}>
        <RowScope onReset={undefined} error="wrong">
          <PropertyRow label="Gap">
            <input aria-label="Gap" />
          </PropertyRow>
        </RowScope>
      </RowScope>,
    );
    const row = container.querySelector('[data-property-row]') as HTMLElement;
    expect(row).toHaveAttribute('data-changed');
    expect(row).toHaveAttribute('data-invalid');
    expect(screen.queryByRole('button', { name: 'Reset Gap' })).toBeNull();
  });

  it('is taken by the row, so a row nested in its control starts with none', () => {
    const { container } = render(
      <RowScope changed>
        <PropertyRow label="Outer" group>
          <PropertyRow label="Inner">
            <input aria-label="Inner" />
          </PropertyRow>
        </PropertyRow>
      </RowScope>,
    );
    const [outer, inner] = container.querySelectorAll('[data-property-row]');
    expect(outer).toHaveAttribute('data-changed');
    expect(inner).not.toHaveAttribute('data-changed');
  });

  it('tells a control inside the row the row’s label and state', () => {
    render(
      <RowScope changed>
        <PropertyRow label="Gap" group>
          <Peek />
        </PropertyRow>
      </RowScope>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Gap changed=true');
  });

  it('gives a selection panel row its reset, held by a disabled scope around it', () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <RowScope onReset={onReset}>
        <LabeledRow label="Fill" marked={false} attrs={{}}>
          <input aria-label="Fill" />
        </LabeledRow>
      </RowScope>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset Fill' }));
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(
      <Disabled when reason="Locked">
        <RowScope onReset={onReset}>
          <LabeledRow label="Fill" marked={false} attrs={{}}>
            <input aria-label="Fill" />
          </LabeledRow>
        </RowScope>
      </Disabled>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset Fill' }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Fill').closest('[data-disabled]')).not.toBeNull();
  });
});
