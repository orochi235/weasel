import { useState } from 'react';
import { solid, type ToolPrefGroup } from '@weasel-js/core';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import s from './PrefSchemaEditor.stories.module.css';

const meta: Meta<typeof PrefSchemaEditor> = {
  title: 'Primitives/PrefSchemaEditor',
  component: PrefSchemaEditor,
};
export default meta;

type Story = StoryObj<typeof PrefSchemaEditor>;

const SCHEMA: ToolPrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      description: 'Drawing surface behavior.',
      children: {
        zoomStep: { kind: 'number', name: 'Zoom step', description: 'Wheel zoom increment (%).', default: 10, min: 1, max: 50 },
        showGrid: { kind: 'boolean', name: 'Show grid', description: 'Draw the alignment grid.', default: true },
        author: { kind: 'string', name: 'Author', description: 'Embedded in exported metadata.', default: '' },
        units: {
          kind: 'enum',
          name: 'Units',
          description: 'Ruler units.',
          default: 'px',
          options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }],
        },
        accent: { kind: 'color', name: 'Accent', description: 'Highlight color.', default: '#5841b8' },
        fill: { kind: 'paint', name: 'Fill', description: 'Fill for new shapes.', default: solid('#ffffff') },
        margin: {
          kind: 'object',
          name: 'Margin',
          description: 'Space kept clear around the page.',
          default: { x: 8, y: 8 },
          children: {
            x: { kind: 'number', name: 'X', description: 'Horizontal margin.', default: 8 },
            y: { kind: 'number', name: 'Y', description: 'Vertical margin.', default: 8 },
          },
        },
      },
    },
  },
};

export const Default: Story = {
  render: function DefaultStory() {
    const [schema, setSchema] = useState(SCHEMA);
    return (
      <div className={s.frame}>
        <PrefSchemaEditor schema={schema} onChange={setSchema} />
      </div>
    );
  },
};
