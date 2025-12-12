import { useState, useEffect } from 'react';
import { getHkdToJpyRate, formatNumber } from '../exchangeRates';

interface ShowExchangeProps {
  open: boolean;
  onClose: () => void;
}

export function ShowExchange({ open, onClose }: ShowExchangeProps) {
  const [rate, setRate] = useState<number | null>(null);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [baseIsHkd, setBaseIsHkd] = useState<boolean>(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await getHkdToJpyRate();
        if (!cancelled) {
          setRate(r);
        }
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load exchange rate');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const amount = parseFloat(input || '0');
  const validAmount = !Number.isNaN(amount) ? amount : 0;

  const hkd = baseIsHkd ? validAmount : rate != null ? validAmount / rate : null;
  const jpy = baseIsHkd ? (rate != null ? validAmount * rate : null) : validAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-3xl shadow-lg p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            className="text-lg font-bold cursor-pointer select-none hover:text-blue-600 transition-colors"
            onClick={() => setBaseIsHkd((prev) => !prev)}
          >
            {baseIsHkd ? 'HKD ⇄ JPY' : 'JPY ⇄ HKD'}
          </button>
          <button
            className="text-gray-500 hover:text-gray-700 text-sm"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading rate...</p>}
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

        {!loading && !error && (
          <>
            <p className="text-sm text-gray-700 mb-3">
              {rate != null
                ? baseIsHkd
                  ? `1 HKD = ${formatNumber(rate, 4)} JPY`
                  : `1 JPY = ${formatNumber(1 / rate, 4)} HKD`
                : '--'}
            </p>

            <label className="block text-xs text-gray-600 mb-1">
              Amount in {baseIsHkd ? 'HKD' : 'JPY'}
            </label>
            <input
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={baseIsHkd ? 'Enter HKD amount' : 'Enter JPY amount'}
              className="w-full mb-3 px-3 py-2 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />

            <p className="text-sm text-gray-700">
              =
              {hkd != null && jpy != null
                ? baseIsHkd
                  ? ` ${jpy.toFixed(2)} JPY`
                  : ` ${hkd.toFixed(2)} HKD`
                : ' --'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
