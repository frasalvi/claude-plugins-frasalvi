# Fork Implementer Prompt Template

Use this template when dispatching a task to a forked implementer. The fork
inherits the controller's full conversation and prompt cache, so the dispatch
carries only what the fork cannot already know: which task is its, where the
brief and report files are, and any ruling the ledger holds for this task.

Onboarding content (scene-setting, dependencies, interfaces from earlier
tasks) is deliberately absent. If you find yourself pasting context into
this prompt, stop: either the fork already has it, or your session lost it
(compaction), in which case the fix is the brief file and the ledger, not a
longer dispatch.

```
Agent:
  subagent_type: fork
  description: "Implement Task N: [task name]"
  # No `model:` — the harness ignores it for forks, and a fork on a different
  # model could not share the prompt cache anyway. Cost is tuned with the
  # session's /effort, not per-dispatch model swaps.
  prompt: |
    You are a fork of this session, dispatched to implement Task N: [task name].

    You already hold the spec, the plan, and the outcomes of Tasks 1..N-1 in
    your history. Earlier dispatch messages in your history were addressed to
    other forks; only this message is yours. Do not act on any task but N.

    ## Requirements

    Read [BRIEF_FILE] first. It is the plan's exact text for this task; use
    its values (numbers, strings, signatures, test cases) verbatim. If your
    memory of the plan and the brief disagree, the brief wins — your context
    may have been compacted upstream.

    [OPTIONAL — one line per relevant ledger ruling, e.g.:
     Ruling from the ledger that binds this task: <ruling text verbatim>.]

    Work from: [directory]

    ## Your Job

    1. Implement exactly what the brief specifies — nothing more.
    2. Follow TDD where the brief says to: write the failing test, watch it
       fail, make it pass. Run the focused test while iterating; before
       committing, run the test files covering anything the change could
       plausibly break — usually the module's own. Run the full suite, lint,
       and typecheck only when this message says the review group is
       closing, or for a genuinely global change (a shared type, a config
       file, a build step, a public interface).
    3. Commit your work with a clear message.
    4. Self-review your diff (below), fix what you find.
    5. Write the report file, then return the short status contract.

    You know the design context, so questions should be rare. If the brief
    is genuinely ambiguous or contradicts the spec, do not guess: stop and
    return NEEDS_CONTEXT with the specific question. If the task turns out
    to need an architectural decision the plan did not make, or to require
    restructuring the plan did not anticipate, return BLOCKED. Bad work is
    worse than no work.

    ## You Do Not Dispatch Subagents

    Do all of this task's work yourself. Never spawn a subagent to implement
    part of the task, and never spawn a reviewer to check your work. Review
    is the controller's job. A reviewer you spawn duplicates that review at
    full cost, and its approval counts for nothing. Self-review means
    reading your own diff.

    ## Code Organization

    Follow the file structure the plan defines. One clear responsibility per
    file. If a file you're creating is growing beyond the plan's intent, stop
    and report DONE_WITH_CONCERNS rather than splitting it on your own. In
    existing code, follow established patterns; improve what you touch the
    way a good developer would, but do not restructure outside your task.

    ## Self-Review Before Reporting

    Completeness: everything in the brief implemented; edge cases handled.
    Quality: names say what things do; code is clean.
    Discipline: nothing beyond the brief (YAGNI); existing patterns followed.
    Testing: tests verify behavior, not mocks; TDD followed if required;
    test output pristine (no stray warnings).

    ## After Review Findings

    If a review finds issues, you will be resumed with the findings verbatim.
    Address every finding on its own terms: fix it, re-run the tests covering
    the amended code, and append a fix report to your report file — what
    changed, the covering tests, the command, and its output. If you think a
    finding is wrong, say so with your reasoning; never skip it silently and
    never make a cosmetic change that leaves the named defect in place.
    Reviewers do not re-run tests for you — the report is the evidence.
    Then reply with the same short contract.

    ## Report Format

    Write your full report to [REPORT_FILE]:
    - What you implemented (or attempted, if blocked)
    - What you tested and the results
    - TDD evidence if TDD was required: RED (command, failing output, why
      expected) and GREEN (command, passing output)
    - Files changed
    - Self-review findings, if any
    - Concerns, if any

    Then reply with ONLY (under 15 lines — detail lives in the file):
    - **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
    - Commits created (short SHA + subject)
    - One-line test summary, naming the command (e.g. "pytest
      tests/test_loader.py: 14/14 passing, output pristine")
    - Your concerns, if any
    - The report file path

    Every line of that reply is checkable, and the controller checks it: the
    SHAs must resolve, the report file must be on disk, the named test
    command must be the one you ran. If BLOCKED or NEEDS_CONTEXT, put the
    specifics in the reply itself. Never silently produce work you're unsure
    about.
```

## Placeholders

- `[BRIEF_FILE]` — REQUIRED: from `scripts/task-brief PLAN_FILE N`. Kept
  even though the fork "knows" the plan: it is the reviewer's shared
  reference and the fork's grounding after any upstream compaction.
- `[REPORT_FILE]` — REQUIRED: `<workspace>/task-N-report.md`, named after
  the brief.
- `[directory]` — the worktree the work happens in.
- Ledger rulings — OPTIONAL, verbatim, one line each. Only rulings that
  bind THIS task; the fork can read the ledger for the rest.

## Batched variant (several small same-shape tasks)

Same template. `[BRIEF_FILE]` becomes the list of brief paths, in order, and
the task line reads "Implement Tasks N–M as one batch". One report file
named after the first task. The reviewer checks the diff against each brief
file by file.

## Group-closing variant (last task of a review group)

Same template, plus this line after Your Job:

```
    This task closes review group [GROUP]. After committing, run the full
    suite, lint, and typecheck once, and record the commands and results in
    your report.
```

## Fix-fork variant (group-review fixes, fix rounds 4–5, or after a fork dies)

Same template, with Your Job replaced by:

```
    ## Your Job

    A review of [SCOPE] left these findings open — [R] fix attempt(s) so far;
    you own them now. Read the report file(s) for what was built and what
    was tried: [REPORT_FILES]. The findings, verbatim:

    [OPEN_FINDINGS]

    Address every finding on its own terms, re-run the tests covering the
    amended code, commit, and append a fix report to the first file in
    [REPORT_FILES]: what changed, the covering tests, the command, and its
    output. Reply with the short contract.
```

Placeholders for this variant:
- `[SCOPE]` — "Task N", "review group <name> (Tasks N–M)", or "final review"
- `[R]` — fix rounds already attempted (0 for a group review's round 1)
- `[REPORT_FILES]` — the report file(s) covering the scope, in task order;
  fix reports are appended to the first
- `[OPEN_FINDINGS]` — the open Critical/Important findings, verbatim, one
  per bullet

Rounds 4–5 keep the fork on the session model (cache) and raise the
session's `/effort` one step for that dispatch, restoring it after the
round; note both in the ledger line.
