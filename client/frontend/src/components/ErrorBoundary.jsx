import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen grid place-items-center px-6 text-center">
      <div role="alert">
        <p className="eyebrow">Let's try that again</p>
        <h1 className="text-4xl">Something interrupted your visit.</h1>
        <p className="mb-6">Reload the page to continue. If a payment was processing, check its confirmation before paying again.</p>
        <button type="button" className="primary-button" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    </main>;
  }
}
