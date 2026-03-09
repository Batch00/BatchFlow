import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Verify caller JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization header' })

  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user: caller } } = await callerClient.auth.getUser()
  if (!caller) return json({ error: 'Invalid token' })

  // Check admin
  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!adminEmail || caller.email !== adminEmail) return json({ error: 'Forbidden' })

  // Parse body
  const { userId } = await req.json().catch(() => ({}))
  if (!userId || typeof userId !== 'string') return json({ error: 'userId is required' })

  // Safety: never allow revoking the admin's own account
  if (caller.id === userId) return json({ error: 'Cannot revoke the admin account' })

  // Delete user via service role client
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return json({ error: error.message })

  return json({ success: true })
})
