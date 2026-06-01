"use client";
import { useState, useEffect, useRef } from "react";
import { supabasePublic } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

// ─────────────────────────────────────────────────────────────
//  DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const G    = "#00C896";   // green accent
const BG   = "#F7F8FA";   // app background
const CARD = "#FFFFFF";   // card surface
const LINE = "#EAECF2";   // borders / dividers
const INK  = "#111827";   // primary text
const DIM  = "#6B7280";   // secondary text
const DARK = "#0F1117";   // dark contrast sections

// ─────────────────────────────────────────────────────────────
//  GLOBAL DEVICE SIMULATOR CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #EDEEF2; font-family: 'Inter', -apple-system, sans-serif; color: ${INK}; min-height: 100vh; -webkit-font-smoothing: antialiased; }
  
  @media (max-width: 500px) {
    body { background: ${BG}; }
  }

  /* Shell / Device Emulator Container */
  .shell {
    position: relative;
    max-width: 430px; width: 100%;
    margin: 30px auto;
    height: 880px; max-height: calc(100vh - 60px);
    display: flex; flex-direction: column;
    background: ${BG};
    border-radius: 36px;
    box-shadow: 0 20px 50px rgba(15,17,23,0.15);
    border: 10px solid ${DARK};
    overflow: hidden;
  }
  @media (max-width: 500px) {
    .shell {
      max-width: 100%; margin: 0; border: none; border-radius: 0;
      height: 100vh; max-height: 100vh;
    }
  }

  /* Scrollable viewports inside the frame */
  .scroll { flex: 1; overflow-y: auto; padding: 18px 16px 84px; position: relative; }
  .scroll::-webkit-scrollbar { display: none; }

  /* Header */
  .hdr {
    background: rgba(255,255,255,0.94); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid ${LINE}; padding: 14px 18px;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 80;
  }

  /* Bottom Tab Navigation Bar */
  .bnav {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 90;
    background: rgba(255,255,255,0.96); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border-top: 1px solid ${LINE}; display: flex; padding: 8px 0 max(10px, env(safe-area-inset-bottom));
  }
  .nbtn {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
    background: none; border: none; cursor: pointer; padding: 4px 2px;
    font-family: inherit; color: ${DIM}; transition: color .15s;
    -webkit-tap-highlight-color: transparent; position: relative;
  }
  .nbtn.on { color: ${G}; }
  .nbtn-icon { font-size: 20px; line-height: 1; }
  .nbtn-lbl { font-size: 9px; font-weight: 700; letter-spacing: .02em; }
  .nbtn-lock { position: absolute; top: 2px; right: calc(50% - 18px); font-size: 8px; }

  /* Card */
  .card { background: ${CARD}; border-radius: 16px; border: 1px solid ${LINE}; padding: 18px; margin-bottom: 12px; }
  .card-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid ${LINE}; padding-bottom: 10px; margin-bottom: 12px; }
  .card-title { font-size: 14px; font-weight: 800; color: ${INK}; display: flex; align-items: center; gap: 6px; }

  /* Inputs */
  .inp {
    width: 100%; background: ${BG}; border: 1.5px solid ${LINE};
    border-radius: 10px; padding: 10px 12px; color: ${INK};
    font-size: 13px; font-family: inherit; transition: border-color .2s;
    outline: none;
  }
  .inp:focus { border-color: ${G}; }

  /* Buttons */
  .btn-primary {
    width: 100%; padding: 13px 0; border-radius: 12px; border: none;
    background: ${G}; color: #fff; font-weight: 700; font-size: 14px;
    cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    box-shadow: 0 4px 12px ${G}25; transition: opacity .15s, transform .1s;
    -webkit-tap-highlight-color: transparent; text-decoration: none;
  }
  .btn-primary:active:not(:disabled) { transform: scale(.98); }
  .btn-primary:disabled { background: ${LINE}; color: ${DIM}; box-shadow: none; cursor: not-allowed; }
  
  .btn-ghost {
    width: 100%; padding: 12px 0; border-radius: 12px;
    border: 1.5px solid ${LINE}; background: transparent;
    color: ${INK}; font-weight: 600; font-size: 13px;
    cursor: pointer; font-family: inherit; transition: background .15s;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none;
  }
  .btn-ghost:hover { background: ${BG}; }
  
  .btn-danger {
    width: 100%; padding: 12px 0; border-radius: 12px;
    border: 1px solid rgba(239,68,68,.25); background: rgba(239,68,68,.05);
    color: #EF4444; font-weight: 600; font-size: 13px;
    cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none;
  }
  
  .btn-sm {
    padding: 6px 12px; border-radius: 8px; font-size: 12px;
    font-weight: 700; cursor: pointer; font-family: inherit; border: none;
    background: ${G}; color: #fff; transition: opacity .15s;
    -webkit-tap-highlight-color: transparent;
  }
  .btn-sm-outline {
    padding: 6px 12px; border-radius: 8px; font-size: 12px;
    font-weight: 600; cursor: pointer; font-family: inherit;
    border: 1px solid ${LINE}; background: transparent; color: ${DIM};
  }

  /* Status chips */
  .chip { display: inline-flex; align-items: center; padding: 2.5px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .chip-green  { color: ${G};      background: ${G}15; }
  .chip-amber  { color: #F59E0B;   background: #FEF9EC; }
  .chip-grey   { color: ${DIM};    background: ${LINE}; }
  .chip-purple { color: #8B5CF6;   background: #F5F3FF; }
  .chip-red    { color: #EF4444;   background: rgba(239,68,68,0.08); }

  .plat-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }

  /* Pill filters */
  .pill { padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1.5px solid ${LINE}; background: transparent; color: ${DIM}; white-space: nowrap; font-family: inherit; transition: all .15s; }
  .pill.on { border-color: ${G}; background: ${G}12; color: ${G}; font-weight: 700; }

  /* Absolute views that mask inside the device frame rounded corners */
  .legal-sheet {
    position: absolute; inset: 0; z-index: 500;
    background: ${BG}; display: flex; flex-direction: column;
  }
  
  .modal-backdrop {
    position: absolute; inset: 0; background: rgba(15,17,23,0.6);
    backdrop-filter: blur(2px); z-index: 600;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal-dialog {
    background: ${CARD}; border: 1px solid ${LINE}; border-radius: 20px;
    width: 100%; padding: 20px; position: relative;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15); max-height: 90%; overflow-y: auto;
  }

  /* Tour Overlays */
  .tour-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; pointer-events: none; }
  .tour-card {
    position: absolute; z-index: 300; left: 16px; right: 16px;
    padding: 20px; background: ${CARD};
    border: 1px solid ${LINE}; border-radius: 20px;
    box-shadow: 0 12px 36px rgba(0,0,0,0.15);
  }
  .tour-prog { height: 3px; border-radius: 2px; background: ${LINE}; overflow: hidden; margin-bottom: 12px; }
  .tour-prog-fill { height: 100%; border-radius: 2px; background: ${G}; transition: width .4s ease; }

  /* Typography headings */
  h1.page-h { font-size: 20px; font-weight: 800; color: ${INK}; letter-spacing: -.3px; margin: 0 0 2px; }
  p.page-sub { margin: 0; color: ${DIM}; font-size: 13px; }
  .sec-lbl { font-size: 10px; font-weight: 700; color: ${DIM}; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; display: block; }

  .fade { animation: fd .20s ease both; }
  @keyframes fd { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }
  .rec-pulse { animation: rp 1.4s infinite; }
  @keyframes rp { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.4); } 70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
  .vbar { width: 3px; height: 5px; background: ${G}; border-radius: 2px; transition: height .08s ease; }

  .table-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 8px; border-bottom: 1px solid ${LINE}; font-size: 13px;
  }
  .table-row:last-child { border-bottom: none; }
`;

// ─────────────────────────────────────────────────────────────
//  SVG ICON DEFINITION
// ─────────────────────────────────────────────────────────────
const Ico = ({ d, size = 18, color = "currentColor", sw = 1.8 }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ic = {
  home:     "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  camera:   "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  review:   "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  queue:    "M3 9h18M3 4h18v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zM8 2v4M16 2v4",
  bill:     "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  profile:  "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  upload:   "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  mic:      "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  check:    "M20 6L9 17l-5-5",
  x:        "M18 6L6 18M6 6l12 12",
  back:     "M19 12H5M12 19l-7-7 7-7",
  chevron:  "M9 18l6-6-6-6",
  send:     "M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  chart:    "M18 20V10M12 20V4M6 20v-6",
  shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  doc:      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  lock:     "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  globe:    "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 20a1.86 1.86 0 0 1-.83-.19A10.12 10.12 0 0 1 4.5 12h15a10.12 10.12 0 0 1-6.67 9.81 1.86 1.86 0 0 1-.83.19zM4.06 10a8 8 0 0 1 15.88 0zM12 4a8 8 0 0 1 .5 15.93V16a4 4 0 0 0-4-4H8.07a8 8 0 0 1 3.93-8z",
  support:  "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  calendar: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18",
  plus:     "M12 5v14M5 12h14"
};

const PL: Record<string, any> = {
  instagram: { color: "#E1306C", bg: "#fdf0f4", label: "IG" },
  facebook:  { color: "#1877F2", bg: "#eff5fe", label: "FB" },
  linkedin:  { color: "#0A66C2", bg: "#eef4fb", label: "LI" },
  tiktok:    { color: "#333",    bg: "#f3f3f3", label: "TT" },
  x:         { color: "#000",    bg: "#f3f3f3", label: "X"  },
};
const PlatBadge = ({ platform }: { platform: string }) => {
  const p = PL[platform?.toLowerCase()] || { color: DIM, bg: BG, label: platform?.slice(0,2)?.toUpperCase() };
  return <span className="plat-badge" style={{ color: p.color, background: p.bg }}>{p.label} {platform}</span>;
};

// GeckoMark Logo
const GeckoMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <g transform="translate(32,32)">
      <path fill={G} d="M 18 28 Q 44 36 46 56 Q 38 44 20 34 Z" />
      <path fill={G} d="M -9 22 Q -28 30 -36 42 L -32 44 Q -25 33 -8 26 Z" />
      <path stroke={G} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M -36 42 Q -42 46 -44 52 M -36 42 Q -39 50 -37 56 M -36 42 Q -32 50 -30 54" />
      <path fill={G} d="M 9 22 Q 26 30 32 42 L 28 44 Q 22 33 8 26 Z" />
      <path stroke={G} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M 32 42 Q 38 46 40 52 M 32 42 Q 35 50 33 56 M 32 42 Q 28 50 26 54" />
      <ellipse cx="0" cy="16" rx="11" ry="16" fill={G} />
      <path fill={G} d="M -10 4 Q -28 2 -38 -8 L -34 -12 Q -26 -4 -9 0 Z" />
      <path stroke={G} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M -38 -8 Q -44 -12 -46 -18 M -38 -8 Q -42 -16 -40 -22 M -38 -8 Q -34 -16 -32 -20" />
      <path fill={G} d="M 10 4 Q 28 2 36 -10 L 32 -14 Q 26 -6 9 0 Z" />
      <path stroke={G} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M 36 -10 Q 42 -14 44 -20 M 36 -10 Q 40 -18 38 -24 M 36 -10 Q 32 -18 30 -22" />
      <ellipse cx="0" cy="-4" rx="8" ry="8" fill={G} />
      <ellipse cx="0" cy="-18" rx="11" ry="13" fill={G} />
      <ellipse cx="0" cy="-28" rx="6" ry="6" fill={G} />
      <path stroke="#007a5c" strokeWidth="1.5" fill="none" strokeLinecap="round" d="M -5 -24 Q 0 -21 5 -24" />
      <circle cx="-3" cy="-32" r="1.2" fill="#007a5c" /><circle cx="3" cy="-32" r="1.2" fill="#007a5c" />
      <circle cx="-8" cy="-22" r="5.5" fill="#fff" /><circle cx="8" cy="-22" r="5.5" fill="#fff" />
      <ellipse cx="-8" cy="-22" rx="2" ry="3.5" fill="#003d2e" /><ellipse cx="8" cy="-22" rx="2" ry="3.5" fill="#003d2e" />
      <circle cx="-6.5" cy="-24" r="1.2" fill="#fff" /><circle cx="9.5" cy="-24" r="1.2" fill="#fff" />
    </g>
  </svg>
);

const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <div className="tog-track" onClick={onToggle} style={{ position: "relative", width: 42, height: 24, borderRadius: 12, cursor: "pointer", background: on ? G : LINE, transition: "background 0.2s" }}>
    <div className="tog-thumb" style={{ position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", left: on ? 21 : 3, transition: "left 0.2s" }} />
  </div>
);

// ─────────────────────────────────────────────────────────────
//  LEGAL AGREEMENT TEXTS
// ─────────────────────────────────────────────────────────────
const LEGAL: Record<string, { title: string; updated: string; body: React.ReactNode }> = {
  tos: {
    title: "Terms & Conditions",
    updated: "14 May 2026",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, color: DIM, fontSize: 13, lineHeight: 1.6 }}>
        <p><strong>Document: WG-TNC-001</strong></p>
        <p>IMPORTANT: Please read these Terms and Conditions carefully before using our services. By engaging Web Gecko or accessing your client portal, you agree to be bound by these terms.</p>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>1. Parties & Agreement</h4>
          <p>These Terms and Conditions ('Terms') constitute a legally binding agreement between Web Gecko (ABN 32 300 992 377), a digital services provider registered in Queensland, Australia ('Web Gecko', 'we', 'us', 'our') and the individual or entity engaging our services ('Client', 'you', 'your').</p>
          <p>These Terms apply to all website design, development, hosting, social media management, and related digital services provided by Web Gecko. By engaging our services, paying a deposit, or accessing your client portal, you agree to be bound by these Terms.</p>
          <p>These Terms are governed by the laws of Queensland, Australia, and the Australian Consumer Law (ACL) as set out in Schedule 2 of the Competition and Consumer Act 2010 (Cth).</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>2. Services</h4>
          <p>Web Gecko provides the following services, subject to the specific scope agreed with each Client:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Website design and development (custom HTML, CSS, JavaScript)</li>
            <li>Website hosting on Australian or international cloud infrastructure</li>
            <li>Monthly site maintenance and content updates</li>
            <li>Social media account creation, management, and content posting</li>
            <li>Community management including comment and DM responses</li>
            <li>SEO optimisation and performance improvements</li>
            <li>Domain registration and management assistance</li>
            <li>Other digital services as agreed in writing</li>
          </ul>
          <p>The specific scope, deliverables, and pricing for each Client are agreed prior to commencement and confirmed via email or client portal. Web Gecko reserves the right to engage subcontractors to fulfil any part of the agreed services.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>3. Payment Terms</h4>
          <p>Unless otherwise agreed in writing, the following payment terms apply:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li><strong>Website build deposit:</strong> A non-refundable deposit is required to commence work. The deposit amount is agreed prior to commencement and confirmed via the client portal.</li>
            <li><strong>Final payment:</strong> Due prior to the launch of the live website. The site will not be made publicly live until final payment is received in full.</li>
            <li><strong>Monthly hosting & maintenance:</strong> Billed monthly in advance. An introductory rate applies for the first three months, after which the standard ongoing rate applies. Current rates are displayed in the client portal.</li>
            <li><strong>Social media management:</strong> Billed monthly in advance. The plan and pricing are confirmed at sign-up and displayed in the client portal.</li>
            <li><strong>Late payments:</strong> Web Gecko reserves the right to suspend services (including taking the website offline) if any payment is more than 14 days overdue. Services will be restored upon payment of all outstanding amounts.</li>
          </ul>
          <p>All prices are in Australian Dollars (AUD) and include GST where applicable. Payments are processed via Square or other nominated payment gateways. Web Gecko does not store card details.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>4. Intellectual Property</h4>
          <p>Upon receipt of full payment for the agreed website build, the Client owns the final delivered website design and content ('Deliverables'). Web Gecko retains ownership of all underlying frameworks, templates, tools, code libraries, and proprietary methodologies used in creating the Deliverables.</p>
          <p>Web Gecko is granted a non-exclusive, royalty-free licence to display the Client's completed website in portfolios and promotional materials unless the Client requests otherwise in writing.</p>
          <p>The Client warrants that all content, images, logos, and materials provided to Web Gecko for inclusion in the Deliverables are either owned by the Client or that the Client holds appropriate licences or permissions to use them. The Client indemnifies Web Gecko against any claims arising from intellectual property infringement related to Client-provided content.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>5. Client Responsibilities</h4>
          <p>The Client agrees to:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Provide accurate, complete, and timely information required for the delivery of services</li>
            <li>Review and approve drafts and proofs within the agreed timeframes</li>
            <li>Ensure all content provided is lawful, accurate, and does not infringe any third-party rights</li>
            <li>Maintain the confidentiality of any login credentials provided by Web Gecko</li>
            <li>Notify Web Gecko promptly of any errors, issues, or changes required</li>
          </ul>
          <p>Delays caused by the Client's failure to provide required information or approvals may result in project delays. Web Gecko is not liable for delays attributable to the Client.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>6. Revisions & Change Requests</h4>
          <p>Website builds include a reasonable number of revisions as agreed at project commencement. Revisions outside the agreed scope may be subject to additional charges, which will be communicated in advance.</p>
          <p>Monthly hosting clients receive up to 10 site change requests per month as part of their plan. Unused changes do not carry over to the following month. Additional changes beyond the monthly allocation may be quoted and charged separately.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>7. Hosting & Uptime</h4>
          <p>Web Gecko aims to maintain maximum website uptime but does not guarantee 100% availability. Scheduled maintenance, third-party infrastructure outages, or events beyond our reasonable control may cause temporary interruptions. Web Gecko will endeavour to provide advance notice of planned maintenance where practicable.</p>
          <p>Web Gecko is not liable for any loss or damage arising from website downtime, data loss, or interruptions to service caused by third-party infrastructure providers, force majeure events, or circumstances beyond our reasonable control.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>8. Limitation of Liability</h4>
          <p>To the fullest extent permitted by Australian law, Web Gecko's total liability to the Client for any claim arising from or related to our services is limited to the total fees paid by the Client to Web Gecko in the three (3) months immediately preceding the event giving rise to the claim.</p>
          <p>Web Gecko is not liable for any indirect, consequential, special, or punitive damages, including loss of revenue, loss of profits, loss of business, loss of data, or reputational harm, even if Web Gecko has been advised of the possibility of such damages.</p>
          <p>Nothing in these Terms excludes, restricts, or modifies any consumer guarantee under the Australian Consumer Law that cannot be excluded, restricted, or modified by agreement.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>9. Confidentiality</h4>
          <p>Both parties agree to keep confidential any proprietary or sensitive information disclosed during the engagement. Web Gecko will not disclose Client business information to third parties without the Client's consent, except where required by law or necessary to deliver the agreed services (e.g. engaging subcontractors under confidentiality obligations).</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>10. Dispute Resolution</h4>
          <p>In the event of a dispute, both parties agree to first attempt resolution through good-faith negotiation. If the dispute is not resolved within 14 days of written notice, either party may refer the matter to mediation before the Queensland Civil and Administrative Tribunal (QCAT) or, for disputes under $25,000, the relevant small claims jurisdiction.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>11. Termination</h4>
          <p>Either party may terminate the ongoing services agreement by providing written notice as specified in the Cancellation Policy (WG-CAN-001). Upon termination:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>All outstanding fees become immediately payable</li>
            <li>Web Gecko will cease providing services at the end of the current billing period</li>
            <li>Asset handover (if applicable) will be conducted in accordance with the agreed offboarding process</li>
            <li>Web Gecko reserves the right to take the Client's website offline 30 days after termination of the hosting agreement</li>
          </ul>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>12. Amendments</h4>
          <p>Web Gecko may update these Terms from time to time. Clients will be notified of material changes via email or the client portal. Continued use of our services after notification constitutes acceptance of the updated Terms.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>13. Entire Agreement</h4>
          <p>These Terms, together with any project-specific agreements, the Privacy Policy (WG-PRV-001), and the Cancellation & Refund Policy (WG-CAN-001), constitute the entire agreement between Web Gecko and the Client and supersede all prior representations, discussions, and agreements.</p>
        </div>
      </div>
    ),
  },
  privacy: {
    title: "Privacy Policy",
    updated: "14 May 2026",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, color: DIM, fontSize: 13, lineHeight: 1.6 }}>
        <p><strong>Document: WG-PRV-001</strong></p>
        <p>Web Gecko is committed to protecting your privacy. This Policy explains how we handle personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).</p>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>1. Who We Are</h4>
          <p>Web Gecko (ABN 32 300 992 377) is a digital services business registered in Queensland, Australia. We provide website design, hosting, social media management, and related digital services to businesses across Australia. Contact us at hello@webgecko.au.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>2. Information We Collect</h4>
          <p>We collect personal information that is reasonably necessary to provide our services. This may include:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li><strong>Identity information:</strong> Business name, contact name, ABN, and trading details</li>
            <li><strong>Contact information:</strong> Email address, phone number, and business address</li>
            <li><strong>Financial information:</strong> Payment details (processed securely by Square — we do not store card numbers)</li>
            <li><strong>Technical information:</strong> Website analytics data, IP addresses, browser type, and usage patterns</li>
            <li><strong>Content:</strong> Text, images, and materials provided by you for inclusion in your website or social media</li>
            <li><strong>Communications:</strong> Emails, messages, and feedback exchanged with our team</li>
          </ul>
          <p>We collect this information directly from you when you engage our services, use your client portal, or communicate with us. We may also collect information from publicly available sources.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>3. How We Use Your Information</h4>
          <p>We use your personal information to:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Deliver the agreed services including website design, hosting, and social media management</li>
            <li>Process payments and manage your account</li>
            <li>Communicate with you about your project, including updates and approvals</li>
            <li>Send service-related notifications and billing information</li>
            <li>Comply with legal obligations</li>
            <li>Improve our services and operations</li>
          </ul>
          <p>We do not use your personal information for unsolicited marketing. We do not sell your personal information to third parties.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>4. Disclosure of Information</h4>
          <p>We may disclose your personal information to:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li><strong>Service providers:</strong> Including hosting providers, payment processors (Square), email platforms (Resend), scheduling tools (Postiz), and analytics providers — all engaged under confidentiality obligations</li>
            <li><strong>Professional advisors:</strong> Including lawyers and accountants, where necessary</li>
            <li><strong>Regulatory authorities:</strong> Where required by law or court order</li>
          </ul>
          <p>We do not transfer your personal information overseas except where our service providers operate internationally (e.g. cloud hosting). Where this occurs, we take reasonable steps to ensure your information is protected.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>5. Data Security</h4>
          <p>We take reasonable steps to protect your personal information from misuse, interference, loss, and unauthorised access. Measures include encrypted data transmission (HTTPS), access controls, and secure third-party platforms. However, no internet transmission is completely secure, and we cannot guarantee absolute security.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>6. Data Retention</h4>
          <p>We retain your personal information for as long as necessary to provide our services and meet our legal obligations. Upon termination of our engagement, we will securely delete or de-identify your information within 12 months, unless retention is required by law.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>7. Social Media Account Management</h4>
          <p>Where we create and manage social media accounts on your behalf, we may hold login credentials for platforms including Instagram, Facebook, TikTok, LinkedIn, YouTube, and Google Business. This information is used solely to manage your accounts as part of the agreed social media management services.</p>
          <p>Upon termination of social media management services, we will either transfer account credentials to you (Full Handover) or cease all management activity (Stop Management), as elected by you. Details are set out in the Social Media Management Agreement (WG-SOC-001).</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>8. Access & Correction</h4>
          <p>You have the right to request access to, or correction of, your personal information held by us. Requests can be made by emailing hello@webgecko.au. We will respond within 30 days. In some circumstances, we may decline access as permitted by the Privacy Act 1988 (Cth).</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>9. Complaints</h4>
          <p>If you believe we have breached your privacy, please contact us at hello@webgecko.au. We will investigate and respond within 30 days. If you are not satisfied with our response, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au.</p>
        </div>
      </div>
    ),
  },
  agreement: {
    title: "Social Media Agreement",
    updated: "14 May 2026",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, color: DIM, fontSize: 13, lineHeight: 1.6 }}>
        <p><strong>Document: WG-SOC-001</strong></p>
        <p>This Agreement governs Web Gecko's social media management services including account creation, content posting, community management, and offboarding. It forms part of the overall Terms & Conditions (WG-TNC-001).</p>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>1. Scope of Services</h4>
          <p>Web Gecko provides fully managed social media services on behalf of the Client. Services vary by plan and may include:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Creation of a dedicated Gmail address for the Client's social media accounts</li>
            <li>Registration and setup of social media accounts on agreed platforms (Instagram, Facebook, TikTok, LinkedIn, YouTube, Google Business, and others as agreed)</li>
            <li>Content creation including captions, hashtags, imagery direction, and video scripts</li>
            <li>Scheduled posting according to an agreed content calendar</li>
            <li>Community management: responding to comments, direct messages, and reviews</li>
            <li>Performance monitoring and monthly analytics reports</li>
            <li>Competitor and trend monitoring (Growth and Full Suite plans)</li>
            <li>Paid advertising management (Full Suite plan only)</li>
          </ul>
          <p>The specific plan, platforms, and inclusions are confirmed at sign-up and visible in the Client's portal. Web Gecko reserves the right to adjust platform availability based on API access and platform policy changes.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>2. Account Ownership & Credentials</h4>
          <p>Where Web Gecko creates social media accounts on behalf of the Client, the following applies:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li><strong>Gmail address:</strong> Web Gecko creates and administers a dedicated Gmail address (e.g. businessname@gmail.com) used to register all social media accounts. This Gmail address is managed by Web Gecko throughout the engagement.</li>
            <li><strong>Social media accounts:</strong> All accounts created are registered in the Client's business name and on their behalf. Web Gecko acts as administrator.</li>
            <li><strong>Password retention:</strong> Web Gecko retains login credentials throughout the active management period to enable content posting, community management, and account administration.</li>
            <li><strong>Client access:</strong> Clients do not require direct access to credentials during the active service period, as all management is handled by Web Gecko.</li>
          </ul>
          <p>Web Gecko agrees not to use the Client's social media accounts for any purpose other than delivering the agreed services. Web Gecko will not post content, make changes, or access accounts outside of agreed service activities.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>3. Content Approval</h4>
          <p>Content is created by Web Gecko and may be posted automatically according to the agreed schedule, or subject to Client approval ('Approval Mode') at the Client's election. In Approval Mode:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Draft posts are submitted to the Client for review prior to publication</li>
            <li>The Client has 48 hours to approve or request changes to each draft</li>
            <li>If no response is received within 48 hours, the post may be published at Web Gecko's discretion (unless the Client has expressly requested otherwise in writing)</li>
          </ul>
          <p>The Client warrants that all content directions, images, and materials provided to Web Gecko for use in social media posts are lawful, accurate, and do not infringe any third-party intellectual property rights.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>4. Community Management</h4>
          <p>Web Gecko responds to comments, direct messages, and reviews on behalf of the Client in a professional manner consistent with the Client's brand voice. The Client acknowledges that:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Web Gecko will use reasonable judgment in responding to enquiries and comments</li>
            <li>Complex or sensitive matters may be escalated to the Client for direction</li>
            <li>Web Gecko is not responsible for reputational harm arising from third-party comments or reviews that are outside our control</li>
            <li>Web Gecko will not make commitments, offer refunds, or enter into agreements with third parties on the Client's behalf without prior written authorisation</li>
          </ul>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>5. Platform Policy Compliance</h4>
          <p>The Client agrees that all social media activities conducted on their behalf will comply with the terms of service and community guidelines of each relevant platform. Web Gecko will not engage in:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Purchasing followers, likes, or engagement</li>
            <li>Spamming or bulk messaging</li>
            <li>Posting content that violates platform policies or Australian law</li>
          </ul>
          <p>If a platform suspends or restricts an account due to the Client's prior activity or content provided by the Client, Web Gecko is not liable for the resulting loss of access or engagement.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>6. Billing</h4>
          <table style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${LINE}`, textAlign: "left" }}>
                <th style={{ padding: 6, color: INK }}>Plan</th>
                <th style={{ padding: 6, color: INK }}>Platforms</th>
                <th style={{ padding: 6, color: INK }}>Posts/mo</th>
                <th style={{ padding: 6, color: INK }}>Community Mgmt</th>
                <th style={{ padding: 6, color: INK }}>Monthly Fee</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: 6, fontWeight: 700, color: INK }}>Starter</td>
                <td style={{ padding: 6 }}>2</td>
                <td style={{ padding: 6 }}>12</td>
                <td style={{ padding: 6 }}>Comments & DMs</td>
                <td style={{ padding: 6, color: G, fontWeight: 700 }}>$499</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: 6, fontWeight: 700, color: INK }}>Growth</td>
                <td style={{ padding: 6 }}>4</td>
                <td style={{ padding: 6 }}>20</td>
                <td style={{ padding: 6 }}>Comments, DMs & Reviews</td>
                <td style={{ padding: 6, color: G, fontWeight: 700 }}>$799</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: 6, fontWeight: 700, color: INK }}>Full Suite</td>
                <td style={{ padding: 6 }}>6+</td>
                <td style={{ padding: 6 }}>36</td>
                <td style={{ padding: 6 }}>Full community management</td>
                <td style={{ padding: 6, color: G, fontWeight: 700 }}>$1,299</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: 6, fontWeight: 700, color: INK }}>Custom</td>
                <td style={{ padding: 6 }}>As agreed</td>
                <td style={{ padding: 6 }}>As agreed</td>
                <td style={{ padding: 6 }}>As agreed</td>
                <td style={{ padding: 6, color: G, fontWeight: 700 }}>Custom quote</td>
              </tr>
            </tbody>
          </table>
          <p>Prices are in AUD and include GST. Plans and pricing may be updated with 30 days written notice to existing clients.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>7. Cancellation & Offboarding</h4>
          <p>Social media management services may be cancelled by providing written notice at least 7 days before the next billing date. Upon cancellation, the Client elects one of the following offboarding options:</p>
          <p><strong>Option A — Full Account Handover ($299 one-off fee)</strong><br/>Web Gecko will: sign out of all connected platforms; sign out of the dedicated Gmail account; reset the password and send credentials to your email; send a formal written confirmation with proof of sign-out. Web Gecko retains no ongoing access.</p>
          <p><strong>Option B — Stop Management (No charge)</strong><br/>Web Gecko will cease all posting, scheduling, and community management immediately. Account credentials are not transferred — accounts go dormant and remain under Web Gecko administration.</p>
          <p>The offboarding confirmation email constitutes written evidence of the actions taken. Web Gecko retains no liability for any consequence arising after the handover is completed.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>8. Rejoining</h4>
          <p>Clients who cancel social media management and wish to re-engage Web Gecko for social services are required to complete full onboarding from the beginning, pay the standard setup/onboarding fee, and sign a new agreement at prevailing rates.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>9. Liability</h4>
          <p>Web Gecko's liability under this Agreement is limited in accordance with the Terms & Conditions (WG-TNC-001). Web Gecko is not liable for follower/engagement reduction, account suspension by platforms, content errors in approved drafts, or any harm arising after handover.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>10. Governing Law</h4>
          <p>This Agreement is governed by the laws of Queensland, Australia and the Australian Consumer Law. Any disputes arising will be subject to the dispute resolution process set out in the Terms & Conditions (WG-TNC-001).</p>
        </div>
      </div>
    ),
  },
  cancellation: {
    title: "Cancellation & Refund Policy",
    updated: "14 May 2026",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, color: DIM, fontSize: 13, lineHeight: 1.6 }}>
        <p><strong>Document: WG-CAN-001</strong></p>
        <p>This Policy outlines cancellation terms for all Web Gecko services. Australian Consumer Law rights are not excluded by this Policy. Where ACL rights apply, they take precedence.</p>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>1. Website Build — Deposit</h4>
          <p>The deposit paid to commence a website build project is non-refundable. The deposit covers the cost of initial design, scoping, research, and project setup work performed by Web Gecko prior to and during the early stages of the project.</p>
          <p>If the Client wishes to discontinue the project after paying the deposit but before the website is complete, no refund of the deposit will be issued. Any work completed up to the point of cancellation remains the property of Web Gecko unless the full project price has been paid.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>2. Website Build — Final Payment</h4>
          <p>If the Client has paid the final project payment and subsequently requests cancellation before the website is launched, a partial refund may be considered at Web Gecko's discretion, less the cost of all work completed to that point. No refund is available once the website has been launched live.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>3. Monthly Hosting & Maintenance</h4>
          <p>Monthly hosting and maintenance services operate on a month-to-month basis with no lock-in contract. To cancel:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Provide written notice via email to hello@webgecko.au or via the client portal at least 7 days before the next billing date</li>
            <li>The service will continue until the end of the current paid billing period</li>
            <li>No refunds are issued for partial months — if you cancel mid-cycle, the service continues until the period end</li>
            <li>The website will be taken offline within 30 days of the final billing period ending, unless a handover package is arranged</li>
          </ul>
          <p>Clients who wish to transfer their website to another provider may purchase a handover package. Options and pricing are available in the client portal under 'Manage Subscription'.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>4. Social Media Management</h4>
          <p>Social media management services operate on a month-to-month basis with no lock-in contract. To cancel:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Provide written notice via email to hello@webgecko.au or via the client portal at least 7 days before the next billing date</li>
            <li>The service will continue until the end of the current paid billing period</li>
            <li>No refunds are issued for partial months</li>
            <li>Upon cancellation, the Client may elect either a Full Account Handover (fee applies) or Stop Management (no charge)</li>
          </ul>
          <p>Details of social media offboarding, including account credential transfer, are set out in the Social Media Management Agreement (WG-SOC-001).</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>5. Handover Packages</h4>
          <table style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${LINE}`, textAlign: "left" }}>
                <th style={{ padding: 6, color: INK }}>Package</th>
                <th style={{ padding: 6, color: INK }}>Inclusions</th>
                <th style={{ padding: 6, color: INK }}>Fee</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: 6, fontWeight: 700, color: INK }}>Full Website Handover</td>
                <td style={{ padding: 6 }}>Domain transfer, clean HTML export, final fix pass, setup guidance for new provider</td>
                <td style={{ padding: 6, color: G, fontWeight: 700 }}>50% of original build price</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: 6, fontWeight: 700, color: INK }}>HTML Export Only</td>
                <td style={{ padding: 6 }}>Clean standalone HTML file — no domain transfer or support</td>
                <td style={{ padding: 6, color: G, fontWeight: 700 }}>20% of original build price</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: 6, fontWeight: 700, color: INK }}>Social Account Handover</td>
                <td style={{ padding: 6 }}>Gmail credential transfer, platform sign-out, signed confirmation email with proof</td>
                <td style={{ padding: 6, color: G, fontWeight: 700 }}>$299 one-off</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: 6, fontWeight: 700, color: INK }}>Remove Only</td>
                <td style={{ padding: 6 }}>Removal from Web Gecko systems. No assets transferred.</td>
                <td style={{ padding: 6, color: G, fontWeight: 700 }}>Free</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>6. Rejoining Web Gecko</h4>
          <p>Clients who have previously cancelled and wish to re-engage Web Gecko services are welcome to do so. However, rejoining requires:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li>Completing the full onboarding process from the beginning</li>
            <li>Paying the standard setup/build fee at the prevailing rate at the time of re-engagement</li>
            <li>Entering into a new service agreement under the then-current Terms and Conditions</li>
          </ul>
          <p>No discounts, credits, or preferential rates are available based on prior engagement. There are no shortcuts or fast-track options for returning clients.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>7. Australian Consumer Law</h4>
          <p>Nothing in this Cancellation & Refund Policy limits, excludes, or modifies any consumer guarantee, right, or remedy available under the Australian Consumer Law (ACL) that cannot be excluded by agreement. Where the ACL applies, the Client's rights under the ACL take precedence over this Policy.</p>
          <p>If a service is not provided with due care and skill, or is not fit for the stated purpose, the Client may be entitled to a remedy under the ACL regardless of the terms of this Policy.</p>
        </div>
        <div>
          <h4 style={{ color: INK, fontSize: 14, marginBottom: 4 }}>8. How to Cancel</h4>
          <p>To initiate cancellation, use one of the following methods:</p>
          <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
            <li><strong>Client portal:</strong> Log in at webgecko.au/c/[your-slug] and navigate to 'Manage Subscription'</li>
            <li><strong>Email:</strong> Send written notice to hello@webgecko.au with your business name and the service you wish to cancel</li>
          </ul>
          <p>Cancellation is not effective until confirmed in writing by Web Gecko. Web Gecko will confirm receipt within 1 business day.</p>
        </div>
      </div>
    ),
  },
};

// ─────────────────────────────────────────────────────────────
//  ONBOARDING TOUR CONFIG
// ─────────────────────────────────────────────────────────────
const TOUR = [
  { tab:"home",      anchor:"t-welcome",  emoji:"👋", title:"Welcome to your Hub",         desc:"Your command centre for website status and social media posts. Let's take a quick look around." },
  { tab:"home",      anchor:"t-metrics",  emoji:"📊", title:"Your key stats",               desc:"Plan details, build stage, bookings count, and social queue metrics — all at a glance." },
  { tab:"create",    anchor:"t-media",    emoji:"📸", title:"Post creator desk",            desc:"Create social media posts by uploading photos/videos, recording a voice note, or writing a brief." },
  { tab:"create",    anchor:"t-voice",    emoji:"🎤", title:"Voice instruction",            desc:"Hit Record and describe the post. We transcribe it in real time and pass it to the AI." },
  { tab:"create",    anchor:"t-brief",    emoji:"✍️", title:"Write a brief",                desc:"Add context, tone, promotions. The more detail, the better your captions." },
  { tab:"review",    anchor:"t-review",   emoji:"📝", title:"Review AI drafts",             desc:"Fine-tune the AI generated captions for each platform, then approve them to schedule posting." },
  { tab:"calendar",  anchor:"t-queue",    emoji:"📅", title:"Posting Queue",                desc:"See the calendar list of all approved posts scheduled for automatic publishing." },
];

const CANCEL_OPTIONS = [
  {
    id: "transfer",
    label: "Full handover package",
    desc: "We transfer your domain, export a clean standalone HTML file, do a final fix pass, and guide you through setting up with your new provider.",
    priceLabel: (buildPrice: number) => `$${Math.round(buildPrice * 0.5).toLocaleString()} one-off handover fee`,
    priceCalc: (buildPrice: number) => Math.round(buildPrice * 0.5),
    icon: "📦",
  },
  {
    id: "html",
    label: "HTML export only",
    desc: "We send you a clean, standalone HTML file of your site. No domain transfer or support.",
    priceLabel: (buildPrice: number) => `$${Math.round(buildPrice * 0.2).toLocaleString()} export fee`,
    priceCalc: (buildPrice: number) => Math.round(buildPrice * 0.2),
    icon: "📄",
  },
  {
    id: "remove",
    label: "Remove from our system — no assets",
    desc: "We remove you from our dashboards at no charge. Your site goes offline within 30 days.",
    priceLabel: () => "Free — 30 days notice",
    priceCalc: () => 0,
    icon: "🗑️",
  },
];

const SOCIAL_CANCEL_OPTIONS = [
  {
    id: "social_handover",
    label: "Full social account handover",
    desc: "We transfer the Gmail address, reset all platform passwords, and email you confirmation. You own everything.",
    priceLabel: () => "$299 one-off handover fee",
    priceCalc: () => 299,
    icon: "📱",
  },
  {
    id: "social_remove",
    label: "Remove management — no handover",
    desc: "We stop posting and managing your accounts. Accounts stay yours but go dormant.",
    priceLabel: () => "Free",
    priceCalc: () => 0,
    icon: "🗑️",
  },
];

type Tab = "home"|"create"|"review"|"calendar"|"menu"|"preview"|"bookings"|"content"|"upgrades"|"billing"|"settings"|"support"|"quote"|"plan";

// Editable feedback item component
function EditableChange({ index, text, onUpdate, onDelete }: any) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  function save() { if (val.trim()) onUpdate(val.trim()); setEditing(false); }
  return (
    <div style={{ background: "#F3F4F6", border: `1px solid ${LINE}`, borderRadius: 10, padding: "8px 12px", display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
      <span style={{ color: DIM, fontSize: 11, minWidth: 16, fontWeight: 700 }}>{index + 1}.</span>
      {editing ? (
        <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} className="inp" style={{ padding: "6px 8px", fontSize: 12 }} />
          <button onClick={save} className="btn-sm-outline" style={{ background: G, color: "#fff", border: "none" }}>Save</button>
          <button onClick={() => { setVal(text); setEditing(false); }} className="btn-sm-outline">Cancel</button>
        </div>
      ) : (
        <span style={{ flex: 1, color: INK, fontSize: 12, fontWeight: 600 }}>{text}</span>
      )}
      <div style={{ display: "flex", gap: 4 }}>
        {!editing && <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: DIM, cursor: "pointer", fontSize: 12 }}>✎</button>}
        <button onClick={onDelete} style={{ background: "none", border: "none", color: DIM, cursor: "pointer", fontSize: 13 }}>✕</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ClientPortal() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  // Auth & loading
  const [authLoading, setAuthLoading] = useState(true);
  const [client,      setClient]      = useState<any>(null);

  // Tabs & Nav
  const [tab,          setTab]          = useState<Tab>("home");
  const [upsell,       setUpsell]       = useState(false);
  const [legalDoc,     setLegalDoc]     = useState<string|null>(null);

  // Social Create
  const [brief,       setBrief]       = useState("");
  const [tone,        setTone]        = useState("friendly");
  const [platforms,   setPlatforms]   = useState<string[]>(["instagram","facebook"]);
  const [files,       setFiles]       = useState<File[]>([]);
  const [previews,    setPreviews]    = useState<string[]>([]);
  const [showSched,   setShowSched]   = useState(false);
  const [schedDate,   setSchedDate]   = useState("");
  const [schedTime,   setSchedTime]   = useState("");

  // Voice note
  const [recording,   setRecording]   = useState(false);
  const [voiceBlob,   setVoiceBlob]   = useState<Blob|null>(null);
  const [voiceUrl,    setVoiceUrl]    = useState("");
  const [transcript,  setTranscript]  = useState("");
  const [speechOk,    setSpeechOk]    = useState(false);

  // Draft review
  const [generating,  setGenerating]  = useState(false);
  const [drafts,      setDrafts]      = useState<any[]>([]);
  const [mediaUrls,   setMediaUrls]   = useState<string[]>([]);
  const [approving,   setApproving]   = useState(false);
  const [approveDone, setApproveDone] = useState(false);

  // Database payments, queue, bookings, etc.
  const [payments,    setPayments]    = useState<any[]>([]);
  const [queue,       setQueue]       = useState<any[]>([]);
  const [postingMode, setPostingMode] = useState<"auto"|"manual">("auto");
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [payLoading,  setPayLoading]  = useState<string | null>(null);

  // Revisions feedback lists
  const [feedback,           setFeedback]           = useState<{ id: string; text: string; createdAt: string }[]>([]);
  const [feedbackText,       setFeedbackText]       = useState("");
  const [feedbackRound,      setFeedbackRound]      = useState(1);
  const [feedbackLoading,    setFeedbackLoading]    = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [revisionSent,       setRevisionSent]       = useState(false);

  // Calendar Bookings
  const [bookings,            setBookings]            = useState<any[]>([]);
  const [bookingsLoading,     setBookingsLoading]     = useState(false);
  const [bookingActing,       setBookingActing]       = useState<string | null>(null);
  const [bookingSearch,       setBookingSearch]       = useState("");
  const [bookingFilter,       setBookingFilter]       = useState<"upcoming" | "past" | "all">("upcoming");
  const [bookingModal,        setBookingModal]        = useState<null | "reschedule" | "cancel" | "add">(null);
  const [activeBooking,       setActiveBooking]       = useState<any | null>(null);
  const [bookingCancelReason, setBookingCancelReason] = useState("");
  const [bookingNewDate,      setBookingNewDate]      = useState("");
  const [bookingNewTime,      setBookingNewTime]      = useState("");
  const [bookingAddForm,      setBookingAddForm]      = useState({ name: "", email: "", phone: "", service: "", date: "", time: "", message: "" });

  // Web Copy writing engine
  const [contentRequestType,   setContentRequestType]   = useState<"blog"|"newsletter"|"deal"|"product"|"review">("blog");
  const [contentRequestTitle,  setContentRequestTitle]  = useState("");
  const [contentRequestNote,   setContentRequestNote]   = useState("");
  const [contentSubmitting,    setContentSubmitting]    = useState(false);
  const [contentSubmitted,     setContentSubmitted]     = useState(false);
  const [myContentItems,       setMyContentItems]       = useState<any[]>([]);
  const [contentItemsLoading,  setContentItemsLoading]  = useState(false);

  // Integrations upgrades
  const [upgradeSelected,    setUpgradeSelected]    = useState<string[]>([]);
  const [upgradeMessage,     setUpgradeMessage]     = useState("");
  const [upgradeSubmitting,  setUpgradeSubmitting]  = useState(false);
  const [upgradeSubmitted,   setUpgradeSubmitted]   = useState(false);
  const [myFeatureRequests,  setMyFeatureRequests]  = useState<any[]>([]);

  // Company detail settings
  const [companyAbn,      setCompanyAbn]      = useState("");
  const [companyDomain,   setCompanyDomain]   = useState("");
  const [companyAddress,  setCompanyAddress]  = useState("");
  const [companyGa4,      setCompanyGa4]      = useState("");
  const [companySaving,   setCompanySaving]   = useState(false);
  const [companySaved,    setCompanySaved]    = useState(false);
  const [shopPaymentUrl,  setShopPaymentUrl]  = useState("");
  const [shopSaving,      setShopSaving]      = useState(false);
  const [shopSaved,       setShopSaved]       = useState(false);

  // Tickets support
  const [supportTopics,     setSupportTopics]     = useState<string[]>([]);
  const [supportDetails,    setSupportDetails]    = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportSubmitted,  setSupportSubmitted]  = useState(false);

  // Quote terms acceptance
  const [termsAccepted,   setTermsAccepted]   = useState(false);
  const [termsModalOpen,  setTermsModalOpen]  = useState(false);
  const [termsChecked,    setTermsChecked]    = useState({ tos: false, privacy: false, cancellation: false, agreement: false });

  // Subscription Cancellation exit flow
  const [showSubModal,    setShowSubModal]    = useState(false);
  const [subStep,         setSubStep]         = useState<"reason"|"option"|"confirm">("reason");
  const [cancelReason,    setCancelReason]    = useState("");
  const [cancelOption,    setCancelOption]    = useState<any | null>(null);

  // Tour
  const [tourOn,   setTourOn]   = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourY,    setTourY]    = useState(100);

  // Refs
  const canvasRef  = useRef<HTMLCanvasElement|null>(null);
  const audioCtx   = useRef<AudioContext|null>(null);
  const analyserR  = useRef<AnalyserNode|null>(null);
  const mrRef      = useRef<MediaRecorder|null>(null);
  const recRef     = useRef<any>(null);
  const rafRef     = useRef<number>(0);
  const streamRef  = useRef<MediaStream|null>(null);
  const uploadRef  = useRef<HTMLInputElement|null>(null);
  const cameraRef  = useRef<HTMLInputElement|null>(null);

  const hasSocial =
    client?.metadata?.features?.some((f:string) => /social|post/i.test(f)) ||
    /social/i.test(client?.plan||"") ||
    client?.metadata?.socialActive === true;

  const isSocialOnly = client?.metadata?.serviceType === "social";
  const hasBooking = client?.hasBooking || client?.metadata?.features?.includes("Booking System");
  const hasContentFeature = client?.metadata?.features?.some((f:string) => /blog|newsletter|deal|product|review/i.test(f));
  const buildPrice = paymentStatus?.quote?.total || client?.quote?.price || 0;

  // ── Database client normalizer ──
  function normalizeClient(raw: any) {
    const m = raw.metadata || {};
    return {
      ...raw,
      businessName: raw.business_name || raw.businessName || "",
      jobId: raw.job_id || raw.jobId || "",
      email: raw.email || raw.client_email || "",
      previewUrl: raw.preview_url || raw.previewUrl || null,
      launchReady: raw.launch_ready || raw.launchReady || false,
      hasBooking: m.hasBooking ?? raw.has_booking ?? raw.hasBooking ?? false,
      supersaasId: raw.supersaasId ?? raw.supersaas_id ?? m.supersaasId ?? null,
      supersaasUrl: raw.supersaasUrl ?? raw.supersaas_url ?? m.supersaasUrl ?? null,
      squareConnected: !!(raw.square_access_token || raw.squareAccessToken || raw.squareConnected),
      squareMerchantId: raw.square_merchant_id || raw.squareMerchantId || null,
      shopPaymentUrl: raw.shop_payment_url || raw.shopPaymentUrl || null,
      name: m.name || raw.name || "",
      abn: m.abn || raw.abn || "",
      goal: m.goal || raw.goal || "",
      targetAudience: m.targetAudience || raw.target_audience || raw.targetAudience || "",
      siteType: m.siteType || raw.site_type || raw.siteType || "",
      pages: m.pages || raw.pages || [],
      features: m.features || raw.features || [],
      style: m.style || raw.style || "",
      colorPrefs: m.colorPrefs || raw.color_prefs || raw.colorPrefs || "",
      references: m.references || raw.references || "",
      additionalNotes: m.additionalNotes || raw.additional_notes || raw.additionalNotes || "",
      pricingMethod: m.pricingMethod || raw.pricing_method || raw.pricingMethod || "",
      pricingDetails: m.pricingDetails || raw.pricing_details || raw.pricingDetails || "",
      businessAddress: m.businessAddress || raw.business_address || raw.businessAddress || "",
      facebookPage: m.facebookPage || raw.facebook_page || raw.facebookPage || "",
      quote: m.quote || raw.quote || null,
    };
  }

  // ── Loader Effect ──
  useEffect(() => {
    if (!slug) return;
    const authVal = localStorage.getItem(`wg_auth_${slug}`);
    const expiry = authVal ? parseInt(authVal, 10) : 0;
    if (!authVal || Date.now() > expiry) {
      localStorage.removeItem(`wg_auth_${slug}`);
      router.replace("/c");
      return;
    }

    (async () => {
      try {
        const r = await fetch(`/api/client-login?slug=${slug}`);
        if (r.ok) {
          const raw = await r.json();
          const normalised = normalizeClient(raw);
          setClient(normalised);
          
          if (normalised.abn) setCompanyAbn(normalised.abn);
          if (normalised.businessAddress) setCompanyAddress(normalised.businessAddress);
          if (normalised.shopPaymentUrl) setShopPaymentUrl(normalised.shopPaymentUrl);
          const ui = (raw.user_input || raw.userInput || {}) as Record<string, string>;
          if (ui.preferredDomain) setCompanyDomain(ui.preferredDomain);
          if (raw.ga4Id || ui.ga4Id) setCompanyGa4(raw.ga4Id || ui.ga4Id || "");
          
          const pm = (normalised.metadata as any)?.socialPostingMode;
          if (pm === "auto" || pm === "manual") setPostingMode(pm);

          await loadDb(slug, normalised.jobId);
          await loadPaymentStatus();

          // Load terms acceptance
          const savedTerms = localStorage.getItem(`wg_terms_${slug}`);
          if (savedTerms === "accepted") setTermsAccepted(true);
        } else {
          router.replace("/c");
        }
      } catch {
        router.replace("/c");
      }
      setAuthLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!client || !slug) return;
    if (tab === "bookings") loadBookings();
    if (tab === "preview") loadFeedback();
    if (tab === "upgrades") loadMyFeatureRequests();
    if (tab === "content") loadMyContent();
  }, [tab, client, slug]);

  // ── Database Payments & Social Queue fetchers ──
  async function loadDb(slug:string, jobId:string) {
    try {
      const { data:p } = await supabasePublic.from("payments").select("*").eq("client_slug",slug).order("created_at",{ascending:false});
      if (p) setPayments(p);
      if (jobId) {
        const { data:j } = await supabasePublic.from("jobs").select("metadata").eq("id",jobId).single();
        if (j?.metadata?.approvedPosts) setQueue([...j.metadata.approvedPosts].reverse());
      }
    } catch {}
  }

  // ── Payment status loader ──
  async function loadPaymentStatus() {
    try {
      const res = await fetch(`/api/payment/status?slug=${slug}`);
      if (res.ok) setPaymentStatus(await res.json());
    } catch {}
  }

  // ── Bookings calendar loader ──
  async function loadBookings() {
    if (!client?.jobId) return;
    setBookingsLoading(true);
    try {
      const isSuperSaas = !!(client.supersaasId);
      if (isSuperSaas) {
        const res = await fetch(`/api/bookings/supersaas?slug=${slug}`);
        if (res.ok) {
          const d = await res.json();
          const mapped = (d.appointments || []).map((a: any) => ({
            bookingId: String(a.id),
            jobId: client.jobId,
            visitorName: a.fullName || a.full_name || "",
            visitorEmail: a.email || "",
            visitorPhone: a.phone || "",
            service: a.description || "Appointment",
            date: (a.start || "").slice(0, 10),
            time: (a.start || "").slice(11, 16),
            message: "",
            status: a.status || "confirmed",
            createdAt: a.createdOn || "",
          }));
          setBookings(mapped);
        }
      } else {
        const res = await fetch(`/api/bookings/client?jobId=${client.jobId}&slug=${slug}`);
        if (res.ok) setBookings((await res.json()).bookings || []);
      }
    } catch {}
    finally { setBookingsLoading(false); }
  }

  // ── Bookings Action handlers ──
  async function doBookingAction(bookingId: string, action: string, extra?: { reason?: string; newDate?: string; newTime?: string }) {
    setBookingActing(bookingId);
    try {
      const isSuperSaas = !!(client.supersaasId);
      if (isSuperSaas) {
        let start: string | undefined, finish: string | undefined;
        if (action === "reschedule" && extra?.newDate && extra?.newTime) {
          start = extra.newDate + "T" + extra.newTime + ":00";
          const d = new Date(start);
          d.setHours(d.getHours() + 1);
          finish = d.toISOString().slice(0, 19);
        }
        const active = bookings.find(b => b.bookingId === bookingId);
        const res = await fetch(`/api/bookings/supersaas?slug=${slug}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: bookingId, action,
            start, finish,
            reason: extra?.reason,
            customerEmail: active?.visitorEmail,
            customerName: active?.visitorName,
          }),
        });
        if (res.ok) {
          if (action === "cancel") {
            setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, status: "cancelled" } : b));
          } else if (action === "reschedule" && start) {
            setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, date: start!.slice(0, 10), time: start!.slice(11, 16), status: "confirmed" } : b));
          }
        }
      } else {
        const res = await fetch(`/api/bookings/client?slug=${slug}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: client.jobId, bookingId, action, ...extra }),
        });
        if (res.ok) {
          const d = await res.json();
          setBookings(prev => prev.map(b => b.bookingId === bookingId ? d.booking : b));
        }
      }
    } finally {
      setBookingActing(null); setBookingModal(null); setActiveBooking(null);
      setBookingCancelReason(""); setBookingNewDate(""); setBookingNewTime("");
    }
  }

  async function addBookingManually() {
    setBookingActing("add");
    try {
      const res = await fetch(`/api/bookings/client?slug=${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: client.jobId, visitorName: bookingAddForm.name,
          visitorEmail: bookingAddForm.email, visitorPhone: bookingAddForm.phone,
          service: bookingAddForm.service, date: bookingAddForm.date,
          time: bookingAddForm.time, message: bookingAddForm.message
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setBookings(prev => [d.booking, ...prev]);
        setBookingAddForm({ name: "", email: "", phone: "", service: "", date: "", time: "", message: "" });
        setBookingModal(null);
      }
    } finally { setBookingActing(null); }
  }

  // ── Revisions Feedback loader ──
  async function loadFeedback() {
    setFeedbackLoading(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`);
      if (res.ok) {
        const d = await res.json();
        setFeedback(d.feedback || []);
        setFeedbackRound(d.round || 1);
      }
    } finally { setFeedbackLoading(false); }
  }

  async function submitFeedbackChange() {
    if (!feedbackText.trim() || feedback.length >= 10) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: feedbackText.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setFeedback(d.feedback || []);
        setFeedbackText("");
      }
    } finally { setFeedbackSubmitting(false); }
  }

  async function submitAllFeedback() {
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`, { method: "DELETE" });
      if (res.ok) { setRevisionSent(true); setFeedback([]); }
    } finally { setFeedbackSubmitting(false); }
  }

  // ── Web Copy Content request loader ──
  async function loadMyContent() {
    setContentItemsLoading(true);
    try {
      const res = await fetch(`/api/client/content?slug=${slug}`);
      if (res.ok) { const d = await res.json(); setMyContentItems(d.items || []); }
    } catch {} finally { setContentItemsLoading(false); }
  }

  async function submitContentRequest() {
    if (!contentRequestTitle.trim()) return;
    setContentSubmitting(true);
    try {
      const res = await fetch("/api/client/content", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug, type: contentRequestType,
          title: contentRequestTitle, clientNote: contentRequestNote
        })
      });
      if (res.ok) {
        setContentSubmitted(true);
        setContentRequestTitle("");
        setContentRequestNote("");
        await loadMyContent();
      }
    } finally { setContentSubmitting(false); }
  }

  // ── Plugins Feature upgrades loader ──
  async function loadMyFeatureRequests() {
    try {
      const res = await fetch(`/api/feature-requests?slug=${slug}`);
      if (res.ok) {
        const d = await res.json();
        setMyFeatureRequests(d.requests || []);
      }
    } catch {}
  }

  async function submitUpgradeRequest() {
    if (upgradeSelected.length === 0) return;
    setUpgradeSubmitting(true);
    try {
      const res = await fetch("/api/feature-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug, featureIds: upgradeSelected, message: upgradeMessage })
      });
      if (res.ok) {
        setUpgradeSubmitted(true);
        setUpgradeSelected([]);
        setUpgradeMessage("");
        await loadMyFeatureRequests();
      }
    } finally { setUpgradeSubmitting(false); }
  }

  // ── Save company configs PATCHer ──
  async function saveCompanySettings(e: React.FormEvent) {
    e.preventDefault(); setCompanySaving(true); setCompanySaved(false);
    try {
      const res = await fetch("/api/client-login", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug, abn: companyAbn,
          businessAddress: companyAddress, preferredDomain: companyDomain,
          ga4Id: companyGa4
        })
      });
      if (res.ok) {
        setCompanySaved(true);
        const detailsRes = await fetch(`/api/client-login?slug=${slug}`);
        if (detailsRes.ok) {
          const raw = await detailsRes.json();
          setClient(normalizeClient(raw));
        }
      }
    } catch {} finally { setCompanySaving(false); }
  }

  async function saveShopPaymentUrl() {
    if (!shopPaymentUrl.trim()) return;
    setShopSaving(true); setShopSaved(false);
    try {
      const res = await fetch("/api/client-login", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug, shopPaymentUrl })
      });
      if (res.ok) {
        setShopSaved(true);
        const detailsRes = await fetch(`/api/client-login?slug=${slug}`);
        if (detailsRes.ok) {
          const raw = await detailsRes.json();
          setClient(normalizeClient(raw));
        }
        await fetch(`/api/pipeline/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: client.jobId }),
        });
      }
    } catch {} finally { setShopSaving(false); }
  }

  // ── Support tickets desk submissions ──
  async function submitSupportTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!supportDetails.trim()) return;
    setSupportSubmitting(true); setSupportSubmitted(false);
    try {
      const res = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug,
          businessName: client.businessName || slug,
          email: client.email || "",
          topics: supportTopics,
          details: supportDetails
        })
      });
      if (res.ok) {
        setSupportSubmitted(true);
        setSupportDetails("");
        setSupportTopics([]);
      }
    } finally { setSupportSubmitting(false); }
  }

  // ── Stripe Connect Pay redirect handler ──
  async function handlePay(stage: "deposit" | "final" | "monthly") {
    if (!termsAccepted) { setTermsModalOpen(true); return; }
    setPayLoading(stage);
    try {
      const res = await fetch(`/api/payment/create?slug=${slug}&stage=${stage}`);
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        alert(`Error ${res.status}: ${data.error || res.statusText}`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Payment link generation failed.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPayLoading(null);
    }
  }

  function signOut() {
    localStorage.removeItem(`wg_auth_${slug}`);
    router.replace("/c");
  }

  function go(t:Tab) {
    if (["create","review","calendar"].includes(t) && !hasSocial) { setUpsell(true); return; }
    setTab(t);
  }

  function addFiles(fl:FileList|null) {
    if (!fl) return;
    const picked = Array.from(fl);
    setFiles(p=>[...p,...picked].slice(0,5));
    setPreviews(p=>[...p,...picked.map(f=>URL.createObjectURL(f))].slice(0,5));
  }
  const rmFile = (i:number) => { setFiles(p=>p.filter((_,j)=>j!==i)); setPreviews(p=>p.filter((_,j)=>j!==i)); };

  // ── Voice Recorder ──
  async function startRec() {
    setTranscript(""); setVoiceBlob(null); setVoiceUrl("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({audio:true});
      streamRef.current = s; setRecording(true);
      const Ctx = window.AudioContext||(window as any).webkitAudioContext;
      if (Ctx) { const ctx=new Ctx(),src=ctx.createMediaStreamSource(s),an=ctx.createAnalyser(); an.fftSize=64; src.connect(an); audioCtx.current=ctx; analyserR.current=an; drawViz(); }
      if (recRef.current) recRef.current.start();
      const mr = new MediaRecorder(s); const chunks:Blob[]=[];
      mr.ondataavailable = e=>{if(e.data?.size)chunks.push(e.data);};
      mr.onstop = ()=>{const b=new Blob(chunks,{type:"audio/wav"}); setVoiceBlob(b); setVoiceUrl(URL.createObjectURL(b));};
      mrRef.current=mr; mr.start();
    } catch { alert("Microphone permission denied."); setRecording(false); }
  }
  function stopRec() { setRecording(false); mrRef.current?.stop(); recRef.current?.stop(); streamRef.current?.getTracks().forEach(t=>t.stop()); cancelAnimationFrame(rafRef.current); audioCtx.current?.close(); }
  function drawViz() { const an=analyserR.current; if(!an) return; const data=new Uint8Array(an.frequencyBinCount); const d=()=>{rafRef.current=requestAnimationFrame(d); an.getByteFrequencyData(data); document.querySelectorAll(".vbar").forEach((b:any,i)=>{if(data[i]!==undefined)b.style.height=`${Math.max(5,(data[i]/255)*36)}px`;});}; d(); }

  // ── Social Post AI generator draft ──
  async function generate() {
    if (!brief.trim()&&!transcript.trim()&&files.length===0){alert("Add media, brief, or voice note first.");return;}
    setGenerating(true); setDrafts([]);
    try {
      const fd=new FormData(); fd.append("slug",slug); fd.append("brief",brief); fd.append("tone",tone);
      fd.append("platforms",JSON.stringify(platforms)); fd.append("voiceTranscript",transcript);
      files.forEach(f=>fd.append("files",f)); if(voiceBlob) fd.append("voiceover",voiceBlob,"vo.wav");
      const r=await fetch("/api/client/social-upload-app",{method:"POST",body:fd});
      const d=await r.json(); if(!r.ok) throw new Error(d.error);
      setDrafts(d.drafts); setMediaUrls(d.mediaUrls); setTab("review");
    } catch(e:any){alert("Error: "+e.message);}
    finally{setGenerating(false);}
  }

  // ── Post approval ──
  async function approve() {
    setApproving(true);
    try {
      const r=await fetch("/api/client/social-approve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:slug,posts:drafts.map(d=>({...d,mediaUrls}))})});
      if(!r.ok) throw new Error((await r.json()).error);
      setApproveDone(true); confetti();
      await loadDb(slug,client.jobId);
      setTimeout(()=>{setApproveDone(false);setBrief("");setFiles([]);setPreviews([]);setVoiceBlob(null);setVoiceUrl("");setTranscript("");setDrafts([]);setTab("calendar");},3800);
    } catch(e:any){alert("Failed: "+e.message);}
    finally{setApproving(false);}
  }

  function confetti() {
    const c=canvasRef.current; if(!c) return;
    c.width=window.innerWidth; c.height=window.innerHeight;
    const ctx=c.getContext("2d"); if(!ctx) return;
    const cols=[G,"#34D399","#6EE7B7","#A7F3D0","#10B981","#059669"];
    const pp=Array.from({length:120},()=>({x:Math.random()*c.width,y:c.height+10,vx:(Math.random()-.5)*7,vy:-Math.random()*15-8,s:Math.random()*8+3,c:cols[Math.floor(Math.random()*cols.length)],r:Math.random()*360,rs:Math.random()*4-2}));
    const a=()=>{ctx.clearRect(0,0,c.width,c.height);let alive=false;pp.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.35;p.r+=p.rs;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r*Math.PI/180);ctx.fillStyle=p.c;ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s);ctx.restore();if(p.y<c.height+10)alive=true;});if(alive)requestAnimationFrame(a);else ctx.clearRect(0,0,c.width,c.height);};
    a();
  }

  const fmt = (s:string) => new Date(s).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const minDate = tomorrow.toISOString().split("T")[0];

  // ── Guided Onboarding Tour managers ──
  function startTour(){setTourStep(0);setTourOn(true);applyTourStep(0);}
  function endTour(){setTourOn(false);if(slug)localStorage.setItem(`wg_tour_${slug}`,"1");}
  function applyTourStep(step:number){
    const s=TOUR[step]; if(!s){endTour();return;}
    setTab(s.tab as Tab);
    setTimeout(()=>{
      const el=document.getElementById(s.anchor);
      if(el){el.scrollIntoView({behavior:"smooth",block:"center"});const rect=el.getBoundingClientRect();setTourY(Math.min(rect.bottom+12,window.innerHeight-290));}
      else setTourY(Math.max(window.innerHeight/2-140,60));
    },300);
  }
  function tourNext(){const n=tourStep+1;if(n>=TOUR.length){endTour();return;}setTourStep(n);applyTourStep(n);}
  function tourPrev(){const p=tourStep-1;if(p<0)return;setTourStep(p);applyTourStep(p);}

  // ── Loading state spinner ──
  if (authLoading) return (
    <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <GeckoMark size={42}/>
      <div style={{width:20,height:20,border:`2.5px solid ${LINE}`,borderTopColor:G,borderRadius:"50%"}} className="spin"/>
    </div>
  );

  const isSubPage = ["preview", "bookings", "content", "upgrades", "billing", "settings", "support", "quote", "plan"].includes(tab);

  return (
    <div className="shell">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <canvas ref={canvasRef} style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:9999}}/>

      {/* ── Header ── */}
      {!isSubPage && (
        <header className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <GeckoMark size={24}/>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:INK,letterSpacing:"-.2px",lineHeight:1}}>{client?.businessName || "WebGecko"}</div>
              <div style={{fontSize:8,color:G,fontWeight:700,textTransform:"uppercase",letterSpacing:".04em",marginTop:1}}>Client Hub</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={startTour} style={{background:"none",border:`1px solid ${LINE}`,borderRadius:20,padding:"3px 8px",fontSize:10,color:DIM,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              Tour
            </button>
            <div style={{width:26,height:26,borderRadius:"50%",background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>
              {client?.businessName?.[0]?.toUpperCase() || "C"}
            </div>
          </div>
        </header>
      )}

      {/* ── Subpage Header with Back navigation button ── */}
      {isSubPage && (
        <header className="hdr" style={{ borderBottom: `1px solid ${LINE}` }}>
          <button onClick={() => setTab("menu")} style={{ background: "none", border: "none", color: G, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Ico d={ic.back} size={16} color={G} /> Back
          </button>
          <div style={{ fontSize: 13, fontWeight: 800, color: INK, textTransform: "capitalize" }}>{tab === "upgrades" ? "Upgrades" : tab === "preview" ? "Revisions" : tab === "content" ? "Copywriting" : tab === "support" ? "Support" : tab === "quote" ? "Payments" : tab}</div>
          <div style={{ width: 40 }} />
        </header>
      )}

      {/* ── Content Viewport scroll ── */}
      <div className="scroll fade">

        {/* ══ HUB ══ */}
        {tab === "home" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div id="t-welcome">
              <p style={{margin:"0 0 2px",color:DIM,fontSize:13}}>Good to see you 👋</p>
              <h1 className="page-h" style={{fontSize:18}}>{client?.name || client?.businessName}</h1>
            </div>

            {/* Metrics */}
            <div id="t-metrics" className="card" style={{overflow:"hidden",padding:0}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
                {[
                  {label:"Active Plan",  value:client?.plan || "Starter Web", accent:G},
                  {label:"Build Status", value:client?.buildStatus || "Active",  accent:INK},
                  {label:"Queue count",  value:`${queue.length} posts`,          accent:INK},
                  {label:"Paid invoices",value:`${payments.length} paid`,          accent:G},
                ].map((m,i)=>(
                  <div key={m.label} style={{padding:"12px 14px",borderRight:i%2===0?`1px solid ${LINE}`:"none",borderBottom:i<2?`1px solid ${LINE}`:"none"}}>
                    <div className="sec-lbl" style={{marginBottom:2}}>{m.label}</div>
                    <div style={{fontSize:14,fontWeight:800,color:m.accent,textTransform:"capitalize"}}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Website builder quick overview */}
            {!isSocialOnly && (
              <div className="card">
                <div className="card-header"><div className="card-title">🌐 Web Project Status</div></div>
                <p style={{fontSize:13,color:DIM,lineHeight:1.5,marginBottom:12}}>
                  Your website builder setup is {client?.launchReady ? "live" : "in progress"}. Preview layout drafts, log visual adjustments, or check calendar appointments.
                </p>
                <div style={{display:"flex",gap:8}}>
                  {client?.previewUrl && (
                    <a href={client.previewUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{flex:1,fontSize:12,padding:"10px 0"}}>
                      Preview Site ↗
                    </a>
                  )}
                  <button onClick={()=>go("menu")} className="btn-ghost" style={{flex:1,fontSize:12,padding:"10px 0"}}>Web Settings →</button>
                </div>
              </div>
            )}

            {/* CTA Upsell */}
            {!hasSocial && (
              <div className="card" style={{background:DARK,color:"#fff",borderColor:"#222"}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{width:36,height:36,borderRadius:10,background:`${G}25`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico d={ic.send} size={18} color={G}/></div>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:4}}>Unlock Social Posting</div>
                    <p style={{fontSize:12,color:"#999",lineHeight:1.5,margin:"0 0 10px"}}>AI-written post captions from photos or a voice note. Flat $100 per post.</p>
                    <button onClick={()=>setUpsell(true)} className="btn-primary" style={{padding:"8px 14px",fontSize:12,width:"auto"}}>Unlock Bundle →</button>
                  </div>
                </div>
              </div>
            )}

            {hasSocial && queue.length > 0 && (
              <div className="card" style={{padding:12,display:"flex",gap:10,alignItems:"center",background:`${G}08`,borderColor:`${G}20`}}>
                <div style={{width:32,height:32,borderRadius:8,background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico d={ic.queue} size={16} color={G}/></div>
                <div style={{minWidth:0,flex:1}}>
                  <div className="sec-lbl" style={{margin:0,color:G}}>Next scheduled post</div>
                  <div style={{fontSize:12,fontWeight:700,color:INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{queue[0].platform?.toUpperCase()}: {queue[0].caption?.slice(0,35)}…</div>
                  <div style={{fontSize:10,color:DIM,marginTop:2}}>{fmt(queue[0].scheduledAt)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ CREATE POST ══ */}
        {tab === "create" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><h1 className="page-h">Create Post</h1><p className="page-sub">Draft social posts using briefs or voice.</p></div>

            {/* Upload Inputs */}
            <input ref={uploadRef} type="file" multiple accept="image/*,video/*" hidden onChange={e=>addFiles(e.target.files)}/>
            <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={e=>addFiles(e.target.files)}/>

            <div id="t-media" style={{display:"flex",gap:8}}>
              <button onClick={()=>cameraRef.current?.click()} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"16px 10px",borderRadius:12,border:"none",background:DARK,cursor:"pointer"}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:`${G}22`,display:"flex",alignItems:"center",justifyContent:"center"}}><Ico d={ic.camera} size={16} color={G}/></div>
                <span style={{color:"#fff",fontWeight:700,fontSize:12}}>Take Photo</span>
              </button>
              <button onClick={()=>uploadRef.current?.click()} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"16px 10px",borderRadius:12,border:`1.5px solid ${LINE}`,background:CARD,cursor:"pointer"}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center"}}><Ico d={ic.upload} size={16} color={G}/></div>
                <span style={{color:INK,fontWeight:700,fontSize:12}}>Upload Media</span>
              </button>
            </div>

            {previews.length > 0 && (
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
                {previews.map((url,i)=>(
                  <div key={url} style={{position:"relative",width:64,height:64,borderRadius:10,overflow:"hidden",border:`1px solid ${LINE}`,flexShrink:0}}>
                    <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <button onClick={()=>rmFile(i)} style={{position:"absolute",top:2,right:2,width:16,height:16,borderRadius:"50%",background:"rgba(0,0,0,.6)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Ico d={ic.x} size={10} color="#fff"/>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Voice Command */}
            <div id="t-voice" className="card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div className="sec-lbl" style={{margin:0}}>Voice commands</div>
                {speechOk && <span className="chip chip-green" style={{fontSize:8,padding:"1px 6px"}}>Live</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {recording ? (
                  <button onClick={stopRec} className="rec-pulse" style={{background:"#EF4444",border:"none",color:"#fff",padding:"8px 16px",borderRadius:30,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                    <span style={{width:6,height:6,background:"#fff",borderRadius:"50%"}}/>Stop
                  </button>
                ) : (
                  <button onClick={startRec} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:30,border:"none",background:G,color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>
                    <Ico d={ic.mic} size={12} color="#fff"/>Record
                  </button>
                )}
                {recording && <div style={{display:"flex",gap:2,alignItems:"center",height:24,flex:1,justifyContent:"center"}}>{Array.from({length:10}).map((_,i)=><div key={i} className="vbar"/>)}</div>}
              </div>
              {voiceUrl && <div style={{marginTop:8}}><audio src={voiceUrl} controls style={{width:"100%",height:30}}/></div>}
              {transcript && <div style={{marginTop:8}}><label className="sec-lbl">Transcript</label><textarea className="inp" value={transcript} onChange={e=>setTranscript(e.target.value)} style={{minHeight:50,fontSize:12}}/></div>}
            </div>

            {/* Text brief details */}
            <div id="t-brief" className="card" style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <label className="sec-lbl">Prompt Brief</label>
                <textarea className="inp" value={brief} onChange={e=>setBrief(e.target.value.slice(0,500))} rows={3} placeholder="Describe discount promos, context or layout tone..."/>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="sec-lbl">Tone</label>
                  <select className="inp" value={tone} onChange={e=>setTone(e.target.value)}>
                    <option value="friendly">Friendly</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>
                <div>
                  <label className="sec-lbl">Charge rate</label>
                  <div style={{display:"flex",alignItems:"center",background:`${G}08`,border:`1.5px solid ${G}20`,borderRadius:10,padding:"8px 10px",height:38,fontSize:12,fontWeight:700,color:G}}>
                    💰 $100 flat
                  </div>
                </div>
              </div>

              <div>
                <label className="sec-lbl">Platforms</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:2}}>
                  {["Instagram","Facebook","LinkedIn","TikTok","X"].map(p => {
                    const key = p.toLowerCase();
                    const active = platforms.includes(key);
                    const col = PL[key]?.color || DIM;
                    return (
                      <button key={p} onClick={() => setPlatforms(prev => active ? prev.filter(x=>x!==key) : [...prev, key])}
                        style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:active?700:500,cursor:"pointer",border:`1.5px solid ${active?col:LINE}`,background:active?`${col}12`:"transparent",color:active?col:DIM,fontFamily:"inherit"}}>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Schedule config */}
            <div className="card">
              <div onClick={()=>setShowSched(s=>!s)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <span style={{fontWeight:700,fontSize:13,color:INK}}>Schedule posting slot</span>
                <Toggle on={showSched} onToggle={()=>setShowSched(s=>!s)}/>
              </div>
              {showSched && (
                <div style={{display:"flex",gap:8,borderTop:`1px solid ${LINE}`,marginTop:10,paddingTop:10}}>
                  <input type="date" min={minDate} value={schedDate} onChange={e=>setSchedDate(e.target.value)} className="inp" style={{flex:1}}/>
                  <input type="time" value={schedTime} onChange={e=>setSchedTime(e.target.value)} className="inp" style={{flex:1}}/>
                </div>
              )}
            </div>

            <button onClick={generate} disabled={generating || (!brief.trim() && !transcript.trim() && files.length===0)} className="btn-primary">
              {generating ? <span style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:13,height:13,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%"}} className="spin"/>Processing...</span> : "Generate AI Drafts"}
            </button>
          </div>
        )}

        {/* ══ REVIEW DRAFTS ══ */}
        {tab === "review" && (
          <div id="t-review" style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h1 className="page-h">Review</h1>
              <button onClick={()=>setTab("create")} className="btn-sm-outline">← Back</button>
            </div>

            {drafts.length === 0 ? (
              <div className="card" style={{textAlign:"center",padding:40}}>
                <div style={{fontSize:28,marginBottom:8}}>📝</div>
                <div style={{fontSize:14,fontWeight:800,color:INK}}>No drafts computed</div>
                <p style={{fontSize:12,color:DIM,marginTop:4}}>Use the Post creator to generate draft captions.</p>
              </div>
            ) : (
              <>
                {drafts.map((d, i) => (
                  <div key={d.platform} className="card" style={{padding:0,overflow:"hidden"}}>
                    <div style={{background:BG,padding:"8px 12px",borderBottom:`1px solid ${LINE}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontSize:12,fontWeight:800,color:INK}}>{client?.businessName}</span>
                      <PlatBadge platform={d.platform}/>
                    </div>
                    {previews.length > 0 && (
                      <div style={{aspectRatio:"16/9",overflow:"hidden",background:"#e5e7eb"}}>
                        <img src={previews[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      </div>
                    )}
                    <div style={{padding:12}}>
                      <textarea className="inp" value={d.caption} onChange={e=>{const updated=[...drafts]; updated[i].caption=e.target.value; setDrafts(updated);}} rows={4} style={{background:"transparent",border:"none",padding:0,fontSize:13,lineHeight:1.5,color:INK}} />
                      {d.hashtags && d.hashtags.length > 0 && (
                        <div style={{display:"flex",flexWrap:"wrap",gap:4,borderTop:`1px solid ${LINE}`,marginTop:8,paddingTop:8}}>
                          {d.hashtags.map((h:string) => <span key={h} style={{color:G,fontSize:11,fontWeight:600}}>{h}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="card">
                  {approveDone ? (
                    <div style={{textAlign:"center",padding:8}}>
                      <div style={{fontSize:20,color:G,fontWeight:800}}>✓ Posts Approved & Queued!</div>
                    </div>
                  ) : (
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                      <div>
                        <div style={{fontSize:10,color:DIM}}>Social Posting fee</div>
                        <div style={{fontSize:18,fontWeight:900,color:INK}}>$100.00 <span style={{fontSize:11,color:DIM,fontWeight:500}}>AUD</span></div>
                      </div>
                      <button onClick={approve} disabled={approving} className="btn-primary" style={{width:"auto",padding:"10px 18px"}}>
                        {approving ? "Approving..." : "Approve & Publish"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ POSTING QUEUE ══ */}
        {tab === "calendar" && (
          <div id="t-queue" style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><h1 className="page-h">Posting Queue</h1><p className="page-sub">Approved posts scheduled for publishing.</p></div>

            {queue.length === 0 ? (
              <div className="card" style={{textAlign:"center",padding:40}}>
                <div style={{fontSize:28,marginBottom:8}}>📅</div>
                <div style={{fontSize:14,fontWeight:800,color:INK}}>Queue is empty</div>
                <p style={{fontSize:12,color:DIM,marginTop:4}}>Approved posts will slide in here.</p>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {queue.map((p:any, i:number)=>(
                  <div key={p.id || i} className="card" style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:8,background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico d={ic.send} size={15} color={G}/></div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                        <PlatBadge platform={p.platform}/>
                        <span className="chip chip-green" style={{fontSize:9}}>Scheduled</span>
                      </div>
                      <p style={{fontSize:12,color:INK,lineHeight:1.5,margin:0}}>{p.caption}</p>
                      <div style={{fontSize:10,color:G,fontWeight:700,marginTop:6}}>📅 {fmt(p.scheduledAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ HUB MENU ══ */}
        {tab === "menu" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><h1 className="page-h">Menu</h1><p className="page-sub">Account, billing & web configurations.</p></div>

            <div className="card" style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:G,color:"#fff",fontSize:14,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{client?.businessName?.[0]?.toUpperCase() || "C"}</div>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:INK}}>{client?.businessName}</div>
                <div style={{fontSize:10,color:DIM,marginTop:1}}>{client?.email}</div>
              </div>
            </div>

            {!isSocialOnly && (
              <div className="card" style={{padding:10}}>
                <span className="sec-lbl" style={{marginLeft:6}}>Website Management</span>
                <button onClick={()=>go("preview")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 6px",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  <span>👁 Site Preview & Revisions</span><span>›</span>
                </button>
                {hasBooking && (
                  <button onClick={()=>go("bookings")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 6px",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    <span>📅 Bookings Calendar</span><span>›</span>
                  </button>
                )}
                {hasContentFeature && (
                  <button onClick={()=>go("content")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 6px",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    <span>📰 Request Copy & Blogs</span><span>›</span>
                  </button>
                )}
                <button onClick={()=>go("upgrades")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 6px",background:"transparent",border:"none",color:INK,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  <span>🔌 Plugins & Upgrades</span><span>›</span>
                </button>
              </div>
            )}

            <div className="card" style={{padding:10}}>
              <span className="sec-lbl" style={{marginLeft:6}}>System & Support</span>
              <button onClick={()=>go("quote")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 6px",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                <span>💳 Quote & Payments</span><span>›</span>
              </button>
              <button onClick={()=>go("plan")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 6px",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                <span>📋 My Performance Plan</span><span>›</span>
              </button>
              <button onClick={()=>go("settings")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 6px",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                <span>🛠️ Company Settings</span><span>›</span>
              </button>
              <button onClick={()=>go("support")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 6px",background:"transparent",border:"none",color:INK,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                <span>✉ Support Tickets</span><span>›</span>
              </button>
            </div>

            <div className="card" style={{padding:10}}>
              <span className="sec-lbl" style={{marginLeft:6}}>Legal Docs</span>
              <button onClick={()=>setLegalDoc("tos")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 6px",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                <span>Terms of Service</span><span>›</span>
              </button>
              <button onClick={()=>setLegalDoc("privacy")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 6px",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                <span>Privacy Policy</span><span>›</span>
              </button>
              <button onClick={()=>setLegalDoc("cancellation")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 6px",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                <span>Cancellation & Refund Policy</span><span>›</span>
              </button>
              {hasSocial && (
                <button onClick={()=>setLegalDoc("agreement")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 6px",background:"transparent",border:"none",color:INK,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                  <span>Social Media Agreement</span><span>›</span>
                </button>
              )}
            </div>

            <button onClick={signOut} className="btn-danger" style={{width:"100%"}}>Sign Out</button>
          </div>
        )}

        {/* ══ SUBPAGE: REVISIONS & PREVIEW ══ */}
        {tab === "preview" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {client?.previewUrl ? (
              <div className="card" style={{padding:0,overflow:"hidden",display:"flex",flexDirection:"column",height:400}}>
                <iframe src={client.previewUrl} style={{width:"100%",height:"100%",border:"none"}} />
              </div>
            ) : (
              <div className="card" style={{textAlign:"center",padding:30}}>
                <span style={{fontSize:30}}>🏗️</span>
                <div style={{fontSize:13,fontWeight:700,color:INK,marginTop:6}}>Preview compiling</div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><div className="card-title">📝 Compile Revisions ({feedback.length}/10)</div></div>
              <p style={{fontSize:12,color:DIM,lineHeight:1.4,marginBottom:12}}>
                Compile up to 10 visual or layout revisions for Zack to adjust.
              </p>
              
              {feedback.length > 0 && (
                <div style={{marginBottom:12}}>
                  {feedback.map((f, i) => (
                    <EditableChange key={f.id} index={i} text={f.text}
                      onUpdate={async (newText: string) => {
                        const updated = [...feedback]; updated[i].text = newText; setFeedback(updated);
                        await fetch(`/api/preview/feedback?slug=${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: newText }) });
                      }}
                      onDelete={async () => {
                        setFeedback(p => p.filter(x => x.id !== f.id));
                        await fetch(`/api/preview/feedback?slug=${slug}`, { method: "DELETE" });
                      }}
                    />
                  ))}
                </div>
              )}

              {feedback.length < 10 && (
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <input type="text" placeholder="e.g. Change hero image query..." value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} onKeyDown={e=>e.key==="Enter" && submitFeedbackChange()} className="inp" style={{flex:1}} />
                  <button onClick={submitFeedbackChange} disabled={feedbackSubmitting || !feedbackText.trim()} className="btn-primary" style={{width:"auto",padding:"0 14px"}}>Add</button>
                </div>
              )}

              {feedback.length > 0 && (
                <button onClick={submitAllFeedback} disabled={feedbackSubmitting} className="btn-primary">
                  {feedbackSubmitting ? "Submitting..." : "Submit Revisions to Zack"}
                </button>
              )}

              {revisionSent && (
                <div style={{marginTop:8,background:`${G}12`,borderRadius:8,padding:10,color:G,fontWeight:700,fontSize:12,textAlign:"center"}}>
                  ✓ Revisions submitted! Zack will update the design.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ SUBPAGE: BOOKINGS CALENDAR ══ */}
        {tab === "bookings" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:700,color:INK}}>Calendar list ({bookings.length})</span>
              {!(client?.supersaasId) && (
                <button onClick={() => setBookingModal("add")} className="btn-sm">+ Add</button>
              )}
            </div>

            <input type="text" placeholder="Search name or service..." value={bookingSearch} onChange={e=>setBookingSearch(e.target.value)} className="inp" style={{marginBottom:4}} />
            
            <div style={{display:"flex",gap:6,marginBottom:4}}>
              {(["upcoming", "past", "all"] as const).map(f => (
                <button key={f} onClick={() => setBookingFilter(f)} className={`pill ${bookingFilter===f?"on":""}`} style={{fontSize:11,padding:"4px 10px"}}>
                  {f}
                </button>
              ))}
            </div>

            {bookingsLoading ? (
              <div style={{textAlign:"center",padding:20,color:DIM}}>Loading...</div>
            ) : bookings.length === 0 ? (
              <div className="card" style={{textAlign:"center",padding:30}}>
                <p style={{fontSize:12,color:DIM}}>No bookings recorded.</p>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {bookings
                  .filter(b => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    if (bookingFilter === "upcoming") return b.date >= todayStr && !["cancelled", "declined"].includes(b.status);
                    if (bookingFilter === "past") return b.date < todayStr || ["cancelled", "declined"].includes(b.status);
                    return true;
                  })
                  .filter(b => !bookingSearch || [b.visitorName, b.service].join(" ").toLowerCase().includes(bookingSearch.toLowerCase()))
                  .map(b => {
                    const isDone = ["cancelled", "declined"].includes(b.status);
                    return (
                      <div key={b.bookingId} className="card" style={{opacity: isDone ? 0.6 : 1, padding:12, marginBottom:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontWeight:700,fontSize:13,color:INK}}>{b.visitorName}</span>
                          <span className={`chip ${b.status==="confirmed"?"chip-green":b.status==="pending"?"chip-amber":"chip-red"}`} style={{fontSize:9}}>{b.status}</span>
                        </div>
                        <div style={{fontSize:11,color:DIM}}>{b.service} · {b.date} at {b.time}</div>
                        <div style={{fontSize:11,color:DIM,marginTop:4}}>✉ {b.visitorEmail}</div>

                        {!isDone && (
                          <div style={{display:"flex",gap:6,marginTop:8}}>
                            {b.status !== "confirmed" && (
                              <button className="btn-sm" style={{padding:"4px 8px",fontSize:10}} onClick={() => doBookingAction(b.bookingId, "confirm")} disabled={bookingActing===b.bookingId}>Confirm</button>
                            )}
                            <button className="btn-sm-outline" style={{padding:"4px 8px",fontSize:10}} onClick={() => { setActiveBooking(b); setBookingModal("reschedule"); setBookingNewDate(b.date); setBookingNewTime(b.time); }}>Resched</button>
                            <button className="btn-sm-outline" style={{padding:"4px 8px",fontSize:10,color:"#EF4444",borderColor:"rgba(239,68,68,0.2)"}} onClick={() => { setActiveBooking(b); setBookingModal("cancel"); }}>Cancel</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ══ SUBPAGE: CONTENT ENGINE ══ */}
        {tab === "content" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card">
              <div className="card-header"><div className="card-title">📝 Request Web Copywriting</div></div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div>
                  <label className="sec-lbl">Content Type</label>
                  <select className="inp" value={contentRequestType} onChange={e=>setContentRequestType(e.target.value as any)}>
                    <option value="blog">Blog Post</option>
                    <option value="newsletter">Newsletter Copy</option>
                    <option value="deal">Promo Deal Offer</option>
                    <option value="product">Product description</option>
                  </select>
                </div>
                <div>
                  <label className="sec-lbl">Heading Title</label>
                  <input type="text" className="inp" placeholder="e.g. Lawn summer preparation" value={contentRequestTitle} onChange={e=>setContentRequestTitle(e.target.value)} required />
                </div>
                <div>
                  <label className="sec-lbl">Details Brief</label>
                  <textarea className="inp" rows={3} placeholder="Keywords, tones, coupon links..." value={contentRequestNote} onChange={e=>setContentRequestNote(e.target.value)} />
                </div>
                <button onClick={submitContentRequest} disabled={contentSubmitting || !contentRequestTitle.trim()} className="btn-primary">
                  {contentSubmitting ? "Submitting..." : "Send Request to Zack"}
                </button>
                {contentSubmitted && <div style={{background:`${G}12`,borderRadius:8,padding:8,color:G,fontWeight:700,fontSize:12,textAlign:"center"}}>✓ Request submitted!</div>}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">📋 Content copy list</div></div>
              {contentItemsLoading ? (
                <div style={{textAlign:"center",fontSize:12,color:DIM}}>Loading...</div>
              ) : myContentItems.length === 0 ? (
                <div style={{textAlign:"center",fontSize:11,color:DIM}}>No content copy requested yet.</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {myContentItems.map((item, i) => (
                    <div key={item.id || i} style={{border:`1px solid ${LINE}`,borderRadius:8,padding:8,background:BG,fontSize:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                        <strong style={{textTransform:"capitalize"}}>{item.type}</strong>
                        <span className="chip chip-amber" style={{fontSize:8,padding:"1px 4px"}}>Drafting</span>
                      </div>
                      <div>{item.title}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ SUBPAGE: PLUGINS UPGRADES ══ */}
        {tab === "upgrades" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card">
              <div className="card-header"><div className="card-title">🔌 Configure Plugins Checklist</div></div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                {[
                  { id: "bookings", title: "Cal Scheduling integration" },
                  { id: "analytics", title: "Google Analytics GA4 codes" },
                  { id: "shop", title: "Checkout Redirection Pages" },
                  { id: "newsletters", title: "Newsletter Subscribe forms" },
                ].map(f => {
                  const active = upgradeSelected.includes(f.id);
                  return (
                    <div key={f.id} onClick={() => setUpgradeSelected(prev => active ? prev.filter(x=>x!==f.id) : [...prev, f.id])}
                      style={{border:`1.5px solid ${active?G:LINE}`,borderRadius:10,padding:10,background:active?`${G}08`:"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{flex:1}}><span style={{fontSize:13,fontWeight:700,color:INK}}>{f.title}</span></div>
                      <span style={{width:16,height:16,borderRadius:"50%",border:`1.5px solid ${active?G:LINE}`,background:active?G:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9}}>{active && "✓"}</span>
                    </div>
                  );
                })}
              </div>

              <textarea className="inp" rows={2} placeholder="Additional setup details..." value={upgradeMessage} onChange={e=>setUpgradeMessage(e.target.value)} style={{marginBottom:10}} />

              <button onClick={submitUpgradeRequest} disabled={upgradeSubmitting || upgradeSelected.length===0} className="btn-primary">
                {upgradeSubmitting ? "Submitting..." : "Submit Plugin Requests"}
              </button>
              {upgradeSubmitted && <div style={{background:`${G}12`,borderRadius:8,padding:8,color:G,fontWeight:700,fontSize:12,textAlign:"center",marginTop:8}}>✓ Plugin requests submitted to Zack!</div>}
            </div>
          </div>
        )}

        {/* ══ SUBPAGE: QUOTE & PAYMENTS ══ */}
        {tab === "quote" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {!paymentStatus ? (
              <div className="card" style={{textAlign:"center",padding:30}}>Loading Quote Status...</div>
            ) : paymentStatus.monthlyActive ? (
              <div className="card" style={{ background:`${G}12`, borderColor:`${G}25`, textAlign:"center", padding:24 }}>
                <div style={{ fontSize:32, marginBottom:10 }}>✓</div>
                <div style={{ fontSize:16, fontWeight:800, color:G, marginBottom:4 }}>All Payments Complete</div>
                <p style={{ fontSize:12, color:DIM }}>Your site hosting and ongoing plans are active.</p>
              </div>
            ) : (
              <>
                {client?.quote && (
                  <div className="card">
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div>
                        <div className="sec-lbl">{client.quote.package} Package</div>
                        <div style={{ fontSize:24, fontWeight:900, color:INK }}>${client.quote.price.toLocaleString()}</div>
                      </div>
                      <span style={{ background:`${G}18`, border:`1px solid ${G}30`, borderRadius:8, padding:"4px 8px", fontSize:11, color:G, fontWeight:700 }}>
                        Save ${client.quote.savings.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ borderTop:`1px solid ${LINE}`, paddingTop:8, display:"flex", flexDirection:"column", gap:4 }}>
                      {client.quote.breakdown?.map((line:string) => (
                        <div key={line} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:DIM }}>
                          <span>{line.split(":")[0]}</span>
                          <span style={{ fontWeight:700, color:INK }}>{line.split(":")[1]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Steps */}
                {[
                  { key:"deposit" as const, step:1, label:"50% Deposit", amount:paymentStatus.quote.deposit, done:paymentStatus.depositPaid, active:!paymentStatus.depositPaid, btnLabel:"Pay Deposit", locked:false },
                  { key:"final" as const,   step:2, label:"50% Final Payment", amount:paymentStatus.quote.final, done:paymentStatus.finalPaid, active:paymentStatus.depositPaid && !paymentStatus.finalPaid, btnLabel:"Pay Balance", locked: paymentStatus.depositPaid && !paymentStatus.finalPaid && !paymentStatus.finalUnlocked },
                  { key:"monthly" as const, step:3, label:"Monthly Hosting", amount:null, done:paymentStatus.monthlyActive, active:paymentStatus.finalPaid && !paymentStatus.monthlyActive, btnLabel:"", locked:false },
                ].map(step => (
                  <div key={step.key} className="card" style={{ opacity: (!step.done && !step.active) ? 0.5 : 1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: (step.active && !step.locked) ? 12 : 0 }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", border:`2px solid ${step.done ? G : step.active ? INK : LINE}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color: step.done ? G : INK, background: step.done ? `${G}18` : "transparent" }}>
                          {step.done ? "✓" : step.step}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:INK }}>{step.label}</div>
                          <div style={{ fontSize:11, color:DIM }}>{step.key === "deposit" ? "Starts build pipeline" : step.key === "final" ? "Required for go-live" : "First month included"}</div>
                        </div>
                      </div>
                      {step.amount !== null && (
                        <div style={{ fontSize:16, fontWeight:800, color:INK }}>${step.amount.toLocaleString()}</div>
                      )}
                    </div>
                    {step.active && !step.locked && step.key !== "monthly" && (
                      <button onClick={() => handlePay(step.key)} disabled={payLoading === step.key} className="btn-primary" style={{ marginTop:12 }}>
                        {payLoading === step.key ? "Redirecting..." : step.btnLabel + " →"}
                      </button>
                    )}
                    {step.locked && (
                      <div style={{ background:BG, border:`1px dashed ${LINE}`, borderRadius:10, padding:10, fontSize:11, color:DIM, textAlign:"center", marginTop:10 }}>
                        🔒 Awaiting final revision approvals from Zack
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ══ SUBPAGE: MY PLAN ══ */}
        {tab === "plan" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card">
              <div className="card-header"><div className="card-title">📋 Performance Plan</div></div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, fontSize:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", borderBottom:`1px solid ${LINE}`, paddingBottom:6 }}>
                  <span style={{ color:DIM }}>Package</span>
                  <span style={{ fontWeight:700, color:INK }}>{client?.quote?.package || "Standard Website"}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", borderBottom:`1px solid ${LINE}`, paddingBottom:6 }}>
                  <span style={{ color:DIM }}>Hosting rate</span>
                  <span style={{ fontWeight:700, color:INK }}>$109/mo first 3 months, then $119/mo</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", borderBottom:`1px solid ${LINE}`, paddingBottom:6 }}>
                  <span style={{ color:DIM }}>Social media</span>
                  <span style={{ fontWeight:700, color:INK }}>{hasSocial ? "Active ($100 per approved post)" : "Inactive"}</span>
                </div>
              </div>
              <button onClick={() => { setSubStep("reason"); setShowSubModal(true); }} className="btn-danger" style={{ marginTop:14 }}>
                Cancel / Modify Plan
              </button>
            </div>
          </div>
        )}

        {/* ══ SUBPAGE: COMPANY SETTINGS ══ */}
        {tab === "settings" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card">
              <div className="card-header"><div className="card-title">🛠️ Company credentials</div></div>
              <form onSubmit={saveCompanySettings} style={{display:"flex",flexDirection:"column",gap:10}}>
                <div>
                  <label className="sec-lbl">ABN Number</label>
                  <input type="text" className="inp" placeholder="ABN" value={companyAbn} onChange={e=>setCompanyAbn(e.target.value)} />
                </div>
                <div>
                  <label className="sec-lbl">Preferred Domain</label>
                  <input type="text" className="inp" placeholder="domain.com.au" value={companyDomain} onChange={e=>setCompanyDomain(e.target.value)} />
                </div>
                <div>
                  <label className="sec-lbl">Company Address</label>
                  <input type="text" className="inp" placeholder="Address" value={companyAddress} onChange={e=>setCompanyAddress(e.target.value)} />
                </div>
                <div>
                  <label className="sec-lbl">Google GA4 Analytics ID</label>
                  <input type="text" className="inp" placeholder="G-XXXXXXXXXX" value={companyGa4} onChange={e=>setCompanyGa4(e.target.value)} />
                </div>
                <button type="submit" disabled={companySaving} className="btn-primary">
                  {companySaving ? "Saving..." : "Save Settings"}
                </button>
                {companySaved && <div style={{background:`${G}12`,borderRadius:8,padding:8,color:G,fontWeight:700,fontSize:12,textAlign:"center"}}>✓ Settings saved!</div>}
              </form>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">🛍️ Redirection shop checkout Link</div></div>
              <p style={{fontSize:11,color:DIM,lineHeight:1.4,marginBottom:8}}>Paste a Stripe or Square checkout redirect page link.</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <input type="url" className="inp" placeholder="https://square.link/..." value={shopPaymentUrl} onChange={e=>setShopPaymentUrl(e.target.value)} />
                <button onClick={saveShopPaymentUrl} disabled={shopSaving || !shopPaymentUrl.trim()} className="btn-primary">
                  {shopSaving ? "Saving..." : shopSaved ? "✓ Link Saved" : "Save payment URL"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ SUBPAGE: HELP & SUPPORT DESK ══ */}
        {tab === "support" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card">
              <div className="card-header"><div className="card-title">✉ Submit support ticket</div></div>
              <form onSubmit={submitSupportTicket} style={{display:"flex",flexDirection:"column",gap:10}}>
                <div>
                  <label className="sec-lbl">Categories</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:2}}>
                    {["Layout fix", "Text change", "Checkout link", "Social posting"].map(cat => {
                      const active = supportTopics.includes(cat);
                      return (
                        <button type="button" key={cat} onClick={() => setSupportTopics(p => active ? p.filter(x=>x!==cat) : [...p, cat])}
                          className={`pill ${active?"on":""}`} style={{fontSize:10,padding:"4px 10px"}}>
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="sec-lbl">Ticket Details</label>
                  <textarea className="inp" rows={4} placeholder="Describe layout updates or help you need from Zack..." value={supportDetails} onChange={e=>setSupportDetails(e.target.value)} required />
                </div>
                <button type="submit" disabled={supportSubmitting || !supportDetails.trim()} className="btn-primary">
                  {supportSubmitting ? "Submitting..." : "Send Ticket"}
                </button>
                {supportSubmitted && <div style={{background:`${G}12`,borderRadius:8,padding:8,color:G,fontWeight:700,fontSize:12,textAlign:"center"}}>✓ Support ticket sent to Zack!</div>}
              </form>
            </div>
          </div>
        )}

      </div>

      {/* ── Bottom Navigation Tab Bar ── */}
      <nav className="bnav">
        {[
          {id:"home",     icon:ic.home,     label:"Hub"},
          {id:"create",   icon:ic.camera,   label:"Post",   locked:!hasSocial},
          {id:"review",   icon:ic.review,   label:"Review", locked:!hasSocial},
          {id:"calendar", icon:ic.queue,    label:"Queue",  locked:!hasSocial},
          {id:"menu",     icon:"M3 12h18M3 6h18M3 18h18", label:"Menu"}
        ].map(n => {
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={()=>go(n.id as Tab)} className={`nbtn${active?" on":""}`}>
              <span className="nbtn-icon" style={{position:"relative"}}>
                <Ico d={n.icon} size={20} color={active?G:DIM} sw={active?2.2:1.6}/>
                {n.locked && <span className="nbtn-lock">🔒</span>}
                {active && <span style={{position:"absolute",bottom:-5,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:G}}/>}
              </span>
              <span className="nbtn-lbl">{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Absolute overlays & sheets within simulator bounds ── */}
      
      {/* Upsell bundle Modal */}
      {upsell && (
        <div className="modal-backdrop">
          <div className="modal-dialog fade">
            <button onClick={()=>setUpsell(false)} style={{position:"absolute",top:10,right:10,background:"none",border:"none",color:DIM,cursor:"pointer",padding:4}}><Ico d={ic.x} size={16} color={DIM}/></button>
            <div style={{width:48,height:48,borderRadius:"50%",background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><Ico d={ic.lock} size={20} color={G}/></div>
            <div style={{fontWeight:900,fontSize:16,color:INK,marginBottom:6,textAlign:"center"}}>Social Posting Bundle Required</div>
            <p style={{fontSize:12,color:DIM,lineHeight:1.5,marginBottom:18,textAlign:"center"}}>
              Unlock AI social posting copywriting from photos or recorded commands. <strong style={{color:INK}}>$100 AUD flat fee</strong> per approved post.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <a href={`mailto:hello@webgecko.au?subject=Activate Social Bundle - ${client?.businessName}`} className="btn-primary" onClick={()=>setUpsell(false)}>
                Request Social Bundle
              </a>
              <button onClick={()=>setUpsell(false)} className="btn-ghost">Maybe later</button>
            </div>
          </div>
        </div>
      )}

      {/* Legal documents overlay */}
      {legalDoc && LEGAL[legalDoc] && (
        <div className="legal-sheet fade">
          <header className="hdr" style={{ borderBottom: `1px solid ${LINE}` }}>
            <button onClick={()=>setLegalDoc(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center",gap:6,color:G,fontWeight:700,fontSize:13,fontFamily:"inherit"}}><Ico d={ic.back} size={16} color={G}/> Close</button>
            <div style={{fontSize:13,fontWeight:800,color:INK}}>{LEGAL[legalDoc].title}</div>
            <div style={{width:50}}/>
          </header>
          <div style={{flex:1,padding:16,overflowY:"auto",lineHeight:1.6,fontSize:12,color:DIM}}>
            <div style={{fontSize:10,color:DIM,marginBottom:10,fontWeight:700}}>Updated: {LEGAL[legalDoc].updated}</div>
            <div>{LEGAL[legalDoc].body}</div>
          </div>
        </div>
      )}

      {/* Onboarding Tour card overlay */}
      {tourOn && (
        <>
          <div className="tour-overlay"/>
          <div className="tour-card" style={{top:tourY,bottom:"auto"}}>
            <div className="tour-prog"><div className="tour-prog-fill" style={{width:`${((tourStep+1)/TOUR.length)*100}%`}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:10,color:DIM,fontWeight:600}}>Step {tourStep+1} of {TOUR.length}</span>
              <button onClick={endTour} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Ico d={ic.x} size={14} color={DIM}/></button>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:8}}>
              <div style={{width:32,height:32,borderRadius:8,background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{TOUR[tourStep].emoji}</div>
              <div style={{fontSize:13,fontWeight:800,color:INK,lineHeight:1.3,alignSelf:"center"}}>{TOUR[tourStep].title}</div>
            </div>
            <p style={{fontSize:12,color:DIM,lineHeight:1.5,marginBottom:14}}>{TOUR[tourStep].desc}</p>
            <div style={{display:"flex",gap:6}}>
              {tourStep > 0 && <button onClick={tourPrev} className="btn-sm-outline" style={{flex:1}}>← Back</button>}
              <button onClick={tourNext} className="btn-sm" style={{flex:2,borderRadius:8,height:30}}>{tourStep===TOUR.length-1?"Finish 🎉":"Next →"}</button>
            </div>
          </div>
        </>
      )}

      {/* Reschedule Modal */}
      {bookingModal === "reschedule" && activeBooking && (
        <div className="modal-backdrop">
          <div className="modal-dialog fade">
            <div style={{fontSize:15,fontWeight:800,color:INK,marginBottom:2}}>Reschedule Appointment</div>
            <p style={{color:DIM,fontSize:12,marginBottom:14}}>{activeBooking.visitorName} — {activeBooking.service}</p>
            
            <label style={{color:DIM,fontSize:11,display:"block",marginBottom:4}}>New Date</label>
            <input type="date" value={bookingNewDate} onChange={e=>setBookingNewDate(e.target.value)} className="inp" style={{marginBottom:10}} />
            
            <label style={{color:DIM,fontSize:11,display:"block",marginBottom:4}}>New Time</label>
            <input type="time" value={bookingNewTime} onChange={e=>setBookingNewTime(e.target.value)} className="inp" style={{marginBottom:14}} />
            
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn-ghost" onClick={()=>setBookingModal(null)} style={{padding:"8px 14px",fontSize:12,width:"auto"}}>Cancel</button>
              <button className="btn-primary" disabled={!bookingNewDate || !bookingNewTime || bookingActing===activeBooking.bookingId}
                onClick={()=>doBookingAction(activeBooking.bookingId, "reschedule", { newDate: bookingNewDate, newTime: bookingNewTime })}
                style={{padding:"8px 14px",fontSize:12,width:"auto"}}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {bookingModal === "cancel" && activeBooking && (
        <div className="modal-backdrop">
          <div className="modal-dialog fade">
            <div style={{fontSize:15,fontWeight:800,color:INK,marginBottom:2}}>Cancel Appointment</div>
            <p style={{color:DIM,fontSize:12,marginBottom:12}}>{activeBooking.visitorName} — {activeBooking.date} at {activeBooking.time}</p>
            
            <label style={{color:DIM,fontSize:11,display:"block",marginBottom:4}}>Reason (sent to user)</label>
            <textarea value={bookingCancelReason} onChange={e=>setBookingCancelReason(e.target.value)} rows={2} className="inp" placeholder="Explain reasoning..." style={{marginBottom:14}} />
            
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn-ghost" onClick={()=>setBookingModal(null)} style={{padding:"8px 14px",fontSize:12,width:"auto"}}>Back</button>
              <button className="btn-danger" disabled={bookingActing===activeBooking.bookingId} onClick={()=>doBookingAction(activeBooking.bookingId, "cancel", { reason: bookingCancelReason })}
                style={{padding:"8px 14px",fontSize:12,width:"auto"}}>
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Booking Add Modal */}
      {bookingModal === "add" && (
        <div className="modal-backdrop" onClick={()=>setBookingModal(null)}>
          <div className="modal-dialog fade" onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:800,color:INK,marginBottom:12}}>Add Appointment</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input type="text" placeholder="Visitor Name" value={bookingAddForm.name} onChange={e=>setBookingAddForm(p=>({...p, name: e.target.value}))} className="inp" />
              <input type="email" placeholder="Visitor Email" value={bookingAddForm.email} onChange={e=>setBookingAddForm(p=>({...p, email: e.target.value}))} className="inp" />
              <input type="tel" placeholder="Visitor Phone" value={bookingAddForm.phone} onChange={e=>setBookingAddForm(p=>({...p, phone: e.target.value}))} className="inp" />
              <input type="text" placeholder="Service" value={bookingAddForm.service} onChange={e=>setBookingAddForm(p=>({...p, service: e.target.value}))} className="inp" />
              
              <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input type="date" value={bookingAddForm.date} onChange={e=>setBookingAddForm(p=>({...p, date: e.target.value}))} className="inp" />
                <input type="time" value={bookingAddForm.time} onChange={e=>setBookingAddForm(p=>({...p, time: e.target.value}))} className="inp" />
              </div>
              
              <textarea placeholder="Message details..." value={bookingAddForm.message} onChange={e=>setBookingAddForm(p=>({...p, message: e.target.value}))} rows={2} className="inp" />
              
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
                <button className="btn-ghost" onClick={()=>setBookingModal(null)} style={{padding:"8px 14px",fontSize:12,width:"auto"}}>Cancel</button>
                <button className="btn-primary" disabled={!bookingAddForm.name || !bookingAddForm.email || !bookingAddForm.service || !bookingAddForm.date || !bookingAddForm.time || bookingActing==="add"} onClick={addBookingManually}
                  style={{padding:"8px 14px",fontSize:12,width:"auto"}}>
                  Add Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Offboarding Modal */}
      {showSubModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog fade" style={{ maxWidth: 440 }}>
            <button onClick={() => setShowSubModal(false)} style={{ position:"absolute", top:10, right:10, background:"none", border:"none", color:DIM, cursor:"pointer" }}><Ico d={ic.x} size={16} color={DIM}/></button>
            
            {subStep === "reason" && (
              <>
                <div style={{ fontSize:15, fontWeight:800, color:INK, marginBottom:8 }}>Cancel Subscription</div>
                <p style={{ color:DIM, fontSize:12, marginBottom:12 }}>Please let us know why you are considering cancelling. Your feedback helps us improve.</p>
                <textarea value={cancelReason} onChange={e=>setCancelReason(e.target.value)} rows={3} className="inp" placeholder="Reason for cancellation..." style={{ marginBottom:14 }} />
                <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  <button className="btn-ghost" onClick={() => setShowSubModal(false)} style={{ padding:"8px 14px", fontSize:12, width:"auto" }}>Keep Plan</button>
                  <button className="btn-primary" disabled={!cancelReason.trim()} onClick={() => setSubStep("option")} style={{ padding:"8px 14px", fontSize:12, width:"auto" }}>Next →</button>
                </div>
              </>
            )}

            {subStep === "option" && (
              <>
                <div style={{ fontSize:15, fontWeight:800, color:INK, marginBottom:8 }}>Choose exit option</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                  {(isSocialOnly ? SOCIAL_CANCEL_OPTIONS : CANCEL_OPTIONS).map(opt => (
                    <button key={opt.id} onClick={() => { setCancelOption(opt); setSubStep("confirm"); }}
                      style={{ display:"block", width:"100%", textAlign:"left", background:BG, border:`1px solid ${LINE}`, borderRadius:10, padding:"12px 14px", cursor:"pointer", fontFamily:"inherit" }}>
                      <div style={{ fontWeight:700, fontSize:13, color:INK, marginBottom:2 }}>{opt.icon} {opt.label}</div>
                      <div style={{ fontSize:11, color:DIM, lineHeight:1.4 }}>{opt.desc}</div>
                      <div style={{ fontSize:11, fontWeight:700, color: opt.id === "remove" ? G : "#F59E0B", marginTop:6 }}>{opt.priceLabel(buildPrice)}</div>
                    </button>
                  ))}
                </div>
                <button className="btn-ghost" onClick={() => setSubStep("reason")} style={{ padding:"8px 14px", fontSize:12 }}>← Back</button>
              </>
            )}

            {subStep === "confirm" && cancelOption && (
              <>
                <div style={{ fontSize:15, fontWeight:800, color:INK, marginBottom:8 }}>Confirm offboarding choice</div>
                <div style={{ background:BG, border:`1px solid ${LINE}`, borderRadius:10, padding:12, marginBottom:12 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8 }}>
                    <span style={{ fontSize: 24 }}>{cancelOption.icon}</span>
                    <div style={{ fontSize:13, fontWeight:700, color:INK }}>{cancelOption.label}</div>
                  </div>
                  <div style={{ fontSize:11, color:DIM, marginBottom:8 }}>{cancelOption.desc}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", borderTop:`1px solid ${LINE}`, paddingTop:8, fontSize:12 }}>
                    <span style={{ color:DIM }}>Exit Fee:</span>
                    <span style={{ fontWeight:700, color: (cancelOption.id === "remove" || cancelOption.id === "social_remove") ? G : "#F59E0B" }}>
                      {cancelOption.priceCalc(buildPrice) === 0 ? "Free" : `$${cancelOption.priceCalc(buildPrice).toLocaleString()}`}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize:10, color:DIM, lineHeight:1.4, marginBottom:12 }}>
                  By submitting, you acknowledge that cancellation takes effect at the end of the billing period. Exit packages are billed via email.
                </div>
                <a className="btn-primary" style={{ textDecoration:"none", marginBottom:8 }}
                  href={`mailto:hello@webgecko.au?subject=${encodeURIComponent((cancelOption.id === "remove" || cancelOption.id === "social_remove" ? "Removal request" : cancelOption.id === "social_handover" ? "Social handover request" : "Cancellation") + " - " + client?.businessName + " - " + cancelOption.label)}&body=${encodeURIComponent("Hi WebGecko,\n\n" + (cancelOption.id === "social_handover" ? "I would like to proceed with the full social account handover." : cancelOption.id === "social_remove" ? "I would like to stop social media management. No handover required." : cancelOption.id === "remove" ? "I'd like to be removed from the system." : "I'd like to cancel.") + "\n\nBusiness: " + client?.businessName + "\nOption: " + cancelOption.label + "\nReason: " + cancelReason + (cancelOption.priceCalc(buildPrice) > 0 ? "\nFee: $" + cancelOption.priceCalc(buildPrice).toLocaleString() : "") + "\n\nI acknowledge the terms and conditions outlined in the cancellation flow.")}`}
                  onClick={() => setShowSubModal(false)}>
                  Confirm Request via Email
                </a>
                <button className="btn-ghost" onClick={() => setSubStep("option")} style={{ padding:"8px 14px", fontSize:12, width:"auto" }}>Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Terms acceptance modal for Quote & Pay */}
      {termsModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog fade" style={{ maxWidth: 460 }}>
            <button onClick={() => setTermsModalOpen(false)} style={{ position:"absolute", top:10, right:10, background:"none", border:"none", color:DIM, cursor:"pointer" }}><Ico d={ic.x} size={16} color={DIM}/></button>
            <div style={{ fontSize:16, fontWeight:800, color:INK, marginBottom:4 }}>Before you pay</div>
            <p style={{ color:DIM, fontSize:12, marginBottom:14, lineHeight:1.5 }}>Please read and accept all of the following agreements. You can view the full PDF for each at any time from the Legal Docs tab.</p>
            
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
              {[
                { key: "tos", title: "Terms & Conditions", ref: "WG-TNC-001" },
                { key: "privacy", title: "Privacy Policy", ref: "WG-PRV-001" },
                { key: "cancellation", title: "Cancellation & Refund Policy", ref: "WG-CAN-001" },
                { key: "agreement", title: "Social Media Agreement", ref: "WG-SOC-001" },
              ].map(doc => {
                const checked = termsChecked[doc.key as keyof typeof termsChecked];
                return (
                  <div key={doc.key} style={{ background: checked ? `${G}08` : BG, border: `1.5px solid ${checked ? G : LINE}`, borderRadius: 10, padding: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={checked} onChange={e => setTermsChecked(prev => ({ ...prev, [doc.key]: e.target.checked }))} style={{ marginTop: 2, accentColor: G, cursor: "pointer" }} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{doc.title}</span>
                        <span style={{ fontSize: 9, color: DIM, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: "1px 5px" }}>{doc.ref}</span>
                      </div>
                      <button onClick={() => setLegalDoc(doc.key)} style={{ background:"none", border:"none", color:G, fontSize:11, fontWeight:600, cursor:"pointer", padding:0, marginTop:4 }}>Read Document →</button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {Object.values(termsChecked).every(Boolean) ? (
              <button onClick={() => { setTermsAccepted(true); setTermsModalOpen(false); try { localStorage.setItem(`wg_terms_${slug}`, "accepted"); } catch {} }} className="btn-primary">
                ✓ Accept All & Continue to Payment
              </button>
            ) : (
              <button disabled className="btn-primary" style={{ opacity: 0.5 }}>
                Accept all documents to continue
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
