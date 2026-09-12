// ═══════════════════════════════════════
// 🔹 SUPABASE — CONEXÃO COM O BANCO
// ═══════════════════════════════════════
// Este arquivo é o único lugar que fala com o Supabase.
// Ele depende da variável global `supabase` criada pelo CDN
// carregado no <head> do index.html (ordem de scripts preservada).
//
// Precisa carregar ANTES de qualquer arquivo que use `sb`.

//conexão do javavinha com o bd [:)]
const SUPA_URL='https://vtdfgfbscloefzvvfuwi.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZGZnZmJzY2xvZWZ6dnZmdXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MDIyOTYsImV4cCI6MjA5Mzk3ODI5Nn0.-2BgoHEJ4ih93ePRQiVkf_Q0uAVKp6M8NuMGYHIKF38';

// ── CLIENTE SUPABASE com persistência de sessão garantida ──
const sb = supabase.createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    persistSession: true,          // mantém sessão no localStorage
    autoRefreshToken: true,        // renova token automaticamente
    detectSessionInUrl: true,      // detecta token no hash (recuperação de senha)
    storageKey: 'fin-auth-token',  // chave fixa no localStorage — evita conflito
  }
});