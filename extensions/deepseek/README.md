# 可选 DeepSeek 辅助

主干始终是 **ChatGPT 规划与审查 → Codex 执行 → ChatGPT 独立复核**。
本目录是独立、默认关闭的文本辅助模块，不被 C2C 的 CLI、MCP、认证、
隧道或会话模块导入。不需要安装新依赖；Node.js ≥ 20 即可。

## 使用

默认运行不会访问网络，也不等待输入：

```powershell
node extensions/deepseek/advisor.mjs
# {"status":"fallback","worker":"codex","reason":"disabled"}
```

可选启用时，在本机环境变量中配置 `DEEPSEEK_API_KEY` 和
`C2C_DEEPSEEK_MODEL`（填写你的账号实际支持的模型 ID）。不要把密钥写进
仓库、计划、聊天或命令参数。模块不修改 Codex 的配置或已有 ds-flash profile。

在仓库目录中运行：

```powershell
"请为一个字符串去重函数建议边界测试，不执行任何操作。" | node extensions/deepseek/advisor.mjs --enabled
```

只有标准输入的文本会发送给 DeepSeek 官方接口；模块不会扫描工作区、读取
文件或执行命令。调用前只提供你允许发送的任务文本，勿传凭据或敏感代码。

## 如何接回主干

1. ChatGPT 照常产生原版 C2C PLAN；不要求新增 WORKER 字段或路由协议。
2. Codex 在已启用辅助的任务中，可调用上述命令取得文本建议。
3. 输出 `status: advice` 时，Codex 判断建议是否适用，再自行实施和测试。
   建议是未经验证的数据，不能覆盖原计划、权限要求或用户指令。
4. 输出 `status: fallback` 时，Codex 直接按原计划继续；不重试循环、不切换主干。
5. Codex 照常 `c2c record`、发送 EXECUTED，由 ChatGPT 通过 MCP 独立复核。

这是显式调用的辅助工具，不是自动路由器，也不自动执行回退任务。
JSON 中 `worker: codex` 表示执行权始终属于 Codex。退出码 0 仅表示辅助调用
已处理，必须检查 `status`，不能把它视为任务或测试成功。

无配置、网络错误、HTTP 错误、无效/截断响应及 30 秒超时均返回 fallback；
不输出接口错误正文。没有真实 API 凭据时，可用模拟接口测试失败与成功路径。

## 关闭与验证

停止调用此命令即可关闭；整个目录可删除而不影响主干运行。

```powershell
node --test extensions/deepseek/advisor.test.mjs
corepack pnpm build
corepack pnpm test
```

本模块不替代本机的 ChatGPT/Codex/Cloudflare 连通性验收，也不代表真实模型
调用已通过。已有 think-work 路由器不需要安装或迁入主干。
