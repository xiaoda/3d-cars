# BMW 阶段 0：隔离基线

日期：2026-10-03。执行范围为已批准计划的任务 0–1；不开发 BMW 曲面、材质或入口。

## Git 与 A4

- 基线：`f6d31d5d70a562370fe9106f7c591837d3a19bc4`，A4 v0.6；开始时 `main` 与 `origin/main` 同步。
- 本轮分支：`feat/bmw-g20-surface-study`。保留 `main`，不改写历史。
- 开始时工作区只有未跟踪的 BMW 计划文档，无未提交 A4 源码。
- 修改范围：资料文档、证据校验测试、忽略规则及 Vite 私有目录拒绝规则。没有改变 A4 几何、场景、交互或运行时依赖。
- 新增开发期 `@types/node`（匹配本机 Node 24），用于本地资料文件与 SHA-256 检查的类型声明；没有新增建模库。
- 本批按计划做本地提交，不自动推送 GitHub。官方图片和 PDF 不进入 Git。

## 新执行的基线验证

| 检查 | 结果 | 本机日志 |
|---|---|---|
| `npm test` | 9 个测试文件，59 项通过 | `.runtime/bmw-g20-stage0/baseline-tests.log` |
| `npm run build` | 通过；主包约 903.70 kB，保留大于 500 kB 的已有警告 | `.runtime/bmw-g20-stage0/baseline-build.log` |
| A4 页面快照 | 标题、v0.6 控件和场景信息可读取 | Chrome DevTools 页面 4，本轮隔离上下文 |
| A4 inline 截图 | 已实际查看 A4 车模和界面 | 仅在工具返回中，未持久归档 |

浏览器尝试保存 `.runtime/bmw-g20-stage0/a4-baseline.png` 被工具拒绝，错误为目标不在该工具配置的工作区根目录内。**没有生成该文件，没有换路径或通道绕过拒绝。** 替代方式是本轮 inline 截图人工检查；这不等同于完成了持久化回归图归档。后续对照图持久保存仍需解决允许的交付方式。

## 本地服务与资料保护

- 复用已确认归属本项目的 Vite：PID `15416`，`127.0.0.1:52254`，工作目录 `D:\Projects-X\3D-Cars`。
- 原命令：`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 52254 --strictPort`。
- 服务记录 `.runtime/preview.json`；原 stdout/stderr 在 `.runtime/v05/`。没有启动第二个预览服务或可见终端。
- 本轮浏览器隔离上下文：`bmw-g20-stage0-20261003-86e9af`。不接管页面 2/3，不关闭其他任务页面。
- 原图路径 `references-private/bmw-g20/photos/`；PDF 路径 `references-private/bmw-g20/documents/`。
- `.gitignore` 忽略整个 `references-private/`，Vite 在保留已有拒绝项的基础上新增 `**/references-private/**`。
- 实测对原图目录中技术 PDF 的 HTTP 请求返回 **403**，`git check-ignore` 也命中忽略规则。
- 资料存储测试先有 2 项失败，再实现保护后 2 项通过；红灯日志 `storage-red.log`。

最终增量测试和产物检查见 [stage0-qa.md](stage0-qa.md)。以上工程验证不代表 BMW 视觉验证通过。
