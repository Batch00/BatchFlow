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

    // 3. Require SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase but guard against
    //    misconfigured deployments where it may be absent
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

    // 6. Parse request body
    const body = await req.json().catch(() => ({}))
    const { email } = body
    if (!email || typeof email !== 'string') return respond({ error: 'email is required' })

    // 7. Send the invite — only include redirectTo when SITE_URL is configured and
    //    the URL is added to Supabase Auth → URL Configuration → Redirect URLs
    const siteUrl = Deno.env.get('SITE_URL')
    const inviteOptions = siteUrl ? { redirectTo: siteUrl } : undefined

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, inviteOptions)
    if (error) return respond({ error: error.message })

    return respond({ user: { id: data.user.id, email: data.user.email } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return respond({ error: message })
  }
})
