import { useState, type ReactNode } from "react";

const PATHS: Record<string, string> = {
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3",
  heart: "M12 20.5S3.5 15.4 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 6.2-8.5 11.3-8.5 11.3Z",
  chevron: "m9 6 6 6-6 6",
  back: "m15 6-6 6 6 6",
  check: "m5 12.5 4.5 4.5L19 7.5",
  clock: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0-14v5l3 2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5a7.5 7.5 0 0 1 15 0",
  home: "m3.5 11 8.5-7 8.5 7M5.5 9.5V20h13V9.5",
  calendar: "M4 6.5h16v13.5H4zM4 10.5h16M8 3.5v4M16 3.5v4",
  bell: "M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15L6 17Zm4 4h4",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2 1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-1.7 1l-.3 2h-4l-.3-2a7.6 7.6 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7.5 7.5 0 0 1 0-2L3.2 10.300l2-3.400 1.900.700a7.600 7.600 0 0 1 1.700-1l.300-2h4l.300 2a7.600 7.600 0 0 1 1.700 1l1.900-.700 2 3.400-1.600 1.200a7.500 7.500 0 0 1 0 2Z",
  wrench: "M14.5 6.5a4.5 4.500 0 0 0-5.800 5.800L3.500 17.500l3 3 5.200-5.200a4.500 4.500 0 0 0 5.800-5.800l-2.700 2.700-2.300-.700-.700-2.300 2.700-2.700Z",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  send: "m4 12 16-7.500-6 15.500-2.500-6.500L4 12Z",
  alert: "M12 3.500 2.500 20h19L12 3.500Zm0 6v5m0 3v.100",
  wifi: "M3 9.500a13 13 0 0 1 18 0M6 13a8.500 8.500 0 0 1 12 0M9 16.500a4.200 4.200 0 0 1 6 0M12 20v.100",
  box: "M3.500 7.500 12 3l8.500 4.500v9L12 21l-8.500-4.500v-9Zm0 0L12 12l8.500-4.500M12 12v9",
  sort: "m8 9 4-4 4 4M8 15l4 4 4-4",
  star: "m12 3.500 2.600 5.400 5.900.800-4.300 4.100 1 5.800L12 16.900l-5.200 2.700 1-5.800-4.300-4.100 5.900-.800L12 3.500Z",
  leaf: "M5 19c0-9 6-14 15-14 0 9-5 15-14 15m-1-1 9-9",
  bolt: "M13 3 5 13.500h6L10 21l8-10.500h-6L13 3Z",
  ruler: "m4 15.500 11.500-11.500 4.500 4.500L8.500 20 4 15.500Zm5-1.500 1.500 1.500m1.500-4.500 1.500 1.500m1.500-4.500 1.500 1.500",
  drop: "M12 3.500s6 6.200 6 10.500a6 6 0 1 1-12 0c0-4.300 6-10.500 6-10.500Z",
  ladder: "M8 3v18M16 3v18M8 7.500h8M8 12h8M8 16.500h8",
  spark: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.500 2.500m7 7L18 18M6 18l2.500-2.500m7-7L18 6",
};

export function Icon({ name, className = "" }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" strokeWidth={1.5}>
      <path d={PATHS[name] ?? PATHS.box} />
    </svg>
  );
}

const CATEGORY_ICON: Record<string, string> = {
  "Power tools": "bolt",
  "Hand tools": "wrench",
  Garden: "leaf",
  "Ladders and access": "ladder",
  Plumbing: "drop",
  Electrical: "spark",
  Measuring: "ruler",
  Cleaning: "drop",
};
export const categoryIcon = (c: string) => CATEGORY_ICON[c] ?? "box";

export function StatusBar({ time = "09:41" }: { time?: string }) {
  return (
    <div className="statusbar hide-wide" aria-hidden="true">
      <span>{time}</span>
      <span className="dots">
        <i />
        <i />
      </span>
    </div>
  );
}

export function AppBar({ title, back, action }: { title: string; back?: boolean; action?: ReactNode }) {
  return (
    <header className="appbar">
      {back ? (
        <button type="button" className="btn ghost icon-only" aria-label="Back">
          <Icon name="back" />
        </button>
      ) : null}
      <h1>{title}</h1>
      {action}
    </header>
  );
}

const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "tools", label: "Tools", icon: "wrench" },
  { id: "loans", label: "Loans", icon: "calendar" },
  { id: "me", label: "Me", icon: "user" },
];

export function TabBar({ current = "tools" }: { current?: string }) {
  const [tab, setTab] = useState(current);
  return (
    <nav className="tabbar hide-wide" aria-label="Sections">
      {TABS.map((t) => (
        <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
          <Icon name={t.icon} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export function Avatar({ name, small, hue = 0 }: { name: string; small?: boolean; hue?: number }) {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
  return (
    <span className={`avatar ${small ? "sm" : ""} h${hue % 5}`} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />;
}

export function Screen({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className="screen" aria-label={label}>
      {children}
    </section>
  );
}
