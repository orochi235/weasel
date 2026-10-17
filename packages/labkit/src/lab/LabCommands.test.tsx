import { act, fireEvent } from '@testing-library/react';
import { type ActionsRegistry, evaluateActive, useActionsRegistry } from '@weasel-js/core';
import { isApplePlatform } from '@weasel-js/gestures';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { AddIcon } from '@weasel-js/ui';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { LabContribution } from '../chrome';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from './Lab';
import { type LabContextValue, useLabContext } from './LabContext';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const MOD = isApplePlatform() ? { metaKey: true } : { ctrlKey: true };
const make = (name: string) =>
  defineInstrument<Record<string, never>, Record<string, never>>({
    name,
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: () => null,
  });
const Staged = make('Staged');
const Plain = make('Plain');
const Third = make('Third');

let registry: ActionsRegistry | null = null;
let lab: LabContextValue | null = null;
function Grab() {
  registry = useActionsRegistry() as ActionsRegistry;
  lab = useLabContext();
  return null;
}
const ids = () => registry?.list().map((a) => a.id) ?? [];
const trigger = (id: string) =>
  act(async () => {
    registry?.trigger(id);
  });

describe('a lab’s header commands', () => {
  it('registers lab.add.<name> per instrument, and running one adds that trial', async () => {
    await renderSettled(
      <Lab instruments={[Staged, Plain]} defaultInstrument="Staged">
        <Grab />
      </Lab>,
    );
    expect(ids()).toEqual(expect.arrayContaining(['lab.add.Staged', 'lab.add.Plain']));
    const before = lab?.trials.length ?? 0;
    await trigger('lab.add.Plain');
    expect(lab?.trials.length).toBe(before + 1);
    expect(lab?.trials.at(-1)?.instrumentName).toBe('Plain');
  });

  it('labels the add command "Add trial" when the lab has one instrument', async () => {
    await renderSettled(
      <Lab instruments={[Staged]} defaultInstrument="Staged">
        <Grab />
      </Lab>,
    );
    expect(registry?.list().find((a) => a.id === 'lab.add.Staged')?.label).toBe('Add trial');
  });

  it('registers no add command with addTrial={false}', async () => {
    await renderSettled(
      <Lab instruments={[Staged, Plain]} defaultInstrument="Staged" addTrial={false}>
        <Grab />
      </Lab>,
    );
    expect(ids().filter((id) => id.startsWith('lab.add.'))).toEqual([]);
  });

  it('registers an add command for an instrument added after mount', async () => {
    const { rerender } = await renderSettled(
      <Lab instruments={[Staged, Plain]} defaultInstrument="Staged">
        <Grab />
      </Lab>,
    );
    expect(ids()).not.toContain('lab.add.Third');
    await act(async () => {
      rerender(
        <Lab instruments={[Staged, Plain, Third]} defaultInstrument="Staged">
          <Grab />
        </Lab>,
      );
    });
    expect(ids()).toContain('lab.add.Third');
  });

  it('registers lab.mode.* and marks the current mode active', async () => {
    await renderSettled(
      <Lab instruments={[Staged]} defaultInstrument="Staged">
        <Grab />
      </Lab>,
    );
    await trigger('lab.mode.dark');
    expect(lab?.mode).toBe('dark');
    const find = (id: string) => registry?.list().find((a) => a.id === id);
    const dark = find('lab.mode.dark');
    const light = find('lab.mode.light');
    if (!dark || !light) throw new Error('mode commands missing');
    expect(evaluateActive(dark)).toBe(true);
    expect(evaluateActive(light)).toBe(false);
  });

  it("registers a header item contribution as lab.item.<id>, run with the lab's chrome context", async () => {
    const onActivate = vi.fn();
    const labChrome: LabContribution[] = [
      {
        id: 'x-hello',
        region: 'header',
        item: { icon: AddIcon, label: 'Hello', onActivate },
      },
    ];
    await renderSettled(
      <Lab instruments={[Staged]} defaultInstrument="Staged" labChrome={labChrome}>
        <Grab />
      </Lab>,
    );
    await trigger('lab.item.x-hello');
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0]?.[0]).toHaveProperty('addTrial');
  });

  it('runs a header item from its keys, and not while typing in a text field', async () => {
    const onActivate = vi.fn();
    const labChrome: LabContribution[] = [
      {
        id: 'x-key',
        region: 'header',
        item: {
          icon: AddIcon,
          label: 'Key',
          onActivate,
          keys: { kind: 'key', key: 'j', mods: { mod: true } },
        },
      },
    ];
    const { container } = await renderSettled(
      <Lab instruments={[Staged]} defaultInstrument="Staged" labChrome={labChrome}>
        <input data-testid="field" />
      </Lab>,
    );
    await act(async () => {
      fireEvent.keyDown(window, { key: 'j', ...MOD });
    });
    expect(onActivate).toHaveBeenCalledTimes(1);
    const field = container.querySelector('input');
    if (!field) throw new Error('no field');
    await act(async () => {
      field.focus();
      fireEvent.keyDown(field, { key: 'j', ...MOD });
    });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('registers nothing for a header render contribution', async () => {
    const labChrome: LabContribution[] = [{ id: 'x-render', region: 'header', render: () => null }];
    await renderSettled(
      <Lab instruments={[Staged]} defaultInstrument="Staged" labChrome={labChrome}>
        <Grab />
      </Lab>,
    );
    expect(ids().filter((id) => id.includes('x-render'))).toEqual([]);
  });

  it("leaves lab.zoom in place beside a header item whose id is 'zoom'", async () => {
    const onActivate = vi.fn();
    const labChrome: LabContribution[] = [
      { id: 'zoom', region: 'header', item: { icon: AddIcon, label: 'Mine', onActivate } },
    ];
    await renderSettled(
      <Lab instruments={[Staged]} defaultInstrument="Staged" labChrome={labChrome}>
        <Grab />
      </Lab>,
    );
    expect(registry?.list().find((a) => a.id === 'lab.zoom')?.label).not.toBe('Mine');
    expect(registry?.list().find((a) => a.id === 'lab.item.zoom')?.label).toBe('Mine');
  });

  it.each([
    ['header={false}', { header: false }],
    ['present', { present: true }],
  ] as const)("runs a header item's keys with %s", async (_, props) => {
    const onActivate = vi.fn();
    const labChrome: LabContribution[] = [
      {
        id: 'fg-info',
        region: 'header',
        item: {
          icon: AddIcon,
          label: 'Info',
          onActivate,
          keys: { kind: 'key', key: 'i', mods: { mod: true } },
        },
      },
    ];
    await renderSettled(
      <Lab instruments={[Staged]} defaultInstrument="Staged" labChrome={labChrome} {...props} />,
    );
    await act(async () => {
      fireEvent.keyDown(window, { key: 'i', ...MOD });
    });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
