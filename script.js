(function () {
  "use strict";

  const STORAGE_KEY = "revline-ask-rpg-v1";
  const SESSION_KEY = "revline-ask-rpg-session";
  const MAX_HISTORY = 10;
  const welcomeMessage =
    "Hey—I'm Ask RPG. I can help with services, vehicle concerns, pre-cut tint, Revline apparel, or getting an appointment request started. What can I help with?";

  const launcher = document.createElement("button");
  launcher.className = "rpg-chat-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open Ask RPG assistant");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML =
    '<img src="rpg-icon.png" alt="" aria-hidden="true"><span>Ask RPG</span><i class="fas fa-comment-dots" aria-hidden="true"></i>';

  const panel = document.createElement("section");
  panel.className = "rpg-chat-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "rpg-chat-title");
  panel.hidden = true;
  panel.innerHTML = `
    <header class="rpg-chat-header">
      <div class="rpg-chat-identity">
        <img src="rpg-icon.png" alt="RPG">
        <div>
          <strong id="rpg-chat-title">Ask RPG</strong>
          <span><i aria-hidden="true"></i> Revline service &amp; shop assistant</span>
        </div>
      </div>
      <button class="rpg-chat-close" type="button" aria-label="Close Ask RPG">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </header>
    <div class="rpg-chat-messages" aria-live="polite" aria-label="Conversation"></div>
    <div class="rpg-chat-suggestions" aria-label="Suggested questions">
      <button type="button" data-question="What services do you offer?">Services</button>
      <button type="button" data-question="Help me understand the pre-cut tint options.">Tint options</button>
      <button type="button" data-question="What Revline apparel can I buy?">Apparel</button>
      <a href="contact.html#contact-form">Request appointment</a>
    </div>
    <form class="rpg-chat-form">
      <label class="sr-only" for="rpg-chat-input">Message Ask RPG</label>
      <textarea id="rpg-chat-input" maxlength="1600" rows="1" placeholder="Ask about your vehicle or Revline…"></textarea>
      <button type="submit" aria-label="Send message">
        <i class="fas fa-arrow-up" aria-hidden="true"></i>
      </button>
    </form>
    <p class="rpg-chat-note">Chats are retained in Revline's OpenAI project logs. AI guidance only—not a diagnosis or confirmed appointment. Don’t share payment or password information.</p>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(launcher);

  const closeButton = panel.querySelector(".rpg-chat-close");
  const messagesElement = panel.querySelector(".rpg-chat-messages");
  const suggestions = panel.querySelector(".rpg-chat-suggestions");
  const form = panel.querySelector(".rpg-chat-form");
  const input = panel.querySelector("#rpg-chat-input");
  const sendButton = form.querySelector('button[type="submit"]');
  let history = [];
  let busy = false;
  let sessionId = "";

  try {
    sessionId = sessionStorage.getItem(SESSION_KEY) || "";
    if (!sessionId) {
      sessionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `rpg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) {
      history = saved
        .filter((item) => item && ["user", "assistant"].includes(item.role) && item.content)
        .slice(-MAX_HISTORY);
    }
  } catch {
    history = [];
    sessionId = `rpg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch {
      // The assistant still works when session storage is unavailable.
    }
  }

  function addMessage(role, content, persist) {
    const message = document.createElement("div");
    message.className = `rpg-chat-message rpg-chat-message-${role}`;

    const label = document.createElement("span");
    label.className = "rpg-chat-message-label";
    label.textContent = role === "assistant" ? "Ask RPG" : "You";

    const text = document.createElement("p");
    text.textContent = content;

    message.append(label, text);
    messagesElement.appendChild(message);
    messagesElement.scrollTop = messagesElement.scrollHeight;

    if (persist) {
      history.push({ role, content });
      history = history.slice(-MAX_HISTORY);
      saveHistory();
    }
  }

  function renderHistory() {
    messagesElement.textContent = "";
    if (!history.length) {
      addMessage("assistant", welcomeMessage, false);
      return;
    }
    history.forEach((item) => addMessage(item.role, item.content, false));
  }

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.classList.toggle("is-open", open);
    if (open) {
      input.focus();
      messagesElement.scrollTop = messagesElement.scrollHeight;
    } else {
      launcher.focus();
    }
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    input.disabled = nextBusy;
    sendButton.disabled = nextBusy;
    sendButton.classList.toggle("is-loading", nextBusy);
    sendButton.innerHTML = nextBusy
      ? '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>'
      : '<i class="fas fa-arrow-up" aria-hidden="true"></i>';
  }

  async function sendMessage(rawMessage) {
    const message = String(rawMessage || "").trim();
    if (!message || busy) return;

    const previous = history.slice(-8);
    addMessage("user", message, true);
    input.value = "";
    setBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, messages: previous, sessionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ask RPG is unavailable.");
      addMessage("assistant", data.reply, true);
    } catch (error) {
      addMessage(
        "assistant",
        error && error.message
          ? error.message
          : "I’m temporarily unavailable. Please call Revline at 720-800-1542.",
        false
      );
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  launcher.addEventListener("click", function () {
    setOpen(panel.hidden);
  });

  closeButton.addEventListener("click", function () {
    setOpen(false);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  suggestions.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-question]");
    if (button) sendMessage(button.dataset.question);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });

  const params = new URLSearchParams(window.location.search);
  const requestedTopic = params.get("topic");
  if (requestedTopic && document.querySelector("#contact-message")) {
    const contactMessage = document.querySelector("#contact-message");
    if (!contactMessage.value) {
      contactMessage.value = `I would like help with ${requestedTopic}. `;
    }
  }

  renderHistory();
})();
