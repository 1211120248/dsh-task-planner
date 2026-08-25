# Privacy

English | [中文](#中文)

`dsh-task-planner` stores task data locally under `$DSH_HOME/task-planner`. It does not provide cloud synchronization, analytics, telemetry, advertising, or tracking by default.

The browser UI talks only to same-origin loopback Host routes. Agent tools operate on the same local Host ledger. Browser notification text may be shown to the local operating-system notification service when the user grants notification permission; no remote notification provider is used.

JSON exports contain the user's task titles, notes, checklist items, schedules, and completion state. Users should treat exports as private data and choose their own secure backup location.

## 中文

`dsh-task-planner` 将任务数据保存在本机 `$DSH_HOME/task-planner`。插件默认不提供云同步、分析、遥测、广告或追踪。

浏览器 UI 只访问同源 loopback Host 路由。Agent 工具操作同一个本机 Host 账本。用户授权浏览器通知后，提醒文本可能显示在本机操作系统通知服务中；插件不使用远程通知服务商。

JSON 导出包含用户的任务标题、备注、清单项、安排时间和完成状态。用户应将导出文件视为隐私数据，并自行选择安全的备份位置。
