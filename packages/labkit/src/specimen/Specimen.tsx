import type { FillStyle, GradientFill, Track } from '@weasel-js/core';
import {
  ActionsBar,
  Badge,
  type Band,
  BandEditor,
  Button,
  Callout,
  Checkbox,
  CheckboxRow,
  ColorField,
  ColorRow,
  ComboBox,
  type ControlPoint,
  CurveEditor,
  createToastQueue,
  DataGrid,
  DetentSlider,
  Dialog,
  Disclosure,
  GradientEditor,
  InlineRange,
  Input,
  ItemList,
  KeyCap,
  KeySequence,
  LayerStack,
  type LayerStackItem,
  MenuButton,
  NumberField,
  NumberRow,
  OptionsBar,
  PaintInput,
  Plot2D,
  PointPlotter,
  Powerline,
  type PrefGroup,
  PrefsForm,
  PropertyGroup,
  PropertyList,
  PropertyPanel,
  Radio,
  RadioGroup,
  RangeSlider,
  ResizeHandle,
  Select,
  SelectRow,
  SidebarPanel,
  Slider,
  SliderRow,
  StatusBarItem,
  StatusBarSpacer,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextRow,
  type Thumb,
  Timeline,
  ToastRegion,
  ToggleBar,
  ToggleRow,
  ToolButton,
  ToolGroup,
  ToolOptionsBar,
  Tooltip,
  TooltipTrigger,
  Sidebar,
  StatusBar as UiStatusBar,
} from '@weasel-js/ui';
import { type CSSProperties, type ReactNode, useId, useMemo, useRef, useState } from 'react';
import { Focusable } from 'react-aria-components';
import type { JobHandle } from '../job/types';
import { FloatingPanel } from '../primitives/FloatingPanel';
import { JobProgress } from '../primitives/JobProgress';
import { Legend, type LegendEntry } from '../primitives/Legend';
import { ScaleIndicator } from '../primitives/ScaleIndicator';
import { Split } from '../primitives/Split';
import { StatusBar } from '../primitives/StatusBar';
import { Toolbar } from '../primitives/Toolbar';
import { ZoomControl } from '../primitives/ZoomControl';

/** The specimen's sections, in page order. */
export const SPECIMEN_SECTIONS = [
  'Buttons & toggles',
  'Fields & pickers',
  'Panels & property rows',
  'Overlays & feedback',
  'Lists & data',
  'Tool chrome',
  'Editors & plots',
  'Lab chrome',
] as const;

type SectionTitle = (typeof SPECIMEN_SECTIONS)[number];

function Section({ title, children }: { title: SectionTitle; children: ReactNode }) {
  const id = useId();
  return (
    <section className="lk-specimen__section" aria-labelledby={id}>
      <h2 id={id} className="lk-specimen__heading">
        {title}
      </h2>
      <div className="lk-specimen__grid">{children}</div>
    </section>
  );
}

function Cell({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'lk-specimen__cell lk-specimen__cell--wide' : 'lk-specimen__cell'}>
      <span className="lk-specimen__label">{label}</span>
      {children}
    </div>
  );
}

function Dot() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
      <circle cx={8} cy={8} r={4} fill="currentColor" />
    </svg>
  );
}

const LEGEND: LegendEntry[] = [
  { key: 'contour', label: 'contour', color: 'var(--wzl-fg-muted)' },
  { key: 'floor', label: 'floor', color: 'var(--wzl-fg-subtle)', mark: 'dash' },
  { key: 'authored', label: 'authored', color: 'var(--wzl-success)', mark: 'dot' },
  { key: 'replaced', label: 'replaced', color: 'var(--wzl-danger)', mark: 'band' },
];

const PREFS: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        showGrid: {
          kind: 'boolean',
          name: 'Show grid',
          description: 'Draw a grid behind the scene.',
          default: true,
        },
        zoomStep: {
          kind: 'number',
          name: 'Zoom step',
          description: 'Percent the zoom controls move per click.',
          default: 10,
          min: 1,
          max: 50,
        },
        format: {
          kind: 'enum',
          name: 'Format',
          description: 'File type for exported images.',
          default: 'svg',
          options: [
            { value: 'svg', label: 'SVG' },
            { value: 'png', label: 'PNG' },
          ],
        },
      },
    },
  },
};

const JOB: JobHandle = {
  status: 'running',
  done: 34,
  total: 120,
  failures: [],
  error: null,
  start: () => {},
  cancel: () => {},
};

function setAt(
  values: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (head === undefined) return values;
  if (rest.length === 0) return { ...values, [head]: value };
  const inner = (values[head] as Record<string, unknown> | undefined) ?? {};
  return { ...values, [head]: setAt(inner, rest.join('.'), value) };
}

function ButtonsAndToggles() {
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
          <Button variant="primary">Save</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="secondary" iconOnly ariaLabel="Add">
            <Dot />
          </Button>
        </div>
      </Cell>
      <Cell label="Badge">
        <div className="lk-specimen__row">
          <Badge shape="pill" tone="accent" variant="outline" size="sm">
            ACCENT
          </Badge>
          <Badge tone="info" variant="subtle">
            INFO
          </Badge>
          <Badge tone="warn" variant="solid">
            WARN
          </Badge>
          <Badge tone="danger" variant="solid">
            DANGER
          </Badge>
          <Badge tone="muted">MUTED</Badge>
        </div>
      </Cell>
      <Cell label="Checkbox, Switch">
        <div className="lk-specimen__row">
          <Checkbox isSelected={snap} onChange={setSnap}>
            Snap to grid
          </Checkbox>
          <Checkbox isIndeterminate>Mixed</Checkbox>
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
      <Cell label="ToggleBar">
        <ToggleBar
          ariaLabel="Align"
          value={align}
          onChange={setAlign}
          items={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
        />
        <ToggleBar
          ariaLabel="Align, flat"
          variant="flat"
          value={align}
          onChange={setAlign}
          items={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
        />
      </Cell>
      <Cell label="OptionsBar, ActionsBar">
        <div className="lk-specimen__row">
          <OptionsBar
            ariaLabel="Text style"
            items={[
              { value: 'b', label: 'B', selected: bold, onChange: setBold },
              { value: 'i', label: 'I', selected: italic, onChange: setItalic },
            ]}
          />
          <ActionsBar
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
          <Disclosure open={open} onToggle={() => setOpen((o) => !o)} label="Shapes" />
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
          <KeySequence keys={[{ label: '⌘' }, { label: '⇧' }, { label: 'K' }]} separator="+" />
          <KeyCap label="K" />
          <KeyCap label="⌥" variant="minimal" />
        </div>
      </Cell>
    </Section>
  );
}

function FieldsAndPickers() {
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 0.25 }, { value: 0.75 }]);
  const [rate, setRate] = useState(1);
  const [width, setWidth] = useState(6);
  const [color, setColor] = useState('#b08adbff');
  const [gradient, setGradient] = useState<GradientFill>({
    fill: 'linear-gradient',
    from: { x: 0.1, y: 0.1 },
    to: { x: 0.9, y: 0.9 },
    stops: [
      { offset: 0, color: '#0fb5a8' },
      { offset: 1, color: '#f4c43c' },
    ],
  });
  const [paint, setPaint] = useState<FillStyle | null>({ fill: 'solid', color: '#b08adb' });
  return (
    <Section title="Fields & pickers">
      <Cell label="Input">
        <Input label="Name" placeholder="e.g. Pico" />
        <Input
          label="Size"
          leadingAdornment={<span>W</span>}
          trailingAdornment={<span>px</span>}
          defaultValue="120"
        />
        <Input label="Required" isInvalid errorMessage="Name is required." />
      </Cell>
      <Cell label="NumberField, Select, ComboBox">
        <NumberField label="Opacity" minValue={0} maxValue={100} step={5} defaultValue={80} />
        <Select
          label="Color"
          defaultSelectedKey="g"
          options={[
            { value: 'r', label: 'Red' },
            { value: 'g', label: 'Green' },
            { value: 'b', label: 'Blue' },
          ]}
        />
        <ComboBox
          label="Filter"
          placeholder="Type to filter…"
          options={[
            { value: 'r', label: 'Red' },
            { value: 'g', label: 'Green' },
          ]}
        />
      </Cell>
      <Cell label="RangeSlider, Slider">
        <RangeSlider label="Range" defaultValue={[20, 80]} minValue={0} maxValue={100} />
        <RangeSlider
          label="Opacity"
          defaultValue={75}
          minValue={0}
          maxValue={100}
          formatOutput={(v) => `${v}%`}
        />
        <Slider
          ariaLabel="Pair"
          min={0}
          max={1}
          step={0.01}
          constraint="ordered"
          thumbs={thumbs}
          onInput={setThumbs}
          readoutPlacement="inline-after"
        />
      </Cell>
      <Cell label="DetentSlider, InlineRange">
        <DetentSlider
          items={[0.25, 0.5, 1, 2, 4]}
          value={rate}
          onChange={setRate}
          formatLabel={(r) => `${r}×`}
          labels="all"
          ariaLabel="Playback rate"
        />
        <InlineRange
          aria-label="Width"
          min={0}
          max={20}
          value={width}
          onChange={(event) => setWidth(Number((event.target as HTMLInputElement).value))}
        />
      </Cell>
      <Cell label="ColorField, GradientEditor">
        <ColorField value={color} alpha onInput={setColor} onChange={setColor} aria-label="Color" />
        <GradientEditor value={gradient} onInput={setGradient} onChange={setGradient} kindSwitch />
      </Cell>
      <Cell label="PaintInput">
        <PaintInput
          value={paint}
          onInput={setPaint}
          onChange={setPaint}
          allowNone
          aria-label="Fill"
        />
      </Cell>
    </Section>
  );
}

function PanelsAndRows() {
  const [opacity, setOpacity] = useState(0.8);
  const [radius, setRadius] = useState(12);
  const [fill, setFill] = useState('#5841b8');
  const [alpha, setAlpha] = useState(1);
  const [stroke, setStroke] = useState('#2ec27e');
  const [count, setCount] = useState(8);
  const [cap, setCap] = useState('round');
  const [side, setSide] = useState('center');
  const [label, setLabel] = useState('Badge');
  const [visible, setVisible] = useState(true);
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [layers, setLayers] = useState<LayerStackItem[]>([
    { id: 'base', label: 'Base coat' },
    { id: 'wash', label: 'Wash' },
  ]);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  return (
    <Section title="Panels & property rows">
      <Cell label="PropertyPanel">
        <PropertyPanel title="Shape">
          <PropertyList>
            <SliderRow
              label="Opacity"
              value={opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={setOpacity}
            />
            <SliderRow
              label="Radius"
              value={radius}
              min={0}
              max={64}
              unit="px"
              onChange={setRadius}
            />
            <ColorRow
              label="Fill"
              value={fill}
              onChange={setFill}
              alpha={alpha}
              onAlphaChange={setAlpha}
            />
            <ColorRow label="Stroke" value={stroke} onChange={setStroke} />
            <NumberRow label="Count" value={count} min={0} max={100} step={1} onChange={setCount} />
            <SelectRow
              label="Line cap"
              value={cap}
              onChange={setCap}
              options={[
                { value: 'butt', label: 'Butt' },
                { value: 'round', label: 'Round' },
              ]}
            />
            <ToggleRow
              label="Align"
              value={side}
              onChange={setSide}
              options={[
                { value: 'left', label: 'L' },
                { value: 'center', label: 'C' },
                { value: 'right', label: 'R' },
              ]}
            />
            <TextRow label="Label" value={label} onChange={setLabel} />
            <CheckboxRow label="Visible" value={visible} onChange={setVisible} />
            <PropertyGroup title="Bevel" defaultCollapsed>
              <SliderRow label="Rings" value={32} min={4} max={96} step={1} onChange={() => {}} />
            </PropertyGroup>
          </PropertyList>
        </PropertyPanel>
      </Cell>
      <Cell label="PrefsForm">
        <PrefsForm
          schema={PREFS}
          values={prefs}
          onChange={(path, value) => setPrefs((prev) => setAt(prev, path, value))}
        />
      </Cell>
      <Cell label="LayerStack">
        <LayerStack
          items={layers}
          onReorder={(ids) =>
            setLayers(ids.flatMap((id) => layers.filter((item) => item.id === id)))
          }
          renderBody={(item) => <div>settings for {item.label}</div>}
        />
      </Cell>
      <Cell label="Sidebar, SidebarPanel">
        <div className="lk-specimen__box">
          <Sidebar side="right" ariaLabel="Specimen sidebar">
            <SidebarPanel
              title="Selection"
              collapsed={panelCollapsed}
              onToggleCollapse={() => setPanelCollapsed((v) => !v)}
              onHide={() => {}}
            >
              <div className="lk-specimen__pad">2 items selected</div>
            </SidebarPanel>
          </Sidebar>
        </div>
      </Cell>
    </Section>
  );
}

function OverlaysAndFeedback() {
  const calloutAnchor = useRef<HTMLButtonElement>(null);
  const [calloutOpen, setCalloutOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const toasts = useMemo(() => createToastQueue(), []);
  return (
    <Section title="Overlays & feedback">
      <Cell label="Tooltip, Callout, Dialog, Toast">
        <div className="lk-specimen__row">
          <TooltipTrigger>
            <Focusable>
              <button type="button">Hover me</button>
            </Focusable>
            <Tooltip placement="bottom">Duplicates the selected layer</Tooltip>
          </TooltipTrigger>
          <button type="button" ref={calloutAnchor} onClick={() => setCalloutOpen(true)}>
            Callout
          </button>
          <Callout
            triggerRef={calloutAnchor}
            isOpen={calloutOpen}
            onOpenChange={setCalloutOpen}
            stance="notice"
            title="Notice"
          >
            Neutral guidance.
          </Callout>
          <Button onClick={() => setDialogOpen(true)}>Dialog</Button>
          <Dialog
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Preferences"
            footer={
              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                OK
              </Button>
            }
          >
            <p>Dialog body.</p>
          </Dialog>
          <Button
            onClick={() =>
              toasts.add('success', 'Saved', { description: 'All changes stored.', ttlMs: null })
            }
          >
            Toast
          </Button>
          <ToastRegion queue={toasts} placement="bottom-right" />
        </div>
      </Cell>
      <Cell label="Powerline">
        <Powerline
          variant="solid"
          size="sm"
          segments={[
            { text: 'main', tone: 'accent', endCap: 'chevron' },
            { text: '✓ 12', tone: 'info', endCap: 'slant' },
            { text: '~/proj', tone: 'muted' },
          ]}
        />
      </Cell>
      <Cell label="StatusBar">
        <UiStatusBar ariaLabel="Editor status">
          <StatusBarItem>tool: select</StatusBarItem>
          <StatusBarItem>sel: 3</StatusBarItem>
          <StatusBarSpacer />
          <StatusBarItem muted>0.7.0</StatusBarItem>
        </UiStatusBar>
      </Cell>
    </Section>
  );
}

function ListsAndData() {
  return (
    <Section title="Lists & data">
      <Cell label="ItemList">
        <ItemList
          rows={[
            { id: 'a', label: 'Draw rect' },
            { id: 'b', label: 'Fill', selected: true },
            { id: 'c', label: 'Move', muted: true },
          ]}
          empty="Nothing"
        />
      </Cell>
      <Cell label="DataGrid">
        <DataGrid
          rows={[
            { id: '1', name: 'accent', count: 3 },
            { id: '2', name: 'info', count: 1 },
            { id: '3', name: 'danger', count: 2 },
          ]}
          columns={[
            { id: 'name', header: 'name', accessor: (r) => r.name, sortable: true },
            { id: 'count', header: 'count', accessor: (r) => r.count, sortable: true },
          ]}
          defaultSort={{ columnId: 'name', direction: 'asc' }}
        />
      </Cell>
    </Section>
  );
}

function ToolChrome() {
  const [tool, setTool] = useState('select');
  const [paneWidth, setPaneWidth] = useState(160);
  return (
    <Section title="Tool chrome">
      <Cell label="ToolGroup, ToolButton">
        <ToolGroup orientation="horizontal" ariaLabel="Tools">
          {['select', 'rect', 'ellipse'].map((id) => (
            <ToolButton
              key={id}
              icon={<Dot />}
              label={id}
              shortcut={id.slice(0, 1).toUpperCase()}
              active={tool === id}
              tabbable={tool === id}
              onClick={() => setTool(id)}
            />
          ))}
        </ToolGroup>
      </Cell>
      <Cell label="ToolOptionsBar">
        <ToolOptionsBar label="Text">
          <Button size="sm" variant="ghost" iconOnly ariaLabel="Bold">
            B
          </Button>
          <Button size="sm" variant="ghost" iconOnly ariaLabel="Italic">
            I
          </Button>
        </ToolOptionsBar>
      </Cell>
      <Cell label="ResizeHandle">
        <div className="lk-specimen__box">
          <div className="lk-specimen__box-main">content</div>
          <ResizeHandle
            value={paneWidth}
            min={100}
            max={220}
            invert
            onInput={setPaneWidth}
            ariaLabel="Resize"
          />
          <div
            className="lk-specimen__pane"
            style={{ '--lk-specimen-pane-w': `${paneWidth}px` } as CSSProperties}
          >
            {paneWidth}px
          </div>
        </div>
      </Cell>
    </Section>
  );
}

function EditorsAndPlots() {
  const [curve, setCurve] = useState<ControlPoint[]>([
    { x: 0, y: 0 },
    { x: 0.3, y: 0.1 },
    { x: 0.7, y: 0.9 },
    { x: 1, y: 1 },
  ]);
  const [points, setPoints] = useState<ControlPoint[]>([
    { x: 0.2, y: 0.3 },
    { x: 0.5, y: 0.6 },
    { x: 0.8, y: 0.2 },
  ]);
  const [bands, setBands] = useState<Band<{ name: string }>[]>([
    { from: 1 / 64, data: { name: 'Radial' } },
    { from: 1 / 12, data: { name: 'Name plate' } },
  ]);
  const [band, setBand] = useState<number | null>(null);
  const [tracks, setTracks] = useState<Track[]>(
    () =>
      [
        {
          kind: 'sampled',
          label: 'x',
          keys: [
            { t: 0, value: 0 },
            { t: 800, value: 120, easing: 'easeOutCubic' },
            { t: 1600, value: 40 },
          ],
          onTick: () => {},
        },
        {
          kind: 'event',
          label: 'footstep',
          events: [
            { t: 300, fire: () => {} },
            { t: 900, fire: () => {} },
          ],
        },
      ] as Track[],
  );
  const [playhead, setPlayhead] = useState(0);
  return (
    <Section title="Editors & plots">
      <Cell label="Plot2D">
        <Plot2D
          width={260}
          height={130}
          grid={{ divisions: 3 }}
          axes={{}}
          xRange={[0, 2000]}
          yRange={[-0.35, 1.2]}
        />
      </Cell>
      <Cell label="CurveEditor">
        <CurveEditor
          value={curve}
          onInput={setCurve}
          domain="1d"
          interpolation="catmull-rom"
          endpoints="pinned-both"
          addPointMode="click-curve"
          axes={{}}
          fill={{ side: 'below' }}
          width={260}
          height={130}
        />
      </Cell>
      <Cell label="PointPlotter">
        <PointPlotter
          value={points}
          onInput={setPoints}
          xRange={[0, 1]}
          yRange={[0, 1]}
          grid={{ divisions: 3 }}
          axes={{}}
          addPointMode="click-empty"
          width={260}
          height={130}
        />
      </Cell>
      <Cell label="BandEditor" wide>
        <BandEditor<{ name: string }>
          min={1 / 64}
          max={1 / 2}
          scale="log"
          snap
          value={bands}
          onChange={setBands}
          selectedIndex={band}
          onSelect={setBand}
          renderBand={(b) => b.data.name}
          ticks={[1 / 24, 1 / 12, 1 / 6].map((at) => ({ at, label: `1/${Math.round(1 / at)}` }))}
        />
      </Cell>
      <Cell label="Timeline" wide>
        <div className="lk-specimen__timeline">
          <Timeline
            tracks={tracks}
            duration={2000}
            playhead={playhead}
            onChange={setTracks}
            onScrub={setPlayhead}
          />
        </div>
      </Cell>
    </Section>
  );
}

function LabChrome() {
  const [zoom, setZoom] = useState(1);
  return (
    <Section title="Lab chrome">
      <Cell label="Toolbar" wide>
        <Toolbar aria-label="Trial actions">
          <Toolbar.Title>My Trial</Toolbar.Title>
          <Toolbar.Group>
            <Toolbar.Button onClick={() => {}}>Undo</Toolbar.Button>
            <Toolbar.Button onClick={() => {}} disabled>
              Redo
            </Toolbar.Button>
          </Toolbar.Group>
          <Toolbar.Group end>
            <Toolbar.Button onClick={() => {}}>Save</Toolbar.Button>
          </Toolbar.Group>
        </Toolbar>
      </Cell>
      <Cell label="StatusBar">
        <StatusBar>
          <StatusBar.Section>Items: 12</StatusBar.Section>
          <StatusBar.Section>Zoom: 100%</StatusBar.Section>
        </StatusBar>
      </Cell>
      <Cell label="Legend, JobProgress">
        <Legend entries={LEGEND} />
        <JobProgress job={JOB} />
      </Cell>
      <Cell label="ScaleIndicator, ZoomControl">
        <ScaleIndicator zoom={zoom} unit="ft" pixelsPerUnit={50} />
        <ZoomControl zoom={zoom} onZoomChange={setZoom} min={0.1} max={8} />
      </Cell>
      <Cell label="FloatingPanel">
        <div className="lk-specimen__floating-host">
          <FloatingPanel anchor="top-right">
            <Legend entries={LEGEND.slice(0, 2)} />
          </FloatingPanel>
        </div>
      </Cell>
      <Cell label="Split" wide>
        <div className="lk-specimen__box">
          <Split
            sidebar={<div className="lk-specimen__pad">sidebar</div>}
            defaultWidth={160}
            minWidth={100}
            maxWidth={260}
          >
            <div className="lk-specimen__pad">content</div>
          </Split>
        </div>
      </Cell>
    </Section>
  );
}

/**
 * One page of the kit's controls and chrome, each in a small working state: a
 * preview surface for a theme, where every token has something on screen that
 * reads it. Popovers, dialogs and toasts portal into the page itself, so they
 * take whatever theme the page is under.
 */
export function Specimen({ className }: { className?: string }) {
  return (
    <div className={className ? `lk-specimen ${className}` : 'lk-specimen'} data-wzl-portal-host="">
      <ButtonsAndToggles />
      <FieldsAndPickers />
      <PanelsAndRows />
      <OverlaysAndFeedback />
      <ListsAndData />
      <ToolChrome />
      <EditorsAndPlots />
      <LabChrome />
    </div>
  );
}
