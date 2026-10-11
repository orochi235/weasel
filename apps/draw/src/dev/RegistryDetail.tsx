import s from './RegistryInspector.module.css';
import { ActionDetail } from './detail/ActionDetail';
import { BundleDetail } from './detail/BundleDetail';
import { GestureDetail, PhaseOutputDetail } from './detail/GestureDetail';
import { IconDetail } from './detail/IconDetail';
import { PropertiesKindDetail, RoutingKindDetail, ShapeKindDetail } from './detail/KindDetail';
import { MetaDetail } from './detail/MetaDetail';
import { OpFactoryDetail, OpKindDetail } from './detail/OpDetail';
import { GroupDetail, ModifierSetDetail, RouteDetail, RouteTargetDetail, SlotDetail } from './detail/RouteDetail';
import { ToolDetail } from './detail/ToolDetail';
import type { Props } from './detail/shared';
import type {
  ActionEntry,
  ToolEntry,
  TreeEntry
} from './registryData';
import { GESTURE_CHANNEL_KEYS, parseRoute, PHASE_OUTPUT_KEYS } from './registryData';
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
    case 'tool':          return <ToolDetail entry={entry} onNavigate={onNavigate} />;
    case 'action':        return <ActionDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'bundle':        return <BundleDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'shapeKind':     return <ShapeKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'routingKind':   return <RoutingKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'propertiesKind': return <PropertiesKindDetail entry={entry} />;
    case 'icon':          return <IconDetail entry={entry} />;
    case 'opFactory':     return <OpFactoryDetail entry={entry} />;
    case 'gesture':       return <GestureDetail entry={entry} tools={tools} actions={actions} onNavigate={onNavigate} />;
    case 'phaseOutput':   return <PhaseOutputDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'opKind':        return <OpKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'slot':          return <SlotDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'route':         return <RouteDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'routeTarget':   return <RouteTargetDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'modifierSet':   return <ModifierSetDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'group':         return <GroupDetail entry={entry} tools={tools} actions={actions} onNavigate={onNavigate} />;
    case 'meta':          return <MetaDetail entry={entry} />;
  }
}
