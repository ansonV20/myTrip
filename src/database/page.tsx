import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, updatePlan, updateTran } from '../db';
import { googleMapsUrlToJson, type GoogleMapsJson } from './procress';

type TableName = 'plan' | 'tran' | 'place' | 'type';

type Row = Record<string, any>;

function Card({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="p-5 rounded-3xl shadow-sm gap-4 flex flex-col bg-white"
			style={{ boxShadow: 'inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF' }}
		>
			{children}
		</div>
	);
}

function FieldRow({ label, value }: { label: string; value: any }) {
	return (
		<div className="flex gap-2 text-sm">
			<span className="font-semibold text-gray-700 min-w-15 truncate">{label}</span>
			<div className="text-gray-600 break-words line-clamp-100"><p>{String(value)}</p>{label === 'img' && <img src={String(value)} alt="img" className="w-full mt-2 rounded-xl object-contain" />}</div>
		</div>
	);
}

function UrlRow({ label, href }: { label: string; href?: string | null }) {
	if (!href) return <FieldRow label={label} value="-" />;
	return (
		<div className="flex gap-2 text-sm">
			<span className="font-semibold text-gray-700 min-w-15 truncate">{label}</span>
			<a
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className="text-blue-600 break-all hover:underline"
			>
				{href}
			</a>
		</div>
	);
}

function getPlaceLocationUrl(placeJson?: GoogleMapsJson | null) {
	if (!placeJson?.center) return null;
	const { lat, lng } = placeJson.center;
	if (typeof lat !== 'number' || typeof lng !== 'number') return null;
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

// Legacy helper (unused now after timezone support) removed

// Offset-based timezone helpers (choices like +8, +9)
const getDefaultOffsetHours = () => {
	const minutes = -new Date().getTimezoneOffset();
	return Math.round(minutes / 60);
};

const getOffsetOptions = (): number[] => {
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

function normalizePlaceFromGoogleMaps(form: Row): Row {
	const maybeUrl = typeof form.map === 'string' ? form.map.trim() : '';
	if (!maybeUrl) return { ...form, google_maps_json: null };
	try {
		const parsed = googleMapsUrlToJson(maybeUrl);
		const next: Row = { ...form };
		next.google_maps_json = parsed;
		// derived display helpers (not persisted directly)
		if (parsed.placeName) next.name = String(next.name ?? '').trim() || parsed.placeName;
		if (!next.name) next.name = String(next.id ?? '');
		if (parsed.center) next.loc = `${parsed.center.lat},${parsed.center.lng}`;
		if (parsed.originalUrl) next.originalUrl = parsed.originalUrl;
		// remove fields that no longer exist in DB
		delete next.map;
		delete next.img;
		delete next.jpname;
		return next;
	} catch {
		return { ...form, google_maps_json: null };
	}
}

type EditDialogProps = {
	open: boolean;
	table: TableName;
	row: Row | null;
	onClose: () => void;
	onSaved: () => void;
};

function EditRowDialog({ open, table, row, onClose, onSaved }: EditDialogProps) {
	const [form, setForm] = useState<Row>({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [offset] = useState<number>(getDefaultOffsetHours());
	const [placeOptions, setPlaceOptions] = useState<{ id: string; name: string }[]>([]);
	const [typeOptions, setTypeOptions] = useState<{ id: string; name: string }[]>([]);
    

	useEffect(() => {
		if (row) {
			// Initialize form, but set a stable time string so offset changes won't mutate the input
			setForm((_) => {
				const next: Row = { ...row };
				if (table === 'place') {
					const placeJson = (row.google_maps_json ?? null) as GoogleMapsJson | null;
					next.map = placeJson?.originalUrl ?? row.originalUrl ?? row.map ?? '';
				}
				if (row.time) {
					const baseOffset = typeof (row as any).utc === 'number' ? (row as any).utc : offset;
					next.time = toInputDateTimeWithOffset(row.time, baseOffset);
				}
				return next;
			});
		}
	}, [row, open]);

	// Load FK options when editing plan
	useEffect(() => {
		const loadOptions = async () => {
			if (!open || table !== 'plan') return;
			const [{ data: places, error: perr }, { data: types, error: terr }] = await Promise.all([
				supabase.from('place').select('id, google_maps_json').order('id'),
				supabase.from('type').select('id, name').order('id'),
			]);
			if (!perr && places) {
				const mapped = (places as any[]).map((p) => ({
					id: p.id,
					name: (p.google_maps_json?.placeName as string) || String(p.id),
				}));
				setPlaceOptions(mapped as any);
			}
			if (!terr && types) setTypeOptions(types as any);
		};
		loadOptions();
	}, [open, table]);

	if (!open || !row) return null;

	// Define edit schema based on table so we can show fields even if they are missing in the row (e.g., info)
	const editSchema = tableSchemas[table];
	const schemaKeyOrder = editSchema.map((f) => f.key);
	const rowKeys = Object.keys(row).filter((k) => typeof row[k] !== 'object');
	const allKeysSet = new Set<string>([...schemaKeyOrder, ...rowKeys]);
	const keys = Array.from(allKeysSet);

	// Determine input type per key (fallback to text)
	const typeByKey: Record<string, 'text' | 'number' | 'datetime-local'> = {};
	editSchema.forEach((f) => (typeByKey[f.key] = f.type));
	const getInputType = (k: string) => (k === 'time' ? 'datetime-local' : typeByKey[k] || 'text');

	// Disable editing of identifier keys
	const disabledKeysByTable: Partial<Record<TableName, string[]>> = {
		// Allow editing tid/pid via dropdowns for plan
		tran: ['id'],
		place: ['id'],
		type: ['id'],
	};
	const disabledKeys = new Set(disabledKeysByTable[table] ?? []);

	const save = async () => {
		try {
			setSaving(true);
			setError(null);
			if (table === 'plan') {
				await updatePlan(
					{ tid: row.tid, pid: row.pid, time: row.time },
					{
						time: form.time && form.time.includes('T') ? fromInputDateTimeWithOffset(form.time, Number((form as any).utc ?? (row as any).utc ?? offset)) : form.time,
						stay: form.stay === '' || form.stay == null ? null : Number(form.stay),
						info: form.info == null || form.info === '' ? null : String(form.info),
						utc: Number((form as any).utc ?? (row as any).utc ?? offset),
						tid: form.tid ?? row.tid,
						pid: form.pid ?? row.pid,
					}
				);
			} else if (table === 'tran') {
				await updateTran(
					{ id: row.id },
					{
						time: form.time && form.time.includes('T') ? fromInputDateTimeWithOffset(form.time, Number((form as any).utc ?? (row as any).utc ?? offset)) : form.time,
						stay: form.stay === '' || form.stay == null ? null : Number(form.stay),
						info: form.info == null || form.info === '' ? null : String(form.info),
						utc: Number((form as any).utc ?? (row as any).utc ?? offset),
						url: form.url == null || form.url === '' ? null : String(form.url),
					}
				);
			} else {
				const match = row.id ? { id: row.id } : undefined;
				if (!match) throw new Error('Cannot update row without id');
				if (table === 'place') {
					const normalized = normalizePlaceFromGoogleMaps(form);
					const dbPayload: Row = {
						google_maps_json: normalized.google_maps_json ?? null,
						info: normalized.info ?? null,
						url: form.url == null || form.url === '' ? null : String(form.url),
					};
					const { error } = await supabase.from('place').update(dbPayload).match(match);
					if (error) throw error;
				} else {
					const { error } = await supabase.from(table).update(form).match(match);
					if (error) throw error;
				}
			}
			onSaved();
			onClose();
		} catch (e: any) {
			setError(e?.message ?? 'Save failed');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
				<h2 className="text-md font-bold mb-4">Edit {table}</h2>
				<div className="space-y-3">
					{keys.map((k) => (
						<div key={k}>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								{editSchema.find((field) => field.key === k)?.label ?? k}
							</label>
								{k === 'time' ? (
											<div className="flex gap-2">
												<input
												className="w-full rounded-md border border-gray-300 p-2 text-xs"
													type="datetime-local"
													value={String(form[k] ?? '')}
													onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
													disabled={disabledKeys.has(k)}
												/>
												<select
												className="rounded-md border border-gray-300 p-2 text-xs"
													value={Number((form as any)['utc'] ?? (row as any)['utc'] ?? offset)}
													onChange={(e) => setForm((f) => ({ ...f, utc: Number(e.target.value) }))}
												>
													{getOffsetOptions().map((h) => (
														<option key={h} value={h}>{`UTC${h >= 0 ? '+' : ''}${h}`}</option>
													))}
												</select>
											</div>
								) : table === 'plan' && k === 'tid' ? (
									<select
												className="w-full rounded-md border border-gray-300 p-2 text-xs"
										value={String(form.tid ?? row.tid ?? '')}
										onChange={(e) => setForm((f) => ({ ...f, tid: e.target.value }))}
									>
										<option value="" disabled>Select Type…</option>
										{typeOptions.map((opt) => (
											<option key={opt.id} value={opt.id}>
												{opt.id} — {opt.name}
											</option>
										))}
									</select>
								) : table === 'plan' && k === 'pid' ? (
									<select
										className="w-full rounded-md border border-gray-300 p-2 text-xs"
										value={String(form.pid ?? row.pid ?? '')}
										onChange={(e) => setForm((f) => ({ ...f, pid: e.target.value }))}
									>
										<option value="" disabled>Select Place…</option>
										{placeOptions.map((opt) => (
											<option key={opt.id} value={opt.id}>
												{opt.id} — {opt.name}
											</option>
										))}
									</select>
								) : (
									<input
										className="w-full rounded-md border border-gray-300 p-2 text-xs"
										type={getInputType(k)}
										value={String(form[k] ?? '')}
										onChange={(e) =>
											setForm((f) => ({
												...f,
												[k]: k === 'stay' || getInputType(k) === 'number' ? Number(e.target.value) : e.target.value,
											}))
										}
										disabled={disabledKeys.has(k)}
									/>
								)}
						</div>
					))}
					{error && <p className="text-sm text-red-600">{error}</p>}
				</div>
				<div className="mt-6 flex justify-end gap-3">
					<button className="px-4 py-2 rounded-md border border-gray-300" onClick={onClose} disabled={saving}>
						Cancel
					</button>
					<button className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60" onClick={save} disabled={saving}>
						{saving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	);
}

type AddDialogProps = {
	open: boolean;
	table: TableName;
	onClose: () => void;
	onSaved: () => void;
};

const tableSchemas: Record<TableName, { key: string; label: string; type: 'text' | 'number' | 'datetime-local'; required?: boolean }[]> = {
	plan: [
		{ key: 'tid', label: 'Type ID (tid)', type: 'text', required: true },
		{ key: 'pid', label: 'Place ID (pid)', type: 'text', required: true },
		{ key: 'time', label: 'Time', type: 'datetime-local', required: true },
		// { key: 'utc', label: 'UTC Offset (e.g., +8)', type: 'number' },
		{ key: 'stay', label: 'Stay (minutes)', type: 'number' },
		{ key: 'info', label: 'Info', type: 'text' },
	],
	tran: [
		{ key: 'name', label: 'Name', type: 'text', required: true },
		{ key: 'time', label: 'Time', type: 'datetime-local', required: true },
		// { key: 'utc', label: 'UTC Offset (e.g., +8)', type: 'number' },
		{ key: 'stay', label: 'Stay (minutes)', type: 'number' },
		{ key: 'info', label: 'Info', type: 'text' },
		{ key: 'url', label: 'URL', type: 'text' },
	],
	place: [
		{ key: 'id', label: 'ID', type: 'text', required: true },
		{ key: 'map', label: 'Google Maps URL', type: 'text', required: true },
		{ key: 'info', label: 'Info', type: 'text' },
		{ key: 'url', label: 'URL', type: 'text' },
	],
	type: [
		{ key: 'id', label: 'ID', type: 'text', required: true },
		{ key: 'name', label: 'Name', type: 'text', required: true },
	],
};

function AddRowDialog({ open, table, onClose, onSaved }: AddDialogProps) {
	const schema = tableSchemas[table];
	const [form, setForm] = useState<Row>({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [offset, setOffset] = useState<number>(getDefaultOffsetHours());
	const [placeOptions, setPlaceOptions] = useState<{ id: string; name: string }[]>([]);
	const [typeOptions, setTypeOptions] = useState<{ id: string; name: string }[]>([]);
	const [placeIdOptions, setPlaceIdOptions] = useState<string[]>([]);
    

	useEffect(() => {
		if (open) {
			setForm({});
			setError(null);
			setOffset(getDefaultOffsetHours());
		}
	}, [open, table]);

	// Load FK options when adding plan, and compute allowed place IDs when adding place
	useEffect(() => {
		const loadOptions = async () => {
			if (!open) return;
			if (table === 'plan') {
				const [{ data: places, error: perr }, { data: types, error: terr }] = await Promise.all([
					supabase.from('place').select('id, google_maps_json').order('id'),
					supabase.from('type').select('id, name').order('id'),
				]);
				if (!perr && places) {
					const mapped = (places as any[]).map((p) => ({ id: p.id, name: (p.google_maps_json?.placeName as string) || String(p.id) }));
					setPlaceOptions(mapped as any);
				}
				if (!terr && types) setTypeOptions(types as any);
			} else if (table === 'place') {
				const { data: places, error: perr } = await supabase.from('place').select('id').order('id');
				if (!perr && places) {
					const existing: number[] = (places as any)
						.map((p: any) => Number(p.id))
						.filter((n: number) => !Number.isNaN(n) && n >= 1 && n <= 9999);
					let lastNormal = 0;
					let lastHigh = 8999;
					for (const n of existing) {
						if (n < 9000 && n > lastNormal) lastNormal = n;
						if (n >= 9000 && n > lastHigh) lastHigh = n;
					}
					const nextNormal = lastNormal + 1 <= 8999 ? String(lastNormal + 1).padStart(4, '0') : null;
					const nextHigh = lastHigh + 1 <= 9999 ? String(lastHigh + 1).padStart(4, '0') : null;
					const options: string[] = [];
					if (nextNormal) options.push(nextNormal);
					if (nextHigh && nextHigh !== nextNormal) options.push(nextHigh);
					setPlaceIdOptions(options);
				}
			}
		};
		loadOptions();
	}, [open, table]);

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
			if (table === 'place') {
				const normalized = normalizePlaceFromGoogleMaps(payload);
				const dbPayload: Row = {
					id: normalized.id,
					google_maps_json: normalized.google_maps_json ?? null,
					info: normalized.info ?? null,
				};
				Object.assign(payload, dbPayload);
			}
			const insertPayload = table === 'place' ? { id: payload.id, google_maps_json: payload.google_maps_json ?? null, info: payload.info ?? null, url: payload.url ?? null } : payload;
			// Auto-fill `id` for `tran` if missing: use max numeric id + 1, padded to 4 digits starting at 0001
			if (table === 'tran' && (!payload.id || String(payload.id).trim() === '')) {
				const { data: existingIds, error: idErr } = await supabase.from('tran').select('id');
				if (idErr) throw idErr;
				const nums = (existingIds || [])
					.map((r: any) => Number(r.id))
					.filter((n: number) => !Number.isNaN(n) && n >= 1 && n <= 9999);
				const max = nums.length ? Math.max(...nums) : 0;
				payload.id = String(max + 1).padStart(4, '0');
			}
			const { error } = await supabase.from(table).insert(insertPayload as any);
			if (error) throw error;
			onSaved();
			onClose();
		} catch (e: any) {
			setError(e?.message ?? 'Add failed');
		} finally {
			setSaving(false);
		}
	};

	const requiredOk = (() => {
		if (table !== 'plan') return true;
		return Boolean(form.tid) && Boolean(form.pid) && Boolean(form.time);
	})();

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
				<h2 className="text-md font-bold mb-4">Add {table}</h2>
				<div className="space-y-3">
					{schema.map(({ key, label, type, required }) => (
						<div key={key}>
							<label className="block text-xs font-medium text-gray-700 mb-1">{label}{required ? ' *' : ''}</label>
							{type === 'datetime-local' ? (
								<div className="flex gap-2">
									<input
										className="w-full rounded-md border border-gray-300 p-2 text-xs"
										type="datetime-local"
										value={String(form[key] ?? '')}
										onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
									/>
									<select
										className="rounded-md border border-gray-300 p-2 text-xs"
										value={Number((form as any)['utc'] ?? offset)}
										onChange={(e) => setForm((f) => ({ ...f, utc: Number(e.target.value) }))}
									>
										{getOffsetOptions().map((h) => (
											<option key={h} value={h}>{`UTC${h >= 0 ? '+' : ''}${h}`}</option>
										))}
									</select>
								</div>
							) : table === 'plan' && key === 'tid' ? (
								<select
									className="w-full rounded-md border border-gray-300 p-2 text-xs"
									value={String(form.tid ?? '')}
									onChange={(e) => setForm((f) => ({ ...f, tid: e.target.value }))}
								>
									<option value="" disabled>Select Type…</option>
									{typeOptions.map((opt) => (
										<option key={opt.id} value={opt.id}>
											{opt.id} — {opt.name}
										</option>
									))}
								</select>
							) : table === 'plan' && key === 'pid' ? (
								<select
									className="w-full rounded-md border border-gray-300 p-2 text-xs"
									value={String(form.pid ?? '')}
									onChange={(e) => setForm((f) => ({ ...f, pid: e.target.value }))}
								>
									<option value="" disabled>Select Place…</option>
									{placeOptions.map((opt) => (
										<option key={opt.id} value={opt.id}>
											{opt.id} — {opt.name}
										</option>
									))}
								</select>
								) : table === 'place' && key === 'id' ? (
									<select
										className="w-full rounded-md border border-gray-300 p-2 text-xs"
										value={String(form.id ?? '')}
										onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
									>
										<option value="" disabled>
											Select ID…
										</option>
										{placeIdOptions.map((id) => (
											<option key={id} value={id}>
												{id}
											</option>
										))}
									</select>
								) : (
								<input
										className="w-full rounded-md border border-gray-300 p-2 text-xs"
									type={type}
									value={String(form[key] ?? '')}
									onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
								/>
							)}
						</div>
					))}
					{error && <p className="text-sm text-red-600">{error}</p>}
				</div>
				<div className="mt-6 flex justify-end gap-3">
					<button className="px-4 py-2 rounded-md border border-gray-300" onClick={onClose} disabled={saving}>
						Cancel
					</button>
					<button className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60" onClick={add} disabled={saving || !requiredOk}>
						{saving ? 'Adding…' : 'Add'}
					</button>
				</div>
			</div>
		</div>
	);
}

function AddColumnDialog({
	open,
	table,
	onClose,
}: {
	open: boolean;
	table: TableName;
	onClose: () => void;
}) {
	const [colName, setColName] = useState('');
	const [colType, setColType] = useState<'text' | 'integer' | 'numeric' | 'boolean' | 'timestamp' | 'date' | 'jsonb'>('text');
	const [nullable, setNullable] = useState(true);
	const [defVal, setDefVal] = useState('');
	const [copied, setCopied] = useState(false);

	if (!open) return null;

	const isValidColName = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

	const escapeLiteral = (s: string) => s.replace(/'/g, "''");

	const sqlType = (() => {
		switch (colType) {
			case 'timestamp':
				return 'timestamptz';
			default:
				return colType;
		}
	})();

	const defaultClause = (() => {
		if (!defVal) return '';
		// allow simple function calls like now() without quoting
		const isFunc = /^\w+\(\)$/.test(defVal.trim());
		if (isFunc) return ` DEFAULT ${defVal.trim()}`;
		if (colType === 'integer' || colType === 'numeric') return ` DEFAULT ${defVal}`;
		if (colType === 'boolean') return ` DEFAULT ${String(defVal).toLowerCase()}`;
		// text / timestamp / date / jsonb default literal
		return ` DEFAULT '${escapeLiteral(defVal)}'`;
	})();

	const nullableClause = nullable ? '' : ' NOT NULL';
	const colIdent = isValidColName(colName) ? `"${colName}"` : '"<invalid_name>"';
	const sql = `ALTER TABLE public.${table}\nADD COLUMN ${colIdent} ${sqlType}${nullableClause}${defaultClause};`;

	const canCopy = isValidColName(colName);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(sql);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
				<h2 className="text-xl font-bold mb-4">Add Column</h2>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Table</label>
						<input className="w-full rounded-md border border-gray-300 p-2 text-xs bg-gray-100" value={table} readOnly />
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Column name</label>
						<input
							className={`w-full rounded-md border p-2 text-xs ${colName && !isValidColName(colName) ? 'border-red-400' : 'border-gray-300'}`}
							placeholder="e.g., notes"
							value={colName}
							onChange={(e) => setColName(e.target.value)}
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
						<select className="w-full rounded-md border border-gray-300 p-2 text-xs" value={colType} onChange={(e) => setColType(e.target.value as any)}>
							<option value="text">text</option>
							<option value="integer">integer</option>
							<option value="numeric">numeric</option>
							<option value="boolean">boolean</option>
							<option value="timestamp">timestamp (timestamptz)</option>
							<option value="date">date</option>
							<option value="jsonb">jsonb</option>
						</select>
					</div>
					<div className="flex items-end gap-2">
						<label className="flex items-center gap-2 text-sm text-gray-700">
							<input type="checkbox" checked={nullable} onChange={(e) => setNullable(e.target.checked)} />
							Nullable
						</label>
					</div>
					<div className="md:col-span-2">
						<label className="block text-sm font-medium text-gray-700 mb-1">Default (optional)</label>
						<input
							className="w-full rounded-md border border-gray-300 p-2 text-xs"
							placeholder={colType === 'timestamp' ? "e.g., now() or '2025-11-02T12:00:00Z'" : colType === 'integer' || colType === 'numeric' ? 'e.g., 0' : colType === 'boolean' ? 'true/false' : "e.g., 'hello'"}
							value={defVal}
							onChange={(e) => setDefVal(e.target.value)}
						/>
						<p className="text-xs text-gray-500 mt-1">Tip: Use now() for timestamp; numbers unquoted; text in quotes.</p>
					</div>
				</div>

				<div className="mt-4">
					<label className="block text-sm font-medium text-gray-700 mb-1">SQL preview</label>
					<pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs overflow-auto">
{sql}
					</pre>
					{!canCopy && colName && !isValidColName(colName) && (
						<p className="text-xs text-red-600 mt-1">Column name must match [A-Za-z_][A-Za-z0-9_]*</p>
					)}
				</div>

				<div className="mt-6 flex justify-end gap-3">
					<button className="px-4 py-2 rounded-md border border-gray-300" onClick={onClose}>Close</button>
					<button
						className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
						onClick={copy}
						disabled={!canCopy}
					>
						{copied ? 'Copied!' : 'Copy SQL'}
					</button>
				</div>

				<p className="text-xs text-gray-500 mt-3">
					Run this SQL in the Supabase SQL Editor or a migration. Schema changes require service role access and cannot be executed from the browser.
				</p>
			</div>
		</div>
	);
}

export default function DatabasePage() {
	const navigate = useNavigate();
	const [table, setTable] = useState<TableName>('plan');
	const [rows, setRows] = useState<Row[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState<Row | null>(null);
	const [addOpen, setAddOpen] = useState(false);
	const [addColOpen, setAddColOpen] = useState(false);

		const fetchRows = async () => {
		setLoading(true);
		setError(null);
			try {
				let q: any = supabase.from(table).select('*');
				// Order by id if the table has id; otherwise by time
				if (table === 'plan') {
					// plan has no id column; order by time
					q = q.order('time', { ascending: true });
				} else if (table === 'tran') {
					// tran has id and time; primary by id, fallback/time as secondary
					q = q
						.order('id', { ascending: true, nullsFirst: false })
						.order('time', { ascending: true });
				} else if (table === 'place' || table === 'type') {
					// both have id; simple id ordering
					q = q.order('id', { ascending: true, nullsFirst: false });
				}
				q = q.limit(500);
				const { data, error } = await q;
			if (error) throw error;
			setRows(data || []);
		} catch (e: any) {
			setError(e?.message ?? 'Failed to load');
			setRows([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchRows();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [table]);

	const tableButtons: { key: TableName; label: string }[] = [
		{ key: 'plan', label: 'plan' },
		{ key: 'tran', label: 'tran' },
		{ key: 'place', label: 'place' },
		{ key: 'type', label: 'type' },
	];

	return (
		<div className="container mx-auto p-4">
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-2xl font-bold">Database</h1>
				<div className="flex gap-2">
					<button className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100" onClick={() => navigate('/')}>Back</button>
				</div>
			</div>

			<div className="flex flex-wrap gap-2 mb-4">
				{tableButtons.map((t) => (
					<button
						key={t.key}
						className={`px-3 py-1.5 rounded-md border text-sm ${table === t.key ? 'border-blue-600 text-white bg-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
						onClick={() => setTable(t.key)}
					>
						{t.label}
					</button>
				))}
				<div className="flex-1" />
				<button className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100" onClick={() => setAddOpen(true)}>
					Add Row
				</button>
				<button className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100" onClick={() => setAddColOpen(true)}>
					Add Column
				</button>
			</div>

			{loading && <p className="text-gray-600">Loading…</p>}
			{error && <p className="text-red-600">{error}</p>}

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{rows.map((r, i) => (
					<Card key={i}>
						<div className="flex items-start justify-between">
							<h3 className="font-bold text-lg">{table}</h3>
							<button className="text-orange-700 font-medium" onClick={() => setEditing(r)}>Edit</button>
						</div>
						<div className="h-px bg-gray-200 my-2" />
						{table === 'place' ? (
							<div className="flex flex-col gap-1">
								{(() => {
									const placeJson = (r.google_maps_json ?? null) as GoogleMapsJson | null;
									const placeName = placeJson?.placeName || String(r.name ?? r.id ?? '');
									const locationUrl = getPlaceLocationUrl(placeJson);
									const originalUrl = placeJson?.originalUrl ?? null;

									return (
										<>
											<FieldRow label="id" value={r.id} />
											<FieldRow label="name" value={placeName} />
											<UrlRow label="location" href={locationUrl} />
											<UrlRow label="url" href={originalUrl} />
											<FieldRow label="info" value={r.info ?? ''} />
										</>
									);
								})()}
							</div>
						) : (
							<div className="flex flex-col gap-1">
								{Object.entries(r)
									.filter(([_, v]) => typeof v !== 'object')
									.map(([k, v]) => (
										<FieldRow key={k} label={k} value={v} />
									))}
							</div>
						)}
					</Card>
				))}
			</div>

			<EditRowDialog open={!!editing} table={table} row={editing} onClose={() => setEditing(null)} onSaved={fetchRows} />
			<AddRowDialog open={addOpen} table={table} onClose={() => setAddOpen(false)} onSaved={fetchRows} />
			<AddColumnDialog open={addColOpen} table={table} onClose={() => setAddColOpen(false)} />
		</div>
	);
}

