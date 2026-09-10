import { Route, Routes } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { EvalsPage } from "./pages/EvalsPage";
import { ProductivityPage } from "./pages/ProductivityPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      <Route path="/evals" element={<EvalsPage />} />
      <Route path="/productivity" element={<ProductivityPage />} />
    </Routes>
  );
}
