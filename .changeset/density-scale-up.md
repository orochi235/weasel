---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Every density is larger. The UI base size is 13px under `compact`, 15px under `comfortable` (the default) and 18px under `roomy`, up from 11, 13 and 15, so the small step a sidebar row reads goes from 11px to 13px by default. Control, toolbar and icon-button heights moved with the text: `compact` takes the old `comfortable` sizes, `comfortable` the old `roomy` ones, and `roomy` grows to match its 18px base. Any consumer that sized chrome against the old defaults gets bigger chrome.
