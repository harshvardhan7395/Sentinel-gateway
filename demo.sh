#!/usr/bin/env bash
# Sentinel Gateway — circuit breaker lifecycle demo.
#
#   ./demo.sh          step-by-step: press Enter to advance (for recording / narration)
#   ./demo.sh --auto   run straight through with short pauses
#
# Tip: open http://localhost:3000/dashboard alongside this terminal.
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
AUTO=0
[[ "${1:-}" == "--auto" ]] && AUTO=1

BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BLUE='\033[1;34m'

STEP=0
TOTAL=10

header() {
  STEP=$((STEP + 1))
  echo
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}${CYAN} STEP ${STEP}/${TOTAL} · $1${RESET}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}
info() { echo -e "${YELLOW}  $1${RESET}"; }
ok()   { echo -e "${GREEN}  ✔ $1${RESET}"; }
bad()  { echo -e "${RED}  ✘ $1${RESET}"; }
cmd()  { echo -e "${DIM}  \$ $1${RESET}"; }

pause() {
  if [[ $AUTO -eq 1 ]]; then
    sleep 1.5
  else
    echo
    read -r -p "$(echo -e "${DIM}  ↵ press Enter to continue${RESET}")" _
  fi
}

# Pretty-print JSON with node (always available here; python3/jq may not be).
pretty() {
  node -e '
    let s = "";
    process.stdin.on("data", d => s += d).on("end", () => {
      try { console.log(JSON.stringify(JSON.parse(s), null, 2).replace(/^/gm, "  ")); }
      catch { console.log("  " + s); }
    });'
}

# curl's own timer, in whole ms (avoids counting process start-up time)
to_ms() { awk -v t="$1" 'BEGIN { printf "%d", t * 1000 }'; }

state_of() {  # state_of digid → closed|open|half-open
  curl -s "$BASE/health" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => console.log(JSON.parse(s)[process.argv[1]]));' "$1"
}

badge() {
  case "$1" in
    closed)    echo -e "${GREEN}${BOLD}● CLOSED${RESET}" ;;
    open)      echo -e "${RED}${BOLD}● OPEN${RESET}" ;;
    half-open) echo -e "${YELLOW}${BOLD}● HALF-OPEN${RESET}" ;;
    *)         echo "$1" ;;
  esac
}

show_circuits() {
  echo -e "  DigiD circuit: $(badge "$(state_of digid)")    iDIN circuit: $(badge "$(state_of idin)")"
}

# fetch SOURCE USERID → prints HTTP status, latency, and body
fetch() {
  local source=$1 user=$2 out meta status
  cmd "curl -X POST \"$BASE/fetch?source=$source\" -d '{\"userId\":\"$user\"}'"
  out=$(curl -s -w '\n%{http_code} %{time_total}' -X POST "$BASE/fetch?source=$source" \
    -H "Content-Type: application/json" -d "{\"userId\":\"$user\"}")
  meta=${out##*$'\n'}
  status=${meta% *}
  echo -e "  ${BOLD}HTTP $status${RESET} ${DIM}in $(to_ms "${meta#* }") ms${RESET}"
  echo "${out%$'\n'*}" | pretty
}

set_upstream() {
  cmd "curl -X POST $BASE/control -d '{\"source\":\"$1\",\"state\":\"$2\"}'"
  curl -s -X POST "$BASE/control" -H "Content-Type: application/json" \
    -d "{\"source\":\"$1\",\"state\":\"$2\"}" > /dev/null
  ok "$1 upstream is now ${BOLD}$2${RESET}"
}

# ── Preflight ──────────────────────────────────────────────────────────
if ! curl -s -o /dev/null "$BASE/live"; then
  bad "Gateway not reachable at $BASE — start it with: npm start"
  exit 1
fi
curl -s -X POST "$BASE/control" -H "Content-Type: application/json" -d '{"source":"digid","state":"healthy"}' > /dev/null
curl -s -X POST "$BASE/control" -H "Content-Type: application/json" -d '{"source":"idin","state":"healthy"}' > /dev/null
if [[ "$(state_of digid)" != "closed" || "$(state_of idin)" != "closed" ]]; then
  bad "A circuit is not closed from a previous run. Restart the server (npm start) for a clean demo."
  exit 1
fi

echo -e "\n${BOLD}${BLUE}  Sentinel Gateway · circuit breaker lifecycle demo${RESET}"
echo -e "${DIM}  Dashboard: $BASE/dashboard${RESET}"
pause

# ── 1 ──────────────────────────────────────────────────────────────────
header "Healthy request through DigiD"
info "Both upstreams healthy, both circuits closed. Expect 200 with data."
fetch digid user-42
show_circuits
pause

# ── 2 ──────────────────────────────────────────────────────────────────
header "Domain errors do NOT trip the circuit"
info "USER_NOT_FOUND is a business answer, not an infrastructure failure."
info "It is excluded from the failure rate via opossum's errorFilter."
fetch idin unknown
info "Sending 5 more unknown-user requests to iDIN..."
for i in $(seq 1 5); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/fetch?source=idin" \
    -H "Content-Type: application/json" -d '{"userId":"unknown"}')
  echo -e "    request $i → HTTP $code"
done
show_circuits
ok "iDIN circuit is still closed: 404s are not outages."
pause

# ── 3 ──────────────────────────────────────────────────────────────────
header "DigiD goes down"
info "Every upstream call to DigiD now fails with a transient error."
info "Each request retries twice with exponential backoff + jitter before giving up,"
info "then returns a typed SOURCE_UNAVAILABLE, never a generic 500."
set_upstream digid down
pause

# ── 4 ──────────────────────────────────────────────────────────────────
header "Traffic keeps coming — watch the circuit trip"
info "Circuit opens when >60% of requests fail (after at least 5 requests)."
for i in $(seq 1 20); do
  meta=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" -X POST "$BASE/fetch?source=digid" \
    -H "Content-Type: application/json" -d '{"userId":"user-42"}')
  code=${meta% *}
  st=$(state_of digid)
  if [[ "$code" == "200" ]]; then c=$GREEN; else c=$RED; fi
  printf "    request %2d → ${c}HTTP %s${RESET} ${DIM}%5s ms${RESET}   circuit: %b\n" "$i" "$code" "$(to_ms "${meta#* }")" "$(badge "$st")"
  [[ "$st" == "open" ]] && break
done
echo
show_circuits
if [[ "$(state_of digid)" == "open" ]]; then
  ok "Circuit tripped. DigiD is now isolated."
else
  bad "Circuit did not trip, so the rest of the demo will not behave as described."
  exit 1
fi
pause

# ── 5 ──────────────────────────────────────────────────────────────────
header "Fast-fail: no call reaches DigiD"
info "The breaker rejects immediately with a typed SOURCE_UNAVAILABLE error."
info "No retries, no timeouts, no extra load on a struggling upstream. Note the latency."
fetch digid user-42
pause

# ── 6 ──────────────────────────────────────────────────────────────────
header "Partial degradation: iDIN still works, /ready stays 200"
fetch idin user-42
cmd "curl $BASE/ready"
echo -e "  ${BOLD}/ready → HTTP $(curl -s -o /dev/null -w '%{http_code}' "$BASE/ready")${RESET}"
info "/ready only returns 503 when ALL circuits are open, so ECS keeps routing traffic."
pause

# ── 7 ──────────────────────────────────────────────────────────────────
header "Waiting for resetTimeout (10 s) → half-open"
info "After resetTimeout the breaker lets ONE probe request through."
for i in $(seq 1 20); do
  st=$(state_of digid)
  printf "\r    %2ds   DigiD circuit: %b   " "$i" "$(badge "$st")"
  [[ "$st" == "half-open" ]] && break
  sleep 1
done
echo
if [[ "$st" == "half-open" ]]; then
  ok "Circuit is half-open: the next request is a probe."
else
  bad "Circuit did not reach half-open."
fi
pause

# ── 8 ──────────────────────────────────────────────────────────────────
header "DigiD recovers upstream"
set_upstream digid healthy
pause

# ── 9 ──────────────────────────────────────────────────────────────────
header "Probe request succeeds → circuit closes"
fetch digid user-42
show_circuits
pause

# ── 10 ─────────────────────────────────────────────────────────────────
header "Normal operation resumed"
fetch digid user-42

echo
echo -e "${GREEN}${BOLD}  Demo complete · closed → open → half-open → closed${RESET}"
echo
