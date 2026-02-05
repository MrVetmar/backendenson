export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Varlik Backend API</h1>
      <p>Version: 1.0.0</p>
      <p>Status: Running</p>
      <h2>Available Endpoints:</h2>
      <ul>
        <li>POST /api/users/register</li>
        <li>POST /api/accounts</li>
        <li>POST /api/assets</li>
        <li>GET /api/assets</li>
        <li>POST /api/assets/:id/notification</li>
        <li>GET /api/portfolio/summary</li>
        <li>POST /api/ai/portfolio-analysis</li>
        <li>GET /api/health</li>
      </ul>
    </main>
  );
}
