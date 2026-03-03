import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SubmitBody = {
  city?: string;
  country?: string;
  message?: string | null;
  turnstileToken?: string;
};

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const allowedHost = (() => {
  if (allowedOrigin === '*') return '';
  try {
    return new URL(allowedOrigin).hostname;
  } catch {
    return '';
  }
})();

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (!forwardedFor) return '';
  return forwardedFor.split(',')[0]?.trim() ?? '';
}

function normalizeInput(body: SubmitBody) {
  const city = (body.city ?? '').trim();
  const country = (body.country ?? '').trim();
  const messageRaw = typeof body.message === 'string' ? body.message.trim() : '';
  const message = messageRaw.length ? messageRaw : null;
  const turnstileToken = (body.turnstileToken ?? '').trim();

  return { city, country, message, turnstileToken };
}

function validateInput(input: ReturnType<typeof normalizeInput>): string | null {
  if (!input.city || input.city.length > 100) return 'Invalid city.';
  if (!input.country || input.country.length > 100) return 'Invalid country.';
  if (input.message && input.message.length > 280) return 'Message too long.';
  if (!input.turnstileToken) return 'Missing Turnstile token.';
  return null;
}

async function verifyTurnstile(req: Request, token: string) {
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY') ?? '';
  if (!turnstileSecret) return false;

  const body = new URLSearchParams({
    secret: turnstileSecret,
    response: token
  });

  const remoteIp = getClientIp(req);
  if (remoteIp) body.set('remoteip', remoteIp);

  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!resp.ok) return false;

  const payload = await resp.json();
  if (!payload?.success) return false;

  if (allowedHost) {
    const tokenHost = String(payload?.hostname ?? '');
    if (!tokenHost || tokenHost !== allowedHost) return false;
  }

  return true;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  if (allowedOrigin !== '*') {
    const origin = req.headers.get('origin');
    if (origin && origin !== allowedOrigin) {
      return json({ error: 'Origin not allowed.' }, 403);
    }
  }

  let parsed: SubmitBody;
  try {
    parsed = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const input = normalizeInput(parsed);
  const inputError = validateInput(input);
  if (inputError) return json({ error: inputError }, 400);

  try {
    const turnstileOk = await verifyTurnstile(req, input.turnstileToken);
    if (!turnstileOk) {
      return json({ error: 'Turnstile verification failed.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRole) {
      return json({ error: 'Function secrets are not configured.' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false }
    });

    const { error } = await admin
      .from('visitors')
      .insert([{ city: input.city, country: input.country, message: input.message }]);

    if (error) {
      return json({ error: 'Insert failed.' }, 500);
    }

    return json({ ok: true });
  } catch {
    return json({ error: 'Unexpected server error.' }, 500);
  }
});
