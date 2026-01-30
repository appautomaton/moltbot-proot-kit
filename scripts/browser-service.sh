#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-start}"

display_num="${BROWSER_DISPLAY_NUM:-99}"
display=":${display_num}"
screen="${BROWSER_XVFB_SCREEN:-1280x720x24}"
port="${BROWSER_CDP_PORT:-18800}"

# OpenClaw state lives under ~/.openclaw
profile="${BROWSER_PROFILE:-clawd}"
user_data_dir="${BROWSER_USER_DATA_DIR:-$HOME/.openclaw/browser/${profile}/user-data}"
state_dir="${BROWSER_STATE_DIR:-$HOME/.openclaw/browser/service/${profile}}"

xvfb_pid_file="${state_dir}/xvfb.pid"
chrome_pid_file="${state_dir}/chrome.pid"
xvfb_log="${state_dir}/xvfb.log"
chrome_log="${state_dir}/chrome.log"

mkdir -p "${state_dir}"

find_chrome_bin() {
  if [[ -n "${CHROME_BIN:-}" ]]; then
    echo "${CHROME_BIN}"
    return 0
  fi

  local candidates
  candidates="$(ls -1d "${HOME}/.cache/ms-playwright/chromium-"*/chrome-linux/chrome 2>/dev/null || true)"
  if [[ -z "${candidates}" ]]; then
    echo "error: could not find Playwright Chromium under ~/.cache/ms-playwright (set CHROME_BIN to override)" >&2
    return 1
  fi

  # Prefer the highest version directory (e.g. chromium-1208 vs chromium-1195).
  echo "${candidates}" | tr ' ' '\n' | sort -V | tail -n 1
}

chrome_bin="$(find_chrome_bin)"

probe_cdp() {
  local url="http://127.0.0.1:${port}/json/version"
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "${url}" >/dev/null 2>&1
    return $?
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -qO- "${url}" >/dev/null 2>&1
    return $?
  fi
  return 1
}

usage() {
  cat <<'EOF'
Usage:
  scripts/browser-service.sh start|stop|restart|status|logs

Environment overrides (optional):
  CHROME_BIN             Path to chromium/chrome binary
  BROWSER_DISPLAY_NUM    X display number (default: 99)
  BROWSER_XVFB_SCREEN    Xvfb screen, e.g. 1280x720x24
  BROWSER_CDP_PORT       CDP remote debugging port (default: 18800)
  BROWSER_PROFILE        Profile name used in ~/.openclaw/browser/<profile>/user-data (default: clawd)
  BROWSER_USER_DATA_DIR  Override user-data-dir (default: ~/.openclaw/browser/<profile>/user-data)
  BROWSER_STATE_DIR      Where to store pid/log files (default: ~/.openclaw/browser/service/<profile>)

Notes:
  - This runs Chromium in "non-headless" mode on Xvfb (DISPLAY=:<num>), with CDP enabled.
  - Do not run two Chromium instances with the same --user-data-dir.
EOF
}

is_xvfb_running() {
  if [[ -f "${xvfb_pid_file}" ]] && kill -0 "$(cat "${xvfb_pid_file}")" 2>/dev/null; then
    return 0
  fi
  pgrep -f "Xvfb ${display} " >/dev/null 2>&1
}

is_chrome_running() {
  if [[ -f "${chrome_pid_file}" ]] && kill -0 "$(cat "${chrome_pid_file}")" 2>/dev/null; then
    return 0
  fi
  pgrep -f -- "--remote-debugging-port=${port}.*--user-data-dir=${user_data_dir}" >/dev/null 2>&1
}

start_xvfb() {
  if is_xvfb_running; then
    return 0
  fi
  if ! command -v Xvfb >/dev/null 2>&1; then
    echo "error: Xvfb not found. Install it (package usually: xvfb)." >&2
    return 1
  fi
  : >"${xvfb_log}"
  Xvfb "${display}" -screen 0 "${screen}" -nolisten tcp >"${xvfb_log}" 2>&1 &
  echo $! >"${xvfb_pid_file}"
}

start_chrome() {
  if is_chrome_running; then
    return 0
  fi

  mkdir -p "$(dirname "${user_data_dir}")"

  : >"${chrome_log}"
  DISPLAY="${display}" "${chrome_bin}" \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port="${port}" \
    --user-data-dir="${user_data_dir}" \
    --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage \
    --no-first-run --no-default-browser-check \
    --password-store=basic \
    --disable-gpu \
    --ozone-platform=x11 \
    about:blank >"${chrome_log}" 2>&1 &
  echo $! >"${chrome_pid_file}"

  # Wait briefly for the CDP endpoint to come up.
  for _ in $(seq 1 30); do
    if probe_cdp; then
      return 0
    fi
    sleep 0.2
  done

  echo "warning: chromium started (pid $(cat "${chrome_pid_file}")), but CDP did not answer on 127.0.0.1:${port}" >&2
  echo "hint: check logs: tail -n 200 '${chrome_log}'" >&2
  return 1
}

stop_process_file() {
  local pid_file="$1"
  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}" || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
      for _ in $(seq 1 30); do
        if ! kill -0 "${pid}" 2>/dev/null; then
          break
        fi
        sleep 0.1
      done
      if kill -0 "${pid}" 2>/dev/null; then
        kill -9 "${pid}" 2>/dev/null || true
      fi
    fi
    rm -f "${pid_file}"
  fi
}

stop_by_args_fallback() {
  # Fallback if pid files are missing. Keep the match narrow.
  pkill -f -- "--remote-debugging-port=${port}.*--user-data-dir=${user_data_dir}" 2>/dev/null || true
  pkill -f -- "Xvfb ${display} " 2>/dev/null || true
}

case "${cmd}" in
  start)
    start_xvfb
    start_chrome
    echo "ok: DISPLAY=${display} CDP=http://127.0.0.1:${port} user-data-dir=${user_data_dir}"
    ;;
  stop)
    stop_process_file "${chrome_pid_file}"
    stop_process_file "${xvfb_pid_file}"
    stop_by_args_fallback
    echo "ok: stopped"
    ;;
  restart)
    "$0" stop
    "$0" start
    ;;
  status)
    echo "Xvfb:   $([ -f "${xvfb_pid_file}" ] && echo "pid $(cat "${xvfb_pid_file}")" || echo "no pidfile")"
    echo "Chrome: $([ -f "${chrome_pid_file}" ] && echo "pid $(cat "${chrome_pid_file}")" || echo "no pidfile")"
    if probe_cdp; then
      echo "CDP:    up (127.0.0.1:${port})"
    else
      echo "CDP:    down (127.0.0.1:${port})"
    fi
    echo "Logs:   ${chrome_log}"
    ;;
  logs)
    tail -n 200 "${chrome_log}" || true
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "error: unknown command '${cmd}'" >&2
    usage >&2
    exit 2
    ;;
esac
