import { createClient } from '@supabase/supabase-js';

// Add your Supabase URL and anon key here
const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and anon key are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Place {
  id: string;
  name: string;
  jpname?: string;
  loc?: string;
  img?: string;
  info?: string;
  map?: string;
}

export interface Type {
  id: string;
  name: string;
}

export interface Tran {
  id: string;
  time: string;
  stay?: number;
  name: string;
  info?: string;
  type: 'tran';
}

export interface Plan {
  time: string;
  stay?: number;
  tid: string;
  pid: string;
  info?: string;
  type: 'plan';
  place: Place;
}

export type TimelineItem = Plan | Tran;

export const getTimeline = async (): Promise<TimelineItem[]> => {
  const { data: plans, error: planError } = await supabase
    .from('plan')
    .select(`
      time,
      stay,
      tid,
      pid,
      info,
      place:place(
        id,
        name,
        jpname,
        loc,
        img,
        info,
        map
      )
    `);

  if (planError) {
    console.error('Error fetching plans:', planError);
    return [];
  }

  const { data: trans, error: tranError } = await supabase
    .from('tran')
    .select('*');

  if (tranError) {
    console.error('Error fetching trans:', tranError);
    return [];
  }

  const timeline: TimelineItem[] = [
    ...plans.map(p => ({ ...p, type: 'plan' as const })),
    ...trans.map(t => ({ ...t, type: 'tran' as const })),
  ];

  timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return timeline;
};

// Update a plan row (identified by tid, pid, and original time) with new values.
// Note: We match on the original time to uniquely identify the row before changing it.
export const updatePlan = async (
  original:
    | { tid: string; pid: string; time: string }
    | Pick<Plan, 'tid' | 'pid' | 'time'>,
  updates: { time?: string; stay?: number | null; info?: string | null }
): Promise<void> => {
  const { error } = await supabase
    .from('plan')
    .update({ ...updates })
    .match({ tid: original.tid, pid: original.pid, time: original.time });

  if (error) {
    console.error('Error updating plan:', error);
    throw error;
  }
};

// Update a tran row by id with new values.
export const updateTran = async (
  original: { id: string } | Pick<Tran, 'id'>,
  updates: { time?: string; stay?: number | null; info?: string | null }
): Promise<void> => {
  const { error } = await supabase
    .from('tran')
    .update({ ...updates })
    .match({ id: original.id });

  if (error) {
    console.error('Error updating tran:', error);
    throw error;
  }
};
