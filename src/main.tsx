import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAntiInspect } from "./lib/antiInspect";
import { registerAppServiceWorker } from "./lib/registerSW";
import { installBuildFreshnessCheck } from "./lib/forceUpdate";

installAntiInspect();
registerAppServiceWorker();
installBuildFreshnessCheck();

createRoot(document.getElementById("root")!).render(<App />);
