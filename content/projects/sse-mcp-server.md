---
date: 2026-01-01T00:00:00+01:00
title: "sse-mcp-server"
weight: 60
description: "A Spring Boot Kotlin MCP bridge that exposes typed tools over Server-Sent Events for Flowise-style agent workflows."
group: "library"
projectKind: "Demo server"
caseStudy: true
draft: false
link: "https://github.com/yonatankarp/sse-mcp-server"
tech: ["Kotlin", "Spring Boot", "MCP", "SSE", "Docker"]
years: "2025"
params:
    button:
        btnText: "GitHub"
---

A Spring Boot Kotlin MCP bridge that exposes backend tools to Flowise-style agents over Server-Sent Events. Tools register through provider interfaces, and the agent connects to an SSE endpoint.

<!--more-->

## The problem

Agent builders often start on a visual workflow canvas before they have a clean boundary for tools. Flowise and LangChain-compatible runtimes can call external tools, but that leaves open where the tool contract lives, how it is discovered, and how the bridge stays understandable as the agent grows.

`sse-mcp-server` exposes an MCP-style server over SSE, so an agent can discover and call backend tools without coupling each one to the workflow canvas.

## Architecture

The server is a Spring Boot Kotlin application with a configurable MCP server. It has:

- an SSE endpoint for agents to connect to
- a message endpoint for tool execution
- a manifest endpoint for automatic tool discovery
- provider-based tool registration so tools can be added without changing the transport
- Docker Compose support for running locally with Flowise

The initial tools are arithmetic and date/time operations, which keeps the example about the integration.

## Trade-offs

This is a small bridge you can read through, with no orchestration of its own. It fits when you need to connect an agent runtime to a controlled set of backend tools.

I chose SSE because it is easy to reason about from a browser-era stack, suits long-lived agent connections, and is simple to debug locally. Richer two-way interaction has to go through the message endpoints or a different transport.

## Details

- Repository: [github.com/yonatankarp/sse-mcp-server](https://github.com/yonatankarp/sse-mcp-server)
- Stack: Kotlin, Spring Boot, Server-Sent Events, MCP-style tool discovery, Docker Compose
- Built-in example tools: math and date/time providers
