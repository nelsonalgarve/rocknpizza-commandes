export async function POST(request: Request) {
  const { username, password } = await request.json();

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/jwt-auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const error = await res.json();
      return new Response(JSON.stringify({ error: error.message || 'Connexion échouée' }), { status: 401 });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ token: data.token, user: data.user_nicename }), { status: 200 });
  } catch (err) {
    console.error('Erreur API login:', err);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), { status: 500 });
  }
}
