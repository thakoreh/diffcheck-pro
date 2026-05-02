import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DiffCheck Pro — Advanced Text & Code Comparison Tool',
  description: 'Compare text, code, and files instantly. Privacy-first client-side diff with syntax highlighting, word-level changes, and export. No data leaves your browser.',
  keywords: ['diff', 'compare', 'text comparison', 'code diff', 'merge tool', 'file comparison', 'syntax highlighting', 'online diff tool'],
  authors: [{ name: 'DiffCheck Pro' }],
  openGraph: {
    title: 'DiffCheck Pro — Advanced Text & Code Comparison',
    description: 'Compare text, code, and files instantly. Privacy-first, nothing leaves your browser.',
    type: 'website',
    siteName: 'DiffCheck Pro',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DiffCheck Pro — Advanced Text & Code Comparison',
    description: 'Compare text, code, and files instantly. Privacy-first, nothing leaves your browser.',
  },
  robots: 'index, follow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  )
}
