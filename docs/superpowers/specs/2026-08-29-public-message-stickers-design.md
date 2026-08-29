# 公共留言板贴纸系统设计

日期：2026-08-29

## 1. 目标

在现有 `/messages` 公共留言板上增加一个真正可供访客使用的「贴纸屋」：访客可以从预设的可爱/卡通角色贴纸中选择一张，在留言墙上选择位置张贴；贴纸写入服务端并对所有访客可见，刷新、换页面或过一段时间后仍然保留。

权限规则已经确定：

- 普通访客可以创建贴纸。
- 每个浏览器最多同时保留 5 张自己创建的公共贴纸。
- 创建者可以再次拖动或删除自己的贴纸。
- 管理员可以移动或删除任意公共贴纸，并且不受每浏览器 5 张的限制。
- 访客不能修改或删除其他访客创建的贴纸。

本功能不把贴纸伪装成留言，也不改变已有便签、评论、表情回应的数据模型。

## 2. 现状与约束

现有留言板已经具备：

- 统一的 1200px 逻辑坐标系和响应式渲染坐标换算。
- 便签拖动、边界限制和服务端位置持久化。
- 匿名 author token 形式的便签所有权。
- 管理员 session 鉴权。
- D1 持久化。
- 15 秒增量轮询留言。
- 一组仅作为页面装饰的可拖动贴纸，其位置只保存在当前浏览器 localStorage。

新的公共贴纸属于独立数据，不与现有装饰贴纸混用。现有 Pochacco、花朵、彩虹等页面装饰可以继续存在；它们仍是本地装饰，不会被迁移成公共数据。

## 3. 方案选择

采用独立 `message_stickers` 子系统：

- D1 使用独立表。
- Worker 使用独立 `/api/message-stickers` 路由。
- 前端使用独立公共贴纸状态和渲染层。
- 复用现有留言板逻辑坐标、管理员 session、匿名 token 哈希方式和交互风格。

不采用以下方案：

1. 将贴纸存成特殊 `guest_messages`：会污染留言统计、评论、反应和便签布局逻辑。
2. 仅 localStorage：其他访客不可见，不满足公共持久化需求。

## 4. 贴纸素材目录

贴纸只能来自前端和服务端共同认可的白名单 catalog，访客不能提交任意图片 URL。

建议新增一个集中式 manifest，例如：

```ts
export type MessageStickerDefinition = {
  key: string;
  label: string;
  character: string;
  imageUrl: string;
  width: number;
  height: number;
  defaultScale?: number;
};
```

第一版目标约 12–18 张，以用户指定的三丽鸥/网络现成角色素材为主，例如：

- Hello Kitty
- Cinnamoroll / 玉桂狗
- Kuromi / 酷洛米
- My Melody / 美乐蒂
- Pompompurin / 布丁狗
- Pochacco / 帕恰狗
- Keroppi / 大眼蛙
- 其他适合留言墙风格的角色或表情贴纸

具体素材 URL 不散落到组件和 controller 中，只保存在 catalog。若第三方素材失效，只替换 catalog 对应项。

公开站点使用网络角色素材存在版权授权和外链稳定性风险；技术实现仅负责隔离风险，不声称这些素材因此获得授权。图片加载失败时应隐藏破图占位，并允许后续替换 URL。

## 5. 数据模型

新增 D1 migration，预期文件名：

`danmaku-api/migrations/0009_message_stickers.sql`

表结构：

```sql
CREATE TABLE IF NOT EXISTS message_stickers (
  id TEXT PRIMARY KEY,
  sticker_key TEXT NOT NULL,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  owner_token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_stickers_owner
ON message_stickers(owner_token_hash);

CREATE INDEX IF NOT EXISTS idx_message_stickers_updated
ON message_stickers(updated_at);
```

说明：

- `sticker_key` 只存白名单 key，不存图片 URL。
- `pos_x / pos_y` 使用留言板逻辑坐标。
- `rotation` 由服务端或 catalog 允许的轻微随机角度产生，不允许客户端提交任意极端角度。
- `owner_token_hash` 用于浏览器级所有权与 5 张限制。
- 原始 owner token 只存在客户端 localStorage，不写入 D1。

## 6. 浏览器身份与所有权

新增浏览器级 token，例如 localStorage key：

`message_sticker_owner_token_v1`

首次打开贴纸屋或首次张贴时：

1. 客户端检查 localStorage。
2. 若没有 token，则生成足够随机的 token。
3. POST/PATCH/DELETE 时提交原始 token。
4. Worker 使用与现有便签一致的哈希策略计算哈希后进行查询或比对。

与便签不同，公共贴纸使用「浏览器级 token」，而不是「一张贴纸一个 token」。原因是服务端必须能够统计同一个浏览器当前已经拥有多少张贴纸，从而可靠执行 5 张上限。

拥有 token 仅代表当前浏览器持有操作凭证，不表示真实用户身份。

## 7. API 设计

路由：`/api/message-stickers`

### 7.1 GET

返回当前公共贴纸列表。

响应示例：

```json
{
  "items": [
    {
      "id": "uuid",
      "stickerKey": "cinnamoroll-01",
      "x": 812,
      "y": 430,
      "rotation": -4,
      "createdAt": 1780000000000,
      "updatedAt": 1780000000000
    }
  ],
  "now": 1780000000000
}
```

GET 不返回 `owner_token_hash`。

客户端根据本地 token 不能单凭 GET 判断服务器哈希，因此所有权 UI 采用额外的 `ownedIds` 响应字段或查询参数携带 token 的方式。推荐 GET 请求携带自有 token，通过服务端哈希匹配后返回：

```json
{
  "items": [...],
  "ownedIds": ["uuid-a", "uuid-b"],
  "ownedCount": 2,
  "now": 1780000000000
}
```

这样不暴露哈希，同时客户端可以准确标记自己可操作的贴纸。

### 7.2 POST

请求：

```json
{
  "stickerKey": "cinnamoroll-01",
  "ownerToken": "...",
  "posX": 600,
  "posY": 320
}
```

服务端校验：

- `stickerKey` 必须在服务端 catalog 白名单。
- owner token 必须存在且格式合理。
- 对 owner token 做哈希。
- 非管理员情况下查询此 hash 当前拥有贴纸数量；达到 5 张时拒绝。
- 管理员 session 存在时跳过 5 张限制，但仍需要一个 owner token 写入记录，以保持数据模型一致。
- `posX / posY` 必须是有限数字并被 clamp 到留言板边界。
- 贴纸尺寸由服务端 catalog 决定，不能由客户端伪造。

建议错误码：

- `STICKER_LIMIT_REACHED`：当前浏览器已有 5 张。
- `STICKER_INVALID_KEY`：未知贴纸。
- `STICKER_BAD_POSITION`：坐标非法。

### 7.3 PATCH

只允许修改位置；第一版不提供换角色、缩放或自由旋转。

请求：

```json
{
  "id": "uuid",
  "ownerToken": "...",
  "posX": 720,
  "posY": 510
}
```

权限：

- owner token 哈希匹配该贴纸，或
- 当前请求拥有有效管理员 session。

否则返回 403 `STICKER_FORBIDDEN`。

### 7.4 DELETE

请求：

```json
{
  "id": "uuid",
  "ownerToken": "..."
}
```

权限与 PATCH 相同。

删除后该浏览器的 5 张配额立即释放。

## 8. 前端组件与状态

建议把公共贴纸逻辑与现有大体量 `message-board-controller.ts` 分离，避免继续扩大 controller 职责。

建议新增：

- `src/lib/message-sticker-catalog.ts`
- `src/lib/message-sticker-api.ts`
- `src/lib/message-sticker-controller.ts`
- `src/styles/message-board-public-stickers.css`

现有 `MessageBoard.astro` 只负责加入入口、面板容器和公共贴纸图层挂载点。

`message-board-controller.ts` 继续只负责便签、详情、评论和管理员状态；它可以通过一个小型接口把管理员状态同步给 sticker controller。

## 9. UI 与交互

### 9.1 入口

在留言板工具栏「贴一张便签」旁增加：

`贴纸屋 ✦`

入口在桌面和手机端始终可见，不依赖 hover。

### 9.2 贴纸面板

打开后显示轻量抽屉/弹层：

- 标题：贴纸屋
- 简短提示：选一张贴到留言墙上吧
- 网格展示贴纸缩略图与角色名
- 显示 `我的贴纸 2 / 5`
- 达到 5 / 5 时仍可浏览，但创建按钮禁用，并提示先删除一张自己的贴纸
- 面板必须支持键盘操作和关闭按钮

视觉上继续沿用留言墙的纸张、手帐、胶带感，不做厚重的管理后台风格。

### 9.3 张贴模式

用户选择贴纸后：

- 关闭或收起贴纸面板。
- 进入 `placing-sticker` 模式。
- 桌面端在墙面上展示跟随鼠标的半透明预览。
- 手机端不要求跟随手指，只显示选中贴纸提示。
- 用户点击留言墙可用区域后创建贴纸。
- Esc、取消按钮或点击墙外退出张贴模式。
- POST 成功前使用 pending 状态，成功后替换为服务端 item；失败则移除 pending 预览并显示友好错误。

### 9.4 层级

公共贴纸必须位于便签内容层下方，避免遮挡文字和评论入口。

建议结构：

```text
message-board-stage
  ├─ public-sticker-layer
  └─ sticky-note elements
```

要求：

- 静止公共贴纸不能截获本应落在便签上的点击。
- 自己的贴纸仍需要可拖动，因此 sticker 本身可接收 pointer event，但其默认 z-index 小于便签。
- 拖动贴纸时临时提升 z-index；松开后恢复装饰层级。
- 公共贴纸与当前页面级装饰贴纸使用不同 class、不同 controller、不同持久化逻辑。

### 9.5 移动与删除

自己的贴纸：

- 桌面：按下后移动超过阈值才进入拖动，普通点击不能误触拖动。
- 手机：沿用便签经过修复的「长按进入拖动、短按点击」模式。
- 点击自己的贴纸出现小型气泡菜单：`移动提示 / 删除`；不做大型详情抽屉。
- 删除需要一次确认，防止误触。

管理员：

- 登录后可拖动任意贴纸。
- 点击任意贴纸可删除。
- UI 以轻量管理标识提示，不改变普通访客视觉。

其他访客的贴纸：

- 作为装饰展示。
- 不出现删除按钮。
- 不允许拖动。

## 10. 尺寸、旋转与布局约束

第一版不开放用户缩放，以避免巨型贴纸遮住留言墙。

每个 sticker catalog 项定义合理显示尺寸；建议视觉尺寸约 56–110px，根据角色透明留白做个别校正。

服务端使用 catalog 中的 footprint 将 `posX / posY` clamp 在逻辑墙面内。

贴纸不参与便签碰撞布局，不会把便签自动挤开；但尺寸较小、层级低于便签，因此不会破坏主要阅读体验。

rotation 仅为轻微装饰角度，例如约 `-8°` 到 `8°`，由受控逻辑产生。

## 11. 同步策略

留言本身继续使用现有 15 秒增量轮询。

公共贴纸第一版单独每 15 秒执行一次轻量完整 GET，而不是复用留言的 `since` 游标。理由：

- 贴纸总量远小于留言正文。
- 完整 GET 能自然同步创建、位置更新和删除。
- 不需要为删除设计 tombstone。
- 实现简单且容易验证。

在页面隐藏时停止贴纸轮询，页面重新可见后立即刷新一次，然后恢复定时器。

用户正在拖动某张自己的贴纸时，远端刷新不能覆盖本地拖动状态；可沿用便签现有 interaction lock / deferred remote 的思路，或在 sticker controller 内实现等价的小型锁。

## 12. 错误处理

前端友好文案：

- 达到 5 张：`这台设备已经贴了 5 张啦，先取下一张再贴新的吧。`
- 素材失效：该贴纸从面板中显示为不可用，不产生破图框。
- 403：`这不是你贴的贴纸，不能移动或取下。`
- 网络失败：`贴纸没有贴稳，再试一次吧。`

PATCH 保存失败时位置回滚到最后一次服务端确认坐标。

DELETE 失败时恢复交互状态，不从 UI 永久移除。

## 13. 防滥用

必须具备：

- 每 owner token 最多 5 张公共贴纸。
- 只允许服务端白名单 sticker key。
- 服务端坐标 clamp。
- 复用或补充现有请求频率限制，避免短时间大量 POST/PATCH。
- 不允许用户提交自定义图片 URL、HTML、SVG markup 或 CSS。
- owner token 仅存 hash。

管理员不受 5 张数量限制，但仍受基础请求校验。

## 14. 与现有功能的兼容性

必须保证：

- 便签单击仍能打开详情和评论。
- 便签拖动不受贴纸手势影响。
- 快捷回应按钮不被公共贴纸遮挡。
- 现有静态装饰贴纸继续可用。
- 管理员登录/退出后，便签和公共贴纸权限 UI 同步更新。
- 老留言、老便签坐标以及评论数据不迁移、不重写。
- 当前 `message_board_sticker_positions_v2` 本地装饰位置 key 保持不变。

## 15. 测试策略

按 TDD 实现，先写失败测试再写生产代码。

### Worker / API

至少覆盖：

1. 合法 sticker key 可创建。
2. 非白名单 sticker key 返回 400。
3. 同一个 owner token 创建到第 5 张成功。
4. 第 6 张返回 `STICKER_LIMIT_REACHED`。
5. 删除自己的贴纸后可以再次创建。
6. owner 可以 PATCH 自己的贴纸。
7. owner 可以 DELETE 自己的贴纸。
8. 不同 token 无法 PATCH/DELETE。
9. 管理员可以 PATCH/DELETE 任意贴纸。
10. 管理员创建不受 5 张限制。
11. 坐标被正确 clamp。
12. GET 不暴露 `owner_token_hash`，但能正确返回 `ownedIds / ownedCount`。

### 前端

至少覆盖：

1. 留言板存在 `贴纸屋 ✦` 入口。
2. catalog 只通过 sticker key 映射素材。
3. 5 / 5 时阻止继续创建并给出提示。
4. 选择贴纸可进入张贴模式。
5. 创建成功后渲染服务端贴纸。
6. 创建失败移除 pending 状态。
7. 自己的贴纸可移动和删除。
8. 别人的贴纸不提供修改权限。
9. 公共贴纸层级低于便签。
10. 普通点击便签仍打开详情/评论，防止再次出现 click-vs-drag 回归。
11. 桌面鼠标拖动和手机长按拖动分别通过手势测试。
12. 轮询更新不会覆盖正在拖动的贴纸。
13. 完整 `npm run build` 通过。

## 16. 预期文件范围

实现阶段预计涉及：

- `src/components/MessageBoard.astro`
- `src/lib/message-board-controller.ts`（仅管理员状态桥接等必要小改）
- `src/lib/message-sticker-catalog.ts`（新增）
- `src/lib/message-sticker-api.ts`（新增）
- `src/lib/message-sticker-controller.ts`（新增）
- `src/styles/message-board-public-stickers.css`（新增）
- `src/lib/public-interactions.ts`（仅当共用 token/hash 客户端工具更合理时做小型复用）
- `danmaku-api/migrations/0009_message_stickers.sql`（新增）
- `danmaku-api/src/message-sticker-routes.ts`（新增）
- `danmaku-api/src/message-sticker-catalog.ts`（新增或共享等价白名单模块）
- `danmaku-api/src/index.ts`（注册路由）
- `danmaku-api/tests/...`
- `tests/...`

具体文件名在实现计划中可以因现有模块边界做小幅调整，但数据模型、权限、5 张限制和交互行为不得偏离本设计。

## 17. 验收标准

功能完成时，从普通访客视角应满足：

1. 一眼可以发现留言板的「贴纸屋」。
2. 能看到约 12–18 张可爱/卡通角色贴纸。
3. 选一张后可以在留言墙上选择位置贴下。
4. 其他浏览器可以看到刚贴的贴纸。
5. 刷新页面后贴纸仍在。
6. 当前浏览器可以移动和删除自己的贴纸。
7. 当前浏览器最多拥有 5 张，删除后释放名额。
8. 不能移动或删除别人的贴纸。
9. 管理员可以整理/删除任意贴纸。
10. 公共贴纸不会挡住便签正文，也不会破坏便签点击进入详情和评论。
11. 手机和桌面都可正常使用。
12. 第三方图片失效不会导致页面出现明显破图或阻塞留言板功能。
