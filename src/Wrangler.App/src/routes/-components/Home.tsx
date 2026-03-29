import { useEffect, useRef } from "react";
import "./home.css";

const GitHubIcon = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const StatusDot = ({ status }: { status: string }) => (
  <span className={`mock-status ${status}`} />
);

const WorkflowRow = ({ status, name, branch, time, delay }: { status: string; name: string; branch: string; time: string; delay: number }) => (
  <div className="mock-workflow-row" style={{ animationDelay: `${delay}s` }}>
    <StatusDot status={status} />
    <span className="mock-wf-name">{name}</span>
    <span className="mock-wf-branch">{branch}</span>
    <span className="mock-wf-time">{time}</span>
  </div>
);

const Particles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = devicePixelRatio;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number; color: string }[] = [];
    const colors = ["rgba(212,162,78,", "rgba(100,108,255,", "rgba(78,212,130,", "rgba(228,68,85,"];

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };

    const init = () => {
      resize();
      particles.length = 0;
      const count = Math.floor((canvas.width * canvas.height) / (dpr * dpr * 8000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3 * dpr,
          vy: (Math.random() - 0.5) * 0.3 * dpr,
          r: (Math.random() * 1.5 + 0.5) * dpr,
          o: Math.random() * 0.4 + 0.05,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.o})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener("resize", init);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", init);
    };
  }, []);

  return <canvas ref={canvasRef} className="particles-bg" />;
};

export const Home = () => (
  <div className="home">
    <Particles />

    <div className="home-fold">
      <header className="home-header">
        <a href="/" className="home-brand">
          <img src="/logo-white.svg" className="home-logo" alt="" />
        </a>
        <a href="/login/github" className="sign-in-btn">
          <GitHubIcon />
          <span>Sign in</span>
        </a>
      </header>

      <section className="hero">
        <div className="hero-oversized-text" aria-hidden="true">WRANGLER</div>

      <div className="hero-center">
        <p className="hero-kicker">
          <span className="kicker-line" />
          GitHub Actions Dashboard
          <span className="kicker-line" />
        </p>
        <h1>
          <span className="hero-line-1">Your builds are</span>
          <span className="hero-line-2">
            <em>scattered.</em>
            <span className="strikethrough-line" />
          </span>
          <span className="hero-line-3">We fix that.</span>
        </h1>
        <p className="hero-subtitle">
          One dashboard. Every workflow. Every repo. Every PR.<br />
          Failures surface. Noise disappears. You ship.
        </p>
        <div className="hero-actions">
          <a href="/login/github" className="cta-btn">
            <GitHubIcon />
            Start wrangling
          </a>
          <span className="cta-divider" />
          <span className="cta-note">Free during public preview</span>
        </div>
      </div>

      <div className="hero-dashboard-wrapper">
        <div className="mock-dashboard">
          <div className="mock-card" style={{ animationDelay: "0.5s" }}>
            <div className="mock-card-header">
              <StatusDot status="red" />
              <span className="mock-repo-name">payments-api</span>
            </div>
            <div className="mock-card-body">
              <WorkflowRow status="red" name="deploy-prod" branch="main" time="2m ago" delay={0.7} />
              <WorkflowRow status="green" name="build" branch="main" time="8m ago" delay={0.9} />
              <WorkflowRow status="green" name="test" branch="main" time="8m ago" delay={1.1} />
            </div>
          </div>
          <div className="mock-card" style={{ animationDelay: "0.7s" }}>
            <div className="mock-card-header">
              <StatusDot status="running" />
              <span className="mock-repo-name">web-app</span>
            </div>
            <div className="mock-card-body">
              <WorkflowRow status="running" name="e2e-tests" branch="feat/checkout" time="now" delay={1.0} />
              <WorkflowRow status="green" name="build" branch="main" time="14m ago" delay={1.2} />
            </div>
          </div>
          <div className="mock-card" style={{ animationDelay: "0.9s" }}>
            <div className="mock-card-header">
              <StatusDot status="green" />
              <span className="mock-repo-name">infrastructure</span>
            </div>
            <div className="mock-card-body">
              <WorkflowRow status="green" name="terraform-plan" branch="main" time="22m ago" delay={1.3} />
              <WorkflowRow status="green" name="lint" branch="main" time="30m ago" delay={1.5} />
            </div>
          </div>
        </div>
      </div>
    </section>

      <section className="marquee-strip">
        <div className="marquee-track">
          {[...Array(3)].map((_, i) => (
            <span key={i} className="marquee-content">
              AGGREGATE &middot; TRIAGE &middot; ACT &middot; MONITOR &middot; MERGE &middot; SHIP &middot;&nbsp;
            </span>
          ))}
        </div>
      </section>
    </div>

    <section className="features">
      <div className="feature" style={{ animationDelay: "0.1s" }}>
        <span className="feature-tag">01</span>
        <h3>Aggregate</h3>
        <div className="feature-bar" />
        <p>Every workflow across every repository, grouped by org. Red, amber, green — the status is the story.</p>
      </div>
      <div className="feature" style={{ animationDelay: "0.3s" }}>
        <span className="feature-tag">02</span>
        <h3>Triage</h3>
        <div className="feature-bar" />
        <p>Failures and in-progress runs rise to the top. At-a-glance RAG status per repo means you see only what needs attention.</p>
      </div>
      <div className="feature" style={{ animationDelay: "0.5s" }}>
        <span className="feature-tag">03</span>
        <h3>Act</h3>
        <div className="feature-bar" />
        <p>Approve and merge PRs across repos in a single view. Batch operations, zero tab-switching.</p>
      </div>
    </section>

    <footer className="home-footer">
      <div className="footer-logo">
        <img src="/logo-white.svg" alt="" />
      </div>
      <p>&copy; {new Date().getFullYear()} Wrangler CI</p>
    </footer>
  </div>
);
