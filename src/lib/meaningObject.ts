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
  }).optional(),
});

export type MeaningJsonV1 = z.infer<typeof MeaningJsonV1Schema>;

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
