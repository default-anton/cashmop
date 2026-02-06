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
- Motion polish must be subtle and stable:
  - 1px hover lift + soft shadow only
  - no aggressive scale effects
  - no layout jitter.
- Use `frontend/src/screens/Analysis/Analysis.tsx` and `frontend/src/screens/Analysis/components/` as the visual baseline for scale, contrast, and density when revamping other screens.
