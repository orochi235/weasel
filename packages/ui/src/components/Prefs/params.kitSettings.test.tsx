import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { asNodeId } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import { SelectionPanel } from '../SelectionPanel/SelectionPanel';
import { makeScene, properties, routing, selectionOf, type Data } from '../SelectionPanel/testing/rectScene';
import { PARAMS_SETTLES, PARAMS_TEXT_WAIT_MS } from './commitPolicy';
import { PrefControl } from './PrefControl';
import { PrefsForm } from './PrefsForm';
import { useParamsPolicy } from './useParamsPolicy';

afterEach(cleanup);

const under = (settings: KitSettingsOverrides | undefined, node: ReactNode) =>
  settings === undefined ? node : <KitSettingsProvider value={settings}>{node}</KitSettingsProvider>;

const schema = pref.group('Doc', { title: pref.string('Title', '') });

describe('useParamsPolicy', () => {
  it('answers the constants with no provider, and a provider leaf over each', () => {
    const read = (settings?: KitSettingsOverrides) =>
      renderHook(() => useParamsPolicy('lab'), { wrapper: ({ children }) => under(settings, children) }).result.current;
    expect(read()).toEqual({ textWaitMs: PARAMS_TEXT_WAIT_MS.lab, settles: PARAMS_SETTLES.lab });
    expect(read({ params: { lab: { textWaitMs: 400, settles: { slider: true } } } })).toEqual({
      textWaitMs: 400,
      settles: { ...PARAMS_SETTLES.lab, slider: true },
    });
  });
});

describe('params.form.settles', () => {
  // A form writes text as it is typed; told to settle it, it writes on blur.
  const typed = (settings: KitSettingsOverrides | undefined) => {
    const onChange = vi.fn();
    render(under(settings, <PrefsForm schema={schema} values={{}} onChange={onChange} />));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Hi' } });
    return onChange.mock.calls.length;
  };

  it('writes text as typed with no provider, and only once settled under one', () => {
    expect(typed(undefined)).toBe(1);
    cleanup();
    expect(typed({ params: { form: { settles: { string: true } } } })).toBe(0);
  });

  it("reaches PrefControl's leaf too", () => {
    const onChange = vi.fn();
    render(under({ params: { form: { settles: { string: true } } } }, (
      <PrefControl pref={{ ...schema.children.title, name: 'Title' }} value="" onChange={onChange} />
    )));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hi' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('params.panel.settles', () => {
  // A panel settles text; told not to, it writes each change.
  const labelAfterTyping = (settings: KitSettingsOverrides | undefined) => {
    const scene = makeScene();
    render(under(settings, <SelectionPanel scene={scene} selection={selectionOf(['a'])} properties={properties} routing={routing} />));
    const label = screen.getByLabelText('Label');
    act(() => label.focus());
    fireEvent.change(label, { target: { value: 'world' } });
    return (scene.get(asNodeId('a')) as { data: Data }).data.label;
  };

  it('settles text with no provider, and writes it as typed under one', () => {
    expect(labelAfterTyping(undefined)).toBe('hello');
    cleanup();
    expect(labelAfterTyping({ params: { panel: { settles: { string: false } } } })).toBe('world');
  });
});
