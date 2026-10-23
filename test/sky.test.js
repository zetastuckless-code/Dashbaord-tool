import test from "node:test";
import assert from "node:assert/strict";
import { roundCoord, skyScene, skyTime, skyWeather, sunTimes, weatherUrl } from "../lib/sky.js";

test("sky time follows the clock", () => {
  assert.equal(skyTime(6), "dawn");
  assert.equal(skyTime(12), "day");
  assert.equal(skyTime(18), "sunset");
  assert.equal(skyTime(19.5), "dusk");
  assert.equal(skyTime(23), "night");
  assert.equal(skyTime(2), "night");
});

test("weather codes map to sky moods", () => {
  assert.equal(skyWeather(0), "clear");
  assert.equal(skyWeather(2), "partly");
  assert.equal(skyWeather(3), "cloudy");
  assert.equal(skyWeather(45), "fog");
  assert.equal(skyWeather(61), "rain");
  assert.equal(skyWeather(81), "rain");
  assert.equal(skyWeather(73), "snow");
  assert.equal(skyWeather(86), "snow");
  assert.equal(skyWeather(95), "storm");
  assert.equal(skyWeather(undefined), "clear");
});

test("only a rounded location is sent", () => {
  assert.equal(roundCoord(40.71277), 40.7);
  assert.equal(weatherUrl({ latitude: 40.71277, longitude: -74.00597 }), "https://api.open-meteo.com/v1/forecast?latitude=40.7&longitude=-74&current=weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1");
});

test("the real sunset moves the cotton candy hour", () => {
  const sun = sunTimes({ daily: { sunrise: ["2026-10-23T07:41"], sunset: ["2026-10-23T18:52"] } });
  assert.equal(skyTime(new Date(2026, 9, 23, 17, 30), sun), "sunset");
  assert.equal(skyTime(new Date(2026, 9, 23, 17, 15), sun), "day");
  assert.equal(skyTime(new Date(2026, 9, 23, 19, 30), sun), "dusk");
  assert.equal(skyTime(new Date(2026, 9, 23, 7, 0), sun), "dawn");
  assert.equal(sunTimes({}), null);
});

test("each weather draws its own scene", () => {
  const count = (html, pattern) => (html.match(pattern) || []).length;
  assert.equal(count(skyScene({ weather: "clear" }), /sky-puff/g), 2);
  assert.ok(count(skyScene({ weather: "cloudy" }), /sky-puff/g) > 5);
  assert.ok(skyScene({ weather: "rain" }).includes("sky-rain"));
  assert.ok(skyScene({ weather: "storm" }).includes("sky-lightning"));
  assert.ok(skyScene({ weather: "snow" }).includes("sky-snow"));
  assert.ok(skyScene({ time: "night", weather: "clear" }).includes("sky-stars"));
  assert.ok(!skyScene({ time: "night", weather: "rain" }).includes("sky-stars"));
  assert.equal(skyScene({ weather: "rain", seed: 3 }), skyScene({ weather: "rain", seed: 3 }));
});
