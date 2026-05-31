import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  Badge,
  Button,
  Combobox,
  Dialog,
  EditableValue,
  Menu,
  NumberField,
  Popover,
  RadioGroup,
  Select,
  Slider,
  Switch,
  Tabs,
  Tooltip,
} from './index';

const meta: Meta = {
  title: 'Base UI/Gallery',
  parameters: {
    docs: {
      description: {
        component:
          'Base UI primitives skinned with interstellar tokens. Wrappers live in `src/ui/base/`; shared styles in `src/ui/base/base.less`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const FRUITS = ['Apple', 'Apricot', 'Banana', 'Cherry', 'Mango', 'Peach', 'Plum'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3
        style={{
          font: '300 0.85rem/1 var(--lk-font-display)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--lk-text-muted)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function GalleryBody() {
  const [count, setCount] = useState(8);
  const [volume, setVolume] = useState(40);
  const [size, setSize] = useState('md');
  const [filter, setFilter] = useState('');
  const matches = FRUITS.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Tooltip.Provider>
      <div
        className="lk-theme-interstellar"
        style={{
          background: 'var(--lk-space-nebula)',
          minHeight: '100vh',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <Section title="Buttons">
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </Section>

        <Section title="Badges">
          <Badge>Default</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="muted">Muted</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warn">Warn</Badge>
          <Badge tone="danger">Danger</Badge>
        </Section>

        <Section title="Switch">
          <Switch defaultChecked={false} />
          <Switch defaultChecked />
          <Switch disabled />
        </Section>

        <Section title="Radio group">
          <RadioGroup.Root defaultValue="md" onValueChange={(v) => setSize(String(v))}>
            <RadioGroup.Item value="sm">Small</RadioGroup.Item>
            <RadioGroup.Item value="md">Medium</RadioGroup.Item>
            <RadioGroup.Item value="lg">Large</RadioGroup.Item>
          </RadioGroup.Root>
          <Badge tone="muted">selected: {size}</Badge>
        </Section>

        <Section title="Number field">
          <NumberField value={count} onValueChange={(v) => v != null && setCount(v)} min={0} max={100} />
          <Badge tone="muted">value: {count}</Badge>
        </Section>

        <Section title="Slider">
          <div style={{ width: 240 }}>
            <Slider value={volume} onValueChange={(v) => setVolume(Array.isArray(v) ? v[0] : v)} />
          </div>
          <EditableValue value={volume} onCommit={setVolume} min={0} max={100} />
        </Section>

        <Section title="Select">
          <Select.Root defaultValue="apple">
            <Select.Trigger />
            <Select.Popup>
              <Select.Item value="apple">Apple</Select.Item>
              <Select.Item value="banana">Banana</Select.Item>
              <Select.Item value="mango">Mango</Select.Item>
              <Select.Separator />
              <Select.Item value="cherry">Cherry</Select.Item>
            </Select.Popup>
          </Select.Root>
        </Section>

        <Section title="Menu">
          <Menu.Root>
            <Menu.Trigger>Actions ▾</Menu.Trigger>
            <Menu.Popup>
              <Menu.Item>Duplicate</Menu.Item>
              <Menu.Item>Rename</Menu.Item>
              <Menu.Separator />
              <Menu.GroupLabel>Danger</Menu.GroupLabel>
              <Menu.Item>Delete…</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </Section>

        <Section title="Combobox">
          <Combobox.Root items={matches} onInputValueChange={(v) => setFilter(v ?? '')}>
            <Combobox.Input placeholder="Search fruit…" />
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item key={item} value={item}>{item}</Combobox.Item>}
              </Combobox.List>
              <Combobox.Empty>No matches</Combobox.Empty>
            </Combobox.Popup>
          </Combobox.Root>
        </Section>

        <Section title="Tooltip">
          <Tooltip.Root>
            <Tooltip.Trigger render={<Button variant="ghost">Hover me</Button>} />
            <Tooltip.Popup>Quick hint</Tooltip.Popup>
          </Tooltip.Root>
        </Section>

        <Section title="Popover">
          <Popover.Root>
            <Popover.Trigger render={<Button>Open popover</Button>} />
            <Popover.Popup>
              <div style={{ padding: 8, maxWidth: 220 }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>Heads-up</strong>
                Popovers are anchored overlays with focus management.
              </div>
            </Popover.Popup>
          </Popover.Root>
        </Section>

        <Section title="Dialog">
          <Dialog.Root>
            <Dialog.Trigger render={<Button variant="primary">Open dialog</Button>} />
            <Dialog.Popup>
              <Dialog.Title>Confirm action</Dialog.Title>
              <Dialog.Description>
                This is a focus-trapped modal dialog. Press Esc or click backdrop to dismiss.
              </Dialog.Description>
              <Dialog.Footer>
                <Dialog.Close render={<Button variant="ghost">Cancel</Button>} />
                <Dialog.Close render={<Button variant="primary">Confirm</Button>} />
              </Dialog.Footer>
            </Dialog.Popup>
          </Dialog.Root>
        </Section>

        <Section title="Tabs">
          <div style={{ width: '100%' }}>
            <Tabs.Root defaultValue="one">
              <Tabs.List>
                <Tabs.Tab value="one">Overview</Tabs.Tab>
                <Tabs.Tab value="two">Details</Tabs.Tab>
                <Tabs.Tab value="three">Logs</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="one">Overview panel content.</Tabs.Panel>
              <Tabs.Panel value="two">Details panel content.</Tabs.Panel>
              <Tabs.Panel value="three">Logs panel content.</Tabs.Panel>
            </Tabs.Root>
          </div>
        </Section>
      </div>
    </Tooltip.Provider>
  );
}

export const Gallery: Story = { render: () => <GalleryBody /> };
