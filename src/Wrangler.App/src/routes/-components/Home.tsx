import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./home.css";

const GitHubIcon = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const Status = ({ status }: { status: string }) => <span className={`status-indicator ${status}`} />;

interface SampleRun { workflow: string; branch: string; time: string; status: string }

const SampleRepository = ({ name, status, runs }: { name: string; status: string; runs: SampleRun[] }) => (
  <div className="overview-card">
    <div className="overview-card-header">
      <Status status={status} />
      <h3>{name}</h3>
    </div>
    <div className="overview-card-body">
      {runs.map((run) => (
        <div key={run.workflow} className="workflow-row">
          <Status status={run.status} />
          <span className="workflow-name">{run.workflow}</span>
          <div className="workflow-run-info right">
            <Badge className="branch">{run.branch}</Badge>
            <span className="workflow-time">{run.time}</span>
            <Status status={run.status} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const useFinishedRun = () => {
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFinished(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return finished;
};

const SampleDashboard = () => {
  const finished = useFinishedRun();

  return (
    <div className="home-sample account-section" role="img" aria-label="An example Wrangler dashboard with three repositories, one of them failing">
      <div className="account-section-header">
        <h2>Acme</h2>
      </div>
      <div className="account-section-body">
        <SampleRepository name="payments-api" status="red" runs={[
          { workflow: "Deploy", branch: "main", time: "2 minutes ago", status: "red" },
          { workflow: "Build", branch: "main", time: "9 minutes ago", status: "green" },
          { workflow: "Test", branch: "main", time: "9 minutes ago", status: "green" },
        ]} />
        <SampleRepository name="web-app" status={finished ? "green" : "running"} runs={[
          { workflow: "End-to-end tests", branch: "checkout-redesign", time: finished ? "now" : "1 minute ago", status: finished ? "green" : "running" },
          { workflow: "Build", branch: "main", time: "14 minutes ago", status: "green" },
        ]} />
        <SampleRepository name="infrastructure" status="green" runs={[
          { workflow: "Terraform plan", branch: "main", time: "22 minutes ago", status: "green" },
          { workflow: "Lint", branch: "main", time: "an hour ago", status: "green" },
        ]} />
      </div>
    </div>
  );
};

const SamplePullRequests = () => (
  <div className="home-sample home-list" role="img" aria-label="Example pull requests with their check status and merge blockers">
    <div className="home-list-row">
      <span className="home-list-title">Retry failed card payments</span>
      <span className="home-list-meta">payments-api #412</span>
      <span className="home-list-badges"><Badge className="green">Success</Badge></span>
    </div>
    <div className="home-list-row">
      <span className="home-list-title">Move checkout to the new layout</span>
      <span className="home-list-meta">web-app #1088</span>
      <span className="home-list-badges">
        <Badge className="amber">Pending</Badge>
        <Badge className="blocker-behind" icon={<FontAwesomeIcon icon="code-branch" />}>Behind</Badge>
      </span>
    </div>
    <div className="home-list-row">
      <span className="home-list-title">Bump the Terraform provider</span>
      <span className="home-list-meta">infrastructure #57</span>
      <span className="home-list-badges">
        <Badge className="red">Failure</Badge>
        <Badge className="blocker-conflict" icon={<FontAwesomeIcon icon="triangle-exclamation" />}>Conflict</Badge>
      </span>
    </div>
  </div>
);

const SampleGates = () => (
  <div className="home-sample home-list" role="img" aria-label="Example deployments waiting for approval">
    <div className="home-list-row">
      <span className="home-list-title">Deploy to production</span>
      <span className="home-list-meta">payments-api, waiting 12 minutes</span>
      <span className="home-list-badges"><span className="btn btn-primary btn-sm">Approve</span></span>
    </div>
    <div className="home-list-row">
      <span className="home-list-title">Deploy to staging</span>
      <span className="home-list-meta">web-app, waiting 3 minutes</span>
      <span className="home-list-badges"><span className="btn btn-primary btn-sm">Approve</span></span>
    </div>
  </div>
);

const SampleAttention = () => (
  <div className="home-sample home-list" role="img" aria-label="Example items that need your attention">
    <div className="home-list-row">
      <span className="home-list-title">Deploy failed on main</span>
      <span className="home-list-meta">payments-api</span>
      <span className="home-list-badges"><Badge className="red">Workflow failed</Badge></span>
    </div>
    <div className="home-list-row">
      <span className="home-list-title">Move checkout to the new layout</span>
      <span className="home-list-meta">web-app #1088</span>
      <span className="home-list-badges"><Badge className="amber">Review requested</Badge></span>
    </div>
  </div>
);

export const Home = () => (
  <div className="home">
    <header className="home-header">
      <a href="/" className="home-brand">
        <img src="/logo-white.svg" alt="" />
        Wrangler
      </a>
      <a href="/login/github" className="home-sign-in">Sign in</a>
    </header>

    <main>
      <section className="home-intro">
        <h1>Your GitHub Actions and pull requests, on one screen.</h1>
        <p>
          Wrangler shows which builds are failing, which pull requests are ready to merge and which
          deployments are waiting for approval, across every repository you choose. It updates as
          GitHub reports changes, so you don't have to keep refreshing.
        </p>
        <div className="home-actions">
          <a href="/login/github" className="btn btn-primary home-cta">
            <GitHubIcon />
            Sign in with GitHub
          </a>
          <span>Free during the public preview.</span>
        </div>
      </section>

      <SampleDashboard />

      <div className="home-pages">
        <section>
          <h2>Pull requests</h2>
          <p>Every open pull request with its checks and anything blocking the merge. Approve and merge several at once.</p>
          <SamplePullRequests />
        </section>
        <section>
          <h2>Deployment gates</h2>
          <p>Runs waiting on an environment approval, from all your repositories. Approve them without opening each one.</p>
          <SampleGates />
        </section>
        <section>
          <h2>Needs your attention</h2>
          <p>Failed builds, reviews you've been asked for and security alerts. Nothing else.</p>
          <SampleAttention />
        </section>
      </div>
    </main>

    <footer className="home-footer">
      <span>&copy; {new Date().getFullYear()} Wrangler CI</span>
      <Link to="/privacy">Privacy</Link>
    </footer>
  </div>
);
