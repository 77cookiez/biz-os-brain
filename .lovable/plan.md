

# Surface OIL Outputs on Brain and Today Pages

## Overview

Currently, the Brain page and Today page don't display any OIL (Organizational Intelligence Layer) data. The OIL tables (`org_indicators`, `company_memory`) exist and are populated via events, but their outputs are invisible to users. This plan adds two new components that fetch and display OIL data in a calm, non-intrusive, human-first way.

## What Will Change

### 1. New Hook: `useOILIndicators`

A React Query hook that fetches data from `org_indicators` and `company_memory` tables for the current workspace. It returns:
- Core indicators (ExecutionHealth, DeliveryRisk, GoalProgress) with score, trend, and drivers
- Secondary indicators (FinancialPressure, TeamAlignment)
- Active company memory patterns (high-confidence statements)

This hook respects OIL settings (`useOILSettings`) -- if visibility is `minimal`, it returns empty data.

### 2. New Component: `OILPulseStrip`

A compact, single-row visual strip showing organizational health at a glance. Appears on both Brain (empty state) and Today pages.

- Shows 3 core indicator pills: each with a label, a small colored dot (green/amber/red based on score thresholds), and a subtle trend arrow
- Only renders if `show_indicator_strip` is enabled in OIL settings AND visibility is not `minimal`
- Clicking the strip navigates to `/insights` for deeper exploration
- No raw numbers shown to users -- uses semantic labels like "Steady", "Needs Attention", "Strong"

Visual style:
```text
[ Execution: Steady ^  |  Delivery Risk: Low v  |  Goals: On Track - ]
```

### 3. New Component: `OILInsightCard`

A dismissible card that surfaces one high-confidence company memory pattern when relevant. Follows the Daily Brief philosophy.

- Shows only ONE insight at a time (the highest confidence active memory)
- Uses calm, advisory language: "A pattern worth noting..." 
- Includes a brief explanation (the `statement` from company_memory)
- Dismiss button marks it as seen (local state, not persisted)
- Only appears when visibility is `balanced` or `proactive`
- Only appears if there is a memory with confidence >= 0.7

### 4. Brain Page Changes (`BrainPage.tsx`)

In the empty state (before any messages), add:
- `OILPulseStrip` below the capability cards -- gives the user organizational context before they start a conversation
- `OILInsightCard` below the pulse strip if a relevant pattern exists

In the context strip (existing `ContextStrip` component), add indicator status dot showing overall health color.

### 5. Today Page Changes (`TodayPage.tsx`)

- Add `OILPulseStrip` between the greeting and the Weekly Digest Card -- first thing users see is a calm organizational health summary
- Add `OILInsightCard` after the insights grid (overdue/blocked/completion) -- surfaces actionable company memory when relevant
- Add `DecisionSuggestions` component (already exists) below OIL insight -- the "Worth a Look" patterns

### 6. Translation Keys

Add new i18n keys to all 5 language files (en, ar, fr, es, de):
- `oil.pulse.executionHealth`, `oil.pulse.deliveryRisk`, `oil.pulse.goalProgress`
- `oil.pulse.steady`, `oil.pulse.needsAttention`, `oil.pulse.strong`, `oil.pulse.low`, `oil.pulse.onTrack`
- `oil.pulse.trendUp`, `oil.pulse.trendDown`, `oil.pulse.trendStable`
- `oil.insight.title`, `oil.insight.patternNoticed`, `oil.insight.dismiss`

## Design Principles

- **Non-intrusive**: All OIL surfaces are optional, dismissible, and gated by settings
- **No raw numbers**: Scores are converted to human-readable labels
- **Calm tone**: No alarm language, no urgency unless thresholds are crossed
- **Settings-aware**: Respects `insights_visibility`, `show_indicator_strip`, and `show_in_brain_only`
- **Leadership augmentation**: Surfaces blind spots gently without implying incompetence

## Technical Details

### Score-to-Label Mapping
| Score Range | Label | Color |
|---|---|---|
| 0-39 | Needs Attention | Red/Destructive |
| 40-69 | Steady | Amber/Orange |
| 70-100 | Strong | Green/Emerald |

### Trend Display
- `up` = small upward arrow icon
- `down` = small downward arrow icon  
- `stable` = dash icon

### Files to Create
- `src/hooks/useOILIndicators.ts`
- `src/components/oil/OILPulseStrip.tsx`
- `src/components/oil/OILInsightCard.tsx`

### Files to Modify
- `src/pages/brain/BrainPage.tsx` -- add OIL components to empty state
- `src/pages/brain/TodayPage.tsx` -- add OIL components to dashboard
- `src/i18n/translations/en.json` -- add oil keys
- `src/i18n/translations/ar.json` -- add oil keys
- `src/i18n/translations/fr.json` -- add oil keys
- `src/i18n/translations/es.json` -- add oil keys
- `src/i18n/translations/de.json` -- add oil keys

