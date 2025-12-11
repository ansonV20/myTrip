// Tomorrow.io weather fetch for Osaka

export interface WeatherData {
  current?: {
    time: Date;
    temperature: number;
    tempRange: [number, number];
    rain: number; // mm/h
    snowfall: number; // mm
    apparentTemperature: number;
    precipitationProbability: number; // %
    precipitationType: number; // 0-4 as per Tomorrow.io docs
  };
  hourly?: {
    temperature: number[];
    rain: number[];
    snowfall: number[];
    precipitationProbability: number[];
    precipitationType: number[];
  };
}

const OSAKA_LAT = 34.6938;
const OSAKA_LON = 135.5011;

// Reads Tomorrow.io API key from Vite env: VITE_TOMORROW_API_KEY
const API_KEY = import.meta.env.VITE_TOMORROW_API_KEY as string | undefined;

export const weatherData = async (): Promise<WeatherData | null> => {
  if (!API_KEY) {
    console.error("Missing VITE_TOMORROW_API_KEY env var for Tomorrow.io");
    return null;
  }

  const params = new URLSearchParams({
    location: `${OSAKA_LAT},${OSAKA_LON}`,
    apikey: API_KEY,
    units: "metric",
    timesteps: "1h",
    fields: [
      "temperature",
      "temperatureApparent",
      "precipitationIntensity",
      "precipitationProbability",
      "snowIntensity",
      "precipitationType",
    ].join(","),
  });

  const url = `https://api.tomorrow.io/v4/weather/forecast?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Tomorrow.io request failed", res.status, res.statusText);
    return null;
  }

  const json = await res.json();

  const hourlyArray: any[] = json?.timelines?.hourly ?? [];
  if (!Array.isArray(hourlyArray) || hourlyArray.length === 0) {
    console.error("Tomorrow.io hourly data missing", json);
    return null;
  }

  // Use first hour as "current" and also build simple hourly arrays
  const first = hourlyArray[0];
  const values = first?.values ?? {};

  const hourlyTemps: number[] = [];
  const hourlyRain: number[] = [];
  const hourlySnow: number[] = [];
  const hourlyPrecipProb: number[] = [];
  const hourlyPrecipType: number[] = [];

  for (const h of hourlyArray) {
    const v = h.values ?? {};
    hourlyTemps.push(Number(v.temperature ?? NaN));
    hourlyRain.push(Number(v.precipitationIntensity ?? NaN));
    hourlySnow.push(Number(v.snowAccumulation ?? NaN));
    hourlyPrecipProb.push(Number(v.precipitationProbability ?? NaN));
    hourlyPrecipType.push(Number(v.precipitationType ?? NaN));
  }

  const minTemp = Math.min(...hourlyTemps.slice(0,24).filter(t => !isNaN(t)));
  const maxTemp = Math.max(...hourlyTemps.slice(0,24).filter(t => !isNaN(t)));

  const data: WeatherData = {
    current: {
      time: new Date(first.time),
      temperature: Number(values.temperature ?? NaN),
      tempRange: [minTemp, maxTemp],
      rain: Number(values.precipitationIntensity ?? 0),
      snowfall: Number(values.snowAccumulation ?? 0),
      apparentTemperature: Number(values.temperatureApparent ?? values.temperature ?? NaN),
      precipitationProbability: Number(values.precipitationProbability ?? NaN),
      precipitationType: Number(values.precipitationType ?? NaN),
    },
    hourly: {
      temperature: hourlyTemps,
      rain: hourlyRain,
      snowfall: hourlySnow,
      precipitationProbability: hourlyPrecipProb,
      precipitationType: hourlyPrecipType,
    },
  };

  console.log("Tomorrow.io Osaka weather", data);
  return data;
};