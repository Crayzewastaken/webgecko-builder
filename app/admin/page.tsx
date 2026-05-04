"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
  paymentState: {
    depositPaid: boolean;
    finalPaid: boolean;
    monthlyActive: boolean;
  };
  analytics: {
    thisMonth: { views: number; bookingClicks: number; contactClicks: number };
    today: { views: number; bookingClicks: number };
    totals: { views: number; bookingClicks: number; formSubmits: number };
  } | null;
  bookingCount: number;
  hasBooking: boolean;
  builtAt?: string;
  supersaasId?: string;
  supersaasUrl?: string;
  bookingServices?: string;
  clientEmail?: string;
  clientPhone?: string;
  metadata?: {
    scheduledReleaseAt?: string;
    scheduledReleaseDays?: number;
    checklistCompletedAt?: string;
    alreadyReleased?: boolean;
  };
}

type ActionKey = "release" | "fix" | "unlockPayment" | "unlockBooking" | "sendReport" | "delete" | "rebuild" | "resetPassword" | "activate";

interface ActionState {
  confirming: ActionKey | null;
  loading: ActionKey | null;
  result: { key: ActionKey; success: boolean; message: string } | null;
}

function ConfirmButton({
  actionKey,
  label,
  confirmLabel,
  confirmMessage,
  color,
  onConfirm,
  state,
  setState,
}: {
  actionKey: ActionKey;
  label: string;
  confirmLabel: string;
  confirmMessage: string;
  color: string;
  onConfirm: () => Promise<void>;
  state: ActionState;
  setState: (s: ActionState) => void;
}) {
  const isConfirming = state.confirming === actionKey;
  const isLoading = state.loading === actionKey;
  const result = state.result?.key === actionKey ? state.result : null;

  if (result) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "6px",
        background: result.success ? "rgba(0,200,150,0.1)" : "rgba(239,68,68,0.1)",
        border: `1px solid ${result.success ? "#00c89633" : "#ef444433"}`,
        borderRadius: "8px", padding: "7px 12px", fontSize: "12px",
        color: result.success ? "#00c896" : "#ef4444",
      }}>
        {result.success ? "✓" : "✗"} {result.message}
        <button
          onClick={() => setState({ ...state, result: null })}
          style={{ marginLeft: "4px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "14px", lineHeight: 1 }}
        >×</button>
      </div>
    );
  }

  if (isConfirming) {
    return (
      <div style={{
        background: "#111", border: `1px solid ${color}44`, borderRadius: "10px",
        padding: "10px 12px", fontSize: "12px",
      }}>
        <div style={{ color: "#ccc", marginBottom: "8px" }}>{confirmMessage}</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            disabled={isLoading}
            onClick={async () => {
              setState({ ...state, loading: actionKey, confirming: null });
              try {
                await onConfirm();
                setState({ confirming: null, loading: null, result: { key: actionKey, success: true, message: `${confirmLabel} done` } });
              } catch (e) {
                setState({ confirming: null, loading: null, result: { key: actionKey, success: false, message: e instanceof Error ? e.message : "Failed" } });
              }
            }}
            style={{
              background: color, color: "#000", border: "none", borderRadius: "6px",
              padding: "5px 10px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
            }}
          >
            {isLoading ? "Running…" : `✓ ${confirmLabel}`}
          </button>
          <button
            onClick={() => setState({ ...state, confirming: null })}
            style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setState({ ...state, confirming: actionKey, result: null })}
      style={{
        background: "#111", border: `1px solid #222`, color,
        borderRadius: "8px", padding: "7px 12px", fontSize: "12px",
        fontWeight: 600, cursor: "pointer", transition: "border-color .15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color + "66")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#222")}
    >
      {label}
    </button>
  );
}

function GoLiveButton({ c, secret }: { c: ClientAnalytics; secret: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function assignDomain() {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/assign-domain?jobId=${c.jobId}&domain=${encodeURIComponent(c.domain!)}&secret=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setState("done");
      setMsg(`Assigned! DNS: point ${c.domain} A record to 76.76.21.21`);
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  if (state === "done") return <div style={{ marginTop: "8px", color: "#00c896", fontSize: "11px" }}>Done — {msg}</div>;
  if (state === "error") return <div style={{ marginTop: "8px", color: "#ef4444", fontSize: "11px" }}>{msg}</div>;

  return (
    <button
      onClick={assignDomain}
      disabled={state === "loading"}
      style={{ marginTop: "8px", background: "#0a2a1a", border: "1px solid #00c89644", color: "#00c896", borderRadius: "6px", padding: "5px 12px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
    >
      {state === "loading" ? "Assigning..." : `Assign ${c.domain} to Vercel`}
    </button>
  );
}

function SuperSaasChecklist({ client: c, secret, onActivated }: { client: ClientAnalytics; secret: string; onActivated: () => void }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const scheduleName = c.businessName?.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) || "schedule";

  // Parse booking services into formatted list
  const servicesRaw = c.bookingServices || "";
  const servicesFormatted: string[] = servicesRaw
    ? servicesRaw.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean)
    : [];

  // Build checklist steps
  const stepOffset = servicesFormatted.length > 0 ? 1 : 0;
  const items = [
    {
      key: "schedule",
      required: true,
      autoCompleted: !!c.supersaasId,
      label: c.supersaasId
        ? `\u2705 Schedule auto-created: "${scheduleName}" (ID: ${c.supersaasId})`
        : `Step 1 \u2014 Create schedule named exactly: "${scheduleName}"`,
      detail: c.supersaasId ? null : "Dashboard \u2192 New Schedule \u2192 set name \u2192 Save",
    },
    {
      key: "hours",
      required: true,
      autoCompleted: false,
      label: "Step 2 \u2014 Set available hours & days",
      detail: `Configure \u2192 Availability \u2192 set the days/times ${c.businessName} takes bookings`,
    },
    {
      key: "duration",
      required: true,
      autoCompleted: false,
      label: "Step 3 \u2014 Set slot duration & advance booking limit",
      detail: "Configure \u2192 Preferences \u2192 slot duration (e.g. 60 min), how far ahead clients can book",
    },
    ...(servicesFormatted.length > 0 ? [{
      key: "services",
      required: true,
      autoCompleted: false,
      label: "Step 4 \u2014 Add services as a drop-down field on the booking form",
      detail: "Configure \u2192 Form \u2192 Add field \u2192 Drop-down list \u2192 name it \"Service\" \u2192 add the service options listed above",
    }] : []),
    {
      key: "notifications",
      required: true,
      autoCompleted: false,
      label: `Step ${4 + stepOffset} \u2014 Set notification email`,
      detail: `Configure \u2192 Notifications \u2192 set confirmation email to: ${c.clientEmail || "client email"}`,
    },
    {
      key: "phone",
      required: false,
      autoCompleted: false,
      label: `Step ${5 + stepOffset} \u2014 (Optional) Add SMS notifications`,
      detail: `Configure \u2192 Notifications \u2192 SMS \u2192 enter ${c.clientPhone || "client phone"} \u2014 requires SMS gateway in SuperSaas account settings`,
    },
    {
      key: "privacy",
      required: true,
      autoCompleted: false,
      label: `Step ${6 + stepOffset} \u2014 Set booking visibility`,
      detail: "Configure \u2192 Access Control \u2192 set to 'Show availability only'",
    },
    {
      key: "tested",
      required: true,
      autoCompleted: false,
      label: `Step ${7 + stepOffset} \u2014 Test a booking end-to-end`,
      detail: "Open the live site, click Book Now, complete a test booking, confirm notification arrives",
    },
  ];

  const effectiveChecked: Record<string, boolean> = { ...checked };
  items.forEach(item => { if (item.autoCompleted) effectiveChecked[item.key] = true; });

  const allRequiredDone = items.filter(i => i.required).every(i => effectiveChecked[i.key]);

  async function handleActivate() {
    setActivating(true);
    try {
      const res = await fetch(`/api/admin/activate?jobId=${c.jobId}&secret=${secret}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: data.message });
        setTimeout(onActivated, 3000);
      } else {
        setResult({ ok: false, message: data.error || "Activation failed" });
      }
    } catch (e) {
      setResult({ ok: false, message: "Network error" });
    } finally {
      setActivating(false);
    }
  }

  return (
    <div style={{ background: "#1a0e00", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: ".06em" }}>
          📅 SuperSaas Setup Checklist
        </div>
        <a href="https://www.supersaas.com/dashboard" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#fbbf24", textDecoration: "none", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 5, padding: "4px 10px" }}>
          Open SuperSaas \u2192
        </a>
      </div>

      {servicesFormatted.length > 0 && (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 7, padding: "10px 12px", marginBottom: 12, fontSize: 12 }}>
          <div style={{ color: "#fbbf24", fontWeight: 600, marginBottom: 6 }}>Booking Services to configure:</div>
          {servicesFormatted.map((s: string, i: number) => (
            <div key={i} style={{ color: "#e2e8f0", lineHeight: 1.7, fontFamily: "monospace" }}>{s}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {items.map(item => (
          <label key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: item.autoCompleted ? "default" : "pointer" }}>
            <input
              type="checkbox"
              checked={!!effectiveChecked[item.key]}
              disabled={item.autoCompleted}
              onChange={e => !item.autoCompleted && setChecked(prev => ({ ...prev, [item.key]: e.target.checked }))}
              style={{ marginTop: 3, accentColor: "#00c896", width: 14, height: 14, flexShrink: 0 }}
            />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: effectiveChecked[item.key] ? "#4a5568" : "#cbd5e1", textDecoration: effectiveChecked[item.key] ? "line-through" : "none" }}>
                  {item.label}
                </span>
                {!item.required && (
                  <span style={{ fontSize: 10, color: "#6b7280", background: "rgba(107,114,128,0.15)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>optional</span>
                )}
              </div>
              {item.detail && !effectiveChecked[item.key] && (
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 1.5 }}>{item.detail}</div>
              )}
            </div>
          </label>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {allRequiredDone && !result && (
          <button
            onClick={handleActivate}
            disabled={activating}
            style={{ fontSize: 13, fontWeight: 700, color: "#000", background: activating ? "#555" : "#00c896", border: "none", borderRadius: 8, padding: "8px 18px", cursor: activating ? "not-allowed" : "pointer" }}>
            {activating ? "Activating..." : "\u2705 Activate & Launch"}
          </button>
        )}
        {!allRequiredDone && (
          <span style={{ fontSize: 11, color: "#6b7280" }}>Complete all required steps to activate</span>
        )}
        {result && (
          <div style={{ fontSize: 12, color: result.ok ? "#00c896" : "#ef4444", flex: 1 }}>
            {result.ok ? "\u2713" : "\u2717"} {result.message}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientCard({ c, secret }: { c: ClientAnalytics; secret: string }) {
  const [actionState, setActionState] = useState<ActionState>({ confirming: null, loading: null, result: null });

  const a = c.analytics;
  const statusColor = c.buildStatus === "complete" ? "#00c896" : c.buildStatus === "building" ? "#f59e0b" : "#ef4444";
  const payBadge: [string, string] = c.paymentState?.monthlyActive
    ? ["#00c896", "Monthly Active"]
    : c.paymentState?.finalPaid
    ? ["#3b82f6", "Final Paid"]
    : c.paymentState?.depositPaid
    ? ["#f59e0b", "Deposit Paid"]
    : ["#6b7280", "Unpaid"];

  const badge = (color: string, text: string) => (
    <span style={{
      display: "inline-block", background: `${color}18`, color,
      border: `1px solid ${color}33`, borderRadius: "20px", padding: "2px 8px",
      fontSize: "11px", fontWeight: 600,
    }}>{text}</span>
  );

  async function callApi(path: string) {
    const res = await fetch(path);
    const contentType = res.headers.get("content-type") || "";
    let data: any = {};
    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => ({}));
    } else {
      await res.text();
    }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  const sec = encodeURIComponent(secret);
  const jid = c.jobId;

  return (
    <div style={{
      background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "14px",
      padding: "20px", marginBottom: "12px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", gap: "8px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>{c.businessName}</div>
          <div style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>
            {c.industry} &middot; /c/{c.slug} &middot; job: {jid}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {badge(statusColor, c.buildStatus || "pending")}
          {badge(payBadge[0], payBadge[1])}
          {c.hasBooking && badge("#8b5cf6", "Bookings On")}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: "8px", marginBottom: "16px" }}>
        {[
          { label: "This Month Views", value: a?.thisMonth.views ?? 0, color: "#3b82f6" },
          { label: "Today Views", value: a?.today.views ?? 0, color: "#00c896" },
          { label: "Booking Clicks", value: a?.thisMonth.bookingClicks ?? 0, color: "#f59e0b" },
          { label: "Total Bookings", value: c.bookingCount, color: "#8b5cf6" },
          { label: "Form Submits", value: a?.totals.formSubmits ?? 0, color: "#06b6d4" },
          { label: "All-Time Views", value: a?.totals.views ?? 0, color: "#6b7280" },
        ].map(st => (
          <div key={st.label} style={{ background: "#111", borderRadius: "8px", padding: "10px 12px" }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: st.color }}>{st.value.toLocaleString()}</div>
            <div style={{ fontSize: "10px", color: "#444", marginTop: "2px" }}>{st.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
        {c.previewUrl && (
          <a href={c.previewUrl} target="_blank" rel="noreferrer"
            style={{ background: "#111", border: "1px solid #00c89633", color: "#00c896", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", textDecoration: "none", fontWeight: 600 }}>
            Test Site
          </a>
        )}
        {c.liveUrl && (
          <a href={c.liveUrl} target="_blank" rel="noreferrer"
            style={{ background: "#0a2a1a", border: "1px solid #00c89666", color: "#00c896", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", textDecoration: "none", fontWeight: 700 }}>
            Live Site
          </a>
        )}
        <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer"
          style={{ background: "#111", border: "1px solid #222", color: "#888", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", textDecoration: "none" }}>
          Client Portal
        </a>
        <a href={`/bookings?jobId=${jid}&secret=${secret}`} target="_blank" rel="noreferrer"
          style={{ background: "#111", border: "1px solid #222", color: "#888", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", textDecoration: "none" }}>
          View Bookings
        </a>
      </div>

      {/* Domain info row */}
      {(c.domain || c.liveDomain || c.previewUrl) && (
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "12px" }}>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {c.previewUrl && (
              <div>
                <div style={{ color: "#444", fontSize: "10px", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "2px" }}>Test URL</div>
                <span style={{ color: "#6b7280", fontFamily: "monospace" }}>{c.previewUrl.replace("https://", "")}</span>
              </div>
            )}
            {c.domain && !c.liveDomain && (
              <div>
                <div style={{ color: "#444", fontSize: "10px", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "2px" }}>Desired Domain</div>
                <span style={{ color: "#f59e0b", fontFamily: "monospace" }}>{c.domain}</span>
              </div>
            )}
            {c.liveDomain && (
              <div>
                <div style={{ color: "#444", fontSize: "10px", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "2px" }}>Live Domain</div>
                <span style={{ color: "#00c896", fontFamily: "monospace" }}>{c.liveDomain}</span>
              </div>
            )}
          </div>
          {c.domain && !c.liveDomain && c.vercelProjectName && (
            <GoLiveButton c={c} secret={secret} />
          )}
        </div>
      )}

      <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "14px" }} />

      {/* SuperSaas setup checklist — shown when booking enabled and not yet activated */}
      {c.hasBooking && !c.metadata?.checklistCompletedAt && (
        <SuperSaasChecklist
          client={c}
          secret={sec}
          onActivated={() => window.location.reload()}
        />
      )}

      {/* Scheduled release badge */}
      {c.metadata?.scheduledReleaseAt && !c.metadata?.alreadyReleased && (
        <div style={{ background: "#0a1628", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#00c896" }}>
          🕐 Auto-releases to client on <strong>{new Date(c.metadata.scheduledReleaseAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</strong>
          {" "}({c.metadata.scheduledReleaseDays} days from activation)
        </div>
      )}
      {c.metadata?.alreadyReleased && (
        <div style={{ background: "#0a1a0a", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#00c896" }}>
          ✅ Released to client
        </div>
      )}

      <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "14px" }} />

      <div style={{ fontSize: "11px", color: "#333", marginBottom: "8px", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>Actions</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-start" }}>

        <ConfirmButton
          actionKey="release"
          label="Release Preview"
          confirmLabel="Release"
          confirmMessage={`Release preview to ${c.businessName}? This emails the client their portal link.`}
          color="#00c896"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/unlock/release?jobId=${jid}&secret=${sec}`)}
        />

        <ConfirmButton
          actionKey="unlockBooking"
          label="Unlock Booking"
          confirmLabel="Unlock"
          confirmMessage={`Enable booking system for ${c.businessName}?`}
          color="#8b5cf6"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/unlock/booking?jobId=${jid}&secret=${sec}`)}
        />

        <ConfirmButton
          actionKey="unlockPayment"
          label="Unlock Final Payment"
          confirmLabel="Unlock"
          confirmMessage="Unlock final payment for this client? They will be emailed to pay the remaining balance."
          color="#f59e0b"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/payment/unlock?jobId=${jid}&secret=${sec}`)}
        />

        <ConfirmButton
          actionKey="fix"
          label="Fix This Site"
          confirmLabel="Run Fix"
          confirmMessage="Run a code fix pass on this site? Takes 1-2 minutes and redeploys."
          color="#3b82f6"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/admin/fix-proxy?jobId=${jid}&secret=${sec}`)}
        />

        <ConfirmButton
          actionKey="rebuild"
          label="🔄 Rebuild Site"
          confirmLabel="Rebuild"
          confirmMessage={`Rerun the full build pipeline for ${c.businessName}? This re-generates the site from scratch using all three brains. Takes 5-10 min.`}
          color="#f97316"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/pipeline/run?jobId=${jid}&secret=${sec}`)}
        />

        <ConfirmButton
          actionKey="sendReport"
          label="Send Monthly Report"
          confirmLabel="Send"
          confirmMessage="Send this month's analytics report to this client?"
          color="#06b6d4"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/analytics/monthly?jobId=${jid}&secret=${sec}&send=true`)}
        />

        <ConfirmButton
          actionKey="resetPassword"
          label="🔑 Reset Password"
          confirmLabel="Reset"
          confirmMessage={`Generate a new login password for ${c.businessName}? The new password will be shown once.`}
          color="#8b5cf6"
          state={actionState}
          setState={setActionState}
          onConfirm={async () => {
            const res = await fetch(`/api/admin/reset-password?secret=${sec}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug: c.slug }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
            alert(`New password for ${c.businessName}:\n\n${(data as any).password}\n\nShare this with the client.`);
          }}
        />

        <ConfirmButton
          actionKey="delete"
          label="Delete Client"
          confirmLabel="Delete Forever"
          confirmMessage={`PERMANENTLY delete ${c.businessName} and all their data? This cannot be undone.`}
          color="#ef4444"
          state={actionState}
          setState={setActionState}
          onConfirm={async () => {
            const res = await fetch(`/api/admin/delete-client?jobId=${jid}&slug=${c.slug}&secret=${sec}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
            window.location.reload();
          }}
        />
      </div>
    </div>
  );
}

function AdminDashboard() {
  const searchParams = useSearchParams();
  const secret = searchParams.get("secret") || "";

  const [clients, setClients] = useState<ClientAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "building" | "unpaid">("all");

  useEffect(() => {
    if (!secret) { setError("Missing secret. Add ?secret=YOUR_PROCESS_SECRET to the URL."); setLoading(false); return; }
    loadDashboard();
  }, [secret]);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/clients?secret=${encodeURIComponent(secret)}`);
      if (!res.ok) throw new Error("Forbidden — check your secret");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.businessName.toLowerCase().includes(search.toLowerCase()) || c.industry?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true :
      filter === "active" ? c.paymentState?.monthlyActive :
      filter === "building" ? c.buildStatus === "building" :
      filter === "unpaid" ? !c.paymentState?.depositPaid : true;
    return matchSearch && matchFilter;
  });

  const totals = {
    clients: clients.length,
    active: clients.filter(c => c.paymentState?.monthlyActive).length,
    views: clients.reduce((a, c) => a + (c.analytics?.thisMonth.views || 0), 0),
    bookings: clients.reduce((a, c) => a + c.bookingCount, 0),
    revenue: clients.filter(c => c.paymentState?.monthlyActive).length * 149,
  };

  const s = {
    page: { minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'Inter',-apple-system,sans-serif", padding: "24px 16px" } as React.CSSProperties,
    statBox: { background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "16px", flex: 1, minWidth: "120px" } as React.CSSProperties,
    input: { background: "#111", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
    filterBtn: (active: boolean): React.CSSProperties => ({
      background: active ? "#1a1a1a" : "transparent", color: active ? "#fff" : "#444",
      border: "1px solid " + (active ? "#333" : "transparent"), borderRadius: "6px",
      padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontWeight: active ? 600 : 400,
    }),
  };

  return (
    <div style={s.page}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800 }}>WebGecko Admin</div>
            <div style={{ color: "#555", fontSize: "13px" }}>Client Management &amp; Analytics</div>
          </div>
          <button onClick={loadDashboard} style={{ marginLeft: "auto", background: "#111", border: "1px solid #1a1a1a", color: "#555", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", cursor: "pointer" }}>
            Refresh
          </button>
        </div>

        {error && (
          <div style={{ background: "#1a0808", border: "1px solid #ef444433", borderRadius: "10px", padding: "14px", color: "#ef4444", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
            {[
              { label: "Total Clients", value: totals.clients, color: "#fff" },
              { label: "Monthly Active", value: totals.active, color: "#00c896" },
              { label: "Est. MRR", value: "$" + totals.revenue.toLocaleString(), color: "#00c896" },
              { label: "Views This Month", value: totals.views.toLocaleString(), color: "#3b82f6" },
              { label: "Total Bookings", value: totals.bookings, color: "#f59e0b" },
            ].map(st => (
              <div key={st.label} style={s.statBox}>
                <div style={{ fontSize: "22px", fontWeight: 800, color: st.color }}>{st.value}</div>
                <div style={{ fontSize: "11px", color: "#333", marginTop: "2px" }}>{st.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text" placeholder="Search clients..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...s.input, flex: 1, minWidth: "200px" }}
          />
          <div style={{ display: "flex", gap: "4px", background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "4px" }}>
            {(["all", "active", "building", "unpaid"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={s.filterBtn(filter === f)}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ color: "#333", textAlign: "center", padding: "60px" }}>Loading clients...</div>
        )}

        {filtered.map(c => (
          <ClientCard key={c.slug} c={c} secret={secret} />
        ))}

        {!loading && filtered.length === 0 && (
          <div style={{ color: "#333", textAlign: "center", padding: "60px 0", fontSize: "14px" }}>
            No clients found.
          </div>
        )}
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
