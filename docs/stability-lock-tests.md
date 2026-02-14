# Stability Lock — Test Plan v1.2.1

> Copy/paste ready. Fill in the CONFIG variables, then run each test sequentially.

## Prerequisites

```bash
# ====== CONFIG ======
export SUPABASE_URL="https://rsyzalwcrccuctnpwudi.supabase.co"
export WORKSPACE_B_ID="PUT_WORKSPACE_B_UUID_HERE"
export USER_A_TOKEN="PUT_USER_A_JWT_HERE"   # NOT a member of WORKSPACE_B_ID
export USER_B_TOKEN="PUT_USER_B_JWT_HERE"   # member/owner of WORKSPACE_B_ID
```

---

## A. Oil-Ingest Cross-Tenant Guard

### Test 1: Existing workspace, NON-member → 403

```bash
curl -s -i -X POST "$SUPABASE_URL/functions/v1/oil-ingest" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\":\"$WORKSPACE_B_ID\",\"events\":[{\"event_type\":\"test\",\"object_type\":\"test\",\"metadata\":{\"case\":\"non_member\"}}]}"
```

**Expected:** `HTTP 403` — `{"error":"Not authorized for this workspace"}`

**DB Check (must return 0):**

```sql
SELECT count(*) FROM org_events
WHERE workspace_id = '<WORKSPACE_B_ID>'
  AND created_at > now() - interval '5 minutes'
  AND metadata->>'case' = 'non_member';
```

### Test 2: Existing workspace, MEMBER → 200

```bash
curl -s -i -X POST "$SUPABASE_URL/functions/v1/oil-ingest" \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\":\"$WORKSPACE_B_ID\",\"events\":[{\"event_type\":\"test\",\"object_type\":\"test\",\"metadata\":{\"case\":\"member\"}}]}"
```

**Expected:** `HTTP 200` — `{"ingested":1}` (or equivalent success response)

**DB Check (must return ≥ 1):**

```sql
SELECT count(*) FROM org_events
WHERE workspace_id = '<WORKSPACE_B_ID>'
  AND created_at > now() - interval '5 minutes'
  AND metadata->>'case' = 'member';
```

### Test 3: Non-existent workspace → 404

```bash
curl -s -i -X POST "$SUPABASE_URL/functions/v1/oil-ingest" \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\":\"00000000-0000-0000-0000-000000000000\",\"events\":[{\"event_type\":\"test\",\"object_type\":\"test\"}]}"
```

**Expected:** `HTTP 404` — `{"error":"Workspace not found"}`

---

## B. Brain Execute-Action Idempotency (Reservation-First)

### Test 4: First execution → 200

```bash
curl -s -i -X POST "$SUPABASE_URL/functions/v1/brain-execute-action" \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"execute","workspace_id":"'"$WORKSPACE_B_ID"'","proposal":{"id":"test-idempotency-001","type":"task","title":"Idempotency test","payload":{"description":"Testing duplicate prevention"},"required_role":"member","confirmation_hash":"<VALID_HASH>","expires_at":<VALID_EXPIRY>}}'
```

**Expected:** `HTTP 200` — `{"success":true,"result":{"type":"task","id":"..."}}`

### Test 5: Same proposal again → 409

Re-send the exact same request from Test 4.

**Expected:** `HTTP 409` — `{"code":"ALREADY_EXECUTED","reason":"This proposal has already been executed"}`

**DB Check:**

```sql
SELECT proposal_id, entity_type, entity_id
FROM executed_proposals
WHERE proposal_id = 'test-idempotency-001';
-- Should return exactly 1 row
```

---

## Event Schema Reference

Always use this shape for `oil-ingest` events (matches `org_events` table):

```json
{
  "event_type": "task_created",
  "object_type": "task",
  "metadata": { "source": "manual" }
}
```

Do **not** use `{"type":"revenue","value":100}` — that does not match the `org_events` schema.
