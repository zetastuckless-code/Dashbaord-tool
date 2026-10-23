// Getting started: three steps to a client's pacing (IO, report, open the client), then the optional automations.
// Progress is read from the workspace itself, so a teammate who already has data never sees the welcome.

export const ONBOARDING_KEY = "northstar-onboarding";

export function readOnboarding(storage) {
  try {
    const value = JSON.parse(storage.getItem(ONBOARDING_KEY));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function writeOnboarding(storage, value) {
  try {
    storage.setItem(ONBOARDING_KEY, JSON.stringify(value));
  } catch {
    // Storage is full or blocked: the checklist simply shows again next visit.
  }
  return value;
}

/**
 * Works out where a teammate is in setup. `ioClient` and `reportClient` name the first client with an IO or report,
 * so the next step can point at the same client. `mode` is "welcome" (empty workspace, full-page welcome),
 * "checklist" (data is in, a compact checklist stays on the overview), or "hidden".
 */
export function setupProgress({ campaigns = [], totals = {}, state = {}, isPlaceholder = () => false } = {}) {
  // Totals are keyed "Client::Campaign"; an IO on its own adds only placeholder records, which are not a report.
  const ioClients = [...new Set(Object.keys(totals).map(key => key.split("::")[0]).filter(Boolean))];
  const reportClients = [...new Set(campaigns.filter(record => !isPlaceholder(record)).map(record => record.client).filter(Boolean))];
  const io = ioClients.length > 0;
  const report = reportClients.length > 0;
  const opened = Boolean(state.openedClient);
  const reportClient = reportClients.find(client => ioClients.includes(client)) || reportClients[0] || null;
  const steps = [
    { id: "io", done: io },
    { id: "report", done: report },
    { id: "open", done: opened }
  ];
  const doneCount = steps.filter(step => step.done).length;
  const empty = !io && !report;
  const mode = state.dismissed ? "hidden" : empty || (io && !report) ? "welcome" : "checklist";
  return { steps, doneCount, coreDone: doneCount === steps.length, ioClient: ioClients[0] || null, reportClient, mode };
}
