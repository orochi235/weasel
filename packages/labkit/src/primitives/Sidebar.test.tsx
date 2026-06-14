import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  test('renders children when expanded (default)', () => {
    render(
      <Sidebar>
        <p>content</p>
      </Sidebar>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  test('renders title when provided', () => {
    render(
      <Sidebar title="Controls">
        <p>x</p>
      </Sidebar>,
    );
    expect(screen.getByText('Controls')).toBeInTheDocument();
  });

  test('marks the sidebar collapsed and nests body inside the collapsed root', () => {
    const { container } = render(
      <Sidebar collapsed>
        <p>content</p>
      </Sidebar>,
    );
    const root = container.querySelector('.lk-sidebar');
    const body = container.querySelector('.lk-sidebar-body');
    expect(root).not.toBeNull();
    expect(body).not.toBeNull();
    expect(root?.classList.contains('lk-sidebar--collapsed')).toBe(true);
    // Body is still rendered (children stay in DOM), but lives inside the collapsed
    // root so the CSS rule `.lk-sidebar--collapsed .lk-sidebar-body { display:none }` applies.
    expect(body?.parentElement).toBe(root);
    expect(body?.textContent).toBe('content');
  });

  test('toggle button calls onToggle when clicked', () => {
    let toggled = false;
    render(
      <Sidebar
        title="C"
        onToggle={() => {
          toggled = true;
        }}
      >
        <p>x</p>
      </Sidebar>,
    );
    screen.getByRole('button', { name: /collapse|expand/i }).click();
    expect(toggled).toBe(true);
  });

  test('shows expand label when collapsed', () => {
    render(
      <Sidebar title="C" collapsed onToggle={() => {}}>
        <p>x</p>
      </Sidebar>,
    );
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
  });

  test('shows collapse label when expanded', () => {
    render(
      <Sidebar title="C" onToggle={() => {}}>
        <p>x</p>
      </Sidebar>,
    );
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
  });
});
