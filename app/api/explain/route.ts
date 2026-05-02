import { NextRequest, NextResponse } from 'next/server'
import * as Diff from 'diff'

export const runtime = 'edge'

interface ExplainRequest {
  oldText: string
  newText: string
}

function computeStats(oldText: string, newText: string) {
  const changes = Diff.diffLines(oldText, newText)
  let additions = 0
  let deletions = 0
  let unchanged = 0

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, '').split('\n')
    if (change.added) additions += lines.length
    else if (change.removed) deletions += lines.length
    else unchanged += lines.length
  }

  return { additions, deletions, unchanged }
}

function detectCategories(text: string): string[] {
  const cats: string[] = []
  if (/import|require|from\s+['"]/.test(text)) cats.push('dependencies')
  if (/function|const.*=.*=>|class\s+\w+/.test(text)) cats.push('code')
  if (/if\(|for\(|while\(|switch\(/.test(text)) cats.push('logic')
  if (/api|fetch|axios|http|websocket/i.test(text)) cats.push('api')
  if (/test|spec|describe|it\(|expect/.test(text)) cats.push('testing')
  if (/console\.|logger|debug/.test(text)) cats.push('debugging')
  if (/config|\.env|settings/i.test(text)) cats.push('config')
  return cats
}

function detectRisks(oldText: string, newText: string): string[] {
  const risks: string[] = []
  const all = oldText + newText
  if (/password|secret|token|api_key|apikey|auth/i.test(all) && /DEL|REMOVE|DELETE/i.test(oldText)) {
    risks.push('Potential credential removal — verify secrets are not being deleted')
  }
  if (/DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|DROP\s+DATABASE/i.test(all)) {
    risks.push('Database destructive operation detected')
  }
  if (/eval\(|new Function|exec\(/.test(all)) {
    risks.push('Dynamic code execution detected — potential security risk')
  }
  return risks
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ExplainRequest
    const { oldText, newText } = body

    if (!oldText || !newText) {
      return NextResponse.json({ error: 'oldText and newText are required' }, { status: 400 })
    }

    if (oldText.length > 100_000 || newText.length > 100_000) {
      return NextResponse.json({ error: 'Text too large (max 100KB each)' }, { status: 400 })
    }

    const stats = computeStats(oldText, newText)
    const categories = detectCategories(oldText + newText)
    const risks = detectRisks(oldText, newText)

    // Try AI explanation if API key is configured
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      try {
        const diffLines = Diff.diffLines(oldText, newText)
          .map(c => `${c.added ? '+' : c.removed ? '-' : ' '}${c.value}`)
          .join('')

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a code review expert. Analyze the given diff and respond with ONLY a valid JSON object (no markdown, no explanation outside the JSON). Format:
{"summary": "2-3 sentence plain English explanation of what changed", "categories": ["list of change categories"], "risks": ["list of potential risks"], "suggestions": ["list of improvement suggestions"]}`
              },
              {
                role: 'user',
                content: `Compare these two code snippets:\n\nOld:\n\`\`\`\n${oldText.substring(0, 3000)}\n\`\`\`\n\nNew:\n\`\`\`\n${newText.substring(0, 3000)}\n\`\`\`\n\nDiff:\n\`\`\`\n${diffLines.substring(0, 3000)}\n\`\`\``
              }
            ],
            temperature: 0.3,
            max_tokens: 600,
          }),
        })

        if (aiResponse.ok) {
          const data = await aiResponse.json() as { choices: { message: { content: string } }[] }
          const content = data.choices[0]?.message?.content?.trim()
          if (content) {
            const parsed = JSON.parse(content)
            return NextResponse.json({ ...parsed, stats })
          }
        }
      } catch {
        // Fall through to rule-based
      }
    }

    // Rule-based explanation (free fallback)
    const summary = `${stats.additions} lines added, ${stats.deletions} lines removed. ${categories.length > 0 ? `Change categories: ${categories.join(', ')}.` : 'General code changes.'} ${risks.length > 0 ? `Warning: ${risks.join('. ')}.` : ''}`

    return NextResponse.json({
      summary,
      stats,
      categories,
      risks,
      suggestions: stats.additions > 50 ? ['Consider adding tests for the new functionality'] : [],
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
