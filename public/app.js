/* UNH AI Club // shared behavior: nav + footer injection, page transitions,
   scroll reveal, forms. Content + admin mode live in cms.js. */
const RM = matchMedia("(prefers-reduced-motion:reduce)").matches;
const p = (n) => String(n).padStart(2, "0");
const cur = location.pathname.split("/").pop() || "index.html";
const file = (h) => h.split("#")[0];

// Nav: [label, href, optional dropdown children]
const NAV = [
  ["Home", "index.html"],
  [
    "About Us",
    "about.html",
    [
      ["Our Club", "about.html"],
      ["Leadership", "team.html"],
    ],
  ],
  [
    "Events",
    "events.html",
    [
      ["Speaker Series", "events.html#speakers"],
      ["Hackathons", "events.html#hackathons"],
      ["Workshops", "events.html#workshops"],
    ],
  ],
  [
    "Projects",
    "projects.html",
    [
      ["Real-World Challenge", "projects.html#challenge"],
      ["Semester Projects", "projects.html#semester"],
    ],
  ],
  ["Student Voices", "voices.html"],
  ["Apply", "join.html"],
  ["Contact", "join.html#contact"],
];
// Community links. Replace the '#' placeholders with real URLs.
const SOCIAL = [
  ["Instagram", "#"],
  ["Catalyst", "#"],
  ["LinkedIn", "#"],
  ["GroupMe", "#"],
];

const active = (h, kids) =>
  (kids ? kids.some(([, x]) => file(x) == cur) : !h.includes("#") && file(h) == cur)
    ? ' class="on" aria-current="page"'
    : "";
const item = ([t, h, kids]) =>
  `<li${kids ? ' class="dd"' : ""}><a href="${h}"${active(h, kids)}>${t}</a>${
    kids
      ? `<ul>${kids.map(([a, b]) => `<li><a href="${b}">${a}</a></li>`).join("")}</ul>`
      : ""
  }</li>`;

document.body.insertAdjacentHTML(
  "afterbegin",
  `<header class="nav"><a class="logo" href="index.html">UNH <b>AI</b> Club</a>
   <button class="burger" aria-label="Menu" aria-expanded="false">☰</button>
   <nav aria-label="Primary"><ul>${NAV.map(item).join("")}</ul></nav></header>`,
);
document.body.insertAdjacentHTML(
  "beforeend",
  `<footer class="ft"><div class="in">
    <div><span class="lbl">// Join our email list</span>
      <form class="sign" data-ok="SUBSCRIBED // WATCH YOUR INBOX"><label class="sr" for="em" hidden>Email</label>
      <input id="em" type="email" required placeholder="you@unh.edu"><button class="btn" type="submit">Subscribe</button><p class="ok" role="status"></p></form></div>
    <div><span class="lbl">// Stay connected</span><p>UNH AI Club<br>Durham, NH 03824<br><a href="mailto:aiclub@unh.edu">aiclub@unh.edu</a></p></div>
    <div><span class="lbl">// Community</span>${SOCIAL.map(([t, h]) => `<a href="${h}" rel="noopener">${t}</a>`).join("")}</div>
  </div><div class="cp">UNH AI CLUB // UNIVERSITY OF NEW HAMPSHIRE</div></footer><div class="curtain" aria-hidden="true"></div>`,
);

// Mobile menu
const hd = document.querySelector(".nav"),
  bg = hd.querySelector(".burger");
bg.onclick = () => bg.setAttribute("aria-expanded", hd.classList.toggle("open"));

// Diagonal curtain transition between pages
const cu = document.querySelector(".curtain");
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-act]")) return;
  const a = e.target.closest('a[href$=".html"],a[href*=".html#"]');
  if (
    !a ||
    e.metaKey ||
    e.ctrlKey ||
    a.target ||
    RM ||
    file(a.getAttribute("href")) == cur
  )
    return;
  e.preventDefault();
  cu.classList.add("go");
  setTimeout(() => (location.href = a.href), 420);
});
addEventListener("pageshow", (e) => e.persisted && cu.classList.remove("go"));

// Diagonal scroll reveal
const io = new IntersectionObserver(
  (es) =>
    es.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }),
  { threshold: 0.15 },
);
document.querySelectorAll(".rv").forEach((el, i) => {
  el.style.transitionDelay = (i % 4) * 90 + "ms";
  io.observe(el);
});

// Front-end-only forms (wire to a real backend or form service later)
document.querySelectorAll("form[data-ok]").forEach((f) =>
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    f.querySelector(".ok").textContent = f.dataset.ok;
    const d = f.closest("dialog");
    d ? setTimeout(() => d.close(), 1200) : f.reset();
  }),
);
