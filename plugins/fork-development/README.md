# fork-development

One skill, `fork-driven-development` (FDD): execute a `superpowers:writing-plans`
plan by dispatching each task to a **forked** subagent (`subagent_type: fork`,
Claude Code 2.1.232 or later). The fork inherits the controller's conversation,
effort level, and prompt cache, so it starts already knowing the spec, the
plan, and the outcomes of earlier tasks. Fresh, non-fork reviewers gate the
work at sparse checkpoints: each risky task, each review group, and the whole
branch at the end.

The skill is self-contained: setup, triage, the review cadence, the fix loop,
and the finish are all in `SKILL.md`. It depends on superpowers only for the
skills it hands off to (`writing-plans`, `using-git-worktrees`,
`requesting-code-review`, `finishing-a-development-branch`,
`test-driven-development`).

## Install

The plugin is listed in this repo's `.claude-plugin/marketplace.json`.

## Invoke

In a **fresh** session (see Session Hygiene in the skill), after the plan
exists:

```
Use fork-driven-development on docs/superpowers/plans/<plan>.md
```

Set `/effort` before Task 1; the skill records it in the ledger and forks
inherit it. If the brainstorm happened in the same session, the skill will ask
you to `/clear` first.

## Compared to the siblings

| | subagent-driven-development | team-driven-development | fork-driven-development |
|---|---|---|---|
| Implementer | fresh subagent, briefed per task | persistent teammate per domain | fork per task, inherits session context |
| Implementer model | chosen per task | Sonnet/Haiku | session model (inherited) |
| Cost dial | model per dispatch | model per worker | `/effort` on the session |
| Review cadence | every task | risky tasks, then per domain | risky tasks, then per review group |
| Parallel implementers | no | disjoint domains | no |

## Measuring it

The ledger records timestamps, tiers, fix rounds, and forks that asked for
context they should have had. To compare against a sibling on the same plan:
two worktrees from the same base commit, one run each, fresh session for each,
same session model and reviewer models. Then collect:

| Metric | Where |
|---|---|
| Wall-clock start → finish | ledger `started` / `finished` |
| Per-task elapsed | `dispatched` → `complete` timestamps |
| Reviews and fix rounds | ledger footer |
| Findings parked at the breaker | ledger footer |
| Forks asking for known context | `fork asked for known context` lines |
| Tokens and cost | `/usage` after the run |
| Controller context at finish | `/context` |
| Final review: Critical/Important count | final review report |
| Your own interventions | count them by hand |

A single plan is a pilot, not a verdict.

## What to expect to go wrong

- Forks re-reading a large prefix each turn: cheap via cache, but the window
  they have left for work shrinks. Keep the controller lean.
- Compaction mid-plan: forks inherit the summary. The brief file and ledger
  are the guards; if a fork's output contradicts the plan, check whether the
  controller compacted just before that dispatch.
- Effort changes mid-plan invalidate the cache on most models. The skill
  allows one, for fix rounds 4–5.
- Fork drift onto other tasks in its history. The template forbids it; watch
  for it anyway on the first plan.

## Layout

```
fork-development/
  .claude-plugin/plugin.json
  README.md
  skills/fork-driven-development/
    SKILL.md
    fork-implementer-prompt.md   # implementer fork; batched, group-closing, fix-fork variants
    reviewer-prompt.md           # risky-task or group review (general-purpose, named model)
    re-review-prompt.md          # scoped re-review of one fix round
    scripts/fdd-workspace        # per-plan workspace under .superpowers/fdd/
    scripts/task-brief           # extract one task's text to a brief file
    scripts/review-package       # commit list + stat + diff for a reviewer
```
