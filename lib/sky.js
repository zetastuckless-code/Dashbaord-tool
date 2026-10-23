// The dashboard's background sky. It follows the time of day on its own, and the local weather when you turn that on.
// Weather comes from Open-Meteo (free, no key). Only a rounded location is sent, and only after you ask for it.

export const SKY_KEY = "northstar-sky";

const minutesOf = value => {
  const match = /T?(\d{1,2}):(\d{2})/.exec(String(value ?? ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/**
 * Dawn, day, sunset, dusk or night. `when` is a Date or an hour. With the day's sunrise and sunset ("2026-10-23T19:01"
 * from the weather service) the sky turns with the real sun; without them it assumes 7:00 and 19:00.
 * Sunset is the hour and a half before the sun goes down, when the clouds go cotton-candy pink.
 */
export function skyTime(when, { sunrise, sunset } = {}) {
  const now = when instanceof Date ? when.getHours() * 60 + when.getMinutes() : Number(when) * 60;
  const rise = minutesOf(sunrise) ?? 7 * 60;
  const set = minutesOf(sunset) ?? 19 * 60;
  if (now >= rise - 75 && now < rise + 60) return "dawn";
  if (now >= rise + 60 && now < set - 90) return "day";
  if (now >= set - 90 && now < set + 20) return "sunset";
  if (now >= set + 20 && now < set + 60) return "dusk";
  return "night";
}

/** Maps a WMO weather code (what Open-Meteo returns) to one of the sky's moods. */
export function skyWeather(code) {
  if (!Number.isFinite(code)) return "clear";
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloudy";
}

export const SKY_LABEL = { clear: "Clear", partly: "Partly cloudy", cloudy: "Cloudy", fog: "Foggy", rain: "Rain", snow: "Snow", storm: "Storms" };

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
  return `https://api.open-meteo.com/v1/forecast?latitude=${roundCoord(latitude)}&longitude=${roundCoord(longitude)}&current=weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
}

/** The day's sunrise and sunset from an Open-Meteo reply, as local times. */
export function sunTimes(data) {
  const sunrise = data?.daily?.sunrise?.[0];
  const sunset = data?.daily?.sunset?.[0];
  return sunrise && sunset ? { sunrise, sunset } : null;
}

// A repeatable random sequence, so the clouds and stars stay put between repaints.
function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value ^ (value >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return (value % 10_000) / 10_000;
  };
}

// A puffy cloud: overlapping bumps on a flat base, shaded from the top down.
function cloudSvg(random, id) {
  const bumps = 3 + Math.floor(random() * 3);
  const circles = Array.from({ length: bumps }, (_, index) => {
    const x = 34 + (index / (bumps - 1)) * 132 + (random() - 0.5) * 12;
    const r = 24 + random() * 20 + (index > 0 && index < bumps - 1 ? 12 : 0);
    return `<circle cx="${x.toFixed(1)}" cy="${(78 - r * 0.7).toFixed(1)}" r="${r.toFixed(1)}" />`;
  }).join("");
  return `<svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMax meet"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--cloud-top)" /><stop offset="1" style="stop-color:var(--cloud-bottom)" /></linearGradient></defs><g fill="url(#${id})">${circles}<rect x="14" y="56" width="172" height="34" rx="17" /></g></svg>`;
}

const CLOUDS = { clear: 2, partly: 5, cloudy: 9, fog: 4, rain: 9, storm: 10, snow: 7 };

/**
 * The scene inside the sky: clouds for every weather (a couple of small ones on a clear day), stars on clear nights,
 * and rain, snow, lightning, or mist on top. Positions come from `seed`, so the scene only changes with the weather.
 */
export function skyScene({ time = "day", weather = "clear", seed = 7 } = {}) {
  const random = seeded(seed);
  const parts = [];
  const night = time === "night" || time === "dusk";
  if (night && ["clear", "partly"].includes(weather)) {
    const stars = Array.from({ length: 70 }, () => `<i style="left:${(random() * 100).toFixed(2)}%;top:${(random() * 62).toFixed(2)}%;--size:${(1 + random() * 1.8).toFixed(2)}px;--delay:${(-random() * 6).toFixed(2)}s;--twinkle:${(3 + random() * 4).toFixed(2)}s"></i>`).join("");
    parts.push(`<div class="sky-stars">${stars}</div>`);
  }
  if (time === "night" && weather !== "storm") parts.push('<span class="sky-moon"></span>');
  if (["dawn", "day", "sunset"].includes(time) && ["clear", "partly"].includes(weather)) parts.push('<span class="sky-sun"></span>');
  const count = CLOUDS[weather] ?? 2;
  const clouds = Array.from({ length: count }, (_, index) => {
    // Rain and storm clouds crowd the top of the sky; fair-weather clouds spread out lower.
    const heavy = ["rain", "storm", "cloudy"].includes(weather);
    const top = heavy ? -6 + random() * 30 : 4 + random() * 52;
    const width = (heavy ? 30 : 14) + random() * (heavy ? 26 : 18);
    const depth = index % 3;
    // Spread evenly along the drift, so the sky is never empty or bunched up. --start places it when motion is off.
    const duration = 160 + random() * 120 - depth * 40;
    const along = (index + random() * 0.7) / count;
    return `<div class="sky-puff depth-${depth}" style="top:${top.toFixed(1)}vh;width:${width.toFixed(1)}vw;--start:${(along * 110 - 20).toFixed(1)}vw;--duration:${duration.toFixed(0)}s;--delay:${(-along * duration).toFixed(0)}s">${cloudSvg(random, `sky-cloud-${index}`)}</div>`;
  }).join("");
  parts.push(`<div class="sky-clouds">${clouds}</div>`);
  if (weather === "rain" || weather === "storm") {
    const drops = Array.from({ length: weather === "storm" ? 170 : 130 }, () => `<i style="left:${(random() * 104 - 2).toFixed(2)}%;--length:${(14 + random() * 18).toFixed(0)}px;--speed:${(0.55 + random() * 0.45).toFixed(2)}s;--delay:${(-random() * 2).toFixed(2)}s;--alpha:${(0.35 + random() * 0.45).toFixed(2)}"></i>`).join("");
    parts.push(`<div class="sky-rain">${drops}</div>`);
  }
  if (weather === "storm") parts.push('<span class="sky-lightning"></span>');
  if (weather === "snow") {
    const flakes = Array.from({ length: 110 }, () => `<i style="left:${(random() * 100).toFixed(2)}%;--size:${(2 + random() * 4).toFixed(1)}px;--speed:${(9 + random() * 10).toFixed(1)}s;--delay:${(-random() * 19).toFixed(1)}s;--sway:${(10 + random() * 30).toFixed(0)}px"></i>`).join("");
    parts.push(`<div class="sky-snow">${flakes}</div>`);
  }
  if (weather === "fog") parts.push('<div class="sky-mist"><span></span><span></span><span></span></div>');
  return parts.join("");
}
