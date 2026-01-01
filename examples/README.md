# Examples

This directory contains example files demonstrating how to structure your project with the MCP Project Server.

## `.project/` Directory Structure

The `.project/` directory is the operational hub for your project. Here's what each file/directory does:

```
.project/
├── .gitignore           # Optional: exclude sensitive files from git
├── index.md             # Contract file - defines how agents interpret sources
├── BACKLOG.md           # Future work not yet promoted to active tasks
├── DECISIONS.md         # Architecture Decision Records (ADRs)
├── ROADMAP.md           # High-level milestones and phases
├── STATUS.md            # Current project health and status
├── TODO.md              # Auto-generated dashboard of all tasks
├── thoughts/            # Brain dump area for unstructured notes
│   └── todos/           # To-do brain dumps to be processed
│       └── *.md         # Free-form markdown files
└── todos/               # Active task files with YAML frontmatter
    ├── PROJECT-001.md
    ├── PROJECT-002.md
    └── ...
```

## File Descriptions

### `index.md`

The "contract" file that tells AI agents how to interpret natural language queries like "what's the project status?" Maps user intent to appropriate source directories.

### `BACKLOG.md`

Items that have been identified but not yet promoted to active work. Organized by priority (P0-P3). Use `promote_task` to move items to `todos/`.

### `DECISIONS.md`

Architecture Decision Records (ADRs). Documents important technical decisions with context, the decision itself, and consequences.

### `ROADMAP.md`

High-level view of project phases and milestones. Shows what's planned for each phase and tracks overall progress.

### `STATUS.md`

Current project health at a glance. Updated regularly with status changes, blockers, and metrics.

### `TODO.md`

Auto-generated dashboard summarizing all active tasks. Created/updated by the `sync_todo_index` tool.

### `thoughts/todos/`

**This is where the `process_thoughts` tool reads from.**

Drop unstructured markdown files here with your brain dumps, random thoughts, or rough todo lists. The `process_thoughts` tool will analyze them and convert them into properly structured YAML tasks.

Example brain dump:

```markdown
# Random thoughts

- [ ] Need to fix that login bug - urgent!
- Should add caching to the API calls
- Users are complaining about slow load times, might be the database queries
```

### `todos/`

Active task files with YAML frontmatter. Each task is a single markdown file with structured metadata:

```yaml
---
id: PROJECT-001
title: Implement feature X
project: PROJECT
priority: P1
status: todo
owner: unassigned
depends_on: []
blocked_by: []
tags: [feature, phase-1]
created: '2025-01-01'
updated: '2025-01-01'
estimate: 4h
---
# PROJECT-001: Implement feature X

## Description
...

## Subtasks
- [ ] Step 1
- [ ] Step 2

## Notes
```

## Getting Started

1. Create a `.project/` directory in your project root
2. Copy the example files as a starting point
3. Use the MCP tools to manage your project:
   - `init_project` - Set up the directory structure
   - `create_task` - Create new tasks
   - `process_thoughts` - Convert brain dumps to tasks
   - `sync_todo_index` - Update the TODO.md dashboard

## Workflow

1. **Brain dump** → Write messy notes in `.project/thoughts/todos/`
2. **Process** → Run `process_thoughts` to analyze and structure them
3. **Refine** → Review generated tasks and adjust as needed
4. **Work** → Use `get_next_task` to find what to do next
5. **Update** → Mark progress with `update_task`
6. **Archive** → Move completed tasks with `archive_task`
