/**
 * NewsForge content console — a small, LOCALHOST-ONLY web UI to run the content
 * loop without the npm CLI: review the queue, publish drafts, run discovery,
 * commit + push, and preview a site. Deploy is intentionally NOT executed here
 * (it needs sudo in WSL); the UI only shows the command to run by hand.
 *
 * Security: this server shells out to git and the pipeline, so it is effectively
 * a local remote-execution endpoint. It binds to 127.0.0.1 only and validates
 * every input against a whitelist (known sites, known slugs, enum freshness,
 * integer counts). Do not change the bind host.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  existsSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = 4455;

const consoleDir = path.dirname(fileURLToPath(import.meta.url));
const pipelineDir = path.resolve(consoleDir, "..", "..");
const repoRoot = path.resolve(pipelineDir, "..");
const sitesDir = path.join(repoRoot, "sites");
const indexHtml = path.join(consoleDir, "index.html");

const LOCALES = ["en", "it"] as const;
type Locale = (typeof LOCALES)[number];

/** Detect content sites: folders under sites/ (excluding _shared) with content. */
function detectSites(): string[] {
  return readdirSync(sitesDir)
    .filter((name) => {
      if (name === "_shared" || name.startsWith(".")) return false;
      const dir = path.join(sitesDir, name);
      return (
        statSync(dir).isDirectory() &&
        existsSync(path.join(dir, "src", "config", "site.ts"))
      );
    })
    .sort();
}

function newsDir(site: string, lang: Locale): string {
  return path.join(sitesDir, site, "src", "content", "news", lang);
}

interface Frontmatter {
  title: string;
  pubDate: string;
  category: string;
  draft: boolean;
}

/** Minimal frontmatter reader — only the scalar fields the queue needs. */
function readFrontmatter(file: string): Frontmatter {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const block = m ? m[1] : "";
  const pick = (key: string): string => {
    const r = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return r ? r[1].trim().replace(/^["']|["']$/g, "") : "";
  };
  return {
    title: pick("title"),
    pubDate: pick("pubDate"),
    category: pick("category"),
    draft: /^draft:\s*true\s*$/m.test(block),
  };
}

interface ArticleRow {
  slug: string;
  title: string;
  pubDate: string;
  category: string;
  anyDraft: boolean;
  langs: Partial<Record<Locale, { draft: boolean }>>;
}

/** Scan a site's article files into an index, grouping translations by slug. */
function buildIndex(site: string): ArticleRow[] {
  const bySlug = new Map<string, ArticleRow>();
  for (const lang of LOCALES) {
    const dir = newsDir(site, lang);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!/\.(md|mdx)$/.test(f)) continue;
      const slug = f.replace(/\.(md|mdx)$/, "");
      const fm = readFrontmatter(path.join(dir, f));
      let row = bySlug.get(slug);
      if (!row) {
        row = {
          slug,
          title: fm.title || slug,
          pubDate: fm.pubDate,
          category: fm.category,
          anyDraft: false,
          langs: {},
        };
        bySlug.set(slug, row);
      }
      // Prefer the canonical (en) title/date when present.
      if (lang === "en" || !row.title) {
        row.title = fm.title || row.title;
        row.pubDate = fm.pubDate || row.pubDate;
        row.category = fm.category || row.category;
      }
      row.langs[lang] = { draft: fm.draft };
    }
  }
  const rows = [...bySlug.values()];
  for (const r of rows) r.anyDraft = Object.values(r.langs).some((l) => l.draft);
  rows.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""));
  return rows;
}

/*
 * The index is cached per site so search/pagination don't re-scan the disk on
 * every request — the whole point of scaling past a handful of articles. It is
 * rebuilt lazily on first use and invalidated after any mutation (publish,
 * discard, a discovery run). A human only ever acts on the small draft set; the
 * published archive is served paginated + filtered from this in-memory index.
 */
const indexCache = new Map<string, ArticleRow[]>();
function getIndex(site: string): ArticleRow[] {
  let idx = indexCache.get(site);
  if (!idx) {
    idx = buildIndex(site);
    indexCache.set(site, idx);
  }
  return idx;
}
function invalidateIndex(site: string): void {
  indexCache.delete(site);
}

function readArticle(site: string, lang: Locale, slug: string): string {
  for (const ext of ["md", "mdx"]) {
    const file = path.join(newsDir(site, lang), `${slug}.${ext}`);
    if (existsSync(file)) return readFileSync(file, "utf8");
  }
  return "";
}

// ---- process helpers ---------------------------------------------------------

/** Run a command to completion, capturing combined output. */
function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: true });
    let output = "";
    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? 0, output }));
    child.on("error", (err) => resolve({ code: 1, output: String(err) }));
  });
}

// ---- request helpers ---------------------------------------------------------

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(data);
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const FRESHNESS = new Set(["pd", "pw", "pm"]);
const previews = new Map<string, { port: number; url: string }>();

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const sites = detectSites();
  const requireSite = (raw: string | null): string | null =>
    raw && sites.includes(raw) ? raw : null;

  // GET /api/sites
  if (req.method === "GET" && url.pathname === "/api/sites") {
    return sendJson(res, 200, { sites });
  }

  // GET /api/articles?site=&status=draft|published&q=&category=&page=&pageSize=
  if (req.method === "GET" && url.pathname === "/api/articles") {
    const site = requireSite(url.searchParams.get("site"));
    if (!site) return sendJson(res, 400, { error: "sito sconosciuto" });
    const all = getIndex(site);
    const status = url.searchParams.get("status") ?? "draft";
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const category = url.searchParams.get("category") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(5, Number(url.searchParams.get("pageSize")) || 30),
    );

    let rows = all;
    if (status === "draft") rows = rows.filter((r) => r.anyDraft);
    else if (status === "published") rows = rows.filter((r) => !r.anyDraft);
    if (category) rows = rows.filter((r) => r.category === category);
    if (q) {
      rows = rows.filter(
        (r) => r.title.toLowerCase().includes(q) || r.slug.includes(q),
      );
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);
    return sendJson(res, 200, {
      items,
      total,
      page,
      pageSize,
      counts: {
        draft: all.filter((r) => r.anyDraft).length,
        published: all.filter((r) => !r.anyDraft).length,
      },
      categories: [...new Set(all.map((r) => r.category).filter(Boolean))].sort(),
    });
  }

  // GET /api/article?site=&lang=&slug=
  if (req.method === "GET" && url.pathname === "/api/article") {
    const site = requireSite(url.searchParams.get("site"));
    const lang = url.searchParams.get("lang") as Locale;
    const slug = url.searchParams.get("slug") ?? "";
    if (!site || !LOCALES.includes(lang)) {
      return sendJson(res, 400, { error: "parametri non validi" });
    }
    const known = getIndex(site).some((a) => a.slug === slug);
    if (!known) return sendJson(res, 404, { error: "articolo sconosciuto" });
    return sendJson(res, 200, { content: readArticle(site, lang, slug) });
  }

  // POST /api/publish {site, slug}
  if (req.method === "POST" && url.pathname === "/api/publish") {
    const body = await readBody(req);
    const site = requireSite(String(body.site ?? ""));
    const slug = String(body.slug ?? "");
    if (!site) return sendJson(res, 400, { error: "sito sconosciuto" });
    if (!getIndex(site).some((a) => a.slug === slug)) {
      return sendJson(res, 400, { error: "slug sconosciuto" });
    }
    const r = await run(
      "npx",
      ["tsx", "src/index.ts", "publish", "--site", site, "--slug", slug],
      pipelineDir,
    );
    if (r.code === 0) invalidateIndex(site);
    return sendJson(res, r.code === 0 ? 200 : 500, {
      ok: r.code === 0,
      output: r.output,
    });
  }

  // POST /api/discard {site, slug} — delete a DRAFT article (all langs) + prune
  // state. Refuses if any language is already published (never deletes live content).
  if (req.method === "POST" && url.pathname === "/api/discard") {
    const body = await readBody(req);
    const site = requireSite(String(body.site ?? ""));
    const slug = String(body.slug ?? "");
    if (!site) return sendJson(res, 400, { error: "sito sconosciuto" });
    const row = getIndex(site).find((a) => a.slug === slug);
    if (!row) return sendJson(res, 400, { error: "slug sconosciuto" });
    const allDraft = Object.values(row.langs).every((l) => l.draft);
    if (!allDraft) {
      return sendJson(res, 409, {
        error: "articolo pubblicato: non eliminabile dalla console",
      });
    }
    const removed: string[] = [];
    for (const lang of LOCALES) {
      for (const ext of ["md", "mdx"]) {
        const f = path.join(newsDir(site, lang), `${slug}.${ext}`);
        if (existsSync(f)) {
          unlinkSync(f);
          removed.push(`${lang}/${slug}.${ext}`);
        }
      }
    }
    const sf = path.join(pipelineDir, "state", `${site}.json`);
    if (existsSync(sf)) {
      try {
        const s = JSON.parse(readFileSync(sf, "utf8"));
        if (Array.isArray(s.covered)) {
          s.covered = s.covered.filter(
            (c: { slug?: string }) => c.slug !== slug,
          );
          writeFileSync(sf, JSON.stringify(s, null, 2) + "\n");
        }
      } catch {
        // state pruning is best-effort
      }
    }
    invalidateIndex(site);
    return sendJson(res, 200, { ok: true, removed });
  }

  // GET /api/discover/stream?site=&freshness=&maxQueries=&maxArticles=&dryRun=
  if (req.method === "GET" && url.pathname === "/api/discover/stream") {
    const site = requireSite(url.searchParams.get("site"));
    if (!site) return sendJson(res, 400, { error: "sito sconosciuto" });
    const freshness = url.searchParams.get("freshness") ?? "pw";
    const maxQueries = String(
      Math.max(1, Math.min(8, Number(url.searchParams.get("maxQueries")) || 2)),
    );
    const maxArticles = String(
      Math.max(1, Math.min(10, Number(url.searchParams.get("maxArticles")) || 2)),
    );
    const dryRun = url.searchParams.get("dryRun") === "1";
    const args = [
      "tsx",
      "src/index.ts",
      "discover",
      "--site",
      site,
      "--freshness",
      FRESHNESS.has(freshness) ? freshness : "pw",
      "--max-queries",
      maxQueries,
      "--max-articles",
      maxArticles,
    ];
    if (dryRun) args.push("--dry-run");

    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    const child = spawn("npx", args, { cwd: pipelineDir, shell: true });
    const send = (line: string) => res.write(`data: ${line}\n\n`);
    let buffer = "";
    const pump = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const l of lines) send(l);
    };
    child.stdout.on("data", pump);
    child.stderr.on("data", pump);
    child.on("close", (code) => {
      if (buffer) send(buffer);
      invalidateIndex(site); // a run may have written new drafts
      res.write(`event: done\ndata: ${code ?? 0}\n\n`);
      res.end();
    });
    req.on("close", () => child.kill());
    return;
  }

  // GET /api/git/status?site= — content changes for THIS site only
  if (req.method === "GET" && url.pathname === "/api/git/status") {
    const site = requireSite(url.searchParams.get("site"));
    if (!site) return sendJson(res, 400, { error: "sito sconosciuto" });
    const scope = `sites/${site}/src/content/news`;
    const r = await run("git", ["status", "--short", "--", scope], repoRoot);
    return sendJson(res, 200, { output: r.output.trim() });
  }

  // POST /api/git/commit {site} — add/commit/push ONLY this site's content.
  // Scoped on purpose: you work one site at a time, so a commit never sweeps in
  // another site's changes.
  if (req.method === "POST" && url.pathname === "/api/git/commit") {
    const body = await readBody(req);
    const site = requireSite(String(body.site ?? ""));
    if (!site) return sendJson(res, 400, { error: "sito sconosciuto" });
    const scope = `sites/${site}/src/content/news`;
    const status = await run(
      "git",
      ["status", "--porcelain", "--", scope],
      repoRoot,
    );
    if (!status.output.trim()) {
      return sendJson(res, 200, {
        ok: true,
        output: `Niente da committare per ${site}.`,
      });
    }
    const add = await run("git", ["add", "--", scope], repoRoot);
    if (add.code !== 0) return sendJson(res, 500, { ok: false, output: add.output });
    const msg = `Update ${site} content via console`;
    const commit = await run("git", ["commit", "-m", `"${msg}"`], repoRoot);
    if (commit.code !== 0) {
      return sendJson(res, 500, { ok: false, output: commit.output });
    }
    const push = await run("git", ["push"], repoRoot);
    return sendJson(res, push.code === 0 ? 200 : 500, {
      ok: push.code === 0,
      output: `${commit.output}\n${push.output}`,
    });
  }

  // GET /api/preview?site= — build then serve; returns the local URL
  if (req.method === "GET" && url.pathname === "/api/preview") {
    const site = requireSite(url.searchParams.get("site"));
    if (!site) return sendJson(res, 400, { error: "sito sconosciuto" });
    const existing = previews.get(site);
    if (existing) return sendJson(res, 200, { url: existing.url, built: false });

    const build = await run(
      "npm",
      ["run", "build", "--workspace", `sites/${site}`],
      repoRoot,
    );
    if (build.code !== 0) {
      return sendJson(res, 500, { error: "build fallita", output: build.output });
    }
    const port = 4321 + detectSites().indexOf(site);
    const url2 = `http://localhost:${port}`;
    const child = spawn(
      "npm",
      [
        "run",
        "preview",
        "--workspace",
        `sites/${site}`,
        "--",
        "--port",
        String(port),
      ],
      { cwd: repoRoot, shell: true, detached: false },
    );
    child.on("close", () => previews.delete(site));
    previews.set(site, { port, url: url2 });
    // Give astro preview a moment to bind before the browser opens.
    await new Promise((r) => setTimeout(r, 1500));
    return sendJson(res, 200, { url: url2, built: true });
  }

  sendJson(res, 404, { error: "not found" });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(indexHtml));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((err) =>
      sendJson(res, 500, { error: String(err) }),
    );
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, HOST, () => {
  console.log(`\n  NewsForge console → http://localhost:${PORT}\n`);
  console.log("  (solo locale; Ctrl+C per fermare)\n");
});
