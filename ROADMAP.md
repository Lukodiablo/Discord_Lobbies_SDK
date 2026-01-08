# Discord Lobbies SDK - Development Roadmap

## Phase 1: Core Platform (v0.0.4) ✅ **RELEASED**

### Completed Features
- **OAuth Authentication** - Secure Discord login via Vercel backend
- **Lobbies Integration** - Full SDK integration for lobby management
- **Voice & Messaging** - Real-time communication in lobbies
- **Cross-Platform Support** - Windows & Linux binaries
- **Setup Wizard** - Guided SDK configuration
- **Quick Access Panel** - Fast lobby access from command palette
- **End-to-End Testing** - Connection validation and diagnostics

### Technical Foundation
- Native C++ addon (`discord_social_sdk.node`)
- Rust subprocess for lobbies (`lobbies-sdk`)
- Vercel backend for secure OAuth token exchange
- VS Code SecretStorage for credential management

---

## Phase 2: Developer Tools & Snippets (Planned v0.1.0)

### A. Language-Agnostic Helpers

**Discord Concepts Reference**
- Hover documentation on Discord terms (intents, permissions, events)
- Quick links to official Discord documentation
- Permission calculator & visual permission matrix

**API Structure Generators**
- Embed builder (visual UI → JSON output)
- Slash command builder (form → template)
- Button/component builder with interactive preview
- Modal builder for complex forms

### B. Code Snippets (Multi-Language)

**Supported Languages (Phase 2.1)**
- JavaScript/TypeScript (most Discord bot community)
- Python (educational + discord.py popularity)
- Rust (native integration with lobbies-sdk)

**Snippet Categories**
- Authentication & OAuth flow
- Slash command handlers
- Message embeds & rich content
- Event listeners & gateway setup
- User/guild data retrieval
- Common error handling patterns
- Lobbies SDK usage examples

**Example: "Generate Slash Command"**
```
User right-clicks → "Generate Discord Snippet"
→ Select language → Fills template with structure
→ User fills in logic
```

### C. Smart Integration Features

**Detect from Context**
- Analyze open file → suggest relevant snippets
- Cursor position → context-aware suggestions
- Workspace language detection → show compatible snippets only

**"Copy as Code" Features**
- Hover over lobby data → "Copy as embed JSON"
- Right-click message → "Generate handler code"
- Inspect Rich Presence → "Export structure"

---

## Phase 3: Bot Framework Integration (Planned v0.2.0)

- discord.py helper commands
- discord.js type hints & autocomplete
- Rust Discord crate integration
- Environment setup automation
- Bot token management (separate from extension auth)

---

## Implementation Strategy

### Phase 2.1 (v0.1.0) - MVP
- [ ] JSON generators (embed, slash command, button)
- [ ] Language detection
- [ ] 3 core languages supported
- [ ] 15-20 essential snippets per language
- [ ] "Copy as" context menu commands

### Phase 2.2 (v0.1.5) - Enhanced Snippets
- [ ] Snippet browser/search UI
- [ ] Custom snippet creation
- [ ] Snippet versioning (auto-update from Discord API)
- [ ] Community snippet sharing

### Phase 3.0 (v0.2.0) - Framework Integration
- [ ] Framework-specific setup guides
- [ ] Dependency management helpers
- [ ] Project scaffolding command

---

## Why This Architecture Works

1. **Extensible** - Add languages/frameworks without core changes
2. **Non-Breaking** - Snippets don't interfere with current features
3. **Value-Add** - Helps developers, doesn't complicate SDK integration
4. **Realistic** - Focused on language-agnostic patterns first
5. **Maintainable** - Snippets live in JSON, not hardcoded

---

## Current Limitations & Why It's OK

| Question | Answer |
|----------|--------|
| "Support all 50 languages?" | No - focus on Top 3 where 80% of users are |
| "Auto-generate bot code?" | No - humans write business logic. We provide templates |
| "IDE-level intellisense?" | Partial - snippets + documentation hover, not full LSP |
| "Compete with Discord.js docs?" | No - link to them. We bridge VS Code → Discord API |

---

## Success Metrics

- **Phase 2:** Snippet usage in 40% of extension users
- **Phase 3:** Framework templates reduce bot setup time by 50%
- **Overall:** Become preferred Discord dev tool in VS Code Marketplace

---

## Contributing

Ideas for snippets, languages, or features? Open an issue with:
1. Use case (what problem does it solve?)
2. Language/framework
3. Example code you'd like templated

---

**Last Updated:** January 8, 2026
