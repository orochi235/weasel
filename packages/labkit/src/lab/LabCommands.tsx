import { ActionDisabledReason, useCommand } from '@weasel-js/core';
import { MARKS_COMMAND, takesMarks } from '../annotations/labMarks';
import { type LabContribution, type LabHeaderItem, useLabChromeContext } from '../chrome';
import type { LabMode } from '../state/types';
import { useLabContext } from './LabContext';
import { MODES } from './labModes';

/**
 * Registers the lab header's commands on the lab's actions registry: add a
 * trial per instrument, the color modes, the Marks switch in a lab whose
 * instruments take marks, and each header item contribution.
 * The header's buttons stay as they are; these are the same operations by id.
 */
export function LabCommands({
  contributions,
  addTrial,
}: {
  contributions: readonly LabContribution[];
  addTrial: boolean;
}) {
  const lab = useLabContext();
  const only = lab.instruments.length === 1;
  return (
    <>
      {addTrial
        ? lab.instruments.map((i) => (
            <AddTrialCommand
              key={i.name}
              name={i.name}
              label={only ? 'Add trial' : (i.title ?? i.name)}
            />
          ))
        : null}
      {MODES.map((m) => (
        <ModeCommand key={m.mode} {...m} />
      ))}
      {takesMarks(lab.instruments) ? <MarksCommand /> : null}
      {contributions.map((c) =>
        c.region === 'header' && c.item ? (
          <HeaderItemCommand key={c.id} id={c.id} item={c.item} />
        ) : null,
      )}
    </>
  );
}

function AddTrialCommand({ name, label }: { name: string; label: string }) {
  const lab = useLabContext();
  useCommand(`lab.add.${name}`, label, () => lab.addTrial(name));
  return null;
}

function ModeCommand({ mode, label }: { mode: LabMode; label: string }) {
  const lab = useLabContext();
  useCommand(`lab.mode.${mode}`, label, () => lab.setMode(mode), {
    active: () => lab.mode === mode,
  });
  return null;
}

function MarksCommand() {
  const lab = useLabContext();
  useCommand(MARKS_COMMAND, 'Marks', () => lab.setMarks(!lab.marks), { active: () => lab.marks });
  return null;
}

function HeaderItemCommand({ id, item }: { id: string; item: LabHeaderItem }) {
  const ctx = useLabChromeContext();
  useCommand(`lab.item.${id}`, item.label, () => item.onActivate(ctx), {
    enabled: () => (item.disabled ? ActionDisabledReason.NotApplicable : true),
    ...(item.pressed === undefined ? {} : { active: () => item.pressed === true }),
    ...(item.keys === undefined ? {} : { keys: item.keys }),
  });
  return null;
}
