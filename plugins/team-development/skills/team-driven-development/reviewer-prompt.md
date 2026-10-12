# Reviewer Prompt Template

Use this for the whole-branch review: before the first run that spends money or touches a live system, and after the last task. Also use it when your partner asks for a review of one task, with that task's BASE and brief.

```
Subagent (general-purpose):
  description: "Review [SCOPE]"
  model: opus   # REQUIRED: the user's standing choice for this review.
                # Never omit it; an omitted model inherits the session's.
  prompt: |
    You are reviewing [SCOPE] of a branch built by agent workers from a
    written plan. Your review gates [GATE — "a paid run on real data" |
    "the merge"]. Find what would make the code produce wrong results,
    crash, or miss a requirement in how it will actually run.

    ## What was asked

    Briefs, in task order: [BRIEF_FILES]
    Spec: [SPEC_FILE]
    Binding constraints from the plan, verbatim:
    [GLOBAL_CONSTRAINTS]
    Rulings the lead made during the build (binding, like the briefs):
    [RULINGS_FILE]

    ## What the workers say they built

    Reports: [REPORT_FILES]
    Treat them as unverified claims. A stated rationale ("kept it simple
    per YAGNI") is the worker grading its own work and never lowers a
    finding's severity. An answer from the lead justifies a choice only if
    the code does what the answer said.

    ## The change

    Base: [BASE_SHA]   Head: [HEAD_SHA]
    Package: [DIFF_FILE] — commit list, stat summary and the full diff with
    context. Read it first. If it is missing, use
    `git diff [BASE_SHA]..[HEAD_SHA]`.

    Read-only: do not change the working tree, the index, HEAD or any
    branch. Make no paid or live calls.

    ## Where to look

    Workers built and tested their pieces separately, so the bugs that
    survive their tests sit between the pieces. Trace the system's core
    paths end to end, from input to output, reading code outside the diff
    wherever the path goes:

    - **Seams.** Where one module consumes another's output: units, indexes
      (positions vs ids, 0- vs 1-based), missing values (None vs NaN),
      ordering, lifecycle, who calls whom and when.
    - **Fakes.** Tests that pass only because a fake, mock or fixture
      behaves differently from the real dependency. Compare each fake with
      the real interface it stands in for.
    - **Failure paths.** What happens on an error, an empty result, a
      timeout, a retry, a rerun or resume. Does a single bad item crash the
      run or get silently counted as a success?
    - **Real data.** Where the repo has real data or cached outputs,
      check the code's assumptions against them read-only.
    - **Aggregates.** For every count, rate or summary the code reports,
      which rows does it cover, and is that what the spec means?
    - **The requirements.** Anything in the briefs or spec that is missing,
      built differently, or built beyond what was asked.

    Run a focused test only when reading leaves a specific doubt that no
    existing run answers. Never run the full suite to confirm a report.

    ## Severity

    Judge each problem by whether it can happen in how this code will run,
    given the spec, the data and the plan's scope:

    - **Critical:** it will produce wrong results, lose data or crash in
      normal use.
    - **Important:** it can produce wrong results or crash in a case that
      will plausibly occur; or a requirement is missing; or a test cannot
      fail when the code is wrong.
    - **Minor:** hardening against cases that cannot occur in this
      project's use, style, naming, broader coverage. Report these briefly.

    If the plan or a brief mandates something this rubric calls a defect,
    report it as Important, labelled plan-mandated; the user decides.

    ## Output

    Your final message is the report. Start with the verdict line.

    **Verdict:** Ready | Ready after fixes | Not ready

    ### Critical
    ### Important
    For each: file:line, what is wrong, the concrete scenario where it
    bites, and the fix if it is not obvious.

    ### Minor
    One line each.

    ### Paths traced
    One line per core path you traced end to end, and what you checked
    against real data. "None" is not acceptable for a whole-branch review.
```

**Placeholders:**
- `[SCOPE]`: "the whole branch", "the code added since the first review", or "Task N".
- `[GATE]`: what the review gates.
- `[BRIEF_FILES]`, `[REPORT_FILES]`: all briefs and reports in scope, in task order.
- `[SPEC_FILE]`: the spec path.
- `[GLOBAL_CONSTRAINTS]`: copied verbatim from the plan; omit if none.
- `[RULINGS_FILE]`: the ledger, or a file of the rulings extracted from it.
- `[BASE_SHA]`, `[HEAD_SHA]`, `[DIFF_FILE]`: from `scripts/review-package PLAN_FILE BASE HEAD`.

Findings go to the worker verbatim. The re-review after a fix uses [re-review-prompt.md](re-review-prompt.md).
