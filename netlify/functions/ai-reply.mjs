const OPENAI_API = "https://api.openai.com/v1/responses";
const SYSTEM_PROMPT = "You write short Instagram DM replies for The Confident Clinician. Sound human, warm, grounded, and clear. Avoid therapy, diagnosis, clinical advice, fake urgency, hashtags, emojis, and salesy language. Keep replies to 1-4 sentences and end with one easy next question when helpful.";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const message = clean(payload.message);
    const tone = clean(payload.tone) || "Warm & personal";
    const context = clean(payload.context);

    if (!message) return json(400, { error: "Add their message first." });

    const reply = await generateReply({ message, tone, context });
    return json(200, { reply });
  } catch (error) {
    return json(500, { error: error.message || "Could not generate a reply." });
  }
}

async function generateReply(input) {
  if (process.env.OPENAI_API_KEY) return openaiReply(input);
  throw new Error("AI needs to be connected in Netlify before it can generate replies.");
}

async function openaiReply({ message, tone, context }) {
  const response = await fetch(OPENAI_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: defaultOpenAiModel(),
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt({ message, tone, context }),
        },
      ],
      max_output_tokens: 220,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed.");

  const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("").trim();
  if (!text) throw new Error("AI did not return a reply.");
  return text.trim();
}

function userPrompt({ message, tone, context }) {
  return [
    `Tone: ${tone}`,
    `Optional context: ${context || "None"}`,
    `Their DM: ${message}`,
    "Write only the reply I can paste back into Instagram.",
  ].join("\n");
}

function defaultOpenAiModel() {
  return ["gpt", "4.1", "mini"].join("-");
}

function clean(value) {
  return String(value || "").trim().slice(0, 4000);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
