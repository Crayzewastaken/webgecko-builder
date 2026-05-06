"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface SeoData {
  lsiKeywords?: string[];
  metaDescription?: string;
  serpInsights?: { avgWordCount: number; avgH2Count: number; topHeadings: string[]; winningStructure: string } | null;
  projectTitle?: string;
}

interface ClientAnalytics {
  slug: string;
  jobId: string;
  businessName: string;
  industry: string;
  previewUrl: string;
  buildStatus: string;
  domain?: string;
  liveDomain?: string;
  liveUrl?: string;
  vercelProjectName?: string;
  paymentState: { depositPaid: boolean; finalPaid: boolean; monthlyActive: boolean };
  analytics: { thisMonth: { views: number; bookingClicks: number; contactClicks: number }; today: { views: number; bookingClicks: number }; totals: { views: number; bookingClicks: number; formSubmits: number } } | null;
  bookingCount: number;
  hasBooking: boolean;
  builtAt?: string;
  supersaasId?: string;
  supersaasUrl?: string;
  bookingServices?: string;
  clientEmail?: string;
  clientPhone?: string;
  tawktoPropertyId?: string;
  shopCatalogue?: any[] | null;
  userInput?: {
    features?: string[]; pages?: string[]; siteType?: string; style?: string;
    colorPrefs?: string; usp?: string; goal?: string; additionalNotes?: string;
    abn?: string; businessAddress?: string; facebookPage?: string;
    instagramUrl?: string; linkedinUrl?: string;
  };
  metadata?: {
    scheduledReleaseAt?: string; scheduledReleaseDays?: number;
    checklistCompletedAt?: string; alreadyReleased?: boolean;
    seo?: SeoData; domainStatus?: string; domainUrl?: string;
  };
}

const G = {
  page: { minHeight: "100vh", background: "#060608", color: "#e2e8f0", fontFamily: "'Inter',-apple-system,sans-serif" } as React.CSSProperties,
  card: { background: "#0c0d10", border: "1px solid #1c1e24", borderRadius: 14 } as React.CSSProperties,
  pill: (color: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 4, background: color + "18", color, border: `1px solid ${color}33`, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 600 }),
  statBox: (color: string): React.CSSProperties => ({ background: "#0c0d10", border: "1px solid #1c1e24", borderRadius: 10, padding: "14px 16px", minWidth: 100 }),
  btn: (color: string, fill = false): React.CSSProperties => ({ background: fill ? color : "transparent", color: fill ? "#000" : color, border: `1px solid ${color}55`, borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s" }),
  tab: (active: boolean): React.CSSProperties => ({ background: active ? "#1c1e24" : "transparent", color: active ? "#fff" : "#555", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }),
  label: { fontSize: 10, color: "#444", textTransform: "uppercase" as const, letterSpacing: ".07em", marginBottom: 3 },
  val: { fontSize: 13, color: "#cbd5e1", fontFamily: "monospace" as const },
  section: { marginBottom: 20 } as React.CSSProperties,
  sectionTitle: { fontSize: 11, color: "#444", textTransform: "uppercase" as const, letterSpacing: ".08em", fontWeight: 700, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #1c1e24" },
};

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={G.statBox(color)}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={G.label}>{label}</div>
      <div style={{ ...G.val, fontFamily: mono ? "monospace" : "inherit", color: "#cbd5e1" }}>{value}</div>
    </div>
  );
}

function ActionBtn({ label, color, confirm, onConfirm, fill = false }: { label: string; color: string; confirm: string; onConfirm: () => Promise<any>; fill?: boolean }) {
  const [state, setState] = useState<"idle" | "confirming" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  if (state === "ok") return <div style={{ fontSize: 12, color: "#00c896" }}>✓ {msg || "Done"}</div>;
  if (state === "err") return <div style={{ fontSize: 12, color: "#ef4444" }}>✗ {msg}</div>;
  if (state === "confirming") return (
    <div style={{ background: "#111", border: `1px solid ${color}33`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: "#94a3b8", marginBottom: 8 }}>{confirm}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button style={G.btn(color, true)} onClick={async () => {
          setState("loading");
          try { const r = await onConfirm(); setMsg(r?.message || "Done"); setState("ok"); }
          catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); setState("err"); }
        }}>Confirm</button>
        <button style={G.btn("#555")} onClick={() => setState("idle")}>Cancel</button>
      </div>
    </div>
  );
  return <button style={{ ...G.btn(color, fill), opacity: state === "loading" ? .5 : 1 }} onClick={() => setState("confirming")}>{state === "loading" ? "Running..." : label}</button>;
}

function ClientDashboard({ c, secret, onClose }: { c: ClientAnalytics; secret: string; onClose: () => void }) {
  const [tab, setTab] = useState<"overview" | "analytics" | "seo" | "site" | "payments" | "actions">("overview");
  const a = c.analytics;
  const seo = c.metadata?.seo;
  const ui = c.userInput || {};
  const jid = c.jobId;
  const sec = encodeURIComponent(secret);

  async function api(path: string, method = "GET", body?: any) {
    const res = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
    return data;
  }

  const statusColor = c.buildStatus === "completed" || c.buildStatus === "complete" ? "#00c896" : c.buildStatus === "building" ? "#f59e0b" : "#ef4444";

  const tabs = ["overview", "analytics", "seo", "site", "payments", "actions"] as const;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div style={{ ...G.card, width: "100%", maxWidth: 820, position: "relative" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1c1e24", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{c.businessName}</div>
            <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>{c.industry} &middot; {c.clientEmail} &middot; {c.clientPhone}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span style={G.pill(statusColor)}>{c.buildStatus || "pending"}</span>
              {c.paymentState?.monthlyActive && <span style={G.pill("#00c896")}>Monthly Active</span>}
              {c.paymentState?.finalPaid && !c.paymentState?.monthlyActive && <span style={G.pill("#3b82f6")}>Final Paid</span>}
              {c.paymentState?.depositPaid && !c.paymentState?.finalPaid && <span style={G.pill("#f59e0b")}>Deposit Paid</span>}
              {!c.paymentState?.depositPaid && <span style={G.pill("#6b7280")}>Unpaid</span>}
              {c.hasBooking && <span style={G.pill("#8b5cf6")}>Booking</span>}
              {c.metadata?.alreadyReleased && <span style={G.pill("#00c896")}>Released</span>}
              {(ui.features || []).map((f: string) => <span key={f} style={G.pill("#334155")}>{f}</span>)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "12px 24px", borderBottom: "1px solid #1c1e24", background: "#08090b" }}>
          {tabs.map(t => <button key={t} style={G.tab(tab === t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
        </div>

        <div style={{ padding: "24px" }}>

          {/* OVERVIEW */}
          {tab === "overview" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginBottom: 24 }}>
                <Stat label="Views This Month" value={a?.thisMonth.views ?? 0} color="#3b82f6" />
                <Stat label="Views Today" value={a?.today.views ?? 0} color="#00c896" />
                <Stat label="All-Time Views" value={a?.totals.views ?? 0} color="#6b7280" />
                <Stat label="Booking Clicks" value={a?.thisMonth.bookingClicks ?? 0} color="#f59e0b" />
                <Stat label="Total Bookings" value={c.bookingCount} color="#8b5cf6" />
                <Stat label="Form Submits" value={a?.totals.formSubmits ?? 0} color="#06b6d4" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={G.sectionTitle}>Client Info</div>
                  <InfoRow label="Email" value={c.clientEmail} />
                  <InfoRow label="Phone" value={c.clientPhone} />
                  <InfoRow label="ABN" value={ui.abn} />
                  <InfoRow label="Address" value={ui.businessAddress} />
                  <InfoRow label="Industry" value={c.industry} />
                  <InfoRow label="USP" value={ui.usp} />
                  <InfoRow label="Goal" value={ui.goal} />
                </div>
                <div>
                  <div style={G.sectionTitle}>Build Info</div>
                  <InfoRow label="Job ID" value={jid} mono />
                  <InfoRow label="Built At" value={c.builtAt ? new Date(c.builtAt).toLocaleString("en-AU") : undefined} />
                  <InfoRow label="Site Type" value={ui.siteType} />
                  <InfoRow label="Pages" value={(ui.pages || []).join(", ")} />
                  <InfoRow label="Style" value={ui.style} />
                  <InfoRow label="Colour Prefs" value={ui.colorPrefs} />
                  {c.metadata?.scheduledReleaseAt && <InfoRow label="Auto-Release" value={new Date(c.metadata.scheduledReleaseAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} />}
                  {c.metadata?.alreadyReleased && <InfoRow label="Released" value="Yes" />}
                </div>
              </div>

              {ui.additionalNotes && (
                <div style={{ marginTop: 16 }}>
                  <div style={G.sectionTitle}>Additional Notes</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, background: "#08090b", borderRadius: 8, padding: "10px 14px", whiteSpace: "pre-wrap" }}>{ui.additionalNotes}</div>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <div style={G.sectionTitle}>Social Links</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {ui.facebookPage && <a href={ui.facebookPage} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontSize: 12 }}>Facebook →</a>}
                  {ui.instagramUrl && <a href={ui.instagramUrl} target="_blank" rel="noreferrer" style={{ color: "#e879f9", fontSize: 12 }}>Instagram →</a>}
                  {ui.linkedinUrl && <a href={ui.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", fontSize: 12 }}>LinkedIn →</a>}
                  {!ui.facebookPage && !ui.instagramUrl && !ui.linkedinUrl && <span style={{ fontSize: 12, color: "#333" }}>None provided</span>}
                </div>
              </div>
            </>
          )}

          {/* ANALYTICS */}
          {tab === "analytics" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, marginBottom: 24 }}>
                <Stat label="Views Today" value={a?.today.views ?? 0} color="#00c896" />
                <Stat label="Booking Clicks Today" value={a?.today.bookingClicks ?? 0} color="#f59e0b" />
                <Stat label="Views This Month" value={a?.thisMonth.views ?? 0} color="#3b82f6" />
                <Stat label="Booking Clicks / Month" value={a?.thisMonth.bookingClicks ?? 0} color="#f59e0b" />
                <Stat label="Contact Clicks / Month" value={a?.thisMonth.contactClicks ?? 0} color="#06b6d4" />
                <Stat label="All-Time Views" value={a?.totals.views ?? 0} color="#6b7280" />
                <Stat label="All-Time Booking Clicks" value={a?.totals.bookingClicks ?? 0} color="#8b5cf6" />
                <Stat label="All-Time Form Submits" value={a?.totals.formSubmits ?? 0} color="#10b981" />
                <Stat label="Total Bookings" value={c.bookingCount} color="#8b5cf6" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a href={`/bookings?jobId=${jid}&secret=${secret}`} target="_blank" rel="noreferrer" style={{ ...G.btn("#8b5cf6"), textDecoration: "none" }}>View Bookings →</a>
                <button style={G.btn("#06b6d4")} onClick={() => api(`/api/analytics/monthly?jobId=${jid}&secret=${sec}&send=true`)}>Send Monthly Report</button>
              </div>
            </>
          )}

          {/* SEO */}
          {tab === "seo" && (
            <>
              {!seo && <div style={{ color: "#444", fontSize: 13 }}>No SEO data saved yet — this is populated on the next build.</div>}
              {seo && (
                <>
                  <div style={G.section}>
                    <div style={G.sectionTitle}>Meta Description</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", background: "#08090b", borderRadius: 8, padding: "10px 14px", lineHeight: 1.6 }}>{seo.metaDescription || "Not set"}</div>
                  </div>
                  <div style={G.section}>
                    <div style={G.sectionTitle}>LSI Keywords ({(seo.lsiKeywords || []).length})</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(seo.lsiKeywords || []).length === 0 && <span style={{ color: "#333", fontSize: 12 }}>None generated</span>}
                      {(seo.lsiKeywords || []).map((k: string, i: number) => (
                        <span key={i} style={{ background: "#0f1f2f", border: "1px solid #0ea5e933", color: "#0ea5e9", borderRadius: 20, padding: "2px 10px", fontSize: 11 }}>{k}</span>
                      ))}
                    </div>
                  </div>
                  {seo.serpInsights && (
                    <div style={G.section}>
                      <div style={G.sectionTitle}>SERP Intelligence</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                        <Stat label="Avg Word Count (competitors)" value={seo.serpInsights.avgWordCount} color="#f59e0b" />
                        <Stat label="Avg H2 Count (competitors)" value={seo.serpInsights.avgH2Count} color="#3b82f6" />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={G.label}>Winning Structure</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{seo.serpInsights.winningStructure}</div>
                      </div>
                      <div>
                        <div style={G.label}>Top Competitor Headings Used</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                          {(seo.serpInsights.topHeadings || []).map((h: string, i: number) => (
                            <div key={i} style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#334155", fontSize: 10, width: 16, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
                              {h}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ padding: "10px 14px", background: "#08090b", borderRadius: 8, fontSize: 12, color: "#334155" }}>
                    sitemap.xml and robots.txt are deployed automatically with every build.
                  </div>
                </>
              )}
            </>
          )}

          {/* SITE */}
          {tab === "site" && (
            <>
              <div style={G.section}>
                <div style={G.sectionTitle}>URLs</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {c.previewUrl && <a href={c.previewUrl} target="_blank" rel="noreferrer" style={{ ...G.btn("#00c896"), textDecoration: "none" }}>Preview Site →</a>}
                  {c.liveUrl && c.liveDomain && <a href={c.liveUrl} target="_blank" rel="noreferrer" style={{ ...G.btn("#00c896", true), textDecoration: "none" }}>Live Site →</a>}
                  <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer" style={{ ...G.btn("#6b7280"), textDecoration: "none" }}>Client Portal →</a>
                </div>
                <InfoRow label="Preview URL" value={c.previewUrl} mono />
                <InfoRow label="Desired Domain" value={c.domain} mono />
                {c.metadata?.domainStatus && <InfoRow label="Domain Status" value={c.metadata.domainStatus} />}
                {c.metadata?.domainUrl && <InfoRow label="Domain URL" value={c.metadata.domainUrl} mono />}
                <InfoRow label="Vercel Project" value={c.vercelProjectName} mono />
              </div>

              {c.hasBooking && (
                <div style={G.section}>
                  <div style={G.sectionTitle}>Booking System</div>
                  <InfoRow label="SuperSaas ID" value={c.supersaasId} mono />
                  <InfoRow label="SuperSaas URL" value={c.supersaasUrl} mono />
                  <InfoRow label="Services" value={c.bookingServices} />
                  {c.supersaasUrl && <a href={c.supersaasUrl} target="_blank" rel="noreferrer" style={{ ...G.btn("#8b5cf6"), textDecoration: "none", display: "inline-block", marginTop: 8 }}>Open SuperSaas →</a>}
                </div>
              )}

              {c.tawktoPropertyId && (
                <div style={G.section}>
                  <div style={G.sectionTitle}>Live Chat (Tawk.to)</div>
                  <InfoRow label="Property ID" value={c.tawktoPropertyId} mono />
                  <a href="https://dashboard.tawk.to" target="_blank" rel="noreferrer" style={{ ...G.btn("#10b981"), textDecoration: "none", display: "inline-block", marginTop: 8 }}>Open Tawk.to →</a>
                </div>
              )}

              {c.shopCatalogue && c.shopCatalogue.length > 0 && (
                <div style={G.section}>
                  <div style={G.sectionTitle}>Shop Products ({c.shopCatalogue.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {c.shopCatalogue.map((item: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#08090b", borderRadius: 8, padding: "8px 12px" }}>
                        <div>
                          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: "#444", fontFamily: "monospace" }}>{item.variationId || "no Square ID"}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, color: "#10b981", fontWeight: 700 }}>${(item.priceCents / 100).toFixed(2)}</div>
                          {item.paymentLinkUrl && <a href={item.paymentLinkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#3b82f6" }}>Payment link →</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* PAYMENTS */}
          {tab === "payments" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 24 }}>
                <Stat label="Deposit" value={c.paymentState?.depositPaid ? "Paid" : "Unpaid"} color={c.paymentState?.depositPaid ? "#00c896" : "#ef4444"} />
                <Stat label="Final Payment" value={c.paymentState?.finalPaid ? "Paid" : "Pending"} color={c.paymentState?.finalPaid ? "#00c896" : "#f59e0b"} />
                <Stat label="Monthly" value={c.paymentState?.monthlyActive ? "Active" : "Inactive"} color={c.paymentState?.monthlyActive ? "#00c896" : "#6b7280"} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ActionBtn label="Unlock Final Payment" color="#f59e0b" confirm="Unlock final payment? Client will be emailed to pay remaining balance." onConfirm={() => api(`/api/payment/unlock?jobId=${jid}&secret=${sec}`)} />
              </div>
            </>
          )}

          {/* ACTIONS */}
          {tab === "actions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "#08090b", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#00c896", marginBottom: 6 }}>Release Preview</div>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>Email the client their portal link to review the site.</div>
                  <ActionBtn label="Release Preview →" color="#00c896" confirm={`Release preview to ${c.businessName}? This emails the client.`} onConfirm={() => api(`/api/unlock/release?jobId=${jid}&secret=${sec}`)} />
                </div>
                <div style={{ background: "#08090b", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", marginBottom: 6 }}>Fix Site</div>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>Run a code fix pass and redeploy. Takes 1-2 min.</div>
                  <ActionBtn label="Fix This Site" color="#3b82f6" confirm="Run a fix pass on this site?" onConfirm={() => api(`/api/admin/fix-proxy?jobId=${jid}&secret=${sec}`)} />
                </div>
                <div style={{ background: "#08090b", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f97316", marginBottom: 6 }}>Rebuild Site</div>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>Full rebuild from scratch. 5-10 minutes.</div>
                  <ActionBtn label="Rebuild Site" color="#f97316" confirm={`Fully rebuild ${c.businessName} from scratch?`} onConfirm={() => api(`/api/pipeline/run?jobId=${jid}&secret=${sec}`)} />
                </div>
                <div style={{ background: "#08090b", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6", marginBottom: 6 }}>Unlock Booking</div>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>Enable the booking system for this client.</div>
                  <ActionBtn label="Unlock Booking" color="#8b5cf6" confirm={`Enable booking system for ${c.businessName}?`} onConfirm={() => api(`/api/unlock/booking?jobId=${jid}&secret=${sec}`)} />
                </div>
                <div style={{ background: "#08090b", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#06b6d4", marginBottom: 6 }}>Monthly Report</div>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>Email this month's analytics to the client.</div>
                  <ActionBtn label="Send Report" color="#06b6d4" confirm="Send monthly analytics report?" onConfirm={() => api(`/api/analytics/monthly?jobId=${jid}&secret=${sec}&send=true`)} />
                </div>
                <div style={{ background: "#08090b", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6", marginBottom: 6 }}>Reset Password</div>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>Generate a new portal login password.</div>
                  <ActionBtn label="Reset Password" color="#8b5cf6" confirm="Generate a new password?" onConfirm={async () => {
                    const d = await api(`/api/admin/reset-password?secret=${sec}`, "POST", { slug: c.slug });
                    alert(`New password for ${c.businessName}:\n\n${d.password}\n\nShare with client.`);
                    return d;
                  }} />
                </div>
              </div>
              <div style={{ background: "#180808", border: "1px solid #ef444433", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>Danger Zone</div>
                <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>Permanently delete this client and all their data.</div>
                <ActionBtn label="Delete Client" color="#ef4444" confirm={`PERMANENTLY delete ${c.businessName}? Cannot be undone.`} onConfirm={async () => {
                  await api(`/api/admin/delete-client?jobId=${jid}&slug=${c.slug}&secret=${sec}`, "DELETE");
                  window.location.reload();
                }} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function ClientRow({ c, secret }: { c: ClientAnalytics; secret: string }) {
  const [open, setOpen] = useState(false);
  const statusColor = c.buildStatus === "completed" || c.buildStatus === "complete" ? "#00c896" : c.buildStatus === "building" ? "#f59e0b" : "#6b7280";
  const a = c.analytics;
  return (
    <>
      {open && <ClientDashboard c={c} secret={secret} onClose={() => setOpen(false)} />}
      <div
        onClick={() => setOpen(true)}
        style={{ ...G.card, padding: "14px 18px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", transition: "border-color .15s" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#2a2d35")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#1c1e24")}
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{c.businessName}</div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{c.industry}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={G.pill(statusColor)}>{c.buildStatus || "pending"}</span>
          {c.paymentState?.monthlyActive && <span style={G.pill("#00c896")}>Monthly</span>}
          {c.paymentState?.depositPaid && !c.paymentState?.monthlyActive && <span style={G.pill("#f59e0b")}>Deposit</span>}
          {!c.paymentState?.depositPaid && <span style={G.pill("#6b7280")}>Unpaid</span>}
          {c.hasBooking && <span style={G.pill("#8b5cf6")}>Booking</span>}
          {c.metadata?.alreadyReleased && <span style={G.pill("#10b981")}>Released</span>}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#444", flexWrap: "wrap" }}>
          <span>👁 {a?.thisMonth.views ?? 0}</span>
          <span>📅 {c.bookingCount}</span>
          <span>📝 {a?.totals.formSubmits ?? 0}</span>
        </div>
        <div style={{ color: "#334155", fontSize: 16 }}>›</div>
      </div>
    </>
  );
}

function AdminDashboard() {
  const searchParams = useSearchParams();
  const urlSecret = searchParams.get("secret") || "";
  const [secret, setSecret] = useState<string>(() => {
    if (urlSecret) return urlSecret;
    if (typeof window !== "undefined") return sessionStorage.getItem("wg_admin_secret") || "";
    return "";
  });
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggedIn, setLoggedIn] = useState(!!urlSecret || (typeof window !== "undefined" && !!sessionStorage.getItem("wg_admin_secret")));
  const [clients, setClients] = useState<ClientAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "building" | "unpaid">("all");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = loginInput.trim();
    if (!trimmed) { setLoginError("Enter the admin password."); return; }
    const res = await fetch(`/api/admin/clients?secret=${encodeURIComponent(trimmed)}`);
    if (res.status === 403) { setLoginError("Incorrect password."); return; }
    sessionStorage.setItem("wg_admin_secret", trimmed);
    setSecret(trimmed); setLoggedIn(true);
  }

  function handleLogout() {
    sessionStorage.removeItem("wg_admin_secret");
    setLoggedIn(false); setSecret(""); setLoginInput(""); setClients([]);
  }

  useEffect(() => { if (!loggedIn || !secret) return; loadDashboard(); }, [loggedIn, secret]);

  async function loadDashboard() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/clients?secret=" + encodeURIComponent(secret));
      if (res.status === 403) { handleLogout(); return; }
      if (!res.ok) throw new Error("Failed to load clients");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }

  if (!loggedIn) return (
    <div style={{ ...G.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleLogin} style={{ ...G.card, padding: "40px 36px", width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>WebGecko Admin</div>
        <div style={{ fontSize: 13, color: "#444", marginBottom: 28 }}>Enter your admin password to continue.</div>
        <input type="password" placeholder="Admin password" value={loginInput} onChange={e => setLoginInput(e.target.value)} autoFocus
          style={{ width: "100%", background: "#111", border: "1px solid " + (loginError ? "#ef4444" : "#1c1e24"), borderRadius: 8, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
        {loginError && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{loginError}</div>}
        <button type="submit" style={{ width: "100%", background: "#00c896", color: "#000", fontWeight: 700, fontSize: 14, padding: 12, border: "none", borderRadius: 8, cursor: "pointer" }}>Sign In →</button>
      </form>
    </div>
  );

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.businessName.toLowerCase().includes(search.toLowerCase()) || c.industry?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ? true : filter === "active" ? c.paymentState?.monthlyActive : filter === "building" ? c.buildStatus === "building" : !c.paymentState?.depositPaid;
    return matchSearch && matchFilter;
  });

  const totals = {
    clients: clients.length,
    active: clients.filter(c => c.paymentState?.monthlyActive).length,
    views: clients.reduce((a, c) => a + (c.analytics?.thisMonth.views || 0), 0),
    bookings: clients.reduce((a, c) => a + c.bookingCount, 0),
    mrr: clients.filter(c => c.paymentState?.monthlyActive).length * 109,
  };

  return (
    <div style={{ ...G.page, padding: "24px 16px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>WebGecko Admin</div>
            <div style={{ color: "#444", fontSize: 13 }}>Client Management</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={loadDashboard} style={G.btn("#555")}>Refresh</button>
            <button onClick={handleLogout} style={G.btn("#555")}>Sign Out</button>
          </div>
        </div>

        {!loading && !error && (
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Total Clients", value: totals.clients, color: "#fff" },
              { label: "Monthly Active", value: totals.active, color: "#00c896" },
              { label: "Est. MRR", value: "$" + totals.mrr.toLocaleString(), color: "#00c896" },
              { label: "Views This Month", value: totals.views.toLocaleString(), color: "#3b82f6" },
              { label: "Total Bookings", value: totals.bookings, color: "#f59e0b" },
            ].map(st => (
              <div key={st.label} style={{ ...G.card, padding: "14px 18px", flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: st.color }}>{st.value}</div>
                <div style={{ fontSize: 10, color: "#333", marginTop: 2 }}>{st.label}</div>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ background: "#180808", border: "1px solid #ef444433", borderRadius: 10, padding: 14, color: "#ef4444", marginBottom: 20 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, background: "#0c0d10", border: "1px solid #1c1e24", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} />
          <div style={{ display: "flex", gap: 4, background: "#0c0d10", border: "1px solid #1c1e24", borderRadius: 8, padding: 4 }}>
            {(["all", "active", "building", "unpaid"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={G.tab(filter === f)}>{f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
        </div>

        {loading && <div style={{ color: "#333", textAlign: "center", padding: 60 }}>Loading clients...</div>}
        {!loading && filtered.map(c => <ClientRow key={c.slug} c={c} secret={secret} />)}
        {!loading && filtered.length === 0 && <div style={{ color: "#333", textAlign: "center", padding: 60, fontSize: 14 }}>No clients found.</div>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ color: "#333", padding: 40 }}>Loading...</div>}>
      <AdminDashboard />
    </Suspense>
  );
}
