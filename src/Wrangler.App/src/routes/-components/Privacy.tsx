import { Link } from "@tanstack/react-router";
import "./privacy.css";

export const Privacy = () => (
  <div className="privacy">
    <header className="privacy-header">
      <Link to="/" className="privacy-brand">
        <img src="/logo-white.svg" alt="Wrangler CI" />
        <span>Wrangler CI</span>
      </Link>
    </header>

    <main className="privacy-content">
      <h1>Privacy</h1>
      <p className="privacy-lede">
        Wrangler CI is a dashboard for your GitHub Actions and pull requests. Here's
        plainly what we do with your data.
      </p>

      <section>
        <h2>What we store about you</h2>
        <p>
          When you sign in with GitHub, we ask GitHub for a short summary about you
          and the repositories you've installed the Wrangler app on. To keep the
          dashboard fast, we hold on to a copy of that information for up to
          30 minutes after we last needed it &mdash; things like:
        </p>
        <ul>
          <li>The list of repositories you can see.</li>
          <li>Each repository's workflows and their most recent runs.</li>
          <li>Open pull requests in those repositories.</li>
          <li>Your GitHub login name, so we can greet you.</li>
        </ul>
        <p>
          We do not collect anything you wouldn't already see when browsing GitHub
          yourself, and we do not sell, share, or analyse your data for any other
          purpose.
        </p>
      </section>

      <section>
        <h2>Why we set a cookie</h2>
        <p>
          When you sign in, your browser receives a single cookie named
          <code> .GitHub.Session</code>. It only does one job: it tells Wrangler
          who you are on each request so we can show you your dashboard and
          nobody else's. It's marked secure and HTTP-only, which means it travels
          only over HTTPS and isn't readable by other websites or by scripts on
          this page.
        </p>
        <p>
          We don't use cookies for advertising, analytics, or tracking you across
          other sites.
        </p>
      </section>

      <section>
        <h2>What happens when you log out</h2>
        <p>
          Logging out tells our server to discard your session entirely. We
          forget your GitHub access token, we drop the cookie that identified
          you, and the cached GitHub information described above is no longer
          tied to you &mdash; the next time it's needed it has to be fetched fresh
          from GitHub.
        </p>
        <p>
          Uninstalling the Wrangler GitHub app from your account or organisation
          also stops the flow of new data. We never had write access to your
          repositories beyond the actions you explicitly took in the dashboard.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          Wrangler CI is an open-source side project. If something about how your
          data is handled looks off, please open an issue on{" "}
          <a href="https://github.com/AndrewMcLachlan/WranglerCI/issues" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </section>
    </main>

    <footer className="privacy-footer">
      <p>&copy; {new Date().getFullYear()} Wrangler CI</p>
    </footer>
  </div>
);
