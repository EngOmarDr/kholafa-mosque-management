import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service Worker is automatically handled by VitePWA plugin
createRoot(document.getElementById("root")!).render(<App />);
