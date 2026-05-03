 # API conventions

Project-wide API design rules for weasel. Add new entries as patterns
emerge — keep each one short, with a rule and a brief rationale.

## Defaults stay explicitly declarable

Props, attributes, and config fields with default values must still
accept the default being passed explicitly. Don't reject, warn, or
treat `tool="none"` (when `"none"` is the default) as redundant.

**Why.** Explicit declaration is a clarity tool — readers shouldn't
have to know the default to understand intent. It lets demos and
consumers self-document.

**Scope.** Applies to React component props, HTML attributes, and JS
config objects. Does *not* apply to positional function arguments or
anywhere requiring explicit defaults would cause organizational chaos.
