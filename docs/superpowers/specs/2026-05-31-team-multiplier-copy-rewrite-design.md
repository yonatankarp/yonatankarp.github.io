# Team Multiplier Copy Rewrite Design

## Goal

Rewrite the homepage copy so it represents Yonatan Karp-Rudin as a person, not as a summary of recent work.

The primary identity is **Team Multiplier**: a strong engineer who helps teams understand, build, and improve complex systems by clarifying messy problems, explaining tradeoffs, building the actual path, and leaving reusable knowledge behind.

## Problem

The current copy is technically credible, but it over-indexes on recent Staff-level work in risk, payments, compliance, and platform systems. Those domains are useful proof points, but they are not the core identity.

The site should not read like a polished project history. It should read like a self-authored positioning page from someone people trust because he makes the people and systems around him better.

## Positioning

Primary message:

> I make engineering teams better at understanding, building, and evolving complex systems.

Supporting message:

- Yonatan is an enabler: he turns scattered context into shared understanding.
- Yonatan is a multiplier: his work compounds through tools, docs, examples, patterns, libraries, talks, and better team habits.
- Yonatan is a strong engineer: he can build the system, not only describe it.
- Yonatan likes explaining things: teaching and writing are part of the engineering work, not a separate hobby.

## Voice

Use a mix of direct and personal.

- Headlines should be direct and easy to scan.
- Supporting copy should feel more human and self-authored.
- Avoid sounding like a corporate architecture profile.
- Avoid phrases such as "high-stakes product systems," "operational ownership," and "stakeholder alignment."
- Keep technical credibility, but do not let domains like payments, risk, or compliance define the whole person.

## Homepage Copy Changes

### Hero

Replace the current domain/architecture-first headline with a team-multiplier headline.

The hero should communicate:

- Strong engineer.
- Team multiplier.
- Builder and explainer.
- Works well when the problem is messy.

Example direction:

> I help engineering teams make hard systems easier to understand, build, and improve.

The lede should explain the working style:

- clarify ambiguous problems,
- build the actual system,
- explain the tradeoffs,
- leave behind reusable context.

### Proof Signals

Shift proof signals away from mostly domain labels.

Preferred proof signals:

- Staff Engineer
- Team multiplier
- Builder + explainer
- Berlin

Domains such as payments, risk, compliance, OSS, and writing can remain in the details, but should not be the top-level identity.

### About

The about section should feel more personal.

It should answer:

- What kind of engineering work does Yonatan naturally do?
- Why does he explain things?
- How does he help teams move from confusion to shared direction?
- What does he leave behind after the work is done?

The section should not read as a list of Billie/SumUp/NICE accomplishments.

### Outcomes

Reframe outcomes around team capability:

- shared understanding,
- better technical decisions,
- reusable patterns,
- teams that can own and change the system after the first delivery.

### Proof

Keep proof concrete, but frame each proof item as a multiplier example.

Examples:

- A messy domain became easier for a team to reason about.
- A repeated problem became a reusable tool or template.
- An integration became understandable through contracts, examples, and docs.
- Writing or OSS helped people outside the immediate team move faster.

Recent work may be used as evidence, but not as identity.

### Selected Work And Writing

Selected work and writing should support the multiplier story.

Frame OSS, docs, and blog posts as examples of:

- explaining hard things,
- turning repeated problems into reusable material,
- helping other engineers avoid rediscovering the same context.

### Contact

Contact copy should invite teams that need someone who can clarify, build, and raise the level around him.

Permanent Staff+ roles remain the primary conversion path, but the tone should be less recruiter-shaped and more human.

## Constraints

- Do not edit blog post bodies or metadata.
- Blog posts must continue to render from Markdown.
- Keep the existing visual direction and Hugo architecture.
- Prefer changing `data/home/en.yaml` for homepage copy.
- Touch templates only if the new copy requires a small structural adjustment.

## Acceptance Criteria

- Homepage copy clearly centers Team Multiplier as the primary identity.
- Recent work domains become proof points rather than the main personality.
- The copy sounds direct, personal, and credible.
- The page still supports Staff+ hiring as the main conversion path.
- Blog content/context remains unchanged.
- Hugo build still passes.
