import "server-only"

import fs from "node:fs"
import puppeteer, { type Browser } from "puppeteer-core"

/**
 * Server-side PDF rendering: a headless Chrome opens one of our own printable
 * pages and saves it with the page's own @page rules, so the downloaded file is
 * exactly what the HTML document looks like when printed.
 *
 * Uses the machine's Chrome/Chromium rather than bundling one. On the VPS:
 *   sudo apt install chromium   (or google-chrome-stable)
 * and, if it lives somewhere unusual, point PUPPETEER_EXECUTABLE_PATH at it.
 */

const CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/snap/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

export class PdfUnavailableError extends Error {}

function findChrome(): string {
  const path = CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate))
  if (!path) {
    throw new PdfUnavailableError(
      "No Chrome/Chromium found for PDF export. Install chromium or set PUPPETEER_EXECUTABLE_PATH."
    )
  }
  return path
}

// One browser for the whole process (kept on globalThis so dev reloads don't
// leak a Chrome per edit); each render gets its own throwaway context.
const holder = globalThis as unknown as { __pdfBrowser?: Promise<Browser> }

async function getBrowser(): Promise<Browser> {
  const existing = holder.__pdfBrowser
  if (existing) {
    const browser = await existing.catch(() => null)
    if (browser?.connected) return browser
  }
  const launching = puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  })
  holder.__pdfBrowser = launching
  const browser = await launching.catch((error) => {
    holder.__pdfBrowser = undefined
    throw error
  })
  browser.on("disconnected", () => {
    if (holder.__pdfBrowser === launching) holder.__pdfBrowser = undefined
  })
  return browser
}

/**
 * Renders `url` to PDF bytes. `cookies` are set for that URL's origin only, so a
 * staff session reaches our admin page and never goes to third-party image hosts.
 */
export async function renderPdf(
  url: string,
  { cookies = [] }: { cookies?: { name: string; value: string }[] } = {}
): Promise<Uint8Array> {
  const browser = await getBrowser()
  const context = await browser.createBrowserContext()
  try {
    const page = await context.newPage()
    // The admin app defaults to dark; the document must always render light.
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }])
    if (cookies.length) {
      const { hostname } = new URL(url)
      await context.setCookie(
        ...cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: hostname,
          path: "/",
        }))
      )
    }

    const response = await page.goto(url, { waitUntil: "networkidle0", timeout: 45_000 })
    if (!response?.ok()) throw new Error(`PDF source page returned ${response?.status()}`)

    // Fonts and every photo must be in before the capture, or they print blank.
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(
        [...document.images].map((image) =>
          image.complete
            ? null
            : new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true })
                image.addEventListener("error", resolve, { once: true })
              })
        )
      )
    })

    return await page.pdf({ preferCSSPageSize: true, printBackground: true })
  } finally {
    await context.close()
  }
}

/** Where the renderer should load our own pages from. Defaults to the incoming request's origin. */
export function renderOrigin(request: Request): string {
  return (process.env.PDF_RENDER_ORIGIN || new URL(request.url).origin).replace(/\/+$/, "")
}

/** A download response with a readable, filesystem-safe file name. */
export function pdfResponse(bytes: Uint8Array, name: string): Response {
  const safe = name.replace(/[^\w\s.-]+/g, "").replace(/\s+/g, " ").trim() || "itinerary"
  const file = `${safe}.pdf`
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "no-store",
    },
  })
}

/** Common failure handling for the download routes. */
export function pdfFailure(error: unknown): Response {
  console.error("[pdf] render failed", error)
  const message =
    error instanceof PdfUnavailableError
      ? "PDF download isn't set up on this server yet."
      : "Could not generate the PDF. Please try again."
  return new Response(message, {
    status: error instanceof PdfUnavailableError ? 503 : 500,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
