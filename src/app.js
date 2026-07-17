const STORAGE_KEY = "clinician-tracker-followers-v1";
const IMPORT_KEY = "clinician-tracker-last-import-v1";

const stages = ["New Follower", "Messaged", "Responded", "Potential Lead", "Offer Shared", "Purchased"];
const audienceTypes = ["", "New Clinician", "Established Clinician", "Student / Intern", "Supervisor", "Professional Connection", "Unsure"];
const offerTypes = ["", "Workshop", "12-Week Program", "Collaboration", "Professional Connection", "Not a Fit Right Now"];

const demoFollowers = [
  recordForHandle("newtherapistjane", "Demo", {
    audienceType: "New Clinician",
    potentialOffer: "Workshop",
    instagramFollowedAt: "2026-07-16T14:40:00.000Z",
  }),
  recordForHandle("therapygrad2026", "Demo", {
    audienceType: "New Clinician",
    potentialOffer: "12-Week Program",
    instagramFollowedAt: "2026-07-16T13:05:00.000Z",
  }),
  recordForHandle("groundedclinician", "Demo", {
    relationshipStage: "Messaged",
    audienceType: "Established Clinician",
    potentialOffer: "Collaboration",
    instagramFollowedAt: "2026-07-15T18:08:00.000Z",
  }),
  recordForHandle("supervisionnotes", "Demo", {
    relationshipStage: "Potential Lead",
    audienceType: "New Clinician",
    potentialOffer: "Workshop",
    instagramFollowedAt: "2026-07-12T09:31:00.000Z",
  }),
  recordForHandle("practicebuilder", "Demo", {
    relationshipStage: "Responded",
    audienceType: "Established Clinician",
    potentialOffer: "Professional Connection",
    instagramFollowedAt: "2026-07-10T16:12:00.000Z",
  }),
];

let followers = loadFollowers();
let lastImport = loadLastImport();
let searchQuery = "";
let stageFilter = "";
let audienceFilter = "";
let offerFilter = "";
let newOnlyFilter = false;

const els = {
  statusCopy: document.getElementById("status-copy"),
  totalCount: document.getElementById("total-count"),
  newCount: document.getElementById("new-count"),
  messageCount: document.getElementById("message-count"),
  warmCount: document.getElementById("warm-count"),
  handlesInput: document.getElementById("handles-input"),
  importResult: document.getElementById("import-result"),
  newestPill: document.getElementById("newest-pill"),
  newestList: document.getElementById("newest-list"),
  followersTable: document.getElementById("followers-table"),
  pipeline: document.getElementById("pipeline"),
  searchInput: document.getElementById("search-input"),
  stageFilter: document.getElementById("stage-filter"),
  audienceFilter: document.getElementById("audience-filter"),
  offerFilter: document.getElementById("offer-filter"),
  newFilter: document.getElementById("new-filter"),
  filteredCount: document.getElementById("filtered-count"),
  targetAccount: document.getElementById("target-account"),
  watchPlanResult: document.getElementById("watch-plan-result"),
};

hydrateFilterOptions();
document.getElementById("import-handles-button").addEventListener("click", importPastedHandles);
document.getElementById("json-file-input").addEventListener("change", importJsonFiles);
document.getElementById("load-demo-button").addEventListener("click", loadDemo);
document.getElementById("clear-button").addEventListener("click", clearData);
document.getElementById("download-csv-button").addEventListener("click", downloadCsv);
document.getElementById("download-csv-button-side").addEventListener("click", downloadCsv);
document.getElementById("download-json-button").addEventListener("click", downloadJson);
document.getElementById("reset-filters-button").addEventListener("click", resetFilters);
document.getElementById("copy-watch-plan-button").addEventListener("click", copyWatchPlan);
els.searchInput.addEventListener("input", (event) => {
  searchQuery = event.target.value.trim().toLowerCase();
  render();
});
els.stageFilter.addEventListener("change", (event) => {
  stageFilter = event.target.value;
  render();
});
els.audienceFilter.addEventListener("change", (event) => {
  audienceFilter = event.target.value;
  render();
});
els.offerFilter.addEventListener("change", (event) => {
  offerFilter = event.target.value;
  render();
});
els.newFilter.addEventListener("change", (event) => {
  newOnlyFilter = event.target.checked;
  render();
});

render();

function importPastedHandles() {
  const handles = extractHandles(els.handlesInput.value);

  if (!handles.length) {
    els.importResult.textContent = "Paste at least one handle or Instagram profile URL first.";
    return;
  }

  const result = upsertHandles(handles, "Pasted Instagram follower list");
  els.handlesInput.value = "";
  els.importResult.textContent = `${result.newCount} new follower${result.newCount === 1 ? "" : "s"} added. ${followers.length} total known.`;
  render();
}

async function importJsonFiles(event) {
  const files = [...event.target.files];
  if (!files.length) return;

  const handles = [];

  for (const file of files) {
    try {
      const json = JSON.parse(await file.text());
      handles.push(...parseInstagramJson(json).map((follower) => follower.handle));
    } catch {
      els.importResult.textContent = `Could not read ${file.name}. Use Instagram JSON export files.`;
      return;
    }
  }

  const result = upsertHandles(handles, "Instagram JSON import");
  els.importResult.textContent = `${result.newCount} new follower${result.newCount === 1 ? "" : "s"} added from JSON. ${followers.length} total known.`;
  event.target.value = "";
  render();
}

function upsertHandles(rawHandles, source) {
  const now = new Date().toISOString();
  const existing = new Map(followers.map((follower) => [follower.handle, follower]));
  const newHandles = [];

  for (const handle of uniqueHandles(rawHandles)) {
    if (!existing.has(handle)) {
      const record = recordForHandle(handle, source, {
        firstDetectedAt: now,
        lastSeenAt: now,
      });
      existing.set(handle, record);
      newHandles.push(handle);
      continue;
    }

    const record = existing.get(handle);
    existing.set(handle, {
      ...record,
      lastSeenAt: now,
      status: "Current",
    });
  }

  followers = [...existing.values()].sort(sortByNewest);
  lastImport = {
    importedAt: now,
    source,
    submittedCount: rawHandles.length,
    newCount: newHandles.length,
    newHandles,
  };
  save();

  return lastImport;
}

function render() {
  const rows = visibleFollowers();
  const newHandles = new Set(lastImport?.newHandles || []);
  const warmOffers = new Set(["Workshop", "12-Week Program"]);

  els.totalCount.textContent = followers.length;
  els.newCount.textContent = newHandles.size;
  els.messageCount.textContent = followers.filter((follower) => follower.relationshipStage === "New Follower").length;
  els.warmCount.textContent = followers.filter((follower) => warmOffers.has(follower.potentialOffer)).length;
  els.statusCopy.textContent = followers.length
    ? `${followers.length} saved follower${followers.length === 1 ? "" : "s"} in this browser.`
    : "Ready for pasted handles or Instagram export files.";
  els.filteredCount.textContent = `${rows.length} shown`;

  renderNewest(followers.slice().sort(sortByNewest).slice(0, 10), newHandles);
  renderTable(rows, newHandles);
  renderPipeline();
}

function renderNewest(rows, newHandles) {
  els.newestPill.textContent = `${rows.length} shown`;
  if (!rows.length) {
    els.newestList.innerHTML = `<div class="empty">No followers yet. Paste handles or load the demo to preview the CRM.</div>`;
    return;
  }

  els.newestList.innerHTML = rows
    .map((follower) => {
      const isNew = newHandles.has(follower.handle);
      return `
        <article class="follower-card">
          <div class="avatar">${escapeHtml(follower.handle.slice(0, 1).toUpperCase())}</div>
          <div class="follower-main">
            <strong>@${escapeHtml(follower.handle)}</strong>
            <span>${escapeHtml(follower.audienceType || "Audience not set")} · ${formatDate(follower.firstDetectedAt)}</span>
          </div>
          <span class="status ${isNew ? "new" : ""}">${isNew ? "New" : escapeHtml(follower.relationshipStage || "Saved")}</span>
        </article>
      `;
    })
    .join("");
}

function renderTable(rows, newHandles) {
  if (!rows.length) {
    els.followersTable.innerHTML = `<tr><td colspan="6" class="empty-table">No matching followers.</td></tr>`;
    return;
  }

  els.followersTable.innerHTML = rows
    .map((follower) => `
      <tr data-handle="${escapeHtml(follower.handle)}">
        <td>
          <div class="table-handle">
            <strong>@${escapeHtml(follower.handle)}</strong>
            ${newHandles.has(follower.handle) ? '<span class="mini-pill">New</span>' : ""}
          </div>
        </td>
        <td>${selectHtml("relationshipStage", follower.handle, stages, follower.relationshipStage)}</td>
        <td>${selectHtml("audienceType", follower.handle, audienceTypes, follower.audienceType)}</td>
        <td>${selectHtml("potentialOffer", follower.handle, offerTypes, follower.potentialOffer)}</td>
        <td><input class="notes-input" data-field="notes" data-handle="${escapeHtml(follower.handle)}" value="${escapeAttribute(follower.notes || "")}" placeholder="Add note" /></td>
        <td><button class="icon-button delete-button" data-handle="${escapeHtml(follower.handle)}" type="button" aria-label="Delete @${escapeAttribute(follower.handle)}">Delete</button></td>
      </tr>
    `)
    .join("");

  els.followersTable.querySelectorAll("select, input").forEach((input) => {
    input.addEventListener("change", updateFollowerField);
  });
  els.followersTable.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", deleteFollower);
  });
}

function renderPipeline() {
  const max = Math.max(1, ...stages.map((stage) => followers.filter((follower) => follower.relationshipStage === stage).length));

  els.pipeline.innerHTML = stages
    .map((stage) => {
      const count = followers.filter((follower) => follower.relationshipStage === stage).length;
      const width = Math.max(4, Math.round((count / max) * 100));
      return `
        <div class="stage-row">
          <div>
            <div class="stage-label">${stage}</div>
            <div class="bar"><span style="width: ${width}%"></span></div>
          </div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function updateFollowerField(event) {
  const handle = event.target.dataset.handle;
  const field = event.target.dataset.field;
  followers = followers.map((follower) =>
    follower.handle === handle
      ? {
          ...follower,
          [field]: event.target.value,
        }
      : follower
  );
  save();
  render();
}

function deleteFollower(event) {
  const handle = event.target.dataset.handle;
  const confirmed = window.confirm(`Delete @${handle} from ClinicianTracker?`);
  if (!confirmed) return;

  followers = followers.filter((follower) => follower.handle !== handle);
  if (lastImport?.newHandles?.includes(handle)) {
    lastImport = {
      ...lastImport,
      newHandles: lastImport.newHandles.filter((newHandle) => newHandle !== handle),
      newCount: Math.max(0, (lastImport.newCount || 0) - 1),
    };
  }
  save();
  render();
}

function loadDemo() {
  followers = demoFollowers.map((follower) => ({ ...follower }));
  lastImport = {
    importedAt: new Date().toISOString(),
    source: "Demo",
    submittedCount: followers.length,
    newCount: 2,
    newHandles: ["newtherapistjane", "therapygrad2026"],
  };
  save();
  els.importResult.textContent = "Demo data loaded.";
  render();
}

function clearData() {
  const confirmed = window.confirm("Clear all saved follower CRM data from this browser?");
  if (!confirmed) return;
  followers = [];
  lastImport = null;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(IMPORT_KEY);
  els.importResult.textContent = "Saved data cleared.";
  render();
}

function downloadCsv() {
  const headers = [
    "Instagram Handle",
    "Profile URL",
    "First Detected",
    "Last Seen",
    "Instagram Followed At",
    "Status",
    "Source",
    "Relationship Stage",
    "Audience Type",
    "Potential Offer",
    "Notes",
  ];

  const rows = followers.map((follower) => [
    follower.handle,
    follower.profileUrl,
    follower.firstDetectedAt,
    follower.lastSeenAt,
    follower.instagramFollowedAt,
    follower.status,
    follower.source,
    follower.relationshipStage,
    follower.audienceType,
    follower.potentialOffer,
    follower.notes,
  ]);

  downloadFile("clinician-tracker-airtable.csv", toCsv([headers, ...rows]), "text/csv");
}

function downloadJson() {
  const payload = JSON.stringify({ followers, lastImport }, null, 2);
  downloadFile("clinician-tracker-backup.json", payload, "application/json");
}

function copyWatchPlan() {
  const account = els.targetAccount.value.trim() || "@theconfidentclinician";
  const plan = [
    `Daily watcher plan for ${account}`,
    "",
    "1. Store follower records in Airtable or Supabase instead of browser localStorage.",
    "2. Run a Netlify Scheduled Function once per day.",
    "3. Use approved Instagram/Meta access for counts and interactions, or a compliant third-party service for identity snapshots.",
    "4. Compare today's snapshot to yesterday's known handles.",
    "5. Add newly detected handles to ClinicianTracker as New Follower.",
    "6. Notify by email/Slack only when new handles are detected.",
    "",
    "Note: avoid automated login scraping of Instagram follower modals because it can be brittle and may put the account at risk.",
  ].join("\n");

  navigator.clipboard?.writeText(plan);
  els.watchPlanResult.textContent = "Daily watcher plan copied.";
}

function extractHandles(text) {
  const ignored = new Set(["instagram", "explore", "accounts", "direct", "reel", "reels", "stories", "p"]);
  const found = new Set();
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})(?:[/?#]|$)/g,
    /@([A-Za-z0-9._]{1,30})/g,
    /(^|\s)([A-Za-z0-9._]{3,30})(?=\s|$)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const handle = normalizeHandle(match[2] || match[1]);
      if (handle && !ignored.has(handle) && !handle.includes("..")) {
        found.add(handle);
      }
    }
  }

  return [...found];
}

function parseInstagramJson(json) {
  const entries = Array.isArray(json) ? json : Object.values(json).flat();
  const parsed = [];

  for (const entry of entries) {
    if (!Array.isArray(entry?.string_list_data)) continue;
    for (const item of entry.string_list_data) {
      const handle = normalizeHandle(item?.value);
      if (!handle) continue;
      parsed.push({
        handle,
        profileUrl: item?.href || `https://www.instagram.com/${handle}/`,
        instagramFollowedAt: item?.timestamp ? new Date(item.timestamp * 1000).toISOString() : "",
      });
    }
  }

  return parsed;
}

function visibleFollowers() {
  const newHandles = new Set(lastImport?.newHandles || []);
  return followers
    .filter((follower) => !searchQuery || follower.handle.includes(searchQuery))
    .filter((follower) => !stageFilter || follower.relationshipStage === stageFilter)
    .filter((follower) => !audienceFilter || follower.audienceType === audienceFilter)
    .filter((follower) => !offerFilter || follower.potentialOffer === offerFilter)
    .filter((follower) => !newOnlyFilter || newHandles.has(follower.handle))
    .sort(sortByNewest);
}

function hydrateFilterOptions() {
  fillSelect(els.stageFilter, stages, "All stages");
  fillSelect(els.audienceFilter, audienceTypes.filter(Boolean), "All audiences");
  fillSelect(els.offerFilter, offerTypes.filter(Boolean), "All offers");
}

function fillSelect(select, options, firstLabel) {
  select.innerHTML = [`<option value="">${firstLabel}</option>`, ...options.map((option) => `<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`)].join("");
}

function resetFilters() {
  searchQuery = "";
  stageFilter = "";
  audienceFilter = "";
  offerFilter = "";
  newOnlyFilter = false;
  els.searchInput.value = "";
  els.stageFilter.value = "";
  els.audienceFilter.value = "";
  els.offerFilter.value = "";
  els.newFilter.checked = false;
  render();
}

function recordForHandle(handle, source, overrides = {}) {
  const now = new Date().toISOString();
  const normalized = normalizeHandle(handle);
  return {
    handle: normalized,
    profileUrl: `https://www.instagram.com/${normalized}/`,
    instagramFollowedAt: "",
    firstDetectedAt: now,
    lastSeenAt: now,
    source,
    relationshipStage: "New Follower",
    audienceType: "",
    potentialOffer: "",
    notes: "",
    status: "Current",
    ...overrides,
  };
}

function normalizeHandle(value) {
  if (!value || typeof value !== "string") return "";
  return value.replace(/^@/, "").trim().toLowerCase().replace(/[^a-z0-9._]/g, "");
}

function uniqueHandles(handles) {
  return [...new Set(handles.map(normalizeHandle).filter(Boolean))];
}

function sortByNewest(a, b) {
  return dateValue(b.firstDetectedAt || b.instagramFollowedAt) - dateValue(a.firstDetectedAt || a.instagramFollowedAt);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(followers));
  localStorage.setItem(IMPORT_KEY, JSON.stringify(lastImport));
}

function loadFollowers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadLastImport() {
  try {
    return JSON.parse(localStorage.getItem(IMPORT_KEY) || "null");
  } catch {
    return null;
  }
}

function selectHtml(field, handle, options, selectedValue) {
  return `
    <select data-field="${field}" data-handle="${escapeHtml(handle)}">
      ${options.map((option) => `<option value="${escapeAttribute(option)}" ${option === selectedValue ? "selected" : ""}>${escapeHtml(option || "Not set")}</option>`).join("")}
    </select>
  `;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n")}\n`;
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function dateValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
