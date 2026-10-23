# 数商桃乡 · 数字媒体赛独立副本

此目录单独维护数字媒体赛项目。复制时保持原站页面与功能一致，后续内容按参赛要求独立修改。

- GitHub： https://github.com/haoh42676-web/taoyuan-zhumeng-digital-media
- Web Service： https://shushang-taoxiang-digital-media.onrender.com/
- 后台： https://shushang-taoxiang-digital-media.onrender.com/admin/
- 静态备份： https://haoh42676-web.github.io/taoyuan-zhumeng-digital-media/
- 源码分支：`deploy/render-neon`；静态备份分支：`main`。

本项目使用独立 Neon 数据库、服务端会话密钥及浏览器存储命名空间。正式客户账号、咨询、订单、访问日志不从原站复制。公开体验区由本项目独立初始化模拟数据。

运行：Node.js 22，`npm ci`，按 `.env.example` 设置仅本地或平台私有环境变量，再执行 `npm start`。部署使用 Render 免费 Web Service 与外部 Neon，不使用 Render PostgreSQL。

`.data/`、`.env`、备份、数据库导出和平台密钥禁止发布到 GitHub。模型接口配置只在服务器读取。两个服务共用账号级免费额度；未配置定时保活。
