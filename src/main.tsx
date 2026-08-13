import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAntiInspect } from "./lib/antiInspect";
import { registerAppServiceWorker } from "./lib/registerSW";
import { installBuildFreshnessCheck } from "./lib/forceUpdate";
import { initCatTime } from "./lib/catTime";

installAntiInspect();
registerAppServiceWorker();
installBuildFreshnessCheck();
initCatTime();

createRoot(document.getElementById("root")!).render(<App />);
