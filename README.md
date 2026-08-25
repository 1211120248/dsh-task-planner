# dsh-task-planner

中文 | [English](README.en.md)

一个面向 DeepSeek Harness (DSH) Web GUI 的轻量日常任务插件。它作为独立 Cordis Bundle，通过官方 Client Slot 接入，以 Host 为权威数据源，并且不修改 DSH 源码。

[项目主页](https://1211120248.github.io/dsh-task-planner/) | [NPM](https://www.npmjs.com/package/dsh-task-planner) | [问题反馈](https://github.com/1211120248/dsh-task-planner/issues) | [隐私说明](PRIVACY.md)

## 界面截图

![DSH 默认浅色主题中的 dsh-task-planner](docs/assets/gui-light.png)

| 默认深色 | Skin Center 社区皮肤 |
| --- | --- |
| ![默认深色主题](docs/assets/gui-dark.png) | ![社区皮肤](docs/assets/gui-community.png) |

截图来自真实 DSH Web GUI。组件 CSS 不包含固定十六进制、RGB 或 HSL 颜色；插件的全部颜色均来自官方 `--dsw-*` 语义变量。

## 功能

- 提供今天、收件箱、未来、已完成、工作和个人视图，并支持搜索和按安排时间优先排序。
- 支持快速创建、详情编辑、删除、完成、恢复，以及完成、删除、改期后的短暂撤销。
- 支持标题、备注、清单、优先级、日期、时间、运行期间提醒和每天、每周、每月重复。
- 今天视图同时展示过期任务与今日任务，并将过期任务单独分组。
- 运行期间提醒、错过提醒与稍后提醒使用 Host 领取机制，避免多个标签页重复通知同一任务。
- Host 权威 JSON 账本具备 revision 栅栏、请求幂等、SSE 同步、原子写入、损坏文件隔离和恢复前备份。
- 提供受约束的 Agent 创建、查询、修改、完成、恢复和删除工具；同名任务必须消歧，删除必须显式确认。
- 支持桌面端与移动端响应式布局、键盘操作、加载/空/错误状态、可见焦点、语义区域和实时状态播报。
- 使用皮肤安全的 CSS Modules、`currentColor` SVG、`data-dsh-plugin="task-planner"` 和稳定 `data-dsh-part` 钩子。

## AI 自然语言管理

启用 Agent 工具后，自然语言请求会调用与 UI 相同的 Host 服务：

```text
用户：明天 10 点提醒我检查发布说明，提前 10 分钟。
Agent：task_planner_create({ title: "检查发布说明", scheduledDate: "2026-08-26", scheduledTime: "10:00", reminderMinutesBefore: 10 })

用户：完成“每周复盘”。
Agent：task_planner_query({ search: "每周复盘", status: "open" })
Agent：找到两条同名任务，请选择要完成的 task id。

用户：删除任务 7d2…，是的，确认删除。
Agent：task_planner_delete({ taskId: "7d2…", confirm: true })
```

Agent 工具不会在同名任务之间猜测。只有用户明确确认后传入 `confirm: true`，`task_planner_delete` 才会执行删除。

## 安装

需要 Node.js `^22.19 || >=24` 和一个 DSH Web profile。

```sh
dsh plugin --profile web add dsh-task-planner@latest
```

重启 `dsh web`，随后从侧边栏主导航中、任务看板上方的“任务计划”入口打开。点击后左侧导航保持不变，右侧主内容切换为任务计划。用于本地开发时：

```sh
git clone https://github.com/1211120248/dsh-task-planner.git
cd dsh-task-planner
pnpm install
pnpm build
dsh plugin --profile web add link:$(pwd)
```

包通过 `cordis.patch.yml` 声明 Cordis Bundle；不需要 DSH 源码 checkout 或源码补丁。

## 配置

打开 **DSH 设置 → 插件 → 任务计划**。

| 键 | 默认值 | 行为 |
| --- | --- | --- |
| `enabled` | `true` | 显示主导航入口与右侧任务计划页面。 |
| `notificationsEnabled` | `true` | DSH Web GUI 运行期间检查并领取提醒。 |
| `timeZone` | `local` | 按 Host 本地时区或选定 IANA 时区解释任务日期与时间。 |
| `agentToolsEnabled` | `true` | 注册受约束的 `task_planner_*` 工具。 |
| `announceToAgent` | `false` | 按需向 Agent 系统提示加入能力说明。 |
| `missedReminderHours` | `24` | 暂停或恢复后的最大错过提醒回溯时间。 |
| `snoozeMinutes` | `10` | “稍后提醒”使用的延迟时间。 |

设置卡还可以请求浏览器通知权限、导出 JSON 备份，并在确认后恢复备份。

## 键盘操作

- 没有文本框处于编辑状态时，`N` 聚焦快速创建。
- 没有文本框处于编辑状态时，`/` 聚焦搜索。
- `Enter` 打开当前聚焦任务。
- `Space` 完成或恢复当前聚焦任务。
- `Escape` 关闭任务计划。

## 数据与隐私

任务保存在本机 `$DSH_HOME/task-planner/tasks-v1.json`。写入使用临时文件、文件同步、原子 rename，并在平台允许时同步目录。损坏账本会移动到防碰撞的 `.backup.json` 文件而不是被覆盖；破坏性恢复前会先创建 Host 侧备份。

浏览器只是 Host 账本的异步视图。变更携带 revision，SSE 通知其他标签页重新读取新的权威快照。插件默认不启用云同步、分析、遥测或追踪。详见 [PRIVACY.md](PRIVACY.md)。

## 提醒边界

提醒只在 DSH Web GUI 正在运行且浏览器可以调度 JavaScript 时工作。短暂暂停后，插件可在配置的回溯范围内展示错过提醒，并支持稍后提醒。DSH 关闭、电脑休眠、浏览器挂起或操作系统抑制通知时，插件不承诺准时通知。

## 架构与安全

- `src/index.ts` 是 Host 半区，负责设置、路由、Agent 工具和可选 Agent 公告。
- `src/host/ledger.ts` 持有唯一的持久任务状态，并校验每个导入或变更后的任务。
- `src/client/index.ts` 通过官方 Slot Registry 注册 `sidebar.footer.action`、`shell.overlay` 与插件设置卡；当前 DSH 尚未提供多占用的主导航与右侧页面 Slot，因此前两者作为生命周期锚点，将入口投送到任务看板上方，并将页面投送到右侧主内容容器，不修改 DSH 源码。
- 浏览器请求受 loopback 与同源栅栏保护，变更只接受 JSON、有大小限制，并使用封闭的判别 action 联合。
- 撤销令牌在八秒后过期，遇到冲突变更会失败，不会覆盖另一个标签页的修改。

## 构建与测试

```sh
pnpm install
pnpm check
```

`pnpm check` 会运行类型检查、Vitest、皮肤颜色门禁、公开文件隐私检查、文档检查与生产构建。GitHub Actions 会在 push 与 pull request 上运行相同门禁。

## 已知限制

- 提醒属于运行期间辅助能力，不是操作系统后台调度器或唤醒定时器。
- 简单重复支持每天、每周和每月；暂不实现高级 recurrence 规则。
- 恢复一个已经完成的重复任务 occurrence 时，不会自动删除先前已创建的下一 occurrence。
- 插件提供本机 JSON 导出与恢复，但不提供默认云同步或跨设备合并服务。

## 贡献与反馈

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，使用 Conventional Commits，并提交 [Bug 或功能建议](https://github.com/1211120248/dsh-task-planner/issues/new/choose)。安全相关问题请遵循 [SECURITY.md](SECURITY.md)。

## 许可证

使用 [Apache License 2.0](LICENSE) 开源。
