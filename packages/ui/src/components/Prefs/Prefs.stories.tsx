import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PrefsForm, type PrefRenderContext } from './PrefsForm';
import { PrefsDialog } from './PrefsDialog';
import type { PrefGroup } from './schema';
import { Button } from '../Button';
import { Select } from '../Select';

const meta: Meta<typeof PrefsForm> = {
  title: 'Primitives/Prefs',
  component: PrefsForm,
};
export default meta;

type Story = StoryObj<typeof PrefsForm>;

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      description: 'Drawing surface behavior.',
      children: {
        showGrid: { kind: 'boolean', name: 'Show grid', description: 'Draw the alignment grid.', default: true },
        smoothing: { kind: 'boolean', name: 'Smoothing', description: 'Antialias strokes.', default: true, control: 'switch' },
        zoomStep: { kind: 'number', name: 'Zoom step', description: 'Wheel zoom increment (%).', default: 10, min: 1, max: 50 },
        opacity: { kind: 'number', name: 'Default opacity', description: 'Fill opacity for new shapes.', default: 80, min: 0, max: 100, control: 'slider' },
        snapping: {
          name: 'Snapping',
          description: 'Sub-group renders as an indented panel.',
          children: {
            enabled: { kind: 'boolean', name: 'Enabled', description: 'Master snapping toggle.', default: true },
            tolerance: { kind: 'number', name: 'Tolerance', description: 'Snap distance in px.', default: 6, min: 1, max: 24, control: 'slider' },
          },
        },
      },
    },
    io: {
      name: 'Import / Export',
      children: {
        author: { kind: 'string', name: 'Author', description: 'Embedded in exported metadata.', default: '' },
        notes: { kind: 'string', name: 'Notes', description: 'Free-form export notes.', default: '', control: 'textarea' },
        format: {
          kind: 'enum',
          name: 'Format',
          description: 'Default export format.',
          default: 'svg',
          options: [
            { value: 'svg', label: 'SVG' },
            { value: 'png', label: 'PNG' },
            { value: 'pdf', label: 'PDF' },
          ],
        },
        quality: {
          kind: 'enum',
          name: 'Raster quality',
          description: 'Radio presentation of an enum.',
          default: 'high',
          control: 'radio',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'high', label: 'High' },
          ],
        },
        // App-defined kind: rendered via the `renderers` prop below.
        favoriteTool: { kind: 'registry-enum', name: 'Favorite tool', description: 'Options come from a runtime registry.', default: 'pen' },
        debugManifest: { kind: 'boolean', name: 'Debug manifest', description: 'Dev-only: embed the debug manifest.', default: false, hidden: true },
      },
    },
  },
};

/** Story-local stand-in for an app registry. */
const TOOL_REGISTRY = ['pen', 'rect', 'ellipse', 'hand'];

function useStoryValues() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const onChange = (path: string, value: unknown) =>
    setValues((prev) => {
      const next = structuredClone(prev);
      const parts = path.split('.');
      let cur: Record<string, unknown> = next;
      for (const seg of parts.slice(0, -1)) {
        cur = (cur[seg] ??= {}) as Record<string, unknown>;
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  return { values, onChange };
}

const STORY_RENDERERS = {
  'registry-enum': (ctx: PrefRenderContext) => (
    <Select<string>
      options={TOOL_REGISTRY.map((t) => ({ value: t, label: t }))}
      selectedKey={String(ctx.value)}
      onSelectionChange={(v) => ctx.setValue(v)}
      aria-label={ctx.pref.name}
    />
  ),
};

export const Form: Story = {
  render: function FormStory() {
    const { values, onChange } = useStoryValues();
    return (
      <PrefsForm schema={SCHEMA} values={values} onChange={onChange} renderers={STORY_RENDERERS} />
    );
  },
};

export const InDialog: Story = {
  render: function DialogStory() {
    const [open, setOpen] = useState(false);
    const [showHidden, setShowHidden] = useState(false);
    const { values, onChange } = useStoryValues();
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open preferences</Button>
        <PrefsDialog
          isOpen={open}
          onOpenChange={setOpen}
          schema={SCHEMA}
          values={values}
          onChange={onChange}
          renderers={STORY_RENDERERS}
          showHidden={showHidden}
          headerExtra={
            <Button variant="ghost" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? 'Hide dev prefs' : 'Show dev prefs'}
            </Button>
          }
        />
      </>
    );
  },
};
