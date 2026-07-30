# Design Principles for Agent Skills

The complete reference for crafting sharp, predictable skills. This is the disclosed reference for [`craft-skill`](../SKILL.md) — read it when diagnosing a skill or when the principles need more depth than the main file carries.

---

## Predictability

The degree to which a skill makes the agent behave the same _way_ on every run — the same process, not the same output. A brainstorming skill should _predictably_ diverge; its tokens vary, its behaviour doesn't. Predictability is the root virtue; cost and maintainability are symptoms of it, not rivals.

## Context Load vs Cognitive Load

Every skill spends one of two loads:

**Context load** — the cost a model-invoked skill imposes on the agent's context window. Its description sits in the window every turn, spending tokens and attention. What user-invoked skills escape.

**Cognitive load** — the cost a user-invoked skill imposes on the human. They must remember the skill exists and when to reach for it. What model-invocation removes.

| Invocation | Description | Context load | Cognitive load | Reachable by |
|-----------|-------------|-------------|---------------|-------------|
| **Model-invoked** | Kept | Permanent per turn | Zero | Agent + user + other skills |
| **User-invoked** | Stripped | Zero | Human remembers | User only |

Pick model-invocation only when the agent must reach the skill on its own. If it only fires by hand, make it user-invoked and pay no context load.

When user-invoked skills multiply past what the human can remember, a **router skill** cures the cognitive load — one skill that names the others and when to reach for each.

## Information Hierarchy

Content ranked by how immediately the agent needs it — a single ladder:

1. **Steps** — ordered actions, in SKILL.md, primary tier
2. **Reference, inline** — definitions, rules, in SKILL.md, secondary
3. **Reference, disclosed** — behind a context pointer, loaded on demand

**Progressive disclosure** is the move down the ladder — out of SKILL.md into a linked file — so the top stays legible. Not primarily a token optimisation; it is how the hierarchy is protected.

**Co-location** — keep a concept's definition, rules, and caveats under one heading, not scattered. Reading one part brings its neighbours with it.

## Leading Words — In Depth

A leading word (also _Leitwort_) encodes a behavioural principle in the fewest tokens by invoking priors the model already holds. Coining your own works if you define it clearly, but a made-up word recruits no priors — you pay in definition tokens what a pretrained word gives free.

**In the body** — anchors execution. The agent reaches for the same behaviour every time the concept appears.

**In the description** — anchors invocation. When the same word lives in your prompts, docs, and codebase, the agent links that shared language to the skill and fires it more reliably.

**Finding yours** — what is the single constraint that makes this skill behave differently from the default? That constraint, compressed into one word, is your anchor. Examples:

| Skill | Leading word | What it compresses |
|-------|-------------|-------------------|
| TDD | _red_ | Write the failing test first |
| Diagnosing bugs | _tight_ | A tight feedback loop is the skill |
| Codebase design | _deep_ | Small interface, lots of implementation |
| Wayfinder | _fog_ | Don't chart what you can't see yet |
| Prototype | _throwaway_ | Code that answers a question, then gets deleted |
| Code review | _two-axis_ | Standards and Spec, reported separately |

## Completion Criteria — In Depth

Two axes:

**Clarity** (can the agent tell done from not-done?) — resists premature completion. A vague bound lets the agent declare done and slip to the next step.

**Demand** (how much it requires) — sets legwork. "Every modified model accounted for" forces thorough work where "produce a change list" does not. This axis is _not_ step-bound — it can bind flat reference too, which is how a skill with no steps still carries an exhaustiveness bar.

The strongest criteria are both checkable and exhaustive.

## Failure Modes — In Depth

### Premature Completion

Ending the current step before it is genuinely done, because the agent's attention slips to _being done_ rather than to the work. A between-steps failure: it needs steps to occur — a skill with no steps that quits early isn't premature completion but thin legwork under an unmet demand.

**Defence, in order:**
1. Sharpen the completion criterion (cheap, local)
2. If irreducibly fuzzy _and_ you observe the rush, hide later steps by splitting the sequence

Hiding only works across a real context boundary (a user-invoked hand-off or a subagent dispatch); an inline model-invoked call leaves the later steps in context and clears nothing.

### Duplication

The same meaning in more than one place. Costs maintenance (change one place, you must change the others), costs tokens, and inflates prominence — repeating a meaning weights it on the ladder past its real rank.

The accidental inverse of a leading word, which raises attention on purpose by repeating a token, never the meaning.

### Sediment

Layers of old content that settle in a skill and are never cleared, because adding feels safe and removing feels risky. The default fate of any skill without a pruning discipline. The slow erosion of relevance.

### Sprawl

A skill that is simply too long — too many lines in SKILL.md — independent of whether they are stale or repeated. Even an all-live, all-unique skill can sprawl. The cure is the information hierarchy: push reference behind pointers, and split by branch or sequence so each path carries only what it needs.

### No-Op

An instruction that changes nothing because the model already does it by default — you pay load to tell the agent what it would do anyway. The test: does a line change behaviour versus the default?

A leading word too weak to beat the default is a no-op (_be thorough_ when the agent is already thorough-ish). The fix is a stronger word (_relentless_), not a different technique.

### Negation

Steering by prohibition — telling the agent what _not_ to do — which drags the forbidden behaviour into context and makes it _more_ available, not less. _Don't think of an elephant_, and the elephant is all there is.

**Cure:** prompt the **positive** — describe the target behaviour so the banned one is never spoken. A prohibition earns its place only as a hard guardrail on a behaviour you cannot phrase positively; even then, pair it with the positive target.

## Conciseness Techniques

### The No-Op Test

Run it sentence by sentence. Take each sentence in isolation and ask: if I delete this, does the agent behave differently? If not, delete the sentence. Do not trim words from it — delete the whole sentence.

### The Relevance Test

Does a line still bear on what the skill does? A line loses relevance either by never bearing on the task (mere exposition) or by going stale.

### Single Source of Truth

Each meaning lives in exactly one authoritative place. A change to the skill's behaviour is a change in one place.

### Compress with Leading Words

A triad spelled out at three sites (duplication), a description spending a sentence to gesture at one idea — each is a passage begging to collapse into a single token. Examples:

- "fast, deterministic, low-overhead" → _tight_
- "a loop you believe in" → _red_ (converts a fuzzy gate into a binary observable state)
- "throwaway code that answers a question" → _throwaway_

You win twice: fewer tokens, _and_ a sharper hook for the agent to hang its thinking on.

### Delegate, Don't Restate

If another skill owns a concept, invoke it (`/other-skill`) rather than restating the content. Shared vocabulary lives in one place; other skills point at it.

### Cut Identity from Description

The description does two jobs — state what the skill is and list the branches that trigger it. Every word increases context load. Front-load the leading word. One trigger per branch. Cut anything already stated in the body.

## Glossary

| Term | Meaning |
|------|---------|
| **Predictability** | Same process every run, not same output |
| **Context load** | Token cost of a model-invoked description |
| **Cognitive load** | Human cost of remembering user-invoked skills |
| **Leading word** | Compact concept anchoring skill behaviour |
| **Completion criterion** | Condition telling the agent work is done |
| **Steps** | Ordered actions, primary tier |
| **Reference** | Material consulted on demand |
| **Progressive disclosure** | Moving reference behind pointers |
| **Co-location** | Keeping related material under one heading |
| **Premature completion** | Ending a step before it's genuinely done |
| **Duplication** | Same meaning in multiple places |
| **Sediment** | Stale content that accumulates unchecked |
| **Sprawl** | Skill too long, even if all content is live |
| **No-op** | Instruction the model already follows by default |
| **Negation** | Prohibition that makes the banned behaviour more available |
