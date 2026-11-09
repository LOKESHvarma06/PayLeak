import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, CheckCircle2, Eye, FilePlus2, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAppData } from "../context/AppContext.jsx";
import { extractInvoiceDetails } from "../services/invoiceService.js";
import { money } from "../utils/formatters.js";
import { paypalCurrencySymbol, paypalInvoiceCurrencies } from "../utils/paypalCurrencies.js";

const blankInvoice = { client: "", email: "", amount: "", currency: "USD", description: "", date: new Date().toISOString().slice(0, 10), due: "" };

export default function CreateInvoice() {
  const [form, setForm] = useState(blankInvoice);
  const [prompt, setPrompt] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const pendingRequest = useRef(null);
  const { createInvoice } = useAppData();
  const navigate = useNavigate();

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const extract = () => {
    if (!prompt.trim()) return toast.error("Describe the invoice you want to create.");
    setForm((current) => ({ ...current, ...extractInvoiceDetails(prompt) }));
    toast.success("Details filled from your text. Review them before saving.");
  };
  const validate = () => {
    if (!form.client.trim() || !form.email.includes("@") || Number(form.amount) <= 0 || !form.description.trim() || !form.due) {
      toast.error("Complete the client, valid email, amount, description, and due date.");
      return false;
    }
    const currency = paypalInvoiceCurrencies.find((item) => item.code === form.currency);
    if (!currency) {
      toast.error(form.currency === "INR"
        ? "PayPal does not support direct INR invoices. Choose a supported currency."
        : "Choose a currency supported for PayPal invoicing.");
      return false;
    }
    if ((String(form.amount).split(".")[1]?.length ?? 0) > currency.fractionDigits) {
      toast.error(`${currency.code} amounts cannot have more than ${currency.fractionDigits} decimal places.`);
      return false;
    }
    return true;
  };
  const saveDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const requestPayload = { ...form, amount: String(form.amount) };
      const fingerprint = JSON.stringify(requestPayload);
      if (!pendingRequest.current || pendingRequest.current.fingerprint !== fingerprint) {
        pendingRequest.current = { fingerprint, key: crypto.randomUUID() };
      }
      const invoice = await createInvoice(requestPayload, pendingRequest.current.key);
      pendingRequest.current = null;
      setSaved(invoice);
      toast.success(`PayPal invoice ${invoice.invoiceNumber || invoice.paypalId || ""} created as a draft.`);
      navigate("/invoices");
    } catch (error) {
      const code = error.response?.data?.error?.code;
      const messages = {
        PAYPAL_CURRENCY_UNSUPPORTED: "This currency is not available for your PayPal account. Choose another currency.",
        PAYPAL_PERMISSION_DENIED: "Your PayPal connection needs attention. Check the PayPal invoice permissions.",
        PAYPAL_NOT_CONFIGURED: "PayPal invoicing is not configured. Contact your administrator.",
      };
      toast.error(messages[code] || "Unable to create the PayPal invoice. Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-enter">
      <PageHeader eyebrow="BILLING / NEW INVOICE" title="Create an invoice" description="Create a draft in PayPal Sandbox and save its confirmed invoice details to PayLeak. Sending is a separate action." action={<Link className="button secondary" to="/invoices"><ArrowLeft size={16} /> Back to invoices</Link>} />
      <div className="invoice-create-grid">
        <div className="invoice-form-column">
          <section className="ai-create-card">
            <div className="ai-create-icon"><Sparkles size={18} /></div>
            <div className="ai-create-copy"><b>Quick-fill from text</b><p>Basic browser field matching. Review and edit the details before saving.</p></div>
            <div className="ai-prompt-row"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Create an invoice for Jordan Lee for $1,000 for website development, due in 15 days." rows="2" /><button className="button dark-button" onClick={extract}><Bot size={16} /> Fill fields</button></div>
            <span className="local-extraction-caption"><Sparkles size={13} /> This convenience parser runs in your browser and does not use the AI service.</span>
          </section>
          <section className="panel form-panel">
            <div className="panel-heading"><div><h2>Invoice details</h2><p>Fields marked with * are required.</p></div><span className="step-count">01 <i /> 02</span></div>
            <div className="form-grid">
              <label className="field-label">Client name *<input value={form.client} onChange={(event) => update("client", event.target.value)} placeholder="e.g. Jordan Lee" /></label>
              <label className="field-label">Client email *<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="client@company.com" /></label>
              <label className="field-label">Amount *<div className="amount-field"><span>{paypalCurrencySymbol(form.currency)}</span><input type="number" min={form.currency === "JPY" || form.currency === "HUF" ? "1" : "0.01"} step={form.currency === "JPY" || form.currency === "HUF" ? "1" : "0.01"} value={form.amount} onChange={(event) => update("amount", event.target.value)} placeholder="0.00" /></div></label>
              <label className="field-label">Currency<select value={form.currency} onChange={(event) => update("currency", event.target.value)}>{paypalInvoiceCurrencies.map(({ code, name }) => <option key={code} value={code}>{name} ({code} · {paypalCurrencySymbol(code)})</option>)}</select></label>
              <label className="field-label full-span">Service description *<textarea rows="3" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe the work or services provided" /></label>
              <label className="field-label">Invoice date<input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} /></label>
              <label className="field-label">Due date *<input type="date" value={form.due} onChange={(event) => update("due", event.target.value)} /></label>
            </div>
            <div className="form-footer"><span><CheckCircle2 size={15} /> PayPal must confirm the draft before it is saved</span><button className="button secondary" onClick={() => setShowPreview(true)}><Eye size={16} /> Preview invoice</button></div>
          </section>
          <div className="form-actions"><button className="button primary" onClick={saveDraft} disabled={saving}>{saving ? <span className="spinner" /> : <><FilePlus2 size={16} /> Create PayPal draft</>}</button></div>
        </div>
        <aside className="invoice-side-note">
          <div className="side-note-icon"><FilePlus2 size={19} /></div><h3>Before you create</h3><p>PayLeak first creates a draft in PayPal Sandbox. It is not sent to the customer until you choose Send.</p>
          <div className="side-note-rule" /><div className="side-note-row"><CheckCircle2 size={15} /><span>Confirm client details and currency</span></div><div className="side-note-row"><CheckCircle2 size={15} /><span>Currency availability can vary by PayPal merchant; INR is not supported directly</span></div><div className="side-note-row"><CheckCircle2 size={15} /><span>Review the preview before saving</span></div>
          {saved && <div className="saved-record"><b>Last PayPal draft</b><span>{saved.paypalId || saved.id}</span><small>Status: {saved.status}</small></div>}
        </aside>
      </div>
      {showPreview && <Modal title="Invoice preview" onClose={() => setShowPreview(false)}><div className="invoice-preview"><div className="preview-brand">pay<span>leak</span><small>INVOICE PREVIEW · NOT SENT</small></div><div className="preview-line"><span>Invoice to</span><b>{form.client || "Client name"}</b><small>{form.email || "client@email.com"}</small></div><div className="preview-line"><span>Invoice date</span><b>{form.date || "—"}</b></div><div className="preview-line"><span>Due date</span><b>{form.due || "—"}</b></div><div className="preview-description">{form.description || "Service description"}</div><div className="preview-total"><span>Total due</span><b>{money(Number(form.amount) || 0, form.currency)}</b></div></div><div className="modal-actions"><button className="button secondary" onClick={() => setShowPreview(false)}>Continue editing</button><button className="button primary" onClick={() => setShowPreview(false)}>Close preview</button></div></Modal>}
    </div>
  );
}
