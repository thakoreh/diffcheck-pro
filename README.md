# DiffCheck Pro

**Beautiful, privacy-first diff tool for developers.** Compare text, code, and files with syntax highlighting, word-level diffs, and shareable links.

**[→ Use it now](https://thakoreh.github.io/diffcheck-pro/)**

---

## Features

- **Side-by-side & unified diff** — Two panels or single unified view
- **Word-level highlighting** — See exactly which words changed within lines
- **Syntax highlighting** — 30+ languages supported
- **File upload & drag-and-drop** — Drop files directly onto each panel
- **Shareable links** — One-click link to share any diff (no account needed)
- **HTML diff report export** — Download a shareable HTML report
- **MCP Server** — AI agents can use DiffPro to understand code changes
- **Privacy-first** — All processing happens in your browser. Your text never touches a server.

---

## For AI Agents

DiffCheck Pro ships with an **MCP server** that AI coding agents (Claude, Cursor, etc.) can use to analyze code diffs.

### Install

```bash
cd mcp-server
npm install
npm run build
```

### Use with Claude Desktop

Add to `~/.claude/mcp_servers.json`:

```json
{
  "mcpServers": {
    "diffpro": {
      "command": "node",
      "args": ["/path/to/diffcheck-pro/mcp-server/dist/index.js"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `diff_text` | Line-by-line diff with stats |
| `diff_words` | Word-level diff for fine-grained changes |
| `summarize_diff` | Human-readable markdown summary |
| `explain_diff` | AI-powered analysis (needs `OPENAI_API_KEY`) |

### Example Usage

```
> diff_text with oldText="hello world" and newText="hello there"
> summarize_diff with oldText="..." newText="..."
> explain_diff with oldText="..." newText="..."
```

---

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build for production

```bash
npm run build
# Output in ./out/
```

---

## Tech Stack

- **Next.js 14** (App Router, static export)
- **TypeScript**
- **Tailwind CSS + Shadcn UI**
- **diff** library for diff computation

---

## License

MIT — do whatever you want with it.
