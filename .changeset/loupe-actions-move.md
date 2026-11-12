---
'@weasel-js/loupe': minor
'@weasel-js/labkit': major
---

The loupe's actions (`createLoupeActions`, `LoupeInputApi` and their ids) are imported from `@weasel-js/loupe`, not `@weasel-js/labkit`.

`@weasel-js/loupe` also exports `createLoupeAimActions` (just `loupe.aim` and `loupe.leave`), `LoupeAimInput`, the `LOUPE_AIM_ID`, `LOUPE_LEAVE_ID` and `LOUPE_PICK_ID` ids, and `WHEEL_RATE`. `LoupeInputApi.aimAt` is handed a third argument, `held`, true while a button is down.

```ts
// before
import { createLoupeActions, type LoupeInputApi } from '@weasel-js/labkit/loupe';
// after
import { createLoupeActions, type LoupeInputApi } from '@weasel-js/loupe';
```

<!-- entry: breaking api -->
