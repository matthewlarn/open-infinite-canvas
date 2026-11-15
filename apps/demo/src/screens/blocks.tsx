import { useMemo, useState } from "react";
import { ARTICLES, MEMBERS, OPENING, TOOLS, money, rng, take } from "./content";
import { Avatar, Icon, categoryIcon } from "./ui";

/** What members said when they brought a tool back. Written for this demo. */
const REVIEWS = [
  "Did the whole bathroom floor in an afternoon. The fence was a touch out of square, so check it against a set square first.",
  "Came with a sharp blade and a full set of instructions taped inside the lid. Whoever does that, thank you.",
  "Heavier than I expected. Worth bringing a second pair of hands if you are carrying it up stairs.",
  "Exactly what I needed for one job I will never do again. This is why the library exists.",
  "The battery lasted the whole day on the first charge. The second one I never even opened.",
  "Worked perfectly. I would only add that the case latch is stiff, so do not force it.",
  "Borrowed it for a weekend and finished a job I had been putting off for two years.",
  "The desk showed me how to change the blade before I left, which saved me an hour of guessing.",
  "A bit worn but everything works. The depth stop slips if you do not tighten it properly.",
  "Returned it a day late and nobody made me feel bad about it. Paid the fee, lesson learned.",
  "Much quieter than the one I used to own. The neighbours did not even notice.",
  "Good tool, sensible loan period. I renewed once and still had time to spare.",
];

const COMMENTS = [
  "I did this last weekend and the tip about the fine stone was the thing I had been getting wrong for years.",
  "Worth adding that older valves are sometimes seized. A drop of penetrating oil the night before helps.",
  "Followed this step by step with my daughter. She did most of it herself by the end.",
  "The photo of the burr would help beginners. I did not know what I was feeling for the first time.",
  "Could you do one on sharpening plane irons? The camber confuses me.",
  "This saved me a call out fee. I owe the library a packet of biscuits.",
  "One thing: wear eye protection. A chip came off my old tiles and missed me by not very much.",
  "Clear and short. I printed it and stuck it inside the cupboard door.",
];

export function Stars({ value }: { value: number }) {
  return (
    <span className="row" style={{ gap: 2, color: "var(--warning)" }} role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: i <= value ? "currentColor" : "none" }} aria-hidden="true" strokeWidth={1.5}>
          <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.200 2.700 1-5.800-4.300-4.100 5.900-.800L12 3.500Z" />
        </svg>
      ))}
    </span>
  );
}

export function Reviews({ seed, count = 3 }: { seed: number; count?: number }) {
  const people = take(MEMBERS, seed + 4, count);
  return (
    <div className="card">
      <div className="row between">
        <h3>What borrowers said</h3>
        <span className="small muted">{12 + (seed % 40)} reviews</span>
      </div>
      <ul className="stack">
        {people.map((p, i) => (
          <li key={p.handle} className="stack tight">
            <div className="row">
              <Avatar name={p.name} small hue={seed + i} />
              <strong className="grow truncate">{p.name}</strong>
              <Stars value={5 - ((seed + i) % 3 === 0 ? 1 : 0)} />
            </div>
            <p className="small">{REVIEWS[(seed * 3 + i * 5) % REVIEWS.length]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RelatedTools({ seed, title = "Often borrowed with it" }: { seed: number; title?: string }) {
  const tools = take(TOOLS, seed + 13, 4);
  return (
    <div className="stack tight">
      <h3>{title}</h3>
      <div className="grid2">
        {tools.map((t, i) => (
          <button key={t.name} type="button" className="card" style={{ textAlign: "left", cursor: "pointer", gap: 6 }}>
            <span className={`thumb c${i}`} style={{ width: 44, height: 44 }}>
              <Icon name={categoryIcon(t.category)} />
            </span>
            <strong className="clamp2 small">{t.name}</strong>
            <span className="small muted">{money(t.deposit)} deposit</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekStrip({ seed }: { seed: number }) {
  const [day, setDay] = useState(seed % 7);
  return (
    <div className="stack tight">
      <h3>This week</h3>
      <div className="segmented" role="group" aria-label="Day" style={{ gridAutoColumns: "1fr" }}>
        {DAYS.map((d, i) => {
          const out = (seed + i * 3) % 5 === 0;
          return (
            <button key={d} type="button" aria-pressed={day === i} onClick={() => setDay(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 0" }}>
              <span>{d}</span>
              <span className="small" style={{ color: out ? "var(--danger)" : "var(--success)" }}>{out ? "Out" : "In"}</span>
            </button>
          );
        })}
      </div>
      <span className="small muted">
        {(seed + day * 3) % 5 === 0 ? `Booked on ${DAYS[day]}. The next free day is shown in green.` : `Free on ${DAYS[day]}. Collect any time the desk is open.`}
      </span>
    </div>
  );
}

/** Loans by weekday and hour. A grid of cells, the way a chart library would draw a heat map. */
export function Heatmap({ seed }: { seed: number }) {
  const cells = useMemo(() => {
    const r = rng(seed + 31);
    return DAYS.map((d, di) => ({ day: d, hours: Array.from({ length: 12 }, (_, h) => Math.round((di === 5 ? 0.9 : di === 0 || di === 2 ? 0.08 : 0.5) * (0.3 + r() * 0.7) * (h > 1 && h < 10 ? 1 : 0.4) * 100)) }));
  }, [seed]);
  return (
    <div className="card">
      <h3>When the desk is busy</h3>
      <div role="img" aria-label="Loans by weekday and hour. Saturday late morning is the busiest." style={{ display: "grid", gridTemplateColumns: "auto repeat(12, 1fr)", gap: 3, alignItems: "center" }}>
        {cells.map((row) => (
          <div key={row.day} style={{ display: "contents" }}>
            <span className="small muted" style={{ paddingRight: 6 }}>{row.day}</span>
            {row.hours.map((v, h) => (
              <i key={h} style={{ display: "block", aspectRatio: "1", borderRadius: 3, background: "var(--primary)", opacity: 0.08 + (v / 100) * 0.92 }} />
            ))}
          </div>
        ))}
      </div>
      <div className="row between small muted">
        <span>08:00</span>
        <span>14:00</span>
        <span>20:00</span>
      </div>
    </div>
  );
}

const BADGES = [
  { name: "First loan", icon: "check" },
  { name: "Ten returns on time", icon: "clock" },
  { name: "Mitre saw inducted", icon: "bolt" },
  { name: "Donated a tool", icon: "heart" },
  { name: "Repair cafe helper", icon: "wrench" },
  { name: "Workshop host", icon: "star" },
  { name: "Garden regular", icon: "leaf" },
  { name: "Five years a member", icon: "calendar" },
];

export function Badges({ seed }: { seed: number }) {
  return (
    <div className="card">
      <h3>Badges</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {BADGES.map((b, i) => {
          const earned = (seed + i * 3) % 4 !== 0;
          return (
            <div key={b.name} className="stack tight" style={{ alignItems: "center", textAlign: "center", opacity: earned ? 1 : 0.45 }}>
              <span className={`thumb c${i % 4}`} style={{ width: 48, height: 48, borderRadius: "50%" }}>
                <Icon name={b.icon} />
              </span>
              <span className="small">{b.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StaffOnDuty({ seed }: { seed: number }) {
  const people = take(MEMBERS, seed + 2, 4);
  return (
    <div className="card">
      <h3>On the desk now</h3>
      <ul className="stack">
        {people.map((p, i) => (
          <li key={p.handle} className="row">
            <Avatar name={p.name} small hue={seed + i} />
            <div className="grow stack tight">
              <strong className="truncate">{p.name}</strong>
              <span className="small muted truncate">{p.role}</span>
            </div>
            <span className={`tag ${i === 0 ? "ok" : i === 3 ? "warn" : "info"}`}>{i === 0 ? "Desk" : i === 3 ? "On a break" : i === 1 ? "Yard" : "Bench room"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Comments({ seed }: { seed: number }) {
  const people = take(MEMBERS, seed + 6, 4);
  const [liked, setLiked] = useState<Set<number>>(() => new Set([seed % 4]));
  return (
    <div className="stack">
      <h3>{4 + (seed % 9)} comments</h3>
      {people.map((p, i) => (
        <div key={p.handle} className="card">
          <div className="row">
            <Avatar name={p.name} small hue={seed + i} />
            <strong className="grow truncate">{p.name}</strong>
            <span className="small muted">{2 + i * 3} days ago</span>
          </div>
          <p className="small">{COMMENTS[(seed + i * 3) % COMMENTS.length]}</p>
          <div className="row">
            <button
              type="button"
              className="chip"
              aria-pressed={liked.has(i)}
              onClick={() =>
                setLiked((s) => {
                  const next = new Set(s);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
            >
              <Icon name="heart" />
              Helpful · {3 + ((seed + i) % 14) + (liked.has(i) ? 1 : 0)}
            </button>
            <button type="button" className="chip">Reply</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MoreArticles({ seed }: { seed: number }) {
  const list = take(ARTICLES, seed + 1, 3);
  return (
    <div className="stack tight">
      <h3>Read next</h3>
      <ul className="list card pad0">
        {list.map((a, i) => (
          <li key={a.title}>
            <span className={`thumb c${i}`}>
              <Icon name={["wrench", "drop", "ruler"][i]} className="lg" />
            </span>
            <div className="grow stack tight">
              <strong className="clamp2">{a.title}</strong>
              <span className="small muted">{a.minutes} minutes · {a.author}</span>
            </div>
            <Icon name="chevron" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OpeningHours({ title = "Opening hours" }: { title?: string }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <dl className="spec">
        {OPENING.map((o) => (
          <span key={o.day} style={{ display: "contents" }}>
            <dt>{o.day}</dt>
            <dd>{o.hours}</dd>
          </span>
        ))}
      </dl>
    </div>
  );
}

const PERKS = [
  { icon: "box", text: "Borrow from 412 tools, four at a time" },
  { icon: "star", text: "Free places on member workshops" },
  { icon: "wrench", text: "Bring broken things to the monthly repair cafe" },
  { icon: "leaf", text: "Roughly 38 pounds saved on every loan" },
];

export function Perks() {
  return (
    <ul className="card">
      {PERKS.map((p) => (
        <li key={p.text} className="row">
          <span className="thumb" style={{ width: 40, height: 40 }}>
            <Icon name={p.icon} />
          </span>
          <span className="grow small">{p.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function Collectors({ seed }: { seed: number }) {
  const people = take(MEMBERS, seed + 8, 3);
  const [on, setOn] = useState<Set<number>>(() => new Set([0]));
  return (
    <div className="card">
      <h3>Who may collect for you</h3>
      {people.map((p, i) => (
        <label key={p.handle} className="check">
          <input
            type="checkbox"
            checked={on.has(i)}
            onChange={() =>
              setOn((s) => {
                const next = new Set(s);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              })
            }
          />
          <Avatar name={p.name} small hue={seed + i} />
          <span className="grow truncate">{p.name}</span>
        </label>
      ))}
      <button type="button" className="btn">
        <Icon name="plus" />
        Add a named collector
      </button>
    </div>
  );
}

const HELP_LINKS = ["How borrowing works", "Fees and deposits", "Inductions and safety", "Donate a tool", "Volunteer at the desk", "Accessibility", "Privacy", "Contact the trustees"];

/** The foot of a page. Below the fold on a phone, as it is in most apps. */
export function SiteFooter({ seed }: { seed: number }) {
  return (
    <footer className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div className="row">
        <span className="thumb" style={{ width: 40, height: 40 }}>
          <Icon name="wrench" />
        </span>
        <div className="grow stack tight">
          <strong>Harbor Street Tool Library</strong>
          <span className="small muted">Unit 4, 218 Harbor Street. Yard gate on Chandlers Lane.</span>
        </div>
      </div>
      <ul className="grid2">
        {HELP_LINKS.map((l) => (
          <li key={l}>
            <a href={`#${l.toLowerCase().replace(/\s+/g, "-")}`} className="small" style={{ color: "var(--primary)", display: "inline-flex", minHeight: 32, alignItems: "center" }} onClick={(e) => e.preventDefault()}>
              {l}
            </a>
          </li>
        ))}
      </ul>
      <div className="row between small muted">
        <span>{OPENING[seed % OPENING.length].day} {OPENING[seed % OPENING.length].hours}</span>
        <span>Run by {40 + (seed % 9)} volunteers</span>
      </div>
      <p className="small muted">A registered charity. Every tool is safety checked before it goes back on the shelf.</p>
    </footer>
  );
}

const QUESTIONS = [
  { q: "How long can I keep a tool?", a: "Each listing shows its loan period, from two days to a fortnight. You can renew once if nobody is waiting." },
  { q: "What does the deposit cover?", a: "Loss or damage beyond fair wear. It comes back the day the tool does." },
  { q: "Do I need training?", a: "Only for the mitre saw, the table saw and the angle grinder. Inductions run most Saturdays." },
  { q: "Can someone else collect for me?", a: "Yes, once you have added them as a named collector on your account." },
  { q: "What if something breaks?", a: "Tell us when you return it. Tools wear out, and we would rather know." },
];

export function Faq({ seed, count = 4 }: { seed: number; count?: number }) {
  const [open, setOpen] = useState<number | null>(seed % count);
  const list = take(QUESTIONS, seed, count);
  return (
    <div className="card pad0">
      {list.map((f, i) => (
        <div key={f.q} style={{ borderBottom: i < list.length - 1 ? "1px solid var(--line)" : undefined }}>
          <button type="button" className="btn ghost block" style={{ justifyContent: "space-between", textAlign: "left", borderRadius: 0 }} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            <span>{f.q}</span>
            <Icon name={open === i ? "x" : "plus"} />
          </button>
          {open === i ? <p style={{ padding: "0 16px 14px" }}>{f.a}</p> : null}
        </div>
      ))}
    </div>
  );
}

const SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"];

export function TimeSlots({ seed }: { seed: number }) {
  const [slot, setSlot] = useState(seed % SLOTS.length);
  return (
    <div className="stack tight">
      <h3>Collection time</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {SLOTS.map((s, i) => {
          const taken = (seed + i * 5) % 7 === 0;
          return (
            <button key={s} type="button" className="chip" style={{ justifyContent: "center", opacity: taken ? 0.5 : 1 }} disabled={taken} aria-pressed={slot === i} onClick={() => setSlot(i)}>
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
