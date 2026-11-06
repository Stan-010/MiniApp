# cloudfunctions 云函数目录

- `login`：返回当前用户 openid（清单 / 收藏按用户隔离）
- 二期 / 三期（冰箱食材、今日推荐）的云函数也放这里
- 构建时由 `scripts/copy-cloud.mjs` 同步到 dist 产物目录
- 在微信开发者工具中：右键函数目录 →「上传并部署：云端安装依赖」
