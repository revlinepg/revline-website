const nodemailer = require("nodemailer");

const WINDOW_MS = 15 * 60 * 1000;
const REQUEST_LIMIT = 8;
const visitors = new Map();
const BUSINESS_EMAIL = "admin@revlinepg.com";
const FORMSPREE_ENDPOINT =
  process.env.FORMSPREE_VINYL_ENDPOINT ||
  process.env.FORMSPREE_TINT_ENDPOINT ||
  "https://formspree.io/f/meozjrrw";
const ROLL_SIZE = "5 ft × 60 ft";
const ALLOWED_FULFILLMENT = new Set([
  "Denver local pickup",
  "U.S. shipping",
]);

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

function clean(value, maxLength = 180) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function normalizeRequest(body) {
  return {
    name: clean(body.name, 100),
    email: clean(body.email, 180).toLowerCase(),
    phone: clean(body.phone, 40),
    color: clean(body.vinyl_color, 140),
    series: clean(body.vinyl_series, 100),
    rollSize: clean(body.roll_size, 40),
    quantity: clean(body.quantity, 2),
    fulfillment: clean(body.fulfillment, 80),
    deliveryZip: clean(body.delivery_zip, 12),
    notes: clean(body.message, 1200),
    confirmed: body.request_confirmation === "Confirmed",
    honeypot: clean(body._gotcha, 200),
  };
}

function validateRequest(order) {
  const required = [
    order.name,
    order.email,
    order.phone,
    order.color,
    order.series,
    order.rollSize,
    order.quantity,
    order.fulfillment,
  ];
  if (required.some((value) => !value) || !order.confirmed) {
    return "Please complete every required field and confirm the request details.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) {
    return "Please enter a valid email address.";
  }
  if (order.rollSize !== ROLL_SIZE) {
    return "The available vinyl roll size is 5 ft × 60 ft.";
  }
  const quantity = Number(order.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return "Please select a valid roll quantity.";
  }
  if (!ALLOWED_FULFILLMENT.has(order.fulfillment)) {
    return "Please select local pickup or U.S. shipping.";
  }
  if (
    order.fulfillment === "U.S. shipping" &&
    !/^\d{5}(?:-\d{4})?$/.test(order.deliveryZip)
  ) {
    return "Please enter a valid shipping ZIP code.";
  }
  return "";
}

function buildFormspreeBody(order) {
  return new URLSearchParams({
    name: order.name,
    email: order.email,
    phone: order.phone,
    vinyl_color: order.color,
    vinyl_series: order.series,
    roll_size: order.rollSize,
    quantity: order.quantity,
    fulfillment: order.fulfillment,
    delivery_zip: order.deliveryZip,
    message: order.notes,
    request_confirmation: "Confirmed",
    product_line: "RPG Premium Vinyl",
    _subject: `New RPG Premium Vinyl request: ${order.color}`,
  });
}

function buildConfirmation(order) {
  const name = escapeHtml(order.name);
  const color = escapeHtml(order.color);
  const series = escapeHtml(order.series);
  const rollSize = escapeHtml(order.rollSize);
  const quantity = escapeHtml(order.quantity);
  const fulfillment = escapeHtml(order.fulfillment);
  const deliveryZip = order.deliveryZip
    ? escapeHtml(order.deliveryZip)
    : "Not applicable";
  const notes = order.notes ? escapeHtml(order.notes) : "None provided";

  const text = `Hi ${order.name},

We received your RPG Premium Vinyl request.

Request details
Color: ${order.color}
Collection: ${order.series}
Roll size: ${order.rollSize}
Quantity: ${order.quantity}
Fulfillment: ${order.fulfillment}
Shipping ZIP code: ${order.deliveryZip || "Not applicable"}
Notes: ${order.notes || "None provided"}

What happens next:
1. Revline confirms color availability and the number of 5 ft × 60 ft rolls requested.
2. We confirm final pricing, pickup or shipping, and fulfillment timing.
3. We send a secure payment link after the details are approved.

This email confirms receipt of your request. It is not an inventory guarantee, final price, or payment confirmation.

Questions? Reply to this email or call 720-800-1542.

Revline Performance Garage
1000 E 73rd Ave, Unit 7313
Denver, CO 80229
revlinepg.com`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0b0b0d;color:#f4f4f5;font-family:Arial,sans-serif;">
    <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
      <div style="border:1px solid #2b2c31;background:#131417;">
        <div style="padding:24px 28px;border-bottom:3px solid #e50914;">
          <p style="margin:0 0 6px;color:#e50914;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">RPG Premium Vinyl</p>
          <h1 style="margin:0;color:#fff;font-size:26px;line-height:1.2;">Your color request was received.</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;color:#ddd;line-height:1.6;">Hi ${name},</p>
          <p style="margin:0 0 24px;color:#ddd;line-height:1.6;">We received your RPG Premium Vinyl request. Here is the information you submitted:</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;background:#0e0f11;border:1px solid #2b2c31;">
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Color</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${color}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Collection</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${series}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Roll size</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${rollSize}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Quantity</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${quantity}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Fulfillment</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${fulfillment}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Shipping ZIP</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${deliveryZip}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;vertical-align:top;">Notes</td><td style="padding:12px 14px;color:#fff;text-align:right;">${notes}</td></tr>
          </table>
          <h2 style="margin:28px 0 12px;color:#fff;font-size:18px;">What happens next</h2>
          <ol style="margin:0 0 24px;padding-left:22px;color:#ddd;line-height:1.8;">
            <li>Revline confirms color availability and the number of 5 ft × 60 ft rolls requested.</li>
            <li>We confirm final pricing, pickup or shipping, and fulfillment timing.</li>
            <li>We send a secure payment link after the details are approved.</li>
          </ol>
          <p style="margin:0;padding:16px;border-left:3px solid #e50914;background:#1a1b1f;color:#c9c9cc;line-height:1.55;"><strong style="color:#fff;">Please note:</strong> this email confirms receipt of your request. It is not an inventory guarantee, final price, or payment confirmation.</p>
        </div>
        <div style="padding:20px 28px;border-top:1px solid #2b2c31;color:#8f8f94;font-size:13px;line-height:1.6;">
          Questions? Reply to this email or call <a href="tel:7208001542" style="color:#fff;">720-800-1542</a>.<br />
          Revline Performance Garage · 1000 E 73rd Ave, Unit 7313 · Denver, CO 80229
        </div>
      </div>
    </div>
  </body>
</html>`;

  return { text, html };
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "RPG Premium Vinyl request",
      emailConfigured: Boolean(process.env.ZOHO_SMTP_APP_PASSWORD),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
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

  if (isRateLimited(getIp(req))) {
    return sendJson(res, 429, {
      error: "Please wait a few minutes before sending another vinyl request.",
    });
  }

  if (!process.env.ZOHO_SMTP_APP_PASSWORD) {
    return sendJson(res, 503, {
      error: "Email confirmation is being connected. Please call Revline at 720-800-1542.",
    });
  }

  const order = normalizeRequest(parseBody(req));
  if (order.honeypot) {
    return sendJson(res, 200, { ok: true });
  }

  const validationError = validateRequest(order);
  if (validationError) {
    return sendJson(res, 400, { error: validationError });
  }

  try {
    const formspreeResponse = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: buildFormspreeBody(order).toString(),
    });

    if (!formspreeResponse.ok) {
      console.error("Formspree vinyl request failed", formspreeResponse.status);
      return sendJson(res, 502, {
        error: "We couldn’t record your vinyl request. Please try again or call 720-800-1542.",
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: BUSINESS_EMAIL,
        pass: process.env.ZOHO_SMTP_APP_PASSWORD,
      },
    });
    const confirmation = buildConfirmation(order);

    await transporter.sendMail({
      from: `"Revline Performance Garage" <${BUSINESS_EMAIL}>`,
      to: order.email,
      replyTo: BUSINESS_EMAIL,
      subject: `We received your RPG Premium Vinyl request: ${order.color}`,
      text: confirmation.text,
      html: confirmation.html,
    });

    return sendJson(res, 200, {
      ok: true,
      message: "Vinyl request received and confirmation email sent.",
    });
  } catch (error) {
    console.error(
      "Vinyl request confirmation failed",
      error && error.message ? error.message : "unknown"
    );
    return sendJson(res, 502, {
      error:
        "Your request could not be completed. Please try again or call Revline at 720-800-1542.",
    });
  }
};
