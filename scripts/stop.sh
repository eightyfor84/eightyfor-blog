#!/usr/bin/env bash
# Chronicle Aurora — 停止占用常用端口的进程
#   CMS 开发服务器: 5173（manager vite）
#   Astro 开发/预览: 4321（astro dev/preview）
#   （可选扩展: 追加端口到 PORTS 数组）
set -u
PORTS=(5173 4321)
killed=0
for port in "${PORTS[@]}"; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[stop] 端口 $port 被 PID $pids 占用 → kill"
    kill $pids 2>/dev/null || true
    killed=1
  else
    echo "[stop] 端口 $port 空闲"
  fi
done
if [ "$killed" = "1" ]; then
  sleep 1
  echo "[stop] 已停止占用进程"
else
  echo "[stop] 无进程需要停止"
fi
