# 家庭菜谱小程序

uni-app + Vue3 + 微信云开发，家庭菜单点单系统（v0.2，客户 / 厨师双角色，1–2 人体验版）。

## 构建

```bash
pnpm install
pnpm build:mp-weixin   # 产物在 dist/build/mp-weixin（自动带上云函数）
```

## 导入微信开发者工具

1. 微信开发者工具 →「导入项目」→ 目录选 `dist/build/mp-weixin`
2. AppID：`wx6215765e5486f1d2`（已在 manifest.json 配置）

## 云开发初始化（一次性）

1. 开发者工具顶部「云开发」按钮 → 开通环境（免费额度）
2. 云数据库 → 新建集合：`users`、`categories`、`dishes`、`orders`、`favorites`
3. 每个集合：权限设置 →「所有用户可读写」（仅体验版 1–2 人使用）
4. 编辑器左侧资源管理器 → 右键 `cloudfunctions/login` →「上传并部署：云端安装依赖」
5. 环境 ID 已配置在 `src/utils/cloud.js` 的 `CLOUD_ENV`（cloud1-d8gpiixhe09deeed2）

## 角色与流程（v0.2）

- **客户（点单）**：美团式点单页（左分类 / 右菜品 / 底部已点栏）→ 加菜只需菜名 + 想吃备注 → 下单
- **厨师（做菜）**：订单页看到待做订单，菜品底下显示自己写的大长串说明（做法 + 用料配比）；客户新加的菜在「待完善菜品」里补说明
- 身份按微信 openid 记住，可在「我的」页切换
- 加菜自动归类：关键词规则匹配（`src/utils/category-rules.js` 规则表可调）
- 首次启动自动写入预置分类：荤菜 / 素菜 / 汤羹 / 主食 / 凉菜 / 饮品

## 目录结构

- `src/pages/`：index（点单）/ orders（订单）/ mine（我的）/ order-preview（已点菜品）/ dish-detail / dish-edit / category-manage / favorites
- `src/utils/constants.js`：角色、状态机、预置分类（二期扩展在此加常量）
- `src/utils/category-rules.js`：自动归类规则表
- `src/utils/api.js`：云数据库 CRUD（按集合分块，二期 fridge 等在此追加）
- `src/store/app.js`：Pinia（角色、点单/订单计数）
- `cloudfunctions/`：云函数（login；二期智能补充、配图等云函数放这里）

## 二期预留（见需求变更记录 v0.2）

- 冰箱食材 CRUD + 今日推荐（27 计划）
- 联网搜索做法（云函数 + 搜索 API，需数据出网特批）
- 候选配图（Unsplash / Pexels）
