---
'@weasel-js/ui': patch
---

Two `Timeline` fixes. Deleting, inserting, or re-ordering a key drops the selected segment: the easing picker stayed open after such an edit and went on editing whichever segment had taken the old index. Delete or Backspace with an event mark selected no longer calls `onChange` with an unchanged track list; events cannot be deleted from the timeline, and the key press is now left alone.
