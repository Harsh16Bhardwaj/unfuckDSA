import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Database,
  Download,
  Grip,
  LockKeyhole,
  MousePointer2,
  MonitorDown,
  SlidersHorizontal,
  TimerReset,
} from "lucide-react";
import styles from "./landing.module.css";
import ThemeToggle from "@/components/theme-toggle";

const DOWNLOAD_PATH = "/downloads/unfuckdsa-extension.zip";
const EXTENSION_VERSION = "0.6.4";

const installSteps = [
  "Download and extract the ZIP.",
  "Open chrome://extensions or edge://extensions.",
  "Turn on Developer mode, then choose Load unpacked.",
  "Select the extracted folder and open a LeetCode problem.",
];

const featureCards = [
  {
    icon: TimerReset,
    label: "Session memory",
    title: "A timer that remembers.",
    body: "Refresh or close the browser. Active time, pauses and the current problem recover without rebuilding the session.",
    tone: "coral",
  },
  {
    icon: BookOpen,
    label: "Problem library",
    title: "Every attempt stays attached.",
    body: "Approaches, blockers, hints, code versions and review history stay on one canonical problem instead of becoming duplicates.",
    tone: "purple",
  },
  {
    icon: CalendarClock,
    label: "Capacity planning",
    title: "Your calendar knows the difference.",
    body: "DSA, development and busy hours remain separate, so recall work only lands where it actually belongs.",
    tone: "lime",
  },
  {
    icon: Grip,
    label: "Weekly tasks",
    title: "Drag recurring work into place.",
    body: "Create one- or multi-hour commitments, drag them into the week, and reject collisions before they break the plan.",
    tone: "blue",
  },
  {
    icon: SlidersHorizontal,
    label: "Human control",
    title: "The algorithm never traps you.",
    body: "Move, shorten, reschedule, prioritize or remove work while keeping the reason behind each recommendation visible.",
    tone: "yellow",
  },
  {
    icon: Database,
    label: "Private workspace",
    title: "Explicit capture. Your account.",
    body: "No profile crawling or submission interception. Editor content is captured only when you deliberately end a session.",
    tone: "dark",
  },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Primary navigation">
        <Link className={styles.brand} href="/">
          <span>uD</span>
          <strong>unfuckDSA</strong>
        </Link>
        <div className={styles.navLinks}>
          <a href="#how-it-works">How it works</a>
          <a href="#extension">Extension</a>
        </div>
        <div className={styles.authLinks}>
          <ThemeToggle className={styles.landingThemeToggle} />
          <Link href="/login">Sign in</Link>
          <Link className={styles.navCta} href="/signup">
            Start free <ArrowUpRight size={15} />
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>The memory layer for serious DSA</p>
          <h1>
            Solve it today.
            <span>Still know it later.</span>
          </h1>
          <p className={styles.heroBody}>
            Track LeetCode where you solve, turn every attempt into a revision
            plan, and stop mistaking a streak for retention.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryCta} href={DOWNLOAD_PATH} download>
              <Download size={18} /> Download extension
            </a>
            <Link className={styles.secondaryCta} href="/signup">
              Create your workspace <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className={styles.trustRow}>
            <span><MonitorDown size={15} /> Chrome + Edge · v{EXTENSION_VERSION}</span>
            <span><LockKeyhole size={15} /> Private workspace</span>
            <span><MousePointer2 size={15} /> No profile scraping</span>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Product preview">
          <div className={styles.orbit} />
          <div className={styles.previewWindow}>
            <div className={styles.previewTop}>
              <span className={styles.previewBrand}>unfuckDSA</span>
              <span className={styles.liveDot}>Live</span>
            </div>
            <div className={styles.petStage}>
              <Image
                src="/sprout-pet.png"
                width={170}
                height={170}
                alt="unfuckDSA sprout companion"
                priority
              />
            </div>
            <div className={styles.previewStatus}>
              <div>
                <small>Today</small>
                <strong>184 min</strong>
              </div>
              <div className={styles.previewRing}><span>61%</span></div>
            </div>
          </div>
          <div className={`${styles.floatChip} ${styles.chipOne}`}>
            <CheckCircle2 size={17} /> Revision queued
          </div>
          <div className={`${styles.floatChip} ${styles.chipTwo}`}>
            <TimerReset size={17} /> 34 min focused
          </div>
        </div>

        <a className={styles.scrollCue} href="#how-it-works">
          See the system <ArrowDown size={16} />
        </a>
      </section>

      <nav className={styles.sectionNav} aria-label="Jump through the product tour">
        <a href="#capture"><span>01</span> Capture</a>
        <a href="#retain"><span>02</span> Retain</a>
        <a href="#plan"><span>03</span> Plan</a>
        <a href="#features"><span>+</span> Everything else</a>
        <a href="#extension"><Download size={14} /> Get extension</a>
      </nav>

      <section className={styles.stack} id="how-it-works">
        <article className={`${styles.storyCard} ${styles.captureCard}`} id="capture">
          <div className={styles.storyCopy}>
            <span className={styles.storyNumber}>01 / Capture</span>
            <h2>The tracker lives where the work happens.</h2>
            <p>
              Start on the LeetCode page. The timer survives refreshes, pauses
              interruptions, and only captures your editor when you explicitly end.
            </p>
            <ul>
              <li><CheckCircle2 /> Pause time is excluded</li>
              <li><CheckCircle2 /> Reflect without leaving the problem</li>
              <li><CheckCircle2 /> Skip, use defaults, or add full context</li>
            </ul>
          </div>
          <div className={styles.overlayDemo}>
            <header><span>uD</span><b>Reverse Integer</b><i /></header>
            <small>ACTIVE SESSION</small>
            <strong>00:34:18</strong>
            <div className={styles.demoControls}>
              <button aria-label="Pause demo"><span>Ⅱ</span></button>
              <button aria-label="End demo"><span>■</span></button>
            </div>
          </div>
        </article>

        <article className={`${styles.storyCard} ${styles.retainCard}`} id="retain">
          <div className={styles.storyCopy}>
            <span className={styles.storyNumber}>02 / Retain</span>
            <h2>A revision queue that has a reason.</h2>
            <p>
              Difficulty, active time, blockers, priority and recall quality decide
              what returns next. Every placement remains visible and editable.
            </p>
            <div className={styles.priorityEquation}>
              <span>overdue</span><b>+</b><span>blocker</span><b>+</b><span>hot topic</span>
            </div>
          </div>
          <div className={styles.queueDemo}>
            <div className={styles.queueHeader}><b>Today&apos;s recall</b><span>3 items</span></div>
            {[
              ["Lowest Common Ancestor", "Trees", "92"],
              ["Course Schedule", "Graphs", "78"],
              ["Daily Temperatures", "Stack", "61"],
            ].map(([name, topic, score], index) => (
              <div className={styles.queueItem} key={name}>
                <span className={styles.queueIndex}>0{index + 1}</span>
                <div><strong>{name}</strong><small>{topic} · due today</small></div>
                <b>{score}</b>
              </div>
            ))}
          </div>
        </article>

        <article className={`${styles.storyCard} ${styles.planCard}`} id="plan">
          <div className={styles.storyCopy}>
            <span className={styles.storyNumber}>03 / Plan</span>
            <h2>Your real week, not an imaginary schedule.</h2>
            <p>
              Paint DSA, development and busy time. Add recurring weekly tasks,
              then place them as clean, consecutive blocks without collisions.
            </p>
            <Link className={styles.cardLink} href="/signup">
              Build your week <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className={styles.calendarDemo}>
            <div className={styles.calendarHeader}>
              {['M', 'T', 'W', 'T', 'F'].map((day, index) => <b key={`${day}-${index}`}>{day}</b>)}
            </div>
            <div className={styles.calendarGrid}>
              {Array.from({ length: 20 }).map((_, index) => (
                <span
                  className={index === 6 || index === 11 ? styles.dsaBlock : index === 13 || index === 18 ? styles.devBlock : index === 9 ? styles.busyBlock : ""}
                  key={index}
                />
              ))}
            </div>
            <div className={styles.taskPill}><CalendarRange size={16} /><b>HLD round</b><span>×2</span></div>
          </div>
        </article>
      </section>

      <section className={styles.featureSection} id="features">
        <div className={styles.featureHeading}>
          <div>
            <p className={styles.darkKicker}>Built around the messy parts</p>
            <h2>Small decisions, handled properly.</h2>
          </div>
          <p>
            The main loop is simple. The details underneath it are not—and those
            details are what keep a revision system usable after the first week.
          </p>
        </div>
        <div className={styles.featureGrid}>
          {featureCards.map(({ icon: Icon, label, title, body, tone }, index) => (
            <article className={`${styles.featureCard} ${styles[tone]}`} key={title}>
              <div className={styles.featureTop}>
                <span><Icon size={20} /></span>
                <b>0{index + 1}</b>
              </div>
              <small>{label}</small>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.downloadSection} id="extension">
        <div className={styles.downloadCopy}>
          <p className={styles.kicker}>Extension v{EXTENSION_VERSION} · One small install. Zero tab switching.</p>
          <h2>Your LeetCode companion, ready for Chromium.</h2>
          <p>
            The ZIP contains only the built extension files required by Chrome and
            Edge. No repository checkout and no development tools are needed.
          </p>
          <a className={styles.downloadButton} href={DOWNLOAD_PATH} download>
            <Download size={20} /> Download extension ZIP
          </a>
        </div>
        <ol className={styles.installList}>
          {installSteps.map((step, index) => (
            <li key={step}><span>{index + 1}</span><p>{step}</p></li>
          ))}
        </ol>
      </section>

      <section className={styles.finalCta}>
        <BrainCircuit size={46} />
        <h2>Your solved list is not your memory.</h2>
        <p>Build a system that brings the right problem back before it disappears.</p>
        <div>
          <Link href="/signup">Create workspace <ArrowUpRight size={17} /></Link>
          <Link href="/login">Sign in</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/"><span>uD</span><strong>unfuckDSA</strong></Link>
        <p>Recall before rust.</p>
        <Link href="/dashboard">Open dashboard <ArrowUpRight size={14} /></Link>
      </footer>
    </main>
  );
}
