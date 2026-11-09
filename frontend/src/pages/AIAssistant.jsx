import { useState } from "react";
import { ArrowUp, Bot, CirclePlus, MessageSquare, MoreHorizontal, Plus, Sparkles, Trash2, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import PageHeader from "../components/PageHeader.jsx";
import { useAppData } from "../context/AppContext.jsx";
import { askAssistant, testAssistantConnection } from "../services/aiService.js";

const suggestions = [
  "Explain the fee on my latest transaction.",
  "Which transaction fields are unavailable?",
  "Summarize my invoice statuses.",
  "Explain my latest PayPal transaction.",
];

export default function AIAssistant() {
  const { transactions, invoices } = useAppData();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const overdue = invoices.filter((invoice) => invoice.status === "Overdue").length;

  const submit = async (value = question) => {
    const text = value.trim();
    if (!text || loading) return;
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text }]);
    setLoading(true);
    setRequestError("");
    try {
      const history = messages.slice(-12).map(({ role, text: messageText }) => ({ role, text: messageText }));
      const answer = await askAssistant(text, history);
      setMessages((current) => [...current, { role: "assistant", text: answer.answer, source: answer.source }]);
    } catch (error) {
      const message = error.response?.data?.error?.message || "The assistant could not answer. Please try again.";
      setRequestError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (checkingConnection) return;
    setCheckingConnection(true);
    try {
      const diagnostics = await testAssistantConnection();
      setConnectionStatus(diagnostics.connected);
      if (diagnostics.connected) toast.success(`Connected to Google Gemini (${diagnostics.model}).`);
      else toast.error("Add GEMINI_API_KEY to the backend environment to enable the assistant.");
    } catch (error) {
      setConnectionStatus(false);
      const message = error.response?.data?.error?.message || "Could not verify the Google Gemini connection. Please try again.";
      setRequestError(message);
      toast.error(message);
    } finally {
      setCheckingConnection(false);
    }
  };

  const clear = () => {
    setMessages([]);
    setRequestError("");
  };

  return (
    <div className="page-enter">
      <PageHeader eyebrow="PAYLEAK INTELLIGENCE" title="AI Financial Assistant" description="Ask questions about your transactions, invoice payments, and recorded fees." />
      <div className="chat-layout">
        <aside className="chat-history">
          <div className="history-heading"><b>Conversations</b><button className="icon-button" onClick={clear} aria-label="Clear conversation"><Plus size={17} /></button></div>
          <button className="new-chat-button" onClick={clear}><CirclePlus size={16} /> New conversation</button>
          <span className="history-date">CURRENT SESSION</span>
          <button className="history-item active"><MessageSquare size={15} /><span>Financial questions</span><MoreHorizontal size={15} /></button>
          <span className="history-date">ACCOUNT CONTEXT</span>
          <div className="history-context"><b>Stored account records</b><small>{transactions.length} transactions</small><small>{invoices.length} invoices · {overdue} overdue</small></div>
          <div className="history-disclaimer"><Sparkles size={14} /> Responses do not replace verified financial records.</div>
        </aside>
        <section className="chat-panel">
          <header className="chat-header"><span className="assistant-avatar"><Bot size={19} /></span><div><b>PayLeak AI</b><small><i />{connectionStatus === true ? " Google Gemini connected" : connectionStatus === false ? " Google Gemini connection needs attention" : " Google Gemini · your account records"}</small></div><button className="chat-clear-button" onClick={testConnection} disabled={checkingConnection}>{checkingConnection ? "Testing…" : "Test connection"}</button><button className="chat-clear-button" onClick={clear}><Trash2 size={15} /> Clear conversation</button></header>
          <div className="chat-messages">
            {messages.length === 0 && <div className="chat-empty"><span className="assistant-avatar large"><Sparkles size={23} /></span><h2>What would you like to understand?</h2><p>Questions are answered using your account’s stored financial records.</p></div>}
            {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`chat-message ${message.role}`}><span className={`message-avatar ${message.role}`}>{message.role === "assistant" ? <Bot size={16} /> : <UserRound size={15} />}</span><div className="message-content"><div className="message-bubble">{message.text}</div>{message.source && <small className="message-source">{message.source}</small>}</div></div>)}
            {loading && <div className="chat-message assistant"><span className="message-avatar assistant"><Bot size={16} /></span><div className="typing-bubble"><i /><i /><i /></div></div>}
          </div>
          <div className="suggested-prompts"><span>Try asking</span><div>{suggestions.map((text) => <button key={text} onClick={() => submit(text)} disabled={loading}>{text}</button>)}</div></div>
          <form className="chat-input-area" onSubmit={(event) => { event.preventDefault(); submit(); }}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Ask about your transactions…" rows="1" /><button className="send-chat" type="submit" disabled={!question.trim() || loading} aria-label="Send message"><ArrowUp size={18} /></button><small>{requestError || "Amounts in different currencies are not added together."}</small></form>
        </section>
      </div>
    </div>
  );
}
