export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <h1>DATABASE 47</h1>

      <p>Regionale activiteitenagenda — Lot-et-Garonne</p>

      <hr />

      <h2>Admin Dashboard</h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 20,
        marginTop: 30
      }}>
        <div><strong>Activiteiten</strong><br />0</div>
        <div><strong>Te controleren</strong><br />0</div>
        <div><strong>Organisaties</strong><br />0</div>
        <div><strong>Promoties</strong><br />0</div>
      </div>

      <h2 style={{ marginTop: 50 }}>Activiteiten</h2>

      <button style={{
        padding: "12px 20px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer"
      }}>
        + Nieuwe activiteit
      </button>
    </main>
  );
}
