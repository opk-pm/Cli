# Opk GUI

A Vue + Vite + TypeScript + Sass interface for the Opk CLI.

## Features

- Persistent project sidebar (`~/.opk/gui-projects.json`)
- Finder-style add-project modal with quick locations and tree browsing
- Top status bar with PM, lockfiles, dependency stats, and project metadata
- Tabs: Overview, Packages, Project, Graph
- Quick actions wired to Opk CLI (`init`, `migrate`, `install`, `update`, `list`, `outdated`, etc.)
- Project scripts can be launched directly from the Project tab
- Registry results include both `add` and `info` actions for selected projects
- Lockfile-aware dependency graph view (`package-lock.json` and `bun.lock`, with package.json fallback)

## Run

```bash
cd gui
npm install
npm run dev
```

The GUI calls the local CLI entry at `../src/cli.ts` through a Vite API middleware.
