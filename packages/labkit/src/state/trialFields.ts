import { getOwn } from '@weasel-js/registry';
import type { ColorModePreference } from '@weasel-js/theme';
import type { TrialRecord } from './types';

/** The trials with trial `id` passed through `edit`. An edit returning its record unchanged keeps the list's
 *  identity, so a write that changes nothing wakes no subscriber. */
function editTrial(
  trials: TrialRecord[],
  id: string,
  edit: (w: TrialRecord) => TrialRecord,
): TrialRecord[] {
  let changed = false;
  const next = trials.map((w) => {
    if (w.id !== id) return w;
    const out = edit(w);
    if (out !== w) changed = true;
    return out;
  });
  return changed ? next : trials;
}

export const withSidebarWidth = (trials: TrialRecord[], id: string, width: number) =>
  editTrial(trials, id, (w) => (w.sidebarWidth === width ? w : { ...w, sidebarWidth: width }));

/** `null` returns the title to the instrument's name. */
export const withTitle = (trials: TrialRecord[], id: string, title: string | null) =>
  editTrial(trials, id, (w) => {
    const next = title === null ? undefined : title;
    return (w.title ?? undefined) === next ? w : { ...w, title: next };
  });

export const withSectionCollapsed = (
  trials: TrialRecord[],
  id: string,
  key: string,
  collapsed: boolean,
) =>
  editTrial(trials, id, (w) =>
    w.collapsedSections && getOwn(w.collapsedSections, key) === collapsed
      ? w
      : { ...w, collapsedSections: { ...w.collapsedSections, [key]: collapsed } },
  );

/** `'auto'` is stored as no field, so the record of a trial following the lab is the one it opened with. */
export const withColorMode = (trials: TrialRecord[], id: string, mode: ColorModePreference) =>
  editTrial(trials, id, (w) => {
    const next = mode === 'auto' ? undefined : mode;
    if (w.colorMode === next) return w;
    const { colorMode: _was, ...rest } = w;
    return next === undefined ? rest : { ...rest, colorMode: next };
  });
