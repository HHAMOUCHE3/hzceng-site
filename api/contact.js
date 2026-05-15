const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field(label, value) {
  const safeValue = escapeHtml(value);
  if (!safeValue) return "";
  return `<tr><td style="padding:8px 12px;border-bottom:1px solid #d7e7ef;font-weight:700;color:#0b2538;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #d7e7ef;color:#425466;">${safeValue}</td></tr>`;
}

function textField(label, value) {
  const safeValue = clean(value);
  return safeValue ? `${label}: ${safeValue}\n` : "";
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 200, { ok: true });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  let body = {};
  if (typeof req.body === "string") {
    try {
      body = JSON.parse(req.body);
    } catch {
      return json(res, 400, { ok: false, error: "Invalid request body." });
    }
  } else if (typeof req.body === "object" && req.body) {
    body = req.body;
  }
  const name = clean(body.name);
  const email = clean(body.email);
  const service = clean(body.service);
  const source = clean(body.source);
  const message = clean(body.message);
  const projectLocation = clean(body.projectLocation || body.projectAddress);
  const phone = clean(body.phone);
  const clientType = clean(body.clientType);
  const timeline = clean(body.timeline);
  const context = clean(body.context);
  const serviceOrContext = service || context || source;

  if (!name) return json(res, 400, { ok: false, error: "Please enter your name." });
  if (!EMAIL_RE.test(email)) return json(res, 400, { ok: false, error: "Please enter a valid email address." });
  if (!serviceOrContext) return json(res, 400, { ok: false, error: "Please choose a service or inquiry type." });
  if (!projectLocation && !message) {
    return json(res, 400, { ok: false, error: "Please include a project location or a brief message." });
  }

  if (!process.env.RESEND_API_KEY) {
    return json(res, 500, { ok: false, error: "Email service is not configured yet." });
  }

  const to = process.env.CONTACT_TO || "info@hzceng.com";
  const from = process.env.CONTACT_FROM || "H&Z Website <website@hzceng.com>";
  const subject = `New H&Z Website Inquiry: ${serviceOrContext}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;color:#0b2538;">
      <h1 style="font-size:24px;margin:0 0 12px;">New H&Z Website Inquiry</h1>
      <p style="margin:0 0 18px;color:#425466;">A visitor submitted a project request from the H&Z website.</p>
      <table style="border-collapse:collapse;width:100%;border:1px solid #d7e7ef;">
        ${field("Name", name)}
        ${field("Email", email)}
        ${field("Phone", phone)}
        ${field("Service", service)}
        ${field("Client Type", clientType)}
        ${field("Timeline", timeline)}
        ${field("Project Location", projectLocation)}
        ${field("Source", source)}
        ${field("Context", context)}
      </table>
      ${message ? `<h2 style="font-size:18px;margin:22px 0 8px;">Message</h2><p style="white-space:pre-wrap;line-height:1.55;color:#425466;">${escapeHtml(message)}</p>` : ""}
    </div>
  `;
  const text = [
    "New H&Z Website Inquiry",
    "",
    textField("Name", name),
    textField("Email", email),
    textField("Phone", phone),
    textField("Service", service),
    textField("Client Type", clientType),
    textField("Timeline", timeline),
    textField("Project Location", projectLocation),
    textField("Source", source),
    textField("Context", context),
    message ? `Message:\n${message}\n` : "",
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: email,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    return json(res, 502, { ok: false, error: "Email could not be sent. Please call or email H&Z directly." });
  }

  return json(res, 200, { ok: true, message: "Thank you. H&Z will follow up with you shortly." });
};
