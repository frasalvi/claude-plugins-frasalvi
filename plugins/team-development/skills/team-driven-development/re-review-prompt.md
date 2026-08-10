# Scoped Re-Review Prompt Template

Use after a fix round: verify each finding was addressed and check the fix
diff for new breakage. Not a fresh review — the full review already happened.
The re-reviewer is always a fresh subagent, never whoever wrote the fix.

```
Subagent (general-purpose):
  description: "Re-review [SCOPE] fix round R"
  model: [MODEL — REQUIRED: Sonnet or Haiku ONLY, scaled to the fix diff;
         a small fix diff takes Haiku. Never the session model; an omitted
         model silently inherits it.]
  prompt: |
    You are re-reviewing one fix round. A previous review produced findings
    and a worker has attempted to fix them. Verdict each finding and inspect
    the fix diff — nothing else.

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

    Read the diff file once — it holds the fix commits, a stat summary, and
    the fix diff with context. Do not re-run git commands. If it is missing,
    use `git diff --stat [FIX_BASE_SHA]..[HEAD_SHA]` and
    `git diff [FIX_BASE_SHA]..[HEAD_SHA]`.

    Your review is read-only: do not mutate the working tree, index, HEAD,
    or branch state.

    ## Scope

    The findings list and the fix diff. Verdict every finding; inspect the
    fix diff for problems the fix itself introduced. Do NOT re-review code
    the fix did not touch — an issue entirely outside the fix diff goes under
    Out-of-Scope Observations, where it neither blocks this work nor extends
    the loop. A broad whole-branch review runs after all domains complete.

    ## Tests

    The worker re-ran the tests covering the amended code and appended the
    results to the report. Treat that as unverified claims: confirm the
    report names the covering tests with their output, and check the claims
    against the diff. Do not re-run the suite to confirm it. Run a test only
    when reading the code raises a specific doubt no existing run answers —
    and then a focused test, never a package-wide suite.

    ## Output Format

    Your final message is the report: begin with the first verdict. Every
    line is a verdict, a finding with file:line, or a check you ran.

    ### Finding Verdicts

    For each finding above, in order:
    - **[finding one-liner]** — ADDRESSED | NOT ADDRESSED, with file:line
      evidence. "Attempted" is not addressed: the specific defect must no
      longer exist.

    ### New Breakage in the Fix Diff

    What the fix broke or introduced, with severity (Critical/Important/
    Minor) and file:line. "None" if clean.

    ### Out-of-Scope Observations

    Issues entirely outside the fix diff. Non-blocking. "None" if none.

    ### Verdict

    **Fix round:** [All findings addressed, no new Critical/Important
    breakage | Findings remain open] — list the open ones.
```

**Placeholders:**
- `[SCOPE]` — REQUIRED: "Task N" for a risky-task review, "the <domain>
  domain" for a domain review
- `[MODEL]` — REQUIRED: Sonnet or Haiku only
- `[BRIEF_FILES]` — the brief(s) the worker worked from
- `[FINDINGS]` — the previous review's Critical/Important findings and spec
  gaps, verbatim, one per bullet
- `[REPORT_FILES]` — the worker's report file(s), fix reports appended
- `[FIX_BASE_SHA]` / `[HEAD_SHA]` — the head the previous review saw; current
- `[DIFF_FILE]` — the path `scripts/review-package PLAN_FILE FIX_BASE HEAD`
  printed
