import logo from "./assets/disastrack-icon.png";

/**
 * Full-screen loading page (shown while Firebase checks for an existing login).
 * Logo + system name on the dark background, with a radar-style pulse and a small progress bar.
 */
export default function LoadingScreen({ message = "Loading…" }) {
  return (
    <main className="loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-screen__logo-wrap">
        <span className="loading-screen__pulse" aria-hidden="true" />
        <span className="loading-screen__pulse loading-screen__pulse--late" aria-hidden="true" />
        <img className="loading-screen__logo" src={logo} alt="" />
      </div>
      <h1 className="loading-screen__name">DisasTrack</h1>
      <p className="loading-screen__tag">Disaster reporting &amp; rescue coordination</p>
      <div className="loading-screen__bar" aria-hidden="true"><span /></div>
      <p className="loading-screen__msg">{message}</p>
    </main>
  );
}
