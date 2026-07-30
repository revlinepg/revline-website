const nodemailer = require("nodemailer");

const WINDOW_MS = 15 * 60 * 1000;
const REQUEST_LIMIT = 8;
const visitors = new Map();
const BUSINESS_EMAIL = "admin@revlinepg.com";
const FORMSPREE_ENDPOINT =
  process.env.FORMSPREE_TINT_ENDPOINT || "https://formspree.io/f/meozjrrw";
const ALLOWED_SHADES = new Set(["5%", "15%", "20%", "25%", "35%", "50%", "70%"]);
const ALLOWED_COVERAGE = new Set([
  "Front two windows",
  "Side and rear kit",
  "Full vehicle kit",
  "Windshield strip",
  "Single replacement window",
]);

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
    vehicleYear: clean(body.vehicle_year, 4),
    vehicleMake: clean(body.vehicle_make, 80),
    vehicleModel: clean(body.vehicle_model, 80),
    bodyStyle: clean(body.body_style, 120),
    shade: clean(body.shade_percentage, 4),
    coverage: clean(body.coverage, 80),
    notes: clean(body.message, 1200),
    fitmentConfirmed: body.fitment_confirmation === "Confirmed",
    honeypot: clean(body._gotcha, 200),
  };
}

function validateRequest(order) {
  const required = [
    order.name,
    order.email,
    order.phone,
    order.vehicleYear,
    order.vehicleMake,
    order.vehicleModel,
    order.bodyStyle,
    order.shade,
    order.coverage,
  ];
  if (required.some((value) => !value) || !order.fitmentConfirmed) {
    return "Please complete every required field and confirm the vehicle information.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) {
    return "Please enter a valid email address.";
  }

  const currentYear = new Date().getFullYear();
  const year = Number(order.vehicleYear);
  if (!/^\d{4}$/.test(order.vehicleYear) || year < 1900 || year > currentYear + 2) {
    return "Please enter a valid four-digit vehicle year.";
  }

  if (!ALLOWED_SHADES.has(order.shade) || !ALLOWED_COVERAGE.has(order.coverage)) {
    return "Please select a valid shade and coverage option.";
  }

  return "";
}

function buildFormspreeBody(order) {
  const data = new URLSearchParams({
    name: order.name,
    email: order.email,
    phone: order.phone,
    vehicle_year: order.vehicleYear,
    vehicle_make: order.vehicleMake,
    vehicle_model: order.vehicleModel,
    body_style: order.bodyStyle,
    shade_percentage: order.shade,
    coverage: order.coverage,
    message: order.notes,
    fitment_confirmation: "Confirmed",
    film_brand: "GeoShield",
    _subject: "New GeoShield pre-cut tint order request from revlinepg.com",
  });
  return data;
}

function buildConfirmation(order) {
  const name = escapeHtml(order.name);
  const vehicle = [order.vehicleYear, order.vehicleMake, order.vehicleModel]
    .map(escapeHtml)
    .join(" ");
  const bodyStyle = escapeHtml(order.bodyStyle);
  const shade = escapeHtml(order.shade);
  const coverage = escapeHtml(order.coverage);
  const notes = order.notes ? escapeHtml(order.notes) : "None provided";

  const text = `Hi ${order.name},

We received your GeoShield pre-cut tint order request.

Request details
Vehicle: ${order.vehicleYear} ${order.vehicleMake} ${order.vehicleModel}
Body style: ${order.bodyStyle}
Shade: ${order.shade}
Coverage: ${order.coverage}
Fitment notes: ${order.notes || "None provided"}

What happens next:
1. Revline verifies the vehicle pattern and GeoShield film availability.
2. We confirm pricing, pickup or shipping, and fulfillment timing.
3. We send a secure payment link after the details are approved.

This email confirms receipt of your request. It is not a fitment approval, final price, or payment confirmation.

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
          <p style="margin:0 0 6px;color:#e50914;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Revline Performance Garage</p>
          <h1 style="margin:0;color:#fff;font-size:26px;line-height:1.2;">Tint request received.</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;color:#ddd;line-height:1.6;">Hi ${name},</p>
          <p style="margin:0 0 24px;color:#ddd;line-height:1.6;">We received your GeoShield pre-cut tint order request. Here is the information you submitted:</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;background:#0e0f11;border:1px solid #2b2c31;">
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Vehicle</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${vehicle}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Body style</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${bodyStyle}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Shade</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${shade}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;border-bottom:1px solid #25262a;">Coverage</td><td style="padding:12px 14px;color:#fff;border-bottom:1px solid #25262a;text-align:right;">${coverage}</td></tr>
            <tr><td style="padding:12px 14px;color:#888;vertical-align:top;">Fitment notes</td><td style="padding:12px 14px;color:#fff;text-align:right;">${notes}</td></tr>
          </table>
          <h2 style="margin:28px 0 12px;color:#fff;font-size:18px;">What happens next</h2>
          <ol style="margin:0 0 24px;padding-left:22px;color:#ddd;line-height:1.8;">
            <li>Revline verifies the vehicle pattern and GeoShield film availability.</li>
            <li>We confirm pricing, pickup or shipping, and fulfillment timing.</li>
            <li>We send a secure payment link after the details are approved.</li>
          </ol>
          <p style="margin:0;padding:16px;border-left:3px solid #e50914;background:#1a1b1f;color:#c9c9cc;line-height:1.55;"><strong style="color:#fff;">Please note:</strong> this email confirms receipt of your request. It is not a fitment approval, final price, or payment confirmation.</p>
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
      service: "GeoShield tint request",
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
      error: "Please wait a few minutes before sending another tint request.",
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
      console.error("Formspree tint request failed", formspreeResponse.status);
      return sendJson(res, 502, {
        error: "We couldn’t record your tint request. Please try again or call 720-800-1542.",
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
      subject: "We received your GeoShield pre-cut tint request",
      text: confirmation.text,
      html: confirmation.html,
    });

    return sendJson(res, 200, {
      ok: true,
      message: "Tint request received and confirmation email sent.",
    });
  } catch (error) {
    console.error(
      "Tint request confirmation failed",
      error && error.message ? error.message : "unknown"
    );
    return sendJson(res, 502, {
      error:
        "Your request could not be completed. Please try again or call Revline at 720-800-1542.",
    });
  }
};
