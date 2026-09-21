---
name: fork-driven-development
description: Use when executing an implementation plan in a session that already holds the spec and plan, and the harness offers forked subagents (subagent_type fork)
---

# Fork-Driven Development

Execute a plan by dispatching each task to a **forked** subagent. A fork
starts with everything you know — spec, plan, this skill, the ledger, and the
short reports of earlier tasks — via prompt-cache sharing, so it needs no
onboarding. Fresh, non-fork reviewers gate the work at sparse checkpoints so
review keeps independent eyes. You coordinate; you never implement or fix.

**Narration:** between tool calls, narrate at most one short line — the
ledger and the tool results carry the record.

**Continuous execution:** do not pause to check in with your human partner
between tasks. The reasons to stop: a BLOCKED status you cannot resolve, a
decision that is genuinely theirs (plan conflicts, scope or interface changes
the spec does not pin down), results they need to see (validation results,
benchmark numbers), or all tasks complete.

## When to Use

- A plan exists (from superpowers:writing-plans) and **the spec and plan were
  read in this session** — that is what the forks inherit.
- The harness offers `subagent_type: fork` (Claude Code 2.1.232 or later).
  Without it, use team-development:team-driven-development or
  superpowers:subagent-driven-development — plans are format-identical.
- Tasks are sequential or lightly coupled. Never dispatch two implementer
  forks in parallel; they would conflict in the same worktree.
- Not for plans whose tasks each need deep exploration of an unfamiliar
  subsystem that every fork would repeat; that is the case for a persistent
  domain worker (team-development).

## Roles

| Role | Runs as | Model | Effort | Lifetime |
|---|---|---|---|---|
| Controller (you) | Main session | Session model | Session level | Whole plan |
| Implementer fork | `subagent_type: fork` | Session model (inherited; a `model:` override is ignored) | Session level (inherited) | One task, resumed for fix rounds 1–3 |
| Fix fork | `subagent_type: fork` | Session model | Session level; one step up for rounds 4–5 | One fix wave |
| Reviewer | `general-purpose` subagent | Sonnet; Haiku only for a small mechanical diff | See Model and Effort | Per review (risky task or group) |
| Re-reviewer | `general-purpose` subagent | Sonnet or Haiku, scaled to the fix diff | See Model and Effort | Per fix round |
| Final whole-branch reviewer | `general-purpose` subagent | Most capable tier (Opus), always | See Model and Effort | Once |

Implementers are forks because they benefit from inheritance: the design
context arrives free through the cache. Reviewers are ordinary subagents
because they benefit from fresh eyes: a forked reviewer shares your priors and
the implementer's. Do not invert this.

**You coordinate; you do not implement.** Your context is every future
fork's prefix, and code you write dodges review. Your only edits are the
ledger.

## Session Hygiene

Every fork's context begins as a copy of yours. Two consequences:

1. **Start execution from a lean session.** The ideal fork prefix is: spec,
   plan, this skill, the ledger. Not the brainstorm that produced them. If
   this session contains the brainstorm, tell your human partner before
   Task 1: "For fork efficiency I recommend `/clear`, then re-invoke this
   skill with the plan path; I will re-read spec and plan." Proceed in the
   current session only if they decline.
2. **Keep your own context small during execution.** Read reports and
   review verdicts, never diffs or changed files. Hand artifacts over as
   files; messages carry paths and short statuses. Every token you add is a
   token every later fork re-reads.

Compaction: if your context compacts mid-plan, later forks inherit the
summary, not the originals. That is why the brief file stays the
requirements authority and the ledger stays the progress authority. After
compaction or resume, trust the ledger and `git log` over your recollection.

## Setup

1. **Worktree.** Use superpowers:using-git-worktrees to create or verify an
   isolated workspace. Never implement on main/master without explicit
   consent.
2. **Workspace.** Run this skill's `scripts/fdd-workspace PLAN_FILE`. It
   prints the plan's git-ignored directory
   (`<repo-root>/.superpowers/fdd/<plan-basename>/`), home to this plan's
   ledger, briefs, reports and review packages. Another plan's directory is
   never yours to read or write. `git clean -fdx` destroys it; recover from
   `git log`.
3. **Ledger** at `<workspace>/progress.md`, first line
   `# FDD ledger — plan: <plan file path>`. If a ledger whose first line
   names your plan already exists: tasks with a `Task <N>: complete` line
   are done — never re-dispatch them; a task whose last line is a fix round
   is mid-loop — resume at the next round; resume at the first task without
   a complete line. A ledger naming a different plan is another plan's
   progress: leave it and start your own.
4. **Read the plan once; read the spec it names.** The spec is the authority
   the plan argues from; conflicts inside the plan resolve against it. Note
   the plan's Global Constraints. A plan with no reachable spec gets a
   ledger note saying so — rulings made without one are provisional.
5. **Pre-flight conflict scan.** The output is a table, not a verdict. One
   row per pair of tasks that share a file or an interface: the two tasks,
   what one produces against what the other consumes, and what you found.
   One row per task: whether its own text agrees with itself — the tests it
   specifies against the code it specifies, the files it creates against
   the files it later touches. Also flag anything the plan explicitly
   mandates that the review rubric treats as a defect (a test that asserts
   nothing, verbatim duplication). "The scan is clean" without those rows is
   not a scan you ran. Write the table to the ledger.
6. **Segment and triage** (next section). Write the review groups and tiers
   to the ledger.
7. **One batched question.** Present every pre-flight finding, ruling you
   need, and segmentation doubt to your human partner as ONE question
   before Task 1. Record each ruling in the ledger beside its row. If the
   scan is clean and segmentation is obvious, proceed without comment.
8. **Metrics header** in the ledger:

   ```
   ## Metrics
   session model: <model>; /effort: <level>; started: <ISO-8601 UTC>
   ```

## Review Groups and Task Triage

Reviews are sparse: the default review unit is a **review group**, not a
task. At plan read, segment the tasks into groups — contiguous runs of tasks
that share files, interfaces, or knowledge, the same pairs the pre-flight
scan surfaced. A flat plan with twenty tasks normally has three to six
groups. YOU decide the grouping; the plan won't. Record each group's name,
task range, and BASE commit in the ledger when the group starts.

Then triage every task into a tier. This decision is yours, per task.

| Tier | Signals | Handling |
|---|---|---|
| **Batched** | Several small, independent edits of the same kind — the same one-line fix, constant change, or field addition across files | ONE fork dispatch carrying every brief; reviewed as part of its group |
| **Standard** | Everything else — the default | One fork; no per-task review, ships on its tests and self-review until the group review |
| **Risky** | New architecture, shared interfaces, anything you are uncertain about | One fork; its own review on DONE (always Sonnet) in addition to the group review |

Triage honestly. When in doubt, it is standard. There is no trivial-inline
tier: you never edit code.

## Model and Effort

Effort is set on the session with `/effort` (levels `low`, `medium`,
`high`, `xhigh`, `max` depending on the model), and a fork inherits the
session's model, permission mode, and effort level. Ordinary subagents run
at the session level unless their agent definition's frontmatter sets
`effort`. There is no per-dispatch effort parameter.

- **Implementer and fix forks: session model, session effort. Never pass
  `model:`.** The harness ignores it for forks, and a fork on another model
  could not read your cache. `/effort` is the implementer's only dial: set
  it before Task 1 and record it in the ledger. `high` is the default for
  work from a prose plan; `medium` when the plan contains the code to write
  and the task is transcription plus tests.
- **Do not change effort per task.** On most models each effort level has
  its own cache, so a change makes the next fork re-read the whole prefix
  uncached. (On Fable 5.1 with an API key or Claude subscription, effort
  changes keep the cache.)
- **Fix rounds 4–5: one step up** (`high` → `xhigh`), restored after the
  round, both recorded in the round's ledger line. That is the one
  sanctioned mid-plan change, and it costs an uncached prefix read on most
  models — which is why it is reserved for a loop that survived three
  resumes.
- **Reviewers: always name the model.** They are ordinary spawns; an omitted
  model inherits the session's. Sonnet for reviews and risky-task reviews,
  Haiku only for a small mechanical diff or a small fix diff, Opus only for
  the final whole-branch review. Their effort is the session level unless
  you define reviewer agents in `.claude/agents/` with `effort:`
  frontmatter; if you do, `high` for reviews, `medium` for re-reviews,
  `high` for the final review. A reviewer's model or effort never touches
  your cache — a non-fork subagent builds its own prefix.

## The Task Loop

For each task in plan order:

### 1. Dispatch the fork

- `BASE=$(git rev-parse HEAD)`; record it — a risky task's review package
  needs it, and every task's completion line names it.
- `scripts/task-brief PLAN_FILE N` → brief path. Report path is the brief
  path with `-brief.md` → `-report.md`. For a batched dispatch, one brief
  per task, one report named after the first.
- Ledger: `Task <N>: dispatched <ISO-8601 UTC> (tier <tier>, group <name>)`.
- Dispatch with [fork-implementer-prompt.md](fork-implementer-prompt.md).
  The prompt carries: task number and name, brief path, report path,
  working directory, any ledger ruling that binds this task, and — for the
  group's last task — the group-closing line. **Nothing else.** No
  scene-setting, no earlier-task interfaces, no pasted history — the fork
  has all of it. If you want to add context, that is a signal your session
  lost it; fix the brief or ledger instead.
- Record the fork's agent identity from the dispatch result; fix rounds 1–3
  resume it.
- Wait for the result; never dispatch the next task's fork meanwhile. While
  waiting, do local work — ledger, next brief. If the harness returns a
  partial result because the fork hit its turn limit, continue it with a
  message rather than re-dispatching.

### 2. Handle the report

**Verify the reply against ground truth first:** the SHAs it names must
resolve, the report file must exist, and the test command it claims must
appear in the report with its output. Claims that don't check out go back to
the fork with the specific mismatch.

- **DONE:** risky tier → task review (below). Otherwise → complete the task.
- **DONE_WITH_CONCERNS:** read the concerns. Correctness or scope concerns
  are resolved before proceeding (resume the fork with your ruling, or
  escalate); observations go to the ledger and are carried to the group
  review.
- **NEEDS_CONTEXT:** answer from the plan, the spec, or the codebase, and
  resume the same fork. Escalate to your human partner when the plan or spec
  is wrong or silent on something with consequences beyond the task — never
  answer by guessing. A fork asking for something that *is* in the shared
  context is a data point: ledger it as
  `Task <N>: fork asked for known context — <what>`.
- **BLOCKED:** assess: missing context (resume with it), plan defect (rule
  with the spec as authority, ledger the ruling, resume with it — plan
  conflicts that change scope are your human partner's call), task too
  large (split it, ledger the split). Never retry unchanged.

### 3. Review a risky task

`scripts/review-package PLAN_FILE BASE HEAD` (BASE from step 1, never
`HEAD~1`, which silently drops all but the last commit) → diff path.
Dispatch [reviewer-prompt.md](reviewer-prompt.md) with scope "Task N", the
brief path, the report path, the diff path, the global constraints, and an
explicit model. Findings enter the fix loop (Reviews, below) with the task's
fork as the fixer. Complete the task only when the review is clean or every
open finding is parked with a ruling at the cap.

### 4. Complete the task

Ledger, in one message with the rest of the bookkeeping:
`Task <N>: complete <ISO-8601 UTC> (commits <base7>..<head7>, <R> fix rounds | unreviewed)`.
Then the next task. When the task was the group's last, run the group review
before the next group's first dispatch.

## Reviews

- **Cadence.** Risky tasks are reviewed on their own diff on DONE. Every
  group is reviewed once, on `scripts/review-package PLAN_FILE GROUP_BASE
  HEAD`, after its last task. The final whole-branch review runs after the
  last group. With a single group, the final review IS that group's review.
- **Reviewer inputs:** the brief files in task order, the report files, the
  review package path, and the plan's binding Global Constraints copied
  verbatim — exact values, formats, and stated relationships between
  components. The template carries the process rules; the constraints block
  is for what THIS project's spec demands.
- **Do not pre-judge findings.** Never tell a reviewer what not to flag or
  pre-rate a finding's severity. If your dispatch contains "do not flag",
  "at most Minor", or "the plan chose" — stop; you are pre-judging to spare
  yourself a loop. Adjudicate at the cap, not before.
- A review returning only one of its two verdicts (spec compliance AND work
  quality) is incomplete — re-dispatch it.
- **⚠️ Cannot-verify items** are yours to resolve before the scope
  completes: you hold the plan and cross-task context the reviewer lacks. A
  confirmed gap enters the fix loop with the other findings.
- **Minor findings** go to the ledger as you go
  (`Task <N>: minor (deferred): <one-liner>`), never into the loop; the final
  review triages that list.
- **Plan-mandated findings** — or any finding that conflicts with the plan's
  text — are ruled on with the spec as the binding authority and ledgered
  before you act. A ruling that changes scope is your human partner's.

### The Fix Loop

Critical/Important findings and confirmed spec gaps start a bounded loop, at
most **five rounds** per review. A round is one fix dispatch plus one scoped
re-review.

1. **Forward the findings VERBATIM** — never paraphrase, summarize, or
   soften.
2. **The fixer.** For a risky-task review, rounds 1–3 resume the task's
   fork. For a group review or the final review, round 1 dispatches one fix
   fork with the complete open list (fix-fork variant of the implementer
   template) and rounds 2–3 resume it — a fork inherits the group's whole
   history, so it needs no onboarding. **Rounds 4–5** dispatch a fresh fix
   fork (same fix-fork variant: report files, open findings, and the
   "[R] fix attempt(s) so far; you own them now" framing), at one effort
   step up. Three failed attempts means the context that wrote the defect is the
   context that cannot see it.
3. The fixer re-runs the tests covering the amended code and appends a fix
   report to the report file. Before re-dispatching a reviewer, confirm the
   fix report names the covering tests, the command, and the output.
4. **Scoped re-review:** `scripts/review-package PLAN_FILE FIX_BASE HEAD`,
   FIX_BASE being the head the previous review saw, with
   [re-review-prompt.md](re-review-prompt.md) on a named model. It verdicts
   each finding ADDRESSED / NOT ADDRESSED and inspects the fix diff for new
   breakage; new Critical/Important breakage joins the open list;
   out-of-scope observations go to the ledger as deferred minors and never
   extend the loop.
5. Ledger: `<scope>: fix round <R>/5 (<X> addressed, <Y> open — <one-liners>; commits <a7>..<b7>; effort <level>)`.

Never fix findings yourself.

**The breaker.** When round 5's re-review still leaves findings open, stop
dispatching and adjudicate each open finding — you hold the plan and the
cross-task context the reviewer lacks:

- Reviewer wrong, or the point genuinely contestable → park it:
  `<scope>: parked — <finding> — Ruling: <why the code stands>`. The final
  review sees both sides.
- Real, but nothing downstream builds on it → park it the same way, with a
  ruling that says it's real and deferred.
- Real and load-bearing — a later task builds on it, or it reveals a plan
  defect → rule on the smallest change that unblocks the dependent work,
  ledger it as `<scope>: Ruling: <finding> — <what you decided and why>`,
  and carry it into the next dispatch. Parking a structural failure lets
  every dependent task build on it. STOP and report to your human partner
  only when the defect leaves every path forward a guess.

Adjudicate only at the cap; adjudicating earlier to end a loop is
pre-judging under a different name. Every adjudication is a ledger entry — a
silent discard is forbidden.

## Final Review

After the last group: `scripts/review-package PLAN_FILE MERGE_BASE HEAD`
(MERGE_BASE = `git merge-base main HEAD`), dispatched on the most capable
tier using superpowers:requesting-code-review's code-reviewer template, with
the ledger's deferred-minor and parked lines attached for triage.
`/code-review high` is an acceptable alternative if your human partner
prefers the native reviewer; note which was used in the ledger.

Point it at end-to-end execution paths, not just the diff. Group reviews are
diff-shaped and blind to bugs in the *relationship* between two individually
correct modules — ordering, lifecycle, who-calls-whom. Instruct it to trace
the system's core invariants through the real call path, reading upstream
source outside the diff where needed.

Findings → ONE fix fork with the complete list, then exactly one scoped
re-review. No second wave: residual findings are adjudicated as at the
breaker, and load-bearing ones surface to your human partner at finish.

## Finish

1. Ledger footer:

   ```
   finished: <ISO-8601 UTC>
   tasks: <N>; groups: <G>; reviews: <risky + group + final>; fix rounds total: <R>; parked: <K>
   forks asked for known context: <Q>; /usage snapshot: <paste or "ask human">; /context at finish: <tokens>
   ```

2. **Rulings I made.** Collect every ledger line containing `Ruling:` —
   pre-flight rulings, parked findings, breaker adjudications — into your
   final message, in order, each with what it costs if wrong. The list is
   exhaustive; a ruling that dies with the workspace was a decision made in
   secret.
3. Delete the plan's workspace (`rm -rf <workspace>`) once the final review
   is clean and its fixes are merged. Only this plan's directory.
4. Use superpowers:finishing-a-development-branch.

## Known Unknowns (ledger anything you see)

- Whether a resumed fork keeps the cache across the resume.
- How a fork behaves when the session prefix is large (>100k): window left
  for work, cost per turn.
- Whether forks drift onto other tasks visible in their history despite the
  "only this message is yours" instruction.
- Whether a fork ever reads the brief file (vs. only reviewers). If never, a
  later version can drop it for forks.

## Red Flags

| Rationalization | Reality |
|---|---|
| "The fork already knows, skip the brief" | The brief is the reviewer's reference and the compaction guard. One script call. |
| "Pass a cheaper model for this trivial task" | Ignored for forks, and it would kill the cache. Batch small tasks instead, or set `/effort` before Task 1. |
| "I'll add a little context to the dispatch" | Either the fork has it (waste) or you lost it (fix the ledger). Never both. |
| "Fork the reviewer too, it's cheaper" | Cheaper and blind: it shares your priors and the implementer's. Reviewers stay fresh, on a named model. |
| "Just fix this one line myself" | Your context is every future fork's prefix, and your edits dodge review. Dispatch. |
| "This standard task looked tricky — one quick review won't hurt" | Only risky tasks and groups get reviewed. Reviewing every task is what made the per-task workflow expensive. |
| "Bump effort for this hard task" | An effort change re-reads the whole prefix uncached on most models. One dial, set once; rounds 4–5 are the exception. |
| "I'll tighten these findings so the fork sees the point" | Forward verbatim. Every paraphrase drops the detail that made the finding checkable. |
| "Round 3 and still failing — the reviewer is probably wrong" | Adjudicate at the cap, not before. Rounds 4–5 go to a fresh fork one step up. |
| "The plan is silent, but the sensible reading is obvious" | An obvious reading is a guess. Silent plan plus consequences beyond the task equals escalation. |
| "The fix was small, skip the re-review" | Unreviewed fixes are how regressions land. Every round ends with a scoped re-review. |
| "Ledger bookkeeping is overhead" | The ledger is what survives compaction. Controllers without one have re-dispatched whole task sequences. |

## Prompt Templates

- [fork-implementer-prompt.md](fork-implementer-prompt.md) — dispatch an
  implementer fork; batched, group-closing, and fix-fork variants
- [reviewer-prompt.md](reviewer-prompt.md) — risky-task or group review
- [re-review-prompt.md](re-review-prompt.md) — verify one fix round
- Final whole-branch review: superpowers:requesting-code-review's
  code-reviewer template, on the most capable tier

## Integration

**Required workflow skills:**
- superpowers:writing-plans — creates the plan this skill executes
- superpowers:using-git-worktrees — feature worktree at kickoff
- superpowers:requesting-code-review — template for the final review
- superpowers:finishing-a-development-branch — after the final review

**Forks use:** superpowers:test-driven-development per task.

**Alternatives:** team-development:team-driven-development (persistent
domain workers, no fork support needed);
superpowers:subagent-driven-development (fresh briefed subagents, per-task
reviews).
