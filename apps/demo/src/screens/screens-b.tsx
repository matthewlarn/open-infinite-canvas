import { useEffect, useMemo, useRef, useState } from "react";
import { ACTIVITY, ARTICLES, CATEGORIES, CHAT, LOANS_BY_YEAR, MEMBERS, MONTHS, TOOLS, WORKSHOPS, money, pick, rng, take } from "./content";
import { AppBar, Avatar, Icon, Screen, StatusBar, TabBar, categoryIcon } from "./ui";
import type { ScreenProps } from "./screens-a";
import { Badges, Collectors, Comments, Faq, Heatmap, MoreArticles, OpeningHours, RelatedTools, Reviews, SiteFooter, StaffOnDuty } from "./blocks";

/* --------------------------------------------------------------- dashboard */

function BarChart({ values, labels, highlight }: { values: number[]; labels: string[]; highlight: number }) {
  const max = Math.max(...values, 1);
  const w = 360;
  const h = 170;
  const bw = (w - 30) / values.length;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h + 24}`} role="img" aria-label={`Loans per month. Highest is ${labels[values.indexOf(max)]} with ${max}.`}>
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} className="axis" x1={26} x2={w} y1={h - h * t * 0.92} y2={h - h * t * 0.92} />
      ))}
      <line className="axis" x1={26} x2={w} y1={h} y2={h} />
      {values.map((v, i) => {
        const bh = (v / max) * h * 0.92;
        return <rect key={i} className={`bar ${i === highlight ? "alt" : ""}`} x={30 + i * bw} y={h - bh} width={bw - 6} height={bh} rx={3} />;
      })}
      {labels.map((l, i) => (i % 2 === 0 ? <text key={l} x={30 + i * bw + (bw - 6) / 2} y={h + 18} textAnchor="middle">{l}</text> : null))}
    </svg>
  );
}

function LineChart({ a, b }: { a: number[]; b: number[] }) {
  const max = Math.max(...a, ...b, 1);
  const w = 360;
  const h = 150;
  const pts = (vals: number[]) => vals.map((v, i) => `${(i / (vals.length - 1)) * (w - 12) + 6},${h - (v / max) * h * 0.9}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h + 6}`} role="img" aria-label="Loans this year against last year">
      <polygon className="area" points={`6,${h} ${pts(a)} ${w - 6},${h}`} />
      <polyline className="line alt" points={pts(b)} />
      <polyline className="line" points={pts(a)} />
      <line className="axis" x1={0} x2={w} y1={h} y2={h} />
    </svg>
  );
}

const DONUT_COLORS = ["var(--primary)", "var(--accent)", "var(--info)", "var(--warning)", "var(--success)", "var(--danger)", "var(--muted)", "var(--line)"];

function Donut({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="row top">
      <svg viewBox="0 0 140 140" style={{ width: 132, height: 132, flex: "none" }} role="img" aria-label={`Loans by category. ${parts[0].label} leads with ${Math.round((parts[0].value / total) * 100)} percent.`}>
        <g transform="rotate(-90 70 70)">
          {parts.map((p, i) => {
            const len = (p.value / total) * c;
            const el = <circle key={p.label} cx={70} cy={70} r={r} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={22} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
        </g>
        <text x={70} y={68} textAnchor="middle" style={{ font: "700 22px system-ui", fill: "var(--ink)" }}>{total.toLocaleString("en-GB")}</text>
        <text x={70} y={88} textAnchor="middle" style={{ font: "500 14px system-ui", fill: "var(--muted)" }}>loans</text>
      </svg>
      <ul className="legend grow" style={{ flexDirection: "column" }}>
        {parts.slice(0, 6).map((p, i) => (
          <li key={p.label} className="row between" style={{ width: "100%" }}>
            <span className="truncate">
              <i style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              {p.label}
            </span>
            <strong>{Math.round((p.value / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Dashboard({ seed, state }: ScreenProps) {
  const year = 2024 + (seed % 3);
  const thisYear = LOANS_BY_YEAR[year];
  const lastYear = LOANS_BY_YEAR[year - 1];
  const [range, setRange] = useState(["Year", "Quarter", "Month"][seed % 3]);
  const months = range === "Year" ? 12 : range === "Quarter" ? 3 : 1;
  const start = range === "Year" ? 0 : (seed % 4) * 3;
  const vals = thisYear.slice(start, start + Math.max(months, 3));
  const total = vals.reduce((s, v) => s + v, 0);
  const prev = lastYear.slice(start, start + Math.max(months, 3)).reduce((s, v) => s + v, 0);
  const delta = prev ? ((total - prev) / prev) * 100 : 0;
  const parts = useMemo(() => {
    const r = rng(seed + 11);
    return CATEGORIES.map((label) => ({ label, value: Math.round(120 + r() * 900) })).sort((x, y) => y.value - x.value);
  }, [seed]);
  const top = take(TOOLS, seed, 6);

  if (state === "loading") {
    return (
      <Screen label="Loading the dashboard">
        <StatusBar />
        <AppBar title="How the library is doing" />
        <div className="body" aria-busy="true">
          <div className="grid2">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="sk" style={{ height: 84, borderRadius: 14 }} />
            ))}
          </div>
          <div className="card">
            <span className="sk" style={{ height: 18, width: "40%" }} />
            <div className="row" style={{ alignItems: "flex-end", height: 150, gap: 6 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="sk grow" style={{ height: `${30 + ((i * 37) % 65)}%` }} />
              ))}
            </div>
          </div>
          <span className="sk" style={{ height: 180, borderRadius: 14 }} />
          <div className="card">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="row between">
                <span className="sk" style={{ height: 16, width: `${40 + ((i * 11) % 30)}%` }} />
                <span className="sk" style={{ height: 16, width: 36 }} />
              </div>
            ))}
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen label="Library dashboard">
      <StatusBar />
      <AppBar title={`${year} at a glance`} />
      <div className="body">
        <div className="segmented" role="group" aria-label="Period">
          {["Year", "Quarter", "Month"].map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
        <div className="cols wide3">
          <div className="grid2">
            <div className="card kpi">
              <span className="small muted">Loans</span>
              <span className="num">{total.toLocaleString("en-GB")}</span>
              <span className={`delta ${delta < 0 ? "down" : ""}`}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}% on last year</span>
            </div>
            <div className="card kpi">
              <span className="small muted">Active members</span>
              <span className="num">{(640 + seed * 3).toLocaleString("en-GB")}</span>
              <span className="delta">+{18 + (seed % 23)} this month</span>
            </div>
            <div className="card kpi">
              <span className="small muted">Returned on time</span>
              <span className="num">{91 + (seed % 7)}%</span>
              <span className="delta down">-{(seed % 4) + 1}.2 points</span>
            </div>
            <div className="card kpi">
              <span className="small muted">Saved by borrowing</span>
              <span className="num">£{(31 + (seed % 40)).toLocaleString("en-GB")}k</span>
              <span className="delta">at shop prices</span>
            </div>
          </div>
          <div className="card">
            <h3>Loans per month</h3>
            <BarChart values={thisYear} labels={MONTHS} highlight={thisYear.indexOf(Math.max(...thisYear))} />
          </div>
          <div className="card">
            <h3>This year against last</h3>
            <LineChart a={thisYear.filter((v) => v > 0)} b={lastYear} />
            <ul className="legend">
              <li><i style={{ background: "var(--primary)" }} />{year}</li>
              <li><i style={{ background: "var(--accent)" }} />{year - 1}</li>
            </ul>
          </div>
        </div>
        <div className="cols">
          <div className="card">
            <h3>What people borrow</h3>
            <Donut parts={parts} />
          </div>
          <div className="card pad0">
            <h3 style={{ padding: "16px 16px 4px" }}>Most borrowed</h3>
            <ul className="list">
              {top.map((t, i) => (
                <li key={t.name} style={{ minHeight: 52, padding: "8px 16px" }}>
                  <span className="muted" style={{ width: 18 }}>{i + 1}</span>
                  <span className="grow truncate">{t.name}</span>
                  <strong>{220 - i * 23 - (seed % 9)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <Heatmap seed={seed} />
        </div>
        <SiteFooter seed={seed} />
      </div>
    </Screen>
  );
}

/* ----------------------------------------------------------- activity feed */

type Event = { id: number; who: string; what: string; at: string };

export function ActivityFeed({ seed }: ScreenProps) {
  const people = useMemo(() => take(MEMBERS, seed, 12), [seed]);
  const [clock, setClock] = useState(() => 9 * 3600 + 41 * 60 + (seed % 50));
  const [events, setEvents] = useState<Event[]>(() => people.slice(0, 10).map((p, i) => ({ id: i, who: p.name, what: ACTIVITY[(seed + i * 3) % ACTIVITY.length], at: `${3 + i * 4} min ago` })));
  const [out, setOut] = useState(38 + (seed % 20));
  const next = useRef(10);

  /* A live screen: a clock that ticks and a feed that grows. Both stop when the screen is parked or unmounted. */
  useEffect(() => {
    const tick = window.setInterval(() => setClock((c) => c + 1), 1000);
    const feed = window.setInterval(() => {
      const n = next.current++;
      const p = people[n % people.length];
      setEvents((list) => [{ id: n, who: p.name, what: ACTIVITY[(seed + n * 5) % ACTIVITY.length], at: "just now" }, ...list].slice(0, 12));
      setOut((o) => Math.max(20, Math.min(72, o + ((n % 3) - 1) * 2)));
    }, 2600);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(feed);
    };
  }, [people, seed]);

  const hh = String(Math.floor(clock / 3600) % 24).padStart(2, "0");
  const mm = String(Math.floor(clock / 60) % 60).padStart(2, "0");
  const ss = String(clock % 60).padStart(2, "0");

  return (
    <Screen label="Desk activity">
      <StatusBar time={`${hh}:${mm}`} />
      <AppBar
        title="At the desk today"
        action={
          <span className="row" style={{ gap: 8 }}>
            <span className="livedot" aria-hidden="true" />
            <span className="small" style={{ fontVariantNumeric: "tabular-nums" }}>{hh}:{mm}:{ss}</span>
          </span>
        }
      />
      <div className="body">
        <div className="cols">
          <div className="card">
            <div className="row between">
              <h3>Tools out on loan</h3>
              <strong>{out} of 412</strong>
            </div>
            <div className="meter"><i style={{ width: `${(out / 80) * 100}%` }} /></div>
            <div className="row between">
              <h3>Returns due today</h3>
              <strong>{9 + (seed % 6)}</strong>
            </div>
            <div className="meter warn"><i style={{ width: `${35 + (clock % 40)}%` }} /></div>
            <div className="row between">
              <h3>Desk queue</h3>
              <strong>{clock % 5} waiting</strong>
            </div>
            <div className="meter"><i style={{ width: `${(clock % 5) * 20}%` }} /></div>
          </div>
          <StaffOnDuty seed={seed} />
          <SiteFooter seed={seed} />
          <ul className="list card pad0" aria-live="off">
            {events.map((e, i) => (
              <li key={e.id} className={e.at === "just now" && i === 0 ? "slidein" : ""}>
                <Avatar name={e.who} small hue={e.id} />
                <div className="grow stack tight">
                  <span className="clamp2">
                    <strong>{e.who}</strong> {e.what}
                  </span>
                  <span className="small muted">{e.at}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <TabBar current="home" />
    </Screen>
  );
}

/* ----------------------------------------------------------------- article */

export function ArticleScreen({ seed }: ScreenProps) {
  const article = pick(ARTICLES, seed);
  const [saved, setSaved] = useState(seed % 4 === 0);
  const [done, setDone] = useState<Set<number>>(() => new Set(seed % 3 === 0 ? [0, 1] : []));
  const toggle = (i: number) =>
    setDone((d) => {
      const next = new Set(d);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <Screen label={article.title}>
      <StatusBar />
      <AppBar
        title="Workshop notes"
        back
        action={
          <button type="button" className="heart" aria-pressed={saved} aria-label="Save this article" onClick={() => setSaved((s) => !s)}>
            <Icon name="heart" />
          </button>
        }
      />
      <div className="body">
        <article className="cols">
          <div className="prose">
            <span className="tag info">{article.minutes} minute read</span>
            <h1>{article.title}</h1>
            <div className="row">
              <Avatar name={article.author} small hue={seed} />
              <span className="small muted">By {article.author}, volunteer</span>
            </div>
            <p className="standfirst">{article.standfirst}</p>
            {article.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <aside className="card" style={{ alignSelf: "start" }}>
            <h3>In short</h3>
            <ol className="steps">
              {article.steps.map((s, i) => (
                <li key={s}>
                  <label className="check grow" style={{ minHeight: 32 }}>
                    <input type="checkbox" checked={done.has(i)} onChange={() => toggle(i)} />
                    <span style={{ textDecoration: done.has(i) ? "line-through" : undefined }}>{s}</span>
                  </label>
                </li>
              ))}
            </ol>
            <div className="meter"><i style={{ width: `${(done.size / article.steps.length) * 100}%` }} /></div>
            <span className="small muted">{done.size} of {article.steps.length} done</span>
          </aside>
          <div className="stack">
            <MoreArticles seed={seed} />
            <Comments seed={seed} />
          </div>
        </article>
        <SiteFooter seed={seed} />
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------- checkout */

const STEPS = ["Your tools", "Collection", "Deposit", "Done"];

export function Checkout({ seed, state }: ScreenProps) {
  const initial = state === "step2" ? 1 : state === "step3" ? 2 : state === "done" ? 3 : 0;
  const [step, setStep] = useState(initial);
  const basket = useMemo(() => take(TOOLS, seed + 2, 3), [seed]);
  const [qty, setQty] = useState<number[]>([1, 1, 1]);
  const [slot, setSlot] = useState(seed % 4);
  const [method, setMethod] = useState("Card on file");
  const deposit = basket.reduce((s, t, i) => s + t.deposit * qty[i], 0);
  const slots = ["Tue 17 Nov, 16:00 to 18:00", "Thu 19 Nov, 18:00 to 20:00", "Fri 20 Nov, 08:00 to 10:00", "Sat 21 Nov, 09:30 to 12:00"];
  return (
    <Screen label={`Borrow, step ${step + 1}: ${STEPS[step]}`}>
      <StatusBar />
      <AppBar title={STEPS[step]} back />
      <div className="body">
        <div className="stepper" role="img" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <i key={s} className={i <= step ? "done" : ""} />
          ))}
        </div>
        {step === 0 ? (
          <ul className="list card pad0">
            {basket.map((t, i) => (
              <li key={t.name}>
                <span className={`thumb c${i}`}>
                  <Icon name={categoryIcon(t.category)} className="lg" />
                </span>
                <div className="grow stack tight">
                  <strong className="truncate">{t.name}</strong>
                  <span className="small muted">{money(t.deposit)} deposit · {t.loanDays} days</span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button type="button" className="btn icon-only" aria-label={`One fewer ${t.name}`} disabled={qty[i] <= 0} onClick={() => setQty((q) => q.map((v, j) => (j === i ? Math.max(0, v - 1) : v)))}>
                    <Icon name="x" />
                  </button>
                  <strong style={{ width: 20, textAlign: "center" }}>{qty[i]}</strong>
                  <button type="button" className="btn icon-only" aria-label={`One more ${t.name}`} disabled={qty[i] >= 2} onClick={() => setQty((q) => q.map((v, j) => (j === i ? Math.min(2, v + 1) : v)))}>
                    <Icon name="plus" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {step === 0 ? <RelatedTools seed={seed} title="People also borrow" /> : null}
        {step === 1 ? <OpeningHours title="When the desk is open" /> : null}
        {step === 2 ? <Collectors seed={seed} /> : null}
        {step === 1 || step === 2 ? <Reviews seed={seed} count={2} /> : null}
        {step === 3 ? <Faq seed={seed} count={3} /> : null}
        {step === 1 ? (
          <fieldset className="stack tight" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ padding: 0, marginBottom: 6 }}>When will you collect?</legend>
            {slots.map((s, i) => (
              <label key={s} className="card" style={{ flexDirection: "row", alignItems: "center", cursor: "pointer", borderColor: slot === i ? "var(--primary)" : undefined }}>
                <input type="radio" name={`slot-${seed}`} checked={slot === i} onChange={() => setSlot(i)} style={{ width: 22, height: 22, accentColor: "var(--primary)", margin: 0 }} />
                <span className="grow">{s}</span>
                <span className={`tag ${i === 3 ? "warn" : "ok"}`}>{i === 3 ? "Busy" : "Quiet"}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {step === 2 ? (
          <div className="stack">
            <div className="card">
              <dl className="spec">
                {basket.map((t, i) => (
                  <span key={t.name} style={{ display: "contents" }}>
                    <dt className="truncate">{qty[i]} × {t.name}</dt>
                    <dd>{money(t.deposit * qty[i])}</dd>
                  </span>
                ))}
                <dt><strong>Held as deposit</strong></dt>
                <dd>{money(deposit)}</dd>
              </dl>
            </div>
            <div className="segmented" role="group" aria-label="Payment method">
              {["Card on file", "Pay at the desk"].map((m) => (
                <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>
                  {m}
                </button>
              ))}
            </div>
            <p className="small muted">Nothing is charged. The deposit is held and released the day the tools come back.</p>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="empty">
            <span className="thumb" style={{ width: 72, height: 72, borderRadius: "50%" }}>
              <Icon name="check" className="lg" />
            </span>
            <h2>They are yours from {slots[slot].split(",")[0]}</h2>
            <p className="muted">Show this screen at the desk. We have set aside {basket.length} tools on the collection shelf by the door.</p>
            <div className="card" style={{ width: "100%" }}>
              <dl className="spec">
                <dt>Booking</dt>
                <dd>HS-{(48213 + seed * 17).toString()}</dd>
                <dt>Collect</dt>
                <dd>{slots[slot]}</dd>
                <dt>Deposit held</dt>
                <dd>{money(deposit)}</dd>
              </dl>
            </div>
            <div style={{ width: "100%", textAlign: "left" }}>
              <RelatedTools seed={seed + 3} title="While you are there" />
            </div>
          </div>
        ) : null}
        <SiteFooter seed={seed} />
        <div style={{ flex: 1 }} />
        <div className="row">
          {step > 0 && step < 3 ? (
            <button type="button" className="btn" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : null}
          <button type="button" className="btn primary grow" onClick={() => setStep((s) => (s + 1) % 4)}>
            {step === 0 ? "Choose a collection time" : step === 1 ? "Review the deposit" : step === 2 ? `Hold ${money(deposit)} and confirm` : "Borrow something else"}
          </button>
        </div>
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------- chat */

const QUICK = ["Is it back yet?", "Can I renew?", "Change my collection time", "Report a fault"];

export function Chat({ seed, state }: ScreenProps) {
  const member = pick(MEMBERS, seed, 2);
  const desk = pick(MEMBERS, seed, 9);
  const [messages, setMessages] = useState(() => CHAT.slice(0, 10 + (seed % 3)));
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(state === "typing");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { from: "member" as const, text: text.trim() }]);
    setDraft("");
    setTyping(true);
    timers.current.push(
      window.setTimeout(() => {
        setTyping(false);
        setMessages((m) => [...m, { from: "desk" as const, text: "Got it. I have added a note to your booking so whoever is on the desk will see it." }]);
      }, 1800),
    );
  };
  return (
    <Screen label="Messages with the desk">
      <StatusBar />
      <AppBar title="The desk" back action={<span className="tag ok">Open until 20:00</span>} />
      <div className="body" style={{ gap: 10 }}>
        <span className="small muted" style={{ alignSelf: "center" }}>Thursday 12 November</span>
        {messages.map((m, i) => {
          const mine = m.from === "member";
          const who = mine ? member : desk;
          return (
            <div key={i} className="row top" style={{ flexDirection: mine ? "row-reverse" : "row", gap: 8 }}>
              <Avatar name={who.name} small hue={mine ? seed : seed + 1} />
              <div className="stack tight" style={{ alignItems: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                <div className={`bubble ${mine ? "me" : ""}`} style={{ maxWidth: "100%" }}>
                  {m.text}
                </div>
                <span className="small muted">
                  {mine ? "You" : who.name.split(" ")[0]} · {String(16 + Math.floor(i / 4)).padStart(2, "0")}:{String((i * 7 + seed) % 60).padStart(2, "0")}
                </span>
              </div>
            </div>
          );
        })}
        {typing ? (
          <div className="row" style={{ gap: 8 }}>
            <Avatar name={desk.name} small hue={seed + 1} />
            <div className="bubble" aria-label="The desk is typing">
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="chips" role="group" aria-label="Quick replies" style={{ padding: "8px 12px 0" }}>
        {QUICK.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input className="input" aria-label="Message" placeholder="Write a message" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="btn primary icon-only" aria-label="Send" disabled={!draft.trim()}>
          <Icon name="send" />
        </button>
      </form>
    </Screen>
  );
}

/* --------------------------------------------------------------- inventory */

type SortKey = "name" | "category" | "loans" | "deposit" | "due";

export function Inventory({ seed }: ScreenProps) {
  const rows = useMemo(() => {
    const r = rng(seed + 5);
    return take(TOOLS, seed, 26).map((t, i) => ({
      tool: t,
      loans: Math.round(20 + r() * 280),
      due: r() < 0.35 ? `${1 + Math.floor(r() * 27)} Nov` : "",
      holder: r() < 0.35 ? MEMBERS[(seed + i * 5) % MEMBERS.length].name : "",
      state: r() < 0.12 ? "Repair" : r() < 0.4 ? "Out" : "In",
    }));
  }, [seed]);
  const [sort, setSort] = useState<SortKey>((["name", "loans", "category"] as SortKey[])[seed % 3]);
  const [desc, setDesc] = useState(seed % 2 === 0);
  const [filter, setFilter] = useState("All");
  const sorted = useMemo(() => {
    const list = rows.filter((r) => filter === "All" || r.state === filter);
    const get = (r: (typeof rows)[number]) => (sort === "name" ? r.tool.name : sort === "category" ? r.tool.category : sort === "loans" ? r.loans : sort === "deposit" ? r.tool.deposit : r.due);
    list.sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
    });
    return list;
  }, [rows, sort, desc, filter]);
  const head = (key: SortKey, label: string, num = false) => (
    <th className={num ? "num" : ""} aria-sort={sort === key ? (desc ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        onClick={() => {
          if (sort === key) setDesc((d) => !d);
          else {
            setSort(key);
            setDesc(false);
          }
        }}
      >
        {label}
        <Icon name="sort" />
      </button>
    </th>
  );
  return (
    <Screen label="Inventory">
      <StatusBar />
      <AppBar title="Inventory" action={<span className="tag">{sorted.length} tools</span>} />
      <div className="body flush">
        <div className="chips" role="group" aria-label="Status" style={{ padding: 12 }}>
          {["All", "In", "Out", "Repair"].map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "In" ? "On the shelf" : f === "Out" ? "On loan" : f === "Repair" ? "Being repaired" : "All"}
            </button>
          ))}
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          <table className="table">
            <thead>
              <tr>
                {head("name", "Tool")}
                {head("category", "Category")}
                <th>Status</th>
                {head("loans", "Loans", true)}
                {head("deposit", "Deposit", true)}
                {head("due", "Due back")}
                <th>With</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.tool.name}>
                  <td><strong>{r.tool.name}</strong></td>
                  <td>{r.tool.category}</td>
                  <td><span className={`tag ${r.state === "In" ? "ok" : r.state === "Out" ? "info" : "bad"}`}>{r.state === "In" ? "On the shelf" : r.state === "Out" ? "On loan" : "Repair"}</span></td>
                  <td className="num">{r.loans}</td>
                  <td className="num">{money(r.tool.deposit)}</td>
                  <td>{r.state === "Out" ? r.due || "20 Nov" : ""}</td>
                  <td>{r.state === "Out" ? r.holder || MEMBERS[(seed + r.loans) % MEMBERS.length].name : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Screen>
  );
}

/* --------------------------------------------------------------- workshops */

export function Workshops({ seed, state }: ScreenProps) {
  const list = useMemo(() => take(WORKSHOPS, seed, 8), [seed]);
  const [booked, setBooked] = useState<Set<string>>(() => new Set(state === "full" ? list.map((w) => w.title) : seed % 2 ? [list[1].title] : []));
  const toggle = (title: string) =>
    setBooked((b) => {
      const next = new Set(b);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  return (
    <Screen label="Workshops">
      <StatusBar />
      <AppBar title="Workshops" />
      <div className="body">
        {state === "full" ? (
          <div className="banner ok" role="status">
            <Icon name="star" />
            <span>You are booked on everything this month. The bench room will be glad to see you.</span>
          </div>
        ) : null}
        <div className="cols">
          {list.map((w) => {
            const mine = booked.has(w.title);
            const taken = Math.min(w.places, w.taken + (mine ? 1 : 0));
            const full = taken >= w.places && !mine;
            return (
              <div key={w.title} className="card">
                <div className="row top">
                  <div className="grow stack tight">
                    <h3>{w.title}</h3>
                    <span className="small muted">{w.when} · {w.room}</span>
                  </div>
                  <span className={`tag ${full ? "bad" : taken / w.places > 0.7 ? "warn" : "ok"}`}>{full ? "Full" : `${w.places - taken} left`}</span>
                </div>
                <div className="row">
                  <Avatar name={w.host} small hue={w.places} />
                  <span className="small truncate">With {w.host}</span>
                </div>
                <div className={`meter ${full ? "full" : taken / w.places > 0.7 ? "warn" : ""}`}><i style={{ width: `${(taken / w.places) * 100}%` }} /></div>
                <button type="button" className={`btn block ${mine ? "" : "primary"}`} disabled={full} onClick={() => toggle(w.title)}>
                  {mine ? "Give up my place" : full ? "Join the waiting list" : "Book a place"}
                </button>
              </div>
            );
          })}
        </div>
        <SiteFooter seed={seed} />
      </div>
      <TabBar current="home" />
    </Screen>
  );
}

/* ----------------------------------------------------------------- profile */

export function Profile({ seed }: ScreenProps) {
  const member = pick(MEMBERS, seed);
  const history = useMemo(() => take(TOOLS, seed + 9, 8), [seed]);
  const [tab, setTab] = useState(["Current", "History", "Saved"][seed % 3]);
  const current = history.slice(0, 2 + (seed % 2));
  const shown = tab === "Current" ? current : tab === "History" ? history : history.slice(3, 7);
  return (
    <Screen label={`${member.name}, profile`}>
      <StatusBar />
      <AppBar
        title="My account"
        action={
          <button type="button" className="btn ghost icon-only" aria-label="Settings">
            <Icon name="settings" />
          </button>
        }
      />
      <div className="body">
        <div className="cols">
          <div className="stack">
            <div className="row">
              <Avatar name={member.name} hue={seed} />
              <div className="grow stack tight">
                <h2 className="clamp2">{member.name}</h2>
                <span className="small muted">{member.role}</span>
              </div>
            </div>
            <div className="grid2">
              <div className="card kpi">
                <span className="small muted">Loans since {member.since}</span>
                <span className="num">{member.loans}</span>
              </div>
              <div className="card kpi">
                <span className="small muted">Saved by borrowing</span>
                <span className="num">£{(member.loans * 38).toLocaleString("en-GB")}</span>
              </div>
            </div>
            <div className="card">
              <div className="row between">
                <h3>Membership</h3>
                <span className="tag ok">Active</span>
              </div>
              <div className="meter"><i style={{ width: `${30 + ((seed * 13) % 60)}%` }} /></div>
              <span className="small muted">Renews on {1 + (seed % 27)} {["January", "March", "May", "August"][seed % 4]} 2027</span>
            </div>
            <Badges seed={seed} />
            <SiteFooter seed={seed} />
          </div>
          <div className="stack">
            <div className="segmented" role="group" aria-label="Loans">
              {["Current", "History", "Saved"].map((t) => (
                <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            <ul className="list card pad0">
              {shown.map((t, i) => (
                <li key={t.name}>
                  <span className={`thumb c${i % 4}`}>
                    <Icon name={categoryIcon(t.category)} className="lg" />
                  </span>
                  <div className="grow stack tight">
                    <strong className="truncate">{t.name}</strong>
                    <span className="small muted">
                      {tab === "Current" ? `Due back ${17 + i * 2} November` : tab === "History" ? `Returned ${3 + i * 3} ${["October", "September", "August"][i % 3]}` : `Shelf ${t.shelf}`}
                    </span>
                  </div>
                  {tab === "Current" ? <button type="button" className="btn">Renew</button> : <Icon name="chevron" />}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <TabBar current="me" />
    </Screen>
  );
}
