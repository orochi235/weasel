import { useState, type DragEvent } from 'react';
import { CloseButton } from '../../CloseButton';
import { EFFECTS, type BadgeEffect } from '../effects';
import { EFFECT_KEYS, EFFECT_LAB_CONTROLS } from './controls';
import { ParamControl } from './ParamControl';
import type { LabEffect } from './snapshot';
import { moveEffectToGap, removeEffect, setEffectParam, setEffectType } from './transitions';
import s from './ComposeLab.stories.module.css';

type Update = (update: (effects: LabEffect[]) => LabEffect[]) => void;

/** Where an effect acts: on the outline itself, or as decoration in one of the paint zones. */
const zoneOf = (type: BadgeEffect): string => (EFFECTS[type].offsetAt ? 'offset' : (EFFECTS[type].zone ?? 'foreground'));

function EffectCard({ effect, index, dragging, dropAbove, dropBelow, onDragStart, onDragEnd, onDragOver, onDrop, onEffects }: {
  effect: LabEffect;
  index: number;
  dragging: boolean;
  dropAbove: boolean;
  dropBelow: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onEffects: Update;
}) {
  return (
    <div
      className={s.card}
      data-dragging={dragging || undefined}
      data-drop-above={dropAbove || undefined}
      data-drop-below={dropBelow || undefined}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={s.grip}
        draggable
        onDragStart={(e) => {
          onDragStart();
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >
        ⋮⋮
      </div>
      <div className={s.cardBody}>
        <div className={s.cardHead}>
          <code className={s.ordinal}>{index + 1}.</code>
          <select
            className={s.typeSelect}
            value={effect.type}
            onChange={(e) => onEffects((list) => setEffectType(list, effect.id, e.target.value as BadgeEffect))}
          >
            {EFFECT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <code className={s.zone}>{zoneOf(effect.type)}</code>
          <CloseButton ariaLabel={`Remove effect ${index + 1}`} onClick={() => onEffects((list) => removeEffect(list, effect.id))} />
        </div>
        {EFFECT_LAB_CONTROLS[effect.type].map((c) => (
          <ParamControl
            key={c.key}
            control={c}
            value={effect.params[c.key]}
            onChange={(v) => onEffects((list) => setEffectParam(list, effect.id, c.key, v))}
          />
        ))}
      </div>
    </div>
  );
}

/** The ordered effect list: add one, edit each one's params, drag a card by its grip to reorder. */
export function EffectsSection({ effects, onAdd, onEffects }: {
  effects: LabEffect[];
  onAdd: (type: BadgeEffect) => void;
  onEffects: Update;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropGap, setDropGap] = useState<number | null>(null);
  const endDrag = () => {
    setDragId(null);
    setDropGap(null);
  };
  return (
    <section className={s.effects}>
      <div className={s.effectsHead}>
        <h3 className={s.effectsTitle}>Effects ({effects.length})</h3>
        <div className={s.add}>
          <select
            className={s.addSelect}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              onAdd(e.target.value as BadgeEffect);
              e.target.value = '';
            }}
          >
            <option value="">+ add effect…</option>
            {EFFECT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>
      {effects.length === 0 && <p className={s.empty}>No effects. Add one from the dropdown.</p>}
      {effects.map((effect, i) => (
        <EffectCard
          key={effect.id}
          effect={effect}
          index={i}
          dragging={dragId === effect.id}
          dropAbove={dropGap === i}
          dropBelow={dropGap === i + 1}
          onDragStart={() => setDragId(effect.id)}
          onDragEnd={endDrag}
          onDragOver={(e) => {
            if (dragId == null || dragId === effect.id) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            setDropGap(e.clientY - rect.top < rect.height / 2 ? i : i + 1);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId != null && dropGap != null) onEffects((list) => moveEffectToGap(list, dragId, dropGap));
            endDrag();
          }}
          onEffects={onEffects}
        />
      ))}
    </section>
  );
}
