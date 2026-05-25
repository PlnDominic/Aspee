# CLAUDE.md

## Project Overview

Aspee Pharma ERP is a full-featured enterprise resource planning system for a pharmaceutical company in Ghana. It covers sales, purchasing, production, quality assurance, HR/payroll, accounting, compliance, internal audit, and inventory. It is built for internal staff use and replaces manual spreadsheet-based workflows.

## Tech Stack

- Framework: Next.js 15 App Router
- Language: TypeScript 5 (strict mode)
- Styling: Tailwind CSS 4
- Database: Supabase (PostgreSQL)
- Auth: Supabase SSR (`@supabase/ssr`)
- State management: TanStack React Query 5
- Forms: React Hook Form + Zod
- Charts: Recharts
- Export: jsPDF, html2pdf, PapaParse (CSV)
- Email: Nodemailer
- Package manager: npm
- Deployment: Vercel (`npx vercel --prod`)

## Coding Conventions

- TypeScript everywhere — no `.js` files in `src/`
- Arrow functions for components and utilities, not `function` declarations
- Named exports only — no default exports for React components
- Path alias `@/*` maps to `./src/*` — always use it, never relative `../../`
- Component files: PascalCase (`InvoiceModal.tsx`)
- Utility/lib files: camelCase (`csvExport.ts`)
- Zod schemas live in `src/lib/schemas.ts`
- Supabase queries go directly in server components or API routes — no abstraction layer unless shared across 3+ places
- Currency is Ghana Cedis (GHS / GH₵) — always format with `src/lib/currency.ts`
- No `console.log` in committed code

## Never Do This

- Never install packages without asking first
- Never rewrite files that were not part of the task
- Never add placeholder comments like `// TODO: implement this`
- Never use default exports for React components
- Never hardcode currency symbols — use the currency utility
- Never skip Zod validation on form submissions
- Never bypass Supabase RLS without an explicit conversation about it
- Never create new migration files without being asked — schema changes are deliberate

## File Structure

```
src/
├── app/
│   ├── (dashboard)/          # All authenticated routes (grouped layout)
│   │   ├── accounting/       # Journal entries, bank reconciliation, expenses
│   │   ├── compliance/       # Regulatory compliance tracking
│   │   ├── hr/               # Employees, payroll, leave
│   │   ├── internal-audit/   # Audit trails and reports
│   │   ├── overview/         # Main dashboard
│   │   ├── production/       # Manufacturing orders and batch tracking
│   │   ├── purchasing/       # Purchase orders, suppliers
│   │   ├── qa/               # Quality assurance checks
│   │   ├── sales/            # Invoices, customers, sales reports
│   │   ├── settings/         # System configuration
│   │   └── stores/           # Inventory and stock management
│   ├── api/                  # Next.js API routes
│   ├── login/
│   └── signup/
├── components/               # Shared UI components and modals
├── lib/
│   ├── auditLog.ts           # Writes to internal audit log
│   ├── autoPostJournal.ts    # Auto-posts accounting entries
│   ├── csvExport.ts          # CSV download helper
│   ├── currency.ts           # GHS formatting
│   ├── pdfGenerator.ts       # PDF export helper
│   ├── schemas.ts            # All Zod schemas
│   └── hooks/                # Custom React hooks
supabase/
├── migrations/               # SQL migration files — do not edit manually
└── config.toml
```

## Current Goals

**In scope:**
- Sales module: customer categories, invoice enhancements (batch number, route, discount, cash/credit, damaged/gifted entries)
- 9 new sales reports (see Sales Requirements memory)
- Products flag: `Other Products` vs `Control Drugs`
- Products Requisition flow (sales person → Stores)

**Out of scope right now:**
- New ERP modules beyond the existing 9
- Mobile app or PWA
- Multi-company/multi-branch support
- External API integrations (third-party logistics, NHIS, etc.)

## Important Context

- All monetary values are in **Ghana Cedis (GHS)**
- Sales requirements came from Jeffrey Darko (Sales Dept) — treat his spec as the source of truth for the sales module
- The `stores` module is tightly coupled to `sales` and `purchasing` — stock movements must be recorded on invoice post
- `autoPostJournal.ts` runs automatically when invoices and purchase orders are confirmed — do not break this flow when editing those modules
- Supabase migrations are version-controlled; never alter existing migration files, only add new ones
- Deploy after every completed task: `npx vercel --prod`

## Communication Style

- Be direct. Skip the preamble.
- If unsure about something, ask before writing code.
- When making a change, state what changed and why in one sentence.
- Flag potential bugs or architectural issues even if not asked.
- Do not suggest reading documentation unless the question genuinely cannot be answered.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **aspee-pharma** (1786 symbols, 3872 relationships, 108 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/aspee-pharma/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/aspee-pharma/context` | Codebase overview, check index freshness |
| `gitnexus://repo/aspee-pharma/clusters` | All functional areas |
| `gitnexus://repo/aspee-pharma/processes` | All execution flows |
| `gitnexus://repo/aspee-pharma/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
