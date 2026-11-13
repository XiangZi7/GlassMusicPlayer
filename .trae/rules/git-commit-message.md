---
alwaysApply: true
scene: git_message
---

## Git Commit Message Rules

### Format

<icon> <type>(<scope>): <subject>

[optional body]

[optional footer]

---

### Type & Icon Mapping

| Icon | Type | Description |
|------|------|-------------|
| ✨ | feat | 新功能 |
| 🐛 | fix | Bug 修复 |
| 📝 | docs | 文档变更 |
| 💄 | style | 代码格式（不影响逻辑） |
| ♻️ | refactor | 重构（非新功能、非 Bug 修复） |
| ⚡️ | perf | 性能优化 |
| ✅ | test | 添加或修改测试 |
| 🔧 | chore | 构建过程或辅助工具变更 |
| 🚀 | ci | CI/CD 配置变更 |
| 🗑️ | revert | 回退提交 |
| 🔒 | security | 安全修复 |
| 🌐 | i18n | 国际化与本地化 |
| 📦 | build | 依赖或构建系统变更 |
| 🚧 | wip | 开发中，未完成 |
| 🔖 | release | 版本发布 |

---

### Rules

1. **subject** 使用祈使句，首字母小写，结尾不加句号
2. **scope** 为可选项，填写影响范围，如模块名、文件名、页面名
3. **subject** 长度不超过 72 个字符
4. **body** 说明"做了什么"和"为什么"，每行不超过 100 字符
5. **footer** 用于关联 Issue 或说明 Breaking Change：
   - 关联：`Closes #123` / `Refs #456`
   - 破坏性变更：`BREAKING CHANGE: <description>`
6. WIP 提交必须使用 `🚧 wip` 类型，合并前须替换为正式类型

---

### Examples
✨ feat(auth): 新增 GitHub OAuth2 第三方登录
🐛 fix(upload): 修复文件大小校验未触发的问题
♻️ refactor(api): 将请求拦截器抽离为独立 composable