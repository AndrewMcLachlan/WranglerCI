# Unified Filter Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every filter on every Wrangler page becomes a labelled moo-ds ComboBox group with coloured dots preserved, after one prerequisite moo-ds fix (creatable + search).

**Architecture:** Two repos, sequenced. First `K:\Dev\Libraries\MooApp` (npm-workspaces monorepo): fix `ComboBoxInput` so `creatable` works when a `search` callback is set; merging to `main` auto-publishes to GitHub Packages. Then `K:\Dev\Apps\Wrangler`: bump moo-ds, add two pure helpers (`dotLabel`, `optionSearch`) + a shared `.filter-bar` CSS convention, and convert each page's filters to ComboBox groups. Filter *logic* (predicates, localStorage keys, query keys, empty-selection semantics) is byte-identical — only controls change.

**Tech Stack:** React 19, moo-ds ComboBox, TanStack Query 5, Vitest (both repos; moo-ds also has @testing-library/react).

**Spec:** `docs/superpowers/specs/2026-07-23-unified-filter-experience-design.md`

## Global Constraints

- **No filter-logic changes**: same localStorage keys (`branchFilter`, `prStatusFilter`, `prIncludeTags`, `prExcludeTags`, `prAuthors`, `attentionTypeFilter`), same hooks, same predicates and query keys, same empty-selection semantics (empty = no constraint; authors-empty still disables the PR query).
- Wrangler is frontend-only — nothing under `src/Wrangler.Api/`, never edit `src/Wrangler.App/src/api/`.
- `DashboardProvider` stays (same-document sync between the branch filter and `useWorkflows`).
- `prAuthors` keeps its react-query wrapper (`usePrAuthors`/`useUpdatePrAuthors`).
- moo-ds's default text filtering calls `labelField(i).toString()` — any ComboBox whose `labelField` returns a ReactNode MUST supply a `search` callback filtering on a plain string field.
- moo-ds repo (`K:\Dev\Libraries\MooApp`): npm-workspaces monorepo; all commands from the repo root; conventional commit messages (`fix(moo-ds): …`); merging to `main` auto-publishes (CI sets the version), so nothing merges without the user's go-ahead.
- Verification gates: MooApp = `npm run test:run && npm run lint && npm run build`; Wrangler = `npm test && npm run lint && npm run build` (from `src/Wrangler.App`).
- Wrangler work happens on branch `feature/unified-filter-experience`; MooApp work on branch `fix/combobox-creatable-with-search`.
- `src/Wrangler.App/src/routeTree.gen.ts` is auto-generated — if a build dirties it, revert it; never commit it.

## File Structure

**MooApp repo (`K:\Dev\Libraries\MooApp`):**

| File | Action | Responsibility |
|---|---|---|
| `moo-ds/src/components/comboBox/ComboBoxInput.tsx` | Modify | Creatable "Add '…'" flow inside the debounced search path. |
| `moo-ds/src/components/comboBox/__tests__/ComboBoxInput.test.tsx` | Modify | Tests for creatable-with-search. |

**Wrangler repo (`K:\Dev\Apps\Wrangler\src\Wrangler.App`):**

| File | Action | Responsibility |
|---|---|---|
| `package.json` / `package-lock.json` | Modify | moo package bump via `npm run update-moo`. |
| `vitest.config.ts` | Modify | Include `.test.tsx` files. |
| `src/components/filters/filterOptions.tsx` | Create | `dotLabel`, `optionSearch` pure helpers. |
| `src/components/filters/filterOptions.test.tsx` | Create | Unit tests for both helpers. |
| `src/css/components/filter-bar.css` | Create | Shared `.filter-bar`/`.filter-group`/`.filter-label`/`.dot`/`.filter-combo` styles. |
| `src/css/components.css` | Modify | Import swap (`filters.css` → `filter-bar.css`). |
| `src/css/components/filters.css` | Delete | Superseded by filter-bar.css. |
| `src/routes/dashboard/-components/shared/Filters.tsx` | Modify | Branch filter → ComboBox group. |
| `src/routes/dashboard/-providers/DashboardProvider.tsx` | Modify | Expose `setBranchFilter` for removal/clear. |
| `src/routes/pull-requests/-components/PullRequests.tsx` | Modify | Status/author/tag filters → ComboBox groups; bespoke typeahead removed. |
| `src/css/components/pull-requests.css` | Modify | Delete chip/typeahead/badge-row CSS. |
| `src/routes/attention/-components/Attention.tsx` | Modify | Type chips → ComboBox group, rendered unconditionally. |
| `src/css/components/attention.css` | Modify | Delete chip CSS. |

---

### Task 1: moo-ds — creatable works with search (MooApp repo)

**Files:**
- Modify: `K:\Dev\Libraries\MooApp\moo-ds\src\components\comboBox\ComboBoxInput.tsx:12-16`
- Test: `K:\Dev\Libraries\MooApp\moo-ds\src\components\comboBox\__tests__\ComboBoxInput.test.tsx`

**Interfaces:**
- Consumes: existing `useComboBox()` context (`creatable`, `createLabel`, `newItem`, `setNewItem`, `labelField`, `search`, `setItems`, `setShow`).
- Produces: behavioural contract for Task 4+ — a ComboBox with BOTH `search` and `creatable` offers "Add '…'" (label from `createLabel(input)`) when no search result's label matches the typed text case-insensitively; selecting it fires `onCreate(text)`. Empty input never offers an add option.

- [ ] **Step 1: Create the working branch**

```bash
cd /k/Dev/Libraries/MooApp
git checkout main && git pull
git checkout -b fix/combobox-creatable-with-search
```

- [ ] **Step 2: Write the failing tests**

Append to `K:\Dev\Libraries\MooApp\moo-ds\src\components\comboBox\__tests__\ComboBoxInput.test.tsx`, inside the top-level `describe('ComboBoxInput', ...)` block (after the `visibility` describe). Also add this import at the top of the file with the other imports:

```tsx
import { ComboBoxList } from '../ComboBoxList';
```

New describe block:

```tsx
  describe('creatable with search', () => {
    const renderCreatableSearch = (search: (input: string) => Item[], onCreate = vi.fn()) => {
      render(
        <ComboBoxProvider
          {...defaultProps}
          search={search}
          creatable
          createLabel={(input: string) => `Add "${input}"`}
          onCreate={onCreate}
        >
          <ComboBoxInput placeholder="Search..." readonly={false} />
          <ComboBoxList />
        </ComboBoxProvider>
      );
      return onCreate;
    };

    it('offers the add option when no search result matches the typed text', () => {
      vi.useFakeTimers();
      try {
        const onCreate = renderCreatableSearch(vi.fn().mockReturnValue([items[0]]));

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Pear' } });
        act(() => {
          vi.advanceTimersByTime(300);
        });

        const addOption = screen.getByText('Add "Pear"');
        expect(addOption).toBeInTheDocument();

        fireEvent.click(addOption);
        expect(onCreate).toHaveBeenCalledWith('Pear');
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not offer the add option when a search result matches case-insensitively', () => {
      vi.useFakeTimers();
      try {
        renderCreatableSearch(vi.fn().mockReturnValue([items[0]])); // Apple

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'apple' } });
        act(() => {
          vi.advanceTimersByTime(300);
        });

        expect(screen.queryByText('Add "apple"')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not offer the add option for empty input', () => {
      vi.useFakeTimers();
      try {
        renderCreatableSearch(vi.fn().mockReturnValue([]));

        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'x' } });
        fireEvent.change(input, { target: { value: '' } });
        act(() => {
          vi.advanceTimersByTime(300);
        });

        expect(screen.queryByText(/^Add "/)).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `/k/Dev/Libraries/MooApp`): `npm run test:run -- ComboBoxInput`
Expected: the first new test FAILS (no "Add \"Pear\"" rendered); the other two pass vacuously or fail — what matters is the first one fails because the search path never sets `newItem`.

- [ ] **Step 4: Implement the fix**

In `K:\Dev\Libraries\MooApp\moo-ds\src\components\comboBox\ComboBoxInput.tsx`, replace the `runSearch` definition (lines 12–16):

```tsx
    const runSearch = useDebouncedCallback((value: string) => {
        if (!search) return;
        const results = search(value);
        setItems(results);

        // Mirror the non-search branch's creatable flow: offer "Add '…'" when
        // the typed text matches none of the results. Empty input never
        // offers an add option.
        if (creatable && value !== "" && !results.some((i) => labelField(i).toString().toLowerCase() === value.toLowerCase())) {

            const addItem = newItem ? newItem : {};

            addItem.label = createLabel(value);

            setNewItem(addItem);
        }
        else if (creatable) {
            setNewItem(null);
        }

        setShow(true);
    }, 300);
```

Note the `else if (creatable) setNewItem(null)` — it clears a stale "Add '…'" option when the text becomes empty or now matches a result, so the third test passes.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- ComboBoxInput`
Expected: PASS — all existing ComboBoxInput tests plus the three new ones.

- [ ] **Step 6: Full verification gate**

Run (from `/k/Dev/Libraries/MooApp`): `npm run test:run && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add moo-ds/src/components/comboBox/ComboBoxInput.tsx moo-ds/src/components/comboBox/__tests__/ComboBoxInput.test.tsx
git commit -m "fix(moo-ds): offer creatable add option when search is set

The creatable newItem flow lived only in the non-search branch of
ComboBoxInput.onChange, so a ComboBox with a search callback never offered
to add free text. Run the same check against the search results inside the
debounced search path, and clear a stale add option when the text matches."
```

---

### Task 2: moo-ds release + Wrangler bump (cross-repo checkpoint)

**Files:**
- Modify: `K:\Dev\Apps\Wrangler\src\Wrangler.App\package.json`, `package-lock.json` (via `npm run update-moo`)

**Interfaces:**
- Consumes: Task 1's merged commit on MooApp `main`.
- Produces: Wrangler depends on a published moo-ds version containing the creatable-with-search fix; Wrangler branch `feature/unified-filter-experience` exists for all later tasks.

> **CHECKPOINT — user action required.** Merging MooApp `main` publishes packages automatically (CI computes the version and runs `npm publish`). Do not merge without the user's explicit go-ahead.

- [ ] **Step 1: Push and open the MooApp PR**

```bash
cd /k/Dev/Libraries/MooApp
git push -u origin fix/combobox-creatable-with-search
gh pr create --base main --title "fix(moo-ds): offer creatable add option when search is set" --body "The creatable newItem flow lived only in the non-search branch of ComboBoxInput.onChange, so a ComboBox with a search callback never offered to add free text. Needed by Wrangler's unified filter experience (author picker: remote typeahead + free-entry bot logins)."
```

- [ ] **Step 2: Wait for PR checks, then hand to the user**

Run: `gh pr checks --watch`
Expected: all green. Then ask the user to merge (or get their explicit OK to merge it for them). **Stop until merged.**

- [ ] **Step 3: Confirm the publish succeeded**

After the merge:

```bash
gh run list --branch main --limit 1        # note the run id of the Build workflow
gh run watch <run-id>
```

Expected: the workflow completes successfully (it publishes moo-ds/moo-app/moo-icons with the new version).

- [ ] **Step 4: Create the Wrangler branch and bump the moo packages**

```bash
cd /k/Dev/Apps/Wrangler
git checkout main && git pull
git checkout -b feature/unified-filter-experience
cd src/Wrangler.App
npm run update-moo
```

Expected: `package.json` shows all three `@andrewmclachlan/moo-*` packages at a version **greater than 5.2.66**.

- [ ] **Step 5: Verify Wrangler still builds against the bump**

Run (from `src/Wrangler.App`): `npm test && npm run lint && npm run build`
Expected: all pass (the bump may pull other moo changes since 5.2.66 — if the build breaks on something unrelated to this plan, STOP and report rather than fixing unrelated breakage silently).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "Bump moo packages for ComboBox creatable-with-search fix"
```

---

### Task 3: Wrangler shared filter helpers + filter-bar CSS

**Files:**
- Create: `src/Wrangler.App/src/components/filters/filterOptions.tsx`
- Test: `src/Wrangler.App/src/components/filters/filterOptions.test.tsx`
- Create: `src/Wrangler.App/src/css/components/filter-bar.css`
- Modify: `src/Wrangler.App/src/css/components.css`
- Delete: `src/Wrangler.App/src/css/components/filters.css`
- Modify: `src/Wrangler.App/vitest.config.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure additions).
- Produces (later tasks rely on these exact names):
  - `dotLabel<T>(colourClass: (option: T) => string, label: (option: T) => string): (option: T) => ReactNode` — labelField renderer emitting `<span className={"dot " + colourClass(option)} aria-hidden="true" />` followed by the label text.
  - `optionSearch<T>(options: T[], field: (option: T) => string): (input: string) => T[]` — case-insensitive substring filter on a plain string field; empty/whitespace input returns all options.
  - CSS classes: `.filter-bar` (wrapping flex row), `.filter-group` (label + control pair), `.filter-label`, `.dot` with variants `green red amber grey purple`, `.filter-combo` (ComboBox sizing), and `.controls .actions { margin-left: auto }` (action buttons pinned right on every page).
  - NOTE: `filters.css` (the `.filters` scope used by the old dashboard branch filter) is deleted in this task; the dashboard component still references `.filters` until Task 4 — that is an acceptable one-task styling gap on the dashboard only, resolved by Task 4 in the same PR.

- [ ] **Step 1: Widen the vitest include pattern**

In `src/Wrangler.App/vitest.config.ts`, replace:

```ts
    include: ["src/**/*.test.ts"],
```

with:

```ts
    include: ["src/**/*.test.{ts,tsx}"],
```

(If the `.tsx` test later fails with a JSX transform error, add `esbuild: { jsx: "automatic" }` at the top level of the config object — normally unnecessary because Vitest picks up the app tsconfig's `jsx` setting.)

- [ ] **Step 2: Write the failing tests**

Create `src/Wrangler.App/src/components/filters/filterOptions.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import type { ReactElement } from "react";
import { dotLabel, optionSearch } from "./filterOptions";

describe("dotLabel", () => {
  const render = dotLabel<string>(() => "green", (o) => o.toUpperCase());

  it("renders a colour dot followed by the label text", () => {
    const el = render("Success") as ReactElement<{ children: unknown[] }>;
    const [dot, text] = el.props.children as [ReactElement<{ className: string; "aria-hidden": string }>, string];
    expect(dot.props.className).toBe("dot green");
    expect(dot.props["aria-hidden"]).toBe("true");
    expect(text).toBe("SUCCESS");
  });

  it("resolves the colour class per option", () => {
    const perOption = dotLabel<{ name: string; colour: string }>((o) => o.colour, (o) => o.name);
    const el = perOption({ name: "Failure", colour: "red" }) as ReactElement<{ children: unknown[] }>;
    const [dot] = el.props.children as [ReactElement<{ className: string }>];
    expect(dot.props.className).toBe("dot red");
  });
});

describe("optionSearch", () => {
  const options = ["Success", "Failure", "Pending", "Unknown"];
  const search = optionSearch(options, (o) => o);

  it("filters case-insensitively by substring", () => {
    expect(search("fail")).toEqual(["Failure"]);
    expect(search("N")).toEqual(["Pending", "Unknown"]);
  });

  it("returns all options for empty or whitespace input", () => {
    expect(search("")).toEqual(options);
    expect(search("   ")).toEqual(options);
  });

  it("returns empty for no match", () => {
    expect(search("zzz")).toEqual([]);
  });

  it("filters on the given field for object options", () => {
    const byName = optionSearch([{ name: "Apple" }, { name: "Pear" }], (o) => o.name);
    expect(byName("pea")).toEqual([{ name: "Pear" }]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `src/Wrangler.App`): `npm test`
Expected: FAIL — cannot resolve `./filterOptions`.

- [ ] **Step 4: Implement the helpers**

Create `src/Wrangler.App/src/components/filters/filterOptions.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * Builds a ComboBox labelField renderer that prefixes the label with a
 * coloured dot. The dot appears in the dropdown option list and inside the
 * selected pills. IMPORTANT: a ComboBox using this MUST also pass a `search`
 * callback (see optionSearch) — moo-ds's default filtering stringifies the
 * label, which breaks on ReactNode output.
 */
export const dotLabel = <T,>(colourClass: (option: T) => string, label: (option: T) => string) =>
  (option: T): ReactNode => (
    <>
      <span className={`dot ${colourClass(option)}`} aria-hidden="true" />
      {label(option)}
    </>
  );

/**
 * Builds a ComboBox search callback that filters a fixed option list by
 * case-insensitive substring on a plain string field. Empty input returns
 * every option.
 */
export const optionSearch = <T,>(options: T[], field: (option: T) => string) =>
  (input: string): T[] => {
    const query = input.trim().toLowerCase();
    if (query === "") return options;
    return options.filter((option) => field(option).toLowerCase().includes(query));
  };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (existing 19 + 6 new).

- [ ] **Step 6: Create the shared stylesheet and swap imports**

Create `src/Wrangler.App/src/css/components/filter-bar.css`:

```css
/* Shared filter conventions: every page's filters are labelled ComboBox
   groups inside a .filter-bar row, with the page's action buttons pinned to
   the right edge of the surrounding .controls row. */

.filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.filter-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.55);
    white-space: nowrap;
}

/* Colour dot used in ComboBox option lists, selected pills, and filter
   labels. Global (not @scope'd) because moo-ds renders the options. */
.dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-right: 0.4rem;

    &.green { background: #6bcc6b; }
    &.red { background: #ff6b6b; }
    &.amber { background: #e8c44a; }
    &.grey { background: rgba(255, 255, 255, 0.4); }
    &.purple { background: #b98cf0; }
}

/* Inside a filter label the flex gap provides the spacing. */
.filter-label .dot {
    margin-right: 0;
}

/* Match the standard control height and stop pickers growing to fill the row. */
.filter-combo {
    --input-padding-v: 0.375rem;
    --input-padding-h: 0.75rem;
    flex: 0 1 240px;
    min-width: 180px;
    max-width: 280px;
    font-size: 0.85rem;
}

/* Action buttons (Approve etc.) sit at the right edge on every page. */
.controls .actions {
    margin-left: auto;
}
```

In `src/Wrangler.App/src/css/components.css`, replace:

```css
@import "./components/filters.css";
```

with:

```css
@import "./components/filter-bar.css";
```

Then delete the old file:

```bash
git rm src/css/components/filters.css
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/filters src/css vitest.config.ts
git commit -m "Add shared filter helpers and filter-bar styles

dotLabel renders coloured dots in ComboBox option lists and pills;
optionSearch supplies string-field filtering (moo-ds default filtering
cannot handle ReactNode labels)."
```

---

### Task 4: Dashboard — branch filter becomes a ComboBox group

**Files:**
- Modify: `src/Wrangler.App/src/routes/dashboard/-providers/DashboardProvider.tsx`
- Modify: `src/Wrangler.App/src/routes/dashboard/-components/shared/Filters.tsx`

**Interfaces:**
- Consumes: `.filter-bar`/`.filter-group`/`.filter-combo` CSS (Task 3); moo-ds ComboBox `creatable`/`onCreate` (non-search path — works pre-fix, but Task 2 already bumped).
- Produces: `DashboardContextType` gains `setBranchFilter: (branches: string[]) => void` and drops `removeBranchFilter` (its only consumer was the old CloseBadge row; pill removal now flows through `onChange` → `setBranchFilter`). `useWorkflows` only reads `branchFilter` — unchanged.

- [ ] **Step 1: Expose a setter from the provider**

Replace the full contents of `src/Wrangler.App/src/routes/dashboard/-providers/DashboardProvider.tsx` with:

```tsx
import { useLocalStorage } from "@andrewmclachlan/moo-ds";
import { createContext, useContext, type PropsWithChildren } from "react";

interface DashboardContextType {
  branchFilter: string[];
  addBranchFilter: (branch: string) => void;
  setBranchFilter: (branches: string[]) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<PropsWithChildren<unknown>> = ({ children }) => {

  const [branchFilter, setBranchFilter] = useLocalStorage<string[]>("branchFilter", []);

  const addBranchFilter = (branch: string) => {
    if (branchFilter.includes(branch)) {
      return; // Prevent adding duplicates
    }
    setBranchFilter(prev => [...prev, branch]);
  }

  return (
    <DashboardContext.Provider value={{ branchFilter, addBranchFilter, setBranchFilter }}>
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboardContext must be used within a DashboardProvider");
  }
  return context;
}
```

- [ ] **Step 2: Rewrite `Filters.tsx`**

Replace the full contents of `src/Wrangler.App/src/routes/dashboard/-components/shared/Filters.tsx` with:

```tsx
import { useMemo } from "react";
import { ComboBox } from "@andrewmclachlan/moo-ds";
import { useDashboardContext } from "../../-providers/DashboardProvider";

interface BranchOption {
  name: string;
}

export const Filters = () => {

  const { branchFilter, addBranchFilter, setBranchFilter } = useDashboardContext();

  const selectedBranches = useMemo<BranchOption[]>(() => branchFilter.map((name) => ({ name })), [branchFilter]);

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <span className="filter-label">Branches</span>
        <ComboBox<BranchOption>
          className="filter-combo"
          placeholder="Add branches..."
          multiSelect
          clearable
          creatable
          createLabel={(input) => `Add "${input.trim()}"`}
          items={[]}
          selectedItems={selectedBranches}
          labelField={(b) => b.name}
          valueField={(b) => b.name}
          onCreate={(name) => name.trim() !== "" && addBranchFilter(name.trim())}
          onChange={(items) => setBranchFilter(items.map((b) => b.name))}
        />
      </div>
    </div>
  );
}
```

Notes for the implementer: there are no suggestion items (branches are free-form), so typing offers only the "Add '…'" option; `onCreate` handles adds (deduped in the provider), and `onChange` handles pill removal and the clear control (it fires with the remaining/empty selection).

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open the Dashboard.
Expected: `Branches ▸ [picker]` group; typing a branch name offers "Add '…'"; selecting it adds a pill; removing pills and the clear control both update the dashboard's workflow runs (same `branchFilter` key — verify persistence across a reload).

- [ ] **Step 5: Commit**

```bash
git add src/routes/dashboard
git commit -m "Convert dashboard branch filter to a ComboBox group"
```

---

### Task 5: Pull Requests — status, author, and tag filters as ComboBox groups

**Files:**
- Modify: `src/Wrangler.App/src/routes/pull-requests/-components/PullRequests.tsx`
- Modify: `src/Wrangler.App/src/css/components/pull-requests.css`

**Interfaces:**
- Consumes: `dotLabel`, `optionSearch` from `../../../components/filters/filterOptions` (Task 3); moo-ds creatable-with-search (Tasks 1–2); existing hooks `usePrStatusFilter`, `usePrIncludeTags`/`usePrExcludeTags`, `usePrAuthors`/`useUpdatePrAuthors`, `useUserSearch` — all unchanged.
- Produces: nothing new for later tasks; Attention (Task 6) uses the same group pattern.

- [ ] **Step 1: Update `PullRequests.tsx` — imports and module-level constants**

1a. Add to the imports:

```tsx
import { dotLabel, optionSearch } from "../../../components/filters/filterOptions";
```

1b. After the existing `STATUS_DOT` constant, add the module-level renderers:

```tsx
const statusLabel = dotLabel<CheckStatus>((s) => STATUS_DOT[s], (s) => s);
const statusSearch = optionSearch<CheckStatus>(STATUS_OPTIONS, (s) => s);

interface AuthorOption {
  login: string;
}
```

- [ ] **Step 2: Replace the author typeahead state and handlers**

2a. In the component body, replace the typeahead state:

```tsx
  const [authorQuery, setAuthorQuery] = useState("");
  const [authorFocused, setAuthorFocused] = useState(false);
  const { data: authorSuggestions } = useUserSearch(authorQuery);
```

with:

```tsx
  const [authorQuery, setAuthorQuery] = useState("");
  const { data: authorSuggestions } = useUserSearch(authorQuery);

  // Remote suggestions as ComboBox items, minus already-selected authors.
  // Passing them as `items` keeps the open dropdown reactive when the
  // debounced query resolves after the search callback has already run.
  const authorItems = useMemo<AuthorOption[]>(
    () => (authorSuggestions ?? [])
      .filter((u) => !authors.includes(u.login))
      .map((u) => ({ login: u.login })),
    [authorSuggestions, authors]);

  const selectedAuthorItems = useMemo<AuthorOption[]>(() => authors.map((login) => ({ login })), [authors]);
```

2b. Replace the `addAuthor`, `checkInput`, `removeAuthor`, and `showAuthorSuggestions` block:

```tsx
  // Add an author by exact login — used both for typeahead selections and for
  // typing a login directly (so bots like dependabot[bot], which user search
  // won't surface, stay addable).
  const addAuthor = (value: string) => {
    const login = value.trim().replace(/[,;]/g, "");
    if (login !== "" && !authors.includes(login)) {
      updateAuthors([...authors, login]);
    }
    setAuthorQuery("");
  };

  const checkInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" && e.key !== " " && e.key !== "," && e.key !== ";") {
      return;
    }
    e.preventDefault();
    addAuthor(authorQuery);
  };

  const removeAuthor = (author: string) => {
    updateAuthors(authors.filter(a => a !== author));
  };

  const showAuthorSuggestions =
    authorFocused && authorQuery.trim().length >= 2 && (authorSuggestions?.length ?? 0) > 0;
```

with:

```tsx
  // Add an author by exact login — used by the ComboBox's creatable option
  // (so bots like dependabot[bot], which user search won't surface, stay
  // addable).
  const addAuthor = (value: string) => {
    const login = value.trim().replace(/[,;]/g, "");
    if (login !== "" && !authors.includes(login)) {
      updateAuthors([...authors, login]);
    }
    setAuthorQuery("");
  };

  // ComboBox search callback: drives the debounced remote user search via
  // authorQuery and returns whatever suggestions are currently loaded.
  const authorSearch = (input: string) => {
    setAuthorQuery(input);
    const query = input.trim().toLowerCase();
    return authorItems.filter((o) => o.login.toLowerCase().includes(query));
  };
```

- [ ] **Step 3: Rebuild the control bar JSX**

Replace the whole `<div className="pr-filters">…</div>` block (author filter div, status-filter div, tag-filters div, author-badges div) with:

```tsx
        <div className="filter-bar">
          <div className="filter-group">
            <span className="filter-label">Authors</span>
            <ComboBox<AuthorOption>
              className="filter-combo"
              placeholder="Add authors..."
              multiSelect
              clearable
              creatable
              createLabel={(input) => `Add "${input.trim()}"`}
              items={authorItems}
              selectedItems={selectedAuthorItems}
              labelField={(o) => o.login}
              valueField={(o) => o.login}
              search={authorSearch}
              onCreate={addAuthor}
              onChange={(items) => updateAuthors(items.map((o) => o.login))}
            />
          </div>
          <div className="filter-group">
            <span className="filter-label">Status</span>
            <ComboBox<CheckStatus>
              className="filter-combo"
              placeholder="Any status"
              multiSelect
              clearable
              items={STATUS_OPTIONS}
              selectedItems={statusFilter}
              labelField={statusLabel}
              valueField={(s) => s}
              search={(input) => statusSearch(input).filter((s) => !statusSet.has(s))}
              onChange={(items) => setStatusFilter(items)}
            />
          </div>
          <div className="filter-group">
            <span className="filter-label"><span className="dot green" />Include</span>
            <ComboBox<TagOption>
              className="filter-combo"
              placeholder="Add tags..."
              multiSelect
              items={availableTags}
              selectedItems={includeTagOptions}
              labelField={(t) => t.name}
              valueField={(t) => t.name}
              colourField={(t) => `#${t.color}`}
              onChange={(items) => setIncludeTags(items.map((t) => t.name))}
            />
          </div>
          <div className="filter-group">
            <span className="filter-label"><span className="dot red" />Exclude</span>
            <ComboBox<TagOption>
              className="filter-combo"
              placeholder="Add tags..."
              multiSelect
              items={availableTags}
              selectedItems={excludeTagOptions}
              labelField={(t) => t.name}
              valueField={(t) => t.name}
              colourField={(t) => `#${t.color}`}
              onChange={(items) => setExcludeTags(items.map((t) => t.name))}
            />
          </div>
        </div>
```

Notes: the tag ComboBoxes keep moo-ds default filtering (string labels — no `search` needed); the status picker excludes already-selected statuses from its own search results (custom `search` bypasses moo-ds's built-in selected-item exclusion); `toggleStatus` and its `statusSet` usage in filtering remain — delete only the `toggleStatus` function (the chips' click handler), keep `statusSet`.

- [ ] **Step 4: Delete the dead code and CSS**

4a. In `PullRequests.tsx`: remove the now-unused `toggleStatus` function and the `STATUS_DOT`-dependent chip JSX is already gone; `STATUS_DOT` itself stays (used by `statusLabel`). Run lint to catch any other orphans (e.g. unused imports).

4b. In `src/Wrangler.App/src/css/components/pull-requests.css`, delete these blocks entirely: `.pr-filters`, `.author-filter`, `.author-input`, `.author-suggestions` (and its nested `li`), `.author-suggestion-avatar`, `.author-suggestion-login`, `.author-suggestion-name`, `.author-badges` (and its nested `.badge` override), `.status-filter`, `.status-chip` (and its `&:hover`/`&.active`), `.status-dot` (and the two `.status-chip … .status-dot` rules), `.tag-filters`, `.tag-filter-group`, `.tag-filter-label`, `.tag-dot`, `.tag-filter`. Keep `.controls`, `.actions`, `.pr-open-link`, `.pr-title-cell`, `.pr-labels`, `.badge.pr-label`.

- [ ] **Step 5: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass; lint reports no unused variables in `PullRequests.tsx`.

- [ ] **Step 6: Manual check**

Run: `npm run dev`, open Pull Requests.
Expected: four labelled groups (Authors / Status / Include / Exclude) + Approve pinned right. Status options show coloured dots in the dropdown and pills. Author picker: typing ≥2 chars shows GitHub user suggestions; typing `dependabot[bot]` offers `Add "dependabot[bot]"`; adding/removing authors updates the PR list (server refetch). Tag pickers behave exactly as before. All selections survive a reload.

- [ ] **Step 7: Commit**

```bash
git add src/routes/pull-requests src/css/components/pull-requests.css
git commit -m "Convert Pull Requests filters to ComboBox groups

Status chips and the bespoke author typeahead become moo-ds ComboBoxes with
coloured dots; tag pickers adopt the shared filter-group convention."
```

---

### Task 6: Attention — type filter as a ComboBox group

**Files:**
- Modify: `src/Wrangler.App/src/routes/attention/-components/Attention.tsx`
- Modify: `src/Wrangler.App/src/css/components/attention.css`

**Interfaces:**
- Consumes: `dotLabel`, `optionSearch` (Task 3); existing `useAttentionTypeFilter` hook and `TYPE_LABEL`/`TYPE_CLASS`/`TYPE_OPTIONS` constants — unchanged.
- Produces: nothing for later tasks.

- [ ] **Step 1: Update `Attention.tsx`**

1a. Add imports:

```tsx
import { ComboBox } from "@andrewmclachlan/moo-ds";
import { dotLabel, optionSearch } from "../../../components/filters/filterOptions";
```

1b. After the `TYPE_OPTIONS` constant, add module-level renderers:

```tsx
const typeLabel = dotLabel<AttentionItemType>((t) => TYPE_CLASS[t], (t) => TYPE_LABEL[t]);
const typeSearch = optionSearch<AttentionItemType>(TYPE_OPTIONS, (t) => TYPE_LABEL[t]);
```

1c. In the component body, delete the `toggleType` function (the chips' click handler); keep `typeSet`.

1d. Replace the conditional chips block:

```tsx
      {hasItems && (
        <div className="attention-filters" role="group" aria-label="Filter by type">
          {TYPE_OPTIONS.map((type) => (
            <button
              key={type}
              type="button"
              className={`attention-chip${typeSet.has(type) ? " active" : ""}`}
              aria-pressed={typeSet.has(type)}
              onClick={() => toggleType(type)}
            >
              <span className={`attention-dot ${TYPE_CLASS[type]}`} />
              {TYPE_LABEL[type]}
            </button>
          ))}
        </div>
      )}
```

with an unconditional filter bar (spec: the "chips render only when items exist" quirk is removed):

```tsx
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Type</span>
          <ComboBox<AttentionItemType>
            className="filter-combo"
            placeholder="All types"
            multiSelect
            clearable
            items={TYPE_OPTIONS}
            selectedItems={typeFilter}
            labelField={typeLabel}
            valueField={(t) => t}
            search={(input) => typeSearch(input).filter((t) => !typeSet.has(t))}
            onChange={(items) => setTypeFilter(items)}
          />
        </div>
      </div>
```

- [ ] **Step 2: Delete the chip CSS**

In `src/Wrangler.App/src/css/components/attention.css`, delete these blocks entirely: `.attention-filters`, `.attention-chip` (with `&:hover`/`&.active`), `.attention-dot` (and the two `.attention-chip … .attention-dot` rules). Keep everything else (`.attention-empty`, `.attention-list`, `.attention-item`, `.attention-badge` severity styles, `.attention-body`, `.attention-title`, `.attention-meta`, `.attention-when`).

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass; lint reports no unused variables (`TYPE_CLASS`/`TYPE_LABEL` are still used by `typeLabel`/`typeSearch` and the item badges).

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open Attention.
Expected: `Type ▸ [picker]` renders even while loading/empty; options show red/amber/purple dots; selecting types narrows the feed exactly as the chips did; selection survives a reload.

- [ ] **Step 5: Commit**

```bash
git add src/routes/attention src/css/components/attention.css
git commit -m "Convert Attention type filter to a ComboBox group"
```

---

### Task 7: Full verification, QA sweep, and PR

**Files:**
- No planned changes — fixes only if verification fails.

**Interfaces:**
- Consumes: everything above.
- Produces: a verified branch and Wrangler PR.

- [ ] **Step 1: Full automated verification**

```bash
cd /k/Dev/Apps/Wrangler/src/Wrangler.App
npm test && npm run lint && npm run build
```

Expected: all pass (25 tests).

- [ ] **Step 2: Confirm no stale references**

```bash
git grep -n "status-chip\|attention-chip\|author-suggestions\|author-badges\|tag-filter\|pr-filters\|attention-filters\|\.filters\b" -- src
```

Expected: no matches in `src/Wrangler.App/src` (component code or CSS).

- [ ] **Step 3: Manual QA sweep**

With `npm run dev`:
- **Dashboard**: add/remove/clear branches; runs filter accordingly; persists across reload.
- **Pull Requests**: all four groups work; author add via suggestion AND via free-typed bot login; status dots visible in dropdown + pills; include/exclude tag semantics unchanged (exclude wins); Approve button at right; empty-authors still shows no query firing.
- **Attention**: type picker narrows feed; dots correct (red/amber/purple).
- **Gates**: Approve button pinned right, matching the PR page.
- No console errors anywhere.

- [ ] **Step 4: Push and open the Wrangler PR**

```bash
git status          # commit any QA fixes first
git push -u origin feature/unified-filter-experience
```

Then open a PR to `main` titled "Unified filter experience" summarising: every filter is now a labelled moo-ds ComboBox group with coloured dots preserved; moo-ds bump for the creatable-with-search fix; chip/typeahead CSS deleted; no filter-logic changes.
