import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  test('renders children', () => {
    render(<StatusBar>3 items</StatusBar>);
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  test('uses lk-status-bar class', () => {
    const { container } = render(<StatusBar>x</StatusBar>);
    expect((container.firstChild as HTMLElement).className).toBe('lk-status-bar');
  });

  test('renders multiple section children separated', () => {
    const { container } = render(
      <StatusBar>
        <StatusBar.Section>left</StatusBar.Section>
        <StatusBar.Section>right</StatusBar.Section>
      </StatusBar>,
    );
    expect(container.querySelectorAll('.lk-status-bar-section').length).toBe(2);
  });
});
