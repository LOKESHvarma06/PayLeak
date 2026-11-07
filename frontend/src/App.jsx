import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ConnectPayPal from "./pages/ConnectPayPal.jsx";
import Invoices from "./pages/Invoices.jsx";
import CreateInvoice from "./pages/CreateInvoice.jsx";
import LeakAnalysis from "./pages/LeakAnalysis.jsx";
import RouteOptimizer from "./pages/RouteOptimizer.jsx";
import AIAssistant from "./pages/AIAssistant.jsx";
import Notifications from "./pages/Notifications.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/connect-paypal" element={<ConnectPayPal />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/create" element={<CreateInvoice />} />
        <Route path="/leak-analysis" element={<LeakAnalysis />} />
        <Route path="/route-optimizer" element={<RouteOptimizer />} />
        <Route path="/ai-assistant" element={<AIAssistant />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
