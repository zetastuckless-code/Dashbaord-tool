import { normalizeDashboardView } from "./dashboard-view.js";

const STORAGE_KEY = "northstar-saved-views";
const MAX_SAVED_VIEWS = 10;

export function normalizeSavedViews(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === "object" && String(item.name || "").trim()).slice(0, MAX_SAVED_VIEWS).map(item => ({
    id: String(item.id || item.name).trim(),
    name: String(item.name).trim().slice(0, 60),
    view: normalizeDashboardView(item.view),
    savedAt: String(item.savedAt || "")
  }));
}

export function saveNamedView(views, name, view, savedAt = new Date().toISOString()) {
  const normalizedName = String(name || "").trim().slice(0, 60);
  if (!normalizedName) return { valid: false, error: "Enter a name for this view.", views: normalizeSavedViews(views) };
  const id = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "saved-view";
  const remaining = normalizeSavedViews(views).filter(item => item.id !== id && item.name.toLowerCase() !== normalizedName.toLowerCase());
  return { valid: true, error: "", view: { id, name: normalizedName, view: normalizeDashboardView(view), savedAt }, views: [{ id, name: normalizedName, view: normalizeDashboardView(view), savedAt }, ...remaining].slice(0, MAX_SAVED_VIEWS) };
}

export function removeNamedView(views, id) {
  return normalizeSavedViews(views).filter(item => item.id !== id);
}

export function readSavedViews(storage) {
  try { return normalizeSavedViews(JSON.parse(storage.getItem(STORAGE_KEY))); }
  catch { return []; }
}

export function writeSavedViews(storage, views) {
  const normalized = normalizeSavedViews(views);
  storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
