/**
 * Thought processing tools.
 * Handles: process_thoughts, list_thoughts, get_thought
 *
 * This tool analyzes brain dump markdown files from .project/thoughts/todos/
 * and transforms them into properly structured YAML tasks.
 */

import { readdir } from 'fs/promises';
import { THOUGHTS_TODOS_DIR, PRIORITY_KEYWORDS, VALID_PRIORITIES } from '../lib/constants.js';
import { readFile, writeFile, join, fileExists, ensureThoughtsTodosDir, matter } from '../lib/files.js';
import { getCurrentDate, getISODate } from '../lib/dates.js';
import { loadAllTasks, getNextTaskId, getExistingTaskIds } from '../lib/tasks.js';
import { loadAllFiles, getCachedFiles } from '../lib/search.js';

/**
 * Tool definitions
 */
export const definitions = [
	{
		name: 'process_thoughts',
		description: `Analyzes brain dump markdown files from .project/thoughts/todos/ and transforms them into structured YAML tasks. This tool is intelligent and understands:

1. **Explicit Intent** - What the user literally says they want to do
2. **Shadow Intent** - Implied goals, underlying motivations, hidden needs
3. **Practical Intent** - What actually needs to happen in concrete terms

The tool will:
- Parse unstructured markdown brain dumps
- Extract actionable tasks from free-form text
- Infer priority from context, urgency words, and project alignment
- Cross-reference with project docs (ROADMAP, existing tasks, decisions) for context
- Output properly formatted YAML tasks ready for creation

Use this when you have messy notes or brain dumps that need to be converted into actionable, tracked tasks.`,
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
					description:
						'Project prefix for generated task IDs (e.g., "AUTH", "API"). Required for task creation.',
				},
				mode: {
					type: 'string',
					description:
						'Processing mode: "analyze" (returns analysis without creating tasks), "create" (creates tasks directly), "preview" (shows what would be created). Default: "analyze".',
					enum: ['analyze', 'create', 'preview'],
					default: 'analyze',
				},
				default_owner: {
					type: 'string',
					description: 'Default owner for generated tasks. Default: "unassigned".',
					default: 'unassigned',
				},
				include_context: {
					type: 'boolean',
					description:
						'Include project context analysis (searches project docs for relevant info). Default: true.',
					default: true,
				},
			},
			required: ['project'],
		},
	},
	{
		name: 'list_thoughts',
		description:
			'Lists all thought files in the .project/thoughts/ directory structure. Shows available brain dump files organized by category (todos, etc.).',
		inputSchema: {
			type: 'object',
			properties: {
				category: {
					type: 'string',
					description:
						'Optional: Filter by thought category. Currently supported: "todos". More categories coming in the future.',
					enum: ['todos', ''],
				},
			},
		},
	},
	{
		name: 'get_thought',
		description:
			'Reads a specific thought file and returns its raw content. Use this to review a brain dump before processing.',
		inputSchema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					description: 'The thought file to read (e.g., "my-ideas.md"). Can be in any thoughts subdirectory.',
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
 * Intent analysis types
 */
const INTENT_MARKERS = {
	// Explicit intent markers - direct statements of what to do
	explicit: [
		/\b(need to|have to|must|should|will|going to|want to|plan to)\b/i,
		/\b(implement|create|build|add|fix|update|change|remove|delete)\b/i,
		/\b(task|todo|action item|deliverable)\b/i,
	],
	// Shadow intent markers - underlying motivations
	shadow: [
		/\b(because|since|so that|in order to|to enable|to allow|to prevent)\b/i,
		/\b(worried about|concerned|frustrated|annoying|painful|tedious)\b/i,
		/\b(would be nice|could|might|maybe|possibly|eventually)\b/i,
		/\b(users|customers|team|stakeholders)\s+(want|need|expect|complain)/i,
	],
	// Practical intent markers - concrete actions
	practical: [
		/\b(step \d+|first|then|next|finally|after that)\b/i,
		/\b(file|function|class|module|component|api|endpoint|database)\b/i,
		/\b(test|deploy|configure|setup|install|migrate)\b/i,
	],
	// Urgency markers
	urgency: {
		P0: [/\b(critical|blocker|urgent|asap|immediately|breaking|down|outage)\b/i],
		P1: [/\b(important|high priority|soon|this week|pressing|significant)\b/i],
		P2: [/\b(medium|normal|standard|regular|when possible)\b/i],
		P3: [/\b(low priority|nice to have|eventually|someday|minor|trivial)\b/i],
	},
};

/**
 * Extract todos from unstructured markdown content
 * @param {string} content - Raw markdown content
 * @returns {Array} Extracted todo items with metadata
 */
function extractTodosFromContent(content) {
	const todos = [];
	const lines = content.split('\n');

	let currentContext = [];
	let currentSection = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Track section headers for context
		const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
		if (headerMatch) {
			currentSection = headerMatch[2];
			currentContext = [];
			continue;
		}

		// Skip empty lines but reset context after multiple empties
		if (!trimmed) {
			if (currentContext.length > 0 && lines[i - 1]?.trim() === '') {
				currentContext = [];
			}
			continue;
		}

		// Check for explicit todo markers
		const todoMatch =
			trimmed.match(/^[-*]\s*\[[ x]\]\s*(.+)/) ||
			trimmed.match(/^[-*]\s+(.+)/) ||
			trimmed.match(/^(\d+)\.\s+(.+)/);

		if (todoMatch) {
			const text = todoMatch[2] || todoMatch[1];
			if (text && text.length >= 5) {
				todos.push({
					raw: text.trim(),
					section: currentSection,
					context: [...currentContext],
					lineNumber: i + 1,
					isExplicitTodo: /^\[[ x]\]/.test(trimmed),
				});
			}
		} else if (hasActionableIntent(trimmed)) {
			// Lines with strong action intent even without list markers
			todos.push({
				raw: trimmed,
				section: currentSection,
				context: [...currentContext],
				lineNumber: i + 1,
				isExplicitTodo: false,
			});
		} else {
			// Add to context for following items
			currentContext.push(trimmed);
			if (currentContext.length > 3) {
				currentContext.shift();
			}
		}
	}

	return todos;
}

/**
 * Check if a line has actionable intent
 * @param {string} line - Line to check
 * @returns {boolean}
 */
function hasActionableIntent(line) {
	// Must have at least one explicit intent marker
	const hasExplicit = INTENT_MARKERS.explicit.some(rx => rx.test(line));
	if (!hasExplicit) return false;

	// Must be long enough to be meaningful
	if (line.length < 15) return false;

	// Must not be a question or observation
	if (/^(what|how|why|when|where|who|is|are|was|were|do|does)\b/i.test(line)) return false;
	if (line.endsWith('?')) return false;

	return true;
}

/**
 * Analyze intent layers for a todo item
 * @param {object} todo - Todo item with raw text and context
 * @returns {object} Intent analysis
 */
function analyzeIntent(todo) {
	const text = todo.raw;
	const context = todo.context.join(' ');
	const combined = `${text} ${context}`;

	const analysis = {
		explicit: null,
		shadow: null,
		practical: null,
		priority: 'P2',
		confidence: 0,
		tags: [],
	};

	// Extract explicit intent - what they say they want
	analysis.explicit = text;

	// Extract shadow intent - why they want it
	const shadowMatches = [];
	INTENT_MARKERS.shadow.forEach(rx => {
		const match = combined.match(rx);
		if (match) {
			// Get surrounding context
			const idx = combined.indexOf(match[0]);
			const start = Math.max(0, idx - 20);
			const end = Math.min(combined.length, idx + match[0].length + 50);
			shadowMatches.push(combined.substring(start, end).trim());
		}
	});
	if (shadowMatches.length > 0) {
		analysis.shadow = shadowMatches.join('; ');
	}

	// Extract practical intent - concrete actions
	const practicalMatches = [];
	INTENT_MARKERS.practical.forEach(rx => {
		if (rx.test(combined)) {
			practicalMatches.push(rx.source.replace(/\\b|\(|\)/g, ''));
		}
	});
	if (practicalMatches.length > 0) {
		analysis.practical = `Involves: ${practicalMatches.join(', ')}`;
	}

	// Determine priority from urgency markers
	for (const [priority, patterns] of Object.entries(INTENT_MARKERS.urgency)) {
		if (patterns.some(rx => rx.test(combined))) {
			analysis.priority = priority;
			break;
		}
	}

	// Also check keyword-based priority
	const textLower = combined.toLowerCase();
	for (const [keyword, pri] of Object.entries(PRIORITY_KEYWORDS)) {
		if (textLower.includes(keyword)) {
			// Only upgrade priority, don't downgrade
			const currentOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
			if (currentOrder[pri] < currentOrder[analysis.priority]) {
				analysis.priority = pri;
			}
			break;
		}
	}

	// Extract potential tags from brackets or hashtags
	const tagMatches = text.match(/\[([^\]]+)\]/g) || [];
	const hashTags = text.match(/#(\w+)/g) || [];
	analysis.tags = [
		...tagMatches.map(t => t.slice(1, -1).toLowerCase()),
		...hashTags.map(t => t.slice(1).toLowerCase()),
	];

	// Calculate confidence based on markers found
	let confidence = 0;
	if (todo.isExplicitTodo) confidence += 40;
	if (INTENT_MARKERS.explicit.some(rx => rx.test(text))) confidence += 30;
	if (analysis.shadow) confidence += 15;
	if (analysis.practical) confidence += 15;
	analysis.confidence = Math.min(100, confidence);

	return analysis;
}

/**
 * Generate a clean title from raw todo text
 * @param {string} raw - Raw todo text
 * @returns {string} Clean title
 */
function generateTitle(raw) {
	let title = raw
		// Remove checkbox markers
		.replace(/^\[[ x]\]\s*/, '')
		// Remove tag brackets
		.replace(/\[[^\]]+\]/g, '')
		// Remove hashtags
		.replace(/#\w+/g, '')
		// Remove leading action words that are too generic
		.replace(/^(need to|have to|must|should|will|want to)\s+/i, '')
		// Clean up whitespace
		.replace(/\s+/g, ' ')
		.trim();

	// Capitalize first letter
	title = title.charAt(0).toUpperCase() + title.slice(1);

	// Truncate if too long
	if (title.length > 80) {
		title = title.substring(0, 77) + '...';
	}

	return title;
}

/**
 * Get project context from existing docs and tasks
 * @returns {Promise<object>} Project context summary
 */
async function getProjectContext() {
	const context = {
		existingTasks: [],
		roadmapItems: [],
		decisions: [],
		summary: '',
	};

	try {
		// Load existing tasks
		const tasks = await loadAllTasks();
		context.existingTasks = tasks.map(t => ({
			id: t.id,
			title: t.title,
			status: t.status,
			priority: t.priority,
		}));

		// Load project files for context
		await loadAllFiles();
		const files = getCachedFiles();

		// Find roadmap items
		const roadmapFile = files.find(f => f.path.includes('ROADMAP'));
		if (roadmapFile) {
			const milestones = roadmapFile.content.match(/##\s+[^#\n]+/g) || [];
			context.roadmapItems = milestones.map(m => m.replace('##', '').trim());
		}

		// Find decisions
		const decisionsFile = files.find(f => f.path.includes('DECISIONS'));
		if (decisionsFile) {
			const adrs = decisionsFile.content.match(/## ADR-\d+: [^\n]+/g) || [];
			context.decisions = adrs.map(a => a.replace('## ', ''));
		}

		// Build summary
		const parts = [];
		if (context.existingTasks.length > 0) {
			const inProgress = context.existingTasks.filter(t => t.status === 'in_progress');
			const todoCount = context.existingTasks.filter(t => t.status === 'todo').length;
			parts.push(
				`${context.existingTasks.length} existing tasks (${inProgress.length} in progress, ${todoCount} todo)`
			);
		}
		if (context.roadmapItems.length > 0) {
			parts.push(`${context.roadmapItems.length} roadmap milestones`);
		}
		if (context.decisions.length > 0) {
			parts.push(`${context.decisions.length} architecture decisions`);
		}
		context.summary = parts.join(', ') || 'No existing project context found';
	} catch (error) {
		context.summary = 'Unable to load project context';
	}

	return context;
}

/**
 * Check for potential duplicates or related tasks
 * @param {string} title - Task title to check
 * @param {Array} existingTasks - Existing tasks
 * @returns {Array} Related tasks
 */
function findRelatedTasks(title, existingTasks) {
	const titleWords = title
		.toLowerCase()
		.split(/\s+/)
		.filter(w => w.length > 3);
	const related = [];

	for (const task of existingTasks) {
		const taskTitle = task.title.toLowerCase();
		const matchingWords = titleWords.filter(w => taskTitle.includes(w));
		if (matchingWords.length >= 2 || matchingWords.length / titleWords.length > 0.5) {
			related.push({
				id: task.id,
				title: task.title,
				status: task.status,
				similarity: matchingWords.length / titleWords.length,
			});
		}
	}

	return related.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

/**
 * Process thoughts handler
 */
async function processThoughts(args) {
	const { file, project, mode = 'analyze', default_owner = 'unassigned', include_context = true } = args;

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
					text: `⚠️ No thought files found in \`.project/thoughts/todos/\`\n\nCreate markdown files with your brain dumps, then run this tool to process them into structured tasks.`,
				},
			],
		};
	}

	// Get project context if requested
	let projectContext = null;
	if (include_context) {
		projectContext = await getProjectContext();
	}

	// Process each file
	const allAnalyzedTodos = [];
	const processedFiles = [];

	for (const thoughtFile of filesToProcess) {
		const content = await readFile(thoughtFile.path, 'utf-8');
		const parsed = matter(content);
		const rawContent = parsed.content;

		// Extract todos from content
		const extractedTodos = extractTodosFromContent(rawContent);

		// Analyze each todo
		for (const todo of extractedTodos) {
			const intent = analyzeIntent(todo);
			const title = generateTitle(todo.raw);

			// Skip if too low confidence
			if (intent.confidence < 30) continue;

			// Find related existing tasks
			const related = projectContext ? findRelatedTasks(title, projectContext.existingTasks) : [];

			allAnalyzedTodos.push({
				sourceFile: thoughtFile.name,
				lineNumber: todo.lineNumber,
				section: todo.section,
				raw: todo.raw,
				title,
				intent,
				related,
				taskData: {
					title,
					project: project.toUpperCase(),
					priority: intent.priority,
					status: 'todo',
					owner: default_owner,
					tags: intent.tags,
					description: buildDescription(todo, intent),
				},
			});
		}

		processedFiles.push({
			name: thoughtFile.name,
			todosFound: extractedTodos.length,
			todosKept: allAnalyzedTodos.filter(t => t.sourceFile === thoughtFile.name).length,
		});
	}

	// Build result based on mode
	let result = `## Thought Processing Results\n\n`;
	result += `**Mode:** ${mode}\n`;
	result += `**Project:** ${project.toUpperCase()}\n`;
	result += `**Files Processed:** ${processedFiles.length}\n`;
	result += `**Todos Extracted:** ${allAnalyzedTodos.length}\n`;

	if (projectContext) {
		result += `\n### Project Context\n\n${projectContext.summary}\n`;
	}

	result += `\n### Processed Files\n\n`;
	for (const pf of processedFiles) {
		result += `- **${pf.name}**: ${pf.todosFound} items found, ${pf.todosKept} actionable\n`;
	}

	if (allAnalyzedTodos.length === 0) {
		result += `\n⚠️ No actionable todos found. The content may not contain clear task items, or confidence was too low.\n`;
		result += `\n**Tips:**\n`;
		result += `- Use checkbox syntax: \`- [ ] Task description\`\n`;
		result += `- Include action verbs: implement, create, fix, add, update\n`;
		result += `- Add urgency markers: critical, urgent, important, soon\n`;

		return {
			content: [{ type: 'text', text: result }],
		};
	}

	result += `\n---\n\n## Extracted Todos\n\n`;

	const createdTasks = [];

	for (let i = 0; i < allAnalyzedTodos.length; i++) {
		const todo = allAnalyzedTodos[i];

		result += `### ${i + 1}. ${todo.title}\n\n`;
		result += `**Source:** \`${todo.sourceFile}\` (line ${todo.lineNumber})\n`;
		result += `**Priority:** ${todo.intent.priority} (confidence: ${todo.intent.confidence}%)\n`;

		if (todo.section) {
			result += `**Section:** ${todo.section}\n`;
		}

		result += `\n**Intent Analysis:**\n`;
		result += `- **Explicit:** ${todo.intent.explicit}\n`;
		if (todo.intent.shadow) {
			result += `- **Shadow (why):** ${todo.intent.shadow}\n`;
		}
		if (todo.intent.practical) {
			result += `- **Practical:** ${todo.intent.practical}\n`;
		}

		if (todo.intent.tags.length > 0) {
			result += `- **Tags:** ${todo.intent.tags.join(', ')}\n`;
		}

		if (todo.related.length > 0) {
			result += `\n**⚠️ Potentially Related Tasks:**\n`;
			for (const rel of todo.related) {
				result += `- ${rel.id}: ${rel.title} (${rel.status})\n`;
			}
		}

		// Show YAML preview
		result += `\n**Generated YAML:**\n`;
		result += `\`\`\`yaml\n`;
		result += `title: "${todo.taskData.title}"\n`;
		result += `project: ${todo.taskData.project}\n`;
		result += `priority: ${todo.taskData.priority}\n`;
		result += `status: ${todo.taskData.status}\n`;
		result += `owner: ${todo.taskData.owner}\n`;
		if (todo.taskData.tags.length > 0) {
			result += `tags: [${todo.taskData.tags.join(', ')}]\n`;
		}
		result += `\`\`\`\n\n`;

		// Create tasks in create mode
		if (mode === 'create') {
			try {
				// Import create_task handler dynamically to avoid circular deps
				const { handlers: taskHandlers } = await import('./tasks.js');
				const createResult = await taskHandlers.create_task({
					title: todo.taskData.title,
					project: todo.taskData.project,
					description: todo.taskData.description,
					owner: todo.taskData.owner,
					priority: todo.taskData.priority,
					tags: todo.taskData.tags,
				});

				// Extract task ID from result
				const idMatch = createResult.content[0].text.match(/\*\*([A-Z]+-\d+)\*\*/);
				if (idMatch) {
					createdTasks.push({
						id: idMatch[1],
						title: todo.taskData.title,
					});
					result += `✅ **Created:** ${idMatch[1]}\n\n`;
				}
			} catch (error) {
				result += `❌ **Failed to create:** ${error.message}\n\n`;
			}
		}

		result += `---\n\n`;
	}

	// Summary footer
	if (mode === 'analyze') {
		result += `\n## Next Steps\n\n`;
		result += `1. Review the extracted todos above\n`;
		result += `2. Run with \`mode: "preview"\` to see final task format\n`;
		result += `3. Run with \`mode: "create"\` to create the tasks\n`;
		result += `\nOr use \`create_task\` manually for more control over individual tasks.\n`;
	} else if (mode === 'create' && createdTasks.length > 0) {
		result += `\n## Created Tasks Summary\n\n`;
		result += `**${createdTasks.length} tasks created:**\n`;
		for (const task of createdTasks) {
			result += `- ${task.id}: ${task.title}\n`;
		}
		result += `\nUse \`get_next_task\` to see the execution queue.\n`;
	} else if (mode === 'preview') {
		result += `\n## Preview Complete\n\n`;
		result += `Run with \`mode: "create"\` to create these ${allAnalyzedTodos.length} tasks.\n`;
	}

	return {
		content: [{ type: 'text', text: result }],
	};
}

/**
 * Build task description from todo and intent analysis
 */
function buildDescription(todo, intent) {
	let desc = '';

	if (todo.section) {
		desc += `**From:** ${todo.section}\n\n`;
	}

	desc += `**Original thought:**\n> ${todo.raw}\n\n`;

	if (intent.shadow) {
		desc += `**Context (why):**\n${intent.shadow}\n\n`;
	}

	if (todo.context.length > 0) {
		desc += `**Surrounding context:**\n${todo.context.map(c => `> ${c}`).join('\n')}\n\n`;
	}

	desc += `---\n*Extracted from thought dump via process_thoughts*`;

	return desc;
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
	result += `**Tools:** \`get_thought\` to read | \`process_thoughts\` to convert to tasks`;

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
	result += `**Tools:** \`process_thoughts\` to convert to tasks`;

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
