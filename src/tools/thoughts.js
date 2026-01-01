/**
 * Thought processing tools.
 * Handles: process_thoughts, list_thoughts, get_thought
 *
 * This tool reads brain dump files and provides context for the LLM to analyze.
 * The LLM does the natural language understanding - the tool just gathers data.
 */

import { readdir } from 'fs/promises';
import { THOUGHTS_TODOS_DIR, PROJECT_DIR } from '../lib/constants.js';
import { readFile, join, fileExists, ensureThoughtsTodosDir, matter } from '../lib/files.js';
import { loadAllTasks } from '../lib/tasks.js';
import { loadAllFiles, getCachedFiles } from '../lib/search.js';

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
			context.roadmap = roadmapFile.content.substring(0, 2000); // First 2000 chars
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
			context.status = statusFile.content.substring(0, 1000); // First 1000 chars
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
				.filter(f => f.endsWith('.md'))
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

	result += `
---

## Your Task

Now analyze the thought content above and:

1. Identify the distinct tasks/initiatives (consolidate related items)
2. For each task, determine title, priority, and relevant context
3. Use \`create_task\` to create well-structured tasks

Remember: Quality over quantity. Create fewer, well-scoped tasks rather than many granular ones.
`;

	return {
		content: [{ type: 'text', text: result }],
	};
}

/**
 * List thoughts handler
 */
async function listThoughts(args) {
	const { category } = args || {};

	await ensureThoughtsTodosDir();

	const categories = category ? [category] : ['todos'];
	const results = {};

	for (const cat of categories) {
		const catDir = cat === 'todos' ? THOUGHTS_TODOS_DIR : join(THOUGHTS_TODOS_DIR, '..', cat);

		try {
			if (await fileExists(catDir)) {
				const files = await readdir(catDir);
				const mdFiles = files.filter(f => f.endsWith('.md'));

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

	result += `---\n`;
	result += `**Total files:** ${totalFiles}\n\n`;
	result += `**Tools:** \`get_thought\` to read | \`process_thoughts\` to analyze`;

	return {
		content: [{ type: 'text', text: result }],
	};
}

/**
 * Get thought handler
 */
async function getThought(args) {
	const { file, category = 'todos' } = args;

	await ensureThoughtsTodosDir();

	const catDir = category === 'todos' ? THOUGHTS_TODOS_DIR : join(THOUGHTS_TODOS_DIR, '..', category);
	const filePath = join(catDir, file);

	if (!(await fileExists(filePath))) {
		return {
			content: [
				{
					type: 'text',
					text: `❌ File not found: \`.project/thoughts/${category}/${file}\`\n\nUse \`list_thoughts\` to see available files.`,
				},
			],
			isError: true,
		};
	}

	const content = await readFile(filePath, 'utf-8');
	const parsed = matter(content);

	let result = `## Thought File: ${file}\n\n`;
	result += `**Path:** \`.project/thoughts/${category}/${file}\`\n`;
	result += `**Category:** ${category}\n\n`;

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
	result += `**Tools:** \`process_thoughts\` to analyze and create tasks`;

	return {
		content: [{ type: 'text', text: result }],
	};
}

/**
 * Handler map
 */
export const handlers = {
	process_thoughts: processThoughts,
	list_thoughts: listThoughts,
	get_thought: getThought,
};
