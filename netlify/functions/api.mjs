// UNH AI Club // content API (Netlify Function, v2 syntax).
// Public:  GET /api/content, GET /api/img/:id, GET /api/me
// Officer: POST /api/login, POST /api/logout, PUT /api/content, POST /api/upload
import { getStore } from "@netlify/blobs";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KINDS = ["talk", "hackathon", "workshop", "social"];
const PHOTO_KEYS = [
  "heroPhoto",
  "memberPhoto",
  "aboutPhoto",
  "tile1",
  "tile2",
  "tile3",
  "tile4",
];
const MAX_IMG = 1_200_000; // bytes, after browser-side shrinking
const MAX_BODY = 1_500_000; // bytes, content JSON
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    },
  });

// ---------- sessions (signed cookie, no database needed) ----------
const secret = () => process.env.SESSION_SECRET || "";
const mac = (body) => createHmac("sha256", secret()).update(body).digest("base64url");

function makeToken() {
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_MS })).toString(
    "base64url",
  );
  return body + "." + mac(body);
}

function isAdmin(req) {
  if (secret().length < 32) return false;
  const m = /(?:^|; )sess=([^;]+)/.exec(req.headers.get("cookie") || "");
  if (!m) return false;
  const [body, sig] = m[1].split(".");
  if (!body || !sig) return false;
  const want = mac(body);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want)))
    return false;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}

// ---------- login ----------
function passwordOk(email, password) {
  const [alg, saltHex, hashHex] = (process.env.ADMIN_HASH || "").split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const want = Buffer.from(hashHex, "hex");
  const got = scryptSync(String(password), Buffer.from(saltHex, "hex"), want.length);
  const mailOk =
    String(email).trim().toLowerCase() ===
    String(process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
  return timingSafeEqual(got, want) && mailOk;
}

async function login(req, context) {
  if (secret().length < 32 || !process.env.ADMIN_HASH) {
    return json({ error: "Login is not configured yet." }, 500);
  }
  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const auth = getStore("auth");
  const key = "fail-" + ip.replace(/[^\w.:-]/g, "_");
  const rec = (await auth.get(key, { type: "json" })) || { n: 0, until: 0 };
  if (rec.until > Date.now())
    return json({ error: "Too many attempts. Try again in a few minutes." }, 429);

  const { email, password } = await req.json().catch(() => ({}));
  if (!passwordOk(email, password)) {
    rec.n += 1;
    if (rec.n >= MAX_FAILS) {
      rec.until = Date.now() + LOCK_MS;
      rec.n = 0;
    }
    await auth.setJSON(key, rec);
    return json({ error: "Wrong email or password." }, 401);
  }
  await auth.delete(key);
  return json({ ok: true }, 200, {
    "set-cookie": `sess=${makeToken()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`,
  });
}

// ---------- content validation: only known fields, capped lengths ----------
const S = (v, n) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
const IMG = (v) => (/^\/api\/img\/[a-f0-9]{20}$/.test(v) ? v : "");
const URLOK = (v) => (/^https?:\/\/[^\s"'<>]{1,300}$/.test(v) ? v : "");
const DATE = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const ID = (v) => (/^[\w-]{1,40}$/.test(v) ? v : randomBytes(6).toString("hex"));
const list = (a, max, fn) => (Array.isArray(a) ? a.slice(0, max).map(fn) : []);

function clean(c) {
  return {
    flyer: IMG(c.flyer),
    groupme: IMG(c.groupme),
    ...Object.fromEntries(PHOTO_KEYS.map((k) => [k, IMG(c[k])])),
    about: S(c.about, 5000),
    events: list(c.events, 200, (e) => ({
      id: ID(e.id),
      title: S(e.title, 120),
      kind: KINDS.includes(e.kind) ? e.kind : "social",
      date: DATE(e.date),
      time: S(e.time, 40),
      place: S(e.place, 120),
      desc: S(e.desc, 1000),
    })),
    schedule: list(c.schedule, 60, (r) => ({
      id: ID(r.id),
      when: S(r.when, 80),
      what: S(r.what, 160),
      kind: S(r.kind, 30),
    })),
    officers: list(c.officers, 40, (o) => ({
      id: ID(o.id),
      name: S(o.name, 80),
      role: S(o.role, 80),
      specialty: S(o.specialty, 160),
      link: URLOK(o.link),
      photo: IMG(o.photo),
    })),
    articles: list(c.articles, 200, (a) => ({
      id: ID(a.id),
      title: S(a.title, 140),
      author: S(a.author, 80),
      date: DATE(a.date),
      cover: IMG(a.cover),
      body: S(a.body, 20000),
    })),
  };
}

// ---------- router ----------
export default async (req, context) => {
  const path = new URL(req.url).pathname.replace(/^\/api\/?/, "");
  const method = req.method;

  if (method === "GET" && path === "content") {
    const site = await getStore("content").get("site", { type: "json" });
    return json(site, 200, { "cache-control": "public, max-age=20" });
  }
  if (method === "GET" && path.startsWith("img/")) {
    const id = path.slice(4);
    if (!/^[a-f0-9]{20}$/.test(id)) return json({ error: "Not found" }, 404);
    const data = await getStore("images").get(id, { type: "arrayBuffer" });
    if (!data) return json({ error: "Not found" }, 404);
    return new Response(data, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }
  if (method === "GET" && path === "me") return json({ admin: isAdmin(req) });

  // Everything below changes state: require the custom header (blocks cross-site forms).
  if (method !== "GET" && req.headers.get("x-csrf") !== "1")
    return json({ error: "Bad request" }, 400);

  if (method === "POST" && path === "login") return login(req, context);
  if (method === "POST" && path === "logout") {
    return json({ ok: true }, 200, {
      "set-cookie": "sess=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
    });
  }
  if (!isAdmin(req)) return json({ error: "Not logged in" }, 401);

  if (method === "PUT" && path === "content") {
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ error: "Content too large" }, 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Bad data" }, 400);
    }
    await getStore("content").setJSON("site", clean(body || {}));
    return json({ ok: true });
  }
  if (method === "POST" && path === "upload") {
    const { data } = await req.json().catch(() => ({}));
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(data || ""));
    if (!m) return json({ error: "Images must be JPEG" }, 400);
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > MAX_IMG || buf[0] !== 0xff || buf[1] !== 0xd8) {
      return json({ error: "Image too large or invalid" }, 400);
    }
    const id = randomBytes(10).toString("hex");
    await getStore("images").set(
      id,
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    );
    return json({ url: "/api/img/" + id });
  }
  return json({ error: "Not found" }, 404);
};

export const config = { path: "/api/*" };
