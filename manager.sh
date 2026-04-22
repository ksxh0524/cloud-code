#!/bin/bash

# Cloud Code 管理脚本
# 用法: ./manager.sh [start|stop|status|restart|logs|update|clean|build]
#   --prod  生产模式 (需要先 build)

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
readonly LOG_MAX_SIZE=$((5 * 1024 * 1024))  # 5MB

# 颜色
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# 解析 --prod 标志
PROD_MODE=false
for arg in "$@"; do
    case "$arg" in
        --prod) PROD_MODE=true ;;
    esac
done

# 服务配置: name|port|display_name|workdir|dev_cmd|prod_cmd|health_path
readonly SERVICES=(
    "backend|18765|Backend API|backend|pnpm run dev|node dist/server.js|/api/health"
    "frontend|18766|Frontend|frontend|pnpm run dev|npx vite preview --port 18766|/"
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
        dev_cmd) idx=4 ;;
        prod_cmd) idx=5 ;;
        health) idx=6 ;;
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

# 检查端口是否被非本项目的进程占用
check_port_conflict() {
    local port=$1
    local service=$2
    local pids
    pids=$(get_pids_by_port "$port")

    if [ -z "$pids" ]; then
        return 0  # 端口空闲
    fi

    # 检查这些 PID 是否属于本脚本管理的服务
    local pid_file="$PID_DIR/${service}.pid"
    if [ -f "$pid_file" ]; then
        local managed_pid
        managed_pid=$(cat "$pid_file")
        for pid in $pids; do
            if [ "$pid" = "$managed_pid" ]; then
                return 0  # 是自己管理的进程
            fi
        done
    fi

    # 端口被其他进程占用
    return 1
}

# 截断超大日志文件
rotate_log_if_needed() {
    local log_file=$1
    [ ! -f "$log_file" ] && return

    local size
    size=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo 0)
    if [ "$size" -gt "$LOG_MAX_SIZE" ]; then
        local backup="${log_file}.old"
        mv "$log_file" "$backup"
        # 只保留最后 200 行到新日志
        tail -200 "$backup" > "$log_file"
        log_info "日志已轮转: $(basename "$log_file")"
    fi
}

# 交互式确认
confirm() {
    local prompt=$1
    local default=${2:-n}
    echo -ne "${YELLOW}  $prompt [${default^^}] ${NC}"
    read -r answer
    answer="${answer:-$default}"
    case "$answer" in
        [yY]|[yY][eE][sS]) return 0 ;;
        *) return 1 ;;
    esac
}

# ============================================================================
# 服务状态检查
# ============================================================================

is_service_running() {
    local service=$1
    local port
    port=$(get_service_field "$service" port) || return 1

    # 先检查端口是否有进程在监听
    local pids
    pids=$(get_pids_by_port "$port")
    if [ -n "$pids" ]; then
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
                if echo "$body" | grep -qiE '"status"\s*:\s*"ok"'; then
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
    local port name workdir health_path cmd
    port=$(get_service_field "$service" port) || return 1
    name=$(get_service_field "$service" display) || return 1
    workdir=$(get_service_field "$service" workdir) || return 1
    health_path=$(get_service_field "$service" health) || health_path="/"

    if [ "$PROD_MODE" = true ]; then
        cmd=$(get_service_field "$service" prod_cmd) || return 1
    else
        cmd=$(get_service_field "$service" dev_cmd) || return 1
    fi

    local pid_file="$PID_DIR/${service}.pid"
    local log_file="$LOG_DIR/${service}.log"

    if is_service_running "$service"; then
        log_warning "$name 已在运行 (端口 $port)"
        return 0
    fi

    # 检查端口冲突
    if ! check_port_conflict "$port" "$service"; then
        log_error "$name: 端口 $port 已被其他进程占用"
        local occupier
        occupier=$(lsof -i :"$port" -sTCP:LISTEN 2>/dev/null | tail -1 || true)
        [ -n "$occupier" ] && log_warning "占用进程: $occupier"
        return 1
    fi

    # 后端依赖检查（前端启动前确保后端就绪）
    if [ "$service" = "frontend" ]; then
        local backend_port
        backend_port=$(get_service_field "backend" port) || backend_port=18765
        if ! is_service_running "backend"; then
            log_warning "后端未运行，建议先启动后端"
        fi
    fi

    # 生产模式检查编译产物
    if [ "$PROD_MODE" = true ]; then
        if [ "$service" = "backend" ] && [ ! -d "$SCRIPT_DIR/backend/dist" ]; then
            log_error "$name: 未找到 dist/ 目录，请先运行 ./manager.sh build"
            return 1
        fi
        if [ "$service" = "frontend" ] && [ ! -d "$SCRIPT_DIR/frontend/dist" ]; then
            log_error "$name: 未找到 dist/ 目录，请先运行 ./manager.sh build"
            return 1
        fi
    fi

    if [ "$service" = "backend" ] && [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
        log_error "Backend .env 文件不存在"
        log_warning "请参考 backend/.env.example 创建配置文件"
        return 1
    fi

    log_info "启动 $name..."

    # 轮转日志
    rotate_log_if_needed "$log_file"

    # 启动服务，通过等待端口出现来获取真实 PID
    ( cd "$SCRIPT_DIR/$workdir" && nohup $cmd >> "$log_file" 2>&1 & )

    # 等待进程启动并获取端口对应的 PID
    local wait_count=0
    local actual_pid=""
    while [ $wait_count -lt 5 ]; do
        actual_pid=$(get_pids_by_port "$port" | head -1)
        [ -n "$actual_pid" ] && break
        sleep 0.5
        wait_count=$((wait_count + 1))
    done

    if [ -n "$actual_pid" ]; then
        echo "$actual_pid" > "$pid_file"
    fi

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

    # 收集所有相关 PID
    local all_pids=""
    all_pids=$(get_pids_by_port "$port")

    if [ -z "$all_pids" ]; then
        log_success "$name 已停止"
        rm -f "$pid_file" 2>/dev/null || true
        return 0
    fi

    all_pids=$(echo "$all_pids" | sort -u)

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

    # SIGKILL 兜底
    all_pids=$(get_pids_by_port "$port")
    if [ -n "$all_pids" ]; then
        echo "$all_pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        all_pids=$(get_pids_by_port "$port")
        if [ -n "$all_pids" ]; then
            echo "$all_pids" | xargs kill -9 2>/dev/null || true
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
    local mode_label=""
    [ "$PROD_MODE" = true ] && mode_label=" [生产模式]"

    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Cloud Code 启动中...${mode_label}            ║${NC}"
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
    echo -e "${GREEN}║       所有服务已启动${mode_label}                 ║${NC}"
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
            pid=$(get_pids_by_port "$port" | head -1)

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

do_build() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Cloud Code 构建中...               ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""

    if ! has_command pnpm; then
        log_error "未找到 pnpm"
        exit 1
    fi

    if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
        log_warning "安装依赖..."
        pnpm install
    fi

    log_info "构建后端..."
    if (cd "$SCRIPT_DIR/backend" && pnpm run build); then
        log_success "后端构建完成"
    else
        log_error "后端构建失败"
        exit 1
    fi

    log_info "构建前端..."
    if (cd "$SCRIPT_DIR/frontend" && pnpm run build); then
        log_success "前端构建完成"
    else
        log_error "前端构建失败"
        exit 1
    fi

    echo ""
    log_success "构建完成！使用 ${CYAN}./manager.sh start --prod${NC} 以生产模式启动"
}

do_update() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Cloud Code 更新中...               ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""

    local was_running=false
    for svc in "${SERVICES[@]}"; do
        local name
        name=$(echo "$svc" | cut -d'|' -f1)
        if is_service_running "$name"; then
            was_running=true
            break
        fi
    done

    if [ "$was_running" = true ]; then
        log_warning "检测到服务正在运行"
        if confirm "是否先停止服务？(推荐)" "y"; then
            stop_services
            echo ""
        fi
    fi

    log_info "拉取最新代码..."
    if git pull; then
        log_success "git pull 成功"
    else
        log_error "git pull 失败"
        exit 1
    fi

    log_info "安装依赖..."
    pnpm install
    log_success "依赖安装完成"

    echo ""
    log_success "更新完成！"

    if [ "$was_running" = true ]; then
        if confirm "是否立即重启服务？" "y"; then
            echo ""
            start_services
        fi
    fi
}

do_clean() {
    log_info "清理 $LOG_RETENTION_DAYS 天前的旧日志..."

    if [ ! -d "$LOG_DIR" ] || [ -z "$(ls -A "$LOG_DIR" 2>/dev/null)" ]; then
        log_warning "日志目录为空"
        return
    fi

    local count
    count=$(find "$LOG_DIR" -name "*.log" -type f -mtime +$LOG_RETENTION_DAYS 2>/dev/null | wc -l | tr -d ' ')
    local old_count
    old_count=$(find "$LOG_DIR" -name "*.log.old" -type f 2>/dev/null | wc -l | tr -d ' ')

    if [ "$count" -eq 0 ] && [ "$old_count" -eq 0 ]; then
        log_success "没有需要清理的旧日志"
        return
    fi

    [ "$count" -gt 0 ] && find "$LOG_DIR" -name "*.log" -type f -mtime +$LOG_RETENTION_DAYS -exec rm -v {} \;
    [ "$old_count" -gt 0 ] && find "$LOG_DIR" -name "*.log.old" -type f -exec rm -v {} \;

    log_success "已清理 $count 个旧日志文件和 $old_count 个轮转备份"
}

show_help() {
    cat << EOF
Cloud Code 管理脚本

用法: $0 <command> [options]

命令:
  start     启动所有服务 (开发模式)
  start --prod  生产模式启动 (需要先 build)
  stop      停止所有服务
  restart   重启所有服务
  build     构建生产版本
  status    查看服务状态
  logs      查看日志 (可选: logs <service>)
  update    拉取代码并安装依赖 (自动提示重启)
  clean     清理 $LOG_RETENTION_DAYS 天前的旧日志

示例:
  $0 start              # 启动所有服务 (开发模式)
  $0 start --prod       # 生产模式启动
  $0 build              # 构建
  $0 build && $0 start --prod  # 构建+生产启动
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
    build)   do_build ;;
    status)  show_status ;;
    logs)    show_logs "$@" ;;
    update)  do_update ;;
    clean)   do_clean ;;
    -h|--help|help) show_help ;;
    "")
        show_help
        exit 1
        ;;
    *)
        log_error "未知命令: $1"
        show_help
        exit 1
        ;;
esac
