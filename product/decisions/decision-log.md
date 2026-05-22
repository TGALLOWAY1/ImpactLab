# Decision Log

## 2026-05-22 — Establish `/product` as source-of-truth product system
- **Type:** process/architecture documentation decision
- **Context:** Repo has implementation depth but documentation is spread across root/docs files and can drift.
- **Decision:** Introduce structured `/product` hierarchy separating:
  - current state (`/wiki`, `/features`, `/flows`)
  - historical decisions (`/decisions`)
  - near-term execution (`/todos`)
  - long-term ideas (`/backlog`)
  - observability and evidence (`/diagnostics`, `/snapshots`)
- **Tradeoff:** Adds maintenance overhead but reduces ambiguity and audit cost.
- **Follow-up:** Enforce ongoing updates via `CLAUDE.md` operating rules.
