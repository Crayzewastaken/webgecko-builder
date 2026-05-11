#!/bin/bash
# Run after committing changes to app/admin/page.tsx
# Usage: bash scripts/update-ui-history.sh "Description of what changed"

DESCRIPTION="${1:-Updated admin dashboard}"
LINES=$(wc -l < app/admin/page.tsx 2>/dev/null || echo 0)
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DATE=$(date +%Y-%m-%d)
VERSION="v$(node -e "const h=require('./lib/ui-history.json');console.log(h.length+1)" 2>/dev/null || echo "?")"

node -e "
const fs = require('fs');
const h = JSON.parse(fs.readFileSync('lib/ui-history.json','utf8'));
h.push({ version: '$VERSION', date: '$DATE', commit: '$COMMIT', lines: $LINES, description: '$DESCRIPTION', type: 'feat' });
fs.writeFileSync('lib/ui-history.json', JSON.stringify(h, null, 2));
console.log('Added', '$VERSION', 'to ui-history.json');
"
