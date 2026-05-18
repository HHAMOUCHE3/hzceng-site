const SERVICE_OPTIONS = [
  "Structural Design",
  "Construction Engineering",
  "Engineering Assessment",
  "Drafting/CAD",
  "Inspection",
  "Value Engineering",
];

function prettySource(value) {
  const map = {
    header: "Header Consultation CTA",
    "home-hero": "Homepage Free Consultation CTA",
    "home-cta": "Homepage Contact CTA",
    services: "Services Page CTA",
    projects: "Projects Page CTA",
  };
  return map[value] || value;
}

function setSelectValue(select, value) {
  if (!select || !value) return;
  const match = Array.from(select.options).find((option) => option.value === value || option.textContent === value);
  if (match) select.value = match.value;
}

function buildMailto(payload) {
  const subject = encodeURIComponent(`H&Z Website Inquiry: ${payload.service || payload.source || "Project Request"}`);
  const body = encodeURIComponent(
    [
      `Name: ${payload.name || ""}`,
      `Email: ${payload.email || ""}`,
      `Phone: ${payload.phone || ""}`,
      `Service: ${payload.service || ""}`,
      `Client Type: ${payload.clientType || ""}`,
      `Timeline: ${payload.timeline || ""}`,
      `Project Location: ${payload.projectLocation || payload.projectAddress || ""}`,
      `Source: ${payload.source || ""}`,
      "",
      `Message: ${payload.message || ""}`,
    ].join("\n"),
  );
  return `mailto:info@hzceng.com?subject=${subject}&body=${body}`;
}

function collectForm(form) {
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  if (!payload.source) payload.source = form.dataset.source || document.title;
  if (!payload.context) payload.context = form.dataset.context || "";
  return payload;
}

function setStatus(form, message, type) {
  const status = form.querySelector("[data-form-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = type || "";
}

function trackEvent(name, params = {}) {
  if (typeof window.gtag === "function") window.gtag("event", name, params);
}

async function submitContactForm(form) {
  const submit = form.querySelector("button[type='submit']");
  const payload = collectForm(form);

  if (!form.reportValidity()) return;

  if (window.location.protocol === "file:") {
    window.location.href = buildMailto(payload);
    setStatus(form, "Your email app should open with the inquiry details ready to send.", "success");
    return;
  }

  submit.disabled = true;
  setStatus(form, "Sending your inquiry...", "sending");

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Something went wrong.");
    form.reset();
    applyContactParams();
    setStatus(form, result.message || "Thank you. H&Z will follow up with you shortly.", "success");
    trackEvent("generate_lead", { form_location: payload.source || "website_form", service: payload.service || "" });
  } catch (error) {
    setStatus(form, error.message || "Unable to send right now. Please call or email H&Z directly.", "error");
  } finally {
    submit.disabled = false;
  }
}

function applyContactParams() {
  const params = new URLSearchParams(window.location.search);
  const service = params.get("service");
  const source = params.get("source");
  const project = params.get("project");
  const context = project || prettySource(source || "");

  document.querySelectorAll("select[name='service']").forEach((select) => setSelectValue(select, service));
  document.querySelectorAll("input[name='source']").forEach((input) => {
    input.value = context;
  });
  document.querySelectorAll("[data-form-context]").forEach((node) => {
    if (!service) return;
    node.textContent = `Inquiry type: ${service}`;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-contact-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitContactForm(form);
    });
  });
  document.querySelectorAll("a[href^='tel:']").forEach((link) => {
    link.addEventListener("click", () => trackEvent("phone_click", { link_location: link.closest("header") ? "header" : "page" }));
  });
  document.querySelectorAll("a[href^='mailto:']").forEach((link) => {
    link.addEventListener("click", () => trackEvent("email_click", { link_location: link.closest("header") ? "header" : "page" }));
  });
  applyContactParams();
});
