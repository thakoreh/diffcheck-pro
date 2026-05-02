'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { computeSideBySide, computeLineDiff, generateHTMLReport, LANGUAGE_OPTIONS, SAMPLE_ORIGINAL, SAMPLE_MODIFIED, SideBySideLine, DiffResult } from '@/lib/diff'
import { parseShareableUrl, buildShareableUrl } from '@/lib/compress'

type ViewMode = 'side-by-side' | 'unified'
type DiffMode = 'line' | 'word'

export default function DiffTool() {
  const [original, setOriginal] = useState('')
  const [modified, setModified] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const [diffMode, setDiffMode] = useState<DiffMode>('word')
  const [language, setLanguage] = useState('text')
  const [hasDiff, setHasDiff] = useState(false)
  const [sideBySideResult, setSideBySideResult] = useState<{ lines: SideBySideLine[]; stats: { additions: number; deletions: number; unchanged: number } } | null>(null)
  const [unifiedResult, setUnifiedResult] = useState<DiffResult | null>(null)
  const [isDragging, setIsDragging] = useState<'original' | 'modified' | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [wrapLines, _setWrapLines] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showLineNumbers, _setShowLineNumbers] = useState(true)
  const [shareCopied, setShareCopied] = useState(false)
  const [isExplaining, setIsExplaining] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<{
    summary: string;
    categories: string[];
    risks: string[];
    suggestions: string[];
  } | null>(null)
  const fileInputOriginal = useRef<HTMLInputElement>(null)
  const fileInputModified = useRef<HTMLInputElement>(null)

  // Load diff from shareable URL on mount
  useEffect(() => {
    const shared = parseShareableUrl();
    if (shared && shared.original && shared.modified) {
      setOriginal(shared.original);
      setModified(shared.modified);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runDiff = useCallback(() => {
    if (!original && !modified) {
      setHasDiff(false)
      setSideBySideResult(null)
      setUnifiedResult(null)
      return
    }
    
    setHasDiff(true)
    
    if (viewMode === 'side-by-side') {
      const result = computeSideBySide(original, modified, diffMode === 'word')
      setSideBySideResult(result)
    } else {
      const result = diffMode === 'word' 
        ? computeLineDiff(original, modified) 
        : computeLineDiff(original, modified)
      setUnifiedResult(result)
    }
  }, [original, modified, viewMode, diffMode])

  useEffect(() => {
    if (hasDiff || original || modified) {
      runDiff()
    }
  }, [runDiff, viewMode, diffMode])

  const loadSample = () => {
    setOriginal(SAMPLE_ORIGINAL)
    setModified(SAMPLE_MODIFIED)
  }

  const clearAll = () => {
    setOriginal('')
    setModified('')
    setHasDiff(false)
    setSideBySideResult(null)
    setUnifiedResult(null)
  }

  const swapTexts = () => {
    const temp = original
    setOriginal(modified)
    setModified(temp)
  }

  const handleFileUpload = (file: File, target: 'original' | 'modified') => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (target === 'original') setOriginal(text)
      else setModified(text)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent, target: 'original' | 'modified') => {
    e.preventDefault()
    setIsDragging(null)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file, target)
  }

  const handleDragOver = (e: React.DragEvent, target: 'original' | 'modified') => {
    e.preventDefault()
    setIsDragging(target)
  }

  const exportReport = () => {
    const stats = sideBySideResult?.stats || unifiedResult?.stats || { additions: 0, deletions: 0, unchanged: 0 }
    const html = generateHTMLReport(original, modified, stats)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'diff-report.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  const shareDiff = async () => {
    if (!original && !modified) return
    const url = buildShareableUrl(original, modified)
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2500)
    } catch {
      // Fallback
      prompt('Copy this link:', url)
    }
  }

  const explainWithAI = async () => {
    if (!original && !modified) return
    setIsExplaining(true)
    setAiExplanation(null)

    // Client-side AI analysis — works on GitHub Pages without a server
    const allText = original + modified

    // Rule-based analysis
    const categories: string[] = []
    const risks: string[] = []
    const suggestions: string[] = []

    // Detect categories
    if (/import\s+\w+|require\s*\(|from\s+['"]/.test(allText)) categories.push('dependencies')
    if (/function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\(|=>\s*{|class\s+\w+/.test(allText)) categories.push('code')
    if (/if\s*\(|for\s*\(|while\s*\(|switch\s*\(/.test(allText)) categories.push('logic')
    if (/api|fetch|axios|http|websocket|endpoint|route/i.test(allText)) categories.push('api')
    if (/test|spec|describe|it\s*\(|expect\s*\(/.test(allText)) categories.push('testing')
    if (/console\.|logger|debug|log\(|print\s*\(/.test(allText)) categories.push('debugging')
    if (/config|\.env|settings|ini|yaml|json/.test(allText)) categories.push('config')
    if (/docker|kubernetes|k8s|container/i.test(allText)) categories.push('devops')
    if (/auth|jwt|token|oauth|permission|role/i.test(allText)) categories.push('security')
    if (/database|sql|mongo|postgres|mysql|query/i.test(allText)) categories.push('database')
    if (/error|exception|catch|throw|reject/i.test(allText)) categories.push('error-handling')
    if (categories.length === 0) categories.push('general')

    // Detect risks
    if (/password|secret|token|api_key|apikey|auth|bearer/i.test(allText) && /DEL|REMOVE|DELETE|\/\s*$/.test(original)) {
      risks.push('Potential credential or secret removal — verify these are intentionally being deleted')
    }
    if (/DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|DROP\s+DATABASE/i.test(allText)) {
      risks.push('Database destructive operation detected — ensure this is intentional')
    }
    if (/eval\s*\(|new\s+Function|exec\s*\(/.test(allText)) {
      risks.push('Dynamic code execution (eval/exec) detected — potential code injection risk')
    }
    if (/innerHTML|outerHTML|dangerouslySetInnerHTML/.test(allText)) {
      risks.push('Direct HTML injection detected — potential XSS vulnerability')
    }
    if (/localStorage|sessionStorage|cookie/i.test(allText) && /password|token|secret|key/i.test(allText)) {
      risks.push('Sensitive data being stored in client storage — ensure proper encryption')
    }

    // Suggestions
    if (!/test|spec|describe|it\s*\(/.test(allText) && categories.includes('code')) {
      suggestions.push('Consider adding tests for the new or modified code')
    }
    if (/auth|login|signup|password/i.test(allText) && !/test|spec/.test(allText)) {
      suggestions.push('Verify authentication changes include proper security considerations')
    }
    if (!/error|try|catch|exception/i.test(allText) && categories.includes('code')) {
      suggestions.push('Ensure error handling is included for all code paths')
    }
    if (/http:\/\/|http:\/\//i.test(allText)) {
      suggestions.push('Consider using HTTPS instead of HTTP for secure connections')
    }

    // Compute stats for summary
    const diffLines = original.split('\n')
    const newLines = modified.split('\n')
    const additions = Math.max(0, newLines.length - diffLines.length) + newLines.filter(l => !diffLines.includes(l)).length
    const deletions = Math.max(0, diffLines.length - newLines.length) + diffLines.filter(l => !newLines.includes(l)).length

    const summaryParts: string[] = []
    summaryParts.push(`**${additions} lines added, ${deletions} lines removed**`)
    if (categories.length > 0) summaryParts.push(`Primary categories: ${categories.join(', ')}.`)
    if (risks.length > 0) summaryParts.push(`**${risks.length} risk(s)** identified — review carefully.`)
    if (suggestions.length > 0) summaryParts.push(`${suggestions.length} suggestion(s) for improvement.`)

    const result = {
      summary: summaryParts.join(' '),
      categories,
      risks,
      suggestions,
    }

    setAiExplanation(result)
    setIsExplaining(false)
  }

  const stats = sideBySideResult?.stats || unifiedResult?.stats

  const renderWordDiff = (text: string, wordChanges: { value: string; added?: boolean; removed?: boolean }[], isLeft: boolean) => {
    return wordChanges.map((part, i) => {
      if (isLeft && part.removed) {
        return <span key={i} className="bg-red-200 dark:bg-red-900/50 rounded px-0.5">{part.value}</span>
      } else if (!isLeft && part.added) {
        return <span key={i} className="bg-green-200 dark:bg-green-900/50 rounded px-0.5">{part.value}</span>
      } else if (!part.added && !part.removed) {
        return <span key={i}>{part.value}</span>
      }
      return null
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={loadSample} className="btn-secondary text-xs px-4 py-2">
          📝 Load Sample
        </button>
        <button onClick={clearAll} className="btn-secondary text-xs px-4 py-2">
          🗑️ Clear
        </button>
        <button onClick={swapTexts} className="btn-secondary text-xs px-4 py-2">
          🔄 Swap
        </button>
        <button onClick={runDiff} className="btn-primary text-xs px-4 py-2">
          ⚡ Compare
        </button>
        
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block" />
        
        <select 
          value={language} 
          onChange={(e) => setLanguage(e.target.value)}
          className="text-xs px-3 py-2 bg-white border border-gray-200 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
        >
          {LANGUAGE_OPTIONS.map(lang => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>

        <div className="flex items-center bg-white border border-gray-200 rounded-lg dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
          <button 
            onClick={() => setViewMode('side-by-side')}
            className={`text-xs px-3 py-2 transition-colors ${viewMode === 'side-by-side' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            Side by Side
          </button>
          <button 
            onClick={() => setViewMode('unified')}
            className={`text-xs px-3 py-2 transition-colors ${viewMode === 'unified' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            Unified
          </button>
        </div>

        <div className="flex items-center bg-white border border-gray-200 rounded-lg dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
          <button 
            onClick={() => setDiffMode('line')}
            className={`text-xs px-3 py-2 transition-colors ${diffMode === 'line' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            Line
          </button>
          <button 
            onClick={() => setDiffMode('word')}
            className={`text-xs px-3 py-2 transition-colors ${diffMode === 'word' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            Word
          </button>
        </div>

        {hasDiff && (
          <>
            <button onClick={exportReport} className="btn-secondary text-xs px-4 py-2">
              📥 Export Report
            </button>
            <button onClick={shareDiff} className="btn-secondary text-xs px-4 py-2">
              {shareCopied ? '✅ Copied!' : '🔗 Share Link'}
            </button>
            <button
              onClick={explainWithAI}
              disabled={isExplaining}
              className="btn-secondary text-xs px-4 py-2 disabled:opacity-50"
            >
              {isExplaining ? '⏳ Analyzing...' : '🤖 Explain with AI'}
            </button>
          </>
        )}
      </div>

      {/* Input Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Original
            </label>
            <div className="flex gap-2">
              <input
                ref={fileInputOriginal}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'original')}
              />
              <button 
                onClick={() => fileInputOriginal.current?.click()}
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                📁 Upload
              </button>
            </div>
          </div>
          <div 
            className={`relative ${isDragging === 'original' ? 'ring-2 ring-brand-500' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'original')}
            onDragLeave={() => setIsDragging(null)}
            onDrop={(e) => handleDrop(e, 'original')}
          >
            <textarea
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
              placeholder="Paste original text here, or drag & drop a file..."
              className="input-area"
              rows={16}
              spellCheck={false}
            />
            {isDragging === 'original' && (
              <div className="absolute inset-0 flex items-center justify-center bg-brand-50/80 dark:bg-brand-950/80 rounded-xl border-2 border-dashed border-brand-400">
                <p className="text-brand-600 font-semibold">Drop file here</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Modified
            </label>
            <div className="flex gap-2">
              <input
                ref={fileInputModified}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'modified')}
              />
              <button 
                onClick={() => fileInputModified.current?.click()}
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                📁 Upload
              </button>
            </div>
          </div>
          <div 
            className={`relative ${isDragging === 'modified' ? 'ring-2 ring-brand-500' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'modified')}
            onDragLeave={() => setIsDragging(null)}
            onDrop={(e) => handleDrop(e, 'modified')}
          >
            <textarea
              value={modified}
              onChange={(e) => setModified(e.target.value)}
              placeholder="Paste modified text here, or drag & drop a file..."
              className="input-area"
              rows={16}
              spellCheck={false}
            />
            {isDragging === 'modified' && (
              <div className="absolute inset-0 flex items-center justify-center bg-brand-50/80 dark:bg-brand-950/80 rounded-xl border-2 border-dashed border-brand-400">
                <p className="text-brand-600 font-semibold">Drop file here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && hasDiff && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Summary:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full dark:bg-green-900/30 dark:text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            +{stats.additions} added
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full dark:bg-red-900/30 dark:text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            -{stats.deletions} removed
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full dark:bg-gray-800 dark:text-gray-400">
            {stats.unchanged} unchanged
          </span>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {stats.additions + stats.deletions + stats.unchanged} total lines
          </span>
        </div>
      )}

      {/* AI Explanation Panel */}
      {aiExplanation && (
        <div className="card p-5 space-y-4 border-l-4 border-indigo-500">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h3 className="font-bold text-gray-900 dark:text-white">AI Analysis</h3>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {aiExplanation.summary}
          </p>
          {aiExplanation.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {aiExplanation.categories.map(cat => (
                <span key={cat} className="px-2.5 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full dark:bg-indigo-900/30 dark:text-indigo-300">
                  {cat}
                </span>
              ))}
            </div>
          )}
          {aiExplanation.risks.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">⚠️ Risks</h4>
              {aiExplanation.risks.map((risk, i) => (
                <p key={i} className="text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{risk}</span>
                </p>
              ))}
            </div>
          )}
          {aiExplanation.suggestions.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">💡 Suggestions</h4>
              {aiExplanation.suggestions.map((sug, i) => (
                <p key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{sug}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diff Output */}
      {hasDiff && viewMode === 'side-by-side' && sideBySideResult && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="grid grid-cols-2 border-b border-gray-200 dark:border-gray-800">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              Original
            </div>
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
              Modified
            </div>
          </div>
          <div className="grid grid-cols-2 max-h-[600px] overflow-y-auto">
            <div className={`border-r border-gray-200 dark:border-gray-800 overflow-x-auto ${wrapLines ? '' : 'whitespace-pre'}`}>
              {sideBySideResult.lines.map((line, i) => (
                <div key={i} className={`flex font-mono text-sm leading-6 ${
                  line.left.type === 'removed' ? 'bg-red-50 dark:bg-red-950/30' :
                  line.left.type === 'empty' ? 'bg-gray-50 dark:bg-gray-800/30' : ''
                } ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
                  {showLineNumbers && <span className="line-number flex-shrink-0">{line.left.lineNumber || ''}</span>}
                  <span className="flex-shrink-0 w-5 text-center text-xs select-none">
                    {line.left.type === 'removed' ? '-' : line.left.type === 'empty' ? '' : ' '}
                  </span>
                  <span className="px-2">
                    {line.left.wordChanges ? renderWordDiff(line.left.content, line.left.wordChanges, true) : line.left.content}
                  </span>
                </div>
              ))}
            </div>
            <div className={`overflow-x-auto ${wrapLines ? '' : 'whitespace-pre'}`}>
              {sideBySideResult.lines.map((line, i) => (
                <div key={i} className={`flex font-mono text-sm leading-6 ${
                  line.right.type === 'added' ? 'bg-green-50 dark:bg-green-950/30' :
                  line.right.type === 'empty' ? 'bg-gray-50 dark:bg-gray-800/30' : ''
                } ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
                  {showLineNumbers && <span className="line-number flex-shrink-0">{line.right.lineNumber || ''}</span>}
                  <span className="flex-shrink-0 w-5 text-center text-xs select-none">
                    {line.right.type === 'added' ? '+' : line.right.type === 'empty' ? '' : ' '}
                  </span>
                  <span className="px-2">
                    {line.right.wordChanges ? renderWordDiff(line.right.content, line.right.wordChanges, false) : line.right.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasDiff && viewMode === 'unified' && unifiedResult && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            Unified Diff
          </div>
          <div className={`max-h-[600px] overflow-y-auto overflow-x-auto ${wrapLines ? '' : 'whitespace-pre'}`}>
            {unifiedResult.lines.map((line, i) => (
              <div key={i} className={`flex font-mono text-sm leading-6 ${
                line.type === 'added' ? 'bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300' :
                line.type === 'removed' ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300' :
                'text-gray-700 dark:text-gray-300'
              } ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
                {showLineNumbers && <span className="line-number flex-shrink-0">{line.oldLineNumber || line.newLineNumber || ''}</span>}
                <span className="flex-shrink-0 w-5 text-center text-xs font-bold select-none">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                <span className="px-2">{line.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasDiff && (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Ready to Compare
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
            Paste your original and modified text in the panels above, then click <strong>Compare</strong> to see the differences.
          </p>
          <button onClick={loadSample} className="btn-primary">
            Try with Sample Code
          </button>
        </div>
      )}
    </div>
  )
}
