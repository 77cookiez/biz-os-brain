
# Phase 2.1 -- Brain Hardening: 6 Critical Fixes

## Summary

Six targeted fixes to close security gaps, eliminate UI artifact leaks, and improve reliability in the Brain orchestrator. No UI component changes. No new database tables.

## Fix A: Server-Side Installed Apps (Security)

**Problem**: The edge function trusts `installedApps` from the client request, allowing a user to inject app IDs (e.g., `leadership`, `booking`) and see actions/prompt sections for apps they haven't installed.

**Solution**: In `brain-chat/index.ts`, when `workspaceId` is present, fetch installed apps from `workspace_apps` table using the service-role client. Ignore the client-sent `installedApps` entirely.

**File**: `supabase/functions/brain-chat/index.ts`
- Add `fetchInstalledApps(sb, workspaceId)` function that queries `workspace_apps` where `is_active = true`
- In the main handler (line ~923), replace `const installedAppIds = installedApps || ["brain"]` with the server-fetched list
- Always include `"brain"` as a core module
- Fallback to `["brain"]` if no workspaceId or fetch fails

## Fix B: Intent Override from Capability Buttons

**Problem**: When user clicks a capability button like "Architect" (intent: `architect`), only `action: "strategic_analysis"` is sent. The classifier may return a different intent based on the prompt text, defeating the purpose of intent-based buttons.

**Solution**: 
1. In `src/hooks/useBrainChat.ts`: Update `sendMessage` signature to accept `intentOverride?: string`. Send it in the request payload.
2. In `src/hooks/useSmartCapabilities.ts`: No changes needed -- the `intent` field already exists on capabilities.
3. The caller (BrainPage or ChatPanel) will pass `capability.intent` as `intentOverride` when a capability button is clicked.
4. In `brain-chat/index.ts`: Accept `intentOverride` in `ChatRequest`. If present and valid, skip the classifier and use it directly (with confidence 0.95 and appropriate defaults).

**Files**: `supabase/functions/brain-chat/index.ts`, `src/hooks/useBrainChat.ts`

## Fix C: Extract BRAIN_PROPOSALS from Display

**Problem**: The prompt instructs the model to output a ` ```BRAIN_PROPOSALS ``` ` block, but `useBrainChat.ts` only strips `BRAIN_META`. The raw JSON proposals block will appear in the chat UI.

**Solution**: Create a unified `extractBrainArtifacts()` function that returns `{ cleanText, meta, proposals }`:
- Add `BRAIN_PROPOSALS_REGEX` similar to `BRAIN_META_REGEX`
- Strip both blocks from display text
- Parse proposals into `BrainProposal[]` (using the existing interface from `useBrainExecute.ts`)
- Store proposals in component state (`lastProposals`)
- Expose `lastProposals` from the hook for downstream use (ProposalCard rendering, sign/execute flow)
- Apply stripping both during streaming (real-time) and after final flush

**File**: `src/hooks/useBrainChat.ts`

## Fix D: Standardize org_events Schema for BRAIN_META

**Problem**: The `logBrainMeta` function uses `event_type` and `object_type` but should follow a consistent contract for OIL ingestion.

**Solution**: Ensure the org_events insert uses:
```
event_type: 'brain_meta'
object_type: 'brain_message'
metadata: { ...BrainMeta }
```

This is already correct in the current code. The fix is to document and add the optional `object_id` field if a `brain_message` ID is available. Since message persistence happens async and we don't wait for its ID, we'll skip `object_id` for now but add a comment noting the intent.

**File**: `src/hooks/useBrainChat.ts` (minor comment addition)

## Fix E: SSE Parser Robustness (Monitoring Note)

**Problem**: The current parser splits on `\n` which works for most SSE but can fail if gateways send multi-line data fields or split JSON across chunks.

**Solution**: Add a defensive improvement -- when `JSON.parse` fails, instead of pushing the line back and breaking immediately, accumulate across boundaries. Specifically:
- Track incomplete SSE events using `\n\n` as event boundary awareness
- The current fallback (push line back + break) is adequate for now
- Add a comment documenting the limitation and monitoring point
- No major rewrite needed unless issues are observed

**File**: `supabase/functions/brain-chat/index.ts` (no change -- this is a monitoring note only)

## Fix F: Prompt Size Optimization

**Problem**: The system prompt is very large (~800+ lines when fully expanded), increasing token costs and potentially reducing response quality.

**Solution**: Convert verbose prose sections into compact structured JSON where possible:
- Convert `WORKBOARD SNAPSHOT` from prose listing to a compact JSON summary
- Convert `AVAILABLE ACTIONS` from verbose descriptions to a compact JSON array
- Convert `PASSIVE INSIGHTS` from verbose listings to a compact JSON array
- Keep `CORE IDENTITY`, `GUARDRAILS`, and `OUTPUT CONTRACTS` as prose (these need natural language for the model)
- Estimated reduction: ~30-40% fewer prompt tokens

**File**: `supabase/functions/brain-chat/index.ts`

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/brain-chat/index.ts` | Fix A (server-side apps), Fix B (intentOverride), Fix F (compact prompt) |
| `src/hooks/useBrainChat.ts` | Fix B (send intentOverride), Fix C (extract BRAIN_PROPOSALS), Fix D (schema comment) |

## No Changes Needed

- `src/hooks/useSmartCapabilities.ts` -- already has `intent` field on capabilities
- No database migrations
- No UI component changes
- No new edge functions

## Verification Checklist

1. Brain chat still streams responses correctly
2. BRAIN_META is stripped from UI display
3. BRAIN_PROPOSALS is stripped from UI display and stored in state
4. Capability buttons with `intent` field produce consistent behavior (no classifier override)
5. Installed apps are fetched server-side, not trusted from client
6. Prompt token count is reduced compared to current version
