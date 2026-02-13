#!/bin/bash
#
# ULL Compliance Regression Check
# ================================
# Prevents inserts into meaning-protected tables without meaning_object_id.
# Run in CI or pre-commit to catch violations early.
#
# Protected tables: tasks, goals, ideas, brain_messages, plans, chat_messages
#
# Exit codes:
#   0 = No violations found
#   1 = Potential ULL violation detected

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

VIOLATIONS=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ULL Compliance Regression Check v1.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1) Check that meaningGuard.ts protects all required tables
GUARD_FILE="src/lib/meaningGuard.ts"
REQUIRED_TABLES=("tasks" "goals" "ideas" "brain_messages" "plans" "chat_messages")

echo "▶ Checking meaningGuard.ts covers all protected tables..."
for table in "${REQUIRED_TABLES[@]}"; do
  if ! grep -q "'${table}'" "$GUARD_FILE" 2>/dev/null; then
    echo -e "  ${RED}✗ Table '${table}' NOT found in MEANING_PROTECTED_TABLES${NC}"
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    echo -e "  ${GREEN}✓ ${table}${NC}"
  fi
done
echo ""

# 2) Check insert paths include guardMeaningInsert call
echo "▶ Checking insert paths for guardMeaningInsert usage..."

# Find all .ts/.tsx files that insert into protected tables
for table in "${REQUIRED_TABLES[@]}"; do
  FILES=$(grep -rl "from('${table}').*\.insert\|from(\"${table}\").*\.insert" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
  
  if [ -n "$FILES" ]; then
    while IFS= read -r file; do
      if ! grep -q "guardMeaningInsert" "$file" 2>/dev/null; then
        echo -e "  ${RED}✗ ${file} inserts into '${table}' WITHOUT guardMeaningInsert${NC}"
        VIOLATIONS=$((VIOLATIONS + 1))
      else
        echo -e "  ${GREEN}✓ ${file} → ${table}${NC}"
      fi
    done <<< "$FILES"
  fi
done
echo ""

# 3) Check for raw .insert({ title: patterns without meaning_object_id nearby
echo "▶ Scanning for suspicious insert patterns..."

SUSPECT_PATTERNS=(
  "\.insert({[^}]*title:"
  "\.insert({[^}]*content:"
)

for pattern in "${SUSPECT_PATTERNS[@]}"; do
  MATCHES=$(grep -rn "$pattern" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "meaning_object_id" | grep -v "node_modules" | grep -v ".test." || true)
  
  if [ -n "$MATCHES" ]; then
    echo -e "  ${YELLOW}⚠ Suspicious inserts without meaning_object_id nearby:${NC}"
    echo "$MATCHES" | while IFS= read -r line; do
      echo -e "    ${YELLOW}${line}${NC}"
    done
    # Warning only — manual review needed
  fi
done
echo ""

# 4) Check ULLText usage for content rendering
echo "▶ Verifying ULLText usage in content-rendering pages..."

CONTENT_PAGES=(
  "src/pages/workboard/UnifiedTasksPage.tsx"
  "src/pages/brain/TeamTasksPage.tsx"
  "src/pages/brain/TodayPage.tsx"
  "src/pages/brain/GoalsPage.tsx"
  "src/pages/workboard/WorkboardGoalsPage.tsx"
  "src/pages/workboard/WorkboardBrainstormPage.tsx"
  "src/pages/workboard/WorkboardCalendarPage.tsx"
  "src/components/workboard/TaskCard.tsx"
  "src/components/checkin/StepGoalReview.tsx"
)

for page in "${CONTENT_PAGES[@]}"; do
  if [ -f "$page" ]; then
    if grep -q "ULLText" "$page" 2>/dev/null; then
      echo -e "  ${GREEN}✓ ${page}${NC}"
    else
      echo -e "  ${RED}✗ ${page} does NOT use ULLText${NC}"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  else
    echo -e "  ${YELLOW}⚠ ${page} not found (skipped)${NC}"
  fi
done
echo ""

# 5) Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $VIOLATIONS -eq 0 ]; then
  echo -e "  ${GREEN}✅ ULL COMPLIANCE CHECK PASSED${NC}"
  echo "  No violations detected."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo -e "  ${RED}❌ ULL COMPLIANCE CHECK FAILED${NC}"
  echo "  ${VIOLATIONS} violation(s) detected."
  echo "  Fix all violations before merging."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
