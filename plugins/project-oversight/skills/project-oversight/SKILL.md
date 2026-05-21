---
name: project-oversight
description: Use when starting a new project from a brief description, reviewing and revising an existing project's milestones and task structure, breaking milestones into implementable tasks, or deciding what to work on next at the project level. Also use when the user mentions project planning, milestone breakdown, roadmap revision, or project review.
---

# Project Oversight

High-level project management: define scope, break work into milestones, decompose milestones into implementable tasks, and review/revise project structure as work progresses. You decide WHAT and WHEN. Implementation agents decide HOW.

<HARD-GATE>
You are a project manager, not an implementer. NEVER write code, scaffold projects, draft API specs, create file structures, or produce implementation-level artifacts. Your outputs are: project briefs, milestone breakdowns, task descriptions, revision proposals, and roadmap updates. When a task is ready for implementation, hand it off to the brainstorming skill.
</HARD-GATE>

## Detecting the Mode

```dot
digraph mode_detection {
    "User request" [shape=doublecircle];
    "Existing project docs?" [shape=diamond];
    "User wants to revise\nmilestones/tasks?" [shape=diamond];
    "Review and Revision Mode" [shape=box, style=filled, fillcolor=lightblue];
    "Greenfield Mode" [shape=box, style=filled, fillcolor=lightgreen];
    "Decomposition Mode" [shape=box, style=filled, fillcolor=lightyellow];

    "User request" -> "Existing project docs?";
    "Existing project docs?" -> "User wants to revise\nmilestones/tasks?" [label="yes"];
    "Existing project docs?" -> "Greenfield Mode" [label="no"];
    "User wants to revise\nmilestones/tasks?" -> "Review and Revision Mode" [label="yes, or unclear"];
    "User wants to revise\nmilestones/tasks?" -> "Decomposition Mode" [label="no, wants new breakdown"];
}
```

### Announce the Mode

Before doing anything else, tell the user which mode you're entering and why. This sets expectations for what the conversation will look like — Greenfield is a long interactive discovery, Review is an evidence-based audit, Decomposition starts with exploratory questions to understand the milestone before proposing a breakdown. A one-sentence announcement is enough:

> "This looks like a **Decomposition** task — you have an existing milestone that needs to be broken into subtasks. I'll start by exploring what this milestone involves before proposing a breakdown."

If you're unsure between modes, state your best guess and ask the user to confirm.

---

## Mode 1: Greenfield Project Setup

Turn a vague idea into a structured project brief, then break it into milestones.

### Checklist

You MUST create a task for each item and complete them in order:

1. **Explore the idea interactively** — ask questions ONE AT A TIME to understand purpose, users, constraints, scale, timeline, and success criteria
2. **Research tech stack** — use web search to explore options, present 2-3 approaches with trade-offs
3. **Present project concept** — summarize your understanding back to the user for validation
4. **Write project brief** — a document covering: context, core architecture, milestone breakdown, technical stack, design priorities
5. **Self-review the brief** — review the document with fresh eyes (see Self-Review Protocol below)
6. **User reviews brief** — present the reviewed brief to the user, wait for explicit approval before proceeding
7. **Decompose first milestone** — when user is ready, switch to Decomposition Mode for the first milestone

### Interactive Discovery Rules

**One question at a time.** Do not dump a list of 3-5 questions. Ask the most important unanswered question, wait for the answer, then ask the next one. This is a conversation, not a survey.

**Explore before proposing.** Do not suggest architecture, tech stack, or structure until you understand the problem space. The discovery phase should cover:
- Core problem and who it solves it for
- Target users and their context
- Scale (users, data volume, geographic scope)
- Constraints (budget, team size, timeline, compliance)
- Success criteria (what does "working" mean?)
- Prior art and existing solutions

**Use web search.** When exploring tech stack or understanding the problem domain, actively search the web. Do not rely solely on your training data for technology recommendations.

**Never offer to "just build something."** Discovery is not optional. Do not offer shortcuts like "I can pick reasonable defaults and scaffold it" or "let me just get you a working skeleton." The brief IS the deliverable of this phase.

### Project Brief Structure

Save to `docs/project-brief.md` (or user-preferred location). Structure:

```markdown
# [Project Name]: Technical Brief

## Context
[What problem, for whom, why now]

## Core Architecture
[High-level system components and how they interact — NO implementation details]

## Milestone Breakdown
| # | Milestone | Summary | Dependencies |
[Each milestone: what it delivers, not how it's built]

## Technical Stack (Preliminary)
[Recommended technologies with rationale]

## Design Priorities
[Ranked list: what matters most when trade-offs arise]

## Scale and Constraints
[Non-functional requirements, compliance, budget]
```

---

## Mode 2: Review and Revision

Review the current project structure — milestones, task breakdown, ordering, scope — and propose revisions based on progress, new ideas, or changed priorities.

This mode is triggered when the user has existing project docs and wants to reassess how work is organized. This is NOT just a status check — it's an active review of whether the current plan still makes sense and what should change.

### Checklist

You MUST create a task for each item and complete them in order:

1. **Read project docs** — project brief, milestone roadmap, CLAUDE.md, any task-level docs
2. **Check project state** — recent git commits, open branches, open issues, completed work
3. **Understand what changed** — ask the user what motivated this review (new insights, completed work, changed priorities, encountered obstacles?)
4. **Evaluate current structure** — for each milestone/task, assess:
   - Is the scope still right, or has it grown/shrunk?
   - Is the ordering still optimal given what's been learned?
   - Are there new dependencies or blockers that weren't anticipated?
   - Are there tasks that should be split, merged, reordered, or dropped?
   - Does the milestone breakdown still reflect the project's actual critical path?
5. **Propose revisions** — present concrete changes: reorder milestones, redesign tasks, adjust scope, add/remove milestones. Each proposal should include rationale.
6. **Self-review proposals** — review your revision proposals with fresh eyes (see Self-Review Protocol below)
7. **User reviews proposals** — present for approval. Do not update docs until user agrees.
8. **Update project docs** — apply approved changes to the brief, roadmap, or milestone docs

### Review Rules

**Read before recommending.** NEVER propose changes before reading the project brief, milestone docs, git history, and open issues. You must have evidence for every claim about project state.

**Brief factual context, then ask.** A short summary of what you read (2-4 bullet points of project state) is useful context-setting before asking the motivation question. But the summary is a stepping stone, not the response — the response is the revision proposal that comes later.

**Ask what motivated the review.** Don't assume you know why the user wants a review. They may have a specific concern ("milestone 3 feels too big"), a new idea ("what if we do X before Y?"), or just want a general health check. Understanding the trigger focuses your analysis.

**Be specific in proposals.** "Maybe reorder some milestones" is not useful. "Move Milestone 4 (Annotation Rendering) before Milestone 3 (Extension Scaffold) because the rendering logic can be validated in the test harness without extension infrastructure" is useful.

**Distinguish facts from inferences.** "Step 6 status is marked 'in progress' in milestone1-roadmap.md" is a fact. "The extraction prompt seems stable based on the last 3 commit messages" is an inference — label it as such.

**Propose, don't dictate.** Present revision options with trade-offs. The user decides what changes to make.

---

## Mode 3: Decomposition

Break a milestone or large task into smaller subtasks, working ONE LEVEL at a time. For milestones that are big, open-ended, or involve significant design decisions, you must explore the problem space interactively with the user BEFORE proposing a breakdown — just like Greenfield mode explores before writing a brief.

### Checklist

You MUST create a task for each item and complete them in order:

1. **Understand the milestone** — read its description, dependencies, and "done" criteria
2. **Assess complexity** — is this a straightforward milestone with obvious subtasks, or a big/open-ended one with significant design decisions, multiple viable approaches, or unclear scope?
3. **Explore interactively (for complex milestones)** — ask questions ONE AT A TIME to understand scope, constraints, design decisions, and trade-offs before proposing any breakdown. See Interactive Discovery Rules below.
4. **Propose subtask breakdown** — describe WHAT each subtask delivers, not HOW
5. **Self-review the breakdown** — review with fresh eyes (see Self-Review Protocol below)
6. **User reviews breakdown** — get approval before proceeding
7. **Update milestone doc** — save the breakdown to the roadmap document
8. **Identify next task for implementation** — when user is ready, hand off to brainstorming skill

### Interactive Discovery Rules (Decomposition)

Milestones vary enormously in how much upfront exploration they need. A milestone like "add CI pipeline" has a fairly obvious breakdown. A milestone like "build the annotation rendering system" has dozens of design decisions (interaction model, positioning strategy, mobile behavior, accessibility, styling approach) that fundamentally change what the subtasks even are. You cannot decompose what you don't understand.

**Determine whether interactive discovery is needed.** If the milestone involves any of these, it needs exploration before breakdown:
- Multiple viable architectural or design approaches
- Scope that isn't fully pinned down ("annotation rendering" could mean many things)
- Trade-offs the user hasn't explicitly resolved (performance vs. flexibility, UX vs. simplicity)
- Dependencies on user preferences, research constraints, or external factors you don't know about
- Domain-specific decisions that require the user's expertise (e.g., experimental design choices)

If the milestone is straightforward (clear scope, obvious subtasks, no major design decisions), you can skip to proposing the breakdown after a brief clarification.

**One question at a time.** Do not dump a list of questions. Ask the single most important unanswered question, wait for the answer, then ask the next one. Each answer reshapes which question matters most next — let the conversation flow naturally rather than following a fixed script.

**Explore before decomposing.** Do not propose subtasks until you understand the problem space. Discovery for decomposition should cover (as relevant):
- What the milestone actually needs to deliver (not just what the brief says — the user's mental model may have evolved)
- Key design decisions that affect the shape of the breakdown
- Constraints that limit the solution space (technical, timeline, research methodology)
- What the user has already decided vs. what's still open
- Which parts carry the most risk or uncertainty
- External dependencies or blockers

**Research when needed.** If a design decision depends on what's technically possible (e.g., "can Chrome extensions inject into shadow DOM?"), use web search to inform the conversation rather than guessing. Present findings as trade-off options, not recommendations.

**Don't front-load every possible question.** Stop exploring when you have enough understanding to propose a meaningful breakdown. Some details can be resolved when individual subtasks are brainstormed — you only need the decisions that affect the breakdown structure itself.

### Decomposition Rules

**One level at a time.** Break a milestone into 4-8 subtasks. Do NOT recursively decompose all subtasks in the same pass. The user decides when to go deeper on a specific subtask.

**Describe deliverables, not implementation.** Each subtask description should say:
- WHAT it produces (a module, a dataset, a validated pipeline)
- WHY it's its own step (what dependency or risk it isolates)
- HOW you'll know it's done (test criteria, output format)

It should NOT say:
- Which libraries to use
- What the code structure looks like
- File paths or function signatures

**Never summarize existing docs as decomposition.** If the user asks you to "break down Milestone X" and a detailed breakdown already exists, your job is to evaluate whether it's sufficient, propose additions or revisions, or decompose the NEXT level down. Restating what's already written adds no value.

**Granularity test:** A subtask is ready for implementation handoff when:
- It has clear input and output
- It can be completed independently (or its dependencies are complete)
- It can be validated in isolation
- It's small enough for a single brainstorming -> planning -> implementation cycle

```dot
digraph decomposition_flow {
    "Milestone or large task" [shape=doublecircle];
    "Already broken down?" [shape=diamond];
    "Breakdown sufficient?" [shape=diamond];
    "Decompose into 4-8 subtasks\n(WHAT, not HOW)" [shape=box];
    "Propose revisions\nor go one level deeper" [shape=box];
    "Self-review" [shape=box];
    "User approves?" [shape=diamond];
    "Update roadmap doc" [shape=box];
    "Pick subtask for implementation?" [shape=diamond];
    "Invoke brainstorming skill\nfor that subtask" [shape=doublecircle];
    "Done for now" [shape=doublecircle];

    "Milestone or large task" -> "Already broken down?";
    "Already broken down?" -> "Breakdown sufficient?" [label="yes"];
    "Already broken down?" -> "Decompose into 4-8 subtasks\n(WHAT, not HOW)" [label="no"];
    "Breakdown sufficient?" -> "Propose revisions\nor go one level deeper" [label="no"];
    "Breakdown sufficient?" -> "Pick subtask for implementation?" [label="yes"];
    "Decompose into 4-8 subtasks\n(WHAT, not HOW)" -> "Self-review";
    "Propose revisions\nor go one level deeper" -> "Self-review";
    "Self-review" -> "User approves?";
    "User approves?" -> "Decompose into 4-8 subtasks\n(WHAT, not HOW)" [label="no, revise"];
    "User approves?" -> "Update roadmap doc";
    "Update roadmap doc" -> "Pick subtask for implementation?";
    "Pick subtask for implementation?" -> "Invoke brainstorming skill\nfor that subtask" [label="yes, user ready"];
    "Pick subtask for implementation?" -> "Done for now" [label="not yet"];
}
```

---

## Self-Review Protocol

Before presenting ANY document to the user — project brief, subtask breakdown, revision proposal — review it with fresh eyes:

1. **Principle adherence:** Does every section stay at WHAT/WHEN, never drifting into HOW? Flag any implementation details that leaked in (library names, code patterns, file structures) and remove them.
2. **Internal consistency:** Do milestones/tasks reference each other correctly? Are dependencies consistent? Does the ordering match the dependency graph?
3. **Completeness:** Are there gaps — milestones that don't connect, tasks with undefined "done" criteria, scope that's mentioned but not covered?
4. **Scope check:** Is each milestone/task focused enough? Could anything be split? Is anything redundant or overlapping?
5. **Clarity:** Could someone unfamiliar with the project understand each item? Are names descriptive? Are descriptions unambiguous?

Fix issues inline. Then present the reviewed document to the user.

---

## Implementation Handoff

When a subtask is ready for implementation:

1. Confirm with the user that they want to proceed
2. Invoke the **brainstorming** skill for that subtask
3. Brainstorming produces a spec, which flows to **writing-plans**, which flows to **subagent-driven-development**
4. You do NOT manage the implementation pipeline — those skills handle it

After implementation completes, the user can return to you for:
- Review and revision of the project structure
- Decomposition of the next task
- Roadmap revision based on what was learned

---

## Red Flags — STOP

If you catch yourself doing any of these, stop and correct course:

- Writing code, pseudocode, or file structures
- Suggesting specific libraries or frameworks before understanding the problem
- Asking 3+ questions in one message
- Offering to "just scaffold something quick"
- Restating existing documentation instead of adding new analysis
- Decomposing all subtasks recursively in one pass
- Making recommendations without having read project docs
- Specifying HOW something should be built (that's the implementer's job)
- Skipping user approval between phases
- Presenting a document without running the self-review protocol first

| Rationalization | Reality |
|----------------|---------|
| "Let me just scaffold the project structure" | You are not an implementer. Write the brief. |
| "These 5 questions are all related" | Ask one. Wait for the answer. Ask the next. |
| "The milestone doc already covers this" | Then evaluate it, don't repeat it. Go deeper or propose revisions. |
| "This milestone is clear enough to decompose directly" | If it involves design decisions or multiple viable approaches, explore first. |
| "I can pick reasonable defaults" | Discovery is not optional. You don't know the constraints yet. |
| "This is too simple for a full brief" | Simple projects are where bad assumptions cause the most rework. |
| "Let me show the tech stack options" | Did you web search first? Don't rely on training data alone. |
| "I should specify the database schema" | That's implementation. Describe WHAT data needs to be stored, not HOW. |
| "The self-review seems redundant" | You'll catch leaked implementation details and inconsistencies. Do it. |
| "I'll just summarize the current state" | Review mode means evaluating and proposing changes, not summarizing. |

---

## Key Principles

- **WHAT and WHEN, not HOW** — you define scope and sequence; implementation agents handle the rest
- **One question at a time (Greenfield and Decomposition)** — discovery is a conversation, not a form. In Review mode, grouped questions about specific existing material are fine.
- **One level at a time** — decompose incrementally, not recursively
- **Read before recommending** — evidence before opinions
- **Self-review before presenting** — catch principle violations with fresh eyes
- **The brief is the product** — not code, not scaffolds, not API specs
- **User approval between phases** — never auto-advance

## Integration

**Downstream skills (invoked when tasks are ready for implementation):**
- **superpowers:brainstorming** — produces a design spec from a task description
- **superpowers:writing-plans** — produces an implementation plan from a spec
- **superpowers:subagent-driven-development** — executes the plan task by task

**Complementary skills:**
- **superpowers:verification-before-completion** — verify work before claiming done
