import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Resolve paths safely for both CJS and ESM modes
let currentDirname = "";
try {
  currentDirname = __dirname;
} catch (e) {
  currentDirname = path.dirname(fileURLToPath(import.meta.url));
}

// Lazy load Gemini AI Client
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in your Secrets / Settings.");
    }
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// Helper function to retry and fallback to alternative models if the primary model is busy (503)
async function generateContentWithFallback(
  client: GoogleGenAI,
  options: { contents: string; systemInstruction: string; temperature: number }
) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[GEMINI] Attempting generation with model: ${modelName}`);
      const response = await client.models.generateContent({
        model: modelName,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature,
        },
      });
      if (response && response.text) {
        console.log(`[GEMINI] Success generating content with model: ${modelName}`);
        return response;
      }
    } catch (err: any) {
      console.warn(`[GEMINI] Warning: Model ${modelName} failed or busy. Error:`, err.message || err);
      lastError = err;
      
      // Wait briefly if it's a 503 error before making the next attempt
      if (err.message && (err.message.includes("503") || err.message.includes("UNAVAILABLE"))) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw lastError || new Error("All fallback Gemini models are currently experiencing high demand.");
}

// API: Generate specialized Python scrapers or sniffer scripts with robust model fallback
app.post("/api/generate-scraper", async (req, res) => {
  try {
    const { targetUrl, pageDescription, crawlerType } = req.body;

    if (!targetUrl) {
       res.status(400).json({ error: "Target URL is required" });
       return;
    }

    const client = getGeminiClient();

    let systemInstructions = `You are an expert Python scraper architect specialized in video streaming, OTT, IPTV stream URLs sniffing and custom m3u8 playlist generation.
Generate a production-ready, highly clean, well-commented Python script according to the target URL and requested scraper/sniffer type.
Provide ONLY the Python code inside backticks \`\`\`python ... \`\`\`. Do not write markdown text outside of the code block.

Common requested scraper patterns:
- 'playwright': Uses async Playwright (Chromium) to launch a headless browser, navigate to the target site, sniff network requests for any URLs containing '.m3u8' or play token patterns, extracts those parameters, and updates or outputs a playlist (JSON/w3u or .m3u).
- 'selenium': Uses Selenium (headless Chrome with webdriver_manager or Firefox UA) to wait for loaded elements on pages like livefixtures-wrapper, parse matches with BeautifulSoup, extract links/titles/team names and team logos, map them into a clean grouped json/m3u file.
- 'soup_req': Uses requests or tls-client with standard browser headers (User-Agent, Referer, Accept) to fetch the HTML, crawl stream lists, extract the playable URLs, and format them.

Always include robust error handling, anti-detect headers (realistic User-Agents), save/update code for playlists (such as saving as live_list.m3u or playlist.w3u), and detailed terminal logs.`;

    let userPrompt = `Generate a Python scraper script.
Target Website URL: ${targetUrl}
Description / What to crawl: ${pageDescription || "Extract stream/video channels and generate an M3U/M3U8 list."}
Scraper Engine / Technology: ${crawlerType || "playwright"}

Requirements:
1. Ensure realistic user-agents such as "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".
2. Add Referer headers if appropriate for the destination domain.
3. Organize the streams into a structured file output (M3U or JSON/W3U) that includes station name, group, image, and play URL.
4. Provide beautiful terminal status logs highlighting start, scrape progress, list count, and output path.`;

    const response = await generateContentWithFallback(client, {
      contents: userPrompt,
      systemInstruction: systemInstructions,
      temperature: 0.2, // Low temperature for high-quality, precise code generation
    });

    const pythonCode = response.text || "";
    res.json({ script: pythonCode });
  } catch (error: any) {
    console.error("Error generating scraper:", error);
    res.status(500).json({ error: error.message || "Failed to generate Python scraper script" });
  }
});

// API: Server-side CORS stream and manifest proxy with custom referer support
app.all("/api/proxy", async (req, res) => {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).send("url parameter is required");
      return;
    }

    // Default referer and user-agent matching the user requests
    const referer = (req.query.referer as string) || "https://ball67.com/";
    const userAgent = (req.query.user_agent as string) || "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0";

    console.log(`[PROXY] Bypassing CORS for: ${targetUrl} (Referer: ${referer})`);

    const fetchHeaders: Record<string, string> = {
      "User-Agent": userAgent,
      "Referer": referer,
    };

    if (req.headers["accept"]) fetchHeaders["Accept"] = req.headers["accept"] as string;
    if (req.headers["accept-language"]) fetchHeaders["Accept-Language"] = req.headers["accept-language"] as string;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout for chunks

    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: fetchHeaders,
      signal: controller.signal,
      body: ["POST", "PUT"].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    clearTimeout(timeoutId);

    // Set status code
    res.status(proxyRes.status);

    // Filter headers to copy
    const headersToCopy = ["content-type", "content-length", "cache-control", "expires"];
    proxyRes.headers.forEach((value, key) => {
      if (headersToCopy.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Enforce CORS so hls.js can play natively from any domain
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    const contentType = proxyRes.headers.get("content-type") || "";
    const isM3U8 = contentType.includes("mpegurl") || contentType.includes("mpegURL") || targetUrl.includes(".m3u8");

    if (isM3U8) {
      let bodyText = await proxyRes.text();
      const targetUrlObj = new URL(targetUrl);
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
      const origin = targetUrlObj.origin;

      // Split lines and parse relative paths or nested media playlists
      const lines = bodyText.split("\n");
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          return line;
        }

        // It is a URI or relative path
        let absoluteUrl = trimmed;
        if (!trimmed.startsWith("http")) {
          if (trimmed.startsWith("/")) {
            absoluteUrl = `${origin}${trimmed}`;
          } else {
            absoluteUrl = `${baseUrl}${trimmed}`;
          }
        }

        // Return proxy url so subsequent ts segment/chunk queries also inherit the bypass referer/cookie configurations
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}&user_agent=${encodeURIComponent(userAgent)}`;
      });

      res.send(rewrittenLines.join("\n"));
    } else {
      // Direct stream response buffering (such as binary .ts streams)
      if (proxyRes.body) {
        if (typeof (proxyRes.body as any).pipe === "function") {
          (proxyRes.body as any).pipe(res);
        } else {
          const reader = proxyRes.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        }
      } else {
        res.end();
      }
    }
  } catch (err: any) {
    console.error("Proxy error:", err);
    // Silent fail or standard CORS compliant response
    if (!res.headersSent) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(500).send(`Proxy failed: ${err.message}`);
    }
  }
});

// API: Quickly extract links/streams from raw HTML or target page server-side to prevent CORS blocking
app.post("/api/quick-extract", async (req, res) => {
  try {
    const { targetUrl } = req.body;
    if (!targetUrl) {
       res.status(400).json({ error: "Target URL is required" });
       return;
    }

    console.log(`[QUICK EXTRACT] Fetching target: ${targetUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    const fetchRes = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": targetUrl,
      },
    });
    
    clearTimeout(timeoutId);

    const html = await fetchRes.text();
    const foundStreams: Array<{ name: string; url: string; logo?: string; group?: string }> = [];

    // Simple robust regex matching for .m3u8, .mp4 HLS patterns
    // We look for direct streaming url attributes, HLS configs inside JavaScript variables, source tags, etc.
    const m3u8Regex = /(https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>]*)?/gi;
    const mp4Regex = /(https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>]*)?/gi;

    const matchedM3u8 = html.match(m3u8Regex) || [];
    const matchedMp4 = html.match(mp4Regex) || [];

    const allMatches = Array.from(new Set([...matchedM3u8, ...matchedMp4]))
      .filter(url => url && url.length > 10)
      .map(url => {
        // Clean trailing symbols often captured by regex
        let cleaned = url.replace(/\\/g, "").split("'")[0].split('"')[0].split(")")[0].split(">")[0];
        // Clean leading/trailing quotes
        return cleaned;
      });

    // Extract page title or elements if possible
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const domainName = new URL(targetUrl).hostname;
    const pageTitle = titleMatch ? titleMatch[1].trim() : domainName;

    const dedupedUrls = new Set<string>();

    allMatches.forEach((streamUrl, idx) => {
      if (dedupedUrls.has(streamUrl)) return;
      dedupedUrls.add(streamUrl);

      // Guess stream name
      let streamName = `Stream ${idx + 1}`;
      try {
        const parsedStream = new URL(streamUrl);
        const pathSegments = parsedStream.pathname.split("/");
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment && lastSegment.length > 5) {
          streamName = lastSegment.split("?")[0];
        } else if (pathSegments[pathSegments.length - 2]) {
          streamName = pathSegments[pathSegments.length - 2];
        }
      } catch (e) {}

      // Beautify names
      streamName = streamName.replace(/\.(m3u8|mp4)/i, "");
      streamName = `${streamName.charAt(0).toUpperCase()}${streamName.slice(1)}`;

      foundStreams.push({
        name: `${streamName} @ ${domainName}`,
        url: streamUrl,
        group: pageTitle,
        logo: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=200"
      });
    });

    res.json({
      title: pageTitle,
      url: targetUrl,
      streams: foundStreams,
      count: foundStreams.length,
    });
  } catch (error: any) {
    console.error("Error doing quick extract:", error);
    res.status(500).json({ error: error.message || "Failed to fetch or parse link" });
  }
});

// API: Parse a remote .m3u playlist in standard format or simple w3u JSON
app.post("/api/fetch-m3u", async (req, res) => {
  try {
    const { m3uUrl, rawText } = req.body;
    let playlistContent = "";

    if (m3uUrl) {
      console.log(`[PARSE PLAYLIST] Fetching: ${m3uUrl}`);
      const fetchRes = await fetch(m3uUrl);
      playlistContent = await fetchRes.text();
    } else if (rawText) {
      playlistContent = rawText;
    } else {
       res.status(400).json({ error: "Either m3uUrl or rawText is required" });
       return;
    }

    const normalizedStreams: Array<{ name: string; url: string; logo?: string; group?: string; headers?: Record<string, string> }> = [];

    // Check if the response is JSON (often W3U format requested in the prompt)
    if (playlistContent.trim().startsWith("{") || playlistContent.trim().startsWith("[")) {
      try {
        const jsonData = JSON.parse(playlistContent);
        
        const parseW3u = (data: any) => {
          const stations: any[] = [];
          if (data.stations && Array.isArray(data.stations)) {
            stations.push(...data.stations);
          } else if (Array.isArray(data)) {
            stations.push(...data);
          } else if (data.groups && Array.isArray(data.groups)) {
            data.groups.forEach((g: any) => {
              if (g.stations && Array.isArray(g.stations)) {
                g.stations.forEach((s: any) => {
                  stations.push({
                    ...s,
                    group: g.name || "Default Group"
                  });
                });
              }
            });
          }
          return stations;
        };

        const w3uStations = parseW3u(jsonData);
        w3uStations.forEach((s: any) => {
          if (s.name && s.url) {
            normalizedStreams.push({
              name: s.name,
              url: s.url,
              logo: s.image || s.logo || "",
              group: s.group || s.info || "W3U Playlist",
              headers: s.referer || s.userAgent ? {
                ...(s.referer ? { "Referer": s.referer } : {}),
                ...(s.userAgent ? { "User-Agent": s.userAgent } : {})
              } : undefined
            });
          }
        });

         res.json({
          format: "w3u",
          name: jsonData.name || "W3U Playlist",
          author: jsonData.author || "Unknown",
          streams: normalizedStreams,
          count: normalizedStreams.length
        });
        return;
      } catch (jsonErr) {
        console.error("Failed to parse JSON playlist, fallback to M3U", jsonErr);
      }
    }

    // Parse EXTM3U format
    const lines = playlistContent.split("\n");
    let currentStation: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("#EXTINF:")) {
        currentStation = { name: "Unnamed Stream", logo: "", group: "M3U Playlist" };
        
        // Match metadata attributes: tvg-logo, group-title, tvg-name, etc.
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        if (logoMatch) currentStation.logo = logoMatch[1];

        const groupMatch = line.match(/group-title="([^"]+)"/i);
        if (groupMatch) currentStation.group = groupMatch[1];

        // The display name of the channel is everything after the last comma on the #EXTINF line
        const commaIndex = line.lastIndexOf(",");
        if (commaIndex !== -1) {
          currentStation.name = line.substring(commaIndex + 1).trim();
        }
      } else if (line.startsWith("#EXTVLCOPT:")) {
        // VLC options often contain referer/User-Agent, extract if possible
        if (currentStation) {
          const uagent = line.match(/http-user-agent=(.+)/i);
          const referer = line.match(/http-referrer=(.+)/i);

          if (uagent || referer) {
            currentStation.headers = currentStation.headers || {};
            if (uagent) currentStation.headers["User-Agent"] = uagent[1].trim();
            if (referer) currentStation.headers["Referer"] = referer[1].trim();
          }
        }
      } else if (!line.startsWith("#") && line.startsWith("http")) {
        if (currentStation) {
          currentStation.url = line;
          normalizedStreams.push(currentStation);
          currentStation = null;
        } else {
          // Playable stream line without preceding #EXTINF
          normalizedStreams.push({
            name: line.split("/").pop() || "Direct Stream",
            url: line,
            group: "Direct Links",
            logo: ""
          });
        }
      }
    }

    res.json({
      format: "m3u",
      name: "M3U Playlist",
      streams: normalizedStreams,
      count: normalizedStreams.length
    });
  } catch (error: any) {
    console.error("Error parsing playlist:", error);
    res.status(500).json({ error: error.message || "Failed to fetch or parse playlist" });
  }
});

// Setup Vite and standard routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEV MODE] Registering Vite development middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[PROD MODE] Serving static files from 'dist' directory...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
