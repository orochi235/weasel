import { useContext, useEffect, useMemo } from 'react';
import {
  ActionsProvider,
  ActiveToolContextProvider,
  DepRegistryProvider,
  useActionsRegistry,
  useGestureDispatcher,
  useLatest,
  type Action,
  type ActionsRegistry,
  type Tool,
} from '@weasel-js/core';
import { accessLetter } from '@weasel-js/menu';
import { MenuBarHandleContext, type MenuAccessChord, type MenuBarHandle } from './menuBarHandle';

/** A title the key layer can open: its key and its declared access letter. */
export interface AccessTitle {
  key: string;
  access: string;
}

const INITIAL = [{ channel: '*', phase: 'initial' }] as const;
const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;
const NO_ELEMENT = { current: null };

/** The physical key a letter or digit sits on, so a chord whose modifier changes the character typed still matches. */
function codeOf(letter: string): string | undefined {
  if (/^[a-z]$/i.test(letter)) return `Key${letter.toUpperCase()}`;
  if (/^[0-9]$/.test(letter)) return `Digit${letter}`;
  return undefined;
}

/** `menu.open`'s bindings: one per declared letter, the first title declaring a letter taking it. */
function openBindings(titles: readonly AccessTitle[], chord: MenuAccessChord): Action['defaultBinding'] {
  const seen = new Set<string>();
  return titles.flatMap(({ key, access }) => {
    const letter = accessLetter(access);
    if (!letter) return [];
    if (seen.has(letter)) return [];
    seen.add(letter);
    const code = codeOf(letter);
    return [{
      spec: { kind: 'key' as const, key: letter, ...(code ? { code } : {}), mods: { ...chord }, phase: [...INITIAL] },
      opts: { id: `menu.open.${letter}`, params: { menu: key } },
    }];
  });
}

/**
 * The menu bar's keys: F10 focuses it, and its chord with a title's access letter opens that title's menu. They
 * run on a dispatcher of their own in a registry of their own, listening ahead of every other, so an app binding on
 * the same keys does not fire as well and none of the app's bindings is heard twice.
 */
export function MenuBarKeys({ titles, disabled, chord }: {
  titles: readonly { key: string; access?: string }[];
  disabled: ReadonlySet<string>;
  chord: MenuAccessChord;
}) {
  const bar = useContext(MenuBarHandleContext);
  // A disabled title's letter is left unbound, so the keys reach whatever else holds them.
  const open = titles.filter((t): t is AccessTitle => t.access !== undefined && !disabled.has(t.key));
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          {bar && <KeyLayer titles={open} chord={chord} bar={bar} />}
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function KeyLayer({ titles, chord, bar }: { titles: readonly AccessTitle[]; chord: MenuAccessChord; bar: MenuBarHandle }) {
  useMenuBarKeys(titles, chord, bar);
  return null;
}

/** Registers `menu.bar` and `menu.open` in the registry in scope, and listens for their keys. */
export function useMenuBarKeys(titles: readonly AccessTitle[], chord: MenuAccessChord, bar: MenuBarHandle): void {
  const registry = useActionsRegistry() as ActionsRegistry;
  const barNow = useLatest(bar);
  const shape = JSON.stringify([titles.map((t) => [t.key, t.access]), chord]);

  const actions = useMemo((): Action[] => {
    const [pairs, mods] = JSON.parse(shape) as [[string, string][], MenuAccessChord];
    return [
      {
        id: 'menu.bar',
        label: 'Focus Menu Bar',
        defaultBinding: [{ spec: { kind: 'key', key: 'F10', phase: [...INITIAL] }, opts: { id: 'menu.bar.key' } }],
        invoker: { timing: 'immediate', run: () => { barNow.current.focus(); } },
      },
      {
        id: 'menu.open',
        label: 'Open Menu',
        scope: 'hotkey',
        defaultBinding: openBindings(pairs.map(([key, access]) => ({ key, access })), mods),
        invoker: {
          timing: 'immediate',
          run: (_deps, params) => {
            if (typeof params?.menu === 'string') barNow.current.open(params.menu);
          },
        },
      },
    ];
  }, [shape, barNow]);

  useEffect(() => {
    const releases = actions.map((a) => registry.register(a));
    return () => { for (const release of releases) release(); };
  }, [registry, actions]);

  useGestureDispatcher({
    canvasRef: NO_ELEMENT,
    actions: registry,
    entriesById: NO_TOOLS,
    channels: CHANNELS,
    keyboard: 'first',
  });
}
