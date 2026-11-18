import type { ReactElement, ReactNode } from 'react';
import type { SampledTrack, Track } from '@weasel-js/animator';
import s from './Timeline.module.css';
import { EasingPicker } from '../EasingPicker/EasingPicker';
import { trackAtPath } from './lanes';
import { setKeyEasing, setKeyValue, type KeySelection } from './keys';
import type { KeyEditorCtx } from './Timeline';

/** The key a selection names, with its track, when that track holds keys. */
function sampledKeyAt(tracks: readonly Track[], sel: KeySelection | null) {
  const track = sel ? trackAtPath(tracks, sel.trackPath) : undefined;
  if (track?.kind !== 'sampled') return undefined;
  const key = (track as SampledTrack<unknown>).keys[sel!.keyIndex];
  return key ? { key, track: track as SampledTrack<unknown> } : undefined;
}

/**
 * The panel under the lanes: an easing picker for a selected segment, or else the consumer's editor for a selected
 * key. Edits are refused unless `edits`.
 */
export function TimelineInspector({ tracks, selection, segmentSelection, renderKeyEditor, edits, onChange }: {
  tracks: readonly Track[];
  selection: KeySelection | null;
  segmentSelection: KeySelection | null;
  renderKeyEditor?: (ctx: KeyEditorCtx) => ReactNode;
  edits: boolean;
  onChange: (next: Track[]) => void;
}): ReactElement | null {
  if (segmentSelection) {
    const segment = sampledKeyAt(tracks, segmentSelection);
    if (!segment) return null;
    return (
      <div className={s.inspector}>
        <EasingPicker
          value={segment.key.easing}
          onChange={(next) => { if (edits) onChange(setKeyEasing(tracks, segmentSelection, next)); }}
        />
      </div>
    );
  }
  const selected = sampledKeyAt(tracks, selection);
  if (!renderKeyEditor || !selection || !selected) return null;
  return (
    <div className={s.inspector}>
      {renderKeyEditor({
        key: selected.key,
        track: selected.track,
        selection,
        commit: (next) => { if (edits) onChange(setKeyValue(tracks, selection, next.value)); },
        setEasing: (easing) => { if (edits) onChange(setKeyEasing(tracks, selection, easing)); },
      })}
    </div>
  );
}
