export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true" aria-live="polite">
      <div className="loading-spinner" />
      <p>Carregando configuracoes...</p>
    </main>
  );
}
