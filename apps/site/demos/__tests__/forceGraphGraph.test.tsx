import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ForceGraphDemo } from '../ForceGraphDemo';
import { GRAPH_SIZES, makeGraph } from '../forceGraph/graph';
import { DEMOS_BY_ID } from '../../registry';

/** A fixed sequence standing in for `Math.random`. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('makeGraph', () => {
  it.each(GRAPH_SIZES)('builds $count nodes joined by distinct links with no self-loops', (size) => {
    const { nodes, links } = makeGraph(size, { width: 600, height: 400 }, seeded());
    expect(nodes).toHaveLength(size.count);
    expect(links).toHaveLength(size.links);
    const ids = new Set(nodes.map((n) => n.id));
    const pairs = new Set(links.map((l) => [l.source, l.target].sort().join('|')));
    expect(pairs.size).toBe(links.length);
    for (const l of links) {
      expect(l.source).not.toBe(l.target);
      expect(ids.has(l.source as string) && ids.has(l.target as string)).toBe(true);
    }
  });

  it('offers a graph past what a scene node per edge is sized for', () => {
    expect(Math.max(...GRAPH_SIZES.map((s) => s.count))).toBeGreaterThanOrEqual(2000);
  });
});

describe('ForceGraphDemo', () => {
  it('switches to the largest graph from its size control', () => {
    render(<ForceGraphDemo />);
    const label = (n: number) => n.toLocaleString('en-US');
    const trigger = screen.getByRole('button', { name: /Nodes/ });
    expect(trigger.textContent).toContain(label(GRAPH_SIZES[0].count));
    const largest = GRAPH_SIZES[GRAPH_SIZES.length - 1];
    act(() => { fireEvent.click(trigger); });
    fireEvent.click(screen.getByRole('option', { name: label(largest.count) }));
    expect(screen.getByRole('button', { name: /Nodes/ }).textContent).toContain(label(largest.count));
    expect(screen.getByText(new RegExp(`${largest.links.toLocaleString('en-US')} edges`))).toBeInTheDocument();
  });

  it('says in the registry that its edges bypass the scene, and where the other route is', () => {
    const entry = DEMOS_BY_ID.get('force-graph')!;
    expect(entry.description).toMatch(/render layer/);
    expect(entry.description).toMatch(/@weasel-js\/diagram/);
    expect(entry.description).not.toMatch(/setPose/);
  });
});
