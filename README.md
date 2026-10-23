# 数商桃乡 · 数字媒体赛独立副本

此目录单独维护数字媒体赛项目。前台以“能展示、能下单、能招人”为主线：**首页 / 桃乡见闻 / 买桃下单 / 加入我们**。原站在 `MVP` 目录独立维护。

- GitHub： https://github.com/haoh42676-web/taoyuan-zhumeng-digital-media
- Web Service： https://shushang-taoxiang-digital-media.onrender.com/
- 后台： https://shushang-taoxiang-digital-media.onrender.com/admin/
- 静态备份： https://haoh42676-web.github.io/taoyuan-zhumeng-digital-media/
- 源码分支：`deploy/render-neon`；静态备份分支：`main`。

本项目使用独立 Neon 数据库、服务端会话密钥及浏览器存储命名空间。正式客户账号、咨询、订单、访问日志不从原站复制。公开体验区由本项目独立初始化模拟数据。

运行：Node.js 22，`npm ci`，按 `.env.example` 设置仅本地或平台私有环境变量，再执行 `npm start`。部署使用 Render 免费 Web Service 与外部 Neon，不使用 Render PostgreSQL。

`.data/`、`.env`、备份、数据库导出和平台密钥禁止发布到 GitHub。模型接口配置只在服务器读取。两个服务共用账号级免费额度；未配置定时保活。

数字媒体版的流程、数据边界与管理入口见 [改造说明](docs/digital-media-mvp.md)。执行 `npm test` 验证服务端业务与权限；`tests/digital-browser.cjs` 仅面向指定的隔离本机验收服务，不能用于生产写入测试。
