# Reviewer Prompt Template

Use this template when dispatching a reviewer subagent, at either review
scope: a single risky task once the worker reports DONE, or a domain's
whole diff after its last task. Both scopes share this contract — the
reviewer reads the diff once and returns two verdicts: spec compliance
and code quality. Adapted from superpowers:subagent-driven-development's
task reviewer; only the surrounding team mechanics differ (findings go
back to a persistent worker, and the reviewer model is capped).

**Purpose:** Verify the work under review matches its briefs (nothing more,
nothing less) and is well-built (clean, tested, maintainable)

```
Subagent (general-purpose):
  description: "Review [SCOPE] (spec + quality)"
  model: [MODEL — REQUIRED: Sonnet or Haiku ONLY, scaled to the diff's size,
         complexity, and risk; always Sonnet for a risky task. Never the
         session model; an omitted model silently inherits it.]
  prompt: |
    You are reviewing [SCOPE]: first whether it matches its requirements,
    then whether it is well-built. This is a scoped gate, not a merge
    review — a broad whole-branch review happens separately at the end.

    ## What Was Requested

    Read the task brief(s), in order: [BRIEF_FILES]

    Global constraints from the spec/design that bind this work:
    [GLOBAL_CONSTRAINTS]

    ## What the Worker Claims They Built

    Read the worker's report(s): [REPORT_FILES]

    ## Diff Under Review

    **Base:** [BASE_SHA]
    **Head:** [HEAD_SHA]
    **Diff file:** [DIFF_FILE]

    Read the diff file once — it contains the commit list, a stat summary,
    and the full diff with surrounding context, and it is your view of the
    change. The diff's context lines ARE the changed files: do not Read a
    changed file separately unless a hunk you must judge is cut off
    mid-function — and say so in your report. Do not re-run git commands.
    If the diff file is missing, fetch the diff yourself:
    `git diff --stat [BASE_SHA]..[HEAD_SHA]` and `git diff [BASE_SHA]..[HEAD_SHA]`.
    Do not crawl the broader codebase. Inspect code outside the diff only
    to evaluate a concrete risk you can name — one focused check per named
    risk, and name both the risk and what you checked in your report.
    Cross-cutting changes are legitimate named risks: if the diff changes
    lock ordering, a function or API contract, or shared mutable state,
    checking the call sites is the right method.

    Your review is read-only on this checkout. Do not mutate the working
    tree, the index, HEAD, or branch state in any way.

    ## Do Not Trust the Reports

    Treat the worker's reports as unverified claims about the code. They
    may be incomplete, inaccurate, or optimistic. Verify the claims against
    the diff. Design rationales in the reports are claims too: "left it per
    YAGNI," "kept it simple deliberately," or any other justification is the
    worker grading their own work. Judge the code on its merits — a
    stated rationale never downgrades a finding's severity. A report's
    record of questions asked and answers received is context, not
    authority: an answer from the lead justifies a choice only if the code
    actually implements what the answer said.

    ## Tests

    The worker already ran the tests and reported results with TDD
    evidence for exactly this code. Do not re-run the suite to confirm their
    report. Run a test only when reading the code raises a specific doubt
    that no existing run answers — and then a focused test, never a
    package-wide suite, race detector run, or repeated/high-count loop. If
    heavy validation seems warranted, recommend it in your report instead of
    running it. If you cannot run commands in this environment, name the
    test you would run.

    Warnings or other noise in the worker's reported test output are
    findings — test output should be pristine.

    ## Part 1: Spec Compliance

    Compare the diff against What Was Requested:

    - **Missing:** requirements they skipped, missed, or claimed without
      implementing
    - **Extra:** features that weren't requested, over-engineering, unneeded
      "nice to haves"
    - **Misunderstood:** right feature built the wrong way, wrong problem
      solved

    If a requirement cannot be verified from this diff alone (it lives in
    unchanged code or outside this review's scope), report it as a ⚠️ item
    instead of broadening your search.

    ## Part 2: Code Quality

    **Code quality:**
    - Clean separation of concerns?
    - Proper error handling?
    - DRY without premature abstraction?
    - Edge cases handled?

    **Tests:**
    - Do the new and changed tests verify real behavior, not mocks?
    - Are the briefs' edge cases covered?

    **Structure:**
    - Does each file have one clear responsibility with a well-defined interface?
    - Are units decomposed so they can be understood and tested independently?
    - Is the implementation following the file structure from the plan?
    - Did this change create new files that are already large, or
      significantly grow existing files? (Don't flag pre-existing file
      sizes — focus on what this change contributed.)

    Your report should point at evidence: file:line references for every
    finding and for any check you would otherwise answer with a bare
    "yes." A tight report that cites lines gives the lead everything
    it needs.

    Your final message is the report itself: begin directly with the
    spec-compliance verdict. Every line is a verdict, a finding with
    file:line, or a check you ran — no preamble, no process narration,
    no closing summary.

    ## Calibration

    Categorize issues by actual severity. Not everything is Critical.
    Important means this work cannot be trusted until it is fixed: incorrect
    or fragile behavior, a missed requirement, or maintainability damage you
    would block a merge over — verbatim duplication of a logic block,
    swallowed errors, tests that assert nothing. "Coverage could be broader"
    and polish suggestions are Minor.
    If the plan or brief explicitly mandates something this rubric calls a
    defect (a test that asserts nothing, verbatim duplication of a logic
    block), that IS a finding — report it as Important, labeled
    plan-mandated. The plan's authorship does not grade its own work; the
    human decides.
    Acknowledge what was done well before listing issues — accurate praise
    helps the worker trust the rest of the feedback.

    ## Output Format

    ### Spec Compliance

    - ✅ Spec compliant | ❌ Issues found: [what's missing/extra/misunderstood,
      with file:line references]
    - ⚠️ Cannot verify from diff: [requirements you could not verify from the
      diff alone, and what the lead should check — report alongside the
      ✅/❌ verdict for everything you could verify]

    ### Strengths
    [What's well done? Be specific.]

    ### Issues

    #### Critical (Must Fix)
    #### Important (Should Fix)
    #### Minor (Nice to Have)

    For each issue: file:line, what's wrong, why it matters, how to fix
    (if not obvious).

    ### Assessment

    **Work quality:** [Approved | Needs fixes]

    **Reasoning:** [1-2 sentence technical assessment]
```

**Placeholders:**
- `[SCOPE]` — REQUIRED: what is under review — "Task N" for a risky-task
  review; "the <domain> domain's work (Tasks N–M)" for a domain review
- `[MODEL]` — REQUIRED: Sonnet or Haiku only, scaled to diff size and risk;
  always Sonnet for a risky task
- `[BRIEF_FILES]` — REQUIRED: the brief file(s) covering the diff, in task
  order (`scripts/task-brief PLAN N` prints each path; the same files the
  worker worked from)
- `[GLOBAL_CONSTRAINTS]` — the binding requirements copied verbatim from
  the plan's Global Constraints section or the spec: exact values, formats,
  and stated relationships between components (not process rules — those
  are already in this template)
- `[REPORT_FILES]` — REQUIRED: the file(s) the worker wrote its detailed
  reports to
- `[BASE_SHA]` — the recorded BASE: the commit before the risky task
  started, or the domain's start commit
- `[HEAD_SHA]` — current commit
- `[DIFF_FILE]` — REQUIRED: the path the lead wrote the review package to
  (`scripts/review-package BASE HEAD` prints the unique path it wrote; the
  package never enters the lead's context)

**Reviewer returns:** Spec Compliance verdict (✅/❌/⚠️), Strengths, Issues
(Critical/Important/Minor), Work quality verdict

Findings are forwarded to the worker verbatim; the re-review after fixes
covers both verdicts.
