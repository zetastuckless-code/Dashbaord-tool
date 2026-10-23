// Each client gets a small character: a hand-drawn shape with a face and two legs, so clients are easy to tell apart
// in the sidebar. You can drag clients into your own order; new clients join at the bottom.

export const CLIENT_ORDER_KEY = "northstar-client-order";

export function readClientOrder(storage) {
  try {
    const value = JSON.parse(storage.getItem(CLIENT_ORDER_KEY));
    return Array.isArray(value) ? value.filter(name => typeof name === "string") : [];
  } catch {
    return [];
  }
}

export function writeClientOrder(storage, order) {
  try { storage.setItem(CLIENT_ORDER_KEY, JSON.stringify(order)); } catch { /* the order resets next visit */ }
  return order;
}

/** Clients in your order. Ones you haven't placed yet follow, alphabetically. */
export function orderClients(clients, order = []) {
  const rank = new Map(order.map((name, index) => [name, index]));
  return [...clients].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity) || a.localeCompare(b));
}

/** Moves one client to a new position and returns the whole order. */
export function moveClient(clients, client, toIndex) {
  const rest = clients.filter(name => name !== client);
  const index = Math.max(0, Math.min(rest.length, toIndex));
  return [...rest.slice(0, index), client, ...rest.slice(index)];
}

const hash = text => [...String(text)].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 2166136261);

// Radius at angle t (0 to 2π) for each body shape, as a share of the full radius.
const SHAPES = {
  star: { points: 14, radius: (t, i) => (i % 2 ? 0.58 : 1) },
  flower: { radius: t => 0.8 + 0.2 * Math.cos(5 * t) },
  blob: { radius: (t, i, seed) => 0.9 + 0.07 * Math.sin(2 * t + seed) + 0.05 * Math.sin(3 * t + seed * 2) },
  sun: { points: 24, radius: (t, i) => (i % 2 ? 0.8 : 1) },
  clover: { radius: t => 0.66 + 0.34 * Math.abs(Math.cos(2 * t)) },
  cloud: { radius: t => 0.82 + 0.18 * Math.abs(Math.sin(3 * t + 0.5)) },
  pebble: { radius: t => 0.84 / Math.pow(Math.pow(Math.abs(Math.cos(t)), 4) + Math.pow(Math.abs(Math.sin(t)), 4), 1 / 4) },
  burst: { points: 10, radius: (t, i) => (i % 2 ? 0.62 : 1) }
};
export const CHARACTER_SHAPES = Object.keys(SHAPES);
export const CHARACTER_COLORS = ["#e85d30", "#4b5beb", "#2e9e6e", "#e2649f", "#e8a325", "#7a5cfa", "#1c9fa0", "#d9463d"];

// A closed, smooth path through the points (Catmull-Rom turned into cubic curves).
function smoothPath(points) {
  const at = index => points[(index + points.length) % points.length];
  const f = value => value.toFixed(2);
  let path = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let index = 0; index < points.length; index += 1) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
    path += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${path}Z`;
}

function bodyPath(shape, seed) {
  const { points = 48, radius } = SHAPES[shape];
  const [cx, cy, size] = [16, 13.5, 12];
  const tilt = (seed % 10) / 40;
  const list = Array.from({ length: points }, (_, index) => {
    const t = (index / points) * Math.PI * 2 - Math.PI / 2 + tilt;
    // A little wobble keeps every edge looking drawn by hand.
    const r = size * radius(t, index, seed % 7) * (1 + 0.03 * Math.sin(t * 2 + seed) + 0.015 * Math.sin(t * 3 + seed / 3));
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
  return smoothPath(list);
}

/**
 * Gives every client a character. Each client keeps the shape and color its name picks; when an earlier client
 * (alphabetically) already has that pairing, it moves on to the next free one, so two clients rarely look alike.
 */
export function clientCharacters(clients) {
  const result = new Map();
  const usedShapes = new Set();
  const usedColors = new Set();
  // The next free option from the one the name picks; once all are in use, they start over.
  const pick = (options, used, start) => {
    if (used.size >= options.length) used.clear();
    let index = start % options.length;
    while (used.has(options[index])) index = (index + 1) % options.length;
    used.add(options[index]);
    return options[index];
  };
  for (const client of [...clients].sort((a, b) => a.localeCompare(b))) {
    const seed = hash(client);
    result.set(client, { shape: pick(CHARACTER_SHAPES, usedShapes, seed), color: pick(CHARACTER_COLORS, usedColors, seed >>> 5), seed });
  }
  return result;
}

/** The character as inline SVG. Decorative: the client's name sits right beside it. */
export function characterSvg({ shape, color, seed }) {
  const lean = (seed % 5) - 2;
  const legs = `<path d="M13 22.5c-.6 2.6-2 4.4-2.6 6.2" /><path d="M19 22.5c.2 2.4.1 4.4 1.6 6.1" />`;
  return `<svg class="client-character" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round">${legs}</g><path d="${bodyPath(shape, seed)}" fill="${color}" transform="rotate(${lean} 16 13.5)" /><g fill="#fbf3ea"><ellipse cx="13.4" cy="12" rx="1.15" ry="1.5" /><ellipse cx="18.6" cy="12" rx="1.15" ry="1.5" /></g><path d="M13.6 15.4c1.4 1.6 3.4 1.6 4.8 0" fill="none" stroke="#fbf3ea" stroke-width="1.5" stroke-linecap="round" /></svg>`;
}
