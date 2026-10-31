import type { MenuDef } from '@weasel-js/core';
import type { StorageAdapter } from '@weasel-js/storage';
import type { ColorList, Theme } from '@weasel-js/theme';
import type { ReactNode } from 'react';
import type { CameraGestures } from '../canvas/cameraGestures';
import type { LabContribution } from '../chrome/labTypes';
import type { TrialContribution } from '../chrome/types';
import type { ClockCapability } from '../clock/trialClock';
import type { LabOver } from '../config/over';
import type { ConfigRule, ControlRenderer } from '../config/types';
import type { InstrumentList } from '../instrument/types';
import type { LabDensity, LabMode, TrialRecord } from '../state/types';
import type { TrialTool } from '../tools/types';
import type { LabPage } from './LabSwitcher';
import type { LabMenus } from './labMenus';
import type { PresentationSeed } from './openLab';
import type { PresentedTransportOptions } from './presentation';
import type { PresentationMessageOptions } from './presentationMessages';

/** What `<Lab>` takes whether or not it persists: every prop of
 *  {@link LabProps} but `storageKey` and `storage`. */
export interface LabBaseProps {
  /** May change while mounted. An instrument that is a different object from
   *  the last render counts as replaced and its open trials' configs are
   *  refilled, so hoist or memoize the list. */
  instruments: InstrumentList;
  defaultInstrument: string;
  /** The instruments a lab with no trials opens, a trial of each, in order.
   *  Default `[defaultInstrument]`. */
  opening?: readonly string[];
  /** The lab's own clock: one time that every trial whose instrument declares
   *  `clock: 'lab'` plays on, and that `useTrialClock` falls back to outside
   *  any trial. A stored lab keeps where it stands. Read once, at mount. */
  clock?: ClockCapability;
  mode?: LabMode;
  /** How much room the lab's chrome takes. Default `'comfortable'`; a lab whose
   *  window is the whole app, rather than a panel beside one, reads better at
   *  `'roomy'`. The trials' own contents are unaffected. */
  density?: LabDensity;
  /** The theme the lab's chrome resolves against, applied at `mode` and
   *  `density`. Default `interstellarTheme`; extend it rather than replace it to
   *  keep the lab's look while changing a few tokens. */
  theme?: Theme;
  /** Rendered while a stored lab loads. Default: the lab's empty shell. */
  fallback?: ReactNode;
  /**
   * Colors composing the interstellar theme's cosmic backdrop. Each becomes
   * one radial-gradient blob on the dark void base, in a fixed spread of
   * positions; extras wrap around. A theme ramp resolves against the lab's
   * theme; a function list gives as many blobs as there are positions.
   * Ignored unless the resolved mode is dark.
   */
  nebula?: ColorList;
  title?: string;
  /** Set as `document.title` while the lab is mounted. */
  documentTitle?: string;
  /** The project's other labs. Given two or more, the title becomes the way to
   *  reach them — the same switcher `<LabShell>` renders, so a lab reached from
   *  one is not a dead end. */
  pages?: readonly LabPage[];
  /** The path the switcher marks as open. Defaults to the current location. */
  path?: string;
  /** Rendered in the shell's footer, below the workspace. */
  footer?: ReactNode;
  /** Contributions added to every trial's chrome, after the instrument's own. */
  chrome?: readonly TrialContribution[];
  /** Contributions to the lab's own chrome — its header bar, its sidebar, its
   *  tool rail and its footer — rather than to every trial's. Rendered after
   *  `children` and `footer`, which stay the way a lab drops arbitrary content
   *  into those same two boxes. Going from no sidebar contributions to some
   *  remounts the workspace and every trial, dropping unpersisted trial state. */
  labChrome?: readonly LabContribution[];
  /** Built-in contribution ids to drop. Throws on an id that is not there. */
  suppress?: readonly string[];
  /** Whether a double-click on a trial also opens it in its lightbox, beside
   *  the title bar's expand toggle every trial has. Off by default; a
   *  function decides per trial, by its record. */
  expandOnDoubleClick?: boolean | ((trial: TrialRecord) => boolean);
  /** Offer the header's add-trial control. Default `true`; a lab that opens
   *  trials some other way passes `false`. */
  addTrial?: boolean;
  /** Offer the header's zoom controls, which act on the focused trial's camera
   *  and answer Mod+=, Mod+- and Mod+0. Default `true`. */
  zoom?: boolean;
  /** Render the lab's header bar: its title, add-trial and zoom controls,
   *  header contributions and theme switcher. Default `true`; `false` drops
   *  all of them, the zoom keys with the controls, for a lab embedded in a page
   *  that frames it. `children` go in the header, so they go too. */
  header?: boolean;
  /** Menus added to the lab's menu bar, between its built-in Lab and View. A menu keyed `lab`
   *  or `view` adds its rows to that built-in menu instead. Memoize or hoist. */
  menus?: LabMenus;
  /** Draw the lab's menu bar above its header. Default `true`. Dropped with the header
   *  (`header={false}`) and while presenting. */
  menuBar?: boolean;
  /** Whether marks show at first, in a lab with an instrument declaring
   *  `annotations`: its targets' overlays, each trial's Marks section and
   *  export, and the drawing tools in the rail. Default `true`. View → Marks
   *  turns them on and off, and a stored lab keeps that choice over this.
   *  Hidden marks are kept, not dropped. */
  marks?: boolean;
  /** Menus a right-click over a trial's camera opens, picked by each def's `when` (a camera
   *  reports no body, so `when: {}` matches anywhere on it). Rows name commands registered in
   *  the lab. Memoize or hoist. */
  contextMenus?: readonly MenuDef[];
  /** Tools offered lab-wide. A trial whose instrument declares none of its own
   *  reflects and writes this slot. */
  tools?: readonly TrialTool[];
  /** Rules run over every instrument's config leaves, before labkit's own
   *  inference — where a lab states a convention once instead of annotating
   *  each field. Memoize or hoist. */
  configRules?: readonly ConfigRule[];
  /** Control overrides and app-defined kinds for every trial's settings panel.
   *  Keys are config paths (checked first) or leaf kinds. Memoize or hoist. */
  controls?: Record<string, ControlRenderer>;
  /** The values of the schemas instruments' configs are drawn over (`f.schema(nodes, { over })`), and
   *  their writer: the app's, which its own surfaces for that schema read too. Omitted, the lab keeps
   *  them in memory, shared by every trial. */
  over?: LabOver;
  children?: ReactNode;
  /** Start presenting: one trial, opened on `seed`, without the lab's chrome or
   *  its own. `?present` in the page's URL does the same. Read once, at mount.
   *  A stored lab presents from its own records, under `storageKey` +
   *  `':present'`, so an embed never shows or changes the full lab's trials. */
  present?: boolean;
  /** The trial a lab that starts presenting opens on. A store that already
   *  holds a trial opened on this same seed keeps it; a changed seed replaces
   *  it. Ignored unless the lab starts presenting. */
  seed?: PresentationSeed;
  /** Gestures every trial's camera takes, over its instrument's own one by
   *  one — `{ wheel: false, drag: false }` lets the page scroll past an embed. */
  gestures?: CameraGestures;
  /** Play controls over a presented trial whose instrument declares a clock:
   *  hidden in a box too narrow for them, answering Space and friends, and
   *  replaying an ended run after a hold until a visitor touches them.
   *  Default `true`; options say how narrow is too narrow. */
  transport?: boolean | PresentedTransportOptions;
  /** Start presenting as a still, for a poster to be taken of it: every clock
   *  paused — at this many ms, or where it opens for `true` — with no play
   *  controls, nothing read from or written to storage, and `lk-lab--still-ready`
   *  on the lab's root once it has painted. `?still` and `?still=<ms>` in the
   *  page's URL do the same. Read once, at mount. */
  still?: boolean | number;
  /** Whether a presented lab answers its host page's `labkit:play`,
   *  `labkit:pause`, `labkit:seek` and `labkit:query` messages and posts its
   *  `labkit:state` back. Default `true`; options name the lab and say which
   *  origins it takes messages from. */
  messages?: boolean | PresentationMessageOptions;
}

/** Props for `<Lab>`. With a `storageKey` the lab persists — to IndexedDB
 *  unless `storage` names another substrate — and both are read once, at
 *  mount. Without one, nothing persists. */
export type LabProps = LabBaseProps &
  (
    | { storageKey?: undefined; storage?: undefined }
    | { storageKey: string; storage?: StorageAdapter }
  );
