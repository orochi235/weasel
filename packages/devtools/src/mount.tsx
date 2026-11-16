/**
 * `@weasel-js/devtools/mount` — devtools for a page's canvases without their cost in a production build: a `devtools`
 * contribution that loads the page side on first attach, the list an app provides in development, the entry that
 * withholds devtools from the canvases below, and the provider a kit shell wraps its canvases in.
 *
 * @packageDocumentation
 */
import { AmbientContributionsProvider, type SurfaceContribution, useProvidedAmbient } from '@weasel-js/core';
import { isDev } from '@weasel-js/registry';
import type { ReactNode } from 'react';

const ID = 'devtools';

/**
 * The `devtools` contribution from `@weasel-js/devtools/hook`, behind a dynamic import: a bundle that never attaches
 * it never loads the hook. The canvas registers once the import resolves.
 */
export const lazyDevtools: SurfaceContribution = {
  id: ID,
  eligibility: { always: true },
  attach(api, deps) {
    let off: (() => void) | null = null;
    let gone = false;
    void import('./hook').then(({ attachDevtools }) => {
      if (!gone) off = attachDevtools(api, deps);
    });
    return () => {
      gone = true;
      off?.();
    };
  },
};

/**
 * An entry with the `devtools` id and no roles. Provided, it replaces a `devtools` entry provided further out, and a
 * shell below it adds none of its own, so no canvas below takes devtools unless its own `ambient` lists it.
 */
export const devtoolsOff: SurfaceContribution = { id: ID, eligibility: { always: true } };

const ON: readonly SurfaceContribution[] = [lazyDevtools];
const OFF: readonly SurfaceContribution[] = [devtoolsOff];
const NONE: readonly SurfaceContribution[] = [];

/**
 * `[lazyDevtools]` in a development build and `[]` in production, by `isDev()` (`process.env.NODE_ENV`). What an app
 * hands `<AmbientContributionsProvider contributions>` above canvases no shell frames.
 */
export const DEV_DEVTOOLS: readonly SurfaceContribution[] = isDev() ? ON : NONE;

/** What a shell provides: its `devtools` prop when given, else nothing over a provided `devtools` entry, else `dev`. */
export function shellDevtools(
  on: boolean | undefined,
  provided: readonly SurfaceContribution[],
  dev: boolean,
): readonly SurfaceContribution[] {
  if (on === true) return ON;
  if (on === false) return OFF;
  if (provided.some((e) => e.id === ID)) return NONE;
  return dev ? ON : NONE;
}

/** Props for {@link ShellDevtools}. */
export interface ShellDevtoolsProps {
  /** The shell's `devtools` prop: `true` mounts devtools in production too, `false` withholds it. */
  devtools?: boolean | undefined;
  children?: ReactNode;
}

/**
 * Gives every canvas below devtools in a development build, the default a kit shell (`<Lab>`, `EditorShell`) wraps
 * its canvases in. A `devtools` entry provided above it, `devtoolsOff` included, decides instead, and its `devtools`
 * prop decides over both.
 */
export function ShellDevtools({ devtools, children }: ShellDevtoolsProps) {
  const own = shellDevtools(devtools, useProvidedAmbient(), isDev());
  return <AmbientContributionsProvider contributions={own}>{children}</AmbientContributionsProvider>;
}
