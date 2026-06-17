---
title: "I Stopped Being My AI Agent's Memory: Building a Self-Compiling Second Brain"
date: 2026-06-11T00:00:00+01:00
draft: false
type: "blog"
description: "How I gave my AI coding agent a real long-term memory using Claude Code hooks: a self-compiling wiki it writes to itself, with capture, ingest, and recall wired into the session lifecycle."
tags:
  - claude-code
  - ai
  - agents
  - automation
  - knowledge-base
categories:
  - AI
  - Engineering
images:
  featured_image: "/images/blog/covers/self-compiling-second-brain.jpg"
---

If there's one thing all the AI coding agents I've worked with have in common, it's amnesia. I could spend a day teaching it how the code works, what the pitfalls are, why some decisions were made. The session ends, and all of it is gone. The next day I open a new session and start explaining from the beginning like nothing happened, wasting valuable time on a tool that was supposed to save me time.

At the same time, our performance review was around the corner, and I realised that, as usual, I had no idea what I'd done in the last 6 months (yes, I know, I should keep a bragging document!), so I decided to ask Claude to store a summary of what we did at the end of each session as a backlog of the work I did that day.

At some point I got tired of being the long-term memory for a thing that should have its own, and of constantly reminding it that we had a file describing what we did. So I built it one. Actually I built it a few, and wired them together so they feed each other while I get on with my day. Here's how the whole thing works, and why each piece ended up the shape it did.

In this article, I'll walk through the whole setup: the storage where knowledge lives, and the three hooks that automate moving it in and out.

## The Problem: Working Memory Is Not Long-Term Memory

A model's context window is working memory. It's big, it's fast, it's great, and it disappears the moment the session ends. What it is not is long-term memory. Anything you want to survive until tomorrow has to be persisted somewhere and read back later.

The obvious fix is to keep a notes file, tell the agent to read it. The trouble is that hand-written notes rot, notes the agent takes mid-task are overloaded with detail, and a single flat file is useless the moment it grows past a few hundred lines.

So what do you actually want? A small, well-crafted knowledge base that the agent maintains itself, plus a way to get the right piece of it back into context just when you need it. That splits the system cleanly into two parts: the storage (where knowledge lives), and the loop (the automation that moves knowledge into storage and back out again).

## The Storage: Three Brains

I keep three separate stores, and keeping them separate matters.

The first is my personal Obsidian vault. This is human territory. The agent can read it for context, but it is never allowed to write here. I do not want an automated process editing my personal notes, full stop.

The second is the agent's own knowledge base, a separate Obsidian-style markdown wiki in its own directory. Everything the agent learns that's worth keeping gets compiled into here. This is the interesting one.

The third isn't really a brain, it's the search layer over the other two: a small CLI called [`qmd`](https://github.com/tobi/qmd) that indexes the vaults and serves hybrid keyword-plus-semantic search. When I want something conceptual and I don't know the exact words, semantic search wins. When I know the filename, plain grep is fine.

The wiki isn't my invention. The pattern was originally introduced to me by Andrej Karpathy's [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f): instead of fetching raw documents at query time, the LLM incrementally builds and maintains a structured, interlinked set of markdown files. He frames it as three layers, the raw immutable sources, the compiled wiki, and a schema file that configures the whole thing. Those map cleanly onto my `raw/`, `wiki/`, and the wiki's `CLAUDE.md` (or `AGENTS.md`, the cross-tool equivalent). What I added on top is the partitioning and the automation loop that feeds it, which I'll get to.

Let's zoom into the wiki, because that's the core. Here's the layout, trimmed to what matters:

```
claude-wiki/
├── CLAUDE.md             # schema + conventions, auto-loads in-dir
├── raw/                  # the funnel: capture lands here first, unfiltered
│   ├── inbox/            # drop zone, no structure required
│   ├── work/
│   │   └── notes/        # session-outcome digests get written here
│   ├── personal/         # (same shape as work/)
│   └── shared/           # (same shape as work/)
├── wiki/                 # the compiled, curated output
│   ├── index.md          # root of the recursive index tree
│   ├── work/
│   │   ├── index.md      # one index per dir, lists only its level
│   │   ├── concepts/<category>/<slug>.md
│   │   ├── entities/<category>/<slug>.md
│   │   └── summaries/<slug>.md
│   ├── personal/         # (same shape as work/)
│   └── shared/           # (same shape as work/)
├── scripts/              # build_indexes.py, lint_wiki.py, check_partitions.py
└── log/                  # one log file per operation run
```

`raw/` is the funnel: everything lands here first, unfiltered, cheap to write. You capture first and decide what matters later. `wiki/` is the compiled output: curated pages split into three partitions, work, personal, and shared.

The partition split has one hard rule I enforce with a script: work and personal pages may never link to each other, and shared pages may never link outward. Both can link down into shared, nothing links up. This is what stops work context from bleeding into personal sessions and the other way around. If a concept feels like it belongs in both worlds, that's the signal it's actually domain-agnostic and belongs in shared.

Every page carries YAML frontmatter so the agent can generate and parse it mechanically:

```yaml
---
title: Hooks enforce, prompts suggest
type: concept
created: 2026-06-11
updated: 2026-06-11
sources: [raw/shared/notes/2026-06-11-1700-memory-loop.md]
tags: [claude-code, hooks, memory]
partition: shared
---
```

## A Quick Detour: Hooks Are Not Skills

Before the core loop, one important point that a lot of this flow is based on: a hook is deterministic. In Claude Code for example, it fires on a lifecycle event, session start, the stop event, session end, and it runs a shell command whether the model likes it or not. The command it runs can't reason on its own, but it can deterministically kick off something that does.

On the other hand, a skill is a model-invoked capability. The agent chooses to use it when the task calls for it, and it carries the knowledge the model needs. A skill can reason, because it runs inside a model turn.

My wiki's five operations, compile, ingest, query, lint, and audit, are packaged as a skill. I didn't even write it from scratch: I started from [Lewis Liu's `llm-wiki` skill](https://github.com/lewislulu/llm-wiki-skill), itself inspired by Karpathy's gist, and layered my own adaptations on top, like the work/personal/shared partitioning. The automation around them is hooks. The hooks guarantee that things happen at the edges of every session. The skill is what does the actual thinking. Trying to do the reasoning in a hook, or to guarantee timing with a skill, is a recipe for failure.

## The Loop: Recall, Capture, Ingest

The whole thing comes alive with three hooks. The wiring is a few lines of config in your `~/.claude/settings.json` file:

```json
"hooks": {
  "SessionStart": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "~/.claude/hooks/brain-recall-on-start.sh"
        }
      ]
    }
  ],
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "~/.claude/hooks/brain-flush-check.sh"
        }
      ]
    }
  ],
  "SessionEnd": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "~/.claude/hooks/brain-ingest-on-end.sh"
        }
      ]
    }
  ]
}
```

Recall what we discussed last time at the start, capture this session at the stop, ingest at the end. Read knowledge in, do the work, write the outcome down, fold it into the wiki, and repeat.

I'll walk through them in build order rather than loop order, since you have to capture something before there's anything to ingest or recall.

![The memory loop: recall on SessionStart, capture on Stop, and ingest on SessionEnd, all revolving around the wiki.](/images/blog/self-compiling-second-brain-loop.svg)

### Step 1: Capture, at the Stop Event

Now, I wasn't going to write these summaries myself, being the lazy engineer I am. The agent should do it. So once I'm done with a session, the Stop hook fires and asks the agent to write a short outcome digest of what just happened. Not a transcript, a 150 to 400 word summary of what was produced, decided, or learned, dropped into the raw funnel tagged as pending ingest. The hook itself is tiny (`brain-flush-check.sh`):

```bash
# fire once per session (the marker is keyed to the session id)
[ -f "$MARKER" ] && exit 0
touch "$MARKER"

cat <<'JSON'
{"decision":"block","reason":"Write a 150-400 word session-outcome digest to raw/<partition>/notes/YYYY-MM-DD-HHMM-slug.md with frontmatter kind: session-outcome, status: pending-ingest."}
JSON
```

That `"decision":"block"` is the magic here. Blocking the stop gives the model another turn, which is exactly the space it needs to write the digest. Without it there'd be no turn left to do the work.

So why a hook at all, instead of just telling the agent? Hooks enforce behaviour, prompts suggest it at best or are ignored at worst. An instruction in a config file is advice the model can forget or skip when it's busy finishing the real task. A hook is code that runs no matter what. If you want something to happen every single time, it can't be a polite request. It has to be mechanically enforced.

And notice the split: the Stop hook writes a rough digest into raw, not a polished wiki page. Capture is cheap and unfiltered. The polishing happens later. That way recording never blocks and never has to make a judgement call.

### Step 2: Ingest, at Session End

The digests pile up in raw. Something has to turn them into real wiki pages: extract the important knowledge, drop the noise, place it in the right partition, cross-link it, rebuild the indexes. That's the ingest skill, and it's a reasoning task. Therefore, it needs the model.

Here's where I hit a wall. A session-end hook cannot run the model inline. By the time it fires the session is over, there's no agent left to think, and the hook's output goes nowhere. It can only run a shell command.

So what do you do? You spawn a fresh, headless agent in the background and let it do the ingest out of band (`brain-ingest-on-end.sh`):

```bash
# 1. never recurse: the headless ingest agent inherits this var
[ "${CLAUDE_WIKI_INGEST:-}" = "1" ] && exit 0
# 2. nothing to do?
grep -rlq 'status: pending-ingest' "$WIKI/raw" || exit 0
# 3. single-writer lock
mkdir "$LOCK" 2>/dev/null || exit 0

# 4. detached, headless ingest; release the lock when done
export WIKI LOCK LOG            # so the single-quoted bash -c child sees them
( nohup bash -c '
    cd "$WIKI"
    CLAUDE_WIKI_INGEST=1 claude -p "Run the wiki ingest op on all
      pending notes and flip each to ingested." \
      --permission-mode bypassPermissions >> "$LOG" 2>&1
    rmdir "$LOCK"
  ' >/dev/null 2>&1 & )
```

Every guard earns its place. The self-trigger guard exists because the headless ingest agent will itself fire a session-end hook when it finishes, which would spawn another ingest, forever. The lock exists because ingest rewrites shared files like the indexes, and two runs at once would corrupt them. The pending check makes the whole thing a no-op when there's nothing new. And the `( nohup ... & )` dance detaches the process so it can outlive the session that launched it, with safe-fail behaviour: if it does get killed, the notes just stay pending and get picked up next time.

I'll be honest, this is the most complicated part of the setup. Running an agent with permission checks bypassed, in the background, on every session exit, is a real trust decision. The saner default for most people is a scheduled batch ingest once a day, or even a manual one. Batching even produces better pages, because the model can dedup and cross-link across many notes at once. I went session-coupled because I wanted the wiki current, but I won't pretend it's the safest choice. There's a subtler risk too: the capture step records session-derived content, and the ingest step runs it through a fully-permissioned agent, so a stray instruction captured into a digest is a prompt-injection waiting to happen. One more reason to prefer a supervised or scheduled ingest.

### Step 3: Recall, at Session Start

The last part brings knowledge back. The session-start hook reads the newest few digests, the raw capture notes, not the compiled wiki pages, and injects them as context, so a new session opens already knowing what the last few produced (`brain-recall-on-start.sh`):

```bash
# grab the 3 most recently written digests
CTX=""
for f in $(ls -1t "$WIKI"/raw/*/notes/*.md | head -n 3); do
  CTX+="$(cat "$f")"$'\n\n'
done

# inject them into the new session as context
jq -n --arg ctx "$CTX" \
  '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":$ctx}}'
```

Here's the question I worked through while building this: my global `CLAUDE.md` already loads on every single session. So why not just put the recent activity in there too? Why a hook?

Because `CLAUDE.md` is static, and this content is dynamic. The recall hook injects "the three newest digests right now," computed fresh each time by reading the directory and sorting by date. A static file can't list the newest files or run a sort. The only way to keep it current would be to rewrite `CLAUDE.md` before every session, which is just a hook by another name, and a worse one, since now you're churning a file that's tracked in git.

But the hook only pushes the *recent* stuff. The hundreds of older compiled pages would be far too much to auto-load, and most are irrelevant to any given task, so instead of pushing them I let the agent pull them on demand. That's where the global `CLAUDE.md` earns its keep a second time. It carries a short protocol that tells the agent to go check the wiki itself before asking me:

```
When a task needs prior context, consult the wiki before asking me:
1. Read wiki/index.md and pick the partition: work, personal, or shared.
2. Open <partition>/index.md, which fans out to concepts, entities, and summaries.
3. Drill into the one or two relevant pages and follow their [[wikilinks]].
4. Not sure which page? Run `qmd query "<your question>"` to search the wiki semantically.
Cap it at a few pages; never read the whole tree.
```

It's the same principle as before: the knowledge is too big to keep resident, but the instructions for how to recall it are tiny and always-true, so they live in `CLAUDE.md`. Step 4 is the one I lean on most. A vague query like "didn't we hit something nasty with retry backoff once?" is exactly what `grep` can't answer but `qmd` can, because it matches on meaning, not just keywords.

With all three hooks in place, I opened a brand new session to see if it actually worked. And there it was: the agent already knew roughly what we'd done the day before, without me typing a single word of context. Great success! 🎉

## Conclusion

If I had to compress the whole design into a few principles, it'd be these.

Capture is cheap, compile is expensive, so separate them. Write everything down fast and unfiltered, then curate deliberately later. Never make the recording step do the thinking.

Hooks enforce, skills reason. Anything that must happen every time is deterministic machinery. Anything that needs judgement is a model-invoked capability. A hook can trigger reasoning, but it shouldn't try to be the reasoning.

Put each kind of knowledge where it belongs. Static facts go where they're always loaded. Dynamic activity needs code to produce it. Bulk knowledge stays out of context until something needs it.

And compress lossy, then reload the gist. The transcript is disposable. The distilled digest is what persists, and it's what comes back. You're not trying to remember the conversation, you're trying to remember its conclusion.

The result is an agent that opens each session knowing roughly where we left off, records what it learned without me asking, and folds it into a structured, searchable knowledge base on its own. It's not magic, and it's not finished. But I've stopped being its memory, and that was the whole point.

If you've ever found yourself re-explaining the same context to your AI tools day after day, I encourage you to try wiring up something similar. Start small with a single hook, capture, and grow from there. Embrace the messy first version, seek help when you need it, and most importantly, enjoy the process of teaching your tools to remember. Happy coding!
