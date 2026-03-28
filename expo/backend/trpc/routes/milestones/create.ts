import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { supabase } from '@/lib/supabase';

export const createMilestoneProcedure = protectedProcedure
  .input(
    z.object({
      relationshipId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      date: z.string(),
      category: z.enum([
        'first_date',
        'first_kiss',
        'engagement',
        'marriage',
        'anniversary',
        'moved_in',
        'other',
      ]),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { relationshipId, title, description, date, category } = input;
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

    const { data: milestone, error } = await supabase
      .from('relationship_milestones')
      .insert({
        relationship_id: relationshipId,
        title,
        description,
        date,
        category,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return milestone;
  });
