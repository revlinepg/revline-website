(function () {
  "use strict";

  const form = document.querySelector("#tint-order-form");
  const status = document.querySelector("#tint-order-status");
  if (!form || !status) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton.textContent;

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `tint-form-status is-${type}`;
    status.hidden = false;
    status.focus();
  }

  function setSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Sending Request…" : defaultButtonText;
    form.setAttribute("aria-busy", String(isSubmitting));
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    status.hidden = true;

    if (!form.reportValidity()) return;

    setSubmitting(true);

    try {
      const fields = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "We couldn’t send your request. Please try again.");
      }

      form.reset();
      showStatus(
        "Your GeoShield pre-cut tint request was received. Check your email for confirmation from admin@revlinepg.com. Revline will follow up after verifying fitment, availability, and pricing.",
        "success"
      );
    } catch (error) {
      showStatus(
        error && error.message
          ? error.message
          : "We couldn’t send your request. Please call Revline at 720-800-1542.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  });
})();
