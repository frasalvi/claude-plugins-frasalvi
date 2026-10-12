---
name: team-driven-development
description: Use when executing an implementation plan in the current session, especially one with several tasks sharing code areas, or when the user picks "teammate-driven" at the execution handoff.
---

# Team-Driven Development

You lead. Persistent worker teammates build the plan's code, one worker per code domain, and you hold the plan, the spec and the line to your human partner. Workers ask, you rule; one whole-branch review checks the work before anything expensive and again at the end. Runs and experiments stay with you and your human partner.

**Your partner may not read messages mid-run.** Say things once and plainly, at the moments listed under Talking to Your Partner. Don't narrate between tool calls.

## Kickoff

1. **Offer to compact.** If the plan was written in this session and the context has not been compacted since, your first reply is: "Before I start: `/compact` now would cut the cost of the whole run. Compact, or go ahead?" End your turn. Proceed when they answer either way.
2. **Read the plan and the spec.** Run `gh issue list` once.
3. **Sort the tasks** (below), segment the build tasks into domains, and note which tasks are runs.
4. **Pre-flight.** Collect, in ONE batched question, anything that blocks execution: tasks that contradict each other or the spec, values the plan states that the repo contradicts, and unclear domain boundaries. If nothing blocks, don't ask.
5. **Set up.** Create the feature branch or worktree (superpowers:using-git-worktrees). Run `scripts/team-workspace PLAN_FILE` from this skill's directory; it prints the workspace path. Write the ledger. Spawn the first worker.

## Sorting the Tasks

| Kind | What it is | Who does it |
|---|---|---|
| **Build** | Writing or changing code and its tests. | The domain's worker. |
| **Small** | A config tweak, rename or one-liner whose full text is in the plan. | You, inline. The whole-branch review covers it. |
| **Run** | Anything that spends money, touches a live system (API calls, browser, device, deployment), takes more than a few minutes, or needs your partner's go-ahead. | You, with your partner. See Runs. |

Mark a build task **design-heavy** when the brief leaves real design choices open and a wrong choice would be costly to unwind: a new architecture or shared interface, stateful or concurrent logic, a non-trivial algorithm. A task whose brief already fixes the content, such as prompt text or rules given verbatim, is not design-heavy, however important. A design-heavy task starts with an approach plan (Dispatching). Most plans have one or two.

## Domains and Workers

A domain is a group of build tasks that share files, interfaces or knowledge. One worker per domain, named by the domain (`data-pipeline`, `react-frontend`), never by number.

- **A worker needs at least three tasks.** Fold a smaller group into the neighbouring domain, or give its tasks to a one-shot subagent from the same worker prompt. Persistence pays when a worker carries knowledge across tasks; a worker with one task onboards and then sits idle.
- **At most three workers in a plan.** Most plans need one.
- **Dependent domains run in sequence.** The next worker reads the previous worker's journal.
- **Disjoint domains may run in parallel** only when no file is shared, each worker has its own worktree on its own branch, and you merge each branch back. Without separate worktrees, run them in sequence: workers in one checkout sweep up each other's files.
- **Model:** Sonnet, named explicitly in the spawn call. Teammates don't inherit your model. Don't use Haiku for workers.
- **Lifetime:** a worker stays until the whole-branch review is clean, so findings go back to the worker who wrote the code. Compaction is normal; replace a worker only for behaviour: repeated errors, contradicting its own journal, looping.

Spawn from [worker-prompt.md](worker-prompt.md).

## Dispatching

1. `scripts/task-brief PLAN_FILE N` writes the task's brief and prints its path. The brief is the requirements.
2. Send the worker a short message:
   - the brief path, and the report path (`task-N-brief.md` → `task-N-report.md`);
   - facts the brief can't know: interfaces and rulings from earlier tasks;
   - the plausible-but-wrong approach, when you can see one, with why it looks right;
   - for a design-heavy task: "send me your approach in about 15 lines and end your turn before writing code."
3. Add only facts you have checked against the repo or the data. When you restate a value from memory, the dispatch note becomes the thing that's wrong.
4. One task per worker at a time. Send the next task once the current one is accepted.

**Approach plans.** Read the approach against the spec and the code it touches. Approve it, or correct it with the reason. This is where design mistakes are cheapest to catch.

## Answering Worker Questions

Workers message you when the brief is ambiguous, the code contradicts it, a decision reaches outside their territory, or they are about to deviate. This is the correctness core of the skill.

- **Rule** when the answer follows from the plan, the spec, the code or ordinary engineering judgment within the plan's intent. Check the code or data before you rule.
- **Ask your partner** when the plan or spec is wrong or silent on something with consequences beyond the task, when scope, external interfaces or dependencies change, or when results need their judgment.
- Answer completely in one message. Record each ruling in the ledger.

## When a Worker Reports

Workers report `DONE`, `DONE_WITH_CONCERNS` or `BLOCKED`, in a message under ten lines that names the commits, the test command and the report path.

- **Check it:** the SHAs resolve, the report file exists, and the named test command appears in it with output. Open the report itself only when a check fails or the worker raised a concern.
- **DONE:** record it and send the next task. After the domain's last task, tell the worker the domain is closing; that is its cue for one full suite, lint and typecheck run.
- **DONE_WITH_CONCERNS:** read the concerns. Correctness or scope concerns get resolved before the next task.
- **BLOCKED:** the task needs splitting, the plan is wrong, or the environment is broken. Restructure, or ask your partner. A worker that reports BLOCKED without having asked anything goes back to ask its question.

## Runs

A run spends money, touches a live system, takes long, or needs your partner's go-ahead. You run it, with your partner; never hand a run to a worker.

1. **The worker prepares it.** The build task that precedes a run ends with the exact command, its expected cost and duration, and a dry run or a small-sample run where one is possible.
2. **Review first.** The first run that spends money or touches a live system waits for a clean whole-branch review (Reviews).
3. **Ask once.** State what the run does, its cost and how long it takes. Ask for the go-ahead once and wait. Don't repeat the request.
4. **Run it in the foreground or under Monitor**, never as a background job you might not see finish. Give your partner an ETA.
5. **Report the result:** recompute the headline numbers from the raw output with a separate command before presenting them. Give your read of what they mean and the options you see, then stop for your partner's decision. The next run waits for it, even when the plan lists it next.

**When results start driving the next change**, the rest of the plan is provisional and the work is exploratory. Work with your partner step by step: they decide the next move, you make it. A worker may stay for code changes, sent one at a time as tasks.

## Reviews

One reviewer, on Opus: your partner's standing choice for this review. It checks the whole branch from `git merge-base main HEAD`.

- **When:** before the first run that spends money or touches a live system, and after the last task. If code lands after the first review, the end review covers only that code (BASE = the head the first review saw).
- **How:** `scripts/review-package PLAN_FILE BASE HEAD` writes the package and prints its path. Dispatch the reviewer from [reviewer-prompt.md](reviewer-prompt.md) with the package path, the brief and report paths, the plan's Global Constraints verbatim, and the ledger's rulings.
- **No per-task reviews.** Your partner can ask for a review of a specific task at any time; use the same template on that task's BASE.
- **Don't pre-judge:** never tell the reviewer what not to flag, and never pre-rate a finding.

### Fixing findings

Critical and Important findings go to a fix loop of at most **three rounds**. Minor findings are listed in your end report for your partner to pick from, and are never fixed in the loop.

1. Forward the findings **verbatim** to the worker that wrote the code. A finding that conflicts with the plan's text goes to your partner first, with the plan text.
2. The worker fixes, re-runs the covering tests and appends the results to the report.
3. If the fix changes logic, dispatch a scoped re-review from [re-review-prompt.md](re-review-prompt.md) on `review-package PLAN_FILE FIX_BASE HEAD` (Sonnet, or Haiku for a small diff). If it only changes tests, docs or wording, check the diff yourself.

After round 3, or if the worker is gone, adjudicate each open finding: reviewer wrong or the point contestable → park it with your ruling; real but nothing depends on it → park it and list it in the end report; real and load-bearing → stop and tell your partner what was tried.

## Talking to Your Partner

Your partner may read only some of what you write. Tell them:

- **at kickoff:** the domains, the workers and the runs you expect;
- **when you ask something:** one question batch, then wait;
- **when a run starts:** what it is, its cost and ETA;
- **when a run finishes:** the results, then stop;
- **when a status question arrives:** one line from ground truth (git log, report files, the ledger);
- **at the end:** what shipped, the review result, parked findings and Minor findings.

**Teammate traffic gets no reply line.** Idle notices fire at every turn end, and a teammate's message may cross yours. Handle them silently: check ground truth (git log, the report file) and act on what it shows. Never answer a message that crossed with your newer dispatch; the teammate already has the newer one. Never send a check-in on an idle notice: a check-in costs the worker a turn, and its message lands only when that turn ends anyway.

**Keep your own context small.** Everything you read stays for the rest of the session. Work from status lines and the review's verdict; open reports, diffs and journals only when something needs your judgment. Hand artifacts to agents as file paths.

## How Messages Work

A teammate reads its inbox only when it ends its turn. A message to a working teammate waits until it finishes. So: anything a worker must know before acting belongs in the brief or the task message; you can't steer a running worker, so correct against its diff; batch what you send.

## Ledger and Journals

Both live in the workspace (`<repo-root>/.superpowers/team-dev/<plan-basename>/`, git-ignored).

- **Ledger** (`progress.md`), yours. First line: `# Team-dev ledger — plan: <plan file path>`. A ledger naming a different plan belongs to another run: leave it and start your own. It holds the roster (worker, model, domain, BASE, live or shut down), the task kinds, one line per accepted task, rulings, review results, parked and Minor findings. Update it at those milestones, not in between. After compaction or a resume, trust the ledger and `git log` over memory.
- **Journals** (`journal-<domain>.md`), the workers'. Each worker keeps its own current after every task. You pass journal paths to successors and never read the content yourself.

## When a Worker Dies

A session limit or crash leaves a worker gone mid-task.

1. Spawn a replacement for the domain from the same prompt, adding the dead worker's journal, the domain's report files and `git log --oneline BASE..HEAD`.
2. Tell it to inspect the uncommitted draft (`git status`, `git diff`) against the brief: keep and finish it if it fits the brief and its tests pass; otherwise discard the draft and redo the task.
3. Ledger: `Task N: worker died; draft kept|discarded; redispatched to <name>`.

If a quiet worker might be dead, check ground truth first, then send one short probe. No reply by its next idle notice means dead.

## Finish

1. Shut each worker down once the review is clean: `SendMessage` with `message: {type: "shutdown_request", reason: "…"}`. Confirm its journal is on disk first. Don't wait for a confirmation that doesn't come: if the worker has gone idle after the request, mark it shut down.
2. Delete this plan's workspace directory (only this plan's).
3. Hand off to superpowers:finishing-a-development-branch.

Workers don't survive a session resume. On resume, spawn fresh workers from the ledger and journals.

## Red Flags

| Thought | Reality |
|---|---|
| "I'll have the worker run the paid job" | Runs are yours, with your partner, after review. Background jobs launched by workers finish into silence. |
| "This small task deserves its own worker" | Fewer than three tasks: fold it, or use a one-shot subagent. |
| "I'll tell my partner that idle notice was stale" | Teammate traffic gets no reply line. They may not read it, and it buries what matters. |
| "Let me check in, it's been quiet" | Check git log and the report file. A check-in costs the worker a turn. |
| "The reviewer found Minor issues, let's fix them while we're here" | Minor goes to the end report. Fixing it in the loop causes regressions and extra rounds. |
| "I'll ask for the go-ahead again to be safe" | Ask once and wait. |
| "The plan is silent, but the sensible reading is obvious" | Silent plan plus consequences beyond the task means asking your partner. |
| "Round 3 and still failing, the reviewer must be wrong" | Adjudicate each finding on its merits at the cap, not before. |
| "The worker died, I'll finish its draft myself" | A replacement inspects the draft and keeps or discards it, and the domain keeps one owner for the review's findings. |

## Integration

- superpowers:writing-plans: creates the plan (standard format).
- superpowers:using-git-worktrees: the feature worktree, and per-worker worktrees for parallel domains.
- superpowers:test-driven-development: workers follow it.
- superpowers:finishing-a-development-branch: after the review.
- If this session has no SendMessage tool, use superpowers:subagent-driven-development; plans are format-identical.
