---
name: project-oversight
description: Use when turning a 1-pager, brief or finished brainstorm into a project roadmap, when revising a roadmap (adding, removing, absorbing, reordering or re-cutting steps, recording decisions, updating status), when a step turns out to be more than one step, or when deciding what to work on next. Triggers on "create a roadmap", "update the roadmap", "break down M4", "is this step needed", "what's next".
---

# Project Oversight

A roadmap cuts a project into steps, and each step is weighted by how it will be worked. You decide WHAT each step delivers and in what order. HOW is decided inside the step, when it starts. Write no code, specs or implementation detail here.

## Sizing a step

A step delivers one thing: a dataset, a component, a design or a set of findings. Each step gets a weight, and the roadmap labels it:

- **Full.** Heavy engineering, such as building a frontend, backend, pipeline or system. It runs brainstorming → spec → writing-plans → an execution workflow.
- **Light.** Conceptual or docs work, prereg text, or a minor build. It runs brainstorming, then a short plan or straight to implementation, with no spec doc.
- **Paired.** Data exploration and analysis whose output is findings, not a built artifact. The user drives the session step by step and steers the agent closely, with no spec and no plan.

The weight is a forecast. The step's first session can move it up or down.

Two checks apply to every candidate step:

- **Would it fit in one session as a bounded change?** Then it is not a step. Examples are a quick fix, a small feature, or something another step's work already produces. Fold it into the neighbouring step, or do it in the session where it comes up, using plan mode if a reviewed plan helps. A build that is bigger than that is a step even when its design is already settled.
- **Does it deliver more than one thing?** Then it is more than one step. Split it at the seam between the deliverables. A design and the build that implements it are two deliverables, and so are a pool and the annotations made on it. Related work, or work that runs back to back or feeds the next piece, is still separate when each piece is a deliverable.

Every step needs its own reason to exist: a separate decision, risk or deliverable that the other steps don't cover.

When you propose a breakdown, include a **Sizing calls** list. It names every fold and split that could reasonably go the other way, each with a one-line reason. The user decides those calls.

## Scope lazily

The roadmap runs all the way to the brief's goal. Every stage the brief needs, through the final analysis or delivery, gets a step. If the user has limited the horizon, for example "stage 1 only" or "keep it minimal", the roadmap covers that horizon and nothing beyond it. Only the next step needs detail. A later step is one line in the Work column, and its sub-parts are decided when it starts. Extras that neither the brief nor the user asked for, such as a manuscript or a release package, stay off.

## Actions

1. **Draft a roadmap.** The inputs are the 1-pager or brief plus the brainstorm that settled the approach.
   - Read them, and read the repo's existing docs, before you propose anything.
   - Propose the steps in chat first.
2. **Revise a roadmap.** Read the roadmap, recent git history and open issues first. Then propose specific changes, each with its reason:
   - absorb, remove, reorder, add or re-cut steps;
   - record decisions;
   - update status.

   Don't restate what the roadmap already says.
3. **Re-cut a step.** Use this when a step's first session shows it is more than one step. Re-cut it into steps that pass the sizing checks.
4. **Check the boundary.** When a step's brainstorm starts deciding things that belong to the next step, say so. Propose moving the seam between the two steps.
5. **Answer what's next.** Do this from the roadmap and the repo state, in a few lines.

## Writing to the roadmap

- **The user dictated the change** (a status, "add X as the next step", "lock in decision Y"): apply it directly.
- **You are choosing the content** (new or changed steps, scope, wording of decisions): show the proposed diff in chat and wait for approval before you write. This holds even when the user said "update the roadmap accordingly".

The roadmap is a Living document. Follow the repo's existing roadmap structure and language. If there is none, use:

- the Living-document tag;
- one paragraph of context that links the brief;
- a **Decisions** section listing what is currently decided;
- steps grouped into parts, as `Step | Work | Weight | Status` tables.

Numbering gaps left by removed steps are fine. Keep only the current plan, with no history.

## Handoff

When the user picks a step:

- A **Full** or **Light** step goes to superpowers:brainstorming, with its weight stated so the brainstorm knows what follows it.
- A **Paired** step starts as a working session. Restate the step's questions and let the user drive.

After the step ships, update its status and fix any later steps it made wrong.
