const crypto = require("crypto");

const WINDOW_MS = 10 * 60 * 1000;
const REQUEST_LIMIT = 18;
const visitors = new Map();

const SHOP_CONTEXT = `
You are Ask RPG, the official website assistant for Revline Performance Garage.

Business facts:
- Business: Revline Performance Garage (RPG), an independent Denver automotive repair, maintenance, performance, appearance, and enthusiast-apparel business.
- Address: 1000 E 73rd Ave, Unit 7313, Denver, CO 80229.
- Phone: 720-800-1542.
- Email: admin@revlinepg.com.
- Hours: Monday through Friday, 10:00 AM to 6:00 PM.
- Experience: 9+ years.
- Appointment requests are submitted at /contact.html#contact-form. A request is not a confirmed appointment; the Revline team follows up.
- Core work includes routine maintenance, diagnostics, engine and transmission service, brakes, steering, suspension, electrical and climate concerns, tires, inspections, performance upgrades, and custom automotive projects.
- Appearance options include vehicle-specific pre-cut GeoShield tint kits in 5%, 15%, 20%, 25%, 35%, 50%, and 70%. Revline verifies vehicle fitment before payment. Revline does not install these pre-cut kits.
- Golden Finish is a trusted appearance-service partner. GeoShield is Revline's trusted tint supplier. Do not combine or misstate these relationships.
- The Revline shop currently offers a Signature Hoodie ($69), Performance T-Shirt ($34), and Performance Quarter-Zip ($59) through secure Stripe checkout on /shop.html.
- RPG Premium Vinyl is available through a request-first catalog at /vinyl.html with more than 200 colors across gloss, satin, metallic, carbon, color-shift, crystal, laser, pearl, and specialty collections. Customers can request a color sample, partial roll, or full roll. Revline confirms inventory, dimensions, price, pickup or shipping, and sends a secure payment link before collecting payment.
- RPG garage accessories are previewed as coming soon.
- Instagram: https://www.instagram.com/revline.pg

How to respond:
- Match the visitor's language; support English and Spanish naturally.
- Be friendly, direct, practical, and concise. Sound like a knowledgeable service advisor, not a generic chatbot.
- For service questions, ask for the vehicle year, make, model, mileage, symptoms, warning lights, when the issue began, and whether the vehicle is safe to drive when those details matter.
- Never claim to have inspected or diagnosed a vehicle. Do not give a guaranteed price, repair time, fitment, inventory level, or appointment confirmation.
- Explain that final diagnosis, pricing, parts availability, and timing require review by Revline.
- If symptoms suggest immediate danger—brake failure, overheating, smoke or fire, severe fluid loss, loss of steering, flashing check-engine light with rough running, or unsafe tire damage—tell the visitor to stop driving in a safe place and arrange a tow or call Revline.
- Do not provide instructions that could make unsafe vehicle work easier. Encourage professional inspection for safety-critical repairs.
- Do not request payment-card numbers, passwords, government IDs, or other highly sensitive information.
- If asked to schedule, collect only the useful vehicle/service details and direct the visitor to /contact.html#contact-form or 720-800-1542. State clearly that the form is a request, not a confirmed time.
- If asked about something not established here, say the Revline team can confirm it. Never invent business policies or services.
- When useful, mention one exact relative page: /services.html, /tint.html, /vinyl.html, /shop.html, or /contact.html#contact-form.
- Keep most answers under 120 words. Avoid markdown tables.
`;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

function getIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || "unknown")
    .split(",")[0]
    .trim();
}

function isRateLimited(ip) {
  const now = Date.now();
  const current = visitors.get(ip);

  if (!current || now - current.startedAt > WINDOW_MS) {
    visitors.set(ip, { count: 1, startedAt: now });
    return false;
  }

  current.count += 1;
  visitors.set(ip, current);
  return current.count > REQUEST_LIMIT;
}

function cleanMessages(value) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-10)
    .map((item) => ({
      role: item && item.role === "assistant" ? "assistant" : "user",
      content: String((item && item.content) || "").trim().slice(0, 1200),
    }))
    .filter((item) => item.content);
}

function extractText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("\n");
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, { ok: true, assistant: "Ask RPG" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 503, {
      error: "The Revline assistant is being connected. Please call 720-800-1542 for immediate help.",
    });
  }

  const requestHost = String(req.headers.host || "");
  const requestOrigin = String(req.headers.origin || "");
  if (requestOrigin) {
    try {
      if (new URL(requestOrigin).host !== requestHost) {
        return sendJson(res, 403, { error: "Request origin not allowed." });
      }
    } catch {
      return sendJson(res, 403, { error: "Request origin not allowed." });
    }
  }

  const ip = getIp(req);
  if (isRateLimited(ip)) {
    return sendJson(res, 429, {
      error: "Please wait a few minutes before sending another message, or call Revline at 720-800-1542.",
    });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { error: "Invalid request." });
    }
  }

  const message = String(body.message || "").trim().slice(0, 1600);
  const messages = cleanMessages(body.messages);
  const sessionId = String(body.sessionId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);

  if (!message) {
    return sendJson(res, 400, { error: "Please enter a message." });
  }

  const conversation = [...messages, { role: "user", content: message }]
    .map((item) => `${item.role === "assistant" ? "Assistant" : "Visitor"}: ${item.content}`)
    .join("\n\n");

  const safetyIdentifier = crypto
    .createHash("sha256")
    .update(`${ip}:revlinepg`)
    .digest("hex")
    .slice(0, 64);

  try {
    const moderationResponse = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: message,
      }),
    });

    if (moderationResponse.ok) {
      const moderation = await moderationResponse.json();
      if (moderation.results && moderation.results[0] && moderation.results[0].flagged) {
        return sendJson(res, 400, {
          error: "I can help with Revline services, vehicles, tint, apparel, and appointments. Please rephrase your question.",
        });
      }
    }

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions: SHOP_CONTEXT,
        input: `Continue this customer-service conversation:\n\n${conversation}`,
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
        max_output_tokens: 420,
        safety_identifier: safetyIdentifier,
        metadata: {
          source: "revlinepg.com",
          assistant: "ask-rpg",
          chat_session: sessionId || "unavailable",
        },
        store: true,
      }),
    });

    const data = await openAIResponse.json();
    if (!openAIResponse.ok) {
      console.error("OpenAI request failed", openAIResponse.status, data.request_id || "");
      const billingIssue =
        openAIResponse.status === 429 ||
        (data.error && /quota|billing|credit/i.test(String(data.error.message || "")));

      return sendJson(res, billingIssue ? 503 : 502, {
        error: billingIssue
          ? "Ask RPG is almost ready, but its OpenAI billing needs to be activated. Please call 720-800-1542 for now."
          : "Ask RPG is temporarily unavailable. Please call 720-800-1542 or use the appointment form.",
      });
    }

    const reply = extractText(data);
    if (!reply) {
      return sendJson(res, 502, {
        error: "Ask RPG could not complete that answer. Please try again or call 720-800-1542.",
      });
    }

    return sendJson(res, 200, { reply, recordId: data.id || null });
  } catch (error) {
    console.error("Ask RPG request error", error && error.message ? error.message : "unknown");
    return sendJson(res, 502, {
      error: "Ask RPG is temporarily unavailable. Please call 720-800-1542 or use the appointment form.",
    });
  }
};
