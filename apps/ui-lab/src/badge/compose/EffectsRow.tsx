import { type LeafRenderer, ControlPanel, f, type ResolvedConfig, resolveConfigSchema } from '@weasel-js/labkit';
import { BADGE_EFFECTS, type BadgeEffect, badgeEffectZone } from '@weasel-js/ui/components/Badge';
import { EffectList, type EffectListItem } from '@weasel-js/ui/components/EffectList';
import { Select } from '@weasel-js/ui/components/Select';
import { useMemo, useState } from 'react';
import { EFFECT_PARAMS } from '../effectParams';
import {
  addEffect, EFFECT_KINDS, effectLabel, type LabEffect, nextEffectId, setEffectParam, setEffectType,
} from '../effects';
import s from './Compose.module.css';

type RowContext = Parameters<LeafRenderer>[0];

/** A lab effect as the effect list draws it: its id as a string, and its zone as its kind. */
interface Card extends EffectListItem {
  effect: LabEffect;
}

const cardOf = (effect: LabEffect): Card => ({
  id: String(effect.id), kind: badgeEffectZone(effect.type), name: effect.name, on: effect.on, effect,
});

const effectOf = (card: Card): LabEffect => ({ ...card.effect, id: Number(card.id), name: card.name, on: card.on });

const TYPE_OPTIONS = BADGE_EFFECTS.map((value) => ({ value, label: effectLabel(value) }));

const schemas = new Map<BadgeEffect, ResolvedConfig>();

/** An open card's settings: the effect's type, then its params. */
function effectSchema(type: BadgeEffect): ResolvedConfig {
  let schema = schemas.get(type);
  if (!schema) {
    schema = resolveConfigSchema(f.schema({ type: f.enum(type, BADGE_EFFECTS), ...EFFECT_PARAMS[type] }));
    schemas.set(type, schema);
  }
  return schema;
}

/** The stack with one effect's type or param set to `value`. */
const withEdit = (effects: readonly LabEffect[], effect: LabEffect, path: string, value: unknown): LabEffect[] =>
  path === 'type' ? setEffectType(effects, effect.id, value as BadgeEffect) : setEffectParam(effects, effect.id, path, value);

function EffectBody({ effect, effects, onChange, onDraft }: {
  effect: LabEffect;
  effects: readonly LabEffect[];
  onChange: (next: LabEffect[]) => void;
  onDraft: (next: LabEffect[]) => void;
}) {
  return (
    <ControlPanel
      schema={effectSchema(effect.type)}
      config={{ type: effect.type, ...effect.params }}
      pack="one-up"
      setConfig={(path, value) => onChange(withEdit(effects, effect, path, value))}
      draftConfig={(path, value) => onDraft(withEdit(effects, effect, path, value))}
    />
  );
}

/**
 * The ordered effect stack: add one, open a card by its number to edit it, drag a card by its number to
 * reorder, and switch, rename, duplicate, or remove each one.
 */
function EffectsEditor({ effects, onChange, onDraft }: {
  effects: readonly LabEffect[];
  onChange: (next: LabEffect[]) => void;
  /** The stack an edit is passing through, which the edit's settled `onChange` makes one undo step with. */
  onDraft: (next: LabEffect[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const cards = useMemo(() => effects.map(cardOf), [effects]);
  const next = nextEffectId(effects);
  return (
    <div className={s.effects}>
      <Select<BadgeEffect>
        aria-label="Add effect"
        placeholder="Add effect…"
        selectedKey={null}
        options={TYPE_OPTIONS}
        onSelectionChange={(type) => {
          onChange(addEffect(effects, type));
          setSelected(String(next));
        }}
      />
      {effects.length === 0 && <p className={s.empty}>No effects yet.</p>}
      <EffectList<Card>
        aria-label="Effects"
        items={cards}
        kinds={EFFECT_KINDS}
        onChange={(list) => onChange(list.map(effectOf))}
        selected={selected}
        onSelectionChange={setSelected}
        onDuplicate={(card) => ({ ...card, id: String(next), name: `${card.name} copy` })}
        renderBody={(card) => <EffectBody effect={card.effect} effects={effects} onChange={onChange} onDraft={onDraft} />}
      />
    </div>
  );
}

/** Draws the `effects` leaf as the effect stack. */
export const effectsRenderer: LeafRenderer = Object.assign(
  (ctx: RowContext) => (
    <EffectsEditor
      effects={(ctx.value as LabEffect[] | undefined) ?? []}
      onChange={ctx.setValue}
      onDraft={ctx.drafts?.setValue ?? ctx.setValue}
    />
  ),
  { wide: true },
);
