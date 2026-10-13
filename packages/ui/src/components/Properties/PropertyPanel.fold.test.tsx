import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyPanel } from './PropertyPanel';
import { Subpanel } from './Subpanel';

describe('folding', () => {
  it('folds a collapsible panel from its twisty, keeping the contents mounted', () => {
    const { container } = render(
      <PropertyPanel title="Shape" collapsible>
        <input aria-label="Width" defaultValue="4" />
      </PropertyPanel>,
    );
    const twisty = screen.getByRole('button', { name: 'Shape' });
    expect(twisty).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '9' } });
    fireEvent.click(twisty);
    expect(twisty).toHaveAttribute('aria-expanded', 'false');
    expect(container.firstElementChild).toHaveAttribute('data-collapsed', 'true');
    const body = document.getElementById(twisty.getAttribute('aria-controls')!)!;
    expect(body).toHaveAttribute('hidden');
    expect(within(body).getByLabelText('Width')).toHaveValue('9');
    fireEvent.click(twisty);
    expect(body).not.toHaveAttribute('hidden');
    expect(container.firstElementChild).not.toHaveAttribute('data-collapsed');
  });

  it('draws no twisty and no wrapper on a panel not asked to fold', () => {
    const { container } = render(
      <PropertyPanel title="Shape">
        <input aria-label="Width" />
      </PropertyPanel>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Width').parentElement).toBe(container.firstElementChild);
  });

  it('leaves a controlled panel as it was told and reports the toggle', () => {
    const onCollapsedChange = vi.fn();
    render(
      <PropertyPanel title="Shape" collapsed onCollapsedChange={onCollapsedChange}>
        <input aria-label="Width" />
      </PropertyPanel>,
    );
    const twisty = screen.getByRole('button', { name: 'Shape' });
    fireEvent.click(twisty);
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    expect(twisty).toHaveAttribute('aria-expanded', 'false');
  });

  it('folds a subpanel the same way, and keeps the twisty out of its heading', () => {
    render(
      <Subpanel title="Bevel" defaultCollapsed>
        <input aria-label="Depth" />
      </Subpanel>,
    );
    expect(screen.getByRole('heading', { level: 4, name: 'Bevel' })).toBeInTheDocument();
    const twisty = screen.getByRole('button', { name: 'Bevel' });
    const body = document.getElementById(twisty.getAttribute('aria-controls')!)!;
    expect(body).toHaveAttribute('hidden');
    fireEvent.click(twisty);
    expect(body).not.toHaveAttribute('hidden');
  });
});
