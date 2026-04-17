#!/bin/bash

# Cloud Code 管理脚本
# 用法: ./manager.sh [start|stop|status|restart|logs|update|clean]

set -euo pipefail

# ============================================================================
# 全局配置
# ============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly LOG_DIR="$SCRIPT_DIR/logs"
readonly PID_DIR="$SCRIPT_DIR/.pids"

readonly MAX_START_WAIT=30
readonly MAX_STOP_WAIT=8
readonly LOG_RETENTION_DAYS=7

# 颜色
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# 服务配置: name|port|display_name|workdir|start_cmd|health_path
readonly SERVICES=(
    "backend|18765|Backend API|backend|pnpm run dev|/api/health"
    "frontend|18766|Frontend|. |pnpm run dev|/"
)

# ============================================================================
# 初始化
# ============================================================================

init() {
    mkdir -p "$LOG_DIR" "$PID_DIR"
}

# ============================================================================
# 工具函数
# ============================================================================

log_info()    { echo -e "${BLUE}  $1${NC}"; }
log_success() { echo -e "${GREEN}  ✓ $1${NC}"; }
log_warning() { echo -e "${YELLOW}  $1${NC}"; }
log_error()   { echo -e "${RED}  ✗ $1${NC}"; }

get_service_field() {
    local service=$1
    local field=$2
    local idx
    case "$field" in
        name)   idx=0 ;;
        port)   idx=1 ;;
        display) idx=2 ;;
        workdir) idx=3 ;;
        cmd)    idx=4 ;;
        health) idx=5 ;;
        *)      return 1 ;;
    esac
    for svc in "${SERVICES[@]}"; do
        if [[ "$svc" == "$service|"* ]]; then
            echo "$svc" | cut -d'|' -f$((idx + 1))
            return 0
        fi
    done
    return 1
}

has_command() {
    command -v "$1" &> /dev/null
}

get_pids_by_port() {
    local port=$1
    if has_command lsof; then
        lsof -ti :"$port" 2>/dev/null || true
    fi
}

get_descendants() {
    local pid=$1
    local children
    children=$(pgrep -P "$pid" 2>/dev/null || true)
    for child in $children; do
        echo "$child"
        get_descendants "$child"
    done
}

# ============================================================================
# 服务状态检查
# ============================================================================

is_service_running() {
    local service=$1
    local port
    port=$(get_service_field "$service" port) || return 1
    local pid_file="$PID_DIR/${service}.pid"

    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
        local descendants
        descendants=$(get_descendants "$pid")
        for dpid in $descendants; do
            if kill -0 "$dpid" 2>/dev/null; then
                return 0
            fi
        done
    fi

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -m 2 "http://localhost:$port" 2>/dev/null || echo "000")
    if [[ "$http_code" =~ ^[23] ]]; then
        return 0
    fi

    return 1
}

# ============================================================================
# 健康检查
# ============================================================================

wait_for_health() {
    local service=$1
    local port health_path
    port=$(get_service_field "$service" port) || return 1
    health_path=$(get_service_field "$service" health) || health_path="/"

    local count=0
    while [ $count -lt $MAX_START_WAIT ]; do
        local response
        response=$(curl -s -o /dev/null -w "%{http_code}" -m 2 "http://localhost:${port}${health_path}" 2>/dev/null || echo "000")

        if [ "$response" = "200" ]; then
            if [ "$service" = "backend" ]; then
                local body
                body=$(curl -s -m 2 "http://localhost:${port}${health_path}" 2>/dev/null || echo "")
                if echo "$body" | grep -qiE "ok|healthy|success"; then
                    return 0
                fi
            else
                return 0
            fi
        fi

        sleep 1
        count=$((count + 1))
    done
    return 1
}

# ============================================================================
# 服务管理
# ============================================================================

start_service() {
    local service=$1
    local port name workdir cmd
    port=$(get_service_field "$service" port) || return 1
    name=$(get_service_field "$service" display) || return 1
    workdir=$(get_service_field "$service" workdir) || return 1
    cmd=$(get_service_field "$service" cmd) || return 1

    local pid_file="$PID_DIR/${service}.pid"
    local log_file="$LOG_DIR/${service}.log"

    if is_service_running "$service"; then
        log_warning "$name 已在运行 (端口 $port)"
        return 0
    fi

    log_info "启动 $name..."

    if [ "$service" = "backend" ] && [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
        log_error "Backend .env 文件不存在"
        log_warning "请参考 backend/.env.example 创建配置文件"
        return 1
    fi

    ( cd "$SCRIPT_DIR/$workdir" && nohup $cmd > "$log_file" 2>&1 & echo $! ) > "$pid_file"

    if wait_for_health "$service"; then
        log_success "$name 启动成功 (端口 $port)"
        return 0
    else
        log_error "$name 启动失败"
        log_warning "查看日志: tail -f $log_file"
        return 1
    fi
}

stop_service() {
    local service=$1
    local port name
    port=$(get_service_field "$service" port) || return 1
    name=$(get_service_field "$service" display) || return 1
    local pid_file="$PID_DIR/${service}.pid"

    if ! is_service_running "$service"; then
        log_info "$name 未运行"
        rm -f "$pid_file" 2>/dev/null || true
        return 0
    fi

    log_warning "停止 $name..."

    local all_pids=""

    if [ -f "$pid_file" ]; then
        local file_pid
        file_pid=$(cat "$pid_file")
        if kill -0 "$file_pid" 2>/dev/null; then
            all_pids="$file_pid"
        fi
        local descendants
        descendants=$(get_descendants "$file_pid")
        for dpid in $descendants; do
            if kill -0 "$dpid" 2>/dev/null; then
                all_pids="$all_pids $dpid"
            fi
        done
    fi

    local port_pids
    port_pids=$(get_pids_by_port "$port")
    for ppid in $port_pids; do
        if kill -0 "$ppid" 2>/dev/null; then
            all_pids="$all_pids $ppid"
        fi
    done

    all_pids=$(echo "$all_pids" | tr ' ' '\n' | sort -u | grep -v '^$' || true)

    if [ -z "$all_pids" ]; then
        port_pids=$(get_pids_by_port "$port")
        if [ -z "$port_pids" ]; then
            log_success "$name 已停止"
            rm -f "$pid_file" 2>/dev/null || true
            return 0
        fi
        all_pids="$port_pids"
    fi

    log_info "发送 SIGTERM 到进程: $(echo $all_pids | tr '\n' ' ')"
    echo "$all_pids" | xargs kill -TERM 2>/dev/null || true

    local count=0
    while [ $count -lt $MAX_STOP_WAIT ]; do
        local still_alive=false
        for pid in $all_pids; do
            if kill -0 "$pid" 2>/dev/null; then
                still_alive=true
                break
            fi
        done
        if [ "$still_alive" = false ]; then
            log_success "$name 已停止"
            rm -f "$pid_file" 2>/dev/null || true
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done

    log_warning "优雅退出超时，强制停止 $name..."

    local kill_pids=""
    for pid in $all_pids; do
        if kill -0 "$pid" 2>/dev/null; then
            kill_pids="$kill_pids $pid"
        fi
    done
    local leftover
    leftover=$(get_pids_by_port "$port")
    [ -n "$leftover" ] && kill_pids="$kill_pids $leftover"

    kill_pids=$(echo "$kill_pids" | tr ' ' '\n' | sort -u | grep -v '^$' || true)

    if [ -n "$kill_pids" ]; then
        echo "$kill_pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        leftover=$(get_pids_by_port "$port")
        if [ -n "$leftover" ]; then
            echo "$leftover" | xargs kill -9 2>/dev/null || true
        fi
    fi

    rm -f "$pid_file" 2>/dev/null || true
    log_success "$name 已强制停止"
    return 0
}

# ============================================================================
# 主命令
# ============================================================================

start_services() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Cloud Code 启动中...               ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""

    if ! has_command pnpm; then
        log_error "未找到 pnpm，请先安装: npm install -g pnpm"
        exit 1
    fi

    if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
        log_warning "安装依赖..."
        pnpm install
    fi

    echo -e "${CYAN}启动服务:${NC}"
    echo ""

    for svc in "${SERVICES[@]}"; do
        local name
        name=$(echo "$svc" | cut -d'|' -f1)
        start_service "$name"
    done

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       所有服务已启动                     ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BLUE}Backend:${NC}    http://localhost:18765"
    echo -e "  ${GREEN}Frontend:${NC}   http://localhost:18766"
    echo ""
    echo -e "${CYAN}日志目录: $LOG_DIR${NC}"
    echo -e "${CYAN}查看日志: ./manager.sh logs${NC}"
    echo -e "${CYAN}停止服务: ./manager.sh stop${NC}"
    echo ""
}

stop_services() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Cloud Code 停止中...               ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${CYAN}停止服务:${NC}"
    echo ""

    for ((i=${#SERVICES[@]}-1; i>=0; i--)); do
        local name
        name=$(echo "${SERVICES[$i]}" | cut -d'|' -f1)
        stop_service "$name"
    done

    echo ""
    echo -e "${GREEN}所有服务已停止${NC}"
}

show_status() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Cloud Code 服务状态                ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""

    for svc in "${SERVICES[@]}"; do
        local name port display pid_file
        name=$(echo "$svc" | cut -d'|' -f1)
        port=$(echo "$svc" | cut -d'|' -f2)
        display=$(echo "$svc" | cut -d'|' -f3)
        pid_file="$PID_DIR/${name}.pid"

        if is_service_running "$name"; then
            local pid=""
            [ -f "$pid_file" ] && pid=$(cat "$pid_file")
            [ -z "$pid" ] && pid=$(get_pids_by_port "$port" | head -1)

            local uptime=""
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                local start_time start_epoch
                start_time=$(ps -p "$pid" -o lstart= 2>/dev/null || echo "")
                if [ -n "$start_time" ]; then
                    if [[ "$OSTYPE" == "darwin"* ]]; then
                        start_epoch=$(date -j -f "%a %b %d %T %Y" "$start_time" "+%s" 2>/dev/null || echo "")
                    else
                        start_epoch=$(date -d "$start_time" "+%s" 2>/dev/null || echo "")
                    fi
                    if [ -n "$start_epoch" ]; then
                        local now_epoch diff days hours mins
                        now_epoch=$(date "+%s")
                        diff=$((now_epoch - start_epoch))
                        days=$((diff / 86400))
                        hours=$(( (diff % 86400) / 3600 ))
                        mins=$(( (diff % 3600) / 60 ))
                        if [ $days -gt 0 ]; then
                            uptime="${days}天${hours}小时"
                        elif [ $hours -gt 0 ]; then
                            uptime="${hours}小时${mins}分"
                        else
                            uptime="${mins}分钟"
                        fi
                    fi
                fi
            fi
            echo -e "  ${GREEN}●${NC} $display ${GREEN}运行中${NC}"
            [ -n "$uptime" ] && echo -e "    ${CYAN}http://localhost:$port${NC}  |  PID: ${CYAN}${pid}${NC}  |  运行时长: ${CYAN}${uptime}${NC}"
        else
            echo -e "  ${RED}○${NC} $display ${RED}未运行${NC}"
        fi
    done
    echo ""
}

show_logs() {
    local service="${2:-}"

    if [ -z "$service" ]; then
        local log_files=()
        for svc in "${SERVICES[@]}"; do
            local name log_file
            name=$(echo "$svc" | cut -d'|' -f1)
            log_file="$LOG_DIR/${name}.log"
            [ -f "$log_file" ] && log_files+=("$log_file")
        done

        if [ ${#log_files[@]} -eq 0 ]; then
            log_warning "没有日志文件，请先启动服务"
            return
        fi

        echo -e "${CYAN}实时查看所有服务日志 (Ctrl+C 退出):${NC}"
        tail -f "${log_files[@]}"
        return
    fi

    local log_file="$LOG_DIR/${service}.log"
    if [ ! -f "$log_file" ]; then
        log_error "日志文件不存在: $log_file"
        exit 1
    fi

    echo -e "${CYAN}查看 $service 日志 (Ctrl+C 退出):${NC}"
    tail -f "$log_file"
}

do_update() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Cloud Code 更新中...               ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""

    log_info "拉取最新代码..."
    if git pull; then
        log_success "git pull 成功"
    else
        log_error "git pull 失败"
        exit 1
    fi

    log_info "安装依赖..."
    for dir in "." "backend"; do
        if [ -f "$SCRIPT_DIR/$dir/package.json" ]; then
            log_info "安装 $dir 依赖..."
            (cd "$SCRIPT_DIR/$dir" && pnpm install)
            log_success "$dir"
        fi
    done

    echo ""
    log_success "更新完成！"

    for svc in "${SERVICES[@]}"; do
        local name
        name=$(echo "$svc" | cut -d'|' -f1)
        if is_service_running "$name"; then
            log_warning "检测到有服务正在运行，建议重启以应用更新"
            echo -e "运行 ${CYAN}./manager.sh restart${NC} 重启所有服务"
            break
        fi
    done
}

do_clean() {
    log_info "清理 $LOG_RETENTION_DAYS 天前的旧日志..."

    if [ ! -d "$LOG_DIR" ] || [ -z "$(ls -A "$LOG_DIR" 2>/dev/null)" ]; then
        log_warning "日志目录为空"
        return
    fi

    local count
    count=$(find "$LOG_DIR" -name "*.log" -type f -mtime +$LOG_RETENTION_DAYS 2>/dev/null | wc -l | tr -d ' ')

    if [ "$count" -eq 0 ]; then
        log_success "没有需要清理的旧日志"
        return
    fi

    find "$LOG_DIR" -name "*.log" -type f -mtime +$LOG_RETENTION_DAYS -exec rm -v {} \;
    log_success "已清理 $count 个旧日志文件"
}

show_help() {
    cat << EOF
Cloud Code 管理脚本

用法: $0 <command> [options]

命令:
  start     启动所有服务
  stop      停止所有服务
  restart   重启所有服务
  status    查看服务状态
  logs      查看日志 (可选: logs <service>)
  update    拉取代码并安装依赖
  clean     清理 $LOG_RETENTION_DAYS 天前的旧日志

示例:
  $0 start              # 启动所有服务
  $0 logs backend       # 查看后端日志
  $0 logs               # 实时查看所有日志
  $0 update             # 更新代码+依赖
  $0 clean              # 清理旧日志
EOF
}

# ============================================================================
# 主入口
# ============================================================================

init

case "${1:-}" in
    start)   start_services ;;
    stop)    stop_services ;;
    restart)
        stop_services
        echo ""
        sleep 2
        start_services
        ;;
    status)  show_status ;;
    logs)    show_logs "$@" ;;
    update)  do_update ;;
    clean)   do_clean ;;
    -h|--help|help) show_help ;;
    *)
        show_help
        exit 1
        ;;
esac
