import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { LabShell } from './LabShell';

describe('LabShell', () => {
  test('renders title in header', () => {
    render(<LabShell title="My Lab">body</LabShell>);
    expect(screen.getByRole('heading', { name: 'My Lab' })).toBeInTheDocument();
  });

  test('renders children in body', () => {
    render(<LabShell title="t">body content</LabShell>);
    expect(screen.getByText('body content')).toBeInTheDocument();
  });

  test('renders header slot when provided', () => {
    render(
      <LabShell title="t" header={<button type="button">action</button>}>
        body
      </LabShell>,
    );
    expect(screen.getByRole('button', { name: 'action' })).toBeInTheDocument();
  });

  test('applies lk-theme-light class when theme="light"', () => {
    const { container } = render(
      <LabShell title="t" theme="light">
        x
      </LabShell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains('lk-theme-light')).toBe(true);
    expect(root.classList.contains('lk-theme-dark')).toBe(false);
  });

  test('applies lk-theme-dark class when theme="dark"', () => {
    const { container } = render(
      <LabShell title="t" theme="dark">
        x
      </LabShell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains('lk-theme-dark')).toBe(true);
    expect(root.classList.contains('lk-theme-light')).toBe(false);
  });

  test('applies neither theme class when theme="auto" (default)', () => {
    const { container } = render(<LabShell title="t">x</LabShell>);
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains('lk-theme-light')).toBe(false);
    expect(root.classList.contains('lk-theme-dark')).toBe(false);
  });

  test('always applies lk-root class', () => {
    const { container } = render(<LabShell title="t">x</LabShell>);
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains('lk-root')).toBe(true);
  });
});
