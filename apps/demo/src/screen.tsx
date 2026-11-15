import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./screens/demo.css";
import { buildFrames, renderDemoFrame } from "./screens/registry";

/* One screen filling the window. This is what a frame in iframe mode loads. */
const q = new URLSearchParams(window.location.search);
const index = Math.max(0, Number(q.get("i") ?? 0));
const frame = buildFrames(index + 1).find((f) => f.seed === index)!;
document.documentElement.setAttribute("data-theme", q.get("theme") === "dark" ? "dark" : "light");
document.body.style.margin = "0";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div style={{ width: "100vw", height: "100vh" }}>{renderDemoFrame(frame)}</div>
  </StrictMode>,
);
