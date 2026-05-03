import { createClient } from '@supabase/supabase-js';
import type { GoogleMapsJson } from './database/procress';

// Add your Supabase URL and anon key here
const supabaseUrl =
  import.meta.env.NEW_POSTGRES_DATABASE_SUPABASE_URL ??
  import.meta.env.NEXT_PUBLIC_NEW_POSTGRES_DATABASE_SUPABASE_URL ??
  import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.NEW_POSTGRES_DATABASE_SUPABASE_ANON_KEY ??
  import.meta.env.NEW_POSTGRES_DATABASE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key are required.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Place {
  id: string;
  // Stored columns
  google_maps_json?: GoogleMapsJson | null;
  info?: string;
  url?: string;
  // Derived (client-side) helpers for display
  name?: string;
  loc?: string; // "lat,lng"
  originalUrl?: string;
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
  url?: string;
  utc?: number;
  type: 'tran';
}

export interface Plan {
  time: string;
  stay?: number;
  tid: string;
  pid: string;
  info?: string;
  utc?: number;
  type: 'plan';
  // Resolved human-readable name for the plan type (from table `type` via `tid`).
  // Optional to avoid breaking existing callers when not fetched.
  typeName?: string;
  place: Place;
}

export type TimelineItem = Plan | Tran;

export const getPlaces = async (): Promise<Place[]> => {
  const { data, error } = await supabase
    .from('place')
    .select('id, google_maps_json, info, url');

  if (error) {
    console.error('Error fetching places:', error);
    return [];
  }

  const rows = (data ?? []) as any[];
  return rows.map((r) => {
    const p: Place = {
      id: r.id,
      google_maps_json: r.google_maps_json ?? null,
      info: r.info,
      url: r.url,
    };
    const gm = p.google_maps_json;
    if (gm) {
      if (gm.placeName) p.name = gm.placeName;
      if (gm.center && typeof gm.center.lat === 'number' && typeof gm.center.lng === 'number') {
        p.loc = `${gm.center.lat},${gm.center.lng}`;
      }
      if (gm.originalUrl) p.originalUrl = gm.originalUrl;
    }
    if (!p.name) p.name = String(p.id);
    return p;
  });
};

// Upload an image file to Supabase Storage ('media' bucket) and return its public URL and path.
// By default, uploads to path: `place/<placeId>/<timestamp>.<ext>`
export const uploadPlaceImage = async (
  file: File,
  placeId: string
): Promise<{ publicUrl: string; path: string }> => {
  if (!file) throw new Error('No file provided');
  if (!placeId) throw new Error('Place id is required to upload image');

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}.${ext}`;
  const path = `place/${placeId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${ext}`,
    });
  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from('media').getPublicUrl(path);
  const publicUrl = data.publicUrl;
  if (!publicUrl) {
    throw new Error('Failed to resolve public URL for uploaded image. Ensure the bucket is public or use signed URLs.');
  }
  return { publicUrl, path };
};

export const getTimeline = async (): Promise<TimelineItem[]> => {
  // Load plan rows with related place details
  const { data: plans, error: planError } = await supabase
    .from('plan')
    .select(`
      time,
      stay,
      tid,
      pid,
      info,
      utc,
      place:place(
        id,
        google_maps_json,
        info,
        url
      )
    `);

  if (planError) {
    console.error('Error fetching plans:', planError);
    return [];
  }

  // Load type lookup to resolve tid -> type name
  const { data: types, error: typeError } = await supabase
    .from('type')
    .select('id, name');
  if (typeError) {
    console.warn('Warning: could not load types; type names will be omitted:', typeError);
  }
  const typeMap = new Map<string, string>((types ?? []).map((t: any) => [t.id as string, t.name as string]));

  const { data: trans, error: tranError } = await supabase
    .from('tran')
    .select('*');

  if (tranError) {
    console.error('Error fetching trans:', tranError);
    return [];
  }

  const timeline: TimelineItem[] = [
    ...plans.map((p: any) => {
      const placeRaw = p.place ?? {};
      const place: Place = {
        id: placeRaw.id,
        google_maps_json: placeRaw.google_maps_json ?? null,
        info: placeRaw.info,
        url: placeRaw.url,
      };
      const gm = place.google_maps_json;
      if (gm) {
        if (gm.placeName) place.name = gm.placeName;
        if (gm.center && typeof gm.center.lat === 'number' && typeof gm.center.lng === 'number') {
          place.loc = `${gm.center.lat},${gm.center.lng}`;
        }
        if (gm.originalUrl) place.originalUrl = gm.originalUrl;
      }
      if (!place.name) place.name = String(place.id);

      return {
        ...p,
        place,
        type: 'plan' as const,
        typeName: typeMap.get(p.tid as string),
      };
    }),
    ...trans.map((t: any) => ({ ...t, type: 'tran' as const })),
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
  updates: { time?: string; stay?: number | null; info?: string | null; utc?: number | null; tid?: string; pid?: string }
): Promise<void> => {
  // Normalize original time to avoid format mismatches
  const origTimeIso = new Date(original.time).toISOString();
  const origPid = (original as any).pid as string;
  const origTid = (original as any).tid as string;

  const newTime = updates.time ?? original.time;
  const newPid = updates.pid ?? origPid;
  const newTid = updates.tid ?? origTid;

  // Compare primary key with seconds precision to avoid false positives due to ms differences
  const normalizeSec = (iso: string) => {
    const d = new Date(iso);
    d.setMilliseconds(0);
    return d.toISOString();
  };
  const changedPk = normalizeSec(newTime) !== normalizeSec(original.time) || newPid !== origPid;

  if (!changedPk) {
    // Simple in-place update when primary key stays the same
    let { error, data } = await supabase
      .from('plan')
      .update({ ...updates })
      .eq('pid', origPid)
      .eq('time', origTimeIso)
      .select('pid');
    if (error) {
      console.error('Error updating plan:', error);
      throw error;
    }
    if (!data || data.length === 0) {
      // Fallback try without milliseconds
      const d = new Date(original.time);
      d.setMilliseconds(0);
      const noMsIso = d.toISOString();
      const res2 = await supabase
        .from('plan')
        .update({ ...updates })
        .eq('pid', origPid)
        .eq('time', noMsIso)
        .select('pid');
      if (res2.error) {
        console.error('Error updating plan (fallback):', res2.error);
        throw res2.error;
      }
      data = res2.data;
    }
    if (!data || data.length === 0) {
      const msg = `No matching plan row to update. Check identifiers: ${JSON.stringify({ pid: origPid, time: original.time })}`;
      console.warn(msg);
      throw new Error(msg);
    }
    return;
  }

  // PK changed (time and/or pid): insert new row then delete old row
  // 1) Load existing row to preserve unspecified fields
  let { data: found, error: findErr } = await supabase
    .from('plan')
    .select('*')
    .eq('pid', origPid)
    .eq('time', origTimeIso)
    .limit(1);
  if (findErr) {
    console.error('Error fetching original plan:', findErr);
    throw findErr;
  }
  if (!found || found.length === 0) {
    // Try without milliseconds
    const d = new Date(original.time);
    d.setMilliseconds(0);
    const noMsIso = d.toISOString();
    const res2 = await supabase
      .from('plan')
      .select('*')
      .eq('pid', origPid)
      .eq('time', noMsIso)
      .limit(1);
    if (res2.error) {
      console.error('Error fetching original plan (fallback):', res2.error);
      throw res2.error;
    }
    found = res2.data ?? [];
    if (!found || found.length === 0) {
      const msg = `Original plan not found for moving: ${JSON.stringify({ pid: origPid, time: original.time })}`;
      console.warn(msg);
      throw new Error(msg);
    }
  }

  const originalRow = found[0] as any;
  // Compose new row: preserve all existing columns, override with updates and new PK fields
  const newRow = {
    ...originalRow,
    ...updates,
    pid: newPid,
    tid: newTid,
    time: newTime,
  } as any;
  // Ensure only known columns are sent; but since we selected '*', it's acceptable for PostgREST.

  // 2) Insert new row
  const { error: insertErr } = await supabase.from('plan').insert(newRow);
  if (insertErr) {
    console.error('Error inserting new plan during move:', insertErr);
    throw insertErr;
  }

  // 3) Delete old row
  let { error: delErr, data: delData } = await supabase
    .from('plan')
    .delete()
    .eq('pid', origPid)
    .eq('time', origTimeIso)
    .select('pid');
  if (delErr) {
    console.error('Error deleting old plan after move:', delErr);
    throw delErr;
  }
  if (!delData || delData.length === 0) {
    // Try delete with time without ms
    const d = new Date(original.time);
    d.setMilliseconds(0);
    const noMsIso = d.toISOString();
    const res2 = await supabase
      .from('plan')
      .delete()
      .eq('pid', origPid)
      .eq('time', noMsIso)
      .select('pid');
    if (res2.error) {
      console.error('Error deleting old plan after move (fallback):', res2.error);
      throw res2.error;
    }
    delData = res2.data;
  }
};

// Update a tran row by id with new values.
export const updateTran = async (
  original: { id: string } | Pick<Tran, 'id'>,
  updates: { time?: string; stay?: number | null; info?: string | null; utc?: number | null; url?: string | null }
): Promise<void> => {
  const { error, data } = await supabase
    .from('tran')
    .update({ ...updates })
    .eq('id', (original as any).id)
    .select('id');

  if (error) {
    console.error('Error updating tran:', error);
    throw error;
  }
  if (!data || data.length === 0) {
    const msg = `No matching tran row to update for id=${(original as any).id}`;
    console.warn(msg);
    throw new Error(msg);
  }
};

// Delete a plan row identified by pid and time (with ms fallback)
export const deletePlan = async (
  original: { pid: string; time: string } | Pick<Plan, 'pid' | 'time'>
): Promise<void> => {
  const pid = (original as any).pid as string;
  const timeIso = new Date((original as any).time).toISOString();

  let { data, error } = await supabase
    .from('plan')
    .delete()
    .eq('pid', pid)
    .eq('time', timeIso)
    .select('pid');

  if (error) {
    console.error('Error deleting plan:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    // Fallback: try without milliseconds
    const d = new Date((original as any).time);
    d.setMilliseconds(0);
    const noMsIso = d.toISOString();
    const res2 = await supabase
      .from('plan')
      .delete()
      .eq('pid', pid)
      .eq('time', noMsIso)
      .select('pid');
    if (res2.error) {
      console.error('Error deleting plan (fallback):', res2.error);
      throw res2.error;
    }
    data = res2.data;
  }

  if (!data || data.length === 0) {
    const msg = `No matching plan row to delete. Check identifiers: ${JSON.stringify({ pid, time: (original as any).time })}`;
    console.warn(msg);
    throw new Error(msg);
  }
};

// Delete a tran row by id
export const deleteTran = async (
  original: { id: string } | Pick<Tran, 'id'>
): Promise<void> => {
  const { data, error } = await supabase
    .from('tran')
    .delete()
    .eq('id', (original as any).id)
    .select('id');

  if (error) {
    console.error('Error deleting tran:', error);
    throw error;
  }
  if (!data || data.length === 0) {
    const msg = `No matching tran row to delete for id=${(original as any).id}`;
    console.warn(msg);
    throw new Error(msg);
  }
};
