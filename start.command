#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d "backend/dist" ] || [ ! -d "frontend/dist" ]; then
  bash manager.sh build
fi
bash manager.sh start --prod
echo ""
sleep 3
