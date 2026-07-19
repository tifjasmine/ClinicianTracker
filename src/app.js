const defaultStages = ["New Follower", "Messaged", "Responded", "Potential Lead", "Offer Shared", "Purchased"];
const defaultAudiences = ["", "New Clinician", "Established Clinician", "Student / Intern", "Supervisor", "Professional Connection", "Unsure"];
const defaultOffers = ["", "Workshop", "12-Week Program", "Collaboration", "Professional Connection", "Not a Fit Right Now"];
const toneOptions = ["Warm & personal", "Professional & credible", "Direct & concise", "Playful & casual"];

let followers = [];
let activeTab = "dashboard";
let toneFilter = "All";
let aiResult = "";
let savedResponses = loadSavedResponses();
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
  savedForm: document.getElementById("saved-form"),
  responseTitle: document.getElementById("response-title"),
  responseTone: document.getElementById("response-tone"),
  responseText: document.getElementById("response-text"),
  toneTabs: document.getElementById("tone-tabs"),
  responsesList: document.getElementById("responses-list"),
  aiForm: document.getElementById("ai-form"),
  aiInput: document.getElementById("ai-input"),
  aiTone: document.getElementById("ai-tone"),
  aiContext: document.getElementById("ai-context"),
  aiResult: document.getElementById("ai-result"),
  copyAiButton: document.getElementById("copy-ai-button"),
  saveAiButton: document.getElementById("save-ai-button"),
};

document.getElementById("refresh-button").addEventListener("click", loadFollowers);
document.getElementById("reset-filters-button").addEventListener("click", resetFilters);
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", changeTab));
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
els.savedForm.addEventListener("submit", createSavedResponse);
els.aiForm.addEventListener("submit", generateReply);
els.copyAiButton.addEventListener("click", () => copyText(aiResult));
els.saveAiButton.addEventListener("click", saveAiResponse);

hydrateChoiceControls();
hydrateToneControls();
renderSavedResponses();
loadFollowers();

function changeTab(event) {
  activeTab = event.currentTarget.dataset.tab;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === activeTab));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${activeTab}-view`));
}

async function loadFollowers() {
  setStatus("Loading followers...");
  try {
    const data = await apiRequest("/.netlify/functions/followers");
    followers = data.records || [];
    choices = mergeChoices(data.choices || {});
    hydrateChoiceControls();
    render();
    setStatus(`${followers.length} follower${followers.length === 1 ? "" : "s"} loaded.`);
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

  els.formStatus.textContent = "Adding follower...";
  try {
    await apiRequest("/.netlify/functions/followers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    els.form.reset();
    els.handleInput.focus();
    els.formStatus.textContent = "Added.";
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
  const confirmed = window.confirm(`Delete @${handle}?`);
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
    els.table.innerHTML = `<tr><td colspan="8" class="empty-table">No matching followers.</td></tr>`;
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
        <td data-label="Last Contacted"><input class="date-input" type="date" data-id="${record.id}" data-field="lastContacted" value="${escapeAttribute(record.lastContacted || "")}" /></td>
        <td data-label="Notes"><input class="notes-input" data-id="${record.id}" data-field="notes" value="${escapeAttribute(record.notes || "")}" placeholder="Add note" /></td>
        <td data-label="Actions"><button class="button delete-button" data-id="${record.id}" data-handle="${escapeAttribute(record.handle)}" type="button">Delete</button></td>
        <td class="mobile-row-cell">
          <details class="mobile-follower">
            <summary>
              <span>
                <strong>@${escapeHtml(record.handle)}</strong>
                <small>${formatDate(record.dateAdded || record.createdTime)}</small>
              </span>
              <em>${escapeHtml(record.relationshipStage || "No status")}</em>
            </summary>
            <div class="mobile-follower-fields">
              <label>
                <span>Status</span>
                ${selectHtml(record.id, "relationshipStage", choices.stages, record.relationshipStage)}
              </label>
              <label>
                <span>Audience</span>
                ${selectHtml(record.id, "audienceType", choices.audiences, record.audienceType)}
              </label>
              <label>
                <span>Offer</span>
                ${selectHtml(record.id, "potentialOffer", choices.offers, record.potentialOffer)}
              </label>
              <label>
                <span>Last Contacted</span>
                <input class="date-input" type="date" data-id="${record.id}" data-field="lastContacted" value="${escapeAttribute(record.lastContacted || "")}" />
              </label>
              <label>
                <span>Notes</span>
                <input class="notes-input" data-id="${record.id}" data-field="notes" value="${escapeAttribute(record.notes || "")}" placeholder="Add note" />
              </label>
              <button class="button delete-button" data-id="${record.id}" data-handle="${escapeAttribute(record.handle)}" type="button">Delete follower</button>
            </div>
          </details>
        </td>
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
    .map((record) => dashboardFollowerHtml(record))
    .join("");
  els.newestList.querySelectorAll("select, input").forEach((input) => input.addEventListener("change", updateFollowerField));
  els.newestList.querySelectorAll(".delete-button").forEach((button) => button.addEventListener("click", deleteFollower));
}

function dashboardFollowerHtml(record) {
  const initial = (record.handle || "?").slice(0, 1).toUpperCase();
  return `
    <article class="mini-card dashboard-card">
      <details class="dashboard-follower">
        <summary>
          <span class="mini-avatar">${escapeHtml(initial)}</span>
          <span class="dashboard-summary-copy">
            <strong>@${escapeHtml(record.handle)}</strong>
            <small>${escapeHtml(record.relationshipStage || "No status")}</small>
          </span>
        </summary>
        <div class="dashboard-card-body">
          <p>Added ${formatDate(record.dateAdded || record.createdTime)} · <a href="https://www.instagram.com/${escapeAttribute(record.handle)}/" target="_blank" rel="noreferrer">view on IG</a></p>
          <div class="dashboard-field-grid">
            <label>
              <span>Status</span>
              ${selectHtml(record.id, "relationshipStage", choices.stages, record.relationshipStage)}
            </label>
            <label>
              <span>Audience</span>
              ${selectHtml(record.id, "audienceType", choices.audiences, record.audienceType)}
            </label>
            <label>
              <span>Offer</span>
              ${selectHtml(record.id, "potentialOffer", choices.offers, record.potentialOffer)}
            </label>
            <label>
              <span>Last Contacted</span>
              <input class="date-input" type="date" data-id="${record.id}" data-field="lastContacted" value="${escapeAttribute(record.lastContacted || "")}" />
            </label>
            <label class="dashboard-notes">
              <span>Notes</span>
              <input class="notes-input" data-id="${record.id}" data-field="notes" value="${escapeAttribute(record.notes || "")}" placeholder="Add note" />
            </label>
          </div>
          <button class="button delete-button" data-id="${record.id}" data-handle="${escapeAttribute(record.handle)}" type="button">Delete follower</button>
        </div>
      </details>
    </article>
  `;
}

function hydrateToneControls() {
  const options = toneOptions.map((tone) => `<option value="${escapeAttribute(tone)}">${escapeHtml(tone)}</option>`).join("");
  els.responseTone.innerHTML = options;
  els.aiTone.innerHTML = options;
  renderToneTabs();
}

function renderToneTabs() {
  els.toneTabs.innerHTML = ["All", ...toneOptions]
    .map((tone) => `<button class="tone-tab ${toneFilter === tone ? "active" : ""}" data-tone="${escapeAttribute(tone)}" type="button">${escapeHtml(tone)}</button>`)
    .join("");
  els.toneTabs.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    toneFilter = button.dataset.tone;
    renderToneTabs();
    renderSavedResponses();
  }));
}

function createSavedResponse(event) {
  event.preventDefault();
  const text = els.responseText.value.trim();
  if (!text) return;
  savedResponses = [{
    id: `response-${Date.now()}`,
    title: els.responseTitle.value.trim() || "Untitled response",
    tone: els.responseTone.value,
    text,
  }, ...savedResponses];
  saveResponses();
  els.savedForm.reset();
  els.responseTone.value = toneOptions[0];
  renderSavedResponses();
}

function renderSavedResponses() {
  const rows = savedResponses.filter((response) => toneFilter === "All" || response.tone === toneFilter);
  if (!rows.length) {
    els.responsesList.innerHTML = `<div class="empty">No saved responses yet.</div>`;
    return;
  }
  els.responsesList.innerHTML = rows.map((response) => `
    <article class="response-card">
      <div class="response-header">
        <h3>${escapeHtml(response.title)}</h3>
        <button class="text-button remove-response" data-id="${response.id}" type="button">Remove</button>
      </div>
      <span class="tone-pill">${escapeHtml(response.tone)}</span>
      <p>${escapeHtml(response.text)}</p>
      <button class="button copy-response" data-text="${escapeAttribute(response.text)}" type="button">Copy</button>
    </article>
  `).join("");
  els.responsesList.querySelectorAll(".copy-response").forEach((button) => button.addEventListener("click", () => copyText(button.dataset.text)));
  els.responsesList.querySelectorAll(".remove-response").forEach((button) => button.addEventListener("click", () => {
    savedResponses = savedResponses.filter((response) => response.id !== button.dataset.id);
    saveResponses();
    renderSavedResponses();
  }));
}

async function generateReply(event) {
  event.preventDefault();
  const message = els.aiInput.value.trim();
  if (!message) return;
  const tone = els.aiTone.value;
  const context = els.aiContext.value.trim();
  els.aiResult.textContent = "Writing...";
  try {
    const data = await apiRequest("/.netlify/functions/ai-reply", {
      method: "POST",
      body: JSON.stringify({ message, tone, context }),
    });
    aiResult = data.reply || "";
    els.aiResult.textContent = aiResult || "I could not generate a reply. Try again.";
  } catch (error) {
    aiResult = "";
    els.aiResult.textContent = error.message;
  }
}

function saveAiResponse() {
  if (!aiResult) return;
  savedResponses = [{
    id: `response-${Date.now()}`,
    title: "AI reply",
    tone: els.aiTone.value,
    text: aiResult,
  }, ...savedResponses];
  saveResponses();
  renderSavedResponses();
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).catch(() => {});
}

function loadSavedResponses() {
  try {
    const stored = JSON.parse(localStorage.getItem("clinicianTrackerResponses") || "[]");
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {
    // Keep the default library if local storage is unavailable.
  }
  return [
    { id: "tpl-1", title: "Feedback ask (grad students)", tone: "Warm & personal", text: "Ohh congrats on your journey!! So close to finishing!! I would love to pick your brain for 60 seconds. Can I send over a quick form with a few questions?" },
    { id: "tpl-2", title: "Follow-up nudge", tone: "Direct & concise", text: "Hey! Just floating this back up, still curious to hear your thoughts whenever you get a sec. No pressure at all." },
    { id: "tpl-3", title: "Workshop pitch", tone: "Professional & credible", text: "I am putting together a workshop for clinicians on this topic, practical, no fluff, built from what I have seen work in the room. Want me to send the details?" },
    { id: "tpl-4", title: "Thanks for replying", tone: "Playful & casual", text: "Yay, love that! Okay here is the scoop, let me know what jumps out and we will go from there." },
  ];
}

function saveResponses() {
  localStorage.setItem("clinicianTrackerResponses", JSON.stringify(savedResponses));
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
