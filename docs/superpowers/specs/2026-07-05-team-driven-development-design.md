# Team-Driven Development — Design

**Date:** 2026-07-05
**Status:** Approved

## Problem

The default plan executor (superpowers:subagent-driven-development, "SDD") is structurally token-expensive and structurally guess-prone:

1. **Re-onboarding cost.** A fresh subagent is dispatched per task and must rebuild codebase context every time, plus be re-told interfaces and decisions from earlier tasks.
2. **Review ceremony on trivial tasks.** Every task — including one-liners fully specified in the plan — gets a full implementer dispatch and a two-verdict review loop.
3. **Fire-and-forget workers.** Subagents can ask questions only before starting. Mid-task ambiguity ends in either a guess (correctness risk) or a BLOCKED report and a costly re-dispatch.

Claude Code's agent teams (persistent, addressable teammates with two-way messaging) enable a different execution shape. Community implementations of teams-based execution (superpowers issue #429: bok-'s skills, superpowered-teams, sharankarthikyan's fork) are all parallelism-first — built to run independent tracks concurrently. This design targets different goals.

## Goals

- **Token efficiency** through persistent workers that onboard to a code area once, and through a strong lead / cheap worker model split.
- **Correctness** through an ask-don't-guess protocol: workers defer decisions to the lead at the moment ambiguity arises; the lead escalates genuine spec-level decisions to the user.
- **Right-sized process**: the lead has discretion over what deserves a dispatch and a review, instead of fixed per-task ceremony.

**Non-goals:** parallelism as an end (limited concurrency falls out as a free scheduling choice); automatic worker respawn / context-rot detection (the user handles worker refresh manually if ever needed); wave/specialist-table machinery from the community implementations.

## Packaging

A new plugin **`team-development`** in the `claude-plugins-frasalvi` marketplace, alongside pr-review-triage, project-oversight, and research-companion. It is strictly additive to superpowers: it invokes superpowers skills (writing-plans upstream; requesting-code-review's reviewer template; finishing-a-development-branch downstream) but modifies none, so superpowers keeps auto-updating from the official marketplace.

Contents:

- `skills/team-driven-development/SKILL.md` — the executor skill (lead-side process)
- `skills/team-driven-development/worker-prompt.md` — worker spawn template (identity block, communication protocol, status contract, journal contract)
- `skills/team-driven-development/task-reviewer-prompt.md` — task reviewer template (adapted from SDD's, same two verdicts)
- `skills/team-driven-development/scripts/` — vendored copies of SDD's `task-brief` and `review-package` helpers. Vendored because referencing another plugin's scripts requires a version-pinned cache path that breaks on superpowers updates; the scripts are small and stable.

Config changes riding along (in the `.claude` config repo, synced across machines):

- Global `CLAUDE.md`: delete the "No git worktrees" rule; add a routing rule — after writing-plans, execute with `team-development:team-driven-development` when agent teams are available; fall back to `superpowers:subagent-driven-development` when they aren't or when the plan is a handful of trivial tasks (lead judgment, biased toward the team for anything multi-task). `superpowers:executing-plans` remains for the rare parallel-session case.

Out of scope, possible later siblings in the same plugin: watcher teammate (long-lived dev-server/test watcher), debugging pair (persistent instrumentation partner for systematic-debugging), design sparring partner (persistent devil's advocate for brainstorming).

## Architecture

### Roles and models

| Role | Runs as | Model | Lifetime |
|---|---|---|---|
| Lead | Main session | Session model (Fable/Opus) | Whole plan |
| Worker | Persistent teammate | Sonnet default; Haiku only when the domain's tasks are pure transcription of plan-provided code. Lead picks at spawn. | One context domain |
| Task reviewer | One-shot subagent | **Sonnet or Haiku only**, by diff size/risk | Per review |
| Final whole-branch reviewer | One-shot subagent | **Always Opus** | Once |

The economics: the expensive tiers appear exactly twice (lead, final review). A cheap worker plus an escalation hatch to a Fable/Opus lead behaves like a much smarter model — premium prices are paid only for judgment moments, not typing. Reviewers stay one-shot subagents deliberately: fresh eyes, no accumulated bias from watching the code get written.

### Context domains

At plan read, the lead segments the plan's tasks into **context domains** — groups sharing files, interfaces, or knowledge (usually the plan's existing phases). Plans stay in standard superpowers format; segmentation happens at runtime, so any plan remains executable by SDD or executing-plans on machines without teams. If the lead cannot tell whether two segments are independent, it asks the user once at kickoff (folded into the pre-flight question batch).

One worker per domain: spawned at domain start, shut down at domain end after writing its journal entry. Sequential domains hand off through the journal — the successor worker inherits exactly the interface knowledge that matters, nothing else. No mid-domain respawn logic exists in the skill; if the user observes a degraded worker they refresh it manually (journal + git log make a replacement cheap to seed).

### Worker identity

Workers are named by their domain (`data-pipeline`, not `worker-1`). The spawn prompt opens with an identity block covering both axes: **territory** (the domain's files/modules, its tasks end to end) and **expertise** — when the domain partition is technology-shaped, the role is named explicitly and the worker is instructed to act as that domain specialist ("you are the React specialist; act as a senior React engineer"); otherwise the role describes the subsystem ("you are the specialist for the training loop").

### Concurrency

Independent domains (no file overlap, no output→input dependency) may run concurrently: **max 2 workers, default 1, serialize when unsure**. Since each domain's worker onboards only to its own domain regardless, concurrency costs no extra tokens — it only buys wall-clock time. Constraints:

- **Strict file ownership**: one owner per file; shared types created by one domain, read-only for others. If ownership cannot be partitioned cleanly, the domains were not independent — serialize.
- **Worktree isolation**: concurrent workers each get their own git worktree branched off the feature branch; the lead merges each domain branch back at domain completion. Sequential execution uses the single feature worktree, no merging.
- Every active worker adds question traffic to the lead; the lead answering carefully is the correctness mechanism, which is the second reason for the cap of 2.

## Execution flow

**Kickoff:** lead reads the plan once; runs SDD's pre-flight check (contradictions, plan-vs-rubric conflicts → one batched question to the user); segments into domains and writes the domain map into the ledger; creates the feature worktree (standard superpowers flow); spawns the first worker(s).

**Per task, the lead triages into one of three tiers:**

- **Trivial** (config tweak, rename, one-liner fully specified in the plan): lead implements inline and commits. No dispatch, no task review; still covered by the final Opus review.
- **Standard** (default): task brief extracted to a file (`task-brief` script) and sent to the domain worker. Worker implements with TDD, self-reviews, commits, appends to its journal, reports status. Lead generates a review package (`review-package BASE HEAD`) and dispatches one task reviewer (Sonnet/Haiku by diff size and risk) for the two verdicts: spec compliance and code quality. Findings go back to the **same worker verbatim** — the lead never paraphrases (paraphrase drift is a correctness risk; the token cost is negligible). Fix → fresh re-review, until clean.
- **Risky** (architecture, shared interfaces, anything the lead is uncertain about): worker first messages back a short approach plan before writing code; lead approves or corrects (escalating to the user if the plan itself is in question), then the standard flow with a Sonnet reviewer.

**Status vocabulary:** `DONE / DONE_WITH_CONCERNS / BLOCKED`. There is deliberately no NEEDS_CONTEXT: with a live channel, missing information is a mid-task message, never an exit status. BLOCKED means "communication did not resolve this — the fix is structural" (task needs splitting, plan is wrong, environment broken). A BLOCKED report for information the worker never asked for is a protocol violation and gets pushed back.

**Finish:** all domains done → final whole-branch review on Opus (review package from merge-base) → if findings, ONE fix dispatch with the complete findings list → `superpowers:finishing-a-development-branch`.

## Communication rules

**Worker → lead, at the moment it arises:**
- The brief is ambiguous or contradicts the code it finds (two valid readings with different outcomes)
- An unexpected obstacle changes the approach (API not as described, broken test infra, dependency conflict)
- A decision has consequences beyond its territory: interface shapes others will consume, new dependencies, cross-domain conventions
- It is about to deviate from the brief for any reason, or discovers something that invalidates later tasks

**Worker decides alone:** anything internal to its territory and reversible (private helpers, local structure, test organization) and anything the brief explicitly delegates. Asking is never penalized; guessing on an ambiguous point is the failure mode.

**Lead → user:**
- The plan or spec is wrong, contradictory, or contradicted by a review finding (plan conflicts are always the human's call)
- The decision changes scope, external interfaces, or dependencies beyond what the spec pins down
- Resolution requires non-trivial re-planning (splitting or reordering tasks)

**Lead decides alone:** anything derivable from plan, spec, or codebase, and ordinary engineering judgment within the plan's intent. The lead runs on the strongest model precisely so this tier absorbs most worker questions.

## Artifacts

Two artifacts, deliberately kept apart; both live in the repo's git-ignored scratch dir (`.superpowers/team-dev/`):

- **Ledger** (lead's memory, the only bookkeeping in the lead's context): domain map plus one line per completed task (`Task N: complete, commits <base7>..<head7>, review clean`). Exists so lead compaction cannot lose plan state; after compaction, trust ledger + `git log` over recollection. Also records segmentation errors and Minor review findings for the final review to triage.
- **Journal** (workers' inheritance, one file per domain): written by the worker — after each task it appends files touched, interfaces/exports created, conventions established, gotchas. Read only by successor workers (the spawn prompt lists the journal paths of the domains this one depends on, "read these first") and by manual replacement workers. The lead handles only the path, never the content.

Task briefs, worker reports, and review packages follow SDD's file-handoff discipline: bulk content moves as files; only short statuses and paths cross the message channel.

## Failure handling

- Worker fails a task twice through review → lead stops the loop and escalates to the user with the findings. No third identical attempt; no automatic respawn.
- Worker dies / session interrupted → ledger + journal + `git log` are the recovery map; spawn a replacement worker seeded from them.
- Review finding conflicts with plan text → user's decision, never silently resolved.
- Concurrent-worker file conflict despite the ownership map → lead stops both, resolves ownership, reassigns; recorded in the ledger as a segmentation error.
- Cleanup: workers must confirm shutdown before `TeamDelete`; domain journals must exist on disk first.

**Lead red flags — never:**
- Implement a standard-tier task itself (triage said worker; context pollution)
- Paraphrase review findings (forward verbatim)
- Answer a worker question by guessing when the plan is silent — that is what user escalation is for
- Let a BLOCKED-without-asking report pass without pushback
- Run more than 2 workers, or run 2 without clean file ownership
- Skip the final Opus whole-branch review

## Testing approach

Manual, staged (the approach that worked for superpowered-teams): first a smoke run on a low-stakes multi-task plan, watching for protocol violations (guessing instead of asking, BLOCKED-without-asking, journal skipped); then adopt as default executor; iterate observed failures into the skill's red flags or structure. Skill-triggering is validated the superpowers way: a fresh session given a plan should route to this skill via the CLAUDE.md rule without being told.

## Deliverables

1. `team-development` plugin skeleton in `claude-plugins-frasalvi` (marketplace manifest entry, plugin.json)
2. `skills/team-driven-development/SKILL.md` (lead process: triage, domains, communication rules, failure handling, red flags)
3. `worker-prompt.md`, `task-reviewer-prompt.md` templates
4. Vendored `task-brief` / `review-package` scripts
5. `.claude` repo: CLAUDE.md routing rule added, worktree prohibition removed
