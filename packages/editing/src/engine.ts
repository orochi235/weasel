/**
 * `@weasel-js/editing/engine`: what a host of any dimension binds from editing, loading none of its 2D presets or
 * tools. A 3D host builds its select tool over its own picker and registers the engine's standard actions.
 *
 * @packageDocumentation
 */
export { ENGINE_STANDARD_ACTIONS } from './engineStandardActions';
export { createSelection, useSelection, type UseSelectionOptions } from './selection/useSelection';
export { createSelectToolWith, useSelectToolWith, type SelectAdapter, type UseSelectToolOptions } from './tools/select/useSelectToolWith';
export { selectionMoveContribution, type SelectionMoveOptions } from './tools/select/selectionContributions';
export { createGroupEntryContribution, useGroupEntryContribution, GROUP_ENTRY_ID } from './tools/select/groupEntry';
