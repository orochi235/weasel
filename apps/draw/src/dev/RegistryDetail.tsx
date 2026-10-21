import s from './RegistryInspector.module.css';
import { BundleDetail } from './detail/BundleDetail';
import { GestureDetail, PhaseOutputDetail } from './detail/GestureDetail';
import { IconDetail } from './detail/IconDetail';
import { PropertiesKindDetail, ShapeKindDetail } from './detail/KindDetail';
import { MetaDetail } from './detail/MetaDetail';
import { OpFactoryDetail, OpKindDetail } from './detail/OpDetail';
import { SlotDetail } from './detail/SlotDetail';
import type { Props } from './detail/shared';
import { parseRoute } from './registryData';
import { type ActionEntry, type ToolEntry, type TreeEntry, GESTURE_CHANNEL_KEYS, PHASE_OUTPUT_KEYS } from './registryEntries';
void GESTURE_CHANNEL_KEYS;
void PHASE_OUTPUT_KEYS;
void parseRoute;

export function RegistryDetail({ entry, tools, actions, category, onNavigate }: Props) {
  return (
    <>
      {category && (
        <nav className={s.breadcrumb} aria-label="Breadcrumb">
          {category.group && (
            <>
              <span>{category.group.label}</span>
              <span className={s.breadcrumbSep} aria-hidden>/</span>
            </>
          )}
          <span>{category.label}</span>
        </nav>
      )}
      {renderEntryBody(entry, tools, actions, onNavigate)}
    </>
  );
}

function renderEntryBody(
  entry: TreeEntry,
  tools: readonly ToolEntry[],
  actions: readonly ActionEntry[],
  onNavigate: Props['onNavigate'],
) {
  switch (entry.kind) {
    case 'bundle':        return <BundleDetail entry={entry} tools={tools} />;
    case 'shapeKind':     return <ShapeKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'propertiesKind': return <PropertiesKindDetail entry={entry} />;
    case 'icon':          return <IconDetail entry={entry} />;
    case 'opFactory':     return <OpFactoryDetail entry={entry} />;
    case 'gesture':       return <GestureDetail entry={entry} tools={tools} actions={actions} />;
    case 'phaseOutput':   return <PhaseOutputDetail entry={entry} tools={tools} />;
    case 'opKind':        return <OpKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'slot':          return <SlotDetail entry={entry} tools={tools} />;
    case 'meta':          return <MetaDetail entry={entry} />;
  }
}
