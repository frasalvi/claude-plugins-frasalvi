# Scoped Re-Review Prompt Template

Use this template when dispatching a re-review after a fix round. The
re-reviewer verifies the findings were addressed and checks the fix diff for
new breakage. It is not a fresh review — the full review already happened.

The re-reviewer is always a fresh subagent, never the worker that wrote the
fix. Adapted from superpowers:subagent-driven-development's re-review prompt;
only the surrounding team mechanics differ (the fix came from a live domain
worker, or from a one-shot fix subagent at rounds 4-5).

**Purpose:** Verify each finding from the previous review was addressed, and
that the fix itself broke nothing.

```
Subagent (general-purpose):
  description: "Re-review [SCOPE] fix round R"
  model: [MODEL — REQUIRED: Sonnet or Haiku ONLY, scaled to the fix diff;
         a small fix diff takes Haiku. Never the session model; an omitted
         model silently inherits it.]
  prompt: |
    You are re-reviewing one fix round. A previous review produced findings;
    a worker has attempted to fix them. Your job is to verdict each finding
    and inspect the fix diff — nothing else.

    ## What Was Requested

    Read the brief(s): [BRIEF_FILES]

    ## The Findings Under Verification

    [FINDINGS]

    ## The Fix

    Read the worker's report (fix reports are appended at the end):
    [REPORT_FILES]

    **Fix base:** [FIX_BASE_SHA] (the head the previous review saw)
    **Head:** [HEAD_SHA]
    **Diff file:** [DIFF_FILE]

    Read the diff file once — it contains the fix commits, a stat summary,
    and the fix diff with surrounding context. Do not re-run git commands.
    If the diff file is missing, fetch the diff yourself:
    `git diff --stat [FIX_BASE_SHA]..[HEAD_SHA]` and
    `git diff [FIX_BASE_SHA]..[HEAD_SHA]`.

    Your review is read-only on this checkout. Do not mutate the working
    tree, the index, HEAD, or branch state in any way.

    ## Scope

    Your scope is the findings list and the fix diff. Verdict every finding.
    Inspect the fix diff for new problems the fix itself introduced. Do NOT
    re-review code the fix did not touch: if you notice an issue entirely
    outside the fix diff, report it under Out-of-Scope Observations — it
    does not block this work and does not extend the loop. A broad
    whole-branch review happens after all domains are complete.

    ## Tests

    The worker re-ran the tests covering the amended code and appended the
    results to the report file. Treat the report as unverified claims:
    confirm the fix report names the covering tests and shows their output,
    and verify the claims against the diff. Do not re-run the suite to
    confirm their report. Run a test only when reading the code raises a
    specific doubt that no existing run answers — and then a focused test,
    never a package-wide suite.

    ## Output Format

    Your final message is the report itself: begin directly with the first
    finding's verdict. Every line is a verdict, a finding with file:line,
    or a check you ran — no preamble, no process narration.

    ### Finding Verdicts

    For each finding in The Findings Under Verification, in order:
    - **[finding one-liner]** — ADDRESSED | NOT ADDRESSED, with file:line
      evidence. "Attempted" is not addressed: the specific defect must no
      longer exist.

    ### New Breakage in the Fix Diff

    Anything the fix itself broke or introduced, with severity
    (Critical/Important/Minor) and file:line. "None" if clean.

    ### Out-of-Scope Observations

    Issues you noticed entirely outside the fix diff. Non-blocking; the
    lead ledgers these for the final review. "None" if none.

    ### Verdict

    **Fix round:** [All findings addressed, no new Critical/Important
    breakage | Findings remain open] — list the open ones.
```

**Placeholders:**
- `[SCOPE]` — REQUIRED: what the fix covers — "Task N" for a risky-task
  review, "the <domain> domain" for a domain review
- `[MODEL]` — REQUIRED: Sonnet or Haiku only; scoped re-reviews of small fix
  diffs take Haiku
- `[BRIEF_FILES]` — the brief file(s) the worker worked from
- `[FINDINGS]` — the Critical/Important findings and spec gaps from the
  previous review, copied verbatim, one per bullet
- `[REPORT_FILES]` — the worker's report file(s), with fix reports appended
- `[FIX_BASE_SHA]` — the head the previous review saw
- `[HEAD_SHA]` — current commit
- `[DIFF_FILE]` — the path `scripts/review-package PLAN_FILE FIX_BASE HEAD` printed

**Re-reviewer returns:** per-finding verdicts (ADDRESSED / NOT ADDRESSED),
new breakage in the fix diff, out-of-scope observations, and a round verdict.
