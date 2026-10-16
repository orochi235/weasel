---
"@weasel-js/react": patch
---

Add kit settings: a `KitSettings` interface each package augments with its own area, a
`<KitSettingsProvider>` that sets values for a subtree (nested providers merge), `useKitSetting(path)`
for components, which re-renders only when that path changes, and `useKitSettings()` for code outside
React to read at the moment it needs a value.
