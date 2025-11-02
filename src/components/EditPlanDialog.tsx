import { useEffect, useMemo, useState } from 'react';
import type { TimelineItem } from '../db';
import { updatePlan, updateTran } from '../db';

interface EditPlanDialogProps {
  isOpen: boolean;
  item: TimelineItem | null;
  onClose: () => void;
  onSaved: () => void; // parent should refresh timeline
}

function toInputDateTimeLocal(value: string | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  // Build YYYY-MM-DDTHH:MM based on local time
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromInputDateTimeLocal(value: string): string {
  // value is like 'YYYY-MM-DDTHH:MM' in local time; convert to ISO string preserving local time
  // We create a Date with local components.
  if (!value) return '';
  const [datePart, timePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const local = new Date(y, (m - 1), d, hh, mm, 0, 0);
  return local.toISOString();
}

export function EditPlanDialog({ isOpen, item, onClose, onSaved }: EditPlanDialogProps) {
  const [time, setTime] = useState<string>('');
  const [stay, setStay] = useState<string>('');
  const [info, setInfo] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalKey = useMemo(() => {
    if (!item) return null;
    if (item.type === 'plan') {
      return { type: 'plan' as const, key: { tid: item.tid, pid: item.pid, time: item.time } };
    }
    return { type: 'tran' as const, key: { id: item.id } };
  }, [item]);

  useEffect(() => {
    if (item) {
      setTime(toInputDateTimeLocal(item.time));
      setStay(item.stay != null ? String(item.stay) : '');
      setInfo(item.info ?? '');
      setError(null);
    } else {
      setTime('');
      setStay('');
      setInfo('');
      setError(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const onSave = async () => {
    try {
      setSaving(true);
      setError(null);
      if (!originalKey) throw new Error('Missing plan key');
      const newTimeIso = time ? fromInputDateTimeLocal(time) : item.time;
      const newStay = stay === '' ? null : Math.max(0, Math.floor(Number(stay)));
      const newInfo = info === '' ? null : info;

      if (originalKey.type === 'plan') {
        await updatePlan(originalKey.key, { time: newTimeIso, stay: newStay, info: newInfo });
      } else {
        await updateTran(originalKey.key, { time: newTimeIso, stay: newStay, info: newInfo });
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
            <input
              type="datetime-local"
              className="w-full rounded-md border border-gray-300 p-2"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
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
