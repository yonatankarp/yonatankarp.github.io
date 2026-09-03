---
date: 2026-03-01T00:00:00+01:00
title: "TaleKeeper"
weight: 30
description: "A self-hosted tabletop RPG memory tool that turns local session audio into transcripts, speaker-aware review, summaries, and searchable campaign records."
featured: true
projectKind: "Self-hosted tool"
group: "project"
draft: false
link: "https://yonatankarp.github.io/TaleKeeper/"
caseStudy: true
tech: ["Python", "FastAPI", "Svelte"]
years: "2026–present"
build:
  list: local
params:
    button:
        icon: "icon-arrow-right"
        btnText: "Docs"
        URL: "https://yonatankarp.github.io/TaleKeeper/"
---

Self-hosted TTRPG session recorder that turns live table audio into searchable campaign memory. The Python/FastAPI backend handles transcription, speaker diarization, and summary generation; the Svelte 5 frontend keeps review and session lookup usable at the table.

<!--more-->

## Why it exists

Long-running tabletop campaigns accumulate a lot of important state in spoken form: names, clues, NPC motives, unresolved promises, and character-specific interpretations. Notes help, but they often break down during live play because the same person is trying to listen, decide, perform, and document.

`TaleKeeper` treats the table itself as the source of record. It records a session locally, turns the audio into a transcript, separates speakers, and produces reviewable campaign memory without requiring the group to send private play audio through a cloud service.

## Product shape

The core workflow is designed around post-session cleanup rather than perfect automation. A campaign gets session recordings, transcripts, speaker-aware segments, generated summaries, and character point-of-view recaps. The review surface matters because RPG memory is messy: aliases, jokes, interruptions, and table talk need a human pass before the record becomes useful.

That local-first boundary is deliberate. Recording, transcription, diarization, and storage can run independently of an LLM provider. Summaries and generated scene images are optional layers, using local Ollama where possible or an OpenAI-compatible image endpoint when the owner chooses to configure one.

## Engineering shape

- Backend: Python 3.11+, FastAPI, SQLite, audio processing, Whisper transcription, speaker diarization, and summary services.
- Frontend: Svelte 5 with a table-usable workflow for campaigns, sessions, review, settings, and lookup.
- Runtime: local install or Docker Compose, with persisted `data/` directories for database, audio, and generated images.
- Operations: explicit dependencies on `ffmpeg`, Pango, Node.js, and optional Ollama so the deployment model stays inspectable.

## Current status

- Docs: [yonatankarp.github.io/TaleKeeper/](https://yonatankarp.github.io/TaleKeeper/)
- Repository: [github.com/yonatankarp/TaleKeeper](https://github.com/yonatankarp/TaleKeeper)
- Public repo status: archived, GitHub Pages-enabled, three open issues as of August 14, 2026
- Stack: Python, FastAPI, Svelte 5, SQLite, Whisper, diarization, Ollama-compatible local AI

## Why it matters

The interesting part is not just transcription. It is the product boundary: useful campaign memory needs audio ingestion, ML processing, human correction, storage, and retrieval to line up without turning a hobby table into an enterprise workflow. `TaleKeeper` is a compact example of designing local AI around a real social setting where privacy, reviewability, and low ceremony matter.
