---
'@weasel-js/path-tools': major
'@weasel-js/geom': major
'@weasel-js/routing': major
---

Balance handles is now Poise, and every name it carried changes with it; this is breaking, with no aliases. Equalize handles keeps its name.

| Before | After |
|---|---|
| `balancePreset`, `createBalancePreset`, preset id `'balance'` | `poisePreset`, `createPoisePreset`, `'poise'` |
| action `balanceHandles`, its binding `balanceHandles.drag`, `balanceHandlesAction` | `poiseHandles`, `poiseHandles.drag`, `poiseHandlesAction` |
| chrome id `path-edit.balance`, `PATH_BALANCE_CHROME_ID` | `path-edit.poise`, `PATH_POISE_CHROME_ID` |
| toggle `pathEdit.show.balance`, `showBalanceAction` | `pathEdit.show.poise`, `showPoiseAction` |
| `createBalanceExtension`, `balanceCommands`, `PathEditBalanceStyle` | `createPoiseExtension`, `poiseCommands`, `PathEditPoiseStyle` |
| grip hit kind `balance:N`, routing's `isBalanceGrip` | `poise:N`, `isPoiseGrip` |
| `handleBalances`, `HandleBalance`, `balanceFactorToward` (`@weasel-js/geom`) | `poiseLines`, `PoiseLine`, `poiseFactorToward` |
| icon `path-tools:balanceHandles` | `path-tools:poise` |

```ts
// before
const balance = createBalancePreset({ color: '#a0f' });
<SceneCanvas features={['paths', balance]} tune={{ balanceHandles: { bindings: [{ kind: 'key', key: 'b' }] } }} />
// after
const poise = createPoisePreset({ color: '#a0f' });
<SceneCanvas features={['paths', poise]} tune={{ poiseHandles: { bindings: [{ kind: 'key', key: 'b' }] } }} />
```

<!-- entry: rank=5 breaking api -->
