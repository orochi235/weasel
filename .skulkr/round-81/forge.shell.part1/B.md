## The answer book's 50-config eviction drops answers for configs an open trial still holds
- where: packages/forge/src/shell/answers.ts:46 (createAnswerBook → record)
- scenario: One answer book is shared by every trial of a story (`instrumentCache.ts` keys books by entry id). Trial A shows config X and holds it (`FrameView` calls `answers.hold(ctx.config)`); trial B, same story, has a slider dragged through 50+ values, each `answers` message from B's frame calling `record` with a new config key. Once 50 newer keys are recorded, the oldest, X, is evicted, although `held` still counts it. A's panel then reads `hidden`/`disabled`/`errors`/`resolved` for X as unanswered: every node shows, nothing is disabled, no errors appear. A's frame does not answer again because its config has not changed, so this lasts until A's config next changes. `answerFor` also never refreshes recency, so how often a config is read has no effect on which one is evicted. Eviction should skip held keys, or count only unheld keys toward the limit.
- evidence: read
- severity: medium

## Files read
packages/forge/src/shell/Crumbs.css
packages/forge/src/shell/Crumbs.tsx
packages/forge/src/shell/FrameView.tsx
packages/forge/src/shell/GlobalsToolbar.tsx
packages/forge/src/shell/IndexTrial.tsx
packages/forge/src/shell/RouteKnobs.tsx
packages/forge/src/shell/StoryBody.tsx
packages/forge/src/shell/StoryGlobalsContext.ts
packages/forge/src/shell/StoryScroller.tsx
packages/forge/src/shell/StoryTrial.tsx
packages/forge/src/shell/TrialHost.tsx
packages/forge/src/shell/Workshop.tsx
packages/forge/src/shell/a11y/A11yPanel.css
packages/forge/src/shell/a11y/A11yPanel.tsx
packages/forge/src/shell/a11y/reasons.ts
packages/forge/src/shell/answers.ts
packages/forge/src/shell/breadcrumb.ts
packages/forge/src/shell/checkShellConfig.ts
packages/forge/src/shell/dependencies.ts
packages/forge/src/shell/documentInstrument.tsx
packages/forge/src/shell/followEdits.ts
packages/forge/src/shell/frameActions.ts
packages/forge/src/shell/frameLink.ts
packages/forge/src/shell/framePool.ts
packages/forge/src/shell/globals.ts
packages/forge/src/shell/globalsMenu.tsx
packages/forge/src/shell/hostConditions.ts
packages/forge/src/shell/inViewMargin.ts
packages/forge/src/shell/index.ts
packages/forge/src/shell/info/StoryDossier.tsx
packages/forge/src/shell/info/StoryInfoDialog.tsx
packages/forge/src/shell/info/dossier.ts
packages/forge/src/shell/info/infoItem.ts
packages/forge/src/shell/instrumentCache.ts
packages/forge/src/shell/issues/IssuesPanel.tsx

<!-- done: 1 findings, files read: 35 -->
