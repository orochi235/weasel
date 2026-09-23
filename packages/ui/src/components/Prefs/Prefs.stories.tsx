import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { expect } from '@weasel-js/forge/play';
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

/** A deeper schema than `SCHEMA`: enough top-level groups to overflow the
 *  columns layout, and a third level to show what the rail leaves out. */
const DEEP_SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: SCHEMA.children.canvas,
    io: SCHEMA.children.io,
    editing: {
      name: 'Editing',
      description: 'What the tools do to the scene.',
      children: {
        undoDepth: { kind: 'number', name: 'Undo depth', description: 'Steps kept in history.', default: 100, min: 1, max: 500 },
        autosave: { kind: 'boolean', name: 'Autosave', description: 'Write to storage as you draw.', default: true, control: 'switch' },
        nudge: {
          name: 'Nudge',
          description: 'Arrow-key movement.',
          children: {
            step: { kind: 'number', name: 'Step', description: 'Distance per press.', default: 1, min: 1, max: 20 },
            shiftStep: { kind: 'number', name: 'Shift step', description: 'Distance with shift held.', default: 10, min: 1, max: 100 },
            wrap: {
              name: 'Wrapping',
              description: 'Third level: no rail entry, indented in the pane.',
              children: {
                atEdge: { kind: 'boolean', name: 'Wrap at edge', description: 'Continue from the opposite side.', default: false },
              },
            },
          },
        },
      },
    },
    appearance: {
      name: 'Appearance',
      description: 'Chrome and theme.',
      children: {
        density: {
          kind: 'enum',
          name: 'Density',
          description: 'Control sizing.',
          default: 'comfortable',
          options: [
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'roomy', label: 'Roomy' },
          ],
        },
        accent: { kind: 'color', name: 'Accent', description: 'Highlight color.', default: '#5841b8' },
        chrome: {
          name: 'Chrome',
          children: {
            statusBar: { kind: 'boolean', name: 'Status bar', description: 'Show the bar along the bottom.', default: true },
            rulers: { kind: 'boolean', name: 'Rulers', description: 'Show rulers around the page.', default: false },
          },
        },
      },
    },
    shortcuts: {
      name: 'Shortcuts',
      description: 'Keyboard bindings.',
      children: {
        preset: {
          kind: 'enum',
          name: 'Preset',
          description: 'Which app the bindings imitate.',
          default: 'weasel',
          control: 'radio',
          options: [
            { value: 'weasel', label: 'Weasel' },
            { value: 'illustrator', label: 'Illustrator' },
          ],
        },
      },
    },
    advanced: {
      name: 'Advanced',
      description: 'Rarely touched.',
      children: {
        gpu: { kind: 'boolean', name: 'GPU rendering', description: 'Paint through WebGL.', default: true, control: 'switch' },
        traceOps: { kind: 'boolean', name: 'Trace ops', description: 'Log every scene mutation.', default: false },
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

export const Rail: Story = {
  parameters: {
    viewport: { options: { wide: { styles: { width: '960px', height: '640px' } } } },
  },
  globals: { viewport: { value: 'wide' } },
  /**
   * The half jsdom cannot judge: whether the layout holds up under real
   * layout. A flex row whose child resolves to zero renders an empty pane
   * with every unit test green, and neither a column that overflows sideways
   * nor a rail that scrolled away with its pane is visible to a DOM query.
   */
  play: async ({ canvasElement, step }) => {
    const layout = canvasElement.querySelector('[class*="railLayout"]') as HTMLElement;
    const rail = canvasElement.querySelector('nav') as HTMLElement;
    const pane = canvasElement.querySelector('[class*="pane"]') as HTMLElement;

    await step('rail and pane both have a box', () => {
      expect(rail.getBoundingClientRect().width).toBeGreaterThan(150);
      expect(pane.getBoundingClientRect().width).toBeGreaterThan(200);
      expect(rail.getBoundingClientRect().height).toBeGreaterThan(300);
    });

    await step('nothing overflows sideways', () => {
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      expect(pane.scrollWidth).toBeLessThanOrEqual(pane.clientWidth + 1);
    });

    await step('the rail gives way rather than squeezing the pane out', () => {
      const host = layout.parentElement as HTMLElement;
      const restore = host.style.width;
      host.style.width = '420px';
      expect(rail.getBoundingClientRect().width).toBeLessThan(180);
      expect(pane.getBoundingClientRect().width).toBeGreaterThan(200);
      host.style.width = restore;
    });

    await step('the pane is the scrolling box, and it fills the layout', () => {
      // Asserted on the boxes rather than by scrolling: this group's rows fit,
      // so a `scrollTop` assignment would read back 0 whether or not the pane
      // can scroll at all.
      expect(getComputedStyle(pane).overflowY).toBe('auto');
      expect(getComputedStyle(layout).overflowY).toBe('hidden');
      expect(pane.clientHeight).toBe(layout.clientHeight);
    });
  },
  render: function RailStory() {
    const { values, onChange } = useStoryValues();
    return (
      <div style={{ height: 520, border: '1px solid var(--wzl-border)', borderRadius: 6, overflow: 'hidden' }}>
        <PrefsForm
          layout="rail"
          schema={DEEP_SCHEMA}
          values={values}
          onChange={onChange}
          renderers={STORY_RENDERERS}
        />
      </div>
    );
  },
};

export const RailFilterable: Story = {
  render: function RailFilterableStory() {
    const { values, onChange } = useStoryValues();
    return (
      <div style={{ height: 520, border: '1px solid var(--wzl-border)', borderRadius: 6, overflow: 'hidden' }}>
        <PrefsForm
          layout="rail"
          filterable
          schema={DEEP_SCHEMA}
          values={values}
          onChange={onChange}
          renderers={STORY_RENDERERS}
        />
      </div>
    );
  },
};

export const RailInDialog: Story = {
  render: function RailInDialogStory() {
    const [open, setOpen] = useState(true);
    const { values, onChange } = useStoryValues();
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open preferences</Button>
        <PrefsDialog
          isOpen={open}
          onOpenChange={setOpen}
          layout="rail"
          filterable
          schema={DEEP_SCHEMA}
          values={values}
          onChange={onChange}
          renderers={STORY_RENDERERS}
          dialogClassName="prefs-rail-dialog"
          footer={<Button variant="ghost" onClick={() => setOpen(false)}>Done</Button>}
        />
      </>
    );
  },
};
