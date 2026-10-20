/** The field a group's title is renamed in, held over the title on the canvas. */
import { adoptCssOnce, useLatest } from '@weasel-js/react';
import { useMemo, useState, type ReactElement } from 'react';
import { titleIdOf } from '../containers/trait';
import { groupLabelIdOf } from '../dataGroups';
import type { DiagramOverlay } from '../overlays';
import type { EditorLook } from './editorMapping';
import { renameGroup } from './groupEdit';
import type { EffectDoc } from './types';

const FIELD_RULE = ':where([data-wzl-group-title]) { width: 16ch; font: inherit; font-weight: 700; text-align: center; }';

const TOP = { side: 'top', align: 'center' } as const;

const adoptFieldRule = (el: HTMLInputElement | null) => {
  if (el === null) return;
  adoptCssOnce(el, FIELD_RULE);
  el.focus();
  el.select();
};

/**
 * The overlay renaming group `renaming`, held over its title, or over the top
 * of its box where it has none, or `null` for none. A new name is reported as
 * 'Rename group'; Escape, or the name it had, reports nothing.
 */
export function useGroupTitle(
  doc: EffectDoc,
  look: EditorLook,
  renaming: string | null,
  setRenaming: (id: string | null) => void,
  onChange: (next: EffectDoc, label: string) => void,
): readonly DiagramOverlay[] | null {
  const latest = useLatest({ doc, onChange });
  const group = renaming === null ? undefined : doc.pipeline.groups?.find((g) => g.id === renaming);
  const id = group?.id;
  const was = group?.label ?? '';
  const over = id === undefined ? undefined : look === 'nodeGraph' ? titleIdOf(id) : was ? groupLabelIdOf(id) : id;
  return useMemo(() => {
    if (id === undefined || over === undefined) return null;
    const done = (text: string | null) => {
      setRenaming(null);
      if (text !== null && text !== was) latest.current.onChange(renameGroup(latest.current.doc, id, text), 'Rename group');
    };
    const placement = over === id ? TOP : 'center';
    return [{ target: over, placement, content: <GroupTitleField key={id} initial={was} onDone={done} /> }];
  }, [id, was, over, setRenaming, latest]);
}

/** A text field holding `initial`: Enter or leaving it hands `onDone` the text, Escape hands it `null`. */
export function GroupTitleField({ initial, onDone }: { initial: string; onDone: (text: string | null) => void }): ReactElement {
  const [text, setText] = useState(initial);
  const [done, setDone] = useState(false);
  const finish = (value: string | null) => {
    if (done) return;
    setDone(true);
    onDone(value);
  };
  return (
    <input
      ref={adoptFieldRule}
      data-wzl-group-title=""
      aria-label="Group name"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(text.trim());
        else if (e.key === 'Escape') finish(null);
      }}
      onBlur={() => finish(text.trim())}
    />
  );
}
