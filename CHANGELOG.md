# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-08-25

### Changed

- Moved Task planner above Task Board in the primary sidebar navigation and changed it from a frame-wide modal overlay to a main-content page that preserves the DSH sidebar.
- Made planner breakpoints respond to the allocated DSH content column instead of the browser window, and stopped opening the first task automatically when changing views.
- Made Chinese the default GitHub README, retained the English documentation, and updated project links to the current repository.

### Fixed

- Prevented raw localization keys such as `section.personal` from appearing in Work and Personal task groups.
- Clarified and routed quick-created tasks from Completed to Inbox instead of creating an item that immediately disappears from the current view.
- Added list semantics and complete busy/disabled states to task controls.
- Replaced competing inner focus outlines with one theme-aware focus treatment for the composite search and quick-add controls.

## [0.1.0] - 2026-08-25

### Added

- Independent Cordis bundle with official sidebar footer, shell overlay, and settings Client Slots.
- Host-authoritative task ledger with atomic persistence, revisions, SSE, backups, and corrupt-data quarantine.
- Today, Inbox, Upcoming, Completed, Work, and Personal task views with responsive UI and keyboard controls.
- Notes, checklist, priorities, date/time, reminders, snooze, missed reminders, and simple recurrence.
- Conflict-safe short undo for completion, deletion, and rescheduling.
- Constrained Agent task tools with title disambiguation and confirmed deletion.
- Bilingual documentation, privacy statement, CI, NPM release, and GitHub Pages project site.

[Unreleased]: https://github.com/1211120248/dsh-task-planner/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/1211120248/dsh-task-planner/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/1211120248/dsh-task-planner/releases/tag/v0.1.0
