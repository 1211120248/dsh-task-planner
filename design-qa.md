# Design QA

## Scope and visual truth

- Current source: `docs/assets/detail-localization-reference.png`, a privacy-safe crop of the user-provided runtime screenshot showing the raw `section.personal` label.
- Current implementation: `docs/assets/gui-personal-community.png`.
- Focused copy comparison: `docs/assets/detail-localization-comparison.png` (reported defect on the left, corrected runtime on the right).
- Responsive iteration comparison: `docs/assets/detail-responsive-comparison.png` (first post-fix capture on the left, final container-responsive header on the right).
- Earlier navigation source and implementation remain in `docs/assets/navigation-reference.png`, `docs/assets/navigation-qa.png`, and `docs/assets/navigation-comparison.png`.

## Viewport and normalization

- Browser viewport: 1280 × 720 CSS px at DPR 2.
- Browser screenshot output: 1280 × 720 px, normalized by the controlled browser capture.
- Allocated DSH geometry: 280 px primary sidebar, 1000 px planner panel, 800 px planner workspace, and a 360 px absolute detail inspector at this breakpoint.
- Original user attachment: 2112 × 654 px; its privacy-safe localization crop is 370 × 105 px.
- Implementation localization crop: 370 × 105 px.
- The attachment is a defect-focused crop rather than the same full viewport, so it is used only to compare the visible copy defect. Layout, spacing, tokens, and responsive behavior are judged from equal-size pre/post implementation captures and the final full views.

## States and evidence

| State | Evidence | Result |
| --- | --- | --- |
| Personal list, Pink Sakura community skin | `gui-personal-community.png` | Group heading is localized as “个人”; no task is selected automatically, so the list keeps its full working width. |
| Today, default light | `gui-light.png` | Header, summary, quick add, groups, and rows follow official light tokens. |
| Today, default dark | `gui-dark.png` | The same hierarchy follows official dark tokens without a plugin-specific theme. |
| Today, Pink Sakura community skin | `gui-community.png` | DSH chrome and planner consume the same community-skin palette. |
| Localization defect | `detail-localization-comparison.png` | `section.personal` is replaced by the translated list name. |
| Constrained DSH content width | `detail-responsive-comparison.png` | The title no longer wraps into isolated CJK characters or collides with search. |

## Findings and fixes

- **P1 — Raw localization key in Work and Personal groups.** The dynamic `section.${key}` assertion bypassed dictionary coverage and rendered `section.personal`. Fixed with explicit, typed label maps that reuse `view.work` and `view.personal`, plus bilingual coverage tests.
- **P2 — Responsive logic used the browser window instead of the allocated DSH content column.** At a 1280 px window the planner only received 1000 px, but its three-column desktop layout remained active and reduced the title track enough to split “个人”. Fixed by using named container queries; the inspector now overlays at the medium breakpoint and the workspace remains 800 px wide.
- **P2 — Changing list views opened the first task automatically.** At constrained widths this immediately covered the list with the detail inspector. Fixed by clearing selection on view changes and opening details only after an explicit task selection.
- **P2 — Quick create in Completed made the new open task disappear from the current result set.** Fixed with an explicit “will enter Inbox” placeholder and automatic routing to Inbox after creation.
- **P3 — Task-list semantics and busy state were incomplete.** Added list/listitem semantics, replaced unsupported `aria-selected` on an article with `aria-current`, and disabled both quick-add controls while loading or mutating.

## Interaction checks

- Personal and Work group headings resolve through typed bilingual keys; no raw `section.*` string is visible.
- Creating from Completed shows the Inbox destination before submission, creates the task once, switches to Inbox, selects the created task, and exposes its editor.
- Changing views preserves the list-first state; selecting a row still opens the detail inspector.
- The 1000 px allocated panel activates the medium container layout while the 280 px DSH sidebar stays unchanged.
- Task rows remain keyboard focusable; Enter opens details and Space toggles completion.
- Browser console warnings and errors during the final flow: none.

## Required fidelity surfaces

- Fonts and typography: the DSH font stack and semantic text hierarchy are inherited; the final header preserves whole CJK words without collision or unintended wrapping.
- Spacing and layout rhythm: list width, header tracks, quick-add alignment, row gaps, and inspector behavior remain stable at the allocated-content breakpoint.
- Colors and tokens: component CSS continues to use only `--dsw-*` variables; no fixed hex, RGB, HSL, or independent light/dark theme was introduced.
- Image quality and assets: no raster UI substitutes were added; existing SVG icons continue to use `currentColor`. Screenshots are lossless browser captures.
- Copy and content: the reported raw key is removed, both languages cover every view/static group, and Completed explains the Inbox destination.

## Comparison history

1. The earlier footer/overlay implementation was replaced by primary navigation and a main-content page; navigation QA passed.
2. The new user screenshot exposed a P1 raw localization key. Typed group-label mapping fixed it; `detail-localization-comparison.png` is the post-fix evidence.
3. The first post-fix 1280 × 720 capture exposed a P2 split header and automatic inspector takeover. Container queries and list-first navigation fixed both; `detail-responsive-comparison.png` and `gui-personal-community.png` are the post-fix evidence.
4. Completed quick-create routing, list semantics, busy states, default light, default dark, Pink Sakura, interaction flow, and console state were rechecked after the final build. No actionable P0, P1, or P2 finding remains.

## Composite input focus pass

- Source visual truth: `docs/assets/focus-search-reference.png` and `docs/assets/focus-quick-add-reference.png`, privacy-safe crops normalized from the two user-provided screenshots.
- Browser-rendered implementation: `docs/assets/focus-search-qa.png`, `docs/assets/focus-quick-add-qa.png`, and the full views `docs/assets/gui-light.png`, `docs/assets/gui-dark.png`, `docs/assets/gui-community.png`, plus `docs/assets/gui-focus-community.png` from the installed DSH GUI.
- Runtime viewports: 1920 × 796 CSS px at DPR 1 in the installed DSH GUI (280 px DSH sidebar excluded from the 1640 × 796 plugin capture), plus 1280 × 720 CSS/pixel captures in the isolated DSH theme-check profile.
- Search comparison: the 984 × 180 px source crop was normalized to 492 × 90 px; the implementation was captured at the same 492 × 90 CSS/pixel size.
- Quick-add comparison: the 1882 × 200 px source crop was normalized to 941 × 100 px; the implementation was captured at the same 941 × 100 CSS/pixel size.
- State: text input focused in official default light, official default dark, and Pink Sakura community skin; the installed community-skin profile was also checked with an empty Today view. The submit button was checked separately through keyboard Tab navigation.

### Findings and fixes

- **P2 — Composite inputs rendered two competing focus indicators.** The panel-wide `input:focus-visible` rule added an inner rectangular outline while the search container already changed its border; quick add showed the same inner line without a matching container state. Fixed by suppressing only the two nested input outlines and moving the visible two-pixel focus treatment to their composite containers.
- **P3 — Focus transitions and caret did not explicitly follow the active skin.** Added token-driven border/shadow transitions and a semantic caret color; no fixed color or theme override was introduced.
- **P3 — Disabled quick-add hover could still select the hover token.** Hover styling now applies only when the submit button is enabled.

### Focus-pass verification

- Full-view evidence: `gui-light.png`, `gui-dark.png`, `gui-community.png`, and `gui-focus-community.png` confirm the header, summary, quick add, content, and inspector stay aligned and consume one shared semantic focus color from the active DSH theme/skin.
- Focused evidence: the equal-size source/implementation pairs show the reported inner cyan rectangle is gone; one continuous token-driven perimeter remains around the active composite.
- Keyboard sequence: Tab moves from the quick-add input to its submit button; the container ring clears and the button retains its own visible focus outline.
- Fonts and copy are unchanged; spacing, radii, icons, and current-color SVG rendering remain aligned with the existing DSH component language.
- Final browser console warnings and errors: none.

### Focus-pass comparison history

1. The user screenshots exposed the P2 double-focus treatment in both search and quick add.
2. The implementation moved focus emphasis to the composite containers, rebuilt the plugin, refreshed the installed DSH GUI, and captured equal-size focused regions.
3. The post-fix comparison found no remaining actionable P0, P1, or P2 difference; only the intentional single outer focus indicator remains.

final result: passed
