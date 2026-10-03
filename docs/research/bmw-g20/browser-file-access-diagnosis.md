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

## 最小修复建议，须授权后应用

在本项目专用 MCP 配置中为现有服务保留原启动参数，仅增加：

```text
--workspace=D:/Projects-X/3D-Cars
```

优先使用项目级 `.codex/config.toml`，不要把这一项目授权塞进所有任务共享的全局参数。机器路径配置应留在本机，不随代码推送。仅设置进程 `cwd` 不等于完成文件路径授权。

OpenAI 的官方文档确认支持可信项目内的 `.codex/config.toml`、服务 `command` / `args` / `cwd` 配置，并提供客户端保存后重启入口：[MCP 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。具体 `--workspace` 选项以本机 Chrome DevTools 运行时源码和 help 为依据，不把 OpenAI 文档当成该第三方参数的出处。

原 MCP 进程不会因为配置文件写入而自动变更参数。需由客户端重载服务后，重新 `list_pages`、创建本任务页面、选择原始路径并核对图片 SHA-256，才能宣称修复生效。不能全局结束 Chrome 或其他任务进程。

## 边界

本轮尚未授权 / 应用上述目录变更；不宣称已修复。没有改 Vite 私有目录 deny、复制原图换目录、base64 注入、开放私有 HTTP、修改 MCP 校验器或通过另一自动化通道加载被拒文件。没有要求安装浏览器扩展，也没有将通道正常误写为原图已加载。
