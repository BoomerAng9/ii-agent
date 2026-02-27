#!/usr/bin/env bash
#
# Apply the ii-agent separation to the AIMS repo.
#
# Usage:
#   cd /path/to/AIMS
#   bash /path/to/ii-agent/integrations/aims/apply-to-aims.sh
#
# What this does:
#   1. Removes the embedded backend/ii-agent/ directory
#   2. Copies the updated UEF Gateway client (raw WebSocket protocol)
#   3. Updates stack.json to reference external repo
#   4. Shows what Docker Compose changes you need to make
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AIMS_DIR="$(pwd)"

# Verify we're in the AIMS repo
if [ ! -f "$AIMS_DIR/AIMS_MASTER_PLAN.md" ] && [ ! -d "$AIMS_DIR/backend/uef-gateway" ]; then
  echo "ERROR: Run this from the AIMS repo root."
  echo "  cd /path/to/AIMS && bash $0"
  exit 1
fi

echo "=== Removing embedded ii-agent from AIMS ==="

# 1. Remove embedded copy
if [ -d "$AIMS_DIR/backend/ii-agent" ]; then
  SIZE=$(du -sh "$AIMS_DIR/backend/ii-agent" | cut -f1)
  rm -rf "$AIMS_DIR/backend/ii-agent"
  echo "✓ Deleted backend/ii-agent/ ($SIZE freed)"
else
  echo "✓ backend/ii-agent/ already removed"
fi

# 2. Copy updated UEF Gateway client
if [ -f "$SCRIPT_DIR/aims-uef-client.ts" ]; then
  cp "$SCRIPT_DIR/aims-uef-client.ts" "$AIMS_DIR/backend/uef-gateway/src/ii-agent/client.ts"
  echo "✓ Updated UEF Gateway client (raw WebSocket protocol)"
fi

# 3. Update stack.json
if [ -f "$AIMS_DIR/.aims/stack.json" ]; then
  # Use node if available, otherwise sed
  if command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const stack = JSON.parse(fs.readFileSync('.aims/stack.json', 'utf8'));
      if (stack.services?.iiAgent) {
        stack.services.iiAgent = {
          purpose: 'Autonomous execution engine (external service)',
          repo: 'https://github.com/BoomerAng9/ii-agent',
          connection: 'ws://ii-agent:8000/ws'
        };
        fs.writeFileSync('.aims/stack.json', JSON.stringify(stack, null, 2) + '\n');
        console.log('✓ Updated .aims/stack.json');
      }
    "
  else
    echo "⚠ Manually update .aims/stack.json — remove path, add repo URL"
  fi
fi

echo ""
echo "=== Docker Compose Update Required ==="
echo ""
echo "In infra/docker-compose.prod.yml, update the ii-agent service:"
echo ""
echo "  1. Change build context to use II_AGENT_REPO_PATH:"
echo "       build:"
echo "         context: \${II_AGENT_REPO_PATH:?Set II_AGENT_REPO_PATH}"
echo "         dockerfile: docker/backend/Dockerfile"
echo ""
echo "  2. Remove ii-agent-postgres, ii-agent-tools, ii-agent-sandbox services"
echo "     (ii-agent manages its own infrastructure)"
echo ""
echo "  3. Set the env var when running:"
echo "       git clone https://github.com/BoomerAng9/ii-agent.git /opt/ii-agent"
echo "       II_AGENT_REPO_PATH=/opt/ii-agent docker compose -f infra/docker-compose.prod.yml up"
echo ""
echo "=== Done ==="
