import { useMemo, useState } from 'react';
import { type BadgeEffect } from '@weasel-js/ui/components/Badge';
import { EffectList, type EffectListItem } from '@weasel-js/ui/components/EffectList';
import { EFFECT_KEYS, EFFECT_LAB_CONTROLS } from './controls';
import { EFFECT_KINDS, zoneOf } from './effectKinds';
import { Field, ParamControl } from './ParamControl';
import type { LabEffect } from './snapshot';
import { setEffectParam, setEffectType } from './transitions';
import controls from './controls.stories.module.css';
import s from './ComposeLab.stories.module.css';

type Update = (update: (effects: LabEffect[]) => LabEffect[]) => void;

/** A lab effect as the effect list draws it: its id as a string, and its zone as its kind. */
interface Card extends EffectListItem {
  effect: LabEffect;
}

const cardOf = (effect: LabEffect): Card => ({
  id: String(effect.id), kind: zoneOf(effect.type), name: effect.name, on: effect.on, effect,
});

const effectOf = (card: Card): LabEffect => ({ ...card.effect, id: Number(card.id), name: card.name, on: card.on });

/** The open card's settings: its type, then that type's params. */
function EffectBody({ effect, onEffects }: { effect: LabEffect; onEffects: Update }) {
  return (
    <>
      <Field label="type" columns={controls.wide3}>
        <select
          className={controls.select}
          value={effect.type}
          onChange={(e) => onEffects((list) => setEffectType(list, effect.id, e.target.value as BadgeEffect))}
        >
          {EFFECT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <span />
      </Field>
      {EFFECT_LAB_CONTROLS[effect.type].map((c) => (
        <ParamControl
          key={c.key}
          control={c}
          value={effect.params[c.key]}
          onChange={(v) => onEffects((list) => setEffectParam(list, effect.id, c.key, v))}
        />
      ))}
    </>
  );
}

/**
 * The ordered effect list: add one, open a card by its number to edit it, drag a card by its number to
 * reorder, and switch, rename, duplicate, or remove each one.
 */
export function EffectsSection({ effects, nextId, onAdd, onEffects, onList }: {
  effects: LabEffect[];
  /** The id the next new effect takes. */
  nextId: number;
  onAdd: (type: BadgeEffect) => void;
  onEffects: Update;
  /** The whole list after a move, a switch, a rename, a duplicate, or a removal. */
  onList: (effects: LabEffect[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const cards = useMemo(() => effects.map(cardOf), [effects]);
  return (
    <section className={s.effects}>
      <div className={s.effectsHead}>
        <h3 className={s.effectsTitle}>Effects ({effects.length})</h3>
        <div className={s.add}>
          <select
            aria-label="Add effect"
            className={s.addSelect}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              onAdd(e.target.value as BadgeEffect);
              setSelected(String(nextId));
              e.target.value = '';
            }}
          >
            <option value="">+ add effect…</option>
            {EFFECT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>
      {effects.length === 0 && <p className={s.empty}>No effects. Add one from the dropdown.</p>}
      <EffectList<Card>
        aria-label="Effects"
        items={cards}
        kinds={EFFECT_KINDS}
        onChange={(next) => onList(next.map(effectOf))}
        selected={selected}
        onSelect={setSelected}
        onDuplicate={(card) => ({ ...card, id: String(nextId), name: `${card.name} copy` })}
        renderBody={(card) => <EffectBody effect={card.effect} onEffects={onEffects} />}
      />
    </section>
  );
}
