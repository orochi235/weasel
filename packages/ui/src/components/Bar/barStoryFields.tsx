import { useState } from 'react';
import type { Paint } from '@weasel-js/core';
import type { PropertyControlProps } from '@weasel-js/ui/components/Properties';

const ALIGN = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
] as const;

/** One field of every kind and control, each holding its own value, for the stories and the layout test. */
export function useStoryFields(): { id: string; field: PropertyControlProps }[] {
  const [size, setSize] = useState(12);
  const [opacity, setOpacity] = useState(60);
  const [title, setTitle] = useState('Untitled');
  const [notes, setNotes] = useState('A longer note.');
  const [bold, setBold] = useState(true);
  const [snap, setSnap] = useState(false);
  const [grid, setGrid] = useState(true);
  const [align, setAlign] = useState<string>('left');
  const [color, setColor] = useState('#7ec8e3');
  const [paint, setPaint] = useState<Paint | null>({ kind: 'solid', color: '#e37e9c' });
  const [family, setFamily] = useState('sans-serif');
  const [weight, setWeight] = useState(400);
  return [
    { id: 'number', field: { kind: 'number', name: 'Size', value: size, min: 1, onChange: setSize } },
    {
      id: 'number slider',
      field: { kind: 'number', control: 'slider', name: 'Opacity', value: opacity, min: 0, max: 100, onChange: setOpacity },
    },
    { id: 'string', field: { kind: 'string', name: 'Title', value: title, onChange: setTitle } },
    { id: 'string textarea', field: { kind: 'string', control: 'textarea', name: 'Notes', value: notes, onChange: setNotes } },
    { id: 'boolean', field: { kind: 'boolean', name: 'Bold', short: ['B'], value: bold, onChange: setBold } },
    { id: 'boolean switch', field: { kind: 'boolean', control: 'switch', name: 'Snap', value: snap, onChange: setSnap } },
    { id: 'boolean checkbox', field: { kind: 'boolean', control: 'checkbox', name: 'Grid', value: grid, onChange: setGrid } },
    { id: 'enum', field: { kind: 'enum', name: 'Align', value: align, options: ALIGN, onChange: setAlign } },
    { id: 'enum toggle', field: { kind: 'enum', control: 'toggle', name: 'Align', value: align, options: ALIGN, onChange: setAlign } },
    { id: 'enum radio', field: { kind: 'enum', control: 'radio', name: 'Align', value: align, options: ALIGN, onChange: setAlign } },
    { id: 'enum menu', field: { kind: 'enum', control: 'menu', name: 'Align', value: align, options: ALIGN, onChange: setAlign } },
    { id: 'color', field: { kind: 'color', name: 'Stroke', value: color, onChange: setColor } },
    { id: 'paint', field: { kind: 'paint', name: 'Fill', value: paint, onChange: setPaint } },
    { id: 'font-family', field: { kind: 'font-family', name: 'Font', value: family, onChange: setFamily } },
    { id: 'font-weight', field: { kind: 'font-weight', name: 'Weight', value: weight, family, onChange: setWeight } },
  ];
}
