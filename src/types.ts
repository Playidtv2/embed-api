export interface StreamChannel {
  id: string; // generated client-side
  name: string;
  url: string;
  logo?: string;
  group?: string;
  headers?: Record<string, string>;
}

export interface ScriptPreset {
  id: string;
  title: string;
  url: string;
  description: string;
  engine: "playwright" | "selenium" | "soup_req";
  iconName: string;
}

export interface PlaylistInfo {
  name: string;
  author: string;
  format: "m3u" | "w3u";
  channels: StreamChannel[];
}
