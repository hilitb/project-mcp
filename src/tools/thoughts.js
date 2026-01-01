/**
 * Thought processing tools.
 * Handles: process_thoughts, list_thoughts, get_thought, archive_thought, list_archived_thoughts
 *
 * This tool reads brain dump files and provides context for the LLM to analyze.
 * The LLM does the natural language understanding - the tool just gathers data.
 */

import { readdir } from 'fs/promises';
import { THOUGHTS_TODOS_DIR, THOUGHTS_ARCHIVE_DIR } from '../lib/constants.js';
import {
	readFile,
	writeFile,
	rename,
	join,
	fileExists,
	ensureThoughtsTodosDir,
	ensureThoughtsArchiveDir,
	matter,
} from '../lib/files.js';
import { getISODate, getCurrentDate } from '../lib/dates.js';
import { loadAllTasks } from '../lib/tasks.js';
import { loadAllFiles, getCachedFiles } from '../lib/search.js';

const ARCHIVE_LOG_FILE = '.archive-log.md';

/**
 * Tool definitions
 */
export const definitions = [
	{
		name: 'process_thoughts',
		description: `Reads brain dump markdown files from .project/thoughts/todos/ and returns the content along with project context for analysis.

This tool gathers:
1. **Raw thought content** - The unstructured brain dump as written
2. **Project context** - Existing tasks, roadmap milestones, decisions for reference
3. **Task format guide** - The YAML structure for creating tasks

YOU (the LLM) should then analyze the content to:
- Understand the user's intent (explicit, shadow/underlying, practical)
- Identify logical task groupings (consolidate related items)
- Determine appropriate priorities based on context
- Create well-structured tasks using create_task
- **After creating tasks, use archive_thought to archive the processed file**

The tool does NOT automatically create tasks - it provides you with everything needed to make intelligent decisions about task creation.`,
		inputSchema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					description:
						'Specific thought file to process (e.g., "my-ideas.md"). If not provided, processes all files in thoughts/todos/.',
				},
				project: {
					type: 'string',
					description: 'Project prefix for task IDs when you create tasks (e.g., "AUTH", "API").',
				},
			},
			required: ['project'],
		},
	},
	{
		name: 'archive_thought',
		description: `Archives a processed thought file by moving it to .project/thoughts/todos/.archive/. 
Use this after you've created tasks from a thought file to keep the active thoughts folder clean.
Also logs the archive action with timestamp and created task IDs.`,
		inputSchema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					description: 'The thought file to archive (e.g., "my-ideas.md").',
				},
				created_tasks: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of task IDs that were created from this thought (e.g., ["AUTH-001", "AUTH-002"]).',
				},
				notes: {
					type: 'string',
					description: 'Optional notes about the processing (e.g., "Consolidated 5 items into 2 tasks").',
				},
			},
			required: ['file'],
		},
	},
	{
		name: 'list_thoughts',
		description:
			'Lists all thought files in the .project/thoughts/ directory structure. Shows available brain dump files organized by category.',
		inputSchema: {
			type: 'object',
			properties: {
				category: {
					type: 'string',
					description: 'Optional: Filter by thought category. Currently supported: "todos".',
					enum: ['todos', ''],
				},
				include_archived: {
					type: 'boolean',
					description: 'Include archived thoughts in the listing. Default: false.',
					default: false,
				},
			},
		},
	},
	{
		name: 'list_archived_thoughts',
		description:
			'Lists all archived thought files with their processing history. Shows what thoughts were processed, when, and what tasks were created.',
		inputSchema: {
			type: 'object',
			properties: {
				limit: {
					type: 'number',
					description: 'Maximum number of archived thoughts to show. Default: 20.',
					default: 20,
				},
			},
		},
	},
	{
		name: 'get_thought',
		description: 'Reads a specific thought file and returns its raw content for review.',
		inputSchema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					description: 'The thought file to read (e.g., "my-ideas.md").',
				},
				category: {
					type: 'string',
					description: 'The category/subdirectory. Default: "todos".',
					default: 'todos',
				},
				from_archive: {
					type: 'boolean',
					description: 'Read from archive instead of active thoughts. Default: false.',
					default: false,
				},
			},
			required: ['file'],
		},
	},
];

/**
 * Get project context for the LLM
 */
async function getProjectContext() {
	const context = {
		existingTasks: [],
		roadmap: null,
		decisions: [],
		status: null,
	};

	try {
		// Load existing tasks
		const tasks = await loadAllTasks();
		context.existingTasks = tasks.map(t => ({
			id: t.id,
			title: t.title,
			status: t.status,
			priority: t.priority,
			tags: t.tags || [],
		}));

		// Load project files
		await loadAllFiles();
		const files = getCachedFiles();

		// Get roadmap content
		const roadmapFile = files.find(f => f.path.includes('ROADMAP'));
		if (roadmapFile) {
			context.roadmap = roadmapFile.content.substring(0, 2000);
		}

		// Get decisions
		const decisionsFile = files.find(f => f.path.includes('DECISIONS'));
		if (decisionsFile) {
			const adrs = decisionsFile.content.match(/## ADR-\d+: [^\n]+/g) || [];
			context.decisions = adrs.map(a => a.replace('## ', ''));
		}

		// Get current status
		const statusFile = files.find(f => f.path.includes('STATUS'));
		if (statusFile) {
			context.status = statusFile.content.substring(0, 1000);
		}
	} catch {
		// Context loading failed, continue without it
	}

	return context;
}

/**
 * Process thoughts handler - returns data for LLM analysis
 */
async function processThoughts(args) {
	const { file, project } = args;

	await ensureThoughtsTodosDir();

	// Get files to process
	let filesToProcess = [];
	if (file) {
		const filePath = join(THOUGHTS_TODOS_DIR, file);
		if (!(await fileExists(filePath))) {
			return {
				content: [
					{
						type: 'text',
						text: `❌ File not found: ${file}\n\nUse \`list_thoughts\` to see available files.`,
					},
				],
				isError: true,
			};
		}
		filesToProcess.push({ name: file, path: filePath });
	} else {
		try {
			const files = await readdir(THOUGHTS_TODOS_DIR);
			filesToProcess = files
				.filter(f => f.endsWith('.md') && !f.startsWith('.'))
				.map(f => ({ name: f, path: join(THOUGHTS_TODOS_DIR, f) }));
		} catch {
			// Directory might not exist yet
		}
	}

	if (filesToProcess.length === 0) {
		return {
			content: [
				{
					type: 'text',
					text: `⚠️ No thought files found in \`.project/thoughts/todos/\`\n\nCreate markdown files with your brain dumps, then run this tool to process them.`,
				},
			],
		};
	}

	// Read all thought files
	const thoughtContents = [];
	for (const thoughtFile of filesToProcess) {
		const content = await readFile(thoughtFile.path, 'utf-8');
		const parsed = matter(content);
		thoughtContents.push({
			filename: thoughtFile.name,
			content: parsed.content,
			frontmatter: parsed.data,
		});
	}

	// Get project context
	const projectContext = await getProjectContext();

	// Build the response for the LLM
	let result = `# Thought Processing Data

## Instructions for You (the LLM)

Analyze the thought content below and create appropriate tasks. Consider:

1. **Intent Analysis**
   - **Explicit intent**: What does the user literally say they want?
   - **Shadow intent**: What's the underlying motivation? Why do they want this?
   - **Practical intent**: What concrete actions are needed?

2. **Task Consolidation**
   - Group related items into single tasks with subtasks
   - Don't create a separate task for every bullet point
   - Section headers often indicate a logical task grouping

3. **Priority Assessment**
   - P0: Critical/blocker/urgent - system down, security issue
   - P1: High priority - important, needed soon
   - P2: Medium (default) - normal work items
   - P3: Low - nice to have, eventually

4. **Use \`create_task\` to create tasks** with this structure:
   - title: Clear, actionable task title
   - project: "${project.toUpperCase()}"
   - description: Include context and subtasks
   - priority: P0-P3 based on your analysis
   - tags: Relevant categorization
   - subtasks: Array of subtask strings (for consolidated items)

5. **After creating tasks, archive the thought file** using \`archive_thought\`:
   - Pass the filename and array of created task IDs
   - This keeps the thoughts folder clean and maintains a processing log

---

## Thought Files to Process

`;

	for (const thought of thoughtContents) {
		result += `### File: ${thought.filename}\n\n`;
		result += '```markdown\n';
		result += thought.content;
		result += '\n```\n\n';
	}

	result += `---

## Project Context

Use this to understand what already exists and align new tasks appropriately.

### Existing Tasks (${projectContext.existingTasks.length} total)

`;

	if (projectContext.existingTasks.length > 0) {
		result += '| ID | Title | Status | Priority |\n';
		result += '|----|-------|--------|----------|\n';
		for (const task of projectContext.existingTasks.slice(0, 20)) {
			result += `| ${task.id} | ${task.title.substring(0, 40)}${task.title.length > 40 ? '...' : ''} | ${task.status} | ${task.priority} |\n`;
		}
		if (projectContext.existingTasks.length > 20) {
			result += `\n*...and ${projectContext.existingTasks.length - 20} more tasks*\n`;
		}
	} else {
		result += '*No existing tasks*\n';
	}

	if (projectContext.roadmap) {
		result += `\n### Roadmap Overview\n\n`;
		result += '```\n' + projectContext.roadmap + '\n```\n';
	}

	if (projectContext.decisions.length > 0) {
		result += `\n### Architecture Decisions\n\n`;
		for (const decision of projectContext.decisions) {
			result += `- ${decision}\n`;
		}
	}

	const filenames = thoughtContents.map(t => t.filename).join('", "');
	result += `
---

## Your Task

Now analyze the thought content above and:

1. Identify the distinct tasks/initiatives (consolidate related items)
2. For each task, determine title, priority, and relevant context
3. Use \`create_task\` to create well-structured tasks
4. **After creating tasks, use \`archive_thought\`** to archive each processed file:
   \`\`\`
   archive_thought(file: "${thoughtContents[0]?.filename || 'filename.md'}", created_tasks: ["${project.toUpperCase()}-001", ...])
   \`\`\`

Remember: Quality over quantity. Create fewer, well-scoped tasks rather than many granular ones.
`;

	return {
		content: [{ type: 'text', text: result }],
	};
}

/**
 * Archive thought handler
 */
async function archiveThought(args) {
	const { file, created_tasks = [], notes } = args;

	await ensureThoughtsTodosDir();
	await ensureThoughtsArchiveDir();

	const sourcePath = join(THOUGHTS_TODOS_DIR, file);
	const archivePath = join(THOUGHTS_ARCHIVE_DIR, file);
	const logPath = join(THOUGHTS_ARCHIVE_DIR, ARCHIVE_LOG_FILE);

	// Check if file exists
	if (!(await fileExists(sourcePath))) {
		return {
			content: [
				{
					type: 'text',
					text: `❌ File not found: ${file}\n\nUse \`list_thoughts\` to see available files.`,
				},
			],
			isError: true,
		};
	}

	// Read the original content for the log
	const originalContent = await readFile(sourcePath, 'utf-8');
	const lineCount = originalContent.split('\n').length;

	// Move file to archive
	await rename(sourcePath, archivePath);

	// Update archive log
	let logContent = '';
	try {
		if (await fileExists(logPath)) {
			logContent = await readFile(logPath, 'utf-8');
		}
	} catch {
		// Log file doesn't exist yet
	}

	// Create log entry
	const logEntry = `
## ${file}

**Archived:** ${getCurrentDate()}
**Original Lines:** ${lineCount}
**Tasks Created:** ${created_tasks.length > 0 ? created_tasks.join(', ') : 'None specified'}
${notes ? `**Notes:** ${notes}` : ''}

---
`;

	// Prepend new entry to log (newest first)
	if (!logContent.includes('# Thought Archive Log')) {
		logContent = `# Thought Archive Log

This file tracks all processed thoughts and the tasks created from them.

---
${logEntry}`;
	} else {
		logContent = logContent.replace(
			'---\n',
			`---
${logEntry}`
		);
	}

	await writeFile(logPath, logContent, 'utf-8');

	let result = `## Thought Archived: ${file}\n\n`;
	result += `**Moved to:** \`.project/thoughts/todos/.archive/${file}\`\n`;
	result += `**Archived:** ${getCurrentDate()}\n`;
	result += `**Lines:** ${lineCount}\n`;

	if (created_tasks.length > 0) {
		result += `\n**Tasks Created:**\n`;
		for (const taskId of created_tasks) {
			result += `- ${taskId}\n`;
		}
	}

	if (notes) {
		result += `\n**Notes:** ${notes}\n`;
	}

	result += `\n✅ Thought file archived successfully. Use \`list_archived_thoughts\` to see archive history.`;

	return {
		content: [{ type: 'text', text: result }],
	};
}

/**
 * List archived thoughts handler
 */
async function listArchivedThoughts(args) {
	const { limit = 20 } = args || {};

	await ensureThoughtsArchiveDir();

	let result = `## Archived Thoughts\n\n`;
	result += `**Path:** \`.project/thoughts/todos/.archive/\`\n\n`;

	// Read archive log if exists
	const logPath = join(THOUGHTS_ARCHIVE_DIR, ARCHIVE_LOG_FILE);
	let logContent = '';

	try {
		if (await fileExists(logPath)) {
			logContent = await readFile(logPath, 'utf-8');
		}
	} catch {
		// Log doesn't exist
	}

	if (logContent) {
		result += `### Archive Log\n\n`;
		// Show the log content (it's already formatted)
		const entries = logContent.split('## ').slice(1, limit + 1);
		for (const entry of entries) {
			result += `## ${entry}\n`;
		}
	}

	// Also list actual files in archive
	try {
		const files = await readdir(THOUGHTS_ARCHIVE_DIR);
		const mdFiles = files.filter(f => f.endsWith('.md') && f !== ARCHIVE_LOG_FILE);

		if (mdFiles.length > 0) {
			result += `\n### Archived Files (${mdFiles.length})\n\n`;
			result += `| File | Size |\n`;
			result += `|------|------|\n`;
			for (const file of mdFiles.slice(0, limit)) {
				const filePath = join(THOUGHTS_ARCHIVE_DIR, file);
				const content = await readFile(filePath, 'utf-8');
				const lines = content.split('\n').length;
				result += `| ${file} | ${lines} lines |\n`;
			}
		}
	} catch {
		// Archive directory might not exist
	}

	if (!logContent && result.includes('Archived Files') === false) {
		result += `*No archived thoughts yet. Use \`archive_thought\` after processing thoughts.*\n`;
	}

	result += `\n---\n`;
	result += `**Tools:** \`get_thought\` with \`from_archive: true\` to read archived files`;

	return {
		content: [{ type: 'text', text: result }],
	};
}

/**
 * List thoughts handler
 */
async function listThoughts(args) {
	const { category, include_archived = false } = args || {};

	await ensureThoughtsTodosDir();

	const categories = category ? [category] : ['todos'];
	const results = {};

	for (const cat of categories) {
		const catDir = cat === 'todos' ? THOUGHTS_TODOS_DIR : join(THOUGHTS_TODOS_DIR, '..', cat);

		try {
			if (await fileExists(catDir)) {
				const files = await readdir(catDir);
				const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

				results[cat] = [];
				for (const file of mdFiles) {
					const filePath = join(catDir, file);
					const content = await readFile(filePath, 'utf-8');
					const lines = content.split('\n').length;
					const todoCount = (content.match(/^[-*]\s*\[[ x]\]/gm) || []).length;

					results[cat].push({
						name: file,
						lines,
						todoCount,
					});
				}
			}
		} catch {
			// Category directory might not exist
		}
	}

	let result = `## Thoughts Directory\n\n`;
	result += `**Path:** \`.project/thoughts/\`\n\n`;

	let totalFiles = 0;

	for (const [cat, files] of Object.entries(results)) {
		result += `### 📁 ${cat}/\n\n`;

		if (files.length === 0) {
			result += `*No files yet. Create \`.project/thoughts/${cat}/your-thoughts.md\` to get started.*\n\n`;
		} else {
			result += `| File | Lines | Checkboxes |\n`;
			result += `|------|-------|------------|\n`;
			for (const file of files) {
				result += `| ${file.name} | ${file.lines} | ${file.todoCount} |\n`;
				totalFiles++;
			}
			result += '\n';
		}
	}

	// Show archived count if requested
	if (include_archived) {
		try {
			await ensureThoughtsArchiveDir();
			const archivedFiles = await readdir(THOUGHTS_ARCHIVE_DIR);
			const archivedMd = archivedFiles.filter(f => f.endsWith('.md') && f !== ARCHIVE_LOG_FILE);
			if (archivedMd.length > 0) {
				result += `### 📦 .archive/ (${archivedMd.length} files)\n\n`;
				result += `Use \`list_archived_thoughts\` to see details.\n\n`;
			}
		} catch {
			// Archive doesn't exist
		}
	}

	result += `---\n`;
	result += `**Total active files:** ${totalFiles}\n\n`;
	result += `**Tools:** \`get_thought\` to read | \`process_thoughts\` to analyze | \`archive_thought\` after processing`;

	return {
		content: [{ type: 'text', text: result }],
	};
}

/**
 * Get thought handler
 */
async function getThought(args) {
	const { file, category = 'todos', from_archive = false } = args;

	await ensureThoughtsTodosDir();

	let catDir;
	if (from_archive) {
		await ensureThoughtsArchiveDir();
		catDir = THOUGHTS_ARCHIVE_DIR;
	} else {
		catDir = category === 'todos' ? THOUGHTS_TODOS_DIR : join(THOUGHTS_TODOS_DIR, '..', category);
	}

	const filePath = join(catDir, file);

	if (!(await fileExists(filePath))) {
		const location = from_archive ? '.archive' : category;
		return {
			content: [
				{
					type: 'text',
					text: `❌ File not found: \`.project/thoughts/todos/${location}/${file}\`\n\nUse \`list_thoughts\` or \`list_archived_thoughts\` to see available files.`,
				},
			],
			isError: true,
		};
	}

	const content = await readFile(filePath, 'utf-8');
	const parsed = matter(content);

	const location = from_archive ? 'todos/.archive' : category;
	let result = `## Thought File: ${file}\n\n`;
	result += `**Path:** \`.project/thoughts/${location}/${file}\`\n`;
	result += `**Status:** ${from_archive ? '📦 Archived' : '📝 Active'}\n\n`;

	if (Object.keys(parsed.data).length > 0) {
		result += `### Frontmatter\n\n`;
		result += `\`\`\`yaml\n`;
		for (const [key, value] of Object.entries(parsed.data)) {
			result += `${key}: ${JSON.stringify(value)}\n`;
		}
		result += `\`\`\`\n\n`;
	}

	result += `### Content\n\n`;
	result += parsed.content;

	result += `\n\n---\n`;
	if (from_archive) {
		result += `**This file has been archived.** It was already processed into tasks.`;
	} else {
		result += `**Tools:** \`process_thoughts\` to analyze | \`archive_thought\` after creating tasks`;
	}

	return {
		content: [{ type: 'text', text: result }],
	};
}

/**
 * Handler map
 */
export const handlers = {
	process_thoughts: processThoughts,
	archive_thought: archiveThought,
	list_thoughts: listThoughts,
	list_archived_thoughts: listArchivedThoughts,
	get_thought: getThought,
};
