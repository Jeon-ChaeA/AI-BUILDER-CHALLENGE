#!/usr/bin/env bash
# VM(myserver-1)의 ~/apps/kaib로 올리고 다시 빌드한다. .env와 회원 DB(app-data 볼륨)는 서버에 있는 것을 그대로 쓴다.
# 로컬 data/(개발용 SQLite)는 올리지 않는다. 배포 주소: https://kaib.sungblab.com
set -euo pipefail
cd "$(dirname "$0")"
tar czf - --exclude=node_modules --exclude=.env --exclude=data . | ssh myserver-1 'tar xzf - -C ~/apps/kaib && cd ~/apps/kaib && docker compose up -d --build 2>&1 | tail -2 && sleep 2 && curl -sf 127.0.0.1:3300/api/health'
echo
