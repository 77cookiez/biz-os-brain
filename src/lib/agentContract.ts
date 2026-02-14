/**
 * Agent Contract — Defines the interface for specialized execution agents.
 *
 * Brain THINKS and DRAFTS only. Agents EXECUTE after user confirmation.
 * Flow: Ask → Plan → Dry-Run Preview → Confirm → Execute
 */

// ─── Draft Object Types ───

export type DraftType =
  | 'task'
  | 'goal'
  | 'plan'
  | 'idea'
  | 'update'
  | 'draft_plan'
  | 'draft_message'
  | 'draft_design_change'
  | 'draft_task_set';

export interface DraftObject {
  id: string;
  type: DraftType;
  title: string;
  description?: string;
  /** Which module this draft targets */
  target_module: string;
  /** The agent that should execute this draft */
  agent_type: AgentType;
  /** Structured payload for the agent */
  payload: Record<string, unknown>;
  /** Role required to execute */
  required_role: 'member' | 'admin' | 'owner';
  /** What the draft intends to do */
  intent: string;
  /** Affected entities (for preview) */
  scope: DraftScope;
  /** Known risks */
  risks: string[];
  /** Can this be rolled back? */
  rollback_possible: boolean;
  /** HMAC confirmation hash (set by server) */
  confirmation_hash?: string;
  /** Expiry timestamp (set by server) */
  expires_at?: number;
}

export interface DraftScope {
  /** Modules that will be affected */
  affected_modules: string[];
  /** Entities that will be created/modified/deleted */
  affected_entities: AffectedEntity[];
  /** Human-readable summary of impact */
  impact_summary: string;
}

export interface AffectedEntity {
  entity_type: string;
  entity_id?: string;
  action: 'create' | 'update' | 'delete';
  /** Field-level diff for updates */
  diff?: Record<string, { before: unknown; after: unknown }>;
}

// ─── Agent Types ───

export type AgentType =
  | 'teamwork'
  | 'chat'
  | 'bookivo'
  | 'brain'
  | 'oil';

// ─── Execution Request (Brain → Agent) ───

export interface ExecutionRequest {
  /** The signed draft to execute */
  draft: DraftObject;
  /** Workspace context */
  workspace_id: string;
  /** User who confirmed */
  confirmed_by: string;
  /** Timestamp of confirmation */
  confirmed_at: string;
}

// ─── Dry-Run Result (Agent → UI) ───

export interface DryRunResult {
  /** Can this be executed safely? */
  can_execute: boolean;
  /** Preview of what will happen */
  preview: DraftScope;
  /** Warnings that don't block execution */
  warnings: string[];
  /** Errors that block execution */
  errors: string[];
  /** Estimated execution time */
  estimated_duration_ms?: number;
}

// ─── Execute Result (Agent → System) ───

export interface ExecuteResult {
  success: boolean;
  /** Created/modified entity references */
  entities: { type: string; id: string; action: string }[];
  /** Audit log reference */
  audit_log_id?: string;
  /** Error details if failed */
  error?: string;
}

// ─── Agent Contract Interface ───

export interface AgentContract {
  /** Unique agent identifier */
  agent_type: AgentType;
  /** Human-readable name */
  name: string;
  /** What this agent can execute */
  capabilities: AgentCapability[];
  /** Required permissions */
  required_permissions: string[];
}

export interface AgentCapability {
  /** Action key (e.g. 'create_task', 'update_theme') */
  key: string;
  /** Human-readable title */
  title: string;
  /** Description */
  description: string;
  /** Draft types this capability handles */
  handles_draft_types: DraftType[];
  /** Risk level */
  risk: 'low' | 'medium' | 'high';
}

// ─── Agent Registry ───

export const AGENT_REGISTRY: AgentContract[] = [
  {
    agent_type: 'teamwork',
    name: 'Teamwork Agent',
    capabilities: [
      {
        key: 'create_task',
        title: 'Create Task',
        description: 'Create a new task in the workboard',
        handles_draft_types: ['task', 'draft_task_set'],
        risk: 'low',
      },
      {
        key: 'create_goal',
        title: 'Create Goal',
        description: 'Create a new goal',
        handles_draft_types: ['goal'],
        risk: 'low',
      },
      {
        key: 'create_plan',
        title: 'Create Plan',
        description: 'Create a structured plan',
        handles_draft_types: ['plan', 'draft_plan'],
        risk: 'low',
      },
      {
        key: 'update_entity',
        title: 'Update Entity',
        description: 'Update task, goal, or plan fields',
        handles_draft_types: ['update'],
        risk: 'medium',
      },
    ],
    required_permissions: ['workspace_member'],
  },
  {
    agent_type: 'chat',
    name: 'Chat Agent',
    capabilities: [
      {
        key: 'draft_message',
        title: 'Draft Message',
        description: 'Draft a chat message for review',
        handles_draft_types: ['draft_message'],
        risk: 'low',
      },
    ],
    required_permissions: ['workspace_member'],
  },
  {
    agent_type: 'bookivo',
    name: 'Bookivo Agent',
    capabilities: [
      {
        key: 'apply_design',
        title: 'Apply Design Change',
        description: 'Apply theme tokens, colors, typography',
        handles_draft_types: ['draft_design_change'],
        risk: 'medium',
      },
    ],
    required_permissions: ['workspace_admin'],
  },
  {
    agent_type: 'brain',
    name: 'Brain Agent',
    capabilities: [
      {
        key: 'create_idea',
        title: 'Create Idea',
        description: 'Save an idea for later',
        handles_draft_types: ['idea'],
        risk: 'low',
      },
    ],
    required_permissions: ['workspace_member'],
  },
];

/**
 * Resolve which agent should handle a given draft type.
 */
export function resolveAgent(draftType: DraftType): AgentContract | null {
  for (const agent of AGENT_REGISTRY) {
    if (agent.capabilities.some(c => c.handles_draft_types.includes(draftType))) {
      return agent;
    }
  }
  return null;
}

/**
 * Check if a proposal is a legacy type (handled by existing brain-execute-action)
 * vs a new draft type that needs the agent pipeline.
 */
export function isLegacyProposalType(type: string): boolean {
  return ['task', 'goal', 'plan', 'idea', 'update'].includes(type);
}
