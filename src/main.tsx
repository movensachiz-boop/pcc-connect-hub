import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAntiInspect } from "./lib/antiInspect";
import { registerAppServiceWorker } from "./lib/registerSW";

installAntiInspect();
registerAppServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
