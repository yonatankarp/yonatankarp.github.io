---
date: 2026-09-28T00:00:00+01:00
title: "Mimic"
weight: 12
description: "A Mac app and CLI that turns a picture or a description into a 3D-printable miniature, with local models and print prep written in Swift."
projectKind: "Mac app"
group: "project"
draft: false
link: "https://yonatankarp.github.io/mimic/"
caseStudy: true
tech: ["Swift", "SwiftUI", "Apple Vision"]
years: "2026–present"
params:
    button:
        btnText: "Docs"
---

Mimic makes a printable miniature on your own Mac. A prebuilt C++ engine builds the 3D model on the graphics chip, and everything around it, including print prep, is Swift. The app and the `mimic` command are one binary.

<!--more-->

## The problem

An image-to-3D model returns a shape with no real size, and often with hollow insides, loose pieces and a copy of whatever base was in the picture. A slicer needs one closed solid at a known height, standing on a base. Mimic covers the route from picture to STL, and pictures and minis stay on the Mac unless you choose an online picture service or a cloud AI helper.

## Architecture

A mini is a job of three steps:

- Picture: FLUX.2 Klein, through Draw Things or an online service, draws a description or redraws a picture as a grey sculpt.
- Shape: Apple Vision cuts out the figure, then `trellis-cli`, built from pixal3d.cpp for Metal, writes `model.glb`.
- Print: `mimic _prep` writes the STL and its previews.

The last two run Mimic's own binary as a separate program. Foundation's `Process` can't give a child its own process group, so `GroupProcess` uses `posix_spawn` with `POSIX_SPAWN_SETSID`, and Stop signals the whole group. Jobs run at `nice 10`, and a step whose file already exists is skipped, which is how Try Again resumes.

`MimicCore` has no SwiftUI in it, so jobs, the pipeline and print prep run under `swift test`.

## Print prep

Print prep replaced a Blender script: on one 32 mm figure, 58 s and 6.0 GB became 6 s and 1.5 GB. The model becomes a signed distance field, built in slabs so memory follows the surface, with inside decided by winding along grid columns so overlapping parts union. Inflate, base and the flat cut all happen in the field, then marching cubes draws one surface, closed and manifold by construction.

Only the largest connected piece is kept. A piece with negative volume is the inner wall of a hollow, and dropping it fills the hollow. A solid piece at least 10% of the figure's height is probably something the generator didn't join to the hands, so it is left out with a warning.

## Trade-offs

TRELLIS.2 is the default 3D model because it keeps what a figure holds: in my comparison it got the held part right 9 times out of 9, against 4 out of 10 for Pixal3D. Pixal3D is faster with a crisper surface, and cartoons always use it.

Running locally needs Apple silicon, macOS 26, 32 GB of memory and about 25 GB of disk, and a mini takes roughly 8 to 15 minutes. Downloads are pinned to a fixed address, size and SHA-256. The app isn't registered with Apple, so the first launch needs an extra step in System Settings.

## Current shape

- Docs: [yonatankarp.github.io/mimic/](https://yonatankarp.github.io/mimic/)
- Repository: [github.com/yonatankarp/mimic](https://github.com/yonatankarp/mimic)
- Status: pre-1.0 releases
- License: MIT
- Stack: Swift, SwiftUI, Apple Vision, pixal3d.cpp on Metal, Sparkle for updates
