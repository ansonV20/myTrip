import { useEffect, useMemo, useState } from 'react';
import type { TimelineItem } from '../db';
import { updatePlan, updateTran } from '../db';

interface EditPlanDialogProps {
  isOpen: boolean;
  item: TimelineItem | null;
  onClose: () => void;
  onSaved: () => void; // parent should refresh timeline
}

// Offset-based timezone helpers (choices like +8, +9)
const getDefaultOffsetHours = () => {
  // JS offset is minutes behind UTC; invert and convert to hours
  const minutes = -new Date().getTimezoneOffset();
  return Math.round(minutes / 60);
};

const getOffsetOptions = (): number[] => {
  // Whole-hour offsets from -12 to +14
  const opts: number[] = [];
  for (let h = -12; h <= 14; h++) opts.push(h);
  return opts;
};

function toInputDateTimeWithOffset(iso: string | undefined, offsetHours: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const t = d.getTime() + offsetHours * 3600000;
  const dd = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = dd.getUTCFullYear();
  const mm = pad(dd.getUTCMonth() + 1);
  const da = pad(dd.getUTCDate());
  const hh = pad(dd.getUTCHours());
  const mi = pad(dd.getUTCMinutes());
  return `${yyyy}-${mm}-${da}T${hh}:${mi}`;
}

function fromInputDateTimeWithOffset(local: string, offsetHours: number): string {
  if (!local) return '';
  const [datePart, timePart] = local.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const utcNaive = Date.UTC(y, m - 1, d, hh, mm, 0);
  const epoch = utcNaive - offsetHours * 3600000;
  return new Date(epoch).toISOString();
}

export function EditPlanDialog({ isOpen, item, onClose, onSaved }: EditPlanDialogProps) {
  const [time, setTime] = useState<string>('');
  const [stay, setStay] = useState<string>('');
  const [info, setInfo] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(getDefaultOffsetHours());
  // Track initial values to detect whether user actually changed time/offset
  const [initialTimeInput, setInitialTimeInput] = useState<string>('');
  const [initialOffset, setInitialOffset] = useState<number>(getDefaultOffsetHours());

  const originalKey = useMemo(() => {
    if (!item) return null;
    if (item.type === 'plan') {
      return { type: 'plan' as const, key: { tid: item.tid, pid: item.pid, time: item.time } };
    }
    return { type: 'tran' as const, key: { id: item.id } };
  }, [item]);

  useEffect(() => {
    if (item) {
  const def = typeof (item as any).utc === 'number' ? (item as any).utc : getDefaultOffsetHours();
  setOffset(def);
  const t = toInputDateTimeWithOffset(item.time, def);
  setTime(t);
  setInitialTimeInput(t);
  setInitialOffset(def);
      setStay(item.stay != null ? String(item.stay) : '');
      setInfo(item.info ?? '');
      setError(null);
    } else {
      setTime('');
      setStay('');
      setInfo('');
      setError(null);
      setInitialTimeInput('');
      setInitialOffset(getDefaultOffsetHours());
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const onSave = async () => {
    try {
      setSaving(true);
      setError(null);
      if (!originalKey) throw new Error('Missing plan key');
  // Only change time when user actually changed the time input or the offset
  const newTimeIso = time && (time !== initialTimeInput || offset !== initialOffset)
    ? fromInputDateTimeWithOffset(time, offset)
    : undefined;
      const newStay = stay === '' ? null : Math.max(0, Math.floor(Number(stay)));
      const newInfo = info === '' ? null : info;

      if (originalKey.type === 'plan') {
        await updatePlan(originalKey.key, { time: newTimeIso, stay: newStay, info: newInfo, utc: offset });
      } else {
        await updateTran(originalKey.key, { time: newTimeIso ?? item.time, stay: newStay, info: newInfo, utc: offset });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4">{item.type === 'plan' ? 'Edit Plan' : 'Edit Transport'}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                className="w-full rounded-md border border-gray-300 p-2"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <select
                className="rounded-md border border-gray-300 p-2 text-sm"
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value))}
              >
                {getOffsetOptions().map((h) => (
                  <option key={h} value={h}>{`UTC${h >= 0 ? '+' : ''}${h}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stay (minutes)</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-md border border-gray-300 p-2"
              value={stay}
              onChange={(e) => setStay(e.target.value)}
              placeholder="e.g., 90"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Info</label>
            <textarea
              className="w-full rounded-md border border-gray-300 p-2"
              rows={4}
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              placeholder="Notes about the plan..."
            />
            <p className="text-xs text-gray-500 mt-1">Tip: Use line breaks; rendering preserves them.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
