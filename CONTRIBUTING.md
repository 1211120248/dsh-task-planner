# Contributing

Thank you for helping improve `dsh-task-planner`.

## Development

```sh
pnpm install
pnpm check
```

Use Node.js `^22.19 || >=24`. The project depends only on published `@deepseek-ai/*` SDK packages and must never resolve TypeScript against a local DSH source checkout.

## Pull requests

- Open an issue first for behavior or protocol changes.
- Keep Host, Client, and shared pure logic in `src/host`, `src/client`, and `src/core`.
- Add tests for behavior changes and include real DSH GUI evidence for visible changes.
- Keep component colors on official `--dsw-*` variables and SVG colors on `currentColor`.
- Update English and Chinese README files together when public behavior changes.
- Use Conventional Commits such as `feat(ui): add calendar grouping` or `fix(host): fence stale undo`.

## Reporting issues

Use the [issue chooser](https://github.com/1211120248/dsh-task-planner/issues/new/choose). Do not include task exports, local paths, credentials, or private screenshots in public reports.

## 中文说明

开发环境使用 Node.js `^22.19 || >=24`，提交前运行 `pnpm check`。行为变更必须补测试，可见 UI 变更必须提供真实 DSH GUI 证据。组件颜色只能使用官方 `--dsw-*` 变量，SVG 使用 `currentColor`。公开行为变化需要同步更新中英文 README，并使用 Conventional Commits。公开 Issue 中不要附带任务导出、本机路径、凭据或隐私截图。
