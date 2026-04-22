import { useState } from "react";
import { shortenAddress } from "../../utils/contract";
import { colors } from "../../styles/theme";

/**
 * Renders a shortened wallet/contract/tx hash address with a one-click copy
 * button and an optional "open on explorer" link.
 *
 * Props:
 *  - value: full hex string (address or tx hash)
 *  - explorerUrl: optional absolute URL to open
 *  - label: optional override for the displayed text (defaults to shortened addr)
 *  - mono: bool, render in monospace (default true)
 */
export default function CopyableAddress({ value, explorerUrl, label, mono = true }) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span style={{ color: colors.textFaint }}>{"\u2014"}</span>;

  async function handleCopy(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard may be blocked; fall back to a prompt
      window.prompt("Copy address", value);
    }
  }

  const displayed = label || shortenAddress(value);

  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: mono ? "monospace" : "inherit",
        fontSize: 12, color: colors.textDim,
      }}
      title={value}
    >
      <span>{displayed}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: copied ? colors.greenLight : colors.textDim,
          fontSize: 12, padding: "0 4px",
        }}
      >
        {copied ? "\u2713" : "\u29c9"}
      </button>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label="Open in block explorer"
          style={{ color: colors.indigoLight, textDecoration: "none", fontSize: 12 }}
        >
          {"\u29C9\u2197"}
        </a>
      )}
    </span>
  );
}
