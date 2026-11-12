#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:3000"
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}==> $1${RESET}"; }
info()   { echo -e "${YELLOW}    $1${RESET}"; }
ok()     { echo -e "${GREEN}    $1${RESET}"; }

header "STEP 1 — Healthy fetch from DigiD"
info "Both circuits closed. Expecting 200 with income data."
curl -s -X POST "$BASE/fetch?source=digid" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-42"}' | python3 -m json.tool
ok "Circuit is: $(curl -s $BASE/health | python3 -m json.tool)"

header "STEP 2 — Toggle DigiD to FLAKY"
info "70% of DigiD calls will now fail with a transient error."
curl -s -X POST "$BASE/control" \
  -H "Content-Type: application/json" \
  -d '{"source":"digid","state":"flaky"}' | python3 -m json.tool

header "STEP 3 — Fire 8 rapid requests to trip the circuit"
info "Circuit trips when failure rate > 60% over 5+ requests."
for i in $(seq 1 8); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/fetch?source=digid" \
    -H "Content-Type: application/json" \
    -d '{"userId":"user-42"}')
  echo -e "    Request $i → HTTP $STATUS"
done

header "STEP 4 — Circuit state after failures"
info "Expecting digid: open"
curl -s "$BASE/health" | python3 -m json.tool

header "STEP 5 — Fast-fail: request is rejected instantly without hitting DigiD"
info "No network call to DigiD — SOURCE_UNAVAILABLE returned immediately."
curl -s -X POST "$BASE/fetch?source=digid" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-42"}' | python3 -m json.tool

header "STEP 6 — Readiness probe while DigiD is open"
info "iDIN is still closed, so /ready stays 200 (partial degradation)."
curl -s -o /dev/null -w "    /ready → HTTP %{http_code}\n" "$BASE/ready"

header "STEP 7 — Waiting 11 seconds for circuit to move to half-open..."
sleep 11
info "resetTimeout (10s) elapsed. Circuit should be half-open."
curl -s "$BASE/health" | python3 -m json.tool

header "STEP 8 — First probe request in half-open state"
info "Toggle DigiD back to healthy so the probe succeeds."
curl -s -X POST "$BASE/control" \
  -H "Content-Type: application/json" \
  -d '{"source":"digid","state":"healthy"}' | python3 -m json.tool

curl -s -X POST "$BASE/fetch?source=digid" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-42"}' | python3 -m json.tool

header "STEP 9 — Circuit recovered: back to closed"
info "Probe succeeded — circuit closes, normal operation resumes."
curl -s "$BASE/health" | python3 -m json.tool

echo -e "\n${GREEN}${BOLD}Demo complete. Circuit lifecycle: closed → open → half-open → closed${RESET}\n"
