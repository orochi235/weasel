import { useState } from 'react';
import { analyze, mirror, reorder, type BidiDirection } from '@weasel-js/bidi';
import { Input, ToggleBar } from '@weasel-js/ui';
import s from './BidiDemo.module.css';

const PRESETS = [
  { label: 'Hebrew in English', text: 'The title is "שלום עולם" (hello world).' },
  { label: 'English in Hebrew', text: 'עברית (with English) and 123-456.' },
  { label: 'Arabic with a number', text: 'السعر 1,250.50 دولار [تقريبا]' },
  { label: 'Nested brackets', text: 'He said "אני אוהב C++ (מאוד)" today.' },
];

const DIRECTIONS: { value: BidiDirection; label: string }[] = [
  { value: 'auto', label: 'auto' },
  { value: 'ltr', label: 'ltr' },
  { value: 'rtl', label: 'rtl' },
];

const shown = (cp: number) => (cp === 0x20 ? '␣' : String.fromCodePoint(cp));

export function BidiDemo() {
  const [text, setText] = useState(PRESETS[0]!.text);
  const [direction, setDirection] = useState<BidiDirection>('auto');

  const cps = Array.from(text, (c) => c.codePointAt(0)!);
  const analysis = analyze(cps, direction);
  const line = reorder(analysis, 0, cps.length);
  const painted = line.order.map((i) => {
    const m = line.levels[i] % 2 === 1 ? mirror(cps[i]) : null;
    return { i, cp: m ?? cps[i], mirrored: m !== null };
  });

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <Input value={text} onChange={setText} aria-label="Text" className={s.entry} />
        <ToggleBar
          items={DIRECTIONS}
          value={direction}
          onChange={(v) => v && setDirection(v)}
          ariaLabel="Paragraph direction"
          size="sm"
        />
      </div>
      <div className={s.controls}>
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="ckd-btn" onClick={() => setText(p.text)}>
            {p.label}
          </button>
        ))}
      </div>

      <h3 className={s.heading}>
        Logical order — paragraph level {analysis.paragraphLevel}
      </h3>
      <div className={s.cells}>
        {cps.map((cp, i) => (
          <div key={i} className={`${s.cell} ${analysis.removed[i] ? s.removed : analysis.levels[i] % 2 ? s.odd : s.even}`}>
            <span className={s.glyph}>{shown(cp)}</span>
            <span className={s.meta}>{analysis.original[i]}</span>
            <span className={s.meta}>{analysis.removed[i] ? '×' : analysis.levels[i]}</span>
          </div>
        ))}
      </div>

      <h3 className={s.heading}>Visual order, left to right — outlined characters are mirrored</h3>
      <div className={s.cells}>
        {painted.map(({ i, cp, mirrored }) => (
          <div key={i} className={`${s.cell} ${line.levels[i] % 2 ? s.odd : s.even} ${mirrored ? s.mirrored : ''}`}>
            <span className={s.glyph}>{shown(cp)}</span>
            <span className={s.meta}>#{i}</span>
            <span className={s.meta}>{line.levels[i]}</span>
          </div>
        ))}
      </div>

      <h3 className={s.heading}>Against the browser</h3>
      <dl className={s.compare}>
        <dt>browser</dt>
        <dd dir={direction}>{text}</dd>
        <dt>bidi</dt>
        <dd className={s.forced}>{String.fromCodePoint(...painted.map((p) => p.cp))}</dd>
      </dl>
    </div>
  );
}
