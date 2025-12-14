import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { supabase } from '@/lib/supabase';

export const confirmEndRelationshipProcedure = protectedProcedure
  .input(
    z.object({
      disputeId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { disputeId } = input;
    const userId = ctx.user.id;

    const { data: dispute } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .single();

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    await supabase
      .from('disputes')
      .update({
        status: 'resolved',
        resolution: 'confirmed',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', disputeId);

    await supabase
      .from('relationships')
      .update({
        status: 'ended',
        end_date: new Date().toISOString(),
      })
      .eq('id', dispute.relationship_id);

    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'end_relationship_confirmed',
      resource_type: 'relationship',
      resource_id: dispute.relationship_id,
    });

    return { success: true };
  });
