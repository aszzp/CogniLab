# CogniLab 生产镜像：Node 24（node:sqlite）+ Python 3（代码判题）
FROM node:24-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY app/ ./

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Shanghai \
    COGNILAB_PYTHON=python3

EXPOSE 3000
CMD ["node", "server.js"]
