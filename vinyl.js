(function () {
  "use strict";

  const colors = Array.isArray(window.RPG_VINYL_COLORS)
    ? window.RPG_VINYL_COLORS
    : [];
  const grid = document.querySelector("#vinyl-grid");
  const search = document.querySelector("#vinyl-search");
  const seriesSelect = document.querySelector("#vinyl-series");
  const chips = document.querySelector("#vinyl-series-chips");
  const resultCount = document.querySelector("#vinyl-result-count");
  const totalCount = document.querySelector("#vinyl-total-count");
  const loadMore = document.querySelector("#vinyl-load-more");
  const previewName = document.querySelector("#vinyl-preview-name");
  const previewCars = document.querySelectorAll(".vinyl-car");
  const selectedImage = document.querySelector("#vinyl-selected-image");
  const selectedName = document.querySelector("#vinyl-selected-name");
  const selectedSeries = document.querySelector("#vinyl-selected-series");
  const colorInput = document.querySelector("#vinyl-color-name");
  const seriesInput = document.querySelector("#vinyl-color-series");
  const form = document.querySelector("#vinyl-order-form");
  const status = document.querySelector("#vinyl-order-status");
  const fulfillment = document.querySelector("#vinyl-fulfillment");
  const deliveryZip = document.querySelector("#vinyl-zip");

  if (!grid || !search || !seriesSelect || !colors.length) return;

  const PAGE_SIZE = 24;
  const popularSeries = [
    "all",
    "Super Bright",
    "Satin",
    "Crystal",
    "Black",
    "Two-Tone",
    "Carbon",
    "Diamond",
  ];
  let visibleCount = PAGE_SIZE;
  let activeSeries = "all";
  let selectedColor = null;

  const series = [...new Set(colors.map((color) => color.series))].sort();
  series.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    seriesSelect.appendChild(option);
  });

  popularSeries.forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.series = name;
    button.textContent = name === "all" ? "All colors" : name;
    button.className = name === "all" ? "is-active" : "";
    button.setAttribute("aria-pressed", String(name === "all"));
    chips.appendChild(button);
  });

  function filteredColors() {
    const query = search.value.trim().toLowerCase();
    return colors.filter((color) => {
      const seriesMatch = activeSeries === "all" || color.series === activeSeries;
      const queryMatch =
        !query ||
        color.name.toLowerCase().includes(query) ||
        color.series.toLowerCase().includes(query);
      return seriesMatch && queryMatch;
    });
  }

  function buildCard(color) {
    const article = document.createElement("article");
    article.className = "vinyl-color-card";
    article.dataset.id = color.id;

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "vinyl-card-swatch";
    previewButton.dataset.selectColor = color.id;
    previewButton.setAttribute(
      "aria-label",
      `Preview ${color.name} from the ${color.series} collection`
    );

    const image = document.createElement("img");
    image.src = color.image;
    image.alt = `${color.name} RPG premium vinyl color sample`;
    image.loading = "lazy";
    image.decoding = "async";
    previewButton.appendChild(image);

    const copy = document.createElement("div");
    copy.className = "vinyl-card-copy";

    const collection = document.createElement("p");
    collection.textContent = color.series;

    const heading = document.createElement("h3");
    heading.textContent = color.name;

    const actions = document.createElement("div");
    actions.className = "vinyl-card-actions";

    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "vinyl-preview-button";
    preview.dataset.selectColor = color.id;
    preview.innerHTML =
      '<i class="fas fa-car-side" aria-hidden="true"></i><span>Preview</span>';

    const request = document.createElement("button");
    request.type = "button";
    request.className = "vinyl-request-button";
    request.dataset.requestColor = color.id;
    request.textContent = "Request";

    actions.append(preview, request);
    copy.append(collection, heading, actions);
    article.append(previewButton, copy);
    return article;
  }

  function render() {
    const matches = filteredColors();
    resultCount.textContent = String(matches.length);
    totalCount.textContent = String(colors.length);
    grid.textContent = "";

    matches.slice(0, visibleCount).forEach((color) => {
      grid.appendChild(buildCard(color));
    });

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "vinyl-empty";
      empty.innerHTML =
        "<strong>No colors matched that search.</strong><span>Try another color name or choose all finishes.</span>";
      grid.appendChild(empty);
    }

    loadMore.hidden = matches.length <= visibleCount;
    loadMore.textContent = `Show More Colors (${matches.length - visibleCount})`;
  }

  function setSeries(name) {
    activeSeries = name;
    seriesSelect.value = name;
    visibleCount = PAGE_SIZE;
    chips.querySelectorAll("button").forEach((button) => {
      const active = button.dataset.series === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    render();
  }

  function chooseColor(id, scrollToRequest) {
    const color = colors.find((item) => item.id === id);
    if (!color) return;
    selectedColor = color;

    previewCars.forEach((car) => {
      car.style.setProperty("--vinyl-color", color.color);
      car.style.setProperty("--vinyl-texture", `url("${color.image}")`);
      car.setAttribute(
        "aria-label",
        `Modern sports coupe preview in ${color.name} vinyl`
      );
    });
    previewName.textContent = `${color.name} · ${color.series}`;
    selectedImage.src = color.image;
    selectedImage.alt = `${color.name} RPG premium vinyl color sample`;
    selectedName.textContent = color.name;
    selectedSeries.textContent = color.series;
    colorInput.value = color.name;
    seriesInput.value = color.series;

    document.querySelectorAll(".vinyl-color-card").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.id === id);
    });

    if (scrollToRequest) {
      document.querySelector("#vinyl-request").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      window.setTimeout(() => document.querySelector("#vinyl-name").focus(), 600);
    } else if (scrollToRequest === false) {
      document.querySelector(".vinyl-hero-preview").scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  search.addEventListener("input", function () {
    visibleCount = PAGE_SIZE;
    render();
  });

  seriesSelect.addEventListener("change", function () {
    setSeries(seriesSelect.value);
  });

  chips.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-series]");
    if (button) setSeries(button.dataset.series);
  });

  grid.addEventListener("click", function (event) {
    const request = event.target.closest("[data-request-color]");
    if (request) {
      chooseColor(request.dataset.requestColor, true);
      return;
    }
    const preview = event.target.closest("[data-select-color]");
    if (preview) chooseColor(preview.dataset.selectColor, false);
  });

  loadMore.addEventListener("click", function () {
    visibleCount += PAGE_SIZE;
    render();
  });

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `tint-form-status is-${type}`;
    status.hidden = false;
    status.focus();
  }

  if (form && status) {
    const submitButton = form.querySelector('button[type="submit"]');
    const defaultButtonText = submitButton.textContent;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      status.hidden = true;

      if (!selectedColor) {
        showStatus("Please choose a vinyl color from the catalog first.", "error");
        document.querySelector("#vinyl-catalog").scrollIntoView({ behavior: "smooth" });
        return;
      }

      if (!form.reportValidity()) return;

      submitButton.disabled = true;
      submitButton.textContent = "Sending Request…";
      form.setAttribute("aria-busy", "true");

      try {
        const fields = Object.fromEntries(new FormData(form).entries());
        const response = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.error || "We couldn’t send your request. Please try again."
          );
        }

        form.reset();
        colorInput.value = selectedColor.name;
        seriesInput.value = selectedColor.series;
        showStatus(
          "Your RPG Premium Vinyl request was received. Check your email for confirmation from admin@revlinepg.com. Revline will follow up with availability and pricing.",
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
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
        form.setAttribute("aria-busy", "false");
      }
    });
  }

  if (fulfillment && deliveryZip) {
    fulfillment.addEventListener("change", function () {
      const shipping = fulfillment.value === "U.S. shipping";
      deliveryZip.required = shipping;
      deliveryZip.setAttribute("aria-required", String(shipping));
      if (!shipping) deliveryZip.setCustomValidity("");
    });
  }

  render();
  chooseColor(
    colors.find((color) => color.name === "Metallic Black")?.id || colors[0].id,
    null
  );
})();
