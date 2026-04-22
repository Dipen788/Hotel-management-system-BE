// Global CSS animations + responsive rules injected into the page.
export const globalStyles = `
  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scrollbar-gutter: stable; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #09090b; }
  ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }

  button { transition: transform 0.12s ease, filter 0.12s ease; }
  button:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
  button:active:not(:disabled) { transform: translateY(0); }
  button:disabled { opacity: 0.4; cursor: not-allowed; filter: none; transform: none; }

  /* WCAG-friendly focus ring */
  :focus:not(:focus-visible) { outline: none; }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  a:focus-visible,
  [role="button"]:focus-visible {
    outline: 2px solid #818cf8;
    outline-offset: 2px;
    border-radius: 6px;
  }

  input, select, textarea { font-family: inherit; }
  input:invalid { box-shadow: 0 0 0 1px #ef4444; }

  /* Sensible default table scroll on small screens */
  table { min-width: 600px; }

  /* Hamburger visibility toggle: hidden on desktop, shown on mobile */
  .navbar-hamburger { display: none; }

  @media (max-width: 768px) {
    .responsive-grid { grid-template-columns: 1fr !important; }
    .responsive-nav-links { display: none !important; }
    .responsive-stats { grid-template-columns: repeat(2, 1fr) !important; }
    .navbar-hamburger { display: inline-flex !important; }
    .navbar-links { display: none !important; flex-basis: 100%; }
    .navbar-links.open { display: flex !important; flex-direction: column; align-items: stretch; }
  }
`;
