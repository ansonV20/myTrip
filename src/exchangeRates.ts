import { getCachedJson, setCachedJson } from './storage';

export type ExchangeRates = {
	base: string;
	date: string;
	rates: Record<string, number>;
};

export async function fetchExchangeRates(base: string = 'HKD'): Promise<ExchangeRates> {
	const CACHE_KEY = `fx_${base.toUpperCase()}`;
	const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

	// Try cookie cache first
	const cached = getCachedJson<ExchangeRates>(CACHE_KEY, SIX_HOURS_MS);
	if (cached) {
		return cached;
	}

	const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(base)}`);
	if (!res.ok) {
		throw new Error(`Failed to fetch exchange rates: ${res.status}`);
	}
	const data = (await res.json()) as ExchangeRates;

	// Store in cookie cache for 6 hours
	setCachedJson(CACHE_KEY, data, SIX_HOURS_MS);

	return data;
}

export async function getHkdToJpyRate(): Promise<number | null> {
	try {
		const data = await fetchExchangeRates('HKD');
		const jpy = data.rates['JPY'];
		if (typeof jpy !== 'number') return null;
		return jpy;
	} catch (e) {
		console.error('Error fetching HKD->JPY rate', e);
		return null;
	}
}

export function formatNumber(n: number | null | undefined, digits: number = 4): string {
	if (n == null || Number.isNaN(n)) return '';
	return n.toFixed(digits);
}

