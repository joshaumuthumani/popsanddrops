#!/usr/bin/env bash
# graphify-gate.sh — assert knowledge-graph freshness at an exact commit.
#
# Usage: graphify-gate.sh <expected-sha>
#   CI:     graphify-gate.sh "${{ github.event.pull_request.head.sha }}"
#   Pre-PR: graphify-gate.sh "$(git rev-parse HEAD)"
#
# Requires only: graphify (pinned), jq, git. No API key, no network, no local
# model — the code layer is pure AST, which is why this runs on a fresh clone.
#
# Why this asserts built_at_commit and never the exit code: `graphify update`
# exits 0 on a no-op, so `run graphify && pass` is a false gate.
set -euo pipefail

EXPECTED="${1:?usage: graphify-gate.sh <expected-sha>}"
REC="docs/graphify.json"

if [ ! -f "$REC" ]; then
  echo "::error::$REC missing — repository is unclassified for Graphify (Stage 1 retrofit required)"
  exit 1
fi

STATUS=$(jq -r '.status // "missing"' "$REC")
REASON=$(jq -r '.skip_reason // ""' "$REC")

if [ "$STATUS" = "skipped" ]; then
  if [ -z "$REASON" ] || [ "$REASON" = "null" ]; then
    echo "::error::status=skipped with no skip_reason — undeclared skip"
    exit 1
  fi
  echo "graphify N/A — skip_reason: $REASON"
  exit 0
fi

if [ "$STATUS" != "enabled" ]; then
  echo "::error::unrecognised status '$STATUS' (expected enabled|skipped)"
  exit 1
fi

# Refresh the code layer. Never add --force: it masks genuine corpus collapse.
graphify extract . --code-only --update

GRAPH="graphify-out/graph.json"
if [ ! -f "$GRAPH" ]; then
  echo "::error::$GRAPH missing after refresh — extraction produced no graph"
  exit 1
fi

BUILT=$(jq -r '.built_at_commit // ""' "$GRAPH")
NODES=$(jq '.nodes | length' "$GRAPH")
PREV=$(jq -r '.last_refresh.nodes // 0' "$REC")

if [ "$BUILT" != "$EXPECTED" ]; then
  echo "::error::graph stale — built_at_commit=$BUILT != head=$EXPECTED"
  exit 1
fi

if [ "$NODES" -eq 0 ]; then
  echo "::error::graph has 0 nodes; if this repo has no code corpus, declare status=skipped with skip_reason=no_code_corpus"
  exit 1
fi

# Drift guard: Graphify's own shrink guard does not catch this.
if [ "$PREV" -gt 0 ] && [ "$NODES" -lt $(( PREV * 9 / 10 )) ]; then
  JUST=$(jq -r '.drift_justification // ""' "$REC")
  if [ -z "$JUST" ] || [ "$JUST" = "null" ]; then
    echo "::error::node count collapsed $PREV -> $NODES (>10%) with no drift_justification"
    exit 1
  fi
  echo "drift accepted: $JUST ($PREV -> $NODES)"
fi

echo "graphify FRESH at $BUILT — $NODES nodes (prev $PREV)"
