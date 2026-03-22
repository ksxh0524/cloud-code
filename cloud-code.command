#!/bin/bash

# Cloud Code 管理脚本
# 双击运行或在终端执行: ./cloud-code.command
# 支持切换 Node.js/Python 后端

PROJECT_DIR="/Users/liuyang/codes/cloud-code"
BACKEND_PORT=18765
FRONTEND_PORT=18766
LOG_DIR="$PROJECT_DIR/logs"
BACKEND_TYPE="${BACKEND_TYPE:-python}"  # python 或 node

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# 确保在正确的目录
cd "$PROJECT_DIR" || exit 1

# 创建日志目录
mkdir -p "$LOG_DIR"

# 检查服务是否运行
is_running() {
    lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# 获取 PID
get_pid() {
    lsof -Pi :$1 -sTCP:LISTEN -t 2>/dev/null
}

# 启动 Python 后端
start_python_backend() {
    echo -e "${BLUE}启动 Python 后端服务...${NC}"
    cd "$PROJECT_DIR/backend_py"
    
    # 检查虚拟环境
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}创建 Python 虚拟环境...${NC}"
        python3 -m venv venv
    fi
    
    # 检查依赖
    if [ ! -f "venv/lib/python3.9/site-packages/fastapi/__init__.py" ] && \
       [ ! -f "venv/lib/python3.10/site-packages/fastapi/__init__.py" ] && \
       [ ! -f "venv/lib/python3.11/site-packages/fastapi/__init__.py" ] && \
       [ ! -f "venv/lib/python3.12/site-packages/fastapi/__init__.py" ]; then
        echo -e "${YELLOW}安装 Python 依赖...${NC}"
        source venv/bin/activate
        pip install -r requirements.txt
        deactivate
    fi
    
    # 启动服务
    source venv/bin/activate
    nohup venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT --app-dir . > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$LOG_DIR/backend.pid"
    deactivate
    cd "$PROJECT_DIR"
}

# 启动 Node.js 后端 (备用)
start_node_backend() {
    echo -e "${BLUE}启动 Node.js 后端服务...${NC}"
    cd "$PROJECT_DIR/backend"
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}安装 Node.js 依赖...${NC}"
        pnpm install
    fi
    
    nohup pnpm run dev > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$LOG_DIR/backend.pid"
    cd "$PROJECT_DIR"
}

# 启动服务
start_services() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}${BOLD}     Cloud Code 启动中...${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo -e "${BOLD}后端类型: ${YELLOW}$BACKEND_TYPE${NC}"
    echo ""

    # 检查是否已在运行
    if is_running $BACKEND_PORT && is_running $FRONTEND_PORT; then
        echo -e "${YELLOW}Cloud Code 已经在运行中${NC}"
        echo ""
        show_status
        return
    fi

    # 清理可能占用的端口
    if is_running $BACKEND_PORT; then
        echo -e "${YELLOW}端口 $BACKEND_PORT 被占用，正在清理...${NC}"
        get_pid $BACKEND_PORT | xargs kill -9 2>/dev/null
        sleep 1
    fi

    if is_running $FRONTEND_PORT; then
        echo -e "${YELLOW}端口 $FRONTEND_PORT 被占用，正在清理...${NC}"
        get_pid $FRONTEND_PORT | xargs kill -9 2>/dev/null
        sleep 1
    fi

    # 启动后端
    if [ "$BACKEND_TYPE" = "python" ]; then
        start_python_backend
    else
        start_node_backend
    fi

    # 等待后端启动
    for i in {1..15}; do
        if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ 后端启动成功${NC}"
            break
        fi
        if [ $i -eq 15 ]; then
            echo -e "${RED}✗ 后端启动超时${NC}"
            echo "查看日志: tail -f $LOG_DIR/backend.log"
        fi
        sleep 1
    done

    # 启动前端
    echo -e "${BLUE}启动前端服务...${NC}"
    cd "$PROJECT_DIR/frontend"
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}安装前端依赖...${NC}"
        pnpm install
    fi
    
    nohup ./node_modules/.bin/vite --host 0.0.0.0 --port $FRONTEND_PORT > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
    cd "$PROJECT_DIR"

    sleep 3

    if is_running $FRONTEND_PORT; then
        echo -e "${GREEN}✓ 前端启动成功${NC}"
    else
        echo -e "${RED}✗ 前端启动超时${NC}"
        echo "查看日志: tail -f $LOG_DIR/frontend.log"
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}${BOLD}     🚀 Cloud Code 启动完成！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    show_status
}

# 停止服务
stop_services() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}${BOLD}     Cloud Code 停止中...${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local stopped=0

    # 停止后端
    if is_running $BACKEND_PORT; then
        echo -e "${YELLOW}停止后端服务...${NC}"
        get_pid $BACKEND_PORT | xargs kill 2>/dev/null
        sleep 1
        if is_running $BACKEND_PORT; then
            get_pid $BACKEND_PORT | xargs kill -9 2>/dev/null
        fi
        echo -e "${GREEN}✓ 后端已停止${NC}"
        stopped=1
    fi

    # 停止前端
    if is_running $FRONTEND_PORT; then
        echo -e "${YELLOW}停止前端服务...${NC}"
        get_pid $FRONTEND_PORT | xargs kill 2>/dev/null
        sleep 1
        if is_running $FRONTEND_PORT; then
            get_pid $FRONTEND_PORT | xargs kill -9 2>/dev/null
        fi
        echo -e "${GREEN}✓ 前端已停止${NC}"
        stopped=1
    fi

    # 清理 PID 文件
    rm -f "$LOG_DIR/backend.pid" "$LOG_DIR/frontend.pid"

    if [ $stopped -eq 0 ]; then
        echo -e "${YELLOW}Cloud Code 没有在运行${NC}"
    else
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}${BOLD}     ✋ Cloud Code 已停止${NC}"
        echo -e "${GREEN}========================================${NC}"
    fi
    echo ""
}

# 重启服务
restart_services() {
    echo -e "${BLUE}重启 Cloud Code...${NC}"
    echo ""
    stop_services
    sleep 2
    start_services
}

# 显示状态
show_status() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}${BOLD}     Cloud Code 状态${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local backend_running=0
    local frontend_running=0

    # 检查后端
    if is_running $BACKEND_PORT; then
        local pid=$(get_pid $BACKEND_PORT)
        echo -e "后端服务: ${GREEN}● 运行中${NC} (PID: $pid, 端口: $BACKEND_PORT, 类型: $BACKEND_TYPE)"
        backend_running=1
    else
        echo -e "后端服务: ${RED}○ 未运行${NC} (端口: $BACKEND_PORT)"
    fi

    # 检查前端
    if is_running $FRONTEND_PORT; then
        local pid=$(get_pid $FRONTEND_PORT)
        echo -e "前端服务: ${GREEN}● 运行中${NC} (PID: $pid, 端口: $FRONTEND_PORT)"
        frontend_running=1
    else
        echo -e "前端服务: ${RED}○ 未运行${NC} (端口: $FRONTEND_PORT)"
    fi

    echo ""

    # 健康检查
    if [ $backend_running -eq 1 ]; then
        local health=$(curl -s http://localhost:$BACKEND_PORT/api/health 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo -e "健康检查: ${GREEN}✓ 正常${NC}"
        else
            echo -e "健康检查: ${RED}✗ 失败${NC}"
        fi
    fi

    echo ""

    # 访问地址
    if [ $frontend_running -eq 1 ]; then
        echo -e "${BOLD}访问地址:${NC}"
        echo -e "  前端: ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
        echo -e "  后端: ${CYAN}http://localhost:$BACKEND_PORT${NC}"
        echo -e "  API文档: ${CYAN}http://localhost:$BACKEND_PORT/docs${NC}"
        echo ""
    fi

    # 日志
    echo -e "${BOLD}日志文件:${NC}"
    echo -e "  后端: ${YELLOW}tail -f $LOG_DIR/backend.log${NC}"
    echo -e "  前端: ${YELLOW}tail -f $LOG_DIR/frontend.log${NC}"
    echo ""
}

# 显示菜单
show_menu() {
    clear
    echo -e "${CYAN}"
    echo "  ____                            _       "
    echo " / ___|___  _ __   __ _ _ __ __ _| |_ ___ "
    echo "| |   / _ \| '_ \ / _\` | '__/ _\` | __/ _ \\"
    echo "| |__| (_) | |_) | (_| | | | (_| | ||  __/"
    echo " \____\___/| .__/ \__, |_|  \__,_|\__\___|"
    echo "           |_|    |___/                   "
    echo -e "${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}${BOLD}     Cloud Code 管理脚本${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # 显示当前状态
    if is_running $BACKEND_PORT && is_running $FRONTEND_PORT; then
        echo -e "  当前状态: ${GREEN}${BOLD}● 运行中${NC} (后端: $BACKEND_TYPE)"
    else
        echo -e "  当前状态: ${RED}${BOLD}○ 未运行${NC}"
    fi

    echo ""
    echo -e "${BOLD}请选择操作:${NC}"
    echo ""
    echo -e "  ${GREEN}1${NC} - 启动服务"
    echo -e "  ${RED}2${NC} - 停止服务"
    echo -e "  ${YELLOW}3${NC} - 重启服务"
    echo -e "  ${CYAN}4${NC} - 查看状态"
    echo -e "  ${BLUE}5${NC} - 查看日志"
    echo -e "  ${MAGENTA}6${NC} - 切换后端 (当前: $BACKEND_TYPE)"
    echo -e "  ${NC}0${NC} - 退出"
    echo ""
    echo -ne "${BOLD}请输入选项 [0-6]: ${NC}"
}

# 切换后端类型
switch_backend() {
    if [ "$BACKEND_TYPE" = "python" ]; then
        BACKEND_TYPE="node"
    else
        BACKEND_TYPE="python"
    fi
    echo -e "${GREEN}已切换到 $BACKEND_TYPE 后端${NC}"
    echo ""
    echo -e "${YELLOW}注意: 需要重启服务才能生效${NC}"
    sleep 2
}

# 查看日志
show_logs() {
    echo ""
    echo -e "${BOLD}选择要查看的日志:${NC}"
    echo ""
    echo "  1 - 后端日志"
    echo "  2 - 前端日志"
    echo "  0 - 返回"
    echo ""
    echo -ne "请输入选项: "
    read -r choice

    case $choice in
        1)
            echo -e "${BLUE}打开后端日志 (Ctrl+C 退出)...${NC}"
            echo ""
            tail -f "$LOG_DIR/backend.log"
            ;;
        2)
            echo -e "${BLUE}打开前端日志 (Ctrl+C 退出)...${NC}"
            echo ""
            tail -f "$LOG_DIR/frontend.log"
            ;;
        0)
            return
            ;;
        *)
            echo -e "${RED}无效选项${NC}"
            sleep 1
            ;;
    esac
}

# 主循环
main() {
    # 如果有命令行参数，直接执行
    if [ $# -gt 0 ]; then
        case $1 in
            start|up)
                start_services
                ;;
            stop|down)
                stop_services
                ;;
            restart|reload)
                restart_services
                ;;
            status|info)
                show_status
                ;;
            python)
                BACKEND_TYPE="python"
                shift
                if [ "$1" = "start" ]; then
                    start_services
                else
                    show_status
                fi
                ;;
            node)
                BACKEND_TYPE="node"
                shift
                if [ "$1" = "start" ]; then
                    start_services
                else
                    show_status
                fi
                ;;
            *)
                echo "用法: $0 {start|stop|restart|status|python|node}"
                echo ""
                echo "命令:"
                echo "  start   - 启动服务"
                echo "  stop    - 停止服务"
                echo "  restart - 重启服务"
                echo "  status  - 查看状态"
                echo "  python  - 使用 Python 后端"
                echo "  node    - 使用 Node.js 后端"
                exit 1
                ;;
        esac
        exit 0
    fi

    # 交互式菜单
    while true; do
        show_menu
        read -r choice
        echo ""

        case $choice in
            1)
                start_services
                echo -ne "${BOLD}按 Enter 继续...${NC}"
                read -r
                ;;
            2)
                stop_services
                echo -ne "${BOLD}按 Enter 继续...${NC}"
                read -r
                ;;
            3)
                restart_services
                echo -ne "${BOLD}按 Enter 继续...${NC}"
                read -r
                ;;
            4)
                show_status
                echo -ne "${BOLD}按 Enter 继续...${NC}"
                read -r
                ;;
            5)
                show_logs
                ;;
            6)
                switch_backend
                ;;
            0|q|Q)
                echo ""
                echo -e "${CYAN}再见！${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}无效选项，请重新选择${NC}"
                sleep 1
                ;;
        esac
    done
}

# 运行主程序
main "$@"