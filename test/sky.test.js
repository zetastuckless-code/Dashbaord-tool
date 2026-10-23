import test from "node:test";
import assert from "node:assert/strict";
import { roundCoord, skyTime, skyWeather, weatherUrl } from "../lib/sky.js";

test("sky time follows the clock", () => {
  assert.equal(skyTime(6), "dawn");
  assert.equal(skyTime(12), "day");
  assert.equal(skyTime(18), "dusk");
  assert.equal(skyTime(23), "night");
  assert.equal(skyTime(2), "night");
});

test("weather codes map to sky moods", () => {
  assert.equal(skyWeather(0), "clear");
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
  assert.equal(weatherUrl({ latitude: 40.71277, longitude: -74.00597 }), "https://api.open-meteo.com/v1/forecast?latitude=40.7&longitude=-74&current=weather_code,is_day");
});
