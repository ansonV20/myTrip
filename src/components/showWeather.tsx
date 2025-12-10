import type { WeatherData } from "../weather";

interface ShowWeatherProps {
  data: WeatherData;
  onClose: () => void;
}

export function ShowWeather({ data, onClose }: ShowWeatherProps) {
  const current = data.current;
  const hourly = data.hourly;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Osaka Weather Details</h2>
          <button
            className="px-2 py-1 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {current && (
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Time</p>
              <p>{current.time.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Temperature</p>
              <p>{current.temperature_2m.toFixed(1)}°C</p>
            </div>
            <div>
              <p className="text-gray-500">Feels like</p>
              <p>{current.apparent_temperature.toFixed(1)}°C</p>
            </div>
            <div>
              <p className="text-gray-500">Rain intensity</p>
              <p>{current.rain.toFixed(2)} mm/h</p>
            </div>
            <div>
              <p className="text-gray-500">Snow accumulation</p>
              <p>{current.snowfall.toFixed(2)} mm</p>
            </div>
          </div>
        )}

        {hourly && (
          <div className="text-sm">
            <h3 className="font-medium mb-2">Next hours</h3>
            <div className="grid grid-cols-3 gap-2 mb-1 text-gray-500 text-xs">
              <span>Hour</span>
              <span>Temp (°C)</span>
              <span>Rain / Snow</span>
            </div>
            <div className="max-h-52 overflow-y-auto border-t border-gray-100 pt-1">
              {hourly.temperature_2m.map((temp, idx) => {
                const rain = hourly.rain?.[idx];
                const snow = hourly.snowfall?.[idx];

                const now = current?.time ?? new Date();
                const hourDate = new Date(now.getTime() + idx * 60 * 60 * 1000);

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-3 gap-2 py-1 border-b border-gray-50"
                  >
                    <span className="text-xs text-gray-600">
                      {hourDate.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>{Number.isFinite(temp) ? temp.toFixed(1) : "-"}</span>
                    <span className="text-xs">
                      {rain != null && Number.isFinite(rain)
                        ? `${rain.toFixed(2)} mm`
                        : "-"}
                      {" / "}
                      {snow != null && Number.isFinite(snow)
                        ? `${snow.toFixed(2)} mm`
                        : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}