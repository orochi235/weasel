import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Powerline } from './Powerline';
import * as PkgRoot from '../../index';

describe('Powerline', () => {
  it('renders one element per segment', () => {
    const { container } = render(
      <Powerline
        segments={[
          { text: 'a' },
          { text: 'b' },
          { text: 'c' },
        ]}
      />
    );
    expect(container.querySelectorAll('[data-shape="compose"]').length).toBe(3);
  });

  it('threads endCap of segment N to leftEdge of segment N+1', () => {
    const { container } = render(
      <Powerline
        startCap="flat"
        segments={[
          { text: 'a', endCap: 'chevron' },
          { text: 'b', endCap: 'slant' },
          { text: 'c' },
        ]}
      />
    );
    const badges = container.querySelectorAll('[data-shape="compose"]');
    expect(badges.length).toBe(3);
  });

  it('applies row-level variant defaults and per-segment status', () => {
    const { container } = render(
      <Powerline
        variant="solid"
        segments={[
          { text: 'a', status: 'accent' },
          { text: 'b', status: 'info' },
        ]}
      />
    );
    const badges = container.querySelectorAll('[data-status]');
    expect(badges[0].getAttribute('data-status')).toBe('accent');
    expect(badges[1].getAttribute('data-status')).toBe('info');
    expect(badges[0].getAttribute('data-variant')).toBe('solid');
  });

  it('passes each segment’s peer tone and stance to its badge', () => {
    const { container } = render(
      <Powerline segments={[{ text: 'a', status: 'info', stance: 'debug', tone: 2 }, { text: 'b' }]} />,
    );
    const badges = container.querySelectorAll<HTMLElement>('[data-status]');
    expect(badges[0].dataset.tone).toBe('2');
    expect(badges[0].dataset.stance).toBe('debug');
    expect(badges[1].hasAttribute('data-tone')).toBe(false);
  });

  it('renders segment text content', () => {
    const { getByText } = render(
      <Powerline segments={[{ text: 'main' }, { text: '✓ 12' }]} />
    );
    expect(getByText('main')).toBeDefined();
    expect(getByText('✓ 12')).toBeDefined();
  });

  it('accepts a custom EdgeProfile function as a cap', () => {
    const custom = (t: number, d: number) => Math.sin(t * Math.PI * 4) * d * 0.5;
    const { container } = render(
      <Powerline
        segments={[
          { text: 'x', endCap: custom },
          { text: 'y' },
        ]}
      />
    );
    expect(container.querySelectorAll('[data-shape="compose"]').length).toBe(2);
  });
});

describe('package root export', () => {
  it('re-exports Powerline from the package root', () => {
    expect(PkgRoot.Powerline).toBeDefined();
  });

  it('re-exports EDGE_PROFILES from the package root', () => {
    expect(PkgRoot.EDGE_PROFILES).toBeDefined();
    expect(typeof PkgRoot.EDGE_PROFILES.chevron).toBe('function');
  });
});
