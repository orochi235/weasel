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

  test('hides children when collapsed prop is true', () => {
    render(
      <Sidebar collapsed>
        <p>content</p>
      </Sidebar>,
    );
    // Content is rendered but in a hidden container — test the class
    const { container } = render(
      <Sidebar collapsed>
        <p>x</p>
      </Sidebar>,
    );
    expect(
      container.querySelector('.lk-sidebar')?.classList.contains('lk-sidebar--collapsed'),
    ).toBe(true);
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
