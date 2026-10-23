// The dashboard's background sky. It follows the time of day on its own, and the local weather when you turn that on.
// Weather comes from Open-Meteo (free, no key). Only a rounded location is sent, and only after you ask for it.

export const SKY_KEY = "northstar-sky";

/** Morning, day, evening or night, from the local hour (sunrise and sunset are approximated by the clock). */
export function skyTime(hour) {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

/** Maps a WMO weather code (what Open-Meteo returns) to one of the sky's moods. */
export function skyWeather(code) {
  if (!Number.isFinite(code)) return "clear";
  if (code <= 1) return "clear";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloudy";
}

export const SKY_LABEL = { clear: "Clear", cloudy: "Cloudy", fog: "Foggy", rain: "Rain", snow: "Snow", storm: "Storms" };

export function readSkySettings(storage) {
  try {
    const value = JSON.parse(storage.getItem(SKY_KEY));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

/** Rounds a coordinate to about 10 km, which is plenty for weather and says little about where you are. */
export const roundCoord = value => Math.round(value * 10) / 10;

export function weatherUrl({ latitude, longitude }) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${roundCoord(latitude)}&longitude=${roundCoord(longitude)}&current=weather_code,is_day`;
}
