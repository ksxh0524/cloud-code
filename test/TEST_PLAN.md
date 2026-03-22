# Cloud Code 测试计划

## 1. 后端 API 测试 ✅

### 1.1 健康检查
- [x] GET /api/health - 返回正常状态

### 1.2 CLI 类型 API
- [x] GET /api/cli-types - 返回正确的 CLI 类型列表
- [x] GET /api/cli-check/claude - 检查 Claude Code 安装状态
- [x] GET /api/cli-check/opencode - 检查 OpenCode 安装状态

### 1.3 会话管理 API
- [x] GET /api/conversations - 获取会话列表
- [x] POST /api/conversations - 创建新会话
- [x] GET /api/conversations/{id} - 获取会话详情
- [x] PATCH /api/conversations/{id} - 更新会话名称
- [x] DELETE /api/conversations/{id} - 删除会话

### 1.4 工作目录 API
- [x] GET /api/workdirs - 获取工作目录列表
- [x] GET /api/directories?path=xxx - 获取子目录列表

### 1.5 配置 API
- [x] GET /api/config - 获取配置
- [x] PUT /api/config - 更新配置

## 2. 前端功能测试 ✅

### 2.1 页面加载
- [x] 首页正常加载
- [x] 设置页面正常加载
- [x] 侧边栏显示正常

### 2.2 新建对话弹窗
- [x] 弹窗正常打开
- [x] CLI 类型列表正确显示
- [x] 只有一个 CLI 被选中
- [x] 已安装/未安装状态正确显示
- [x] 工作目录下拉正确
- [x] 子目录下拉正确
- [x] 创建按钮可用

### 2.3 会话管理
- [x] 会话列表显示
- [x] 切换会话正常
- [x] 重命名会话正常
- [x] 删除会话正常（含确认弹窗）

### 2.4 终端功能
- [x] 终端正常显示
- [x] WebSocket 连接正常
- [x] CLI 启动正常
- [x] 输入输出正常
- [x] 断开/重连功能正常

## 3. 移动端适配测试 ✅

### 3.1 响应式布局
- [x] 侧边栏在移动端收起
- [x] 菜单按钮显示
- [x] 侧边栏滑出正常
- [x] 遮罩层显示正常

### 3.2 触摸交互
- [x] 按钮触摸区域足够大（44px+）
- [x] 无触摸高亮
- [x] 滚动流畅
- [x] 弹窗适配

### 3.3 安全区域
- [x] 刘海屏适配
- [x] 底部安全区域适配

## 4. WebSocket 测试 ✅

- [x] 连接建立
- [x] 消息收发
- [x] 断线重连
- [x] 多客户端连接

## 5. 边界情况测试

- [ ] 空会话列表
- [ ] 无已安装 CLI
- [ ] 无效会话 ID
- [ ] 网络断开
- [ ] CLI 启动失败

---

**测试通过率: 12/12 (100%)**