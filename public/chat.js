(function () {
  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const ADJ = ["cosmic", "neon", "solar", "lunar", "turbo", "pixel", "glitch", "ghost", "cyber", "hyper"];
  const ANIMAL = ["duck", "shark", "wolf", "fox", "cat", "panda", "rabbit", "otter", "lynx", "crow"];
  function randName() {
    return ADJ[(Math.random() * ADJ.length) | 0] + "_" + ANIMAL[(Math.random() * ANIMAL.length) | 0];
  }

  let myName = localStorage.getItem("velcro-chat-name") || randName();
  localStorage.setItem("velcro-chat-name", myName);

  const sid = sessionStorage.getItem("velcro-chat-sid") || (Math.random().toString(36).slice(2) + Date.now().toString(36));
  sessionStorage.setItem("velcro-chat-sid", sid);

  const msgs = document.getElementById("chatMessages");
  const nameIn = document.getElementById("chatNameInput");
  const textIn = document.getElementById("chatTextInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const onlineEl = document.getElementById("chatOnlineCount");
  if (!msgs) return;
  nameIn.value = myName;

  function addMsg(msg) {
    const mine = msg.name === myName;
    const el = document.createElement("div");
    el.className = "chat-msg" + (mine ? " mine" : "");
    el.innerHTML =
      '<div class="chat-msg-meta">' +
      '<span class="chat-msg-name">' + esc(msg.name) + "</span>" +
      '<span class="chat-msg-time">' + fmtTime(msg.time) + "</span>" +
      "</div>" +
      '<span class="chat-msg-text">' + esc(msg.text) + "</span>";
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addSys(text) {
    const el = document.createElement("div");
    el.className = "chat-sys";
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  let lastTime = 0;
  const seen = new Set();
  let initialized = false;

  async function poll() {
    try {
      const r = await fetch("/api/chat/messages?since=" + lastTime + "&sid=" + sid);
      const { messages, online } = await r.json();
      if (onlineEl) onlineEl.textContent = online + " online";
      if (!initialized) {
        msgs.innerHTML = "";
        if (messages.length === 0) addSys("no messages yet — say hi!");
        initialized = true;
      }
      for (const msg of messages) {
        const key = msg.time + msg.name;
        if (!seen.has(key)) {
          seen.add(key);
          addMsg(msg);
          if (msg.time > lastTime) lastTime = msg.time;
        }
      }
    } catch {
      if (!initialized) addSys("connection error, retrying…");
    }
  }

  poll();
  setInterval(poll, 2000);

  nameIn.addEventListener("change", () => {
    myName = nameIn.value.trim() || myName;
    nameIn.value = myName;
    localStorage.setItem("velcro-chat-name", myName);
  });

  async function send() {
    const text = textIn.value.trim();
    if (!text) return;
    textIn.value = "";
    myName = nameIn.value.trim() || myName;
    nameIn.value = myName;
    localStorage.setItem("velcro-chat-name", myName);
    await fetch("/api/chat/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: myName, text }),
    }).catch(() => {});
  }

  sendBtn.addEventListener("click", send);
  textIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
})();
