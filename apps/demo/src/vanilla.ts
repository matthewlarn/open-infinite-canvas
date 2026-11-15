import { layoutRows, mountCanvas } from "open-infinite-canvas";
import "open-infinite-canvas/styles.css";
import { TOOLS } from "./screens/content";

/* The engine with no framework. Each screen is a card built with plain DOM calls. */
const frames = layoutRows(
  TOOLS.map((tool, i) => ({ id: `tool-${i}`, name: tool.name, group: tool.category, w: 393, h: 420 })),
  { maxRowWidth: 4200 },
);

const canvas = mountCanvas(document.getElementById("stage")!, {
  label: "Harbor Street Tool Library, every tool",
  frames,
  renderFrame(frame, host) {
    const tool = TOOLS[Number(frame.id.slice(5))];
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("h2");
    title.textContent = tool.name;
    const blurb = document.createElement("p");
    blurb.textContent = tool.blurb;
    const care = document.createElement("p");
    care.textContent = `${tool.maker}. Shelf ${tool.shelf}. ${tool.care}`;
    const button = document.createElement("button");
    button.type = "button";
    let days = tool.loanDays;
    const label = () => `Borrow for ${days} days`;
    button.textContent = label();
    const onClick = () => {
      days += 1;
      button.textContent = label();
    };
    button.addEventListener("click", onClick);
    card.append(title, blurb, care, button);
    host.appendChild(card);
    return () => button.removeEventListener("click", onClick);
  },
});

(window as unknown as { __canvas: typeof canvas }).__canvas = canvas;
