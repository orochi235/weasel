import { useState } from 'react';
import { DrawCanvas, textCommandFromRuns } from '@weasel-js/core';
import { solid } from '@weasel-js/paint';
import { runsToPlainText, type StyledRun, type TextStyle } from '@weasel-js/text';
import { useTextEdit, type TextEditScreenPose } from '@weasel-js/text-dom';
import { Button } from '@weasel-js/ui/components/Button';
import { DemoStage } from './DemoStage';
import s from './TextDomDemo.module.css';

const W = 520, H = 140;
const ID = 'line';
const STYLE: TextStyle = { fontSize: 28 };
const INK = { fill: { paint: solid('#1a1a1a') } };
const POSE: TextEditScreenPose = { x: 24, y: 48, width: W - 48, height: 40, fontSize: 28 };

const flagsOf = (run: StyledRun) =>
  (['bold', 'italic', 'underline'] as const).filter((f) => run[f]).join(' ');

export function TextDomDemo() {
  const [runs, setRuns] = useState<StyledRun[]>([
    { text: 'Edit ' }, { text: 'this', bold: true }, { text: ' line in place' },
  ]);
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const edit = useTextEdit({
    container: surface,
    getText: () => runsToPlainText(runs),
    getRuns: () => runs,
    getStyle: () => STYLE,
    getPaint: () => INK,
    getScreenPose: () => POSE,
    onChange: (_id, commit) => setRuns(commit.runs ?? [{ text: commit.text }]),
  });
  const editing = edit.isEditing(ID);

  return (
    <div className={s.demo}>
      <div className="ckd-toolbar">
        <Button onClick={() => edit.startEdit(ID)} disabled={editing}>Edit</Button>
      </div>
      <DemoStage width={W} height={H}>
        <div ref={setSurface} className={s.surface} onDoubleClick={() => edit.startEdit(ID)}>
          <DrawCanvas
            className="ckd-canvas"
            background={{ kind: 'solid', color: '#ffffff' }}
            draw={editing ? [] : [textCommandFromRuns(POSE.x, POSE.y, runs, STYLE, undefined, undefined, undefined, INK)]}
          />
        </div>
      </DemoStage>
      <ol className={s.runs} aria-label="runs">
        {runs.map((r, i) => (
          <li key={i}><code>{JSON.stringify(r.text)}</code> <span className={s.flags}>{flagsOf(r)}</span></li>
        ))}
      </ol>
    </div>
  );
}
