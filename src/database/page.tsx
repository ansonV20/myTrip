import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, updatePlan, updateTran } from '../db';

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
			<span className="font-semibold text-gray-700 min-w-28 truncate">{label}</span>
			<span className="text-gray-600 break-words line-clamp-2">{String(value)}</span>
		</div>
	);
}

function toLocalInput(value: any): string {
	if (!value) return '';
	try {
		const d = new Date(value);
		if (isNaN(d.getTime())) return String(value);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	} catch {
		return String(value);
	}
}

function fromLocalInput(value: string): string {
	if (!value) return '';
	const [datePart, timePart] = value.split('T');
	const [y, m, d] = datePart.split('-').map(Number);
	const [hh, mm] = timePart.split(':').map(Number);
	const local = new Date(y, m - 1, d, hh, mm, 0, 0);
	return local.toISOString();
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

	useEffect(() => {
		if (row) setForm(row);
	}, [row]);

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
		plan: ['tid', 'pid'],
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
						time: form.time && form.time.includes('T') ? fromLocalInput(form.time) : form.time,
						stay: form.stay === '' || form.stay == null ? null : Number(form.stay),
						info: form.info == null || form.info === '' ? null : String(form.info),
					}
				);
			} else if (table === 'tran') {
				await updateTran(
					{ id: row.id },
					{
						time: form.time && form.time.includes('T') ? fromLocalInput(form.time) : form.time,
						stay: form.stay === '' || form.stay == null ? null : Number(form.stay),
						info: form.info == null || form.info === '' ? null : String(form.info),
					}
				);
			} else {
				const match = row.id ? { id: row.id } : undefined;
				if (!match) throw new Error('Cannot update row without id');
				const { error } = await supabase.from(table).update(form).match(match);
				if (error) throw error;
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
				<h2 className="text-xl font-bold mb-4">Edit {table}</h2>
				<div className="space-y-3">
								{keys.map((k) => (
						<div key={k}>
							<label className="block text-sm font-medium text-gray-700 mb-1">{k}</label>
							<input
								className="w-full rounded-md border border-gray-300 p-2"
											type={getInputType(k)}
											value={k === 'time' ? toLocalInput(form[k]) : String(form[k] ?? '')}
											onChange={(e) =>
												setForm((f) => ({
													...f,
													[k]: k === 'stay' || getInputType(k) === 'number' ? Number(e.target.value) : e.target.value,
												}))
											}
											disabled={disabledKeys.has(k)}
							/>
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
		{ key: 'tid', label: 'Trip ID (tid)', type: 'text', required: true },
		{ key: 'pid', label: 'Place ID (pid)', type: 'text', required: true },
		{ key: 'time', label: 'Time', type: 'datetime-local', required: true },
		{ key: 'stay', label: 'Stay (minutes)', type: 'number' },
		{ key: 'info', label: 'Info', type: 'text' },
	],
	tran: [
		{ key: 'name', label: 'Name', type: 'text', required: true },
		{ key: 'time', label: 'Time', type: 'datetime-local', required: true },
		{ key: 'stay', label: 'Stay (minutes)', type: 'number' },
		{ key: 'info', label: 'Info', type: 'text' },
	],
	place: [
		{ key: 'id', label: 'ID', type: 'text', required: true },
		{ key: 'name', label: 'Name', type: 'text', required: true },
		{ key: 'jpname', label: 'JP Name', type: 'text' },
		{ key: 'loc', label: 'Location (lat,lng)', type: 'text' },
		{ key: 'img', label: 'Image URL', type: 'text' },
		{ key: 'info', label: 'Info', type: 'text' },
		{ key: 'map', label: 'Map Query', type: 'text' },
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

	useEffect(() => {
		if (open) {
			setForm({});
			setError(null);
		}
	}, [open, table]);

	if (!open) return null;

	const add = async () => {
		try {
			setSaving(true);
			setError(null);
			const payload: Row = { ...form };
			if (payload.time && typeof payload.time === 'string' && payload.time.includes('T')) {
				payload.time = fromLocalInput(payload.time);
			}
			const { error } = await supabase.from(table).insert(payload as any);
			if (error) throw error;
			onSaved();
			onClose();
		} catch (e: any) {
			setError(e?.message ?? 'Add failed');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
				<h2 className="text-xl font-bold mb-4">Add {table}</h2>
				<div className="space-y-3">
					{schema.map(({ key, label, type, required }) => (
						<div key={key}>
							<label className="block text-sm font-medium text-gray-700 mb-1">{label}{required ? ' *' : ''}</label>
							<input
								className="w-full rounded-md border border-gray-300 p-2"
								type={type}
								value={type === 'datetime-local' ? (form[key] ?? '') : String(form[key] ?? '')}
								onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
							/>
						</div>
					))}
					{error && <p className="text-sm text-red-600">{error}</p>}
				</div>
				<div className="mt-6 flex justify-end gap-3">
					<button className="px-4 py-2 rounded-md border border-gray-300" onClick={onClose} disabled={saving}>
						Cancel
					</button>
					<button className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60" onClick={add} disabled={saving}>
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
						<input className="w-full rounded-md border border-gray-300 p-2 bg-gray-100" value={table} readOnly />
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Column name</label>
						<input
							className={`w-full rounded-md border p-2 ${colName && !isValidColName(colName) ? 'border-red-400' : 'border-gray-300'}`}
							placeholder="e.g., notes"
							value={colName}
							onChange={(e) => setColName(e.target.value)}
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
						<select className="w-full rounded-md border border-gray-300 p-2" value={colType} onChange={(e) => setColType(e.target.value as any)}>
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
							className="w-full rounded-md border border-gray-300 p-2"
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
				if (table === 'plan' || table === 'tran') {
					q = q.order('time', { ascending: true });
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
						<div className="flex flex-col gap-1">
							{Object.entries(r)
								.filter(([_, v]) => typeof v !== 'object')
								.map(([k, v]) => (
									<FieldRow key={k} label={k} value={v} />
								))}
						</div>
					</Card>
				))}
			</div>

			<EditRowDialog open={!!editing} table={table} row={editing} onClose={() => setEditing(null)} onSaved={fetchRows} />
			<AddRowDialog open={addOpen} table={table} onClose={() => setAddOpen(false)} onSaved={fetchRows} />
			<AddColumnDialog open={addColOpen} table={table} onClose={() => setAddColOpen(false)} />
		</div>
	);
}

