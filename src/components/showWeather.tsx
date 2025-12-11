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
              <p>{current.temperature.toFixed(1)}°C</p>
            </div>
            <div>
              <p className="text-gray-500">Feels like</p>
              <p>{current.apparentTemperature.toFixed(1)}°C</p>
            </div>
            {Array.isArray(current.tempRange) && current.tempRange.length >= 2 && (
              <div>
                <p className="text-gray-500">Temperature Range</p>
                <p>
                  {current.tempRange[0].toFixed(1)}°C - {current.tempRange[1].toFixed(1)}°C
                </p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Rain intensity</p>
              <p>{current.rain.toFixed(2)} mm/h</p>
            </div>
            <div>
              <p className="text-gray-500">Snow accumulation</p>
              <p>{current.snowfall.toFixed(2)} mm</p>
            </div>
            <div>
              <p className="text-gray-500">Precipitation prob.</p>
              <p>{Number.isFinite(current.precipitationProbability) ? `${current.precipitationProbability.toFixed(0)}%` : "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Precipitation type</p>
              <p>
                {(() => {
                  switch (Math.round(current.precipitationType ?? NaN)) {
                    case 0:
                      return "None";
                    case 1:
                      return "Rain";
                    case 2:
                      return "Snow";
                    case 3:
                      return "Freezing Rain";
                    case 4:
                      return "Ice";
                    default:
                      return "-";
                  }
                })()}
              </p>
            </div>
          </div>
        )}

        {hourly && (
          <div className="text-sm">
            <h3 className="font-medium mb-2">Next hours</h3>
            <div className="grid grid-cols-4 gap-2 mb-1 text-gray-500 text-xs">
              <span>Hour</span>
              <span>Temp (°C)</span>
              <span>Rain / Snow</span>
              <span>Type</span>
            </div>
            <div className="max-h-52 overflow-y-auto border-t border-gray-100 pt-1">
              {hourly.temperature.slice(0,24).map((temp, idx) => {

                const now = current?.time ?? new Date();
                const hourDate = new Date(now.getTime() + idx * 60 * 60 * 1000);

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-4 gap-2 py-1 border-b border-gray-50 text-xs"
                  >
                    <span className="text-xs text-gray-600">
                      {hourDate.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>{Number.isFinite(temp) ? temp.toFixed(1) : "-"}</span>
                    <span>
                      {hourly.rain && hourly.snowfall
                        ? `${Number.isFinite(hourly.rain[idx]) ? hourly.rain[idx].toFixed(2) : "0.00"} / ${Number.isFinite(hourly.snowfall[idx]) ? hourly.snowfall[idx].toFixed(2) : "0.00"}`
                        : "-"}
                    </span>
                    <span>
                      {hourly.precipitationType
                        ? (() => {
                            switch (Math.round(hourly.precipitationType[idx] ?? NaN)) {
                              case 0:
                                return "None";
                              case 1:
                                return "Rain";
                              case 2:
                                return "Snow";
                              case 3:
                                return "Freezing Rain";
                              case 4:
                                return "Ice Pellets";
                              default:
                                return "-";
                            }
                          })()
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