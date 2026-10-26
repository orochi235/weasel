import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { DefaultMotif } from '../MotifFrame';
import { notch, tab } from '../MotifFrame/motifs';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const flag = (name: string) => ({ kind: 'boolean' as const, name, description: '', default: false });
const motifOf = (name: string) =>
  (screen.queryByRole('group', { name }) ?? screen.getByRole('region', { name })).getAttribute('data-motif');

it("draws a group's frame in the motif its schema names, and a group naming none in the form's own", () => {
  const schema: PrefGroup = {
    name: '',
    children: {
      canvas: { name: 'Canvas', motif: 'hero', children: {
        grid: flag('Grid'),
        snap: { name: 'Snapping', motif: 'wall', children: { on: flag('Snap on') } },
      } },
      view: { name: 'View', children: { zoom: flag('Zoom') } },
    },
  };
  render(
    <DefaultMotif named={{ hero: tab(), wall: notch() }}>
      <PrefsForm layout="columns" schema={schema} onChange={() => {}} />
    </DefaultMotif>,
  );
  expect(motifOf('Canvas')).toBe('tab');
  expect(motifOf('Snapping')).toBe('notch');
  expect(motifOf('View')).toBe('well');
});

it("draws a panel group's box, and an object's panel section, in the motif named", () => {
  const object = {
    kind: 'object', name: 'Shadow', description: '', default: { blur: 0 },
    children: { box: { name: 'Blur box', as: 'panel', motif: 'hero', members: { blur: { kind: 'number', name: 'Blur', description: '', default: 0 } } } },
  } as unknown as PrefLeaf;
  const schema: PrefGroup = {
    name: '',
    children: {
      extras: { name: 'Extras', as: 'panel', motif: 'hero', children: { beta: flag('Beta'), shadow: object } },
    },
  };
  render(
    <DefaultMotif named={{ hero: tab() }}>
      <PrefsForm layout="rail" schema={schema} onChange={() => {}} />
    </DefaultMotif>,
  );
  expect(motifOf('Extras')).toBe('tab');
  expect(motifOf('Blur box')).toBe('tab');
});
