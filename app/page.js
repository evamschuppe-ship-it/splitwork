import Link from 'next/link';

export default function Landing() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">For university group-project teams</p>
        <h1>Split your group project fairly in 30 seconds.</h1>
        <p className="lead">
          Type your project title and SplitWork divides every section, milestone and admin task
          into a balanced timeline for each teammate — so no one ends up doing all the organising.
        </p>
        <Link href="/signup" className="btn btn-big">Sign up free</Link>
        <p className="muted small">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>

      <section className="steps" aria-label="How it works">
        <div className="step">
          <span className="num">1</span>
          <h2>Name your project</h2>
          <p>Team of 4, due in 14 days, research &amp; presentation template — all pre-filled.</p>
        </div>
        <div className="step">
          <span className="num">2</span>
          <h2>Get a balanced split</h2>
          <p>Sections and milestones are spread by effort, with dates across your timeline.</p>
        </div>
        <div className="step">
          <span className="num">3</span>
          <h2>Share with teammates</h2>
          <p>Invite your group by email. Everyone sees who does what, by when, and the doc link.</p>
        </div>
      </section>
    </>
  );
}
