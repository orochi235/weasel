---
'@weasel-js/forge': patch
---

The workshop's Issues panel is connected under the dev server. It lists the focused component's open issues labeled `forge:<component>` in the repository the checkout's `origin` names, through `gh issue list` and the machine's own `gh` login, so no token reaches the browser; with `gh` missing or not logged in, the panel says so in place of the list. Report opens GitHub's new-issue page with the title, the `forge:<component>` label, and a body carrying the description, the story, a link reopening it with the trial's args and globals, and the branch and commit; a screenshot is pasted there. A built workshop has no dev server, and its panel still says it is not connected.

A workshop URL can pin a trial's globals: a param named by the pin's config path (`$globals.mode=dark`) pins that global on the trial the story opens in, and is dropped from the URL once read. `mountWorkshop` and `Workshop` take `issuesBase`, the dev server base the panel asks.
