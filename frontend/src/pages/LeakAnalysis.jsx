import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Info } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { useAppData } from "../context/AppContext.jsx";
import { runLeakAnalysis } from "../services/transactionService.js";

function displayMoney(value, currency) {
  if (value == null || !currency) return "Unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value));
}

export default function LeakAnalysis() {
  const { transactions } = useAppData();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState("");
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestedId = searchParams.get("transaction") || "";
  const effectiveId = selectedId || requestedId || transactions[0]?.id || "";

  useEffect(() => {
    setSelectedId(requestedId);
  }, [requestedId]);

  useEffect(() => {
    let active = true;
    if (!effectiveId) {
      setBreakdown(null);
      setError("");
      return () => { active = false; };
    }
    setLoading(true);
    setError("");
    runLeakAnalysis(effectiveId)
      .then((result) => { if (active) setBreakdown(result); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error?.message || requestError.message || "Could not load transaction details.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [effectiveId]);

  const conversion = breakdown?.exchangeRate;
  const details = breakdown ? [
    ["Original payment", displayMoney(breakdown.originalAmount.value, breakdown.originalAmount.currency), breakdown.originalAmount.source],
    ["PayPal transaction fee", displayMoney(breakdown.transactionFee.value, breakdown.transactionFee.currency), breakdown.transactionFee.source],
    ["Exchange rate", conversion?.value ?? "Unavailable", conversion?.source ?? "unavailable"],
    ["Converted amount", displayMoney(breakdown.convertedAmount.value, breakdown.convertedAmount.currency), breakdown.convertedAmount.status],
    ["Withdrawal fee", displayMoney(breakdown.withdrawalFee.value, breakdown.withdrawalFee.currency), breakdown.withdrawalFee.status],
    ["Final payout", displayMoney(breakdown.finalPayout.value, breakdown.finalPayout.currency), breakdown.finalPayout.status],
  ] : [];

  return (
    <div className="page-enter">
      <PageHeader eyebrow="ANALYTICS / TRANSACTIONS" title="Money Leak Analysis" description="Inspect actual PayPal fees and conversion data. Unavailable values are shown as unavailable, not estimated." />
      {transactions.length > 0 && <div className="analysis-controls"><label className="field-label">Selected transaction<select value={effectiveId} onChange={(event) => setSelectedId(event.target.value)}>{requestedId && !transactions.some((item) => item.id === requestedId) && <option value={requestedId}>{requestedId} · selected transaction</option>}{transactions.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.client} · {item.currency} {item.gross}</option>)}</select></label></div>}
      {loading && <div className="page-loading"><span className="spinner" /> Loading verified transaction details…</div>}
      {error && <div className="panel empty-state"><b>Could not load transaction details</b><span>{error}</span></div>}
      {!loading && !error && !breakdown && <div className="panel empty-state"><b>No synced transactions</b><span>Sync an authorized server-configured PayPal merchant account before reviewing fee details.</span></div>}
      {breakdown && <div className="analysis-grid">
        <Panel title="Transaction breakdown" subtitle={`Transaction ${breakdown.transactionId} · ${breakdown.financialDataStatus}`}>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Data</th><th>Value</th><th>Source / status</th></tr></thead><tbody>
            {details.map(([label, value, source]) => <tr key={label}><td>{label}</td><td><b>{value}</b></td><td>{source}</td></tr>)}
          </tbody></table></div>
        </Panel>
        <Panel title="How to read this" subtitle="Only source-provided values are displayed">
          <div className="ai-explanation"><div className="ai-bubble-icon"><Info size={17} /></div><div><p>Fees and conversion values are reported with their source. PayLeak does not estimate reference rates, combine different currencies, or calculate a final payout when required source data is missing.</p><small>Financial data status: {breakdown.financialDataStatus}</small></div></div>
        </Panel>
      </div>}
    </div>
  );
}
