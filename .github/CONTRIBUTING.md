# Contributing to Stack-Init CLI

First off, thank you for taking the time to contribute! 🎉

This guide is written for **first-time contributors** as well as seasoned developers. Take your time, ask questions freely, and don't worry about making mistakes — that's what reviews are for.

---

## Table of Contents

1. [Before You Start](#before-you-start)
2. [Finding an Issue to Work On](#finding-an-issue-to-work-on)
3. [Setting Up Your Development Environment](#setting-up-your-development-environment)
4. [Making Your Changes](#making-your-changes)
5. [Opening a Pull Request](#opening-a-pull-request)
6. [The Review Process](#the-review-process)
7. [Reporting a Bug](#reporting-a-bug)
8. [Suggesting a Feature](#suggesting-a-feature)

---

## Before You Start

**You'll need:**

- [Node.js](https://nodejs.org/) v18 or later
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- [Git](https://git-scm.com/)
- A [GitHub account](https://github.com/)

**Helpful to know:**

- Stack-Init CLI is a monorepo managed with pnpm workspaces
- `packages/schema/` — Zod schemas that define the `stack-init.yaml` format
- `packages/cli/src/generators/` — one generator per framework (express, nest, fastapi, laravel…)
- `packages/cli/src/commands/generate.ts` — main dispatcher that routes to the right generator

You don't need to understand every generator to contribute. Most issues touch a single file or generator.

---

## Finding an Issue to Work On

### Step 1 — Browse the issues

Go to the [Issues tab](../../issues) on GitHub.

### Step 2 — Filter by label

| Label | What it means |
|---|---|
| `good first issue` | Small, well-defined task — perfect if this is your first contribution |
| `help wanted` | The maintainer is looking for help — any experience level welcome |
| `bug` | Something is broken |
| `enhancement` | A new feature or improvement |
| `documentation` | Fixes or additions to docs — great for non-code contributions |
| `generator` | Related to a specific code generator |

### Step 3 — Claim the issue

Leave a comment: *"I'd like to work on this."* The maintainer will assign it to you.

---

## Setting Up Your Development Environment

### 1. Fork the repository

Click the **Fork** button at the top right of this page.

### 2. Clone your fork

```bash
git clone https://github.com/YOUR_USERNAME/stack-init-cli.git
cd stack-init-cli
```

### 3. Add the upstream remote

```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/stack-init-cli.git
```

### 4. Install dependencies

```bash
pnpm install
```

### 5. Build the schema package

> **Important:** Whenever you change `packages/schema/`, you must rebuild before the CLI picks up the changes.

```bash
cd packages/schema && npm run build && cd ../..
```

### 6. Test the CLI locally

```bash
# From the repo root
node packages/cli/dist/index.js generate --help

# Or link it globally
pnpm --filter @stack-init/cli link --global
stack-init generate
```

You can use the sample `stack-init.yaml` at the repo root for testing:

```bash
stack-init generate
```

---

## Making Your Changes

### 1. Create a branch

```bash
git checkout -b fix/express-sequelize-connection
# or
git checkout -b feat/cli-dry-run-flag
# or
git checkout -b docs/generator-architecture
```

Branch naming: `fix/`, `feat/`, `docs/`, `refactor/`, `test/`

### 2. Understand the generator pattern

Each generator follows the same shape:

```typescript
// packages/cli/src/generators/express/index.ts
export async function generateExpress(config: ProjectConfig, outputDir: string): Promise<void> {
  // 1. Create directory structure
  // 2. Write files using config values
  // 3. Log generated files
}
```

When adding a new option to a generator:
1. Add the field to the Zod schema in `packages/schema/src/`
2. Rebuild the schema: `cd packages/schema && npm run build`
3. Implement the logic in the generator
4. Test with a sample `stack-init.yaml`

### 3. Commit your changes

```bash
git add packages/cli/src/generators/express/index.ts
git commit -m "fix: use config.database instead of config.orm in Express generator"
```

Commit message format: `type: short description`

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## Opening a Pull Request

### 1. Push your branch

```bash
git push origin your-branch-name
```

### 2. Open a PR on GitHub

Fill in the PR description:

```
Closes #42

## What
Fixed the Express generator always generating TODO stubs for the ORM layer.

## Why
The generator was reading `config.orm` but ExpressConfig stores the value in `config.database`.

## How to test
1. Create a stack-init.yaml with stack: express and database: prisma
2. Run `stack-init generate`
3. Check that the generated db/ folder contains real Prisma code, not TODO stubs
```

Write `Closes #ISSUE_NUMBER` to auto-close the issue on merge.

---

## The Review Process

1. A maintainer reviews your PR (usually within a few days)
2. They may request changes — respond in new commits on the same branch
3. Once approved, the PR is merged

**PRs merge faster when they:**
- Are focused on one thing
- Include a clear description and test steps
- Have no TypeScript errors (`npx tsc --noEmit`)
- Follow patterns already in the codebase

---

## Reporting a Bug

Use the **Bug Report** template and include:

- The `stack-init.yaml` you used (or a minimal reproduction)
- The exact command you ran
- The error output or unexpected behavior
- Your Node.js version (`node -v`)

---

## Suggesting a Feature

Use the **Feature Request** template. Explain what problem it solves and how you'd expect it to work. Generator support for a new framework? A new CLI flag? All suggestions are welcome.

---

## Questions?

Open a [Discussion](../../discussions) or comment on the relevant issue. No question is too small.

Happy contributing! 🚀
