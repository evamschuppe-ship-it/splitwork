import Link from 'next/link';

const DEMO = [
  { who: 'You', part: 'Market analysis', steps: ['Research', 'Draft', 'Your slides'], pts: 7 },
  { who: 'Teammate 2', part: 'Customer survey', steps: ['Collect', 'Analyse', 'Your slides'], pts: 7 },
  { who: 'Teammate 3', part: 'Financial plan', steps: ['Model', 'Write up', 'Your slides'], pts: 7 },
  { who: 'Teammate 4', part: 'Editor', steps: ['Set up doc', 'Intro & conclusion', 'Merge'], pts: 6 },
];

export default function Landing() {
  return (
    <div className="landing">
      <section className="hero-dark">
        <div className="hero-inner">
          <p className="eyebrow">For university group-project teams</p>
          <h1>Split your group project fairly, in 30 seconds.</h1>
          <p className="lead">
            Add the project title (and your teacher&apos;s brief, if you have it). Every teammate gets
            their own clear part and deadlines, so no one ends up doing all the organising.
          </p>
          <Link href="/signup" className="btn btn-big">Sign up free</Link>
          <p className="hero-note">Free · works on your phone · already have an account? <Link href="/login">Log in</Link></p>
        </div>

        <div className="mock" aria-label="Example of a split for a 4-person marketing project">
          <div className="mock-head">
            <span className="mock-dot" /><span className="mock-dot" /><span className="mock-dot" />
            <span className="mock-title">Marketing 201 · final project · 4 people</span>
          </div>
          <div className="mock-grid">
            {DEMO.map((d) => (
              <div key={d.who} className="mock-col">
                <p className="mock-who">{d.who}</p>
                <p className="mock-part">{d.part}</p>
                <ul>
                  {d.steps.map((s) => <li key={s}>{s}</li>)}
                </ul>
                <p className="mock-pts">{d.pts} pts</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-mint" aria-label="How it works">
        <div className="band-inner">
          <h2 className="section-title">How it works</h2>
          <div className="steps">
            <div className="step">
              <span className="num">1</span>
              <h3>Add the brief</h3>
              <p>Type a title and drop in the teacher&apos;s Word or PowerPoint. We read its sections, grade weights and deadline.</p>
            </div>
            <div className="step">
              <span className="num">2</span>
              <h3>Everyone owns a part</h3>
              <p>Each person gets a self-contained chunk (research, writing, their own slides), so nobody waits on anyone else.</p>
            </div>
            <div className="step">
              <span className="num">3</span>
              <h3>Invite your group</h3>
              <p>Add teammates by email. Everyone sees who does what, by when, and ticks tasks off as they go.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="band band-warm">
        <div className="band-inner two-col">
          <div>
            <h2 className="section-title">No more being the group&apos;s project manager</h2>
            <p className="muted">The admin rotates too: weekly check-ins go to whoever has the least work, and kickoff, rehearsal and submission belong to everyone.</p>
          </div>
          <ul className="checks">
            <li>Balanced by effort, using the brief&apos;s grade weights</li>
            <li>Dependent steps stay with one person</li>
            <li>An editor joins the parts after hand-in</li>
            <li>Teacher&apos;s brief and doc link shared with the team</li>
          </ul>
        </div>
      </section>

      <section className="band cta-band">
        <div className="band-inner center">
          <h2 className="section-title light">Start your next group project the fair way</h2>
          <Link href="/signup" className="btn btn-big">Sign up free</Link>
        </div>
      </section>
    </div>
  );
}
