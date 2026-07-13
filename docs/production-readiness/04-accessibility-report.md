# 4 — Accessibility Report

## Current state
9 `aria-*` attributes across the entire `components/` tree. This is not a
close call — the app is far from WCAG 2.2 AA today. That's stated plainly
rather than softened, because the fix requires a dedicated, methodical pass
across every module, not a handful of line-item patches bundled into an
unrelated feature PR (which is exactly the kind of shortcut that leaves
accessibility permanently "almost done").

## What's needed, roughly in impact order
1. **Forms** (28 files, per the toast audit) — every form needs: a
   `<label>` (visible or `sr-only`) associated with each input via `htmlFor`/
   `id`, error messages linked via `aria-describedby`, and required fields
   marked with `aria-required` or the native `required` attribute
   consistently (currently inconsistent — spot checks show some forms use
   native `required`, others rely on client-side validation only).
2. **Charts** (Recharts throughout Dashboard, Investments, Net Worth) — no
   accessible data-table fallback or `aria-label` summary found on any chart
   container. Recommend a shared `<ChartCard>` wrapper (already proposed in
   the Phase 2 Design System plan) that always renders a visually-hidden
   summary sentence alongside the chart.
3. **Focus management** — modals/dialogs (via `components/ui/dialog.tsx`,
   Radix-based) get correct focus trapping for free from Radix, which is a
   real strength already in place. Custom dropdowns/menus outside Radix
   primitives were not individually audited this pass.
4. **Color contrast** — the dark theme's muted-text color
   (`--muted-foreground` equivalent) was not measured against WCAG AA's 4.5:1
   ratio in this pass; flagged for a dedicated contrast audit tool run
   (e.g. axe DevTools or Lighthouse) rather than an eyeballed guess here.
5. **Keyboard navigation** — the (currently non-functional) global search's
   `Ctrl K` shortcut is the most visible planned keyboard entry point; once
   built (see `05-search-experience-plan.md`... not yet written this pass,
   folded into the audit) it should set the standard for keyboard-first
   interaction the rest of the app can be measured against.

## Recommended approach
Run an automated pass first (axe-core or Lighthouse CI) to get a concrete,
numbered violation list rather than continuing to estimate from spot checks
— then fix in priority order above. Not run in this pass since it requires
a live, running instance rather than static code analysis.
