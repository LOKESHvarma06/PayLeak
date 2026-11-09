import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, ShieldCheck } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAppData } from "../context/AppContext.jsx";
import { money } from "../utils/formatters.js";

export default function InvoiceDetails() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { invoices } = useAppData();
  const invoice = invoices.find((item) => item.id === decodeURIComponent(invoiceId || ""));

  if (!invoice) {
    return <div className="page-enter"><PageHeader title="Invoice not found" description="No matching invoice exists in your account." action={<Link className="button secondary" to="/invoices"><ArrowLeft size={16} /> Back to invoices</Link>} /><div className="panel empty-state"><FileText size={25} /><b>No matching invoice</b></div></div>;
  }

  return (
    <div className="page-enter">
      <PageHeader eyebrow="BILLING / INVOICE DETAILS" title={invoice.invoiceNumber || invoice.id} description="Review the invoice record saved in your PayLeak account." action={<Link className="button secondary" to="/invoices"><ArrowLeft size={16} /> Back to invoices</Link>} />
      <div className="invoice-detail-layout">
        <Panel title="Invoice overview" subtitle={invoice.source === "paypal" ? "Imported from PayPal" : "Created in PayLeak"} action={<StatusBadge>{invoice.status}</StatusBadge>}>
          <div className="invoice-detail-total"><span>Total amount</span><b>{money(invoice.amount, invoice.currency)}</b><small>{invoice.currency}</small></div>
          <div className="invoice-detail-grid"><div><span>Invoice number</span><b>{invoice.invoiceNumber || invoice.id}</b></div><div><span>Invoice date</span><b>{invoice.date}</b></div><div><span>Due date</span><b>{invoice.due || "Not specified"}</b></div><div><span>Payment status</span><b><StatusBadge>{invoice.status}</StatusBadge></b></div>{invoice.subtotal != null && <div><span>Subtotal</span><b>{money(invoice.subtotal, invoice.currency)}</b></div>}{invoice.tax != null && <div><span>Tax</span><b>{money(invoice.tax, invoice.currency)}</b></div>}{invoice.paymentAmount != null && <div><span>Paid amount</span><b>{money(invoice.paymentAmount, invoice.currency)}</b></div>}{invoice.paymentDate && <div><span>Payment date</span><b>{invoice.paymentDate}</b></div>}</div>
          <div className="invoice-client-block"><span className="eyebrow">BILL TO</span><b>{invoice.client}</b><small>{invoice.email}</small></div>
          <div className="invoice-description-block"><span>Description</span><p>{invoice.description}</p></div>
          <div className="invoice-detail-actions"><button className="button secondary" onClick={() => window.print()}><Download size={15} /> Print / Save PDF</button>{invoice.invoiceUrl && <a className="button secondary" href={invoice.invoiceUrl} target="_blank" rel="noreferrer">Open PayPal invoice</a>}{invoice.status === "Draft" && <button className="button secondary" disabled title="PayPal invoice sending is not enabled for this application">PayPal sending unavailable</button>}</div>
        </Panel>
        <aside className="detail-security-note"><ShieldCheck size={19} /><b>Invoice source</b><p>{invoice.source === "paypal" ? `Imported from PayPal. Reference: ${invoice.paypalId || "not available"}.` : "Created and stored in PayLeak. This draft has not been sent."}</p><button onClick={() => navigate("/invoices/create")}>Create another invoice</button></aside>
      </div>
    </div>
  );
}
