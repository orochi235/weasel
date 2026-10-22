import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { Along } from '@weasel-js/ui/components/Along';
import { Bar } from '@weasel-js/ui/components/Bar';
import { Button } from '@weasel-js/ui/components/Button';
import { Slider, type Thumb } from '@weasel-js/ui/components/Slider';
import { actionsSchema, LabActions } from './labActions';
import { describe, tabOrder, useEventLog, type LogGroup } from './useEventLog';
import lab from './lab.stories.module.css';
import s from './InputTrace.stories.module.css';

/** The knobs the lab reads. */
export interface InputTraceConfig {
  actions: number;
  overflow: 'scroll' | 'menu';
  slider: boolean;
  log: { pointer: boolean; moves: boolean; wheel: boolean; focus: boolean; keys: boolean };
}

const STOPS = [0, 25, 50, 75, 100].map((v) => ({ value: v, label: String(v) }));

/** The Tab order inside `root` as names, and which of them has focus, read again whenever the log moves. */
function useTabOrder(root: React.RefObject<HTMLElement | null>, tick: unknown): { names: string[]; focused: number } {
  const [order, setOrder] = useState<{ names: string[]; focused: number }>({ names: [], focused: -1 });
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const update = (): void => {
      const els = tabOrder(el);
      const next = { names: els.map(describe), focused: els.indexOf(document.activeElement as HTMLElement) };
      setOrder((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    update();
  }, [root, tick]);
  return order;
}

/**
 * A curved bar and slider between two plain buttons, with every pointer, wheel, focus and key event that reaches any
 * of them logged on its way down — what it landed on, and whether a control claimed it — beside the order Tab
 * steps through them in.
 */
export function InputTraceView({ config }: { config: InputTraceConfig }): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const groups = (Object.keys(config.log) as LogGroup[]).filter((g) => config.log[g]);
  const { log, clear } = useEventLog(root, groups);
  const order = useTabOrder(root, log);
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 25 }]);

  return (
    <LabActions>
      <div className={lab.lab}>
        <div className={`${lab.stack} ${lab.main}`}>
          <div ref={root} className={s.stage} data-trace-stage>
            <Button size="sm">Before</Button>
            <div className={s.dial}>
              <Along arc={{ start: 300, end: 60, inset: 18 }}>
                <Bar label="Lens" schema={actionsSchema(config.actions, 'Lens')} overflow={config.overflow} />
              </Along>
              {config.slider && (
                <Along arc={{ start: 240, end: 120, direction: 'ccw', inset: 16 }}>
                  <Slider ariaLabel="Zoom" min={0} max={100} step={1} stops={STOPS} thumbs={thumbs} onInput={setThumbs} />
                </Along>
              )}
            </div>
            <Button size="sm">After</Button>
          </div>
          <section className={lab.section} aria-label="Tab order">
            <h3 className={lab.sectionTitle}>Tab order</h3>
            <ol className={s.order}>
              {order.names.map((name, i) => (
                <li key={i} data-tab-stop={i} data-focused={i === order.focused ? '' : undefined}>{name}</li>
              ))}
            </ol>
          </section>
        </div>
        <div className={`${lab.stack} ${lab.side}`}>
          <section className={lab.section} aria-label="Event log">
            <h3 className={lab.sectionTitle}>Events, newest first</h3>
            <Button size="sm" onClick={clear}>Clear</Button>
            <ol className={s.log} data-event-log>
              {log.map((l) => (
                <li key={l.id} data-event={l.type} data-claimed={l.claimed ? '' : undefined}>
                  <span className={s.at}>{String(l.at).padStart(6, ' ')}</span>
                  <span className={s.type}>{l.type}{l.count > 1 ? ` ×${l.count}` : ''}</span>
                  <span className={s.target}>{l.target}</span>
                  <span className={s.detail}>{l.detail}{l.claimed ? ' · claimed' : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </LabActions>
  );
}
