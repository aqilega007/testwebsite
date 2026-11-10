/* UNH AI Club // content loader + officer admin mode.
   Public visitors: pages render from /api/content (falls back to content.seed.json).
   Officers: log in with the corner button, then add / edit / delete on the page. */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (d) =>
  d
    ? new Date(d + "T00:00")
        .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        .toUpperCase()
    : "";
const paras = (t) =>
  String(t || "")
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
const KINDS = ["talk", "hackathon", "workshop", "social"];

let C = null; // site content
let admin = false;

const api = async (path, opt = {}) => {
  const r = await fetch("/api/" + path, {
    credentials: "same-origin",
    ...opt,
    headers: { "x-csrf": "1", "content-type": "application/json", ...opt.headers },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Error " + r.status);
  return j;
};

// ---------- what each editable thing looks like ----------
// field = [key, label, type, extra]; image extra = max pixel size
// Single photos on the Home and About pages: [key, label, max pixels]
const PHOTOS = [
  ["heroPhoto", "Home banner photo", 1600],
  ["memberPhoto", "Home members photo", 1200],
  ["aboutPhoto", "About page photo", 1200],
  ["tile1", "Career Development tile photo", 900],
  ["tile2", "Networking tile photo", 900],
  ["tile3", "Hands-On Experience tile photo", 900],
  ["tile4", "Fun & Community tile photo", 900],
];
const T = {
  event: {
    list: "events",
    f: [
      ["title", "Title"],
      ["kind", "Type", "select", KINDS],
      ["date", "Date", "date"],
      ["time", "Time"],
      ["place", "Place"],
      ["desc", "Description", "textarea"],
    ],
  },
  row: {
    list: "schedule",
    f: [
      ["when", "When"],
      ["what", "What"],
      ["kind", "Label"],
    ],
  },
  officer: {
    list: "officers",
    f: [
      ["name", "Name"],
      ["role", "Role"],
      ["specialty", "Specialty"],
      ["link", "LinkedIn URL (https://...)", "url"],
      ["photo", "Photo", "image", 800],
    ],
  },
  article: {
    list: "articles",
    f: [
      ["title", "Title"],
      ["author", "Author"],
      ["date", "Date", "date"],
      ["cover", "Cover image", "image", 1200],
      ["body", "Article text (blank line = new paragraph)", "textarea"],
    ],
  },
  about: {
    single: true,
    f: [["about", "About text (blank line = new paragraph)", "textarea"]],
  },
  flyer: { single: true, f: [["flyer", "Next meeting flyer", "image", 1600]] },
  groupme: { single: true, f: [["groupme", "GroupMe QR code", "image", 600]] },
  ...Object.fromEntries(
    PHOTOS.map(([k, label, max]) => [k, { single: true, f: [[k, label, "image", max]] }]),
  ),
};

const rv = () => (admin ? "" : " rv");
const ctl = (t, id) =>
  admin
    ? `<div class="ctl"><button class="btn o sm" data-act="edit" data-t="${t}" data-id="${esc(id)}">Edit</button><button class="btn o sm" data-act="del" data-t="${t}" data-id="${esc(id)}">Delete</button></div>`
    : "";
const addBtn = (t, label, kind = "") =>
  admin
    ? `<button class="btn sm" data-act="add" data-t="${t}" data-kind="${kind}">+ ${label}</button>`
    : "";
const imgBox = (url, ph, alt = "") =>
  `<div class="img">${url ? `<img src="${esc(url)}" alt="${esc(alt)}">` : esc(ph)}</div>`;

// ---------- renderers, one per data-r="..." container ----------
const R = {
  photo(el) {
    const s = el.dataset.slot;
    el.innerHTML =
      (C[s]
        ? `<img src="${esc(C[s])}" alt="${esc(el.dataset.alt)}">`
        : `<span>${esc(el.dataset.ph)}</span>`) +
      (admin
        ? `<button type="button" class="btn o sm photoBtn" data-act="edit" data-t="${s}">Change photo</button>`
        : "");
  },
  slot(el) {
    const s = el.dataset.slot;
    el.innerHTML =
      `<div class="img ${el.dataset.cls || "flyer"}">${C[s] ? `<img src="${esc(C[s])}" alt="${esc(el.dataset.alt)}">` : `<span>${esc(el.dataset.ph)}</span>`}</div>` +
      (admin
        ? `<div class="ctl"><button class="btn o sm" data-act="edit" data-t="${s}">Change picture</button></div>`
        : "");
  },
  events(el) {
    const k = el.dataset.kind,
      today = new Date().toLocaleDateString("en-CA");
    const L = C.events.filter((e) => e.kind === k);
    const up = L.filter((e) => !e.date || e.date >= today).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const past = L.filter((e) => e.date && e.date < today).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    el.innerHTML =
      [...up, ...past]
        .map(
          (e) =>
            `<article class="ev${past.includes(e) ? " past" : ""}"><time>${fmt(e.date)}${e.time ? " · " + esc(e.time) : ""}</time><h3>${esc(e.title)}</h3>${e.place ? `<p>${esc(e.place)}</p>` : ""}${e.desc ? `<p>${esc(e.desc)}</p>` : ""}${ctl("event", e.id)}</article>`,
        )
        .join("") || "<p>Nothing scheduled yet. Check back soon.</p>";
    el.insertAdjacentHTML("beforeend", addBtn("event", "Add event", k));
  },
  schedule(el) {
    el.innerHTML =
      `<table><thead><tr><th>When</th><th>What</th><th>Type</th>${admin ? "<th></th>" : ""}</tr></thead><tbody>${C.schedule.map((r) => `<tr><td>${esc(r.when)}</td><td>${esc(r.what)}</td><td><span class="b">${esc(r.kind)}</span></td>${admin ? `<td>${ctl("row", r.id)}</td>` : ""}</tr>`).join("")}</tbody></table>` +
      addBtn("row", "Add row");
  },
  officers(el) {
    el.innerHTML =
      C.officers
        .map(
          (o, i) =>
            `<article class="tile${rv()}"><div class="pt">${o.photo ? `<img src="${esc(o.photo)}" alt="${esc(o.name)}">` : String(i + 1).padStart(2, "0")}</div><div class="t"><span class="lbl">${esc(o.role)}</span><h3>${esc(o.name)}</h3><p>${esc(o.specialty)}</p>${o.link ? `<a href="${esc(o.link)}" rel="noopener">LinkedIn</a>` : ""}${ctl("officer", o.id)}</div></article>`,
        )
        .join("") + (admin ? `<div>${addBtn("officer", "Add officer")}</div>` : "");
  },
  about(el) {
    el.innerHTML =
      paras(C.about) +
      (admin
        ? `<div class="ctl"><button class="btn o sm" data-act="edit" data-t="about">Edit text</button></div>`
        : "");
  },
  articles(el) {
    const L = [...C.articles].sort((a, b) => b.date.localeCompare(a.date));
    el.innerHTML =
      L.map((a) => tile(a, true)).join("") +
      (admin ? `<div>${addBtn("article", "Write article")}</div>` : "");
  },
  latest(el) {
    el.innerHTML = [...C.articles]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
      .map((a) => tile(a, false))
      .join("");
  },
  article(el) {
    const a = C.articles.find(
      (x) => x.id === new URLSearchParams(location.search).get("id"),
    );
    if (!a) {
      el.innerHTML =
        '<h1>Not found</h1><p>That article does not exist. <a href="voices.html">Back to Student Voices</a></p>';
      return;
    }
    document.title = a.title + " // UNH AI Club";
    el.innerHTML = `<span class="lbl">${fmt(a.date)} // ${esc(a.author)}</span><h1>${esc(a.title)}</h1>${a.cover ? imgBox(a.cover, "", a.title) : ""}${paras(a.body)}${ctl("article", a.id)}<a class="btn o" href="voices.html">All posts</a>`;
  },
};
const tile = (a, withCtl) =>
  `<article class="tile${rv()}"><a href="article.html?id=${esc(a.id)}">${imgBox(a.cover, "COVER")}</a><div class="t"><time>${fmt(a.date)}</time><h3><a href="article.html?id=${esc(a.id)}">${esc(a.title)}</a></h3><p>${esc(a.author)}</p>${withCtl ? ctl("article", a.id) : ""}</div></article>`;

function render() {
  document.querySelectorAll("[data-r]").forEach((el) => R[el.dataset.r]?.(el));
  document.querySelectorAll("[data-r] .rv:not(.in)").forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 90 + "ms";
    io.observe(el);
  });
  document.body.classList.toggle("adm", admin);
  $(".abar")?.remove();
  $(".adminBtn").hidden = admin;
  if (admin)
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="abar"><b>ADMIN MODE</b><button class="btn sm o" data-a="backup">Download backup</button><label class="btn sm o">Import backup<input type="file" accept=".json" hidden data-a="import"></label><button class="btn sm" data-a="logout">Log out</button></div>`,
    );
}

// ---------- saving ----------
async function save() {
  try {
    await api("content", { method: "PUT", body: JSON.stringify(C) });
  } catch (e) {
    if (e.message === "Not logged in") {
      admin = false;
      alert("Your session expired. Please log in again.");
    } else alert("Could not save: " + e.message);
  }
  render();
}

// ---------- photo shrinking (runs in the browser, before upload) ----------
async function shrink(file, max) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height); // flatten transparency
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

// ---------- edit dialog ----------
const dlg = document.createElement("dialog");
document.body.appendChild(dlg);
let editing = null; // { t, obj, isNew }

function field([k, label, type = "text", x], v) {
  if (type === "textarea")
    return `<label>${label}<textarea name="${k}" maxlength="20000">${esc(v)}</textarea></label>`;
  if (type === "select")
    return `<label>${label}<select name="${k}">${x.map((o) => `<option${o === v ? " selected" : ""}>${o}</option>`).join("")}</select></label>`;
  if (type === "image")
    return `<label>${label}</label><div class="imgf" data-max="${x}"><input type="hidden" name="${k}" value="${esc(v)}"><img src="${esc(v)}" alt=""${v ? "" : " hidden"}><input type="file" accept="image/*"><button type="button" class="btn o sm rm">Remove image</button><p class="ok" role="status"></p></div>`;
  return `<label>${label}<input name="${k}" type="${type}" value="${esc(v)}" maxlength="300"></label>`;
}

function openEd(t, id, kind) {
  const d = T[t];
  const found = d.single ? C : C[d.list].find((x) => x.id === id);
  editing = {
    t,
    isNew: !found,
    obj: found
      ? { ...found }
      : { id: uid(), ...(t === "event" ? { kind: kind || "talk" } : {}) },
  };
  dlg.innerHTML = `<form><h3>${found ? "Edit" : "Add"}</h3>${d.f.map((f) => field(f, editing.obj[f[0]] ?? "")).join("")}<button class="btn" type="submit">Save</button><button class="btn o" type="button" data-close>Cancel</button></form>`;
  dlg.showModal();
}

dlg.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) dlg.close();
  if (e.target.closest(".rm")) {
    const w = e.target.closest(".imgf");
    w.querySelector("[type=hidden]").value = "";
    w.querySelector("img").hidden = true;
  }
});
dlg.addEventListener("change", async (e) => {
  if (e.target.type !== "file" || !e.target.files[0]) return;
  const w = e.target.closest(".imgf"),
    msg = w.querySelector(".ok"),
    sv = dlg.querySelector("[type=submit]");
  msg.textContent = "Shrinking and uploading…";
  sv.disabled = true;
  try {
    const data = await shrink(e.target.files[0], +w.dataset.max);
    const r = await api("upload", { method: "POST", body: JSON.stringify({ data }) });
    w.querySelector("[type=hidden]").value = r.url;
    const im = w.querySelector("img");
    im.src = r.url;
    im.hidden = false;
    msg.textContent = "Photo ready.";
  } catch (x) {
    msg.textContent = "Upload failed: " + x.message;
  }
  sv.disabled = false;
});
dlg.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = T[editing.t],
    fd = new FormData(e.target);
  for (const [k] of d.f) editing.obj[k] = String(fd.get(k) ?? "").trim();
  if (d.single) Object.assign(C, editing.obj);
  else if (editing.isNew) C[d.list].push(editing.obj);
  else C[d.list][C[d.list].findIndex((x) => x.id === editing.obj.id)] = editing.obj;
  dlg.close();
  await save();
});

// ---------- buttons on the page ----------
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (b) {
    e.preventDefault(); // photo buttons can sit inside link cards
    const { act, t, id, kind } = b.dataset;
    if (act === "add") openEd(t, null, kind);
    if (act === "edit") openEd(t, id);
    if (act === "del" && confirm("Delete this? This cannot be undone.")) {
      C[T[t].list] = C[T[t].list].filter((x) => x.id !== id);
      await save();
      if ($("[data-r=article]")) location.href = "voices.html";
    }
  }
  const a = e.target.closest("[data-a]")?.dataset.a;
  if (a === "logout") {
    await api("logout", { method: "POST" }).catch(() => {});
    admin = false;
    render();
  }
  if (a === "backup") {
    const l = document.createElement("a");
    l.href = URL.createObjectURL(
      new Blob([JSON.stringify(C, null, 2)], { type: "application/json" }),
    );
    l.download = "unh-ai-club-backup-" + new Date().toLocaleDateString("en-CA") + ".json";
    l.click();
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.dataset.a !== "import" || !e.target.files[0]) return;
  try {
    const j = JSON.parse(await e.target.files[0].text());
    if (confirm("Replace ALL site content with this backup?")) {
      C = { ...C, ...j };
      await save();
    }
  } catch {
    alert("That file is not a valid backup.");
  }
  e.target.value = "";
});

// ---------- login ----------
const btn = document.createElement("button");
btn.className = "adminBtn";
btn.textContent = "Officer login";
document.body.appendChild(btn);
const lg = document.createElement("dialog");
lg.innerHTML = `<form><h3>Officer login</h3><label>Club email<input name="email" type="email" required autocomplete="username"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label><button class="btn" type="submit">Log in</button><button class="btn o" type="button" data-close>Cancel</button><p class="ok" role="alert"></p></form>`;
document.body.appendChild(lg);
btn.onclick = () => lg.showModal();
lg.addEventListener("click", (e) => e.target.closest("[data-close]") && lg.close());
lg.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target,
    msg = $(".ok", f);
  try {
    await api("login", {
      method: "POST",
      body: JSON.stringify({ email: f.email.value, password: f.password.value }),
    });
    admin = true;
    f.reset();
    msg.textContent = "";
    lg.close();
    render();
  } catch (x) {
    msg.textContent = x.message;
  }
});

// ---------- start ----------
(async () => {
  const [site, me] = await Promise.all([
    api("content").catch(() => null),
    api("me").catch(() => ({ admin: false })),
  ]);
  C = site || (await fetch("content.seed.json").then((r) => r.json()));
  admin = !!me.admin;
  render();
})();
