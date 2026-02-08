# Screen UI upgrade rules

- Follow `frontend/AGENTS.md` for required checks and shared frontend invariants.
- Preserve existing accessibility/test hooks (`aria-label`, `data-testid`, stable visible labels used by Playwright POMs).
  - If a selector must change, update tests/POM in the same PR.
- Avoid decorative chips/badges for passive guidance.
  - Use concise helper text for requirements/instructions.
- Keep section labels single-line.
  - Put secondary metadata (mapped source field, file meta, etc.) on a separate helper row.
  - Use `truncate` + `title` for long values.
- Typography parity across screens:
  - labels: minimum `text-xs`
  - controls/content: minimum `text-sm`
  - avoid `text-[10px]` except tiny static metadata.
- Page header structure should mirror Analysis:
  - icon + title/subtitle in page header
  - put table-centric search + primary actions in the table toolbar (not duplicated in page header)
  - avoid duplicate counters/info between header and toolbar.
- Table styling parity with Analysis:
  - avoid chips for routine table values (e.g., match type/category) unless state/severity needs emphasis
  - keep table value weight comparable to Analysis body cells
  - keep table header labels readable (avoid extra-heavy weight/tracking).
- Motion polish must be subtle and stable:
  - no hover translate on large containers/cards/panels/table wrappers
  - use color/border/shadow changes for hover feedback on large elements
  - no aggressive scale effects
  - no layout jitter.
- Use `frontend/src/screens/Analysis/Analysis.tsx` and `frontend/src/screens/Analysis/components/` as the visual baseline for scale, contrast, and density when revamping other screens.

## New UI migration status

- Migrated to new UI:
  - `frontend/src/screens/Analysis/`
  - `frontend/src/screens/ImportFlow/`
  - `frontend/src/screens/RuleManager/`
  - `frontend/src/screens/About/`
  - `frontend/src/screens/Settings/`
  - `frontend/src/screens/CategorizationLoop/`
  - `frontend/src/screens/CategoryManager/`
