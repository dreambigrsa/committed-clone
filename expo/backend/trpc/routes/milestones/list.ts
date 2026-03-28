import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { supabase } from '@/lib/supabase';

export const listMilestonesProcedure = protectedProcedure
  .input(
    z.object({
      relationshipId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const { relationshipId } = input;
    const userId = ctx.user.id;

    const { data: relationship } = await supabase
      .from('relationships')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    if (
      relationship.user_id !== userId &&
      relationship.partner_user_id !== userId
    ) {
      throw new Error('Not authorized');
    }

    const { data: milestones, error } = await supabase
      .from('relationship_milestones')
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('date', { ascending: true });

    if (error) throw error;

    return milestones || [];
  });
