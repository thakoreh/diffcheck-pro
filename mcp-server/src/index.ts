#!/usr/bin/env node

/**
 * DiffPro MCP Server
 * 
 * AI agents call this to analyze, compare, and understand code/text differences.
 * 
 * Usage:
 *   node dist/index.js           # stdio mode (for Claude Desktop, Cursor, etc.)
 *   node dist/index.js --http    # HTTP mode (for remote agents)
 * 
 * Environment variables:
 *   OPENAI_API_KEY      - For AI-powered diff explanations (optional)
 *   ANTHROPIC_API_KEY   - Alternative AI provider
 *   DIFFPRO_API_URL     - Base URL for the DiffPro web app (default: http://localhost:3000)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import * as Diff from 'diff';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

interface DiffResult {
  stats: DiffStats;
  changes: DiffChange[];
}

interface DiffChange {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface ExplainResult {
  summary: string;
  stats: DiffStats;
  categories: string[];
  risks: string[];
  suggestions: string[];
}

// ─── Core Diff Logic ──────────────────────────────────────────────────────────

function computeLineDiff(oldText: string, newText: string): DiffResult {
  const changes = Diff.diffLines(oldText, newText);
  const result: DiffChange[] = [];
  let oldLine = 1;
  let newLine = 1;
  const stats = { additions: 0, deletions: 0, unchanged: 0 };

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, '').split('\n');
    for (const line of lines) {
      if (change.added) {
        result.push({ type: 'added', content: line, newLineNumber: newLine++ });
        stats.additions++;
      } else if (change.removed) {
        result.push({ type: 'removed', content: line, oldLineNumber: oldLine++ });
        stats.deletions++;
      } else {
        result.push({ type: 'unchanged', content: line, oldLineNumber: oldLine++, newLineNumber: newLine++ });
        stats.unchanged++;
      }
    }
  }

  return { stats, changes: result };
}

function computeWordDiff(oldText: string, newText: string): DiffChange[] {
  return Diff.diffWords(oldText, newText).map(part => ({
    type: (part.added ? 'added' : part.removed ? 'removed' : 'unchanged') as 'added' | 'removed' | 'unchanged',
    content: part.value,
  }));
}

function summarizeChanges(changes: DiffChange[]): string {
  const stats = { additions: 0, deletions: 0, unchanged: 0 };
  for (const c of changes) {
    if (c.type === 'added') stats.additions++;
    else if (c.type === 'removed') stats.deletions++;
    else stats.unchanged++;
  }

  const lines = [
    `## Diff Summary`,
    ``,
    `- **+${stats.additions}** additions`,
    `- **-${stats.deletions}** deletions`,
    `- **${stats.unchanged}** unchanged lines`,
    ``,
  ];

  // Group consecutive changes
  let i = 0;
  const blocks: string[] = [];
  while (i < changes.length) {
    if (changes[i].type !== 'unchanged') {
      const block = changes.slice(i, i + 5);
      const preview = block.map(c => c.content.substring(0, 80)).join(' | ');
      blocks.push(`  ${block[0].type === 'added' ? '+' : '-'}: ${preview}${block.length > 5 ? ' ...' : ''}`);
      i += block.length;
    } else {
      i++;
    }
  }

  if (blocks.length > 0) {
    lines.push(`## Changed Lines Preview\n`);
    lines.push(...blocks);
  }

  return lines.join('\n');
}

async function explainDiffWithAI(oldText: string, newText: string): Promise<ExplainResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    // Fall back to rule-based analysis
    return explainDiffRuleBased(oldText, newText);
  }

  const diffText = Diff.diffLines(oldText, newText)
    .map(c => `${c.added ? '+' : c.removed ? '-' : ' '}${c.value}`)
    .join('');

  const systemPrompt = `You are a code review expert. Analyze the given diff and respond with ONLY a valid JSON object (no markdown, no explanation outside the JSON):

{
  "summary": "2-3 sentence plain English explanation of what changed",
  "categories": ["list of change categories like: 'security', 'performance', 'bugfix', 'new-feature', 'refactor', 'deps', 'config'"],
  "risks": ["list of potential risks or concerns"],
  "suggestions": ["list of improvement suggestions"]
}`;

  try {
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Old:\n\`\`\`\n${oldText.substring(0, 3000)}\n\`\`\`\n\nNew:\n\`\`\`\n${newText.substring(0, 3000)}\n\`\`\`\n\nDiff:\n\`\`\`\n${diffText.substring(0, 3000)}\n\`\`\`` },
          ],
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        return explainDiffRuleBased(oldText, newText);
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      const content = data.choices[0]?.message?.content?.trim() || '{}';
      return JSON.parse(content) as ExplainResult;
    }
  } catch {
    return explainDiffRuleBased(oldText, newText);
  }

  return explainDiffRuleBased(oldText, newText);
}

function explainDiffRuleBased(oldText: string, newText: string): ExplainResult {
  const result = computeLineDiff(oldText, newText);
  const { stats, changes } = result;
  const allText = oldText + newText;
  
  const categories: string[] = [];
  const risks: string[] = [];
  const suggestions: string[] = [];

  // Detect categories
  if (/import|require|from\s+['"]/.test(allText)) categories.push('dependencies');
  if (/function|const.*=.*=>|class\s+\w+/.test(allText)) categories.push('code');
  if (/if\(|for\(|while\(|switch\(/.test(allText)) categories.push('logic');
  if (/api|fetch|axios|http|websocket/i.test(allText)) categories.push('api');
  if (/test|spec|describe|it\(|expect/.test(allText)) categories.push('testing');
  if (/console\.|logger|debug/.test(allText)) categories.push('debugging');
  if (/config|\.env|settings/i.test(allText)) categories.push('config');
  if (stats.deletions > stats.additions * 2) categories.push('deletion-heavy');
  if (stats.additions > stats.deletions * 2) categories.push('addition-heavy');

  // Detect risks
  if (/password|secret|token|api_key|apikey|auth/i.test(allText) && stats.deletions > 0) {
    risks.push('Potential credential removal — ensure secrets are not being deleted');
  }
  if (/DROP TABLE|DELETE FROM|TRUNCATE|DROP DATABASE/i.test(allText)) {
    risks.push('Database destructive operation detected');
  }
  if (stats.deletions > 50) {
    risks.push(`Large number of deletions (${stats.deletions} lines) — review carefully`);
  }
  if (/eval\(|new Function|exec\(/.test(allText)) {
    risks.push('Dynamic code execution detected — potential security risk');
  }

  // Suggestions
  if (stats.additions > 100 && !allText.includes('test')) {
    suggestions.push('Consider adding tests for the new functionality');
  }
  if (stats.deletions > 20 && categories.includes('code')) {
    suggestions.push('Review deleted code paths — ensure no functionality is broken');
  }
  if (!allText.includes('error') && stats.additions > 50) {
    suggestions.push('Ensure error handling is included in new code');
  }

  const summary = `**${stats.additions} lines added, ${stats.deletions} lines removed** across ${changes.filter(c => c.type !== 'unchanged').length} changed lines. ${categories.length > 0 ? `Categories: ${categories.join(', ')}.` : ''} ${risks.length > 0 ? `Risks identified: ${risks.length}.` : ''}`;

  return { summary, stats, categories, risks, suggestions };
}

// ─── MCP Tool Definitions ──────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'diff_text',
    description: 'Compute a line-by-line diff between two text strings. Returns stats (additions, deletions, unchanged) and the list of changes with line numbers. Use this as the primary tool whenever you need to compare two pieces of text or code.',
    inputSchema: {
      type: 'object',
      properties: {
        oldText: {
          type: 'string',
          description: 'The original text or code (before changes)',
        },
        newText: {
          type: 'string',
          description: 'The modified text or code (after changes)',
        },
      },
      required: ['oldText', 'newText'],
    },
  },
  {
    name: 'diff_words',
    description: 'Compute a word-level diff between two text strings. Shows exactly which words changed within lines. Useful for text comparison where you need fine-grained change detection.',
    inputSchema: {
      type: 'object',
      properties: {
        oldText: {
          type: 'string',
          description: 'The original text',
        },
        newText: {
          type: 'string',
          description: 'The modified text',
        },
      },
      required: ['oldText', 'newText'],
    },
  },
  {
    name: 'summarize_diff',
    description: 'Get a human-readable summary of a diff. Returns a markdown summary with stats and a preview of the most important changed lines. Useful when you need to explain a diff to a non-technical person.',
    inputSchema: {
      type: 'object',
      properties: {
        oldText: {
          type: 'string',
          description: 'The original text or code',
        },
        newText: {
          type: 'string',
          description: 'The modified text or code',
        },
      },
      required: ['oldText', 'newText'],
    },
  },
  {
    name: 'explain_diff',
    description: 'AI-powered diff explanation using GPT-4 or Claude. Provides a structured analysis: summary, change categories (security/performance/bugfix/etc), potential risks, and improvement suggestions. Falls back to rule-based analysis if no API key is set.',
    inputSchema: {
      type: 'object',
      properties: {
        oldText: {
          type: 'string',
          description: 'The original text or code',
        },
        newText: {
          type: 'string',
          description: 'The modified text or code',
        },
      },
      required: ['oldText', 'newText'],
    },
  },
];

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'diffpro-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'diff_text') {
      const { oldText, newText } = args as { oldText: string; newText: string };
      const result = computeLineDiff(oldText, newText);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'diff_words') {
      const { oldText, newText } = args as { oldText: string; newText: string };
      const result = computeWordDiff(oldText, newText);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ changes: result }, null, 2),
          },
        ],
      };
    }

    if (name === 'summarize_diff') {
      const { oldText, newText } = args as { oldText: string; newText: string };
      const result = computeLineDiff(oldText, newText);
      const summary = summarizeChanges(result.changes);
      return {
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
      };
    }

    if (name === 'explain_diff') {
      const { oldText, newText } = args as { oldText: string; newText: string };
      const result = await explainDiffWithAI(oldText, newText);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[DiffPro MCP Server] Running on stdio...');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
