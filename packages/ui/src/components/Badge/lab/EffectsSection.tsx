import { useMemo, type PointerEvent } from 'react';
import { CloseButton } from '../../CloseButton';
import { DragGrip } from '../../DragGrip';
import { useReorderDragList } from '../../../useReorderDragList';
import { EFFECTS, type BadgeEffect } from '../effects';
import { EFFECT_KEYS, EFFECT_LAB_CONTROLS } from './controls';
import { ParamControl } from './ParamControl';
import type { LabEffect } from './snapshot';
import { moveEffectToGap, removeEffect, setEffectParam, setEffectType } from './transitions';
import s from './ComposeLab.stories.module.css';

type Update = (update: (effects: LabEffect[]) => LabEffect[]) => void;

/** Where an effect acts: on the outline itself, or as decoration in one of the paint zones. */
const zoneOf = (type: BadgeEffect): string => (EFFECTS[type].offsetAt ? 'offset' : (EFFECTS[type].zone ?? 'foreground'));

function EffectCard({ effect, index, dragging, dropAbove, dropBelow, onGripDown, onEffects }: {
  effect: LabEffect;
  index: number;
  dragging: boolean;
  dropAbove: boolean;
  dropBelow: boolean;
  onGripDown: (e: PointerEvent) => void;
  onEffects: Update;
}) {
  return (
    <div
      className={s.card}
      data-dragging={dragging || undefined}
      data-drop-above={dropAbove || undefined}
      data-drop-below={dropBelow || undefined}
    >
      <div className={s.grip} onPointerDown={onGripDown} title="Drag to reorder">
        <DragGrip />
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
  const items = useMemo(() => effects.map((e) => ({ id: String(e.id), label: e.type })), [effects]);
  const reorder = useReorderDragList({
    items,
    selectedIds: [],
    onReorder: (ids, gap) => onEffects((list) => moveEffectToGap(list, Number(ids[0]), gap)),
  });
  const { draggedIds, targetIndex } = reorder.state;
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
      <div className={s.cards} {...reorder.containerProps}>
        {effects.map((effect, i) => (
          <EffectCard
            key={effect.id}
            effect={effect}
            index={i}
            dragging={draggedIds?.includes(String(effect.id)) ?? false}
            dropAbove={targetIndex === i}
            dropBelow={targetIndex === effects.length && i === effects.length - 1}
            onGripDown={reorder.rowProps(String(effect.id), i).onPointerDown}
            onEffects={onEffects}
          />
        ))}
      </div>
    </section>
  );
}
