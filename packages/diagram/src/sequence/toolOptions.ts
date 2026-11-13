/**
 * The sequence tools' options: the same groups as their actions' params
 * (`authorParams`), so an options row and the last-operation panel are one form.
 */
import type { ToolOptions } from '@weasel-js/core';
import { ADD_MARK_ACTION_ID, ADD_PARTICIPANT_ACTION_ID } from './authorActions';
import { DRAW_MESSAGE_ACTION_ID, WRAP_FRAGMENT_ACTION_ID } from './authorDrags';
import { SEQUENCE_FRAGMENT_PARAMS, SEQUENCE_MARK_PARAMS, SEQUENCE_MESSAGE_PARAMS, SEQUENCE_PARTICIPANT_PARAMS } from './authorParams';

/** The Participant tool's options. */
export const SEQUENCE_PARTICIPANT_OPTIONS = { actionId: ADD_PARTICIPANT_ACTION_ID, prefs: SEQUENCE_PARTICIPANT_PARAMS } satisfies ToolOptions;
/** The Message tool's options. */
export const SEQUENCE_MESSAGE_OPTIONS = { actionId: DRAW_MESSAGE_ACTION_ID, prefs: SEQUENCE_MESSAGE_PARAMS } satisfies ToolOptions;
/** The Fragment tool's options. */
export const SEQUENCE_FRAGMENT_OPTIONS = { actionId: WRAP_FRAGMENT_ACTION_ID, prefs: SEQUENCE_FRAGMENT_PARAMS } satisfies ToolOptions;
/** The Mark tool's options. */
export const SEQUENCE_MARK_OPTIONS = { actionId: ADD_MARK_ACTION_ID, prefs: SEQUENCE_MARK_PARAMS } satisfies ToolOptions;
