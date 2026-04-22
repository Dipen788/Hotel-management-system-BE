import { Component } from "react";
import { styles as themeStyles, colors, gradients } from "../../styles/theme";

/**
 * Top-level error boundary. Prevents a crashed component from blanking the
 * whole app. Offers a reset path and surfaces enough detail for a user to
 * report the issue.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep a readable trace in the browser console for devs/TAs.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ ...themeStyles.app, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ ...themeStyles.card, padding: 32, maxWidth: 560, width: "100%" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: gradients.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, color: "#fff", marginBottom: 20,
          }}>!</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: colors.textDim, fontSize: 14, marginBottom: 20 }}>
            The app hit an unexpected error. You can try again, or reload if the problem persists.
          </p>

          <details style={{
            padding: 12, borderRadius: 10, background: colors.bg, border: `1px solid ${colors.border}`,
            marginBottom: 20, fontSize: 12, color: colors.textFaint, fontFamily: "monospace", overflow: "auto",
          }}>
            <summary style={{ cursor: "pointer", color: colors.textDim, fontFamily: "inherit" }}>Error details</summary>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
              {String(this.state.error?.message || this.state.error)}
              {this.state.info?.componentStack && "\n" + this.state.info.componentStack}
            </div>
          </details>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" style={{ ...themeStyles.btn("ghost"), flex: 1 }} onClick={this.handleReset}>
              Try again
            </button>
            <button type="button" style={{ ...themeStyles.btn("primary"), flex: 1 }} onClick={this.handleReload}>
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
