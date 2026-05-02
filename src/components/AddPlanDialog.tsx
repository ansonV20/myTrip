import { useEffect, useState } from 'react';
import { supabase } from '../db';

type Row = Record<string, any>;

type AddPlanDialogProps = {
  open: boolean;
  defaultDay?: string; // YYYY-MM-DD (local day key)
  onClose: () => void;
  onSaved: () => void;
};

// Timezone helpers (match database page behavior)
const getDefaultOffsetHours = () => {
  const minutes = -new Date().getTimezoneOffset();
  return Math.round(minutes / 60);
};

const getOffsetOptions = (): number[] => {
  const opts: number[] = [];
  for (let h = -12; h <= 14; h++) opts.push(h);
  return opts;
};

function fromInputDateTimeWithOffset(local: string, offsetHours: number): string {
  if (!local) return '';
  const [datePart, timePart] = local.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const utcNaive = Date.UTC(y, m - 1, d, hh, mm, 0);
  const epoch = utcNaive - offsetHours * 3600000;
  return new Date(epoch).toISOString();
}

export function AddPlanDialog({ open, defaultDay, onClose, onSaved }: AddPlanDialogProps) {
  const [form, setForm] = useState<Row>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(getDefaultOffsetHours());
  const [placeOptions, setPlaceOptions] = useState<{ id: string; name: string }[]>([]);
  const [typeOptions, setTypeOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
  setForm(() => {
        // Prefill time with defaultDay at 09:00 local UI if provided
        const initial: Row = {};
        if (defaultDay) {
          initial.time = `${defaultDay}T09:00`;
        }
        return initial;
      });
      setError(null);
      setOffset(getDefaultOffsetHours());
    }
  }, [open, defaultDay]);

  // Load FK options
  useEffect(() => {
    const loadOptions = async () => {
      if (!open) return;
      const [{ data: places }, { data: types }] = await Promise.all([
        supabase.from('place').select('id, google_maps_json').order('id'),
        supabase.from('type').select('id, name').order('id'),
      ]);
      if (places) {
        const mapped = (places as any[]).map((p) => ({ id: p.id, name: (p.google_maps_json?.placeName as string) || String(p.id) }));
        setPlaceOptions(mapped as any);
      }
      if (types) setTypeOptions(types as any);
    };
    loadOptions();
  }, [open]);

  if (!open) return null;

  const add = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload: Row = { ...form };
      if (payload.time && typeof payload.time === 'string' && payload.time.includes('T')) {
        const chosen = typeof payload.utc === 'number' ? payload.utc : offset;
        payload.time = fromInputDateTimeWithOffset(payload.time, chosen);
      }
      const { error } = await supabase.from('plan').insert(payload as any);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Add failed');
    } finally {
      setSaving(false);
    }
  };

  const requiredOk = Boolean(form.tid) && Boolean(form.pid) && Boolean(form.time);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4">Add plan</h2>
        <div className="space-y-3">
          {/* tid */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type ID (tid) *</label>
            <select
              className="w-full rounded-md border border-gray-300 p-2"
              value={String(form.tid ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, tid: e.target.value }))}
            >
              <option value="" disabled>
                Select Type…
              </option>
              {typeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.id} — {opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* pid */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Place ID (pid) *</label>
            <select
              className="w-full rounded-md border border-gray-300 p-2"
              value={String(form.pid ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, pid: e.target.value }))}
            >
              <option value="" disabled>
                Select Place…
              </option>
              {placeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.id} — {opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* time + utc */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border border-gray-300 p-2"
                type="datetime-local"
                value={String(form.time ?? '')}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
              <select
                className="rounded-md border border-gray-300 p-2 text-sm"
                value={Number((form as any)['utc'] ?? offset)}
                onChange={(e) => setForm((f) => ({ ...f, utc: Number(e.target.value) }))}
              >
                {getOffsetOptions().map((h) => (
                  <option key={h} value={h}>{`UTC${h >= 0 ? '+' : ''}${h}`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* stay */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stay (minutes)</label>
            <input
              className="w-full rounded-md border border-gray-300 p-2"
              type="number"
              value={String(form.stay ?? '')}
              min={0}
              onChange={(e) => setForm((f) => ({ ...f, stay: Number(e.target.value) }))}
              placeholder="e.g., 90"
            />
          </div>

          {/* info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Info</label>
            <input
              className="w-full rounded-md border border-gray-300 p-2"
              type="text"
              value={String(form.info ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, info: e.target.value }))}
              placeholder="Notes about the plan..."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="px-4 py-2 rounded-md border border-gray-300" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
            onClick={add}
            disabled={saving || !requiredOk}
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
