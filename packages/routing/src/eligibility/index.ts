/**
 * The eligibility rule algebra: a composable boolean tree over live canvas
 * state, evaluated by the dispatcher to decide whether an action may run at
 * all and by `@weasel-js/core`'s chrome-caps layer to decide whether a piece
 * of chrome shows. One tree, two readers — which is what makes
 * visible-is-hittable fall out by construction rather than by convention.
 *
 * The `cond`/`when`/`and`/`or` builders that produce these trees live in
 * core, beside the chrome ids they name.
 */
export { evaluate, describeRule, ALWAYS, NEVER } from './rule';
export type { Rule, Selector, Condition } from './rule';
export type { RuleCtx, BuildRuleCtxArgs } from './ruleCtx';
export { buildRuleCtx, DEFAULT_ALLOWED_CAPABILITIES } from './ruleCtx';
export { resolveDeviceProfile, COARSE_TARGET_SCALE, DEFAULT_DEVICE_PROFILE } from './deviceProfile';
export type { DetectedDeviceFacts } from './deviceProfile';
