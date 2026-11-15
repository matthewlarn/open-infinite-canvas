import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CATEGORIES, FAQ, MEMBERS, TOOLS, money, pick, take, type Tool } from "./content";
import { AppBar, Avatar, Icon, Screen, StatusBar, Switch, TabBar, categoryIcon } from "./ui";
import { Collectors, Faq, OpeningHours, Perks, RelatedTools, Reviews, SiteFooter, TimeSlots, WeekStrip } from "./blocks";

export type ScreenProps = { seed: number; state: string };

/** A timeout that is cleared when the screen unmounts, so a parked or evicted screen leaves nothing running. */
function useLater() {
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
}

/* ---------------------------------------------------------------- sign in */

export function SignIn({ seed, state }: ScreenProps) {
  const member = pick(MEMBERS, seed);
  const prefilled = state === "filled" || state === "error";
  const [email, setEmail] = useState(prefilled ? `${member.handle}@harborstreet.test` : "");
  const [password, setPassword] = useState(state === "filled" ? "chisel-and-mallet" : state === "error" ? "mallet" : "");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(seed % 2 === 0);
  const [error, setError] = useState(state === "error" ? "That password does not match this email. Try again, or reset it below." : "");
  const [busy, setBusy] = useState(false);
  const later = useLater();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return setError("Enter the email address you joined with.");
    if (password.length < 8) return setError("Your password is at least 8 characters long.");
    setError("");
    setBusy(true);
    later(() => setBusy(false), 1400);
  };

  return (
    <Screen label="Sign in">
      <StatusBar />
      <div className="body">
        <div className="stack" style={{ maxWidth: 420, width: "100%", margin: "0 auto" }}>
          <div className="row">
            <span className="thumb">
              <Icon name="wrench" className="lg" />
            </span>
            <div className="stack tight">
              <h1>Welcome back</h1>
              <p className="muted">Harbor Street Tool Library</p>
            </div>
          </div>
          {error ? (
            <div className="banner bad" role="alert">
              <Icon name="alert" />
              <span>{error}</span>
            </div>
          ) : null}
          <form className="stack" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor={`email-${seed}`}>Email address</label>
              <input id={`email-${seed}`} className="input" type="email" autoComplete="off" value={email} aria-invalid={!!error && !email.includes("@")} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`pw-${seed}`}>Password</label>
              <div className="inputwrap">
                <input id={`pw-${seed}`} className="input" type={show ? "text" : "password"} autoComplete="off" value={password} aria-invalid={state === "error" && !!error} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="btn" aria-pressed={show} onClick={() => setShow((s) => !s)}>
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Keep me signed in on this phone</span>
            </label>
            <button type="submit" className="btn primary block" disabled={busy}>
              {busy ? "Signing in" : "Sign in"}
            </button>
            <button type="button" className="btn ghost block">
              Send me a reset link
            </button>
          </form>
          <p className="small muted" style={{ textAlign: "center" }}>
            Not a member yet? Joining takes five minutes and costs {money(24)} a year.
          </p>
          <Perks />
          <OpeningHours title="The desk is open" />
          <Faq seed={seed} />
          <SiteFooter seed={seed} />
        </div>
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------- join */

const PLANS = [
  { id: "standard", name: "Standard", price: 24, note: "Borrow up to four tools at a time." },
  { id: "low", name: "Low income", price: 8, note: "Same borrowing, no questions asked." },
  { id: "supporter", name: "Supporter", price: 60, note: "Pays for one low income membership too." },
];

export function Join({ seed, state }: ScreenProps) {
  const member = pick(MEMBERS, seed, 3);
  const filled = state === "filled";
  const [name, setName] = useState(filled ? member.name : "");
  const [postcode, setPostcode] = useState(filled ? "HS4 2RW" : "");
  const [plan, setPlan] = useState(PLANS[seed % 3].id);
  const [interests, setInterests] = useState<string[]>(filled ? take(CATEGORIES, seed, 3) : []);
  const [often, setOften] = useState(filled ? 3 + (seed % 5) : 2);
  const [how, setHow] = useState(filled ? "A neighbour" : "");
  const [notes, setNotes] = useState(filled ? "I am fitting out a kitchen this winter and would rather borrow a tile cutter than buy one." : "");
  const [sent, setSent] = useState(false);
  const toggle = (c: string) => setInterests((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));
  const complete = name.trim().length > 1 && postcode.trim().length > 4;

  return (
    <Screen label="Join the library">
      <StatusBar />
      <AppBar title="Join the library" back />
      <div className="body">
        {sent ? (
          <div className="banner ok" role="status">
            <Icon name="check" />
            <span>Thanks, {name.split(" ")[0]}. Bring photo ID to the desk and your card will be waiting.</span>
          </div>
        ) : null}
        <div className="cols">
          <div className="stack">
            <div className="field">
              <label htmlFor={`name-${seed}`}>Full name</label>
              <input id={`name-${seed}`} className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`pc-${seed}`}>Postcode</label>
              <input id={`pc-${seed}`} className="input" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} />
              <span className="hint">Membership is open to anyone living within five miles of Harbor Street.</span>
            </div>
            <fieldset className="stack tight" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ padding: 0, marginBottom: 6 }}>
                Membership
              </legend>
              {PLANS.map((p) => (
                <label key={p.id} className="card" style={{ flexDirection: "row", alignItems: "center", cursor: "pointer", borderColor: plan === p.id ? "var(--primary)" : undefined }}>
                  <input type="radio" name={`plan-${seed}`} checked={plan === p.id} onChange={() => setPlan(p.id)} style={{ width: 22, height: 22, accentColor: "var(--primary)", margin: 0 }} />
                  <span className="grow stack tight">
                    <strong>{p.name}</strong>
                    <span className="small muted">{p.note}</span>
                  </span>
                  <strong>{money(p.price)}</strong>
                </label>
              ))}
            </fieldset>
          </div>
          <div className="stack">
            <div className="stack tight">
              <span className="label">What do you expect to borrow?</span>
              <div className="grid2">
                {CATEGORIES.map((c) => (
                  <label key={c} className="check">
                    <input type="checkbox" checked={interests.includes(c)} onChange={() => toggle(c)} />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor={`often-${seed}`}>Loans you expect to make a year: {often * 2}</label>
              <input id={`often-${seed}`} className="range" type="range" min={1} max={12} value={often} onChange={(e) => setOften(Number(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor={`how-${seed}`}>How did you hear about us?</label>
              <select id={`how-${seed}`} className="select" value={how} onChange={(e) => setHow(e.target.value)}>
                <option value="">Choose one</option>
                <option>A neighbour</option>
                <option>The repair cafe</option>
                <option>A poster at the allotments</option>
                <option>The council newsletter</option>
                <option>I walked past</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`notes-${seed}`}>Anything we should know?</label>
              <textarea id={`notes-${seed}`} className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <Perks />
        <button type="button" className="btn primary block" disabled={!complete || sent} onClick={() => setSent(true)}>
          {sent ? "Application sent" : `Join for ${money(PLANS.find((p) => p.id === plan)!.price)} a year`}
        </button>
        <Faq seed={seed} count={3} />
        <SiteFooter seed={seed} />
      </div>
    </Screen>
  );
}

/* --------------------------------------------------------------- catalogue */

function ToolRow({ tool, index, saved, onSave }: { tool: Tool; index: number; saved: boolean; onSave: () => void }) {
  const out = (tool.name.length + index) % 4 === 0;
  return (
    <li>
      <span className={`thumb c${index % 4}`}>
        <Icon name={categoryIcon(tool.category)} className="lg" />
      </span>
      <div className="grow stack tight">
        <strong className="truncate">{tool.name}</strong>
        <span className="small muted truncate">
          {tool.maker} · shelf {tool.shelf} · {tool.loanDays} day loan
        </span>
        <span>
          <span className={`tag ${out ? "warn" : "ok"}`}>{out ? `Back ${["Tuesday", "Thursday", "Saturday"][index % 3]}` : "On the shelf"}</span>
        </span>
      </div>
      <button type="button" className="heart" aria-pressed={saved} aria-label={`Save ${tool.name}`} onClick={onSave}>
        <Icon name="heart" />
      </button>
    </li>
  );
}

function CatalogueSkeleton() {
  return (
    <ul className="list card pad0" aria-busy="true" aria-label="Loading tools">
      {Array.from({ length: 9 }, (_, i) => (
        <li key={i}>
          <span className="sk" style={{ width: 56, height: 56, borderRadius: 12 }} />
          <div className="grow stack tight">
            <span className="sk" style={{ height: 16, width: `${55 + ((i * 13) % 35)}%` }} />
            <span className="sk" style={{ height: 14, width: `${40 + ((i * 7) % 30)}%` }} />
            <span className="sk" style={{ height: 22, width: 96 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Catalogue({ seed, state }: ScreenProps) {
  const tools = useMemo(() => take(TOOLS, seed, 22), [seed]);
  const [query, setQuery] = useState(state === "empty" ? "left handed screwdriver" : "");
  const [category, setCategory] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(() => new Set(tools.filter((_, i) => (i + seed) % 5 === 0).map((t) => t.name)));
  const [retrying, setRetrying] = useState(false);
  const later = useLater();
  const shown = tools.filter((t) => (!category || t.category === category) && (!query || `${t.name} ${t.maker} ${t.category}`.toLowerCase().includes(query.toLowerCase())));
  const toggle = (name: string) =>
    setSaved((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <Screen label="Tool catalogue">
      <StatusBar />
      <AppBar
        title="Tools"
        action={
          <button type="button" className="btn ghost icon-only" aria-label="Notifications">
            <Icon name="bell" />
          </button>
        }
      />
      <div className="body">
        <label className="search">
          <Icon name="search" />
          <input type="search" aria-label="Search tools" placeholder="Search 412 tools" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="Category">
          <button type="button" className="chip" aria-pressed={category === null} onClick={() => setCategory(null)}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {c}
            </button>
          ))}
        </div>
        {state === "loading" ? (
          <CatalogueSkeleton />
        ) : state === "error" ? (
          <div className="empty">
            <Icon name="wifi" />
            <h2>You are offline</h2>
            <p className="muted">The shelf list was last updated at 08:12. Reconnect to see what came back this morning.</p>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setRetrying(true);
                later(() => setRetrying(false), 1800);
              }}
            >
              {retrying ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : null}
              {retrying ? "Trying again" : "Try again"}
            </button>
            <div style={{ width: "100%", textAlign: "left" }}>
              <RelatedTools seed={seed} title="Saved on this phone" />
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty">
            <Icon name="search" />
            <h2>Nothing matches that</h2>
            <p className="muted">We do not stock it yet. Tell the desk and it goes on the wish list that donors read.</p>
            <button type="button" className="btn" onClick={() => setQuery("")}>
              Clear the search
            </button>
            <div style={{ width: "100%", textAlign: "left" }}>
              <RelatedTools seed={seed} title="Popular this week" />
            </div>
          </div>
        ) : (
          <ul className="list card pad0">
            {shown.map((t, i) => (
              <ToolRow key={t.name} tool={t} index={i + seed} saved={saved.has(t.name)} onSave={() => toggle(t.name)} />
            ))}
          </ul>
        )}
        {state === "loading" ? null : <SiteFooter seed={seed} />}
      </div>
      <TabBar current="tools" />
    </Screen>
  );
}

/* ------------------------------------------------------------- tool detail */

export function ToolDetail({ seed, state }: ScreenProps) {
  const tool = pick(TOOLS, seed);
  const [reserved, setReserved] = useState(state === "reserved");
  const [open, setOpen] = useState<number | null>(seed % 3);
  const faqs = take(FAQ, seed, 4);

  if (state === "loading") {
    return (
      <Screen label="Loading tool">
        <StatusBar />
        <AppBar title="Tool" back />
        <div className="body" aria-busy="true">
          <span className="sk" style={{ height: 180, borderRadius: 16 }} />
          <span className="sk" style={{ height: 28, width: "70%" }} />
          <span className="sk" style={{ height: 16, width: "45%" }} />
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="sk" style={{ height: 16, width: `${92 - ((i * 11) % 30)}%` }} />
          ))}
          <div className="card">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="row between">
                <span className="sk" style={{ height: 14, width: `${28 + ((i * 9) % 20)}%` }} />
                <span className="sk" style={{ height: 14, width: `${14 + ((i * 5) % 12)}%` }} />
              </div>
            ))}
          </div>
          <div className="grid2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card">
                <span className="sk" style={{ width: 44, height: 44, borderRadius: 12 }} />
                <span className="sk" style={{ height: 14, width: "80%" }} />
                <span className="sk" style={{ height: 14, width: "50%" }} />
              </div>
            ))}
          </div>
          <span className="sk" style={{ height: 44, borderRadius: 10 }} />
        </div>
      </Screen>
    );
  }

  return (
    <Screen label={tool.name}>
      <StatusBar />
      <AppBar title={tool.category} back />
      <div className="body">
        <div className="cols">
          <div className="stack">
            <div className="hero">
              <Icon name={categoryIcon(tool.category)} />
            </div>
            <div className="stack tight">
              <h1>{tool.name}</h1>
              <p className="muted">
                {tool.maker} · shelf {tool.shelf}
              </p>
            </div>
            <p>{tool.blurb}</p>
            {reserved ? (
              <div className="banner ok" role="status">
                <Icon name="check" />
                <span>Reserved for you. Collect it from shelf {tool.shelf} any time the desk is open this week.</span>
              </div>
            ) : (
              <div className="banner warn">
                <Icon name="clock" />
                <span>{tool.care}</span>
              </div>
            )}
            <WeekStrip seed={seed} />
          </div>
          <div className="stack">
            <div className="card">
              <h3>The details</h3>
              <dl className="spec">
                <dt>Loan period</dt>
                <dd>{tool.loanDays} days</dd>
                <dt>Deposit</dt>
                <dd>{money(tool.deposit)}</dd>
                <dt>Late fee</dt>
                <dd>{money(tool.deposit >= 25 ? 2.5 : 1)} a day</dd>
                <dt>Times borrowed</dt>
                <dd>{40 + ((seed * 37) % 260)}</dd>
                <dt>Last serviced</dt>
                <dd>{["3 Nov", "27 Oct", "14 Oct", "9 Nov"][seed % 4]} 2026</dd>
              </dl>
            </div>
            <div className="card pad0">
              {faqs.map((f, i) => (
                <div key={f.q} style={{ borderBottom: i < faqs.length - 1 ? "1px solid var(--line)" : undefined }}>
                  <button type="button" className="btn ghost block" style={{ justifyContent: "space-between", textAlign: "left", borderRadius: 0 }} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                    <span>{f.q}</span>
                    <Icon name={open === i ? "x" : "plus"} />
                  </button>
                  {open === i ? <p style={{ padding: "0 16px 14px" }}>{f.a}</p> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="stack">
            <Reviews seed={seed} />
            <RelatedTools seed={seed} />
          </div>
        </div>
        <SiteFooter seed={seed} />
        <button type="button" className={`btn block ${reserved ? "" : "primary"}`} onClick={() => setReserved((r) => !r)}>
          {reserved ? "Cancel reservation" : `Reserve for ${money(tool.deposit)} deposit`}
        </button>
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------- calendar */

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Calendar({ seed, state }: ScreenProps) {
  const tool = pick(TOOLS, seed, 5);
  /* November 2026 starts on a Sunday. The grid starts on the Monday before, 26 October. */
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => ({ day: i < 6 ? 26 + i : i < 36 ? i - 5 : i - 35, out: i < 6 || i >= 36, index: i })), []);
  const busy = useMemo(() => new Set([8 + (seed % 5), 9 + (seed % 5), 16 + (seed % 7), 17 + (seed % 7), 18 + (seed % 7), 27]), [seed]);
  const [from, setFrom] = useState<number | null>(state === "range" ? 12 + (seed % 3) : null);
  const [to, setTo] = useState<number | null>(state === "range" ? 12 + (seed % 3) + Math.min(tool.loanDays, 4) : null);
  const choose = (i: number) => {
    if (from === null || to !== null) {
      setFrom(i);
      setTo(null);
    } else if (i > from) setTo(Math.min(i, from + tool.loanDays));
    else setFrom(i);
  };
  const nights = from !== null && to !== null ? to - from : 0;

  return (
    <Screen label="Choose dates">
      <StatusBar />
      <AppBar title="Choose your dates" back />
      <div className="body">
        <div className="row">
          <span className="thumb">
            <Icon name={categoryIcon(tool.category)} className="lg" />
          </span>
          <div className="grow stack tight">
            <strong className="truncate">{tool.name}</strong>
            <span className="small muted">Up to {tool.loanDays} days. Struck through days are already booked.</span>
          </div>
        </div>
        <div className="card">
          <div className="row between">
            <button type="button" className="btn ghost icon-only" aria-label="Previous month">
              <Icon name="back" />
            </button>
            <h2>November 2026</h2>
            <button type="button" className="btn ghost icon-only" aria-label="Next month">
              <Icon name="chevron" />
            </button>
          </div>
          <div className="cal" role="grid" aria-label="November 2026">
            {DOW.map((d) => (
              <span key={d} className="dow">
                {d}
              </span>
            ))}
            {days.map((d) => {
              const isBusy = !d.out && busy.has(d.index);
              const sel = d.index === from || d.index === to;
              const inRange = from !== null && to !== null && d.index > from && d.index < to;
              return (
                <button
                  key={d.index}
                  type="button"
                  disabled={d.out || isBusy}
                  className={`${d.out ? "out" : ""} ${isBusy ? "busy" : ""} ${sel ? "sel" : ""} ${inRange ? "inrange" : ""}`}
                  aria-pressed={sel}
                  aria-label={`${d.day} ${d.index < 6 ? "October" : d.index >= 36 ? "December" : "November"}${isBusy ? ", booked" : ""}`}
                  onClick={() => choose(d.index)}
                >
                  {d.day}
                </button>
              );
            })}
          </div>
        </div>
        <div className="card">
          <dl className="spec">
            <dt>Collect</dt>
            <dd>{from !== null ? `${days[from].day} November` : "Pick a day"}</dd>
            <dt>Return by</dt>
            <dd>{to !== null ? `${days[to].day} ${to >= 36 ? "December" : "November"}` : "Pick a day"}</dd>
            <dt>Deposit</dt>
            <dd>{money(tool.deposit)}</dd>
          </dl>
        </div>
        <TimeSlots seed={seed} />
        <Collectors seed={seed} />
        <button type="button" className="btn primary block" disabled={!nights}>
          {nights ? `Reserve for ${nights} ${nights === 1 ? "day" : "days"}` : "Choose two dates"}
        </button>
        <SiteFooter seed={seed} />
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------- settings */

export function Settings({ seed }: ScreenProps) {
  const member = pick(MEMBERS, seed, 7);
  const [due, setDue] = useState(true);
  const [back, setBack] = useState(seed % 2 === 0);
  const [news, setNews] = useState(seed % 3 === 0);
  const [sms, setSms] = useState(false);
  const [theme, setTheme] = useState(["System", "Light", "Dark"][seed % 3]);
  const [units, setUnits] = useState(seed % 2 ? "Metric" : "Imperial");
  const [text, setText] = useState(2 + (seed % 3));
  const [radius, setRadius] = useState(3);
  return (
    <Screen label="Settings">
      <StatusBar />
      <AppBar title="Settings" back />
      <div className="body">
        <div className="card" style={{ flexDirection: "row", alignItems: "center" }}>
          <Avatar name={member.name} hue={seed} />
          <div className="grow stack tight">
            <strong className="truncate">{member.name}</strong>
            <span className="small muted truncate">
              {member.role} · member since {member.since}
            </span>
          </div>
          <Icon name="chevron" />
        </div>
        <div className="cols">
          <div className="card">
            <h3>Reminders</h3>
            <div>
              <div className="switchrow">
                <span className="grow">A tool is due back tomorrow</span>
                <Switch label="Due back reminders" on={due} onChange={setDue} />
              </div>
              <div className="switchrow">
                <span className="grow">Something I saved is back on the shelf</span>
                <Switch label="Back on shelf alerts" on={back} onChange={setBack} />
              </div>
              <div className="switchrow">
                <span className="grow">Workshop and repair cafe news</span>
                <Switch label="News" on={news} onChange={setNews} />
              </div>
              <div className="switchrow">
                <span className="grow">Send texts as well as notifications</span>
                <Switch label="Text messages" on={sms} onChange={setSms} />
              </div>
            </div>
          </div>
          <div className="card">
            <h3>Display</h3>
            <div className="stack tight">
              <span className="label">Appearance</span>
              <div className="segmented" role="group" aria-label="Appearance">
                {["System", "Light", "Dark"].map((t) => (
                  <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="stack tight">
              <span className="label">Measurements</span>
              <div className="segmented" role="group" aria-label="Measurements">
                {["Metric", "Imperial"].map((t) => (
                  <button key={t} type="button" aria-pressed={units === t} onClick={() => setUnits(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor={`text-${seed}`}>Text size: {["Small", "Default", "Large", "Larger", "Largest"][text - 1]}</label>
              <input id={`text-${seed}`} className="range" type="range" min={1} max={5} value={text} onChange={(e) => setText(Number(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor={`radius-${seed}`}>Show tools within {radius} miles</label>
              <input id={`radius-${seed}`} className="range" type="range" min={1} max={5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <div className="cols">
          <Collectors seed={seed} />
          <OpeningHours />
        </div>
        <Faq seed={seed} count={3} />
        <button type="button" className="btn block">
          Sign out
        </button>
        <SiteFooter seed={seed} />
      </div>
    </Screen>
  );
}
