import { describe, it, expect } from 'vitest';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { useArrayAdapter } from './useArrayAdapter';
import type { ArrayAdapter } from './arrayAdapter';

interface Item { id: string; x: number; y: number; width: number; height: number }
const item = (id: string): Item => ({ id, x: 0, y: 0, width: 1, height: 1 });

describe('useArrayAdapter', () => {
  it('an adapter from a committed render reads that render\'s items, not an abandoned render\'s', () => {
    const committed: Array<ArrayAdapter<Item, Item>> = [];
    function Probe({ items }: { items: Item[] }) {
      const adapter = useArrayAdapter<Item, Item>({ items, setItems: () => {}, toPose: (o) => o });
      if (items.length === 1) committed.push(adapter);
      return null;
    }
    renderThenAbandon([item('a')], [item('a'), item('b')], (items) => <Probe items={items} />);
    expect(committed.at(-1)!.getNodes().map((n) => n.id)).toEqual(['a']);
  });
});
