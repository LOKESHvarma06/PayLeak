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
      <PageHeader eyebrow="BILLING / INVOICE DETAILS" title={invoice.id} description="Review the invoice record saved in your PayLeak account." action={<Link className="button secondary" to="/invoices"><ArrowLeft size={16} /> Back to invoices</Link>} />
      <div className="invoice-detail-layout">
        <Panel title="Invoice overview" subtitle="Stored in your account" action={<StatusBadge>{invoice.status}</StatusBadge>}>
          <div className="invoice-detail-total"><span>Total amount</span><b>{money(invoice.amount, invoice.currency)}</b><small>{invoice.currency}</small></div>
          <div className="invoice-detail-grid"><div><span>Invoice number</span><b>{invoice.id}</b></div><div><span>Invoice date</span><b>{invoice.date}</b></div><div><span>Due date</span><b>{invoice.due}</b></div><div><span>Payment status</span><b><StatusBadge>{invoice.status}</StatusBadge></b></div></div>
          <div className="invoice-client-block"><span className="eyebrow">BILL TO</span><b>{invoice.client}</b><small>{invoice.email}</small></div>
          <div className="invoice-description-block"><span>Description</span><p>{invoice.description}</p></div>
          <div className="invoice-detail-actions"><button className="button secondary" onClick={() => window.print()}><Download size={15} /> Print / Save PDF</button>{invoice.status === "Draft" && <button className="button secondary" disabled title="PayPal Invoicing has not been enabled for this application">PayPal sending unavailable</button>}</div>
        </Panel>
        <aside className="detail-security-note"><ShieldCheck size={19} /><b>PayPal delivery status</b><p>{invoice.paypalId ? `PayPal invoice reference: ${invoice.paypalId}` : "This draft has not been sent. PayPal Invoicing must be enabled before it can be delivered."}</p><button onClick={() => navigate("/invoices/create")}>Create another invoice</button></aside>
      </div>
    </div>
  );
}
