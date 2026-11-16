import { VIEW_TOOLS } from '../builtinToolSets';
import type { FeaturePreset } from '../features';

/** The hand tool. */
export const viewToolsPreset: FeaturePreset = { id: 'tools:view', label: 'View tools', tools: [VIEW_TOOLS] };
