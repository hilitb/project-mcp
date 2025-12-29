# project-mcp

> **Intent-based MCP server for project documentation** — Maps natural language to the right sources automatically

[![npm version](https://img.shields.io/npm/v/project-mcp.svg)](https://www.npmjs.com/package/project-mcp)
[![Node.js](https://img.shields.io/node/v/project-mcp.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**The standard for project documentation search in AI agents.**

When users say "project", "docs", or "todos", `project-mcp` automatically searches the right directories—no configuration needed. It understands intent, not just directory names.

## 🎯 Why project-mcp?

**The Problem:** AI agents need to search project documentation, but:
- Users say "project" not ".project/"
- Different queries need different sources
- Manual source mapping is error-prone

**The Solution:** Intent-based search that maps language to sources automatically:

| User Says | Searches |
|-----------|----------|
| "project" / "the project" | `.project/` + root files + `docs/` |
| "docs" / "documentation" | Only `docs/` |
| "plan" / "todos" / "roadmap" / "status" | Only `.project/` |

**No guessing. No configuration. Just works.**

## ⚡ Quick Start

### Install

```bash
npm install project-mcp
```

### Configure

Add to `.mcp.json`:

```json
{
	"mcpServers": {
		"project": {
			"command": "npx",
			"args": ["-y", "project-mcp"]
		}
	}
}
```

**That's it.** The server automatically finds and indexes:
- `.project/` — Operational truth (plans, todos, status)
- Root markdown files — README.md, DEVELOPMENT.md, etc.
- `docs/` — Reference documentation

## 🚀 Features

### Intent-Based Search

**Natural language maps to sources automatically:**

```javascript
// User: "What's the project status?"
// → Searches only .project/ (operational truth)

// User: "Show me the API docs"
// → Searches only docs/ (reference truth)

// User: "Tell me about the project"
// → Searches all sources (comprehensive)
```

### Multi-Source Indexing

Searches across three sources intelligently:

1. **`.project/`** — Current state, plans, todos, decisions
2. **Root files** — README.md, DEVELOPMENT.md, ARCHITECTURE.md
3. **`docs/`** — Long-form reference documentation

### Smart Detection

Automatically detects intent from query keywords:
- "plan", "todos", "roadmap", "status" → `.project/` only
- "docs", "documentation", "reference" → `docs/` only
- Everything else → All sources

### Fuzzy Search

Powered by [Fuse.js](https://fusejs.io/) for semantic, fuzzy matching with relevance scoring.

## 📖 Usage Examples

### Search Project (All Sources)

```json
{
	"tool": "search_project",
	"arguments": {
		"query": "What is the current project status?"
	}
}
```

**Result:** Searches `.project/STATUS.md`, `.project/TODO.md`, root files, and `docs/` for relevant information.

### Search Documentation Only

```json
{
	"tool": "search_docs",
	"arguments": {
		"query": "API authentication",
		"category": "api"
	}
}
```

**Result:** Searches only `docs/api/` directory.

### Get Specific File

```json
{
	"tool": "get_doc",
	"arguments": {
		"path": ".project/index.md"
	}
}
```

## 🛠️ Available Tools

| Tool | Description | Use When |
|------|-------------|----------|
| `search_project` | Intent-based search across all sources | User says "project" or asks about status/plans |
| `search_docs` | Search reference documentation only | User specifically asks for "docs" |
| `get_doc` | Get full file content | You know the exact file path |
| `list_docs` | List all documentation files | Browsing available docs |
| `get_doc_structure` | Get directory structure | Understanding organization |

## 📁 Expected Project Structure

```
my-project/
├── .project/              # Operational truth
│   ├── index.md          # Contract file (defines mappings)
│   ├── TODO.md           # Current todos
│   ├── ROADMAP.md        # Project roadmap
│   └── STATUS.md          # Current status
│
├── docs/                  # Reference truth
│   ├── architecture/      # Technical architecture
│   ├── api/              # API documentation
│   └── guides/           # How-to guides
│
├── README.md              # Project overview
├── DEVELOPMENT.md         # Development guidelines
└── ARCHITECTURE.md        # High-level architecture
```

## 🎨 Intent Mapping

The server uses a contract file (`.project/index.md`) to define source mappings. This makes the system:

- **Explicit** — No guessing about what "project" means
- **Standardized** — Same contract across all projects
- **Agent-native** — Designed for AI agents, not just humans

### How It Works

1. User query: "What's the project status?"
2. Intent detection: Keywords "status" → intent `plan`
3. Source mapping: `plan` → searches only `.project/`
4. Results: Returns `.project/STATUS.md`, `.project/TODO.md`, etc.

## ⚙️ Configuration

### Custom Documentation Directory

```json
{
	"mcpServers": {
		"project": {
			"command": "npx",
			"args": ["-y", "project-mcp"],
			"env": {
				"DOCS_DIR": "/path/to/documentation"
			}
		}
	}
}
```

### Custom Working Directory

```json
{
	"mcpServers": {
		"project": {
			"command": "npx",
			"args": ["-y", "project-mcp"],
			"cwd": "/path/to/project/root"
		}
	}
}
```

## 🔍 How It Works

### 1. Automatic Indexing

On startup, the server:
- Scans `.project/`, root-level, and `docs/` directories
- Indexes all Markdown files
- Extracts titles, descriptions, and categories
- Builds a fuzzy search index

### 2. Intent Detection

When a query arrives:
- Analyzes keywords in the query
- Maps to intent type (project, docs, plan, etc.)
- Selects appropriate sources

### 3. Smart Search

- Uses Fuse.js for fuzzy matching
- Scores results by relevance
- Returns snippets with context

## 📚 Documentation

- **[Examples](EXAMPLES.md)** — Usage examples and patterns
- **[Contributing](CONTRIBUTING.md)** — How to contribute
- **[Security](SECURITY.md)** — Security policy
- **[Changelog](CHANGELOG.md)** — Version history

## 🧪 Development

```bash
# Clone repository
git clone https://github.com/yourusername/project-mcp.git
cd project-mcp

# Install dependencies
npm install

# Run tests
npm test

# Test the server
node index.js
```

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🌟 Why This Matters

**Before project-mcp:**
- Agents had to guess which directory to search
- Users had to know directory structure
- Manual mapping required for each project

**With project-mcp:**
- Natural language just works
- Intent maps to sources automatically
- Standard contract across all projects
- Zero configuration needed

**This is the new standard for project documentation search in AI agents.**

---

**Made for AI agents. Built for developers. Standard for everyone.**

[Get Started](#-quick-start) • [Documentation](#-documentation) • [Examples](EXAMPLES.md) • [Report Issue](https://github.com/yourusername/project-mcp/issues)
