---
title: Project Knowledge Index
created: '2026-01-01'
updated: '2026-01-01'
---

# Project Knowledge Index

## Contract for AI Agents

When a user says **"project"**, **"the project"**, or **"my project"**, the canonical sources of truth are, in order:

1. **`.project/`** — Current state, plans, todos, decisions, operational truth
2. **Root markdown files** — README.md, DEVELOPMENT.md, ARCHITECTURE.md, etc.
3. **`docs/`** — Long-form reference documentation

## Source Mappings

### "project" / "the project" / "my project"

Searches (in order):

- `.project/` directory
- Root-level markdown files (README.md, DEVELOPMENT.md, ARCHITECTURE.md, etc.)
- `docs/` directory

### "docs" / "documentation" / "reference"

Searches only:

- `docs/` directory

### "plan" / "todos" / "roadmap" / "status" / "operational" / "decisions"

Searches only:

- `.project/` directory

## Principles

- **Natural language stays natural** - Users say "project" not ".project/"
- **Repo stays conventional** - Standard directory names
- **Agents don't guess** - Explicit mappings defined here
- **Intent over structure** - Language maps to intent, not directory names

---

_Last Updated: 2025-01-01_
