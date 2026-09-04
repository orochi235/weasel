import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrialBody } from './TrialBody';

const VIEWPORT = { w: 800, h: 600 };

function renderBody(props: Partial<Parameters<typeof TrialBody>[0]> = {}) {
  return render(
    <TrialBody viewport={VIEWPORT} sidebar={<p>sidebar body</p>} {...props}>
      <p>instrument output</p>
    </TrialBody>,
  );
}

describe('TrialBody', () => {
  it('renders both panes', () => {
    renderBody();
    expect(screen.getByText('sidebar body')).toBeInTheDocument();
    expect(screen.getByText('instrument output')).toBeInTheDocument();
  });

  it('puts a labeled separator between the sidebar and the content', () => {
    renderBody({ width: 320 });
    const seam = screen.getByRole('separator');
    expect(seam).toHaveAttribute('aria-orientation', 'horizontal');
    expect(seam).toHaveAttribute('aria-valuenow', '320');
    expect(seam).toHaveAccessibleName(/sidebar/i);
  });

  it('reports the width a drag lands on', () => {
    const onWidthChange = vi.fn();
    renderBody({ width: 320, onWidthChange });
    const seam = screen.getByRole('separator');
    fireEvent.pointerDown(seam, { clientX: 320, clientY: 100 });
    fireEvent.pointerMove(seam, { clientX: 380, clientY: 100 });
    fireEvent.pointerUp(seam, { clientX: 380, clientY: 100 });
    expect(onWidthChange).toHaveBeenLastCalledWith(380);
  });

  it('resizes from the keyboard', () => {
    const onWidthChange = vi.fn();
    renderBody({ width: 320, onWidthChange });
    const seam = screen.getByRole('separator');
    fireEvent.keyDown(seam, { key: 'ArrowRight' });
    expect(onWidthChange).toHaveBeenLastCalledWith(328);
  });

  it('refuses to drag the sidebar past its stated bounds', () => {
    const onWidthChange = vi.fn();
    renderBody({ width: 320, minWidth: 200, maxWidth: 400, onWidthChange });
    const seam = screen.getByRole('separator');
    expect(seam).toHaveAttribute('aria-valuemin', '200');
    expect(seam).toHaveAttribute('aria-valuemax', '400');
    fireEvent.pointerDown(seam, { clientX: 320, clientY: 100 });
    fireEvent.pointerMove(seam, { clientX: 900, clientY: 100 });
    expect(onWidthChange).toHaveBeenLastCalledWith(400);
  });

  it('leaves the content pane a floor the seam cannot cross', () => {
    const onWidthChange = vi.fn();
    renderBody({ width: 320, maxWidth: 10_000, contentMinWidth: 300, onWidthChange });
    const seam = screen.getByRole('separator');
    fireEvent.pointerDown(seam, { clientX: 320, clientY: 100 });
    fireEvent.pointerMove(seam, { clientX: 5_000, clientY: 100 });
    expect(onWidthChange).toHaveBeenLastCalledWith(VIEWPORT.w - 300);
  });
});
