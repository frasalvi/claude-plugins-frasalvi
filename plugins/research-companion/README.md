# Research Companion

Adapted from <https://github.com/andrehuang/research-companion>

**Strategic research thinking agents for [Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — idea evaluation, project triage, and structured brainstorming to help you do research that matters.

Most AI writing tools help you *write* papers. This plugin helps you decide *which* papers to write.

Inspired by Nicholas Carlini's essay ["How to Win a Best Paper Award"](https://nicholas.carlini.com/writing/2026/how-to-win-a-best-paper-award.html) — which argues that great research starts with taste, strategic problem selection, honest self-evaluation, and knowing when to kill your darlings.

## The Problem

Researchers don't lack the ability to write papers. They lack a trusted colleague who will:

- Tell them an idea isn't worth 6 months of their life — *before* they invest those months
- Ask "who else is working on this and what's your unfair advantage?"
- Challenge them to state the key insight in one sentence (and refuse to move on until they can)
- Help them find the unexpected cross-field connection that makes a contribution truly novel
- Evaluate whether a struggling project should be continued, pivoted, or killed

This plugin provides that colleague.

## What's Inside

### Agents

| Agent | What it does |
|-------|-------------|
| **Brainstormer** | Creative brainstormer with emphasis on cross-field connections, strategic ignorance (challenging flawed assumptions), and surprising ideas. |
| **Idea Deepener** | Takes rough brainstorm-level ideas and fleshes them out into concrete one-pager elevator pitches. |
| **Paper Crawler** | Systematic collection of related papers from DBLP and OpenAlex APIs. |
| **Research Analyst** | Maps the research landscape around an idea — closest related work, landscape density, key differentiators. |
| **Idea Critic** | Stress-tests research ideas along 6 dimensions: novelty, impact, timing, feasibility, the nugget, and narrative potential. Returns a Pursue / Park / Kill verdict. |
| **Idea Reviser** | Revises a pitch based on landscape analysis and evaluation feedback — generates a meaningful variation addressing identified weaknesses. |
| **Proposal Drafter** | Expands a one-pager into a concrete two-page research proposal with draft abstract, conclusion-first test, and experimental plan. |
| **Research Strategist** | On-demand project-level strategic thinking — triage (continue/pivot/kill), comparative advantage mapping, impact forecasting, and scooping risk assessment. |

### Skill

| Skill | What it does |
|-------|-------------|
| `/research-companion` | A structured multi-phase ideation session that orchestrates specialized agents through: **Seed** → **Diverge** → **Deepen** → **Compare** → **Evaluate** → **Finalize**. Includes researcher checkpoints, a revision loop, and Carlini's conclusion-first test. |

### Principles

8 research strategy principles organized into three categories (Problem Selection, Execution Strategy, Strategic Positioning) that guide the agents' evaluations.

## Installation

### Claude Code

```bash
claude plugin marketplace add https://github.com/frasalvi/research-companion
claude plugin install research-companion@frasalvi-research-companion

```


## Usage

### Evaluate a research idea

Just describe your idea and ask for evaluation:

```
I'm thinking about studying how LLM-generated code introduces subtle security
vulnerabilities that pass standard code review. Can you evaluate this idea?
```

The **Idea Critic** will evaluate across 6 dimensions and give you a verdict.

### Decide whether to continue a project

```
I've been working on adversarial attacks against multimodal models for 3 months.
I have some results but they're incremental. Two other groups just posted preprints
in the same area. Should I continue?
```

The **Research Strategist** will assess your competitive position, impact potential, and opportunity cost, then recommend Continue / Pivot / Kill.

### Run a full brainstorming session

In Claude Code:

```
/research-companion I'm interested in the intersection of program synthesis
and scientific discovery
```

This launches a 6-phase guided session:

1. **Seed** — Understand your problem space, interests, and what bugs you about the field
2. **Diverge** — Generate ideas, alternative framings, and cross-field connections
3. **Deepen** — Flesh out the top 2-3 ideas into concrete one-pager elevator pitches
4. **Compare** — Map the research landscape: related work, closest competitors, landscape density
5. **Evaluate** — Stress-test ideas along 6 dimensions, deliver Pursue / Park / Kill verdicts. You decide per idea: advance, revise, or drop.
6. **Finalize** — Expand surviving ideas into two-page research proposals with draft abstract, conclusion-first test, and experimental plan

### Find cross-field connections

```
I work on differential privacy. What ideas from other fields
(cryptography, economics, ecology, etc.) could lead to novel approaches?
```

The **Brainstormer** is designed to bridge distant fields — the kind of connection that led to applying differential cryptanalysis to model stealing, or semi-supervised learning to poisoning attacks.

### Stress-test with a skeptical reviewer

```
Here's my draft abstract. Play devil's advocate — what would a skeptical
Area Chair say?
```

The **Idea Critic** will identify the strongest counter-arguments, the weakest assumptions, and what a hostile but fair reviewer would target.

## The 6 Evaluation Dimensions

When the Idea Critic evaluates your research idea, it assesses:

| # | Dimension | Key Question |
|---|-----------|-------------|
| 1 | **Novelty** | If you don't do this, how long until someone else does? |
| 2 | **Impact** | If this works perfectly, would anyone care? |
| 3 | **Timing** | Is the field ready for this? Too early? Already crowded? |
| 4 | **Feasibility** | What's the single riskiest assumption? Can you test it in a week? |
| 5 | **The Nugget** | Can you state the key insight in one sentence? |
| 6 | **Narrative Potential** | Can you tell a story that makes a skeptical reader care? |

## The 8 Research Strategy Principles

These principles, derived from patterns in high-impact research, guide all agents in this plugin:

**Problem Selection**
- **RS1: The Novelty Test** — "If you don't do this, how many months until someone else does?"
- **RS2: The Conclusion-First Test** — "Can you write a compelling conclusion right now?"
- **RS3: The Nugget Test** — "Can you state the key insight in one sentence?"

**Execution Strategy**
- **RS4: Fail Fast** — "Start with the sub-problem most likely to kill the project"
- **RS5: Kill Early** — "A working project with low impact is worse than a killed project"
- **RS6: Unreasonable Effort** — "Strengthen 'sometimes' to 'usually' through additional work"

**Strategic Positioning**
- **RS7: Comparative Advantage** — "Research space is high-dimensional; find your unique corner"
- **RS8: Timing Awareness** — "Impact = skill x domain importance at this moment"

## Idea Directories

Each idea gets its own directory under `research-ideas/` containing all artifacts from the pipeline:

```text
research-ideas/<idea-slug>/
  pitch.md              # One-pager elevator pitch
  papers.json           # Collected papers from academic APIs
  landscape.md          # Landscape analysis (related work, density)
  evaluation.md         # Idea critic evaluation and verdict
  proposal.md           # Two-page research proposal (if advanced)
```

Everything for one idea lives together — no file collisions when evaluating multiple ideas in parallel.

## Pairs Well With

- [**Academic Writing Agents**](https://github.com/andrehuang/academic-writing-agents) — 12 agents for reviewing, auditing, drafting, and polishing academic papers. Research Companion handles the "what to write" question; Academic Writing Agents handles the "how to write it" question.
- [**Claude-Claw**](https://github.com/andrehuang/claude-claw) — OpenClaw-inspired enhancements for session continuity, task management, and memory architecture. Provides `/handoff` for saving session state and `/manager` for tracking research tasks.

## Philosophy

Most researchers optimize for publication count. The best researchers optimize for impact — and papers follow naturally. This plugin is built around that distinction.

It won't help you produce more papers. It will help you produce *better* ones by being honest about which ideas are worth your finite time and by stress-testing your thinking before you commit months of effort.

The agents are deliberately opinionated and direct. They'd rather save you 3 months than spare your feelings. If an idea should be killed, they'll say so — and explain why.

## License

MIT
