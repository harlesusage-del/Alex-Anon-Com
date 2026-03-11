/**
 * ALEX — Supabase Edge Function: send-push
 * ─────────────────────────────────────────────────────────────────────
 * Triggered by app.js when:
 *   - A message is sent to a room
 *   - An incoming call is initiated
 *
 * Required environment variables (set in Supabase Dashboard → Settings → Edge Functions):
 *   VAPID_PUBLIC_KEY   — your VAPID public key
 *   VAPID_PRIVATE_KEY  — your VAPID private key
 *   VAPID_SUBJECT      — mailto:you@yourdomain.com
 *   SUPABASE_URL       — auto-provided by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase
 *
 * To generate VAPID keys, run in terminal:
 *   npx web-push generate-vapid-keys
 *
 * Request body (POST):
 *   {
 *     channel_hash: string,   // SHA-256 hash of roomId:password
 *     sender_session: string, // Don't push to self
 *     payload: {
 *       type: 'message' | 'call' | 'call_end',
 *       roomId: string,
 *       senderName: string,
 *       preview?: string,
 *       callType?: 'voice' | 'video',
 *     }
 *   }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Web Push via web-push compatible implementation
// We implement VAPID signing manually since Deno doesn't have Node crypto

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  /* CORS preflight */
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { channel_hash, sender_session, payload } = await req.json();

    if (!channel_hash || !payload) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    /* ── Init Supabase with service role (can read push_subscriptions) ── */
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    /* ── Fetch subscriptions for this channel (exclude sender) ── */
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('session_id, subscription')
      .eq('channel_hash', channel_hash)
      .neq('session_id', sender_session || '')
      .limit(10); // max 10 recipients per room

    if (error) {
      console.error('[send-push] DB error:', error);
      return new Response(JSON.stringify({ error: 'DB error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_subscribers' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    /* ── Build notification payload ── */
    const notifPayload = JSON.stringify({
      ...payload,
      icon:  '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      timestamp: Date.now(),
    });

    /* ── VAPID config ── */
    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject    = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@alex.app';

    /* ── Send push to each subscriber ── */
    const results = await Promise.allSettled(
      subs.map(sub => sendWebPush(sub.subscription, notifPayload, {
        vapidPublicKey, vapidPrivateKey, vapidSubject,
      }))
    );

    /* ── Clean up expired subscriptions (HTTP 410) ── */
    const expiredSessions: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.status === 410) {
        expiredSessions.push(subs[i].session_id);
      }
    });

    if (expiredSessions.length > 0) {
      await supabase.from('push_subscriptions')
        .delete()
        .in('session_id', expiredSessions)
        .eq('channel_hash', channel_hash);
    }

    const sent = results.filter(r => r.status === 'fulfilled' &&
      (r.value.status === 201 || r.value.status === 200)).length;

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[send-push] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   Web Push sender using VAPID (Deno-compatible, no Node.js deps)
   ═══════════════════════════════════════════════════════════════════ */

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapid: { vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string }
): Promise<Response> {
  const endpoint = subscription.endpoint;
  const origin   = new URL(endpoint).origin;

  /* ── Generate VAPID JWT ── */
  const vapidToken = await createVapidJWT(origin, vapid);

  /* ── Encrypt payload with ECDH + HKDF + AES-GCM ── */
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    payload,
    subscription.keys.p256dh,
    subscription.keys.auth,
  );

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization':  `vapid t=${vapidToken}, k=${vapid.vapidPublicKey}`,
      'Content-Type':   'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL':            '86400',
    },
    body: buildAes128GcmBody(salt, serverPublicKey, ciphertext),
  });
}

/* ── VAPID JWT creation ── */
async function createVapidJWT(
  audience: string,
  { vapidPublicKey, vapidPrivateKey, vapidSubject }: { vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string }
): Promise<string> {
  const header  = base64urlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64urlEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: vapidSubject,
  }));

  const signingInput = `${header}.${payload}`;

  const privateKeyBytes = base64urlDecode(vapidPrivateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64urlEncode(signature)}`;
}

/* ── RFC 8291 payload encryption ── */
async function encryptPayload(
  plaintext: string,
  recipientPublicKeyB64: string,
  authB64: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();

  /* Generate server ECDH key pair */
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveKey', 'deriveBits']
  );

  /* Import recipient public key */
  const recipientPublicKeyBytes = base64urlDecode(recipientPublicKeyB64);
  const recipientPublicKey = await crypto.subtle.importKey(
    'raw', recipientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  /* ECDH shared secret */
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPublicKey },
    serverKeyPair.privateKey, 256
  );

  /* Export server public key */
  const serverPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );

  /* Random salt */
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const auth = base64urlDecode(authB64);

  /* HKDF to derive content encryption key + nonce */
  const prk = await hkdf(new Uint8Array(sharedSecret), auth,
    concat(encoder.encode('WebPush: info\x00'), recipientPublicKeyBytes, serverPublicKeyBytes),
    32
  );

  const cek   = await hkdf(prk, salt, encoder.encode('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hkdf(prk, salt, encoder.encode('Content-Encoding: nonce\x00'), 12);

  /* Import CEK */
  const cryptoKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);

  /* Pad and encrypt */
  const plaintextBytes = encoder.encode(plaintext);
  const padded = new Uint8Array(plaintextBytes.length + 2);
  padded.set(plaintextBytes);
  padded[plaintextBytes.length] = 0x02; // padding delimiter

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, padded)
  );

  return { ciphertext, salt, serverPublicKey: serverPublicKeyBytes };
}

function buildAes128GcmBody(
  salt: Uint8Array,
  serverPublicKey: Uint8Array,
  ciphertext: Uint8Array
): Uint8Array {
  /* Header: salt(16) + rs(4) + keyidlen(1) + keyid(65) + ciphertext */
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  return concat(salt, rs, new Uint8Array([serverPublicKey.length]), serverPublicKey, ciphertext);
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key, len * 8
  );
  return new Uint8Array(bits);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function base64urlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const str    = atob(padded);
  return Uint8Array.from(str, c => c.charCodeAt(0));
}
