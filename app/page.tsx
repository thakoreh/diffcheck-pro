import DiffTool from '@/components/DiffTool'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-brand-600 to-indigo-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="font-bold text-base tracking-tight">⚡ DiffPro</span>
            <span className="hidden sm:inline text-brand-100">— AI-powered diff for developers</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/thakoreh/diffcheck-pro"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-100 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-6">
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white mb-3">
          Compare text like a{' '}
          <span className="bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">
            pro
          </span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mb-8">
          Side-by-side diffs, word-level highlighting, shareable links, and AI-powered analysis.
          Everything developers need to understand code changes — in your browser, privately.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mb-10">
          {[
            '🔍 Side-by-side diff',
            '✏️ Word-level highlighting',
            '🔗 Shareable links',
            '🤖 AI diff explainer',
            '📁 File upload & drag-drop',
            '📥 HTML report export',
            '🛠️ MCP server for AI agents',
            '🔒 Privacy-first — no data leaves your browser',
          ].map(feat => (
            <span key={feat} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400 shadow-sm">
              {feat}
            </span>
          ))}
        </div>
      </section>

      {/* Tool */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <DiffTool />
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-700 dark:text-gray-300">⚡ DiffPro</span>
            <span>— built by developers, for developers</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/thakoreh/diffcheck-pro" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 dark:hover:text-gray-200">GitHub</a>
            <a href="https://github.com/thakoreh/diffcheck-pro/issues" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 dark:hover:text-gray-200">Feedback</a>
            <a href="https://github.com/thakoreh/diffcheck-pro/blob/main/README.md#for-ai-agents" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 dark:hover:text-gray-200">MCP Server</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
