import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, Square, Terminal, Sliders, Download, Copy, Plus, Trash2, 
  Search, RefreshCw, Tv, FileDown, FolderPlus, Globe, Code, 
  ExternalLink, Layers, AlertTriangle, Check, Edit2, CheckCircle, 
  FileText, Share2, HelpCircle, HardDriveDownload
} from "lucide-react";
import Hls from "hls.js";
import { StreamChannel, ScriptPreset } from "./types";
import { PRESETS } from "./presets";

export default function App() {
  const [activeTab, setActiveTab] = useState<"generator" | "extractor" | "playlist">("generator");

  // --- State for Tab 1: Python Scraper Script Builder ---
  const [targetUrl, setTargetUrl] = useState<string>(PRESETS[0].url);
  const [description, setDescription] = useState<string>(PRESETS[0].description);
  const [engine, setEngine] = useState<"playwright" | "selenium" | "soup_req">(PRESETS[0].engine);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [scriptNotice, setScriptNotice] = useState<string>("");
  const [copiedState, setCopiedState] = useState<boolean>(false);

  // --- State for Tab 2: Quick Extractor ---
  const [extractUrl, setExtractUrl] = useState<string>(PRESETS[1].url);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractorResults, setExtractorResults] = useState<{ title: string; streams: StreamChannel[] } | null>(null);
  const [extractionMsg, setExtractionMsg] = useState<string>("");

  // --- State for Tab 3: Playlist Manager & Live Player ---
  const [m3uUrl, setM3uUrl] = useState<string>("https://iptv-org.github.io/iptv/countries/th.m3u");
  const [playlistRaw, setPlaylistRaw] = useState<string>("");
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [playlistMeta, setPlaylistMeta] = useState<{ name: string; author: string; format: "m3u" | "w3u" }>({
    name: "สตรีมไทยแลนด์สด",
    author: "M3U Sniffer Setup",
    format: "m3u"
  });
  const [channels, setChannels] = useState<StreamChannel[]>([
    {
      id: "ch-1",
      name: "Thai TV CH3 (Sample)",
      url: "https://ch3plus.com/live/ch3.m3u8", // Direct play might be protected, but serves as template
      group: "Digital TV",
      logo: "https://images.unsplash.com/photo-1598257006458-087169a1f08d?q=80&w=200"
    },
    {
      id: "ch-2",
      name: "Sample Big Buck Bunny (HLS-Test)",
      url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      group: "Movies & Testing",
      logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=200"
    },
    {
      id: "ch-3",
      name: "Sintel (HLS-MultiAudio Test)",
      url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
      group: "Movies & Testing",
      logo: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=200"
    }
  ]);
  
  const [currentChannel, setCurrentChannel] = useState<StreamChannel | null>(null);
  const [useCorsProxy, setUseCorsProxy] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("ALL");
  const [playbackError, setPlaybackError] = useState<string>("");
  
  // Custom new channel modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newChanName, setNewChanName] = useState<string>("");
  const [newChanUrl, setNewChanUrl] = useState<string>("");
  const [newChanGroup, setNewChanGroup] = useState<string>("ทั่วไป");
  const [newChanLogo, setNewChanLogo] = useState<string>("");

  // Edit channel modal states
  const [editingChannel, setEditingChannel] = useState<StreamChannel | null>(null);

  // Player DOM Reference
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);

  // Apply a preset to the python script generator
  const applyPreset = (preset: ScriptPreset) => {
    setTargetUrl(preset.url);
    setDescription(preset.description);
    setEngine(preset.engine);
    setScriptNotice(`โหลดโครงร่าง Preset: ${preset.title} เรียบร้อยแล้ว`);
    setTimeout(() => setScriptNotice(""), 3500);
  };

  // Generate Python Scraper from API
  const handleGenerateScraper = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setScriptNotice("");
    try {
      const response = await fetch("/api/generate-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          pageDescription: description,
          crawlerType: engine
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ขออภัย เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์ในการสร้างสคริปต์");
      }
      
      setGeneratedScript(data.script);
      setScriptNotice("ยินดีด้วย! สร้างสคริปต์ Python อัจฉริยะเสร็จสมบูรณ์แล้ว");
    } catch (err: any) {
      console.error(err);
      setScriptNotice(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick HTML URL link extraction
  const handleQuickExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExtracting(true);
    setExtractionMsg("");
    setExtractorResults(null);
    try {
      const response = await fetch("/api/quick-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: extractUrl })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "สกัดลิงก์ล้มเหลว ตรวจสอบระบบเซิร์ฟเวอร์ข้ามโดเมน");
      }
      
      // Adapt result streams
      const streamsWithId = (data.streams || []).map((s: any, idx: number) => ({
        ...s,
        id: `ext-${Date.now()}-${idx}`
      }));

      setExtractorResults({
        title: data.title || "หน้าเว็บบราวเซอร์หลัก",
        streams: streamsWithId
      });
      setExtractionMsg(`สแกนเสร็จสิ้น! ค้นพบลิ้งก์เพลย์เลิสต์ทั้งหมด ${streamsWithId.length} ช่อง`);
    } catch (err: any) {
      console.error(err);
      setExtractionMsg(`เกิดปัญหา: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Load playlist from file or custom text
  const handleParsePlaylist = async (useRaw: boolean) => {
    setIsParsing(true);
    try {
      const bodyPayload = useRaw 
        ? { rawText: playlistRaw } 
        : { m3uUrl: m3uUrl };

      const response = await fetch("/api/fetch-m3u", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "แยกวิเคราะห์เพลย์ลิสต์ล้มเหลว");
      }

      setPlaylistMeta({
        name: data.name || "เพลย์ลิสต์ที่นำเข้า",
        author: data.author || "ผู้ใช้งาน",
        format: data.format || "m3u"
      });

      // Add unique IDs
      const mappedChannels: StreamChannel[] = (data.streams || []).map((ch: any, idx: number) => ({
        ...ch,
        id: `parsed-${Date.now()}-${idx}`
      }));

      setChannels(mappedChannels);
      if (mappedChannels.length > 0) {
        setCurrentChannel(mappedChannels[0]);
      }
      alert(`นำเข้าเพลย์ลิสต์สำเร็จ! ค้นพบทั้งหมด ${mappedChannels.length} ช่องรายการ`);
    } catch (err: any) {
      alert(`ไม่สามารถนำเข้าข้อมูลได้: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Update live stream video in the HLS viewer
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    setPlaybackError("");

    // Cleanup previous hls instances
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    if (!currentChannel?.url) return;

    let streamUrl = currentChannel.url;
    if (useCorsProxy) {
      const refererVal = currentChannel.headers?.Referer || "https://ball67.com/";
      streamUrl = `/api/proxy?url=${encodeURIComponent(currentChannel.url)}&referer=${encodeURIComponent(refererVal)}`;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true
      });
      hlsInstanceRef.current = hls;
      
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          console.log("Autoplay block detected, waiting for interaction.");
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS Live Playback Error: ", data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlaybackError("เครือข่ายขัดข้อง: ลิงก์สตรีมอาจถูกปิดกั้น (CORS) หรือออฟไลน์อยู่");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setPlaybackError("มีเดียผิดพลาด: ไม่สามารถเข้ารหัสสัญญาณวิดีโอรายการนี้ได้");
              hls.recoverMediaError();
              break;
            default:
              setPlaybackError("ช่องสตรีมไม่สามารถเล่นได้ในระบบเว็บจำลอง (ต้องการการระบุ referrer หรือบล็อกโดยผู้ให้บริการ)");
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Apple device playback (Safari/iOS)
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(e => console.log("Safari play warning: ", e));
      });
    } else {
      setPlaybackError("บราวเซอร์ของคุณไม่รองรับการเล่นสตรีมแบบ HLS/M3U8 ด้วยเทคโนโลยี HTML5");
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [currentChannel, useCorsProxy]);

  // Copy code utility
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  // Download Python Script to local file
  const downloadPythonScript = (code: string) => {
    const element = document.createElement("a");
    const file = new Blob([code], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `stream_sniffer_script_${engine}.py`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Delete channel
  const deleteChannel = (id: string) => {
    const updated = channels.filter(ch => ch.id !== id);
    setChannels(updated);
    if (currentChannel?.id === id) {
      setCurrentChannel(updated.length > 0 ? updated[0] : null);
    }
  };

  // Add channel manually
  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName || !newChanUrl) {
      alert("กรุณากรอกชื่อช่องรายการ และ ลิงก์ URL สตรีมมิ่งด้วย");
      return;
    }
    const newChan: StreamChannel = {
      id: `man-${Date.now()}`,
      name: newChanName,
      url: newChanUrl,
      group: newChanGroup || "ทั่วไป",
      logo: newChanLogo || "https://images.unsplash.com/photo-1598257006458-087169a1f08d?q=80&w=200"
    };

    setChannels([newChan, ...channels]);
    setCurrentChannel(newChan);
    setShowAddModal(false);
    // Clear inputs
    setNewChanName("");
    setNewChanUrl("");
    setNewChanGroup("ทั่วไป");
    setNewChanLogo("");
  };

  // Edit existing channel
  const handleUpdateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel) return;

    const updated = channels.map(ch => ch.id === editingChannel.id ? editingChannel : ch);
    setChannels(updated);
    if (currentChannel?.id === editingChannel.id) {
      setCurrentChannel(editingChannel);
    }
    setEditingChannel(null);
  };

  // Export Playlist to M3U
  const exportToM3U = () => {
    let m3uContent = "#EXTM3U\n";
    channels.forEach(ch => {
      m3uContent += `#EXTINF:-1 tvg-logo="${ch.logo || ""}" group-title="${ch.group || "ทั่วไป"}",${ch.name}\n`;
      m3uContent += `${ch.url}\n`;
    });

    const file = new Blob([m3uContent], { type: 'text/plain;charset=utf-8' });
    const element = document.createElement("a");
    element.href = URL.createObjectURL(file);
    element.download = `${playlistMeta.name || "scraped_streams"}.m3u`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Export Playlist to W3U (Wiseplay format requested in python scripts!)
  const exportToW3U = () => {
    // Collect by group
    const groupsMap = new Map<string, StreamChannel[]>();
    channels.forEach(ch => {
      const gName = ch.group || "ทั่วไป";
      if (!groupsMap.has(gName)) {
        groupsMap.set(gName, []);
      }
      groupsMap.get(gName)!!.push(ch);
    });

    const groupsJsonArray: any[] = [];
    groupsMap.forEach((stations, gName) => {
      groupsJsonArray.push({
        name: gName,
        image: "https://img2.pic.in.th/sitelogo.md.png",
        stations: stations.map(s => ({
          name: s.name,
          image: s.logo || "",
          url: s.url,
          referer: s.headers?.Referer || "https://ball67.com/",
          userAgent: s.headers?.["User-Agent"] || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/146.0"
        }))
      });
    });

    const w3uData = {
      name: playlistMeta.name,
      author: playlistMeta.author || "M3U Pro Sniffer Tool",
      info: `Generated on ${new Date().toLocaleDateString()}`,
      image: "https://img2.pic.in.th/sitelogo.md.png",
      groups: groupsJsonArray
    };

    const file = new Blob([JSON.stringify(w3uData, null, 2)], { type: 'application/json;charset=utf-8' });
    const element = document.createElement("a");
    element.href = URL.createObjectURL(file);
    element.download = `${w3uData.name.replace(/\s+/g, '_') || "MOM"}.w3u`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Helper lists for group filtering
  const channelGroups = ["ALL", ...Array.from(new Set(channels.map(ch => ch.group || "ทั่วไป")))];

  // Filter channels based on filter states
  const filteredChannels = channels.filter(ch => {
    const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ch.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = activeGroupFilter === "ALL" || (ch.group || "ทั่วไป") === activeGroupFilter;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="min-h-screen bg-slate-950 font-sans tracking-wide pb-12">
      {/* Top navigation Header banner */}
      <header className="bg-slate-900/60 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 rounded-xl shadow-lg shadow-indigo-900/20">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-display">M3U Stream Sniffer & Script Builder</h1>
              <p className="text-xs text-slate-400">สร้างสคริปต์ Python ค้นหาลิงก์ ถ่ายทอดสารพันสื่อทีวี m3u/m3u8 ด้วยระบบอัจฉริยะ</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 p-1 border border-slate-850 rounded-xl">
            <button 
              id="tab-generator-btn"
              onClick={() => setActiveTab("generator")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center gap-1.5 ${
                activeTab === "generator" 
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-950/40" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>สร้าง Python Scraper (AI)</span>
            </button>
            
            <button 
              id="tab-extractor-btn"
              onClick={() => setActiveTab("extractor")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center gap-1.5 ${
                activeTab === "extractor" 
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-950/40" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>ดึงลิงก์ด่วน (CORS-Proxy)</span>
            </button>

            <button 
              id="tab-playlist-btn"
              onClick={() => setActiveTab("playlist")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center gap-1.5 ${
                activeTab === "playlist" 
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-950/40" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>เพลย์ลิสต์ & เครื่องเล่น ({channels.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 mt-6">
        
        {/* Tab 1: AI Script Generator and Preset list */}
        {activeTab === "generator" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Options Left Panel */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Presets List */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5" id="presets-panel">
                <div className="flex items-center gap-2 mb-3.5">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-semibold text-white">เลือกคลานจาก Preset ยอดนิยม</h2>
                </div>
                <p className="text-xs text-slate-400 mb-4">โหลดข้อมูลแบบฟอร์มอัตโนมัติจากกรณีตัวอย่าง เพื่อปรับเขียนโค้ดสำหรับสคริปต์ส่วนบุคคล</p>
                
                <div className="space-y-3">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className="w-full text-left p-3.5 rounded-xl bg-slate-950/50 hover:bg-slate-950/90 border border-slate-850 hover:border-purple-600/40 transition-all duration-200 group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/5 rounded-full blur-xl group-hover:bg-purple-600/10 transition-all duration-300 pointer-events-none" />
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-slate-900 border border-slate-800 text-purple-400 rounded-lg group-hover:text-purple-300">
                          {preset.id === "ais-play" ? <Tv className="w-4 h-4" /> : preset.id === "ball67" ? <Globe className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">{preset.title}</h3>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">{preset.description}</p>
                          <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-slate-900 border border-slate-850 rounded text-[10px] text-slate-400 font-mono">
                            Engine: {preset.engine}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Config Box */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5" id="config-form">
                <div className="flex items-center gap-2 mb-4">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-semibold text-white">กำหนดค่าเซ็ตบอทบราวเซอร์สเปค</h2>
                </div>

                <form onSubmit={handleGenerateScraper} className="space-y-4">
                  <div>
                    <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 font-mono">
                      Target URL (เว็บปลายทางสตรีมทีวี / ข่าว)
                    </label>
                    <input
                      type="url"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      required
                      placeholder="https://example.com/live"
                      className="w-full text-xs px-3.5 py-3 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 font-mono">
                      เทคโนโลยีที่เรียกใช้ (Scraping engine)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setEngine("playwright")}
                        className={`p-2.5 rounded-lg text-center text-xs font-semibold border transition-all ${
                          engine === "playwright"
                            ? "bg-indigo-650 text-white border-indigo-500 shadow-md shadow-indigo-950/40"
                            : "bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200"
                        }`}
                      >
                        Playwright
                      </button>
                      <button
                        type="button"
                        onClick={() => setEngine("selenium")}
                        className={`p-2.5 rounded-lg text-center text-xs font-semibold border transition-all ${
                          engine === "selenium"
                            ? "bg-indigo-650 text-white border-indigo-500 shadow-md shadow-indigo-950/40"
                            : "bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200"
                        }`}
                      >
                        Selenium
                      </button>
                      <button
                        type="button"
                        onClick={() => setEngine("soup_req")}
                        className={`p-2.5 rounded-lg text-center text-xs font-semibold border transition-all ${
                          engine === "soup_req"
                            ? "bg-indigo-650 text-white border-indigo-500 shadow-md shadow-indigo-950/40"
                            : "bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200"
                        }`}
                      >
                        BS4/Requests
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 font-mono">
                      รายละเอียดโครงสร้างองค์ประกอบเว็บที่จะให้ดึง
                    </label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="อธิบายตำแหน่ง element คีย์ หรือขั้นตอนในการ sniff ลิงค์"
                      className="w-full text-xs p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-sans leading-relaxed"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full p-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-505 hover:to-indigo-550 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-40 flex items-center justify-center gap-2 "
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>กำลังใช้ระบบ AI ออกแบบโค้ดสเกรป Python...</span>
                      </>
                    ) : (
                      <>
                        <Code className="w-4 h-4 text-white" />
                        <span>สร้างสคริปต์ Python อัจฉริยะ (AI Generate)</span>
                      </>
                    )}
                  </button>
                </form>

                {scriptNotice && (
                  <div className={`mt-4 p-3 rounded-xl text-xs flex items-start gap-2.5 ${scriptNotice.includes("ผิดพลาด") ? "bg-red-950/60 border border-red-900/60 text-red-300" : "bg-emerald-950/60 border border-emerald-900/60 text-emerald-300"}`}>
                    {scriptNotice.includes("ผิดพลาด") ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                    <span>{scriptNotice}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Code Output Right Panel */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden h-full flex flex-col">
                <div className="bg-slate-900/80 px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="text-xs font-mono font-bold text-slate-400 ml-2">python_stream_grabber.py</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {generatedScript && (
                      <>
                        <button
                          onClick={() => copyToClipboard(generatedScript)}
                          className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-[11px] text-slate-300 rounded-lg flex items-center gap-1 transition-colors border border-slate-800"
                        >
                          {copiedState ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedState ? "คัดลอกแล้ว!" : "คัดลอก"}</span>
                        </button>
                        
                        <button
                          onClick={() => downloadPythonScript(generatedScript)}
                          className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/45 text-[11px] text-indigo-300 rounded-lg flex items-center gap-1 transition-colors border border-indigo-700/40"
                        >
                          <Download className="w-3 h-3" />
                          <span>ดาวน์โหลดสคริปต์</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col bg-slate-950/80 font-mono text-xs overflow-auto min-h-[480px]">
                  {generatedScript ? (
                    <pre className="text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre">
                      {generatedScript}
                    </pre>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <div className="p-4 bg-slate-900/60 rounded-full mb-3 border border-slate-850/80">
                        <Terminal className="w-10 h-10 text-slate-600 animate-pulse" />
                      </div>
                      <h3 className="text-slate-400 font-semibold text-sm">พร้อมประกอบสคริปต์</h3>
                      <p className="text-slate-600 max-w-sm mt-1 leading-normal text-xs font-sans">
                        กดปุ่ม "สร้างสคริปต์ Python อัจฉริยะ" ด้านซ้ายเพื่อแปลงความต้องการของคุณเป็นไฟล์ Python Playwright หรือ Selenium พร้อมใช้ได้ฟรี สั่นปืนไร้ขีดจำกัด
                      </p>
                    </div>
                  )}
                </div>
                
                {generatedScript && (
                  <div className="bg-slate-900/40 border-t border-slate-800/80 p-4">
                    <div className="flex items-start gap-2 text-xs text-slate-400">
                      <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-300">คู่วิธีการรันในเครื่องส่วนตัว:</span>
                        <div className="mt-1 space-y-1 text-[11px] font-sans">
                          <p>1. ตรวจสอบว่าในเครื่องมี python 3 และติดตั้ง: <code className="font-mono bg-slate-950 px-1 py-0.5 rounded text-indigo-400 border border-slate-900">pip install playwright beautifulsoup4 requests</code></p>
                          <p>2. หากเลือก playwright ให้รันติดตั้งบราวเซอร์เสริมด้วยคำสั่ง: <code className="font-mono bg-slate-950 px-1 py-0.5 rounded text-indigo-400 border border-slate-900">playwright install</code></p>
                          <p>3. เรียกใช้งานบอทด้วยคำสั่ง: <code className="font-mono bg-slate-950 px-1 py-0.5 rounded text-indigo-400 border border-slate-900">python stream_sniffer_script_{engine}.py</code></p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Quick Extractor via Server bypass CORS */}
        {activeTab === "extractor" && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-semibold text-white">ระบบสกัดค้นหาลิงก์สตรีมแบบเร่งด่วน (Quick Stream Extractor)</h2>
              </div>
              <p className="text-xs text-slate-400 max-w-3xl mb-6">
                ฟังก์ชั่นพิเศษในการส่งเซิร์ฟเวอร์ proxy ทำการดาวน์โหลดโค้ด HTML เว็บเป้าหมาย เพื่อตรวจสอบและสกัดหาลิงก์ตระกูลวิดีโอ (<code className="font-mono text-purple-400">.m3u8</code> หรือ <code className="font-mono text-purple-400">.mp4</code>) 
                โดยสามารถกรอก URL เพื่อทดลองดึงสตรีมมีเดียได้ทันทีในตัวช่วยเบราเซอร์
              </p>

              <form onSubmit={handleQuickExtract}>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="url"
                      value={extractUrl}
                      onChange={(e) => setExtractUrl(e.target.value)}
                      placeholder="ใส่ URL เว็บถ่ายทอดสดหรือสตรีมมิ่งที่ต้องการทดสอบ เช่น https://ball67.com"
                      required
                      className="w-full text-xs px-4 py-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isExtracting}
                    className="px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-505 hover:to-indigo-550 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isExtracting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>กำลังสแกนโครงร่าง...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>สกัดลิงก์ตอนนี้ (Extract M3U8)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {extractionMsg && (
                <div className={`mt-4 p-3.5 rounded-xl text-xs flex items-center gap-2 ${extractionMsg.includes("ปัญหา") ? "bg-red-950/50 border border-red-900/60 text-red-350" : "bg-indigo-950/50 border border-indigo-900/60 text-indigo-300"}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{extractionMsg}</span>
                </div>
              )}
            </div>

            {extractorResults && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden p-6">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">ผลการดึงสตรีมจากเว็บ: <span className="text-purple-400 font-mono text-xs">{extractorResults.title}</span></h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-mono">URL: {extractUrl}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (extractorResults.streams.length === 0) return;
                      // Concat all streams to active playlist
                      setChannels([...extractorResults.streams, ...channels]);
                      setActiveTab("playlist");
                      alert(`ย้าย ${extractorResults.streams.length} ช่องถ่ายทอดไปสู่เครื่องเล่นหลักของคุณเรียบร้อยแล้ว!`);
                    }}
                    disabled={extractorResults.streams.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-xs font-bold text-white rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>นำเข้าสู่เครื่องเล่น ({extractorResults.streams.length} ช่อง)</span>
                  </button>
                </div>

                {extractorResults.streams.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">
                    <p className="text-xs">ไม่พบแท็ก .m3u8 หรือไฟล์สตรีมโดยตรงในหน้า HTML หลัก</p>
                    <p className="text-[11px] text-slate-600 mt-1 max-w-md mx-auto">
                      หมายเหตุ: เว็บเป้าหมายอาจใช้ JavaScript Dynamic Rendering หรือมีการดึงค่าลิงก์ผ่าน API ชั่วคราว ซึ่งต้องใช้ "Python Playwright" แนะนำให้กลับไปสร้างสคริปต์สแกนทีวีเพื่อรันภายในเครื่องแทน
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                          <th className="py-3 px-4">ชื่อช่อง/สตรีม</th>
                          <th className="py-3 px-4">ลิงก์วิดีโอ (URL Stream)</th>
                          <th className="py-3 px-4">กลุ่มตั้งต้น</th>
                          <th className="py-3 px-4 text-emerald-450">สถานะ</th>
                          <th className="py-3 px-4 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60">
                        {extractorResults.streams.map((stream, idx) => (
                          <tr key={stream.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-200">{stream.name}</td>
                            <td className="py-3 px-4 text-slate-400 font-mono text-xs select-all truncate max-w-[320px]">{stream.url}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-slate-400 font-mono text-[10px]">
                                {stream.group}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-emerald-400 font-mono text-[10px]">พร้อมเล่น</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setChannels([stream, ...channels]);
                                    setCurrentChannel(stream);
                                    setActiveTab("playlist");
                                  }}
                                  className="px-2 py-1 bg-slate-800 hover:bg-purple-600/35 hover:text-purple-300 text-[11px] font-semibold text-slate-300 rounded border border-slate-850 transition-all flex items-center gap-1"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>เล่นด่วน</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Playlist Manager & Live Player */}
        {activeTab === "playlist" && (
          <div className="space-y-6">
            
            {/* Split layout: Player at the top or side, channel list on the other side */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Playlist Parsing / Channel Lists */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Playlist Importer Box */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-indigo-400" />
                      <h2 className="text-sm font-semibold text-white">นำเข้าเพลย์ลิสต์ทีวี M3U / W3U</h2>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={exportToM3U} 
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-[11px] font-semibold text-slate-300 rounded border border-slate-850 flex items-center gap-1 transition-colors"
                        title="ดาวน์โหลดไฟล์ m3u ดั้งเดิม"
                      >
                        <FileDown className="w-3 h-3" />
                        <span>M3U</span>
                      </button>
                      <button 
                        onClick={exportToW3U} 
                        className="px-2 py-1 bg-indigo-650/30 hover:bg-indigo-650/50 text-[11px] font-semibold text-indigo-300 rounded border border-indigo-700/30 flex items-center gap-1 transition-colors"
                        title="ดาวน์โหลดไฟล์ w3u สำหรับ Wiseplay"
                      >
                        <HardDriveDownload className="w-3 h-3" />
                        <span>W3U</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1 font-mono">
                        นำเข้าผ่านลิงก์ M3U สาธารณะ
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={m3uUrl}
                          onChange={(e) => setM3uUrl(e.target.value)}
                          placeholder="https://example.com/live_channels.m3u"
                          className="flex-1 text-xs px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                        <button
                          onClick={() => handleParsePlaylist(false)}
                          disabled={isParsing}
                          className="px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          ดึงลิงก์
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-400 font-mono">
                          หรือวางโค้ดข้อความดิบ (Raw M3U / W3U JSON)
                        </label>
                        <span className="text-[10px] text-slate-500 font-mono">รองรับ JSON Wiseplay</span>
                      </div>
                      <textarea
                        rows={2}
                        value={playlistRaw}
                        onChange={(e) => setPlaylistRaw(e.target.value)}
                        placeholder="วางโค้ด EXTM3U หรือ JSON สลิงก์เพลย์ลิสต์ตรงนี้..."
                        className="w-full text-xs p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <button
                        onClick={() => handleParsePlaylist(true)}
                        disabled={isParsing || !playlistRaw}
                        className="w-full mt-2 p-2 bg-slate-850 hover:bg-slate-800 text-white text-xs font-bold rounded-lg border border-slate-800 transition-colors cursor-pointer"
                      >
                        นำเข้าโค้ดดิบ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stream Channel Finder & Filter Area */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Tv className="w-4 h-4 text-purple-400" />
                      <h2 className="text-sm font-semibold text-white">รายการช่องสตรีมสด ({filteredChannels.length})</h2>
                    </div>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-2.5 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่มช่องสตรีม</span>
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="พิมพ์คำค้นหาชื่อช่อง, คำค้นหา URL..."
                      className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* Group filters selector pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {channelGroups.map(grp => (
                      <button
                        key={grp}
                        onClick={() => setActiveGroupFilter(grp)}
                        className={`px-3 py-1.5 rounded-lg border shrink-0 transition-all ${
                          activeGroupFilter === grp
                            ? "bg-purple-650 border-purple-550 text-white"
                            : "bg-slate-950/60 border-slate-850 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {grp === "ALL" ? "ทั้งหมด" : grp}
                      </button>
                    ))}
                  </div>

                  {/* Channels Listing Grid */}
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredChannels.length === 0 ? (
                      <div className="text-center py-10 text-slate-500">
                        <AlertTriangle className="w-6 h-6 mx-auto text-slate-600 mb-2" />
                        <p className="text-xs">ไม่พบคำค้นหาหรือช่องรายการที่สืบเนื่อง</p>
                      </div>
                    ) : (
                      filteredChannels.map(ch => (
                        <div
                          key={ch.id}
                          className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 group/item ${
                            currentChannel?.id === ch.id
                              ? "bg-purple-950/30 border-purple-500/80"
                              : "bg-slate-950/40 border-slate-850 hover:bg-slate-950 hover:border-slate-800"
                          }`}
                        >
                          <button
                            onClick={() => setCurrentChannel(ch)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 relative">
                              {ch.logo ? (
                                <img src={ch.logo} alt="" className="w-full h-full object-cover" onError={(e) => {
                                  // fallback image
                                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1598257006458-087169a1f08d?q=80&w=200";
                                }} referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-bold bg-slate-900">
                                  TV
                                </div>
                              )}
                              {currentChannel?.id === ch.id && (
                                <div className="absolute inset-0 bg-purple-900/30 flex items-center justify-center">
                                  <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                                {ch.name}
                              </h4>
                              <p className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                                {ch.group || "ทั่วไป"} • {ch.url.split("/")[2] || "Direct Server"}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 opacity-60 group-hover/item:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingChannel(ch)}
                              className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
                              title="แก้ไขข้อมูลช่อง"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => deleteChannel(ch.id)}
                              className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                              title="ลบช่องออกจากเครื่องเล่น"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Built-in Live stream Video Player & console info */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Visual Video Stream Player Frame */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col" id="player-frame">
                  <div className="bg-slate-900 px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {currentChannel ? "PLAYER: LIVE FEED" : "PLAYER: IDLE"}
                      </span>
                    </div>

                    <div className="text-right">
                      {currentChannel && (
                        <span className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[9px] text-purple-400 font-mono">
                          HLS.JS ENGINE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="aspect-video bg-slate-950 relative flex items-center justify-center overflow-hidden">
                    <video
                      id="stream-player"
                      ref={videoRef}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                      poster="https://images.unsplash.com/photo-1542204172-e7052809a1a4?q=80&w=720"
                    />

                    {/* Error display on video element overlay */}
                    {playbackError && (
                      <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10">
                        <AlertTriangle className="w-12 h-12 text-yellow-500 animate-bounce mb-3" />
                        <h4 className="text-sm font-bold text-white mb-2">โครงสร้างสัญญานขัดข้องชั่วคราว</h4>
                        <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                          {playbackError}
                        </p>
                        <p className="text-[11px] text-slate-600 max-w-sm mt-3 border-t border-slate-900 pt-3 leading-normal">
                          ลิ้งก์ภายนอกอาจบล็อกบราวเซอร์สาธารณะจากการเข้าถึงโดยตรง (CORS) หรือต้องรันร่วมกับพารามิเตอร์ Token จากสคริปต์สแกนเนอร์
                        </p>
                      </div>
                    )}

                    {/* If no channel is selected */}
                    {!currentChannel && (
                      <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-center p-6">
                        <div className="w-12 h-12 rounded-full bg-indigo-950/40 border border-indigo-700/30 flex items-center justify-center mb-3 text-indigo-400">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                        <h4 className="text-sm font-semibold text-white">ไม่ได้กำลังเปิดช่องสตรีมใด ๆ</h4>
                        <p className="text-xs text-slate-400 max-w-xs mt-1">
                          คุณสามารถคลิกปุ่ม "เล่นด่วน" หรือเลือกชื่อสถานีในตารางช่องด้านซ้ายเพื่อรับชมสตรีมสด
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Channel info beneath the video screen */}
                  {currentChannel && (
                    <div className="p-5 border-t border-slate-800/80 bg-slate-900/30 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-xl border border-indigo-500/20">
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={useCorsProxy} 
                              onChange={(e) => setUseCorsProxy(e.target.checked)}
                              className="sr-only peer" 
                            />
                            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                          <div>
                            <span className="text-xs font-semibold text-white block">CORS Bypass Proxy (ระบบทลายการล็อกข้ามโดเมน)</span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">หลีกเลี่ยงการบล็อกโดยระบุ Referer & User-Agent ผ่าน Node SDK Proxy</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            Active Referer: <span className="text-emerald-400">{currentChannel.headers?.Referer || "https://ball67.com/"}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="px-2 py-0.5 bg-purple-950 text-purple-400 border border-purple-900/60 rounded text-[10px] uppercase font-bold font-mono">
                            {currentChannel.group || "ทั่วไป"}
                          </span>
                          <h3 className="text-base font-bold text-white mt-1.5">{currentChannel.name}</h3>
                          <p className="text-[11px] text-slate-500 font-mono select-all truncate mt-1">{currentChannel.url}</p>
                        </div>

                        {currentChannel.logo && (
                          <img src={currentChannel.logo} className="w-12 h-12 rounded-xl object-cover bg-slate-950 border border-slate-800" referrerPolicy="no-referrer" onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1598257006458-087169a1f08d?q=80&w=200";
                          }} />
                        )}
                      </div>

                      {currentChannel.headers && (
                        <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-850/60">
                          <span className="text-[10px] font-mono font-bold text-slate-400 block mb-1">สคริปต์สแกนพารามิเตอร์ Headers คลานพิเศษ:</span>
                          <div className="space-y-1 text-[11px] font-mono text-indigo-400">
                            {Object.entries(currentChannel.headers).map(([key, val]) => (
                              <p key={key} className="break-all"><span className="text-slate-500">{key}:</span> {val}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Player Console Logs */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Terminal className="w-4 h-4 text-purple-400" />
                    <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">แผงคอนโซลการถ่ายทอดเพลย์ลิสต์</h3>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-slate-400 space-y-2 max-h-[140px] overflow-y-auto">
                    <p className="text-slate-500">[{new Date().toLocaleTimeString()}] บู๊ตระบบสตรีมเพลย์ลิสต์สำเร็จ...</p>
                    <p className="text-indigo-400 font-semibold">[INFO] ค้นพบลิงก์แคตตาล็อก: {channels.length} คีย์ที่ติดตั้งอยู่</p>
                    {currentChannel && (
                      <p className="text-emerald-400">
                        [PLAY] เชื่อมต่อสัญญานไปสู่: {currentChannel.name} (URL segment ถูกผูกมัด)
                      </p>
                    )}
                    {playbackError && <p className="text-yellow-500">[WARN] {playbackError}</p>}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-4 mt-12 pt-6 border-t border-slate-900 text-center">
        <p className="text-xs text-slate-600 font-mono">
          © {new Date().getFullYear()} M3U Stream Sniffer Builder. Created for IPTV Developers & Stream Collectors.
        </p>
      </footer>

      {/* MODAL 1: ADD NEW CHANNEL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-purple-400" />
              <span>เพิ่มช่องทีวี/สตรีมรายการใหม่</span>
            </h3>

            <form onSubmit={handleAddChannel} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1">
                  ชื่อช่องรายการ
                </label>
                <input
                  type="text"
                  value={newChanName}
                  onChange={(e) => setNewChanName(e.target.value)}
                  placeholder="เช่น CH3 HD TH, Premiere League, etc."
                  required
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1">
                  ลิงก์เล่นสตรีม (URL M3U8 หรือ MP4)
                </label>
                <input
                  type="url"
                  value={newChanUrl}
                  onChange={(e) => setNewChanUrl(e.target.value)}
                  placeholder="เช่น http://example.com/stream/index.m3u8"
                  required
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1">
                    กลุ่มช่องรายการ
                  </label>
                  <input
                    type="text"
                    value={newChanGroup}
                    onChange={(e) => setNewChanGroup(e.target.value)}
                    placeholder="เช่น กีฬา, ซีรีส์, ทั่วไป"
                    className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1">
                    รูปโลโก้ช่อง (URL Image)
                  </label>
                  <input
                    type="url"
                    value={newChanLogo}
                    onChange={(e) => setNewChanLogo(e.target.value)}
                    placeholder="ใส่ URL หรือเว้นว่างไว้"
                    className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-xs font-semibold text-slate-400 rounded-lg cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-550 text-xs font-bold text-white rounded-lg cursor-pointer transition-all"
                >
                  บันทึกช่องสตรีม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT EXISTING CHANNEL */}
      {editingChannel && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-1.5">
              <Edit2 className="w-4 h-4 text-purple-400" />
              <span>แก้ไขรายละเอียดช่องสตรีม</span>
            </h3>

            <form onSubmit={handleUpdateChannel} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1">
                  ชื่อช่องรายการ
                </label>
                <input
                  type="text"
                  value={editingChannel.name}
                  onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                  required
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1">
                  ลิงก์เล่นสตรีม (URL M3U8 หรือ MP4)
                </label>
                <input
                  type="url"
                  value={editingChannel.url}
                  onChange={(e) => setEditingChannel({ ...editingChannel, url: e.target.value })}
                  required
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1">
                    กลุ่มช่องรายการ
                  </label>
                  <input
                    type="text"
                    value={editingChannel.group || ""}
                    onChange={(e) => setEditingChannel({ ...editingChannel, group: e.target.value })}
                    className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1">
                    รูปโลโก้ช่อง (URL Image)
                  </label>
                  <input
                    type="url"
                    value={editingChannel.logo || ""}
                    onChange={(e) => setEditingChannel({ ...editingChannel, logo: e.target.value })}
                    className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingChannel(null)}
                  className="flex-1 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-xs font-semibold text-slate-400 rounded-lg cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-550 text-xs font-bold text-white rounded-lg cursor-pointer transition-all"
                >
                  อัพเดตข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
