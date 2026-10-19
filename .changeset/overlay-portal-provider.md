---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Overlays now choose their portal container through React Aria's portal provider instead of the deprecated `UNSTABLE_portalContainer` prop. `useOverlayPortal` returns `provide`, a function that wraps the React Aria overlay, in place of `portalProps` — a breaking change for code that spread `portalProps` onto its own overlay. Wrap that overlay in `provide(...)` instead. An overlay given `portalContainer={null}` now reaches the body even from inside another overlay.

A `ToastRegion` given a container now renders React Aria's own region inside it, so it is an F6 landmark like an uncontained one. Both regions also now register as landmarks when their first toast arrives after mount, which the fixed "Notifications" label had prevented: the region now carries React Aria's localized label, which counts the toasts ("2 notifications.").

`@weasel-js/ui` pins `react-aria` and `react-aria-components` to exact versions, `react-aria` at the one `react-aria-components` pins, so the two cannot resolve to separate copies. A second copy would leave every overlay in the body, outside its theme, with no error.
