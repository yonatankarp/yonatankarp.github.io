---
date: 2026-10-04T00:00:00+01:00
title: "Lorekeeper"
weight: 14
description: "Hotkey session notes for D&D players, kept as plain Markdown, with end-to-end encrypted sync for a party. A Tauri app with a small Rust sync server."
projectKind: "Desktop app"
group: "app"
draft: false
link: "https://yonatankarp.github.io/lorekeeper/"
caseStudy: true
tech: ["Rust", "Tauri", "JavaScript"]
years: "2026–present"
params:
    button:
        btnText: "Docs"
---

Lorekeeper is a desktop app for D&D session notes. A global hotkey opens a one-line note box over any app, notes land in a folder of plain Markdown files, and a small Rust server syncs a shared campaign without being able to read it.

<!--more-->

## The problem

Notes get taken during the game, so the note box has to work without leaving Discord. The first character of a note files it: `@` for an NPC, `#` loot, `!` a quest, `?` a mystery, `"` a quote. A campaign is a folder of Markdown with `[[links]]` that Obsidian can open, and a party can share one.

## Architecture

The app is Tauri 2: Rust in `src-tauri/`, and a UI of plain JavaScript modules with no framework and vendored CodeMirror and marked. Vault logic has no DOM in it, so it is tested in Node. A thread checks the folder every 3 seconds, which is how edits made in Obsidian reach the windows. `sync-server` (axum and SQLite) and the app's sync engine share `sync-protocol`, a crate for message types, encryption, ids and invite links.

## Sync

The owner's app makes a 32-byte key for each shared campaign and never sends it to the server. It travels in the fragment of the invite link, which browsers and HTTP clients don't send, and stays in the OS keychain. There are no accounts: the server hands out tokens and stores only their SHA-256.

Each file is a blob sealed with XChaCha20-Poly1305, and its id is a keyed BLAKE3 hash of its path, so the server sees neither names nor content. Known-answer tests in `sync-protocol` freeze these byte formats.

Writes go over a WebSocket. A `put` names the `seq` it was based on. If the file has moved on, the server answers `conflict` and the app saves the other version next to yours. Every player writes their own session file, so taking notes together doesn't conflict.

Any web page can open a `lorekeeper://` deep link, so `deeplink.rs` parses it strictly and only fills in the Join dialog. `sync_tests.rs` runs the engine against the real server in-process, including a rogue member.

## Trade-offs

The server can't check blobs, so anyone holding a token can overwrite a file with garbage or delete it, though they can't read or forge content.

Private notes rely on access control: they are sealed with the same room key, and the server delivers them only to their author and, if the owner allows it, to DMs. That avoids personal keys and recovery codes.

It isn't a live co-editor, so two people changing the same NPC page end up with two versions. The reference server runs on my own machine. Its address is a setting, and the image is published so anyone can run their own.

## Current shape

- Docs: [yonatankarp.github.io/lorekeeper/](https://yonatankarp.github.io/lorekeeper/)
- Repository: [github.com/yonatankarp/lorekeeper](https://github.com/yonatankarp/lorekeeper)
- Status: pre-1.0 releases for macOS, Windows and Linux
- Stack: Rust, Tauri 2, JavaScript, CodeMirror, axum, SQLite
