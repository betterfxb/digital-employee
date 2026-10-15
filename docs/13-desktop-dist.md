# 桌面端分发与授权（S30）

## 一、打包（开发者侧）

```powershell
cd apps\desktop
pnpm install                              # 首次；electron二进制国内镜像可加速：
                                         # $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
pnpm build:win                            # = make-icon → web构建(standalone) → electron-builder NSIS
```

产物：`apps/desktop/dist/获客中台-Setup-1.0.0.exe`（约80MB，按用户安装无需管理员）。
构建前需 `apps/web/data/license_pub.pem` 存在（`license-gen.js keypair` 生成；公钥随包分发，**私钥永不进包/进仓**）。

技术要点：
- web 以 `NEXT_OUTPUT_STANDALONE=1` 构建（next.config 按 env 开关，不影响日常 start）
- `apps/web/.npmrc` `node-linker=hoisted`：Windows 下 pnpm 符号链接拷贝 standalone 会 EPERM
- standalone 经 `extraResources` 原样拷贝（files 会滤掉 node_modules，必须走 extraResources）
- 主进程用 `http` 模块选端口/探活（Electron 内置 `net` 阴影了 Node 的 net，`node:` 前缀也逃不掉）
- 服务以 `ELECTRON_RUN_AS_NODE=1` 起（打包态 execPath 是 electron.exe）
- token 加密主密钥首启随机生成于 `%APPDATA%\获客中台\data\.master_key`

## 二、发证流程（服务商侧，每客户一次）

1. 客户装好后启动 → 未激活门显示**本机机器码**（三因子：CPU/磁盘/网卡MAC 哈希，`.`拼接）→ 一键复制发给你
2. 你签发（**必须带 --bind**，否则对方拷到别的机器也能用）：
   ```powershell
   cd apps\web
   node scripts\license-gen.js issue --customer 客户名 --days 365 --bind "cpuHash.diskHash.macHash"
   ```
3. 把生成的 `apps/web/data/license.license` 文件发回客户 → 他在激活门「导入授权文件」→ 激活完成

- 买断长期：`--days 0`；到期续期重新签发导入即可
- 换机：客户重新报机器码，重签发
- 安全边界：验签公钥在包内；签名/绑定全过才落盘；异机 license 导入直接拒（实测）
- 水印：每客户 `wl-xxxxxxxx` 唯一，泄露可溯源

## 三、客户侧流程

1. 双击 `获客中台-Setup-1.0.0.exe` 安装 → 桌面/开始菜单「获客中台」
2. 首次启动显示未激活门 → 复制机器码发给服务商
3. 收到 `license.license` → 激活门导入 → 进入系统
4. 无代码签名证书时 Windows SmartScreen 会提示「未知发布者」：点「更多信息 → 仍要运行」（一次性）

## 四、诚实边界

- 离线机器绑定防「拷给同事/转卖」（普通场景足够）；防不了专业逆向破解（如需更强需联网激活，另立项）
- 授权仅锁 UI（激活门），API 保持开放（导入授权与自动化需要）；服务只监听 127.0.0.1
- 桌面端数据在 `%APPDATA%\获客中台\data\`（local.json 业务数据 + license + 主密钥），卸载不自动清数据
- 更新：暂无自动更新，发新版安装包覆盖安装即可（数据目录独立不受影响）
