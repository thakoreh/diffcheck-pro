import * as Diff from 'diff'

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
  wordChanges?: { value: string; added?: boolean; removed?: boolean }[]
}

export interface DiffResult {
  lines: DiffLine[]
  stats: {
    additions: number
    deletions: number
    unchanged: number
  }
}

export function computeLineDiff(oldText: string, newText: string): DiffResult {
  const changes = Diff.diffLines(oldText, newText)
  const lines: DiffLine[] = []
  let oldLine = 1
  let newLine = 1
  let additions = 0
  let deletions = 0
  let unchanged = 0

  for (const change of changes) {
    const changeLines = change.value.replace(/\n$/, '').split('\n')
    
    for (const line of changeLines) {
      if (change.added) {
        lines.push({ type: 'added', content: line, newLineNumber: newLine++ })
        additions++
      } else if (change.removed) {
        lines.push({ type: 'removed', content: line, oldLineNumber: oldLine++ })
        deletions++
      } else {
        lines.push({ type: 'unchanged', content: line, oldLineNumber: oldLine++, newLineNumber: newLine++ })
        unchanged++
      }
    }
  }

  return { lines, stats: { additions, deletions, unchanged } }
}

export function computeWordDiff(oldText: string, newText: string): DiffResult {
  const changes = Diff.diffLines(oldText, newText)
  const lines: DiffLine[] = []
  let oldLine = 1
  let newLine = 1
  let additions = 0
  let deletions = 0
  let unchanged = 0

  for (const change of changes) {
    const changeLines = change.value.replace(/\n$/, '').split('\n')
    
    for (const line of changeLines) {
      if (change.added) {
        lines.push({ type: 'added', content: line, newLineNumber: newLine++ })
        additions++
      } else if (change.removed) {
        // For removed lines, compute word-level diff against corresponding added line
        lines.push({ type: 'removed', content: line, oldLineNumber: oldLine++ })
        deletions++
      } else {
        lines.push({ type: 'unchanged', content: line, oldLineNumber: oldLine++, newLineNumber: newLine++ })
        unchanged++
      }
    }
  }

  // Enhanced: compute word-level changes between removed/added pairs
  const enhancedLines = [...lines]
  let i = 0
  while (i < enhancedLines.length) {
    if (enhancedLines[i].type === 'removed') {
      const removedBlock: DiffLine[] = []
      const addedBlock: DiffLine[] = []
      let j = i
      
      while (j < enhancedLines.length && enhancedLines[j].type === 'removed') {
        removedBlock.push(enhancedLines[j])
        j++
      }
      while (j < enhancedLines.length && enhancedLines[j].type === 'added') {
        addedBlock.push(enhancedLines[j])
        j++
      }

      // Match up lines for word diff
      const maxLen = Math.max(removedBlock.length, addedBlock.length)
      for (let k = 0; k < maxLen; k++) {
        if (k < removedBlock.length && k < addedBlock.length) {
          const wordChanges = Diff.diffWords(removedBlock[k].content, addedBlock[k].content)
          removedBlock[k].wordChanges = wordChanges
          addedBlock[k].wordChanges = wordChanges
        }
      }
      i = j
    } else {
      i++
    }
  }

  return { lines: enhancedLines, stats: { additions, deletions, unchanged } }
}

export function computeCharDiff(oldText: string, newText: string): DiffResult {
  // Use character-level diff for more precise highlighting
  return computeWordDiff(oldText, newText)
}

export interface SideBySideLine {
  left: {
    type: 'added' | 'removed' | 'unchanged' | 'empty'
    content: string
    lineNumber?: number
    wordChanges?: { value: string; added?: boolean; removed?: boolean }[]
  }
  right: {
    type: 'added' | 'removed' | 'unchanged' | 'empty'
    content: string
    lineNumber?: number
    wordChanges?: { value: string; added?: boolean; removed?: boolean }[]
  }
}

export function computeSideBySide(oldText: string, newText: string, wordLevel: boolean = false): { lines: SideBySideLine[]; stats: { additions: number; deletions: number; unchanged: number } } {
  const diffFn = wordLevel ? computeWordDiff : computeLineDiff
  const result = diffFn(oldText, newText)
  const sideBySide: SideBySideLine[] = []

  let i = 0
  while (i < result.lines.length) {
    const line = result.lines[i]
    
    if (line.type === 'unchanged') {
      sideBySide.push({
        left: { type: 'unchanged', content: line.content, lineNumber: line.oldLineNumber },
        right: { type: 'unchanged', content: line.content, lineNumber: line.newLineNumber },
      })
      i++
    } else if (line.type === 'removed') {
      // Collect consecutive removed
      const removed: DiffLine[] = []
      while (i < result.lines.length && result.lines[i].type === 'removed') {
        removed.push(result.lines[i])
        i++
      }
      // Collect consecutive added
      const added: DiffLine[] = []
      while (i < result.lines.length && result.lines[i].type === 'added') {
        added.push(result.lines[i])
        i++
      }
      
      // Pair them up
      const maxLen = Math.max(removed.length, added.length)
      for (let j = 0; j < maxLen; j++) {
        const r = j < removed.length ? removed[j] : null
        const a = j < added.length ? added[j] : null
        
        if (r && a) {
          // Compute word-level diff for this pair
          const wordChanges = Diff.diffWords(r.content, a.content)
          sideBySide.push({
            left: { type: 'removed', content: r.content, lineNumber: r.oldLineNumber, wordChanges },
            right: { type: 'added', content: a.content, lineNumber: a.newLineNumber, wordChanges },
          })
        } else if (r) {
          sideBySide.push({
            left: { type: 'removed', content: r.content, lineNumber: r.oldLineNumber },
            right: { type: 'empty', content: '' },
          })
        } else if (a) {
          sideBySide.push({
            left: { type: 'empty', content: '' },
            right: { type: 'added', content: a.content, lineNumber: a.newLineNumber },
          })
        }
      }
    } else if (line.type === 'added') {
      sideBySide.push({
        left: { type: 'empty', content: '' },
        right: { type: 'added', content: line.content, lineNumber: line.newLineNumber },
      })
      i++
    }
  }

  return { lines: sideBySide, stats: result.stats }
}

export function generateHTMLReport(oldText: string, newText: string, stats: { additions: number; deletions: number; unchanged: number }): string {
  const result = computeLineDiff(oldText, newText)
  
  const linesHtml = result.lines.map(line => {
    const cls = line.type === 'added' ? 'background:#dcfce7;color:#166534' : 
                line.type === 'removed' ? 'background:#fee2e2;color:#991b1b' : ''
    const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '
    const lineNum = line.oldLineNumber || line.newLineNumber || ''
    return `<tr style="${cls}"><td style="padding:2px 8px;color:#9ca3af;text-align:right;width:40px">${lineNum}</td><td style="padding:2px 8px;color:#9ca3af;width:20px">${prefix}</td><td style="padding:2px 12px;font-family:monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(line.content)}</td></tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Diff Report — DiffCheck Pro</title>
<style>
body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 40px auto; color: #1f2937; }
h1 { font-size: 24px; margin-bottom: 8px; }
.stats { display: flex; gap: 24px; margin: 16px 0; font-size: 14px; }
.stat { padding: 8px 16px; border-radius: 8px; }
.added-stat { background: #dcfce7; color: #166534; }
.removed-stat { background: #fee2e2; color: #991b1b; }
.total-stat { background: #f3f4f6; color: #374151; }
table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
th { background: #f9fafb; padding: 8px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
footer { margin-top: 32px; font-size: 12px; color: #9ca3af; }
</style>
</head>
<body>
<h1>📋 Diff Report</h1>
<p>Generated by DiffCheck Pro on ${new Date().toLocaleDateString()}</p>
<div class="stats">
  <div class="stat added-stat">+${stats.additions} additions</div>
  <div class="stat removed-stat">-${stats.deletions} deletions</div>
  <div class="stat total-stat">${stats.unchanged} unchanged</div>
</div>
<table>
<thead><tr><th>Line</th><th></th><th>Content</th></tr></thead>
<tbody>${linesHtml}</tbody>
</table>
<footer>Generated by DiffCheck Pro — diffcheck-pro.vercel.app</footer>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const LANGUAGE_OPTIONS = [
  { value: 'text', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'shell', label: 'Shell/Bash' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'scala', label: 'Scala' },
  { value: 'r', label: 'R' },
  { value: 'lua', label: 'Lua' },
  { value: 'perl', label: 'Perl' },
  { value: 'dart', label: 'Dart' },
  { value: 'elixir', label: 'Elixir' },
  { value: 'vue', label: 'Vue' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
]

export const SAMPLE_ORIGINAL = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const users = ["Alice", "Bob", "Charlie"];

for (let i = 0; i < users.length; i++) {
  greet(users[i]);
}`

export const SAMPLE_MODIFIED = `function greet(name: string): boolean {
  console.log(\`Hello, \${name}!\`);
  return true;
}

const users: string[] = ["Alice", "Bob", "Charlie", "Diana"];

// Modern approach
users.forEach(user => {
  greet(user);
});

export { greet, users };`
