(function () {
  "use strict";

  const form = document.querySelector("#tint-order-form");
  const status = document.querySelector("#tint-order-status");
  if (!form || !status) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const tierSelect = form.querySelector("#tint-tier");
  const shadeSelect = form.querySelector("#tint-shade");
  const defaultButtonText = submitButton.textContent;

  const shadesByTier = {
    Standard: ["6%", "18%", "39%", "73%"],
    Performance: ["8%", "20%", "30%", "70%"],
    "Ceramic IR": ["4%", "16%", "30%", "70%"],
  };

  function updateShadeOptions() {
    const shades = shadesByTier[tierSelect.value] || [];
    shadeSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = shades.length ? "Select shade" : "Choose a film tier first";
    shadeSelect.appendChild(placeholder);
    shades.forEach(function (shade) {
      const option = document.createElement("option");
      option.value = shade;
      option.textContent = shade;
      shadeSelect.appendChild(option);
    });
    shadeSelect.disabled = !shades.length;
  }

  tierSelect.addEventListener("change", updateShadeOptions);

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
      updateShadeOptions();
      showStatus(
        "Your Revline pre-cut tint request was received. Check your email for confirmation from admin@revlinepg.com. Revline will follow up after verifying fitment, availability, and pricing.",
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
