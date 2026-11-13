/**
 * What each sequence authoring action adds, as its params: the lifeline's
 * figure, the message's arrow, the fragment's type, and the lifeline mark.
 * Each group is the last-operation panel's form and its tool's options.
 */
import { pref } from '@weasel-js/prefs';

/** The Participant tool's options and the `addParticipant` action's params: what a click adds. */
export const SEQUENCE_PARTICIPANT_PARAMS = pref.group('Participant', {
  kind: pref.enum('Adds', 'participant', [
    { value: 'participant', label: 'Participant' }, { value: 'actor', label: 'Actor' },
  ], { description: 'The figure a new lifeline is headed by.' }),
}, { as: 'bar' });

/** The Message tool's options and the `drawMessage` action's params: the arrow a drag draws, a name in `SEQ_ARROWS`. */
export const SEQUENCE_MESSAGE_PARAMS = pref.group('Message', {
  arrow: pref.enum('Arrow', 'sync', [
    { value: 'sync', label: 'Call' }, { value: 'reply', label: 'Reply' }, { value: 'async', label: 'Async' },
    { value: 'lost', label: 'Lost' }, { value: 'both', label: 'Both ways' }, { value: 'line', label: 'Line' },
    { value: 'dashed', label: 'Dashed line' },
  ], { description: 'The line and head a new message is drawn with.' }),
}, { as: 'bar' });

/** The Fragment tool's options and the `wrapFragment` action's params: the type a drag wraps rows in. */
export const SEQUENCE_FRAGMENT_PARAMS = pref.group('Fragment', {
  type: pref.enum('Fragment', 'loop', [
    { value: 'loop', label: 'Loop' }, { value: 'alt', label: 'Alt' }, { value: 'opt', label: 'Opt' },
    { value: 'par', label: 'Par' }, { value: 'critical', label: 'Critical' }, { value: 'break', label: 'Break' },
    { value: 'region', label: 'Colored region' },
  ], { description: 'The operator a new fragment is labeled with.' }),
}, { as: 'bar' });

/** The Mark tool's options and the `addMark` action's params: the mark a click puts on a lifeline. */
export const SEQUENCE_MARK_PARAMS = pref.group('Mark', {
  mark: pref.enum('Mark', 'activate', [
    { value: 'activate', label: 'Activate' }, { value: 'deactivate', label: 'Deactivate' },
    { value: 'create', label: 'Create' }, { value: 'destroy', label: 'Destroy' },
  ], { description: 'An activation starting or ending, the head created there, or the lifeline ended.' }),
}, { as: 'bar' });
