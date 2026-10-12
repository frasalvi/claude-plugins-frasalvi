---
name: project-oversight
description: Use when turning a 1-pager, brief or finished brainstorm into a project roadmap, when revising a roadmap (adding, removing, absorbing, reordering or re-cutting steps, recording decisions, updating status), when a step turns out too big for one cycle, or when deciding what to work on next. Triggers on "create a roadmap", "update the roadmap", "break down M4", "is this step needed", "what's next".
---

# Project Oversight

A roadmap cuts a project into steps, and each step is sized to how it will be worked. You decide WHAT each step delivers and in what order. HOW is decided inside the step, when it starts. Write no code, specs or implementation detail here.

## Sizing a step

Each step gets one of two sizes, and the roadmap labels it:

- **Cycle.** The step has real design decisions, so it runs one full superpowers cycle: brainstorming → spec → writing-plans → implementation. Implementation is optional for conceptual work.
- **Plan mode.** The step is well scoped but still deserves a reviewed plan. It runs as one Claude Code plan-mode session: plan, approval, then implementation in that session.

Two checks apply to every candidate step:

- **Is it smaller than a plan-mode session?** Then it is not a step. It may just be the output of another step, a sub-part of one, or a quick fix. Fold it into the neighbouring step, or do it in the session where it comes up.
- **Is it bigger than one cycle?** Its brainstorm would end in more than one spec, or its plan would cover independent deliverables. Split it at the seam between those deliverables.

Every split needs a reason: a separate decision, risk or deliverable that the other steps don't cover. When you propose a breakdown, say what you folded together and why, and label each step **Cycle** or **Plan mode**.

## Scope lazily

Only the next step needs detail. A later step is one line in the Work column, and its sub-parts, manuscripts and release packaging are decided when it starts. Don't add work the user hasn't asked for.

## Actions

1. **Draft a roadmap.** The inputs are the 1-pager or brief plus the brainstorm that settled the approach.
   - Read them, and read the repo's existing docs, before you propose anything.
   - Propose the steps in chat first.
2. **Revise a roadmap.** Read the roadmap, recent git history and open issues first. Then propose specific changes, each with its reason:
   - absorb, remove, reorder, add or re-cut steps;
   - record decisions;
   - update status.

   Don't restate what the roadmap already says.
3. **Re-cut a step.** Use this when brainstorming shows a step won't fit one cycle. Re-cut it into steps that pass the sizing checks.
4. **Check the boundary.** When a step's brainstorm starts deciding things that belong to the next step, say so. Propose moving the seam between the two steps.
5. **Answer what's next.** Do this from the roadmap and the repo state, in a few lines.

## Writing to the roadmap

- **The user dictated the change** (a status, "add X as the next step", "lock in decision Y"): apply it directly.
- **You are choosing the content** (new or changed steps, scope, wording of decisions): show the proposed diff in chat and wait for approval before you write. This holds even when the user said "update the roadmap accordingly".

The roadmap is a Living document. Follow the repo's existing roadmap structure and language. If there is none, use:

- the Living-document tag;
- one paragraph of context that links the brief;
- a **Decisions** section listing what is currently decided;
- steps grouped into parts, as `Step | Work | Size | Status` tables.

Numbering gaps left by removed steps are fine. Keep only the current plan, with no history.

## Handoff

When the user picks a step:

- A **Cycle** step goes to superpowers:brainstorming.
- A **Plan mode** step goes into plan mode.

After the step ships, update its status and fix any later steps it made wrong.
