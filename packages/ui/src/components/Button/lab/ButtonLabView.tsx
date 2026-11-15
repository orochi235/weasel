import { useState, type CSSProperties, type ReactElement } from 'react';
import { Button } from '@weasel-js/ui/components/Button';
import { CodeBlock } from '@weasel-js/ui/components/CodeBlock';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { asStyle, buttonVarsOf, exportDeltas, type ButtonLabConfig } from './buttonLabConfig';
import s from './ButtonLab.stories.module.css';

const SEGMENTS = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
  { value: 'three', label: 'Three' },
] as const;

const weight = (variant: ButtonLabConfig['variant']) =>
  variant === 'confirm' ? ({ variant: 'solid', stance: 'confirm' } as const) : ({ variant } as const);

/** What the lab tunes, under the tuned vars. A segmented bar takes no style of its own, so its vars sit on a wrapper. */
function Target({ config, vars, className }: { config: ButtonLabConfig; vars: CSSProperties; className?: string }): ReactElement {
  const [segment, setSegment] = useState<string>('two');
  if (config.target === 'segmented') {
    return (
      <div className={s.wrap} style={vars}>
        <SegmentedBar aria-label="Sample" items={SEGMENTS} value={segment} onChange={(v) => v != null && setSegment(v)} height={config.shape.height} />
      </div>
    );
  }
  return <Button {...weight(config.variant)} className={className} style={vars}>{config.label}</Button>;
}

/** The tuned control magnified on its backdrop, its rest, hover, and disabled states at size, and the rule to paste
 *  into `Button.module.css` for the look as it stands. */
export function ButtonLabView({ config }: { config: ButtonLabConfig }): ReactElement {
  const [deltas, setDeltas] = useState<string | null>(null);
  const vars = asStyle(buttonVarsOf(config));
  const zoom = { '--zoom': String(config.view.zoom) } as CSSProperties;
  const exportNow = () => {
    const text = exportDeltas(config);
    setDeltas(text);
    navigator.clipboard?.writeText(text).catch(() => {});
  };
  return (
    <div className={s.lab}>
      <div className={`${s.stage} ${s[config.view.backdrop]}`}>
        <div className={s.zoom} style={zoom}>
          <Target config={config} vars={vars} />
        </div>
      </div>
      <div className={s.states}>
        <Target config={config} vars={vars} />
        {config.target === 'button' && (
          <>
            <Target config={config} vars={vars} className={s.hovered} />
            <Button {...weight(config.variant)} disabled style={vars}>{config.label}</Button>
          </>
        )}
      </div>
      <div>
        <Button variant="ghost" size="sm" onClick={exportNow}>Export deltas</Button>
      </div>
      {deltas !== null && <CodeBlock code={deltas} language="css" />}
    </div>
  );
}
