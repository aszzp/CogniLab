# CogniLab 生产部署（阿里云 ECS）

目标服务器：`root@47.109.176.71`（Aliyun Linux 3）。宿主机 Node 20 不支持
`node:sqlite`，因此应用跑在 Node 24 容器里；Nginx 只做反向代理，不碰现有
Vaultwarden / OpenVPN / G4 中继站点。

## 本次部署

- 公网地址：<https://cognilab.cd-here.cn/>
- DNS：`cognilab.cd-here.cn A 47.109.176.71`（已备案 `cd-here.cn` 子域）
- 证书：Let's Encrypt，DNS-01 签发，有效期至 **2027-02-24**
- 续签：**未配置自动续签**（按要求只做一次性证书）
- 运行方式：容器 `cognilab` 使用宿主网络，只监听 `127.0.0.1:3001`
- 数据：`/opt/cognilab/data/cognilab.db` + `data/finals/`
- 注意：`eastzzp.cn` 与 `nip.io` 未备案，阿里云会返回 403 并重置 HTTPS，
  不能作为公网入口；`cognilab.eastzzp.cn` 的临时 A 记录已删除。

## 目录布局

```
/opt/cognilab/
├── app/                 # next build 的 .next/standalone + static + public
├── data/                # cognilab.db + finals/（挂载到容器 /app/data）
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env                 # 从本地 .env.local 复制，chmod 600，不提交
└── backups/             # 数据库备份（可选）
```

## 构建与上传

本地：

```bash
npm ci
NEXT_TELEMETRY_DISABLED=1 npm run build
mkdir -p /tmp/cognilab-bundle/app
cp -R .next/standalone/. /tmp/cognilab-bundle/app/
mkdir -p /tmp/cognilab-bundle/app/.next
cp -R .next/static /tmp/cognilab-bundle/app/.next/static
cp -R public /tmp/cognilab-bundle/app/public
tar -C /tmp/cognilab-bundle/app -czf /tmp/cognilab-app.tar.gz .
```

数据库建议用一份清空学习记录的副本（保留题库、考纲、finals 套卷）：

```bash
node - <<'NODE'
const { DatabaseSync } = require('node:sqlite');
const d = new DatabaseSync('data/cognilab.db');
d.exec("VACUUM INTO '/tmp/cognilab-prod.db'");
d.close();
const p = new DatabaseSync('/tmp/cognilab-prod.db');
for (const t of ['attempts','task_attempts','exams','review_queue','finals_attempts','finals_practice','gym_progress','gym_attempts','settings']) {
  p.exec(`DELETE FROM ${t}`);
}
p.close();
NODE
tar -C data -czf /tmp/cognilab-data.tar.gz finals
```

上传后在服务器执行：

```bash
mkdir -p /opt/cognilab/{app,data}
tar -C /opt/cognilab/app -xzf /tmp/cognilab-app.tar.gz
tar -C /opt/cognilab/data -xzf /tmp/cognilab-data.tar.gz
cp /tmp/cognilab-prod.db /opt/cognilab/data/cognilab.db
chmod 600 /opt/cognilab/data/cognilab.db
```

把本目录的 `Dockerfile`、`docker-compose.yml`、`.dockerignore` 放到
`/opt/cognilab/`，把 `.env.local` 复制为 `/opt/cognilab/.env` 并 `chmod 600`。

## 启动

```bash
cd /opt/cognilab
docker compose build
docker compose up -d
docker compose logs -f --tail=100
curl -I http://127.0.0.1:3001/
```

容器使用 `network_mode: host`，并把 `HOSTNAME` 固定为 `127.0.0.1`、`PORT`
固定为 `3001`。这样既绕开该 ECS 的 Docker bridge DNS 故障，也不会把 Node
直接暴露到公网。`docker compose build` 同样需要在 `build.network: host` 下
执行，否则 apt 无法解析 Debian 源。

## Nginx 与证书

站点名使用 `cognilab.cd-here.cn`，A 记录指向 `47.109.176.71`。把
`nginx-cognilab.conf` 放到
`/www/server/panel/vhost/nginx/cognilab.conf`。

由于该 ECS 的公网 HTTP 会被阿里云未备案域名策略拦截，Let's Encrypt 的
HTTP-01 校验不可用；证书改用阿里云 DNS API 做 DNS-01（本机 acme.sh 已保存
`SAVED_Ali_Key` / `SAVED_Ali_Secret`）：

```bash
/root/.acme.sh/acme.sh --issue --server letsencrypt --keylength ec-256 \
  --dns dns_ali -d cognilab.cd-here.cn
mkdir -p /etc/cognilab-tls
cp /root/.acme.sh/cognilab.cd-here.cn_ecc/fullchain.cer /etc/cognilab-tls/fullchain.pem
cp /root/.acme.sh/cognilab.cd-here.cn_ecc/cognilab.cd-here.cn.key /etc/cognilab-tls/privkey.pem
chmod 644 /etc/cognilab-tls/fullchain.pem
chmod 600 /etc/cognilab-tls/privkey.pem
nginx -t && nginx -s reload
```

按本次要求只签发一次，没有安装 `--install-cert` 续签任务；到期前手动重跑
上面的 `--issue` 并覆盖证书即可。80 端口配置保留 ACME 目录，正式请求 301
跳转到 HTTPS。

## 运维

```bash
docker compose ps
docker compose restart cognilab
docker compose logs --tail=200 cognilab
docker stats --no-stream cognilab
```

数据库在 `/opt/cognilab/data/cognilab.db`，升级前先 `cp` 一份到
`/opt/cognilab/backups/`。容器以 root 运行，绑定挂载目录需要可写。
