#!/bin/bash

echo "=========================================="
echo "   Cloud Code 功能测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_BASE="http://localhost:18765"

echo -e "${YELLOW}1. 测试健康检查${NC}"
HEALTH=$(curl -s "$API_BASE/api/health")
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✓ 健康检查通过${NC}"
else
    echo -e "${RED}✗ 健康检查失败${NC}"
fi
echo ""

echo -e "${YELLOW}2. 测试会话列表${NC}"
CONVERSATIONS=$(curl -s "$API_BASE/api/conversations")
echo "$CONVERSATIONS" | python3 -m json.tool 2>/dev/null || echo "$CONVERSATIONS"
echo ""

echo -e "${YELLOW}3. 测试创建会话${NC}"
NEW_CONV=$(curl -s -X POST "$API_BASE/api/conversations" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试会话2","workDir":"/Users/liuyang/codes"}')
echo "$NEW_CONV" | python3 -m json.tool 2>/dev/null || echo "$NEW_CONV"

CONV_ID=$(echo "$NEW_CONV" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -n "$CONV_ID" ]; then
    echo -e "${GREEN}✓ 会话创建成功，ID: $CONV_ID${NC}"
else
    echo -e "${RED}✗ 会话创建失败${NC}"
fi
echo ""

echo -e "${YELLOW}4. 测试获取会话详情${NC}"
if [ -n "$CONV_ID" ]; then
    CONV_DETAIL=$(curl -s "$API_BASE/api/conversations/$CONV_ID")
    echo "$CONV_DETAIL" | python3 -m json.tool 2>/dev/null || echo "$CONV_DETAIL"
fi
echo ""

echo -e "${YELLOW}5. 测试配置 API${NC}"
CONFIG=$(curl -s "$API_BASE/api/config")
echo "$CONFIG" | python3 -m json.tool 2>/dev/null || echo "$CONFIG"
echo ""

echo -e "${YELLOW}6. 前端访问测试${NC}"
FRONTEND_CHECK=$(curl -s http://localhost:18766 | head -5)
if echo "$FRONTEND_CHECK" | grep -q "Cloud Code"; then
    echo -e "${GREEN}✓ 前端页面正常${NC}"
else
    echo -e "${RED}✗ 前端页面异常${NC}"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}测试完成！${NC}"
echo "=========================================="
echo ""
echo "请在浏览器中测试以下功能："
echo "1. 访问 http://localhost:18766 或 http://192.168.31.37:18766"
echo "2. 点击 '+ 新建对话' - 应该弹出自定义弹窗"
echo "3. 输入工作目录并创建"
echo "4. 点击输入框应该能正常输入"
echo "5. 点击会话旁的 '⋯' 菜单 - 可以重命名和删除"
echo ""
