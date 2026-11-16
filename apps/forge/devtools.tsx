/**
 * DEV-only: a `Devtools` global and the frame decorator it drives, which puts
 * the devtools panel beside the story. Production builds declare neither, and
 * never load the panel.
 */
import { lazy, Suspense } from 'react';
import type { Decorator, GlobalDeclarations } from '@weasel-js/forge';
import s from './devtools.module.css';

const DevtoolsDock = import.meta.env.DEV ? lazy(() => import('./DevtoolsDock')) : null;

export const DEVTOOLS_GLOBALS: GlobalDeclarations = import.meta.env.DEV
  ? {
    devtools: {
      label: 'Devtools',
      default: 'off',
      options: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }],
    },
  }
  : {};

/** The story, and the devtools panel beside it while the `devtools` global is on. The frame registers the story's
 *  canvases with the hook itself (`FrameSetup.devtools`). Off, the wrapper takes no box of its own. */
export const devtoolsDock: Decorator = (story, ctx) => {
  if (!DevtoolsDock) return story();
  const on = ctx.globals.devtools === 'on';
  return (
    <div className={on ? s.docked : s.bare}>
      {story()}
      {on && <Suspense fallback={null}><DevtoolsDock /></Suspense>}
    </div>
  );
};
