
// Simple cookie-based storage with JSON + timestamp

export interface CachedValue<T> {
	value: T;
	timestamp: number; // ms since epoch
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
	if (typeof document === "undefined") return;
	document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}`;
}

function getCookie(name: string): string | null {
	if (typeof document === "undefined") return null;
	const nameEq = encodeURIComponent(name) + "=";
	const parts = document.cookie.split("; ");
	for (const part of parts) {
		if (part.startsWith(nameEq)) {
			return decodeURIComponent(part.substring(nameEq.length));
		}
	}
	return null;
}

export function setCachedJson<T>(key: string, value: T, ttlMs: number) {
	const payload: CachedValue<T> = {
		value,
		timestamp: Date.now(),
	};
	const maxAgeSeconds = Math.ceil(ttlMs / 1000);
	try {
		setCookie(key, JSON.stringify(payload), maxAgeSeconds);
	} catch (e) {
		console.error("Failed to set cookie cache", key, e);
	}
}

export function getCachedJson<T>(key: string, maxAgeMs: number): T | null {
	try {
		const raw = getCookie(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CachedValue<T>;
		if (!parsed || typeof parsed.timestamp !== "number") return null;
		const age = Date.now() - parsed.timestamp;
		if (age > maxAgeMs) return null;
		return parsed.value;
	} catch (e) {
		console.error("Failed to read cookie cache", key, e);
		return null;
	}
}

