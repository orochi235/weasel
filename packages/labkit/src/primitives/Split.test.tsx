import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Split } from './Split';

const VIEWPORT = { w: 800, h: 600 };

function renderBody(props: Partial<Parameters<typeof Split>[0]> = {}) {
  return render(
    <Split viewport={VIEWPORT} sidebar={<p>sidebar body</p>} {...props}>
      <p>instrument output</p>
    </Split>,
  );
}

describe('Split', () => {
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

  it('puts the caller’s class names on its boxes', () => {
    const { container } = render(
      <Split
        viewport={VIEWPORT}
        className="lk-x__panes"
        sidebarClassName="lk-x__side"
        contentClassName="lk-x__main"
        label="Stories"
        sidebar={<p>side</p>}
      >
        <p>main</p>
      </Split>,
    );
    expect(container.querySelector('.lk-x__panes.lk-split')).not.toBeNull();
    expect(container.querySelector('.lk-x__side')?.textContent).toBe('side');
    expect(container.querySelector('.lk-x__main')?.textContent).toBe('main');
  });

  it('puts the sidebar after the content on the end side, where dragging the seam left widens it', () => {
    const onWidthChange = vi.fn();
    const { container } = render(
      <Split
        viewport={VIEWPORT}
        side="end"
        width={320}
        sidebarClassName="lk-x__side"
        contentClassName="lk-x__main"
        sidebar={<p>side</p>}
        onWidthChange={onWidthChange}
      >
        <p>main</p>
      </Split>,
    );
    const side = container.querySelector('.lk-x__side') as HTMLElement;
    const main = container.querySelector('.lk-x__main') as HTMLElement;
    expect(main.compareDocumentPosition(side) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const seam = screen.getByRole('separator');
    fireEvent.pointerDown(seam, { clientX: 480, clientY: 100 });
    fireEvent.pointerMove(seam, { clientX: 420, clientY: 100 });
    fireEvent.pointerUp(seam, { clientX: 420, clientY: 100 });
    expect(onWidthChange).toHaveBeenLastCalledWith(380);
  });

  it('names its seam after the sidebar label', () => {
    render(
      <Split viewport={VIEWPORT} label="Stories" sidebar={<p>side</p>}>
        <p>main</p>
      </Split>,
    );
    expect(screen.getByRole('separator')).toHaveAccessibleName(/stories/i);
  });

  it('renames its seam when the label changes', () => {
    const { rerender } = render(
      <Split viewport={VIEWPORT} label="Stories" sidebar={<p>side</p>}>
        <p>main</p>
      </Split>,
    );
    rerender(
      <Split viewport={VIEWPORT} label="Outline" sidebar={<p>side</p>}>
        <p>main</p>
      </Split>,
    );
    expect(screen.getByRole('separator')).toHaveAccessibleName(/outline/i);
  });
});
