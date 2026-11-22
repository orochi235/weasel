import { type ComponentType, useEffect, useRef, useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { ActionSettingsPopover } from './components/ActionSettings';
import { DragGhost } from './components/DragGhost';
import { PropertyCaption } from './components/Properties';
import { AnimatedTransport } from './components/Transport';
import { fakeHandle } from './components/Transport/timelineHandle.fixtures';

// Components no story mounts as they load: a ghost shown only mid-drag, a popover shown only once opened.

const settings = {
  schema: { name: 'Snap Settings', children: { strict: { kind: 'boolean', name: 'Strict', description: '', default: false } } } as PrefGroup,
  values: { strict: true },
  mixed: new Set<string>(),
  onChange: () => {},
};

/** Opens its popover once mounted, so the form and the `PopoverDialog` around it are drawn. */
function OpenSettings() {
  const at = useRef<HTMLDivElement>(null);
  useEffect(() => at.current?.querySelector('button')?.click(), []);
  return <div ref={at}><ActionSettingsPopover settings={settings} label="Snap" /></div>;
}

function Ghost() {
  const [from, setFrom] = useState<HTMLElement | null>(null);
  return <div ref={setFrom}>{from && <DragGhost at={{ left: 8, top: 8, width: 120 }} from={from}>Dragged row</DragGhost>}</div>;
}

export const FIXTURES: [string, ComponentType][] = [
  ['fixture#ActionSettingsPopover', OpenSettings],
  ['fixture#DragGhost', Ghost],
  ['fixture#PropertyCaption', () => <PropertyCaption>Caption</PropertyCaption>],
  ['fixture#AnimatedTransport', () => <AnimatedTransport handle={fakeHandle()} />],
];
