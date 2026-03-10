import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function respond(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Require a valid Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return respond({ error: 'Missing authorization header' })

    // 2. Require ADMIN_EMAIL secret
    const adminEmail = Deno.env.get('ADMIN_EMAIL')
    if (!adminEmail) return respond({ error: 'ADMIN_EMAIL secret is not configured on this function' })

    // 3. Require SUPABASE_SERVICE_ROLE_KEY
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return respond({ error: 'SUPABASE_SERVICE_ROLE_KEY is not available in the function environment' })

    // 4. Build admin client with service role key (not the anon key)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 5. Verify the caller's JWT and check they are the admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !caller) return respond({ error: 'Invalid or expired session' })
    if (caller.email !== adminEmail) return respond({ error: 'Forbidden' })

    // 6. List all users, filter out the admin account itself
    const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    if (error) return respond({ error: error.message })

    const users = data.users
      .filter((u) => u.email !== adminEmail)
      .map((u) => ({
        id: u.id,
        email: u.email ?? '',
        confirmed_at: u.confirmed_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        invited_at: u.invited_at ?? null,
      }))

    return respond({ users })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return respond({ error: message })
  }
})
