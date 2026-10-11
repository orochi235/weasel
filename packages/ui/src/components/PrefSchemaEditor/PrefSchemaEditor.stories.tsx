import { useState } from 'react';
import { defaultNodeProperties, solid } from '@weasel-js/core';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { prefType, type PrefGroup, type PrefObject } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import s from './PrefSchemaEditor.stories.module.css';

const meta: Meta<typeof PrefSchemaEditor> = {
  title: 'Primitives/PrefSchemaEditor',
  component: PrefSchemaEditor,
};
export default meta;

type Story = StoryObj<typeof PrefSchemaEditor>;

const SCHEMA: PrefGroup = {
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
    export: {
      name: 'Export',
      description: 'What a saved file carries.',
      children: {
        format: {
          kind: 'enum',
          name: 'Format',
          description: 'File type written by Export.',
          default: 'svg',
          options: [{ value: 'svg', label: 'SVG' }, { value: 'png', label: 'PNG' }],
        },
        embedFonts: { kind: 'boolean', name: 'Embed fonts', description: 'Carry the fonts the page uses.', default: false },
        raster: {
          name: 'Raster',
          children: {
            scale: { kind: 'number', name: 'Scale', description: 'Pixels per unit.', default: 2, min: 1, max: 8 },
            transparent: { kind: 'boolean', name: 'Transparent', description: 'Leave the page background out.', default: true },
          },
        },
      },
    },
    shortcuts: {
      name: 'Shortcuts',
      children: {
        holdToPan: { kind: 'boolean', name: 'Hold Space to pan', description: 'Space turns the pointer into the hand.', default: true },
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

const GradientStop = prefType('GradientStop', {
  kind: 'object',
  name: 'Stop',
  description: 'One color along a gradient.',
  default: { at: 0.5, color: '#888888' },
  children: {
    at: { kind: 'number', name: 'At', description: 'Where along the gradient, from 0 to 1.', default: 0.5, min: 0, max: 1, step: 0.01 },
    color: { kind: 'color', name: 'Color', description: 'The color there.', default: '#888888' },
  },
} satisfies PrefObject);

const TYPED: PrefGroup = {
  name: 'Preferences',
  children: {
    gradient: {
      name: 'Gradient',
      children: {
        first: { ...GradientStop, name: 'First stop', default: { at: 0, color: '#5841b8' } },
        stops: { kind: 'list', name: 'Stops', description: 'The colors between the ends.', default: [], item: GradientStop },
        weights: {
          kind: 'map', name: 'Weights', description: 'How strongly each named stop pulls.', default: {},
          item: { kind: 'number', name: 'Weight', description: '', default: 1, min: 0 },
        },
      },
    },
  },
};

/**
 * Types declared in code and handed to the editor: each is offered by name beside the kinds, for a pref and for
 * the entry of a list or a map, shows as one row in the tree, and prints as its name in the literal.
 */
export const Types: Story = {
  render: function TypesStory() {
    const [schema, setSchema] = useState(TYPED);
    return (
      <div className={s.frame}>
        <PrefSchemaEditor schema={schema} onChange={setSchema} types={[GradientStop]} />
      </div>
    );
  },
};

/** With somewhere to send them, the Changes pane offers to submit what was edited. */
export const Submitting: Story = {
  render: function SubmittingStory() {
    const [schema, setSchema] = useState(SCHEMA);
    return (
      <div className={s.frame}>
        <PrefSchemaEditor schema={schema} onChange={setSchema} onSubmit={() => new Promise((resolve) => { setTimeout(resolve, 800); })} />
      </div>
    );
  },
};

/** A node's property schema: sections for headings, each leaf keyed by its node path, previewed as a properties panel. */
export const NodeProperties: Story = {
  render: function NodePropertiesStory() {
    const [schema, setSchema] = useState(defaultNodeProperties.find((e) => e.name === 'rect')!.schema);
    return (
      <div className={s.frame}>
        <PrefSchemaEditor schema={schema} onChange={setSchema} />
      </div>
    );
  },
};
