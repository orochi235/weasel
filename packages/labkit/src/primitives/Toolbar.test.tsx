import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  test('renders children in a horizontal toolbar', () => {
    const { container } = render(
      <Toolbar>
        <Toolbar.Title>My Lab</Toolbar.Title>
        <Toolbar.Button onClick={() => {}}>Save</Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByText('My Lab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).className).toBe('lk-toolbar');
  });

  test('Title uses lk-toolbar-title class', () => {
    const { container } = render(
      <Toolbar>
        <Toolbar.Title>X</Toolbar.Title>
      </Toolbar>,
    );
    expect(container.querySelector('.lk-toolbar-title')).not.toBeNull();
  });

  test('Spacer fills available space', () => {
    const { container } = render(
      <Toolbar>
        <Toolbar.Title>L</Toolbar.Title>
        <Toolbar.Spacer />
        <span>R</span>
      </Toolbar>,
    );
    expect(container.querySelector('.lk-toolbar-spacer')).not.toBeNull();
  });

  test('Button passes onClick and disabled', () => {
    let clicked = false;
    render(
      <Toolbar>
        <Toolbar.Button
          onClick={() => {
            clicked = true;
          }}
        >
          Go
        </Toolbar.Button>
      </Toolbar>,
    );
    screen.getByRole('button', { name: 'Go' }).click();
    expect(clicked).toBe(true);
  });

  test('Button respects disabled', () => {
    render(
      <Toolbar>
        <Toolbar.Button onClick={() => {}} disabled>
          X
        </Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'X' })).toBeDisabled();
  });
});
