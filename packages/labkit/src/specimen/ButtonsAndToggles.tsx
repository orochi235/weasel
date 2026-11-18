import { Badge } from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Disclosure } from '@weasel-js/ui/components/Disclosure';
import { KeyCap, KeySequence } from '@weasel-js/ui/components/Keycaps';
import { MenuButton } from '@weasel-js/ui/components/MenuButton';
import { Radio, RadioGroup } from '@weasel-js/ui/components/RadioGroup';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { Switch } from '@weasel-js/ui/components/Switch';
import { Tab, TabList, TabPanel, Tabs } from '@weasel-js/ui/components/Tabs';
import { useState } from 'react';
import { ALIGN_ITEMS } from './alignItems';
import { Cell } from './Cell';
import { Dot } from './Dot';
import { Section } from './Section';

export function ButtonsAndToggles() {
  const [snap, setSnap] = useState(true);
  const [wifi, setWifi] = useState(false);
  const [align, setAlign] = useState<string | null>('center');
  const [bold, setBold] = useState(true);
  const [italic, setItalic] = useState(false);
  const [open, setOpen] = useState(true);
  return (
    <Section title="Buttons & toggles">
      <Cell label="Button">
        <div className="lk-specimen__row">
          <Button stance="confirm">Save</Button>
          <Button>Cancel</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
          <Button iconOnly aria-label="Add">
            <Dot />
          </Button>
        </div>
      </Cell>
      <Cell label="Badge">
        <div className="lk-specimen__row">
          <Badge shape="pill" emphasis="high" variant="outline" size="sm">
            ACCENT
          </Badge>
          <Badge grade="info" variant="subtle">
            INFO
          </Badge>
          <Badge grade="warn" variant="solid">
            WARN
          </Badge>
          <Badge grade="danger" variant="solid">
            DANGER
          </Badge>
          <Badge emphasis="low">MUTED</Badge>
        </div>
      </Cell>
      <Cell label="Checkbox, Switch">
        <div className="lk-specimen__row">
          <Checkbox isSelected={snap} onChange={setSnap}>
            Snap to grid
          </Checkbox>
          <Checkbox indeterminate>Mixed</Checkbox>
          <Switch isSelected={wifi} onChange={setWifi}>
            Wifi
          </Switch>
        </div>
      </Cell>
      <Cell label="RadioGroup">
        <RadioGroup label="Snap mode" orientation="horizontal" defaultValue="grid">
          <Radio value="off">Off</Radio>
          <Radio value="grid">Grid</Radio>
          <Radio value="pixel">Pixel</Radio>
        </RadioGroup>
      </Cell>
      <Cell label="SegmentedBar">
        <SegmentedBar aria-label="Align" value={align} onChange={setAlign} items={ALIGN_ITEMS} />
        <SegmentedBar
          aria-label="Align, flat"
          variant="flat"
          value={align}
          onChange={setAlign}
          items={ALIGN_ITEMS}
        />
      </Cell>
      <Cell label="SegmentedBar, each and momentary">
        <div className="lk-specimen__row">
          <SegmentedBar
            mode="each"
            aria-label="Text style"
            items={[
              { value: 'b', label: 'B', selected: bold, onChange: setBold },
              { value: 'i', label: 'I', selected: italic, onChange: setItalic },
            ]}
          />
          <SegmentedBar
            mode="momentary"
            items={[
              { value: 'undo', label: 'Undo', onAction: () => {} },
              { value: 'redo', label: 'Redo', onAction: () => {} },
            ]}
          />
        </div>
      </Cell>
      <Cell label="MenuButton, Disclosure">
        <div className="lk-specimen__row">
          <MenuButton
            label="Add trial…"
            onAction={() => {}}
            items={[
              { value: 'sine', label: 'Sine wave' },
              { value: 'annotate', label: 'Annotate' },
            ]}
          />
          <Disclosure open={open} onOpenChange={setOpen} label="Shapes" />
        </div>
      </Cell>
      <Cell label="Tabs">
        <Tabs>
          <TabList aria-label="Sections">
            <Tab id="props">Props</Tab>
            <Tab id="events">Events</Tab>
            <Tab id="snapshot">Snapshot</Tab>
          </TabList>
          <TabPanel id="props">Props panel.</TabPanel>
          <TabPanel id="events">Events panel.</TabPanel>
          <TabPanel id="snapshot">Snapshot panel.</TabPanel>
        </Tabs>
      </Cell>
      <Cell label="Keycaps">
        <div className="lk-specimen__row">
          <KeySequence keys={[{ label: '⌘' }, { label: '⇧' }, { label: 'K' }]} variant="inverse" />
          <KeyCap label="K" variant="inverse" />
          <KeyCap label="⌥" />
        </div>
      </Cell>
    </Section>
  );
}
