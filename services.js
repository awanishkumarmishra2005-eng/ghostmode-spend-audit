// Known services used to label findings. Keywords are matched against merchant names.
// IMPORTANT: accountUrl values are general account/billing pages and were NOT verified
// on every release. Check each link, then update lastChecked before relying on it.
const SERVICES = [
  { name: "Netflix", keywords: ["netflix"], accountUrl: "https://www.netflix.com/", lastChecked: "Not verified" },
  { name: "Spotify", keywords: ["spotify"], accountUrl: "https://www.spotify.com/account/", lastChecked: "Not verified" },
  { name: "YouTube Premium", keywords: ["youtube"], accountUrl: "https://www.youtube.com/paid_memberships", lastChecked: "Not verified" },
  { name: "Amazon Prime", keywords: ["prime video", "amazon prime"], accountUrl: "https://www.amazon.com/yourmembershipsandsubscriptions", lastChecked: "Not verified" },
  { name: "Adobe", keywords: ["adobe"], accountUrl: "https://account.adobe.com/", lastChecked: "Not verified" },
  { name: "Microsoft 365", keywords: ["microsoft", "office 365"], accountUrl: "https://account.microsoft.com/services/", lastChecked: "Not verified" },
  { name: "Google One", keywords: ["google one", "google storage"], accountUrl: "https://one.google.com/", lastChecked: "Not verified" },
  { name: "Dropbox", keywords: ["dropbox"], accountUrl: "https://www.dropbox.com/account/plan", lastChecked: "Not verified" },
  { name: "Zoom", keywords: ["zoom"], accountUrl: "https://zoom.us/billing", lastChecked: "Not verified" },
  { name: "Slack", keywords: ["slack"], accountUrl: "https://slack.com/account", lastChecked: "Not verified" },
  { name: "Notion", keywords: ["notion"], accountUrl: "https://www.notion.so/", lastChecked: "Not verified" },
  { name: "Canva", keywords: ["canva"], accountUrl: "https://www.canva.com/settings/billing", lastChecked: "Not verified" },
  { name: "Figma", keywords: ["figma"], accountUrl: "https://www.figma.com/", lastChecked: "Not verified" },
  { name: "GitHub", keywords: ["github"], accountUrl: "https://github.com/settings/billing", lastChecked: "Not verified" },
  { name: "Hotstar / Disney+", keywords: ["hotstar", "disney"], accountUrl: "https://www.hotstar.com/", lastChecked: "Not verified" },
];
