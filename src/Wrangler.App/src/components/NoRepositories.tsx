import { Link } from "@tanstack/react-router";

export const NoRepositories = () => (
  <div className="no-repositories">
    <svg className="no-repositories-image" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="30" width="140" height="100" rx="8" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" opacity="0.3" />
      <rect x="50" y="50" width="100" height="14" rx="4" fill="currentColor" opacity="0.12" />
      <rect x="50" y="72" width="80" height="14" rx="4" fill="currentColor" opacity="0.08" />
      <rect x="50" y="94" width="60" height="14" rx="4" fill="currentColor" opacity="0.05" />
      <circle cx="155" cy="115" r="30" fill="currentColor" opacity="0.08" />
      <path d="M145 115 L155 105 L165 115 M155 105 V128" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
    </svg>
    <h3>No repositories selected</h3>
    <p>Head over to <Link to="/settings">Settings</Link> to choose which repositories and workflows to monitor.</p>
  </div>
);
