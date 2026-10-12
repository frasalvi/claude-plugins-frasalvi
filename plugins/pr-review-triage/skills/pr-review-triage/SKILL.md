---
name: pr-review-triage
description: Use when addressing review comments on a pull request, especially from bots like Codex or Copilot whose claims can be wrong or irrelevant to how the code is actually used, or when merging a reviewed PR and cleaning up the branch afterwards. Triggers on "review/triage/address the PR comments", "review comments by Codex", "merge the PR, sync and cleanup".
---

# PR Review Triage

Review comments are claims to check against the code, not orders. Roughly a third of bot comments don't survive verification, and a dismissal backed by evidence is as good an outcome as a fix. Do the whole triage yourself in this session.

## 1. Fetch

`gh api` fills `{owner}/{repo}` from the current checkout. Pull all three surfaces in one call:

```bash
gh api repos/{owner}/{repo}/pulls/N/comments --jq '.[] | "### `\(.path):\(.line // .original_line)` — @\(.user.login) @ \(.commit_id[0:7])\n\n\(.body)\n"'
gh api repos/{owner}/{repo}/pulls/N/reviews --jq '.[] | select(.body != "") | "### review — @\(.user.login) (\(.state)) @ \(.commit_id[0:7])\n\n\(.body)\n"'
gh api repos/{owner}/{repo}/issues/N/comments --jq '.[] | "### comment — @\(.user.login)\n\n\(.body)\n"'
```

- If the user named a reviewer ("by Codex"), keep only that reviewer's comments.
- If a comment's commit is older than `HEAD`, check whether a later commit already handles it before you triage it.
- Copilot's quota-exhausted notice is not a review.
- Don't guess how old the PR is or whether bots have run yet. The fetch shows what exists.

## 2. Verify and decide

For each comment, open the cited code and check the premise. Then ask whether the problem can happen in this project as it runs today. Facts the bot can't see often decide it: a frozen sweep, an unsupported platform, a flow users never take, a spec that's out of scope.

| Verdict | When |
|---|---|
| **Fix** | Reachable in today's flow and causes a crash, wrong data, or a silently wrong number. Also cheap, clear fixes to real defects. |
| **Dismiss: wrong** | The premise is false. Cite the code that shows it. |
| **Dismiss: already fixed** | A commit after the reviewed one handled it. Cite the commit. |
| **Dismiss: unreachable** | It needs a regression, an unsupported setup, or a flow that doesn't happen. Name the constraint. |
| **Defer** | Real, but too large for this PR. Draft a follow-up issue. |

Every verdict carries evidence: file:line, a repro, or data. If a verdict depends on a fact about the project you can't establish from the code, ask the user one focused question instead of guessing.

## 3. Checkpoint, or act

- **The invocation states a fix policy** (for example "only real bugs, not hypotheticals", "aggressively", "ignore comments on X"): apply it and go straight to step 4. Report the verdicts with the fixes.
- **Otherwise:** end your turn on the verdict table (`# | file:line | reviewer | verdict | evidence`), with a one-line summary such as "5 fix, 2 dismiss (#3 unreachable: sweeps are frozen)". Then wait for the user's verdict changes.

## 4. Fix

1. Make the smallest change that addresses each verdict. If behaviour changes, add a test.
2. Run the project's full verification suite (tests, lint, typecheck, pre-commit) before committing.
3. Make one or two commits following the project's conventions, then push to the PR branch. Never force-push.
4. Report one line per fix and per dismissal, with commit SHAs.

Leave the PR conversation and the PR description to the user. Don't offer memory notes.

## 5. Close out (when asked to merge / sync / clean up)

Keep it terse. The user wants this done in few tokens.

1. Run `gh pr checks N`. Wait if checks are pending. Stop and report if any check fails.
2. Run `gh pr merge N --rebase --delete-branch`. Use a merge commit only if the repo's own instructions say so, and never squash.
   - If it prints "Not possible to fast-forward", only the local update failed. Confirm with `gh pr view N --json state`.
3. Run `git switch main && git pull --ff-only && git fetch --prune`.
   - If local `main` has diverged, compare it with `origin/main`. Reset to `origin/main` only if nothing would be lost. Otherwise show the user the diff.
4. Delete the local branch. After a rebase merge, `git branch -d` refuses because the SHAs changed. If every line of `git cherry main <branch>` starts with `-`, use `git branch -D`.
5. Remove the PR's worktree, stop any dev servers you started, and delete scratch files.
6. Verify that `git status` is clean and that `main` equals `origin/main`. Report in one or two lines, and include anything the user still has to do.
