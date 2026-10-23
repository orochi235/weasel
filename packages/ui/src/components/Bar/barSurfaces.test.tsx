import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefsForm } from '../Prefs/PrefsForm';
import { SelectionPanel } from '../SelectionPanel/SelectionPanel';

// A group drawn `as: 'bar'` on the surfaces that are not `Bar` itself.

interface Data { kind: string; [field: string]: unknown }
interface Pose { x: number; y: number; width: number; height: number }

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });

describe('a section drawn as a bar in SelectionPanel', () => {
  it('is one line of bar forms under no heading, writing into the node', () => {
    const scene = createScene<Data, 'default', Pose>({ systemLayers: [{ id: 'default' }] });
    scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { kind: 'thing', bold: false, size: 12 } });
    const properties: NodePropertiesEntry[] = [{
      name: 'thing',
      schema: {
        name: 'Properties',
        members: {
          text: {
            name: 'Text',
            as: 'bar',
            members: {
              'data.bold': flag('Bold'),
              'data.size': { kind: 'number', name: 'Size', description: '', default: 12 },
            },
          },
        },
      },
    }];
    render(
      <SelectionPanel
        scene={scene}
        selection={{ current: ['a'] } as unknown as SelectionApi}
        properties={properties}
        routing={routing}
      />,
    );
    const bar = screen.getByRole('toolbar', { name: 'Text' });
    expect(screen.queryByRole('heading', { name: 'Text' })).toBeNull();
    expect(bar.querySelector('[data-bar-label]')).toHaveTextContent('Size');
    // A flag is a switch in a panel's row and a button in its bar.
    fireEvent.click(within(bar).getByRole('button', { name: 'Bold' }));
    expect(scene.get(asNodeId('a'))?.data.bold).toBe(true);
  });
});

describe('a section drawn as a bar in a form’s object leaf', () => {
  it('is one line of the object’s fields, each writing the object whole', () => {
    const schema: PrefGroup = {
      name: 'Root',
      children: {
        font: {
          kind: 'object',
          name: 'Font',
          description: '',
          default: { bold: false, italic: false },
          children: {
            style: { name: 'Style', as: 'bar', members: { bold: flag('Bold'), italic: flag('Italic') } },
          },
        } as PrefLeaf,
      },
    };
    const onChange = vi.fn();
    render(<PrefsForm schema={schema} values={{ font: { bold: false, italic: true } }} onChange={onChange} />);
    const bar = screen.getByRole('toolbar', { name: 'Style' });
    expect(within(bar).getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(bar).getByRole('button', { name: 'Bold' }));
    expect(onChange).toHaveBeenCalledWith('font', { bold: true, italic: true });
  });
});

describe('a section drawn as a bar in a panel’s object leaf', () => {
  it('is one line of the object’s fields in their bar forms, each writing the object whole', () => {
    const scene = createScene<Data, 'default', Pose>({ systemLayers: [{ id: 'default' }] });
    scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { kind: 'thing', font: { bold: false, size: 12 } } });
    const properties: NodePropertiesEntry[] = [{
      name: 'thing',
      schema: {
        name: 'Properties',
        members: {
          'data.font': {
            kind: 'object',
            name: 'Font',
            description: '',
            default: { bold: false, size: 12 },
            children: {
              style: { name: 'Style', as: 'bar', members: { bold: flag('Bold'), size: { kind: 'number', name: 'Size', description: '', default: 12 } } },
            },
          } as PrefLeaf,
        },
      },
    }];
    render(
      <SelectionPanel
        scene={scene}
        selection={{ current: ['a'] } as unknown as SelectionApi}
        properties={properties}
        routing={routing}
      />,
    );
    const bar = screen.getByRole('toolbar', { name: 'Style' });
    expect(screen.queryByRole('heading', { name: 'Style' })).toBeNull();
    expect(bar.querySelector('[data-bar-label]')).toHaveTextContent('Size');
    fireEvent.click(within(bar).getByRole('button', { name: 'Bold' }));
    expect(scene.get(asNodeId('a'))?.data.font).toEqual({ bold: true, size: 12 });
  });
});
