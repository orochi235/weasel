import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { PrefObject } from '@weasel-js/prefs';
import { expect, it } from 'vitest';
import { BarItem } from '../Bar/barParts';
import { objectRows, type ObjectLeafParts } from './objectRows';

const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;

it('names a run in a bar section by its section path, so two sections sharing a key under different parents stay apart', () => {
  const children: PrefObject['children'] = {
    strip: {
      name: 'Strip', as: 'bar',
      members: {
        a: { name: 'A', members: { x: { name: 'X', members: { bold: flag('Bold') } } } },
        b: { name: 'B', members: { x: { name: 'X', members: { caps: flag('Caps') } } } },
      },
    },
  };
  const parts: ObjectLeafParts<string> = {
    path: 'text',
    cell: (key) => `text.${key}`,
    rows: () => [],
    barCells: (cells) => cells.map((path) => ({ kind: 'cell', path, content: path })),
    frame: () => [],
  };
  const [bar] = objectRows(children, parts) as ReactElement<{ children: ReactNode[] }>[];
  const nodes = bar!.props.children.filter(isValidElement) as ReactElement<{ in?: string }>[];
  const keys = nodes.map((n) => n.key);
  expect(new Set(keys).size).toBe(keys.length);
  const containers = nodes.filter((n) => n.type === BarItem).map((n) => n.props.in);
  expect(containers).toEqual(['text.#strip.#a.#x', 'text.#strip.#b.#x']);
});
