const defaultStages = ["New Follower", "Messaged", "Responded", "Potential Lead", "Offer Shared", "Purchased"];
const defaultAudiences = ["", "New Clinician", "Established Clinician", "Student / Intern", "Supervisor", "Professional Connection", "Unsure"];
const defaultOffers = ["", "Workshop", "12-Week Program", "Collaboration", "Professional Connection", "Not a Fit Right Now"];

let followers = [];
let choices = {
  stages: defaultStages,
  audiences: defaultAudiences,
  offers: defaultOffers,
};
let filters = {
  search: "",
  stage: "",
  audience: "",
  offer: "",
};

const els = {
  statusCopy: document.getElementById("status-copy"),
  totalCount: document.getElementById("total-count"),
  newCount: document.getElementById("new-count"),
  warmCount: document.getElementById("warm-count"),
  followUpCount: document.getElementById("follow-up-count"),
  filteredCount: document.getElementById("filtered-count"),
  table: document.getElementById("followers-table"),
  newestList: document.getElementById("newest-list"),
  pipeline: document.getElementById("pipeline"),
  search: document.getElementById("search-input"),
  stageFilter: document.getElementById("stage-filter"),
  audienceFilter: document.getElementById("audience-filter"),
  offerFilter: document.getElementById("offer-filter"),
  handleInput: document.getElementById("handle-input"),
  form: document.getElementById("quick-add-form"),
  formStatus: document.getElementById("form-status"),
};

document.getElementById("refresh-button").addEventListener("click", loadFollowers);
document.getElementById("reset-filters-button").addEventListener("click", resetFilters);
els.search.addEventListener("input", (event) => {
  filters.search = event.target.value.trim().toLowerCase();
  render();
});
els.stageFilter.addEventListener("change", (event) => {
  filters.stage = event.target.value;
  render();
});
els.audienceFilter.addEventListener("change", (event) => {
  filters.audience = event.target.value;
  render();
});
els.offerFilter.addEventListener("change", (event) => {
  filters.offer = event.target.value;
  render();
});
els.form.addEventListener("submit", createFollower);

hydrateChoiceControls();
loadFollowers();

async function loadFollowers() {
  setStatus("Loading Airtable followers...");
  try {
    const data = await apiRequest("/.netlify/functions/followers");
    followers = data.records || [];
    choices = mergeChoices(data.choices || {});
    hydrateChoiceControls();
    render();
    setStatus(`${followers.length} Airtable follower${followers.length === 1 ? "" : "s"} loaded.`);
  } catch (error) {
    followers = [];
    render();
    setStatus(error.message);
  }
}

async function createFollower(event) {
  event.preventDefault();
  const formData = new FormData(els.form);
  const payload = {
    handle: formData.get("handle"),
    relationshipStage: "New Follower",
  };

  if (!normalizeHandle(payload.handle)) {
    els.formStatus.textContent = "Add an Instagram handle first.";
    return;
  }

  els.formStatus.textContent = "Adding to Airtable...";
  try {
    await apiRequest("/.netlify/functions/followers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    els.form.reset();
    els.handleInput.focus();
    els.formStatus.textContent = "Added to Airtable.";
    await loadFollowers();
  } catch (error) {
    els.formStatus.textContent = error.message;
  }
}

async function updateFollowerField(event) {
  const id = event.target.dataset.id;
  const field = event.target.dataset.field;
  const value = event.target.value;

  followers = followers.map((record) => (record.id === id ? { ...record, [field]: value } : record));
  render();

  try {
    await apiRequest("/.netlify/functions/followers", {
      method: "PATCH",
      body: JSON.stringify({ id, fields: { [field]: value } }),
    });
  } catch (error) {
    setStatus(error.message);
    await loadFollowers();
  }
}

async function deleteFollower(event) {
  const id = event.target.dataset.id;
  const handle = event.target.dataset.handle;
  const confirmed = window.confirm(`Delete @${handle} from Airtable?`);
  if (!confirmed) return;

  try {
    await apiRequest(`/.netlify/functions/followers?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    followers = followers.filter((record) => record.id !== id);
    render();
    setStatus(`Deleted @${handle}.`);
  } catch (error) {
    setStatus(error.message);
  }
}

function render() {
  const rows = filteredFollowers();
  const warmOffers = new Set(["Workshop", "12-Week Program"]);

  els.totalCount.textContent = followers.length;
  els.newCount.textContent = followers.filter((record) => record.relationshipStage === "New Follower").length;
  els.warmCount.textContent = followers.filter((record) => warmOffers.has(record.potentialOffer)).length;
  els.followUpCount.textContent = followers.filter((record) => Boolean(record.potentialOffer)).length;
  els.filteredCount.textContent = `${rows.length} shown`;

  renderTable(rows);
  renderPipeline();
  renderNewest();
}

function renderTable(rows) {
  if (!rows.length) {
    els.table.innerHTML = `<tr><td colspan="7" class="empty-table">No matching followers.</td></tr>`;
    return;
  }

  els.table.innerHTML = rows
    .map((record) => `
      <tr>
        <td data-label="Handle">
          <a class="handle-link" href="https://www.instagram.com/${escapeAttribute(record.handle)}/" target="_blank" rel="noreferrer">@${escapeHtml(record.handle)}</a>
        </td>
        <td data-label="Date">${formatDate(record.dateAdded || record.createdTime)}</td>
        <td data-label="Status">${selectHtml(record.id, "relationshipStage", choices.stages, record.relationshipStage)}</td>
        <td data-label="Audience">${selectHtml(record.id, "audienceType", choices.audiences, record.audienceType)}</td>
        <td data-label="Offer">${selectHtml(record.id, "potentialOffer", choices.offers, record.potentialOffer)}</td>
        <td data-label="Notes"><input class="notes-input" data-id="${record.id}" data-field="notes" value="${escapeAttribute(record.notes || "")}" placeholder="Add note" /></td>
        <td data-label="Actions"><button class="button delete-button" data-id="${record.id}" data-handle="${escapeAttribute(record.handle)}" type="button">Delete</button></td>
      </tr>
    `)
    .join("");

  els.table.querySelectorAll("select, input").forEach((input) => input.addEventListener("change", updateFollowerField));
  els.table.querySelectorAll(".delete-button").forEach((button) => button.addEventListener("click", deleteFollower));
}

function renderPipeline() {
  const max = Math.max(1, ...choices.stages.map((stage) => followers.filter((record) => record.relationshipStage === stage).length));
  els.pipeline.innerHTML = choices.stages
    .filter(Boolean)
    .map((stage) => {
      const count = followers.filter((record) => record.relationshipStage === stage).length;
      const width = Math.max(5, Math.round((count / max) * 100));
      return `
        <div class="stage-row">
          <div>
            <div class="stage-label">${escapeHtml(stage)}</div>
            <div class="bar"><span style="width: ${width}%"></span></div>
          </div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function renderNewest() {
  const newest = [...followers].sort(sortByDateAdded).slice(0, 6);
  if (!newest.length) {
    els.newestList.innerHTML = `<div class="empty compact-empty">No followers yet.</div>`;
    return;
  }

  els.newestList.innerHTML = newest
    .map((record) => `
      <article class="mini-card">
        <strong>@${escapeHtml(record.handle)}</strong>
        <span>${formatDate(record.dateAdded || record.createdTime)} · ${escapeHtml(record.relationshipStage || "No status")}</span>
      </article>
    `)
    .join("");
}

function filteredFollowers() {
  return [...followers]
    .filter((record) => !filters.search || `${record.handle} ${record.notes}`.toLowerCase().includes(filters.search))
    .filter((record) => !filters.stage || record.relationshipStage === filters.stage)
    .filter((record) => !filters.audience || record.audienceType === filters.audience)
    .filter((record) => !filters.offer || record.potentialOffer === filters.offer)
    .sort(sortByDateAdded);
}

function hydrateChoiceControls() {
  fillSelect(els.stageFilter, choices.stages, "All statuses");
  fillSelect(els.audienceFilter, choices.audiences.filter(Boolean), "All audiences");
  fillSelect(els.offerFilter, choices.offers.filter(Boolean), "All offers");
}

function fillSelect(select, options, firstLabel, selected = "") {
  select.innerHTML = [
    `<option value="">${escapeHtml(firstLabel)}</option>`,
    ...unique([...(options || [])]).filter(Boolean).map((option) => `<option value="${escapeAttribute(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`),
  ].join("");
}

function selectHtml(id, field, options, value) {
  return `
    <select data-id="${id}" data-field="${field}">
      <option value="">Not set</option>
      ${unique(options).filter(Boolean).map((option) => `<option value="${escapeAttribute(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
    </select>
  `;
}

function resetFilters() {
  filters = { search: "", stage: "", audience: "", offer: "" };
  els.search.value = "";
  hydrateChoiceControls();
  render();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Airtable request failed.");
  }
  return data;
}

function mergeChoices(apiChoices) {
  return {
    stages: unique([...(apiChoices.stages || []), ...defaultStages]),
    audiences: unique(["", ...(apiChoices.audiences || []), ...defaultAudiences]),
    offers: unique(["", ...(apiChoices.offers || []), ...defaultOffers]),
  };
}

function normalizeHandle(value) {
  return String(value || "").replace(/^@/, "").trim().toLowerCase().replace(/[^a-z0-9._]/g, "");
}

function sortByDateAdded(a, b) {
  return dateValue(b.dateAdded || b.createdTime) - dateValue(a.dateAdded || a.createdTime);
}

function dateValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function setStatus(message) {
  els.statusCopy.textContent = message;
}

function unique(values) {
  return [...new Set((values || []).filter((value) => value !== undefined && value !== null))];
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
