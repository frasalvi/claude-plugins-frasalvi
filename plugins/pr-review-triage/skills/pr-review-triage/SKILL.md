---
name: pr-review-triage
description: Use when addressing PR review comments — especially from bots like Copilot, CodeRabbit, or Greptile that can be wrong or out-of-scope. Triggers on "address the PR comments", "look at the Copilot review", "fix the review feedback on PR #N". Splits the work across two subagents (triager verifies; executor fixes), surfacing verdicts to the user in between so a wrong dismissal can be caught before any code changes.
---

# PR Review Triage

Reviewer comments are *suggestions to evaluate, not orders to follow*. Bots produce 20–30% noise; a 100% fix rate means you're not pushing back enough. A clean dismissal with evidence is a successful outcome.

Run as **two specialised passes with a user checkpoint in between**:

1. **Triage subagent** — fetches comments, verifies each against the actual code, returns verdicts.
2. **User checkpoint** (main agent) — surface verdicts so the user can redirect before any code moves.
3. **Executor subagent** — only spawned if there's at least one fix; applies, tests, commits.

The split exists because verification and implementation pull in different directions: a single agent verifying its own future work tends to rationalize fixes it half-wants to make. Keeping the executor blind to the original comment prose (it sees only the verdict + what to change) preserves that independence.

## Phase 1: Triage subagent

Spawn a read-only subagent (Read, Grep, Glob, plus Bash for `gh`). Give it roughly this brief — adapt the PR coordinates and any project-specific verification hints:

> Triage PR review comments on `<owner>/<repo>#<num>`.
>
> **Fetch comments as Markdown blocks** — much easier to read than JSON, and lets the user skim them too:
> ```bash
> gh api repos/<owner>/<repo>/pulls/<num>/comments \
>   --jq '.[] | "### `\(.path):\(.line)` — @\(.user.login) (id \(.id))\n\n\(.body)\n\n---"'
> ```
> Each comment renders as a section: file/line/author as the heading, the body as a paragraph, separator between entries. Append `\(.diff_hunk)` to the template if you want the diff context the reviewer was looking at.
>
> If the inline result is empty, also check review-level summaries:
> ```bash
> gh api repos/<owner>/<repo>/pulls/<num>/reviews \
>   --jq '.[] | select(.body != "") | "### review by @\(.user.login) (\(.state))\n\n\(.body)\n\n---"'
> ```
>
> For each comment, **open the cited file and verify the premise.** Bots pattern-match snippets against common bug shapes and sometimes get it wrong. Don't trust the reviewer's claim about what the code does — read the code.
>
> Return two things:
> 1. The raw Markdown-block dump from the fetch above (so the orchestrator can show the user what the reviewers actually said).
> 2. A verdict table:
>
> | # | File:line | Verdict | One-line rationale (with evidence) |
> |---|-----------|---------|------------------------------------|
>
> Verdicts:
> - **Fix** — Real issue, in scope for this PR.
> - **Dismiss — wrong** — Bug doesn't exist; reviewer misread. Cite the exact code that proves it ("`formatValue` at card.ts:101 only appends the unit when `unit === "%"`; for `"other"` it renders bare numbers").
> - **Dismiss — out of scope** — Real but already deferred (issue, design doc, PR description). Note where it lives.
> - **Defer** — Real and in-scope but too large for this PR — flag for a follow-up issue.
>
> Do not edit files. Do not commit. Do not push. You are a verifier, not a fixer.

## Phase 2: User checkpoint

When the triage subagent returns, relay both deliverables to the user — the raw comment dump (so they can sanity-check the triager's framing against what the reviewer actually wrote) and the verdict table — followed by a one-line summary:

> Of 7 comments: 5 to fix (#2–#4, #6, #7), 2 to dismiss (#1 deferred per PR description; #5 Copilot misread — verified at card.ts:101). Proceeding with fixes unless you push back.

Wait for the user. Wrong dismissals and scope disagreements surface here, before any code changes — that's the whole point of the gate. If everything triages to dismissal, report and stop; there's nothing for Phase 3 to do.

## Phase 3: Executor subagent

Only spawn this if there's at least one Fix verdict. Brief it with:

- **What to change**, not what the reviewer said — file:line + the verdict rationale. The original prose stays with the triager so the executor can't be talked into anything beyond the verdict.
- **Project verification commands** — lint, typecheck, full test suite. Check `package.json`, `pyproject.toml`, `Makefile`, or ask the user.
- **Project commit conventions** — Conventional Commits? Required trailers (co-author, sign-off)? Branch policy? The user's `CLAUDE.md`/memory and recent `git log` usually have these.

Then:

> Apply these fixes one at a time:
> 1. Smallest change that addresses the verdict. No drive-by refactors.
> 2. If the fix changes behaviour, add a test locking in the new behaviour. Doc/comment/label-only edits don't need tests.
> 3. Do not fix more than the verdict says. Scope creep is a failure mode — it's how a "fix one comment" turns into a 400-line diff that needs its own review.
>
> After all fixes are in:
> 1. Run the **full** verification suite (lint + typecheck + tests). A fix in one file can break a test elsewhere; only running new/changed tests misses regressions.
> 2. Commit in **logical groups** — typically 2–3 commits grouped by theme (e.g., backend fixes / harness fixes / docs). One mega-commit kills bisect and blame; one commit per fix is too granular and loses the grouping.
> 3. Push to the same branch. No force-push. No `--no-verify` / hook-skipping unless the user has explicitly authorized it.
>
> Report back: commit SHAs, test counts (before → after if any were added), one-line rationale per fix.

## Phase 4: Final report

Summarise what the executor did, plus the triager's dismissals:

- **Fixed** — one line each, with the verdict's rationale.
- **Dismissed** — each, with the evidence the triager captured.
- **Test counts** if they moved.
- **Commit SHAs** so the user can find the work.

**Don't reply in the PR thread by default.** The user owns that conversation; if they later want replies drafted, the verdict rationales are exactly what's needed.

## Anti-patterns

- **Skipping the subagent split** — running yourself blurs verification with implementation. You will rationalize fixes you wouldn't have agreed to as a verifier.
- **Triager doing the fixes** — independence matters. Two passes.
- **Executor seeing the original comments** — defeats the independence. Pass the verdict and the change, not the prose.
- **Blind implementation** — "reviewer said X, so X" without reading the code commits hallucinations into the codebase.
- **Mega-commit** — kills bisect and blame.
- **One commit per fix** — too granular; loses theme grouping; spams the history.
- **No pre-commit verification** — per-fix tests pass, something else broke.
- **Replying in the PR by default** — stay out unless asked; the user owns that thread.
- **Scope creep under cover of "the reviewer asked"** — they asked for a typo fix, not a rewrite.
- **Treating dismissal as failure** — a clean dismissal with evidence is success.
