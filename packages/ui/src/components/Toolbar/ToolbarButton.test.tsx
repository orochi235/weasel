import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Toolbar } from './Toolbar';

describe('Toolbar.Button and Toolbar.Title', () => {
  test('draws the title and a button named by its words', () => {
    render(
      <Toolbar aria-label="Trial actions">
        <Toolbar.Title>My Lab</Toolbar.Title>
        <Toolbar.Button onClick={() => {}}>Save</Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByText('My Lab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  test('names an icon-only button by its title', () => {
    render(
      <Toolbar aria-label="Trial actions">
        <Toolbar.Button iconOnly title="Undo" onClick={() => {}}>
          U
        </Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  test('marks a danger grade, runs its click, and respects disabled', () => {
    const onClick = vi.fn();
    render(
      <Toolbar aria-label="Trial actions">
        <Toolbar.Button grade="danger" onClick={onClick}>
          Discard
        </Toolbar.Button>
        <Toolbar.Button onClick={() => {}} disabled>
          Off
        </Toolbar.Button>
      </Toolbar>,
    );
    const discard = screen.getByRole('button', { name: 'Discard' });
    expect(discard).toHaveAttribute('data-grade', 'danger');
    discard.click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
  });

  test('holds a pressed button down', () => {
    render(
      <Toolbar aria-label="Trial actions">
        <Toolbar.Button pressed onClick={() => {}}>
          Grid
        </Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  });
});
