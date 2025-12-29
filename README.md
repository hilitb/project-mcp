# project-mcp

> **Intent-based MCP server for project documentation** — Maps natural language to the right sources automatically

[![npm version](https://img.shields.io/npm/v/project-mcp.svg)](https://www.npmjs.com/package/project-mcp)
[![Node.js](https://img.shields.io/node/v/project-mcp.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

**The standard for project documentation search in AI agents.**

When users say "project", "docs", or "todos", `project-mcp` automatically searches the right directories—no configuration needed. It understands intent, not just directory names.

## 🎯 Why project-mcp?

**The Problem:** AI agents need to search project documentation, but:

- Users say "project" not ".project/"
- Different queries need different sources
- Manual source mapping is error-prone
- No standard way to organize project knowledge

**The Solution:** Intent-based search that maps language to sources automatically:

| User Says                               | Searches                           |
| --------------------------------------- | ---------------------------------- |
| "project" / "the project"               | `.project/` + root files + `docs/` |
| "docs" / "documentation"                | Only `docs/`                       |
| "plan" / "todos" / "roadmap" / "status" | Only `.project/`                   |

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

## 🏗️ Project Structure Guide

### Recommended Directory Structure

```
my-project/
├── .project/                    # Operational truth (current state)
│   ├── index.md                 # Contract file (defines source mappings)
│   ├── TODO.md                  # Current todos and tasks
│   ├── ROADMAP.md               # Project roadmap and milestones
│   ├── STATUS.md                 # Current project status
│   └── DECISIONS.md              # Architecture and design decisions
│
├── docs/                         # Reference truth (long-form docs)
│   ├── README.md                 # Documentation index
│   ├── architecture/            # Technical architecture
│   │   ├── OVERVIEW.md
│   │   ├── SYSTEM_DESIGN.md
│   │   └── DATA_MODEL.md
│   ├── api/                      # API documentation
│   │   ├── ENDPOINTS.md
│   │   ├── AUTHENTICATION.md
│   │   └── EXAMPLES.md
│   ├── guides/                   # How-to guides
│   │   ├── SETUP.md
│   │   ├── DEPLOYMENT.md
│   │   └── TROUBLESHOOTING.md
│   └── reference/                # Reference materials
│       └── GLOSSARY.md
│
├── README.md                     # Project overview
├── DEVELOPMENT.md                # Development guidelines
├── ARCHITECTURE.md               # High-level architecture
└── CONTRIBUTING.md               # Contribution guidelines
```

### Visual Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Query                               │
│         "What's the project status?"                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Intent Detection                                │
│  Keywords: "status" → Intent: "plan"                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Source Mapping                                  │
│  Intent "plan" → Search only .project/                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              File Index                                      │
│  .project/STATUS.md                                          │
│  .project/TODO.md                                            │
│  .project/ROADMAP.md                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Fuzzy Search (Fuse.js)                          │
│  Relevance scoring and matching                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Results with Context                            │
│  Snippets, file paths, relevance scores                    │
└─────────────────────────────────────────────────────────────┘
```

### Intent Flow Diagram

```
User Query
    │
    ├─ "project" / "the project"
    │  └─→ Searches: .project/ + root files + docs/
    │
    ├─ "docs" / "documentation"
    │  └─→ Searches: docs/ only
    │
    ├─ "plan" / "todos" / "roadmap" / "status"
    │  └─→ Searches: .project/ only
    │
    └─ Default
       └─→ Searches: All sources
```

### What Goes Where?

#### `.project/` — Operational Truth

**Purpose:** Current state, plans, decisions, and active work.

**Files:**

- `index.md` — Contract file (defines how agents should interpret sources)
- `TODO.md` — Current todos, in-progress work, blockers
- `ROADMAP.md` — Future plans, milestones, upcoming features
- `STATUS.md` — Current project status, recent changes, health
- `DECISIONS.md` — Architecture decisions, trade-offs, rationale

**Characteristics:**

- Frequently updated
- Time-sensitive information
- Action-oriented
- Current state, not historical

#### `docs/` — Reference Truth

**Purpose:** Long-form documentation, guides, and reference materials.

**Files:**

- Architecture documentation
- API references
- How-to guides
- Technical specifications
- Reference materials

**Characteristics:**

- Stable, less frequently changed
- Comprehensive and detailed
- Reference-oriented
- Historical context included

#### Root-Level Files

**Purpose:** High-level overview and entry points.

**Files:**

- `README.md` — Project overview, quick start
- `DEVELOPMENT.md` — Development setup and guidelines
- `ARCHITECTURE.md` — High-level system architecture
- `CONTRIBUTING.md` — How to contribute

## 📝 Documentation Examples

### Example: `.project/index.md` (Contract File)

```markdown
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

### "plan" / "todos" / "roadmap" / "status" / "operational"

Searches only:

- `.project/` directory

## Principles

- **Natural language stays natural** - Users say "project" not ".project/"
- **Repo stays conventional** - Standard directory names
- **Agents don't guess** - Explicit mappings defined here
- **Intent over structure** - Language maps to intent, not directory names
```

### Example: `.project/TODO.md`

```markdown
# TODO

## In Progress

- [ ] Implement user authentication system
  - [ ] OAuth integration
  - [ ] Session management
  - [ ] Password reset flow
- [ ] Add API rate limiting
  - [ ] Redis-based rate limiter
  - [ ] Per-user quotas

## Next Up

- [ ] Database migration for new schema
- [ ] Update API documentation
- [ ] Add integration tests

## Blocked

- [ ] Payment integration (waiting on Stripe API access)
- [ ] Email service setup (pending domain verification)

## Completed

- [x] Initial project setup
- [x] CI/CD pipeline configuration
- [x] Basic API endpoints
```

### Example: `.project/ROADMAP.md`

```markdown
# Project Roadmap

## Q1 2025

### Phase 1: Foundation (Weeks 1-4)

- Core infrastructure setup
- Authentication system
- Basic API endpoints
- Database schema design

### Phase 2: Core Features (Weeks 5-8)

- User management
- Data ingestion pipeline
- Basic analytics dashboard

## Q2 2025

### Phase 3: Advanced Features

- Real-time updates
- Advanced analytics
- Third-party integrations

## Future Considerations

- Mobile app development
- Internationalization
- Enterprise features
```

### Example: `.project/STATUS.md`

```markdown
# Project Status

**Last Updated:** December 29, 2024

## Current Phase

**Foundation** - Setting up core infrastructure

## Health

🟢 **Green** - All systems operational

## Recent Changes

- ✅ Completed initial MCP server implementation
- ✅ Set up CI/CD pipeline
- 🔄 In progress: Documentation structure
- 📋 Planned: User authentication

## Metrics

- Test Coverage: 85%
- Build Status: Passing
- Deployment: Stable

## Risks & Blockers

- None currently

## Next Milestone

Complete documentation structure by January 15, 2025
```

### Example: `docs/architecture/OVERVIEW.md`

```markdown
# System Architecture Overview

## High-Level Design

Our system follows a microservices architecture with the following components:

### Services

1. **API Gateway** - Routes requests to appropriate services
2. **User Service** - Handles authentication and user management
3. **Data Service** - Manages data ingestion and processing
4. **Analytics Service** - Provides analytics and reporting

### Data Flow
```

User Request → API Gateway → Service → Database
↓
Cache Layer

```

## Technology Stack

- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Cache:** Redis
- **Queue:** RabbitMQ

## Scalability

The system is designed to scale horizontally by:
- Stateless services
- Load balancing
- Database sharding
- Caching strategy
```

### Example: `docs/api/ENDPOINTS.md`

````markdown
# API Endpoints

## Authentication

### POST /api/auth/login

Authenticate a user and receive a JWT token.

**Request:**

```json
{
	"email": "user@example.com",
	"password": "password123"
}
```
````

**Response:**

```json
{
	"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	"user": {
		"id": 1,
		"email": "user@example.com"
	}
}
```

## Users

### GET /api/users

List all users (requires authentication).

**Query Parameters:**

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Response:**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100
  }
}
```

````

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
````

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

| Tool                | Description                            | Use When                                       |
| ------------------- | -------------------------------------- | ---------------------------------------------- |
| `search_project`    | Intent-based search across all sources | User says "project" or asks about status/plans |
| `search_docs`       | Search reference documentation only    | User specifically asks for "docs"              |
| `get_doc`           | Get full file content                  | You know the exact file path                   |
| `list_docs`         | List all documentation files           | Browsing available docs                        |
| `get_doc_structure` | Get directory structure                | Understanding organization                     |

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
git clone https://github.com/pouyanafisi/project-mcp.git
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
- No standard for organizing project knowledge

**With project-mcp:**

- Natural language just works
- Intent maps to sources automatically
- Standard contract across all projects
- Zero configuration needed
- Clear separation: operational vs. reference truth

**This is the new standard for project documentation search in AI agents.**

## 🎓 Getting Started Guide

### Step 1: Install

```bash
npm install project-mcp
```

### Step 2: Configure

Add to your `.mcp.json`:

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

### Step 3: Create `.project/index.md`

Create `.project/index.md` with the contract (see example above).

### Step 4: Organize Your Documentation

- Create `.project/` for operational truth
- Use `docs/` for reference documentation
- Keep root-level files for overview

### Step 5: Restart Your MCP Client

Restart Cursor, Claude Desktop, or your MCP client to load the server.

### Step 6: Test It

Ask your AI agent: "What's the project status?" or "Show me the API docs"

## 📊 Comparison

| Feature              | project-mcp | Manual Setup | Other Tools |
| -------------------- | ----------- | ------------ | ----------- |
| Intent-based search  | ✅          | ❌           | ❌          |
| Multi-source support | ✅          | Manual       | Limited     |
| Zero configuration   | ✅          | ❌           | ❌          |
| Standard contract    | ✅          | ❌           | ❌          |
| Automatic indexing   | ✅          | Manual       | Varies      |
| Fuzzy search         | ✅          | Manual       | Some        |

---

**Made for AI agents. Built for developers. Standard for everyone.**

[Get Started](#-quick-start) • [Documentation](#-documentation) • [Examples](EXAMPLES.md) • [Report Issue](https://github.com/pouyanafisi/project-mcp/issues)
