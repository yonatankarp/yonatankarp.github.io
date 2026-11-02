---
date: 2026-03-01T00:00:00+01:00
title: "TaleKeeper"
weight: 60
description: "An experiment in tabletop RPG memory: a self-hosted tool that turns local session audio into transcripts, summaries, and searchable campaign records."
projectKind: "Self-hosted experiment"
group: "app"
draft: false
link: "https://yonatankarp.com/TaleKeeper/"
caseStudy: true
tech: ["Python", "FastAPI", "Svelte"]
years: "2026"
params:
    button:
        btnText: "Docs"
---

An experiment: a self-hosted TTRPG session recorder that turns live table audio into searchable campaign memory. The Python/FastAPI backend handles transcription, speaker diarization, and summary generation; the Svelte 5 frontend is for reviewing and looking up sessions at the table.

<!--more-->

## Why it exists

A long tabletop campaign keeps a lot of its state in what people say: names, clues, NPC motives, unresolved promises, and how each character reads them. Notes help, but they often break down during live play, when the same person is trying to listen, decide, perform, and write it all down.

`TaleKeeper` records a session locally, turns the audio into a transcript, separates speakers, and produces a campaign record the group can review, all without sending private play audio through a cloud service.

## How it works

The workflow assumes cleanup after the session. A campaign gets session recordings, transcripts, segments by speaker, generated summaries, and recaps from each character's point of view. Aliases, jokes, interruptions, and table talk need a human pass before the record is useful, which is what the review step is for.

Recording, transcription, diarization, and storage run without an LLM provider. Summaries and generated scene images are optional and use local Ollama where possible, or an OpenAI-compatible image endpoint if the owner configures one.

## How it's built

- Backend: Python 3.11+, FastAPI, SQLite, audio processing, Whisper transcription, speaker diarization, and summary services.
- Frontend: Svelte 5, with a workflow you can use at the table for campaigns, sessions, review, settings, and lookup.
- Runtime: local install or Docker Compose, with persisted `data/` directories for database, audio, and generated images.
- Operations: explicit dependencies on `ffmpeg`, Pango, Node.js, and optional Ollama.

## Current status

- Docs: [yonatankarp.com/TaleKeeper/](https://yonatankarp.com/TaleKeeper/)
- Repository: [github.com/yonatankarp/TaleKeeper](https://github.com/yonatankarp/TaleKeeper)
- Stack: Python, FastAPI, Svelte 5, SQLite, Whisper, diarization, Ollama-compatible local AI
- Status: an experiment I did not use much. The repository is archived, with GitHub Pages enabled.
