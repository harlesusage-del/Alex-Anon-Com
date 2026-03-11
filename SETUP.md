# ALEX PWA Setup Guide
## Push Notifications + Service Worker

---

## Overview

ALEX sekarang adalah **Progressive Web App (PWA)** dengan push notifications. User yang tidak sedang membuka app tetap bisa menerima notifikasi pesan dan panggilan.

**Bagaimana cara kerjanya:**
```
User B (offline dari room) ← OS Push Notification ← Supabase Edge Function ← User A (kirim pesan)
                                                              ↑
                                          Subscription endpoint disimpan di Supabase DB
```

---

## Step 1: Generate VAPID Keys

VAPID keys adalah credential untuk server push notifications. Generate sekali, simpan selamanya.

```bash
# Install web-push CLI (jika belum ada)
npm install -g web-push

# Generate keys
npx web-push generate-vapid-keys
```

Output akan seperti ini:
```
Public Key:  BFx...xxxxx (paste di CONFIG + Supabase)
Private Key: abc...xxxxx (paste di Supabase saja, JANGAN di frontend)
```

---

## Step 2: Jalankan SQL Migration di Supabase

1. Buka **Supabase Dashboard** → project kamu → **SQL Editor**
2. Paste isi file `supabase/migrations/push_subscriptions.sql`
3. Klik **Run**

Ini akan membuat:
- Table `push_subscriptions` 
- RLS policies (aman, anonymous)
- Function `upsert_push_subscription`

---

## Step 3: Deploy Edge Function ke Supabase

```bash
# Install Supabase CLI jika belum
npm install -g supabase

# Login ke Supabase
supabase login

# Link ke project kamu
supabase link --project-ref hlsxvsmraineuxicmkro

# Deploy Edge Function
supabase functions deploy send-push
```

---

## Step 4: Set Environment Variables di Supabase

Buka: **Supabase Dashboard** → **Settings** → **Edge Functions** → **Environment Variables**

Tambahkan:

| Key | Value |
|-----|-------|
| `VAPID_PUBLIC_KEY` | Public key dari Step 1 |
| `VAPID_PRIVATE_KEY` | Private key dari Step 1 |
| `VAPID_SUBJECT` | `mailto:email-kamu@domain.com` |

> `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` sudah otomatis tersedia di Edge Functions.

---

## Step 5: Update CONFIG di app.js

Buka `js/app.js`, cari bagian `CONFIG`, update:

```javascript
VAPID_PUBLIC_KEY: 'PASTE_PUBLIC_KEY_DISINI',
PUSH_FUNCTION_URL: 'https://hlsxvsmraineuxicmkro.supabase.co/functions/v1/send-push',
```

---

## Step 6: Generate App Icons

Icons dibutuhkan untuk PWA installation. Generate dari satu SVG/PNG:

**Online tool:** https://www.pwabuilder.com/imageGenerator

Upload icon 512x512, download semua ukuran, letakkan di folder `icons/`:
```
icons/
  icon-72.png
  icon-96.png
  icon-128.png
  icon-144.png
  icon-152.png
  icon-192.png
  icon-384.png
  icon-512.png
  badge-72.png   ← icon kecil untuk badge di notifikasi (opsional, bisa pakai icon-72)
```

---

## Step 7: Deploy ke Vercel

Pastikan semua file ini ada di root project:
```
/
├── index.html
├── manifest.json
├── sw.js              ← PENTING: harus di root, bukan di subfolder
├── icons/
│   └── icon-*.png
├── css/
│   └── main.css
└── js/
    └── app.js
```

Push ke GitHub → Vercel auto-deploy.

**Vercel.json (jika perlu):**
```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        { "key": "Content-Type", "value": "application/manifest+json" }
      ]
    }
  ]
}
```

---

## Testing Push Notifications

### Test di Desktop (Chrome):
1. Buka app di Chrome
2. Masuk ke Private Chat
3. Sidebar kiri akan muncul section **"Notifications"**
4. Klik **"🔔 Enable Push Notifications"**
5. Allow permission
6. Minimize atau pindah tab
7. Dari device/tab lain, kirim pesan ke room yang sama
8. Notifikasi harus muncul!

### Test di Android:
1. Buka app di Chrome Android
2. Chrome akan otomatis muncul banner **"Add to Home Screen"**
3. Install app ke home screen
4. Enable notifications
5. Minimize app
6. Kirimi pesan dari device lain → notifikasi muncul di status bar

### Test di iOS (Safari):
1. iOS 16.4+ support Web Push di Safari
2. Buka di Safari → Share → **Add to Home Screen**
3. Buka dari home screen (bukan dari Safari langsung!)
4. Enable notifications

---

## Custom Notification Sound

Di dalam app (sidebar Private Rooms → Notifications):
- **Preset sounds:** Default, Chime, Pulse, Soft
- **Upload custom:** Klik "Upload MP3/OGG" → pilih file audio (max 500KB)
- Sound custom disimpan di localStorage (per-device)

---

## Privacy Notes

- Push subscriptions disimpan di Supabase sebagai hash (SHA-256 dari roomId+password)
- Supabase tidak bisa mengetahui roomId atau password sebenarnya dari hash
- Subscription otomatis dihapus saat user keluar room
- Tidak ada user ID, tidak ada tracking

---

## Troubleshooting

**"SW registration failed":**
- Pastikan `sw.js` ada di root domain (bukan `/js/sw.js`)
- Harus menggunakan HTTPS (Vercel sudah HTTPS by default)

**Push tidak diterima:**
- Cek Supabase Edge Function logs: Dashboard → Edge Functions → send-push → Logs
- Pastikan VAPID keys sudah di-set di environment variables
- Cek table `push_subscriptions` apakah subscription tersimpan

**"Notifications blocked":**
- User harus reset permission: Chrome → Settings → Privacy → Site Settings → Notifications → Reset
