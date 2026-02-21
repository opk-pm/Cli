## Opk CLI

**Opk** is a unified package management workflow that sits on top of existing ecosystems like npm, Bun, pnpm, Yarn, and Deno.
It provides a consistent interface for installing, managing, and orchestrating dependencies across different runtimes and environments.

Rather than replacing existing package managers, Opk acts as a meta layer that standardizes tooling, simplifies configuration, and enables reproducible, cross-manager workflows.
It focuses on developer experience, deterministic installs, and ecosystem interoperability.

### Key Goals

- Unified package management across multiple ecosystems
- Consistent dependency and script workflows
- Cross-manager compatibility and migration
- Type-safe configuration and extensibility
- Reproducible and deterministic environments

Opk enables developers to manage packages once and run them anywhere.

## Commands

- `opk init` - Prompt for project metadata, write `package.ts`, run ts-pkg sync+generate
- `opk add <pkg...>` - Add packages via selected package manager, then sync+generate
- `opk remove <pkg...>` - Remove packages via selected package manager, then sync+generate
- `opk install` - Install via selected package manager, then sync+generate
- `opk update [pkg...]` - Update via selected package manager, then sync+generate
- `opk audit` - Audit via selected package manager, then sync+generate
- `opk run <script> [args...]` - Run scripts via selected package manager
- `opk exec <cmd> [args...]` - Execute binaries via selected package manager
- `opk list` - Show dependencies in a native opk UI
- `opk generate [configPath] [packageJsonPath]` - Generate `package.json` from ts-pkg config
- `opk sync [configPath] [packageJsonPath]` - Sync and regenerate using ts-pkg APIs

## package.ts

```ts
import { definePackage, BunPm } from '@opk/ts-pkg'

export default definePackage({
  pm: BunPm,
  name: 'my-awesome-project',
  description: 'this is an amazing project',
  license: 'MIT',
  type: 'module',
})
```
