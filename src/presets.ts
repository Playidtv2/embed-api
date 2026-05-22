import { ScriptPreset } from "./types";

export const PRESETS: ScriptPreset[] = [
  {
    id: "ais-play",
    title: "AIS Play Sniffer (Playwright)",
    url: "https://aisplay.ais.co.th/portal/live/?vid=59592e08bf6aee4e3ecce051",
    description: "สคริปต์สแกนเว็บเครือข่าย เพื่อสกัดพารามิเตอร์ Token การเข้าใช้งาน m3u8 และบันทึกพอร์ตเข้าสู่ MOM.w3u (Wiseplay Format)",
    engine: "playwright",
    iconName: "Tv"
  },
  {
    id: "ball67",
    title: "Ball67 Scraper (Selenium & BS4)",
    url: "https://ball67.com/",
    description: "สคริปต์ดึงตารางถ่ายทอดสดฟุตบอล ชื่อทีม เวลา แหล่งสตรีม และรูปโลโก้สโมสร จัดเกลี่ยสถานีแยกตามวันที่เป็นไฟล์ JSON/Txt",
    engine: "selenium",
    iconName: "Globe"
  },
  {
    id: "universal",
    title: "IPTV Link Scraper (BeautifulSoup)",
    url: "https://iptv-org.github.io/",
    description: "สคริปต์พื้นฐานสำหรับดึงไฟล์ M3M จาก URL สาธารณะ หรือดึงลิงก์เพลย์ลิสต์ช่องทีวีต่าง ๆ ทั่วโลกเพื่อนำมารวมกันในหน้าเดียว",
    engine: "soup_req",
    iconName: "Code"
  }
];
