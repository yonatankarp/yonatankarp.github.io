# Team Multiplier Copy Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the homepage copy around Yonatan as a Team Multiplier: a strong engineer who helps teams understand, build, and improve complex systems.

**Architecture:** Keep the current Hugo templates and visual system. Update homepage copy in `data/home/en.yaml`; avoid blog Markdown and metadata changes entirely.

**Tech Stack:** Hugo data YAML, existing Go templates, existing CSS/JS.

---

## File Structure

- Modify `data/home/en.yaml`: Rewrite hero, proof signals, about, outcomes, fit, proof, selected work framing, writing, testimonials, and contact copy.
- Do not modify `content/blog/*.md`.
- Do not modify templates unless the YAML shape must change; this plan avoids template changes.

## Task 1: Rewrite Homepage Copy Around Team Multiplier

**Files:**
- Modify: `data/home/en.yaml`

- [ ] **Step 1: Rewrite hero**

Set hero copy to a direct Team Multiplier positioning:

```yaml
hero:
  eyebrow: "Staff Software Engineer · Team multiplier"
  title: "I help engineering teams make hard systems easier to understand, build, and improve."
  lede: "I work best where the problem is still messy: too much implicit knowledge, unclear ownership, brittle integrations, or a team that needs a path through the noise. I build the system, explain the tradeoffs, and leave behind tools and context other people can reuse."
```

Keep current CTA URLs. Adjust CTA labels to:

```yaml
primaryAction:
  label: "Start a conversation"
  url: "#contact"
secondaryAction:
  label: "View CV"
  url: "/cv/"
```

- [ ] **Step 2: Rewrite proof signals**

Use:

```yaml
proofSignals:
  - label: "Role"
    text: "Staff Software Engineer"
  - label: "Known for"
    text: "Making teams faster by making systems clearer"
  - label: "How"
    text: "Code, docs, examples, tools, and patient explanation"
  - label: "Based in"
    text: "Berlin, Germany"
```

- [ ] **Step 3: Rewrite about**

Replace the about section with personal copy about enabling and explaining, not recent work history.

- [ ] **Step 4: Rewrite outcomes**

Use outcomes centered on shared understanding, reusable patterns, team ownership, and technical confidence.

- [ ] **Step 5: Rewrite proof cases**

Keep proof concrete, but frame each proof item as a multiplier example:

- Shared language for a messy domain.
- Reusable tooling for repeated problems.
- Public work that helps engineers outside the team.

- [ ] **Step 6: Rewrite fit and contact**

Make the fit/contact sections invite teams that need someone who can clarify, build, and raise the level around him.

- [ ] **Step 7: Build**

Run:

```bash
npm run build
```

Expected: Hugo build succeeds.

- [ ] **Step 8: Commit**

```bash
git add data/home/en.yaml
git commit -m "content: rewrite homepage around team multiplier"
```

## Self-Review

- Spec coverage: The plan rewrites the homepage around Team Multiplier while preserving Hugo and blog Markdown.
- Placeholder scan: No placeholders remain.
- Type consistency: Existing YAML keys are preserved so current templates continue rendering.
