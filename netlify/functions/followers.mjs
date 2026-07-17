const AIRTABLE_API = "https://api.airtable.com/v0";

const config = {
  token: process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT,
  baseId: process.env.AIRTABLE_BASE_ID || "appGsqyZtEuxBZNzF",
  tableId: process.env.AIRTABLE_TABLE_ID || "Followers",
  fields: {
    handle: process.env.AIRTABLE_HANDLE_FIELD || "IG Name",
    dateAdded: process.env.AIRTABLE_DATE_ADDED_FIELD || "Date",
    stage: process.env.AIRTABLE_STAGE_FIELD || "Status",
    audience: process.env.AIRTABLE_AUDIENCE_FIELD || "Audience",
    offer: process.env.AIRTABLE_OFFER_FIELD || "Potential Offer",
    notes: process.env.AIRTABLE_NOTES_FIELD || "Notes",
    nextFollowUp: process.env.AIRTABLE_NEXT_FOLLOW_UP_FIELD || "Next Follow-Up",
  },
};

export async function handler(event) {
  try {
    if (!config.token) {
      return json(500, { error: "Missing AIRTABLE_TOKEN in Netlify environment variables." });
    }

    if (event.httpMethod === "GET") return listFollowers();
    if (event.httpMethod === "POST") return createFollower(JSON.parse(event.body || "{}"));
    if (event.httpMethod === "PATCH") return updateFollower(JSON.parse(event.body || "{}"));
    if (event.httpMethod === "DELETE") return deleteFollower(event.queryStringParameters?.id);

    return json(405, { error: "Method not allowed." });
  } catch (error) {
    return json(500, { error: error.message || "Airtable request failed." });
  }
}

async function listFollowers() {
  const records = [];
  let offset = "";

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const data = await airtableFetch(`?${params.toString()}`);
    records.push(...(data.records || []).map(normalizeRecord).filter((record) => record.handle));
    offset = data.offset || "";
  } while (offset);

  return json(200, {
    records,
    choices: deriveChoices(records),
  });
}

async function createFollower(payload) {
  const handle = normalizeHandle(payload.handle);
  if (!handle) return json(400, { error: "Instagram handle is required." });

  const fields = {};
  fields[config.fields.handle] = handle;
  fields[config.fields.dateAdded] = today();
  fields[config.fields.stage] = payload.relationshipStage || "New Follower";
  if (payload.audienceType) fields[config.fields.audience] = payload.audienceType;
  if (payload.potentialOffer) fields[config.fields.offer] = payload.potentialOffer;
  if (payload.notes) fields[config.fields.notes] = payload.notes;

  const data = await airtableFetch("", {
    method: "POST",
    body: JSON.stringify({
      records: [{ fields }],
      typecast: true,
    }),
  });

  return json(200, { record: normalizeRecord(data.records?.[0]) });
}

async function updateFollower(payload) {
  if (!payload.id) return json(400, { error: "Record id is required." });

  const fields = {};
  for (const [key, value] of Object.entries(payload.fields || {})) {
    const airtableField = {
      relationshipStage: config.fields.stage,
      audienceType: config.fields.audience,
      potentialOffer: config.fields.offer,
      notes: config.fields.notes,
    }[key];
    if (airtableField) fields[airtableField] = value || null;
  }

  const data = await airtableFetch("", {
    method: "PATCH",
    body: JSON.stringify({
      records: [{ id: payload.id, fields }],
      typecast: true,
    }),
  });

  return json(200, { record: normalizeRecord(data.records?.[0]) });
}

async function deleteFollower(id) {
  if (!id) return json(400, { error: "Record id is required." });
  await airtableFetch(`?records[]=${encodeURIComponent(id)}`, { method: "DELETE" });
  return json(200, { ok: true });
}

async function airtableFetch(path = "", options = {}) {
  const response = await fetch(`${AIRTABLE_API}/${config.baseId}/${config.tableId}${path}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || data.error || "Airtable API error.");
  }
  return data;
}

function normalizeRecord(record = {}) {
  const fields = record.fields || {};
  const handle = normalizeHandle(pick(fields, [config.fields.handle, "Instagram Handle", "Handle", "Instagram", "IG Handle"]));
  return {
    id: record.id,
    createdTime: record.createdTime,
    handle,
    dateAdded: pick(fields, [config.fields.dateAdded, "Date Added", "Added Date"]),
    relationshipStage: pick(fields, [config.fields.stage, "Relationship Stage", "Stage"]),
    audienceType: pick(fields, [config.fields.audience, "Audience Type"]),
    potentialOffer: pick(fields, [config.fields.offer, "Offer"]),
    notes: pick(fields, [config.fields.notes, "Note"]),
    nextFollowUp: pick(fields, [config.fields.nextFollowUp, "Follow Up", "Follow-Up"]),
    rawFields: fields,
  };
}

function deriveChoices(records) {
  return {
    stages: unique(records.map((record) => record.relationshipStage)),
    audiences: unique(records.map((record) => record.audienceType)),
    offers: unique(records.map((record) => record.potentialOffer)),
  };
}

function pick(fields, names) {
  for (const name of names) {
    if (fields[name] !== undefined && fields[name] !== null) {
      if (typeof fields[name] === "object" && fields[name]?.name) return fields[name].name;
      return fields[name];
    }
  }
  return "";
}

function normalizeHandle(value) {
  return String(value || "").replace(/^@/, "").trim().toLowerCase().replace(/[^a-z0-9._]/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
