# Project skills

Curated from [aitmpl.com](https://www.aitmpl.com/skills) (Claude Code Templates). Files come
unchanged from [`davila7/claude-code-templates`](https://github.com/davila7/claude-code-templates)
at commit `30f72e1815455e0df7618e9edf3e9877fa6c24e3`, path `cli-tool/components/skills/`.
Each skill keeps its own license; see `ANTHROPIC_ATTRIBUTION.md`. Bundled scripts were reviewed
before import: they read local CSV data, drive Playwright, or start a local dev server only.

| Skill | Source path | Used for |
| --- | --- | --- |
| `frontend-design` | `creative-design/frontend-design` | Visual direction, type and palette choices (most-installed skill on aitmpl) |
| `ui-ux-pro-max` | `creative-design/ui-ux-pro-max` | UX patterns and design-system search (local CSV database) |
| `web-design-guidelines` | `creative-design/web-design-guidelines` | Reviewing UI against the Web Interface Guidelines |
| `tailwind-patterns` | `creative-design/tailwind-patterns` | Tailwind CSS v4 conventions |
| `accessibility-auditor` | `creative-design/accessibility-auditor` | WCAG / ARIA checks |
| `react-best-practices` | `development/react-best-practices` | React performance and composition rules |
| `senior-frontend` | `development/senior-frontend` | Frontend architecture, Playwright UI audits |
| `fastapi-pro` | `development/fastapi-pro` | Working on the FCC FastAPI server in `server/` |
| `code-reviewer` | `development/code-reviewer` | Reviewing diffs and PRs |
| `cc-skill-security-review` | `development/cc-skill-security-review` | Security review of auth, secrets and API endpoints |
| `git-commit-helper` | `development/git-commit-helper` | Commit messages from diffs |
| `e2e-testing-patterns` | `development/e2e-testing-patterns` | Playwright test design |
| `webapp-testing` | `development/webapp-testing` | Driving the running app with Playwright |

Install more with `npx claude-code-templates@latest --skill <category>/<name>`.
