import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diagramThemeFrom } from '@weasel-js/diagram';
import { laidOutPage } from '../../pageLayout';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { parseKanban } from './parse';
import { readKanban } from './read';
import { writeKanban } from './write';

const RELEASE = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'kanban', 'release.mmd'), 'utf8');
const page = (text: string) => onlyPage(readKanban(text).document);
const card = (id: string) => page(RELEASE).data.nodes.find((n) => n.id === id)!;

describe('reading a Mermaid kanban board', () => {
  it('reads a page of notation kanban: one pool, its lanes along x, a lane per column holding its cards', () => {
    const p = page(RELEASE);
    expect(p).toMatchObject({ name: 'Release board', notation: 'kanban' });
    expect(p.data.containers).toHaveLength(1);
    const pool = p.data.containers![0]!;
    expect(pool).toMatchObject({ id: 'board', role: 'pool', axis: 'x', label: 'Release board' });
    expect(pool.lanes).toEqual([
      { id: 'Todo', label: 'Todo', size: 220, members: ['card-1', 'docs'] },
      { id: 'column-2', label: 'In progress', size: 220, members: ['render'] },
      { id: 'review', label: 'Ready for review', size: 220, members: ['grammar', 'tests'] },
    ]);
    expect(pool.box).toMatchObject({ x: 40, y: 40, width: 660 });
  });

  it('reads a card\'s text wrapped into rows, and its metadata as field rows', () => {
    expect(card('card-1').rows).toEqual([{ kind: 'label', text: 'Write the release notes' }]);
    expect(card('render').rows).toEqual([
      { kind: 'label', text: 'Make the renderer work in' }, { kind: 'label', text: 'every case, with room to' }, { kind: 'label', text: 'spare' },
    ]);
    expect(card('tests').rows).toEqual([
      { kind: 'label', text: 'Create parsing tests' }, { kind: 'field', label: 'ticket', value: 'MC-2038' },
      { kind: 'field', label: 'assigned', value: 'K.Sveidqvist' }, { kind: 'field', label: 'priority', value: 'High' },
    ]);
  });

  it('lays the cards out down their columns', () => {
    const laid = laidOutPage(page(RELEASE), { theme: diagramThemeFrom(undefined) });
    const at = (id: string) => laid.data.nodes.find((n) => n.id === id)!.at!;
    expect(at('docs').x).toBeCloseTo(at('card-1').x, 6);
    expect(at('docs').y).toBeGreaterThan(at('card-1').y);
    expect(at('render').x).toBeGreaterThan(at('docs').x + 180);
  });

  it('names the line it cannot read', () => {
    expect(() => parseKanban('kanban\n    card\n  column')).toThrow('Mermaid, line 2: a card comes before any column');
    expect(() => parseKanban('kanban\n  a\n    b[x]@{ priority }')).toThrow('Mermaid, line 3: cannot read "priority" as card metadata');
    expect(() => readKanban('kanban\n  a\n    a[x]')).toThrow('Mermaid, line 3: "a" names two items');
  });
});

describe('writing a Mermaid kanban board', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(RELEASE);
    const text = writeKanban({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeKanban({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes columns and cards from lanes and their shapes, metadata from field rows, and no id it made up', () => {
    const text = writeKanban({ pages: [page(RELEASE)] }).text;
    expect(text).toContain('kanban\n  Todo[Todo]\n    [Write the release notes]\n    docs[Blog about the new diagram]@{ priority: \'Very Low\' }\n  [In progress]\n');
    expect(text).toContain('    tests[Create parsing tests]@{ ticket: \'MC-2038\', assigned: \'K.Sveidqvist\', priority: \'High\' }\n');
  });

  it('warns of what a board does not hold', () => {
    const { warnings } = writeKanban({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100,
      data: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }], containers: [{ id: 'p', role: 'pool', lanes: [{ id: 'l', members: ['a'] }] }] },
    }] });
    expect(warnings).toEqual(['Mermaid kanban cards sit in columns; shapes in none were dropped.', 'Mermaid kanban boards have no connectors; they were dropped.']);
  });
});
