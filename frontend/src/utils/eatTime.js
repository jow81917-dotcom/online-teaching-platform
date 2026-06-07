// frontend/src/utils/eatTime.js
// All times displayed in the admin panel use East Africa Time (EAT = UTC+3)

const TZ = 'Africa/Nairobi';

/** "10:30 AM" */
export const eatTime = iso =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—';

/** "Jun 7, 2026, 10:30 AM" */
export const eatFull = iso =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—';

/** "Saturday, June 7, 2026" */
export const eatDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ }) : '—';

/** "Jun 7, 2026" */
export const eatShortDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ }) : '—';

/** "Today's date as YYYY-MM-DD in EAT" */
export const eatTodayISO = () => {
  const now = new Date();
  // Format in EAT then parse back to YYYY-MM-DD
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // en-CA gives YYYY-MM-DD format
};

/** Relative time: "2h ago", "Just now", etc. Falls back to eatShortDate */
export const eatAgo = iso => {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return eatShortDate(iso);
};

/** "Today's date header line" e.g. "Saturday, June 7, 2026" */
export const eatTodayLabel = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ });
