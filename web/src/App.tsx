export default function App() {
  return (
    <div className="crux-shell">
      <header className="crux-topbar">Crux</header>
      <aside className="crux-rail" aria-label="Activity">
        <p>Agents appear here once Crux splits your decision into questions.</p>
      </aside>
      <main className="crux-main">
        <section className="crux-canvas" aria-labelledby="decision-heading">
          <h1 id="decision-heading">What are you deciding?</h1>
        </section>
      </main>
    </div>
  )
}
