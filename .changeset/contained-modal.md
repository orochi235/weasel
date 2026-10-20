---
'@weasel-js/ui': patch
'@weasel-js/forge': patch
---

`OverlayPortalProvider` takes `contained`: its container stands in for the viewport. A `Dialog` below it covers the
container rather than the window, traps focus, and makes inert only what the container holds, leaving the rest of
the page usable and its scrolling alone. React Aria's modal hides the whole document and locks its scroll with no
way to scope either, so a contained `Dialog` is built from React Aria's public pieces instead.

forge's in-page trials are contained, so a story's modal dims its own trial and the workshop stays usable around
it. A story now scrolls inside its trial host rather than the host scrolling, so an overlay it portals stays over
the trial however far the story has scrolled.
