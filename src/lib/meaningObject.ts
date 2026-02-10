import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

// ─── Meaning JSON v1 Schema ───

export const MeaningJsonV1Schema = z.object({
  version: z.literal('v1'),
  type: z.enum(['TASK', 'GOAL', 'IDEA', 'BRAIN_MESSAGE', 'PLAN', 'MESSAGE']),
  intent: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().optional(),
  constraints: z.record(z.unknown()).optional(),
  metadata: z.object({
    created_from: z.enum(['user', 'brain']).optional(),
    confidence: z.number().min(0).max(1).optional(),
    source: z.string().optional(),
    source_message_id: z.string().optional(),
    source_thread_id: z.string().optional(),
  }).optional(),
});

// ─── Meaning JSON v2 Schema (Additive Extension) ───

export const MeaningJsonV2Schema = z.object({
  version: z.literal('v2'),
  type: z.enum(['TASK', 'GOAL', 'IDEA', 'BRAIN_MESSAGE', 'PLAN', 'MESSAGE']),
  intent: z.enum(['create', 'complete', 'discuss', 'decide', 'plan', 'block', 'communicate']),
  subject: z.string().min(1),
  description: z.string().optional(),
  actors: z.array(z.string()).optional(),
  time: z.object({
    created_at: z.string().optional(),
    due_at: z.string().optional(),
    completed_at: z.string().nullable().optional(),
  }).optional(),
  state: z.enum(['open', 'in_progress', 'blocked', 'done']).optional(),
  links: z.object({
    from_message_id: z.string().optional(),
    to_goal_id: z.string().optional(),
    from_thread_id: z.string().optional(),
  }).optional(),
  signals: z.object({
    urgency: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
  metadata: z.object({
    created_from: z.enum(['user', 'brain']).optional(),
    source: z.string().optional(),
    source_message_id: z.string().optional(),
    source_thread_id: z.string().optional(),
  }).optional(),
});

// Union schema — accepts both v1 and v2
export const MeaningJsonSchema = z.discriminatedUnion('version', [
  MeaningJsonV1Schema,
  MeaningJsonV2Schema,
]);

export type MeaningJsonV1 = z.infer<typeof MeaningJsonV1Schema>;
export type MeaningJsonV2 = z.infer<typeof MeaningJsonV2Schema>;
export type MeaningJson = MeaningJsonV1 | MeaningJsonV2;

/**
 * Detect meaning version from a meaning_json object.
 */
export function getMeaningVersion(meaningJson: unknown): 'v1' | 'v2' | 'unknown' {
  if (typeof meaningJson === 'object' && meaningJson !== null && 'version' in meaningJson) {
    const v = (meaningJson as any).version;
    if (v === 'v1') return 'v1';
    if (v === 'v2') return 'v2';
  }
  return 'unknown';
}

/**
 * Validate meaning JSON (any version).
 */
export function validateMeaning(meaningJson: unknown): boolean {
  return MeaningJsonSchema.safeParse(meaningJson).success;
}

// ─── Helper: build a v1 meaning from user text ───

export function buildMeaningFromText(params: {
  type: MeaningJsonV1['type'];
  title: string;
  description?: string;
  createdFrom?: 'user' | 'brain';
}): MeaningJsonV1 {
  return {
    version: 'v1',
    type: params.type,
    intent: params.type === 'TASK' ? 'create' :
            params.type === 'GOAL' ? 'plan' :
            params.type === 'PLAN' ? 'plan' :
            params.type === 'IDEA' ? 'discuss' :
            params.type === 'MESSAGE' ? 'communicate' : 'discuss',
    subject: params.title,
    description: params.description,
    metadata: {
      created_from: params.createdFrom || 'user',
    },
  };
}

// ─── Create Meaning Object ───

export async function createMeaningObject(params: {
  workspaceId: string;
  createdBy: string;
  type: MeaningJsonV1['type'];
  sourceLang: string;
  meaningJson: MeaningJsonV1;
}): Promise<string | null> {
  // Validate
  const parsed = MeaningJsonV1Schema.safeParse(params.meaningJson);
  if (!parsed.success) {
    console.error('[ULL] Invalid meaning JSON:', parsed.error.flatten());
    return null;
  }

  const { data, error } = await supabase
    .from('meaning_objects')
    .insert({
      workspace_id: params.workspaceId,
      created_by: params.createdBy,
      type: params.type.toLowerCase(),
      source_lang: params.sourceLang,
      meaning_json: parsed.data as any,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ULL] Failed to create meaning object:', error.message);
    return null;
  }

  return data.id;
}

// ─── Update Meaning Object ───

export async function updateMeaningObject(params: {
  meaningObjectId: string;
  meaningJson: MeaningJsonV1;
}): Promise<boolean> {
  const parsed = MeaningJsonV1Schema.safeParse(params.meaningJson);
  if (!parsed.success) {
    console.error('[ULL] Invalid meaning JSON for update:', parsed.error.flatten());
    return false;
  }

  const { error } = await supabase
    .from('meaning_objects')
    .update({ meaning_json: parsed.data as any })
    .eq('id', params.meaningObjectId);

  if (error) {
    console.error('[ULL] Failed to update meaning object:', error.message);
    return false;
  }

  return true;
}
