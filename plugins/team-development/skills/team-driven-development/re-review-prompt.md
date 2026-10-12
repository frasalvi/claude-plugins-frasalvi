# Re-Review Prompt Template

Use after a fix round that changed logic. It checks each finding and the fix diff, nothing else. The re-reviewer is always a fresh subagent.

```
Subagent (general-purpose):
  description: "Re-review fix round R"
  model: [sonnet | haiku — REQUIRED; Haiku only for a small fix diff.
         An omitted model inherits the session's.]
  prompt: |
    A review produced findings and a worker has tried to fix them. Give a
    verdict on each finding and check the fix diff for new problems.

    ## Findings

    [FINDINGS — verbatim, one per bullet]

    ## The fix

    Report (fix results appended at the end): [REPORT_FILES]
    Fix base: [FIX_BASE_SHA] (the head the previous review saw)
    Head: [HEAD_SHA]
    Package: [DIFF_FILE]. If missing, use `git diff [FIX_BASE_SHA]..[HEAD_SHA]`.

    Read-only: do not change the working tree, the index, HEAD or any
    branch. Make no paid or live calls.

    ## Scope

    The findings and the fix diff only. An issue entirely outside the fix
    diff goes under Out of scope, where it does not block. Don't re-run the
    suite; run a focused test only for a specific doubt.

    ## Output

    Start with the first verdict.

    ### Findings
    - **[finding one-liner]**: ADDRESSED | NOT ADDRESSED, with file:line.
      "Attempted" is not addressed: the defect must be gone.

    ### New problems in the fix
    Severity (Critical / Important / Minor) and file:line. "None" if clean.

    ### Out of scope
    "None" if none.

    **Round verdict:** all addressed, nothing new at Critical or Important |
    open: [list]
```

**Placeholders:** `[FINDINGS]` (Critical and Important only, verbatim), `[REPORT_FILES]`, `[FIX_BASE_SHA]`, `[HEAD_SHA]`, `[DIFF_FILE]` (from `scripts/review-package PLAN_FILE FIX_BASE HEAD`).
