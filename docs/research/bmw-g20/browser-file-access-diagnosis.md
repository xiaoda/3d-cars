# 浏览器本地文件访问诊断

日期：2026-10-03。本报告只记录当前环境诊断，不是修改访问权限的授权。

## 已核实

- Chrome DevTools 的 `list_pages`、页面快照、inline 截图、点击和输入均正常。项目预览 `http://127.0.0.1:52254/#bmw` 能正常加载。
- 在本轮隔离上下文 `bmw-g20-next-20261003-926d14` 的页面 7 选择原图，仍返回 `Access denied ... is not within any of the configured workspace roots`。
- 目标文件确实存在，为普通文件而非符号链接；不是图片不存在或图片解码失败。
- 当前 MCP 是本机固定的 `chrome-devtools-mcp` 1.9.0，启动参数有隔离、无头及 page-id-routing，没有显式项目文件根目录。没有升级运行时。
- 在本地安装代码 `build/src/McpContext.js` 的 `validatePath()` 找到同一错误。它解析真实路径，只接受协商得到的工作区目录、显式配置目录及默认临时目录；这与网页访问许可是独立校验。
- `build/src/index.js` 通过 MCP `roots/list` 获取客户端目录，并与 `filesystemRoot` 参数合并。本轮未取得运行中客户端实际 roots 列表，不能断言究竟是未协商、空列表还是不匹配；可以确定当前有效列表没有允许项目原图路径。
- 实际执行该版本 `--help` 确认支持 `--filesystemRoot, --workspace`，可逐个授权目录。**不需要** `--allowUnrestrictedPaths` 或整盘权限。

## 最小修复方案

在本项目专用 MCP 配置中为现有服务保留原启动参数，仅增加：

```text
--workspace=D:/Projects-X/3D-Cars
```

优先使用项目级 `.codex/config.toml`，不要把这一项目授权塞进所有任务共享的全局参数。机器路径配置应留在本机，不随代码推送。仅设置进程 `cwd` 不等于完成文件路径授权。

OpenAI 的官方文档确认支持可信项目内的 `.codex/config.toml`、服务 `command` / `args` / `cwd` 配置，并提供客户端保存后重启入口：[MCP 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。具体 `--workspace` 选项以本机 Chrome DevTools 运行时源码和 help 为依据，不把 OpenAI 文档当成该第三方参数的出处。

原 MCP 进程不会因为配置文件写入而自动变更参数。需由客户端重载服务后，重新 `list_pages`、创建本任务页面、选择原始路径并核对图片 SHA-256，才能宣称修复生效。不能全局结束 Chrome 或其他任务进程。

## 授权后应用及实际验证

用户随后明确回复“授权，仅此项目目录”。据此写入本项目 `.codex/config.toml`，仅给现有 chrome-devtools 启动参数增加 `--workspace=D:/Projects-X/3D-Cars`，并固定项目 `cwd`。保留隔离、无头、page-id-routing、禁用遥测等原参数。全局 `~/.codex/config.toml` 的 SHA-256 前后相同，未修改信任、安全模式或工具审批策略。

`codex mcp get chrome-devtools --json` 已确认有效配置包含该唯一显式授权目录。本机配置加入 `.git/info/exclude`；Vite 额外拒绝 `.codex/**`，HTTP 实测本机配置与私有照片路径均返回 403。没有开放图片静态服务。

当前内置工具连接仍为旧进程，未强行结束它。为立即验证新配置，使用同一安装版的标准 MCP SDK，按 Codex 解析后的 `command / args / cwd` 启动本任务独立实例（PID 3736）。已检查 SDK Windows 子进程为 `shell:false`、`windowsHide:true`；标准错误和工具返回记录在任务日志中。未协商伪造的工作区根目录，仅使用用户明确授权的启动参数，所有文件操作仍经未修改的 MCP 路径校验器。

新实例先 `list_pages`，再创建独立上下文 `bmw-g20-authorized-20261003-7d41b2`，得到该实例内的页面 2；未把旧实例的页面 ID 混用。

| 原始参考 ID | 直接选择原路径 | 页面尺寸 / SHA-256 核对 | 原图 / 叠加截图保存并重开 |
|---|---|---|---|
| P90549627 | 成功 | 成功 | 成功 |
| P90549630 | 成功 | 成功 | 成功 |
| P90549635 | 成功 | 成功 | 成功 |

最终浏览器控制台无 warning/error。关闭了本任务页面与验证实例，复查 PID 3736 已退出、原 MCP PID 3292 仍在。没有新开预览服务或终端窗口。

**结论：授权配置及新实例的原图加载、持久截图已经实测成功。** 当前会话内置 MCP 通道仍要在客户端正常重载后才会使用新参数；不声称旧进程已经热更新。后续可继续使用同样授权的新实例进行验证，不必因旧连接而绕过校验或扩大权限。

日志及六张截图保存在 Git 忽略的 `.runtime/bmw-g20-mcp-access/`。截图包含参考原图，未公开分发或进入构建。

新增开发服务器配置隔离用例先失败、加入 `.codex/**` 拒绝项后通过。最终全量 **18 个测试文件 / 133 项通过**（30.08 秒），TypeScript / Vite 构建通过；保留原主包大于 500 kB 的告警。日志为同目录的 `deny-red.log`、`deny-green.log`、`final-tests.log`、`final-build.log`。

## 边界

授权前没有复制原图换目录、base64 注入、开放私有 HTTP、修改 MCP 校验器或通过另一自动化通道加载被拒文件。授权后使用的仍为相同的 MCP 文件工具与原始路径，区别是新实例已按用户批准配置该项目目录。没有要求安装扩展，也没有扩大到其他项目或整盘。

首次真实叠图显示近侧轮心与玻璃锚点大体对应，但骨架前后端、肩线及玻璃面仍有明显近似；透明骨架会显示被车身遮挡的远侧轮圈。近侧图只有 4 点，姿态歧义没有因文件权限修复而消失。相机视觉验收仍需继续，不自动开始精细曲面。
