# WhatsApp Bot — quraşdırma təlimatı

Rəsmi **WhatsApp Cloud API** botu: qeydiyyatlar, davamiyyət, ödənişlər və
valideynlərlə yazışma birbaşa WhatsApp-dan idarə olunur.

> **Vacib:** Sinif **qruplarına** ev tapşırığı göndərişi rəsmi API-ya
> keçmir və mövcud Baileys sistemində qalır. Səbəbi: Meta-nın Groups API-si
> qrupda **maksimum 8 iştirakçıya** icazə verir və WhatsApp Business
> tətbiqindəki mövcud qrupları **görmür** ("Group chats will not be
> synchronized"). Yəni bot 1:1 ünsiyyət üçündür, qruplar üçün yox.

---

## Mərhələ 1 — Meta Business Verification

Bu, mavi quş üçün **ön şərtdir**. Mesaj göndərmək üçün məcburi deyil, amma
doğrulanmamış hesabın gündəlik limiti 250-dir.

### Əvvəlcədən lazım olanlar

| Nə | Qeyd |
|---|---|
| **Hüquqi şəxs (VÖEN)** | FS və ya MMC. Bu olmadan doğrulama keçmir — ən çox rast gəlinən uğursuzluq səbəbi. |
| **Sənəd** | Dövlət reyestrindən çıxarış, VÖEN şəhadətnaməsi, bank çıxarışı və ya kommunal qəbz. Ad və ünvan eyni olmalıdır. |
| **Domen e-poçtu** | `info@cosmochess.az`. Gmail qəbul edilmir. |
| **Sayt** | Hüquqi ad, ünvan və əlaqə məlumatı görünməlidir. |

### Addımlar

1. [business.facebook.com/settings](https://business.facebook.com/settings) → biznes portfelini seçin
2. **Security Center** (bəzi hesablarda: Business Info → Verification)
3. **Start Verification** → ölkə: Azərbaycan → biznes növü
4. Hüquqi adı **sənəddəki kimi hərfi-hərfinə** yazın
5. Sənədləri yükləyin
6. Biznes e-poçtuna/telefona gələn kodu təsdiqləyin
7. **Done** → nəzərdən keçirmə **2–5 iş günü**

### Doğrulama nə dəyişir

| | Doğrulanmamış | Doğrulanmış |
|---|---|---|
| Gündəlik limit | 250 | **2 000** |
| Qeydiyyatlı nömrə | 2 | **20** |

---

## Mərhələ 2 — Cloud API tətbiqi

1. [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create App** → növ: **Business**
2. Tətbiqə **WhatsApp** məhsulunu əlavə edin
3. **WhatsApp → API Setup** bölməsindən qeyd edin:
   - **Phone number ID**
   - **WhatsApp Business Account ID** (WABA ID)
4. **System User token** yaradın (daimi token — müvəqqəti 24 saatlıq token
   deyil):
   Business Settings → Users → System Users → Add →
   rol: Admin → **Generate token** → tətbiqi seçin →
   icazələr: `whatsapp_business_messaging`, `whatsapp_business_management`
5. **App Secret**: App → Settings → Basic → **Show**

### Nömrə seçimi — diqqət

Adi qaydada nömrəni API-ya bağlasanız, həmin nömrə telefonda WhatsApp-da
**işləməyəcək** (Meta: *"Registered numbers... cannot be used with WhatsApp"*)
və mövcud qruplarınız əlçatmaz olacaq.

İki təhlükəsiz yol:
- **Coexistence** — mövcud WhatsApp Business app hesabınızla onboard olursunuz;
  tətbiq işləməyə davam edir, qruplar toxunulmaz qalır. Geri dönüş:
  Settings → Account → Business Platform → Disconnect.
  *Qeyd:* onboarding zamanı qoşulmuş cihazlar ayrılır, ona görə **Baileys
  yenidən QR ilə qoşulmalı olacaq**.
- **Ayrıca nömrə** — bot üçün yeni nömrə; mövcud nömrəyə heç toxunulmur.
  Ən az riskli variant.

---

## Mərhələ 3 — Serverdə quraşdırma

### 3.1 Mühit dəyişənləri

`~/cosmo-crm/cosmo-crm/.env` faylına:

```bash
WA_APP_SECRET=<App Secret>
WA_VERIFY_TOKEN=<özünüz uydurduğunuz təsadüfi sətir>
WA_PHONE_NUMBER_ID=<Phone number ID>
WA_WABA_ID=<WABA ID>
WA_ACCESS_TOKEN=<System User token>
WA_ADMIN_NUMBERS=994703900007
```

`WA_ADMIN_NUMBERS` — idarəetmə menyusunu görən nömrələr (vergüllə).

Serveri yenidən başladın:
```bash
pkill -9 -f "cosmo-crm/server/inde[x].js"
```
(watchdog 2 dəqiqəyə qaldıracaq)

### 3.2 Nginx — webhook üçün

Meta `https://cosmochess.az/webhook/whatsapp` ünvanını çağıracaq. Mövcud
`vps.conf`-da `/` artıq 1124-ə yönəldiyi üçün **adətən əlavə konfiq lazım
deyil**. Yoxlayın:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://cosmochess.az/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=SIZIN_TOKEN&hub.challenge=test"
```

`200` qayıtmalıdır. `404`/`502` gəlsə, nginx-də `location /webhook/` bloku
əlavə edilməlidir.

### 3.3 Webhook-u Meta-da qeyd edin

1. App → **WhatsApp → Configuration → Webhook → Edit**
2. **Callback URL:** `https://cosmochess.az/webhook/whatsapp`
3. **Verify token:** `.env`-dəki `WA_VERIFY_TOKEN` ilə **eyni**
4. **Verify and save** → yaşıl olmalıdır
5. **Manage** → bu sahələrə abunə olun:
   - `messages` ✅ (məcburi)
   - `message_template_status_update` (şablon təsdiqi barədə xəbər)

---

## Mərhələ 4 — Şablonlar (24 saat qaydası)

Meta qaydası: insan sizə yazandan sonra **24 saat** ərzində istənilən mətni
göndərə bilərsiniz. Bu pəncərədən kənarda **yalnız təsdiqlənmiş şablon**
göndərilir.

Bu, ödəniş xatırlatmaları üçün vacibdir — valideyn sizə yazmayıbsa,
xatırlatma yalnız şablonla gedir.

### Şablon yaratmaq

WhatsApp Manager → **Message templates** → Create template →
Category: **Utility** → dil: **Azerbaijani (az)**

Nümunə (`payment_reminder`):
```
Hörmətli valideyn, {{1}} üçün {{2}} dərs keçilib və ödəniş vaxtı çatıb.
Ətraflı məlumat üçün bizimlə əlaqə saxlayın.
Cosmo Chess Academy
```

Təsdiq adətən **bir neçə saat** çəkir. Sonra CRM-də şablon adını yazın:

```bash
curl -X PUT https://cosmochess.az/api/whatsapp-cloud/settings \
  -H "Authorization: Bearer <CRM token>" -H 'Content-Type: application/json' \
  -d '{"wa_tpl_payment_reminder":"payment_reminder"}'
```

Şablon təyin edilməyibsə, pəncərə bağlı olanda sistem səssizcə uğursuz olmur —
loga aydın səbəb yazır və CRM-də "şablon təyin edilməyib" xəbərdarlığı görünür.

---

## Mərhələ 5 — Mavi quş (OBA)

Hamısı eyni anda ödənməlidir:

- Messaging Policy-yə uyğunluq
- Platformada **ən azı 30 gün**
- Portfel **Business Verification**-dan keçmiş
- Nömrədə **two-step verification** aktiv
- Görünən ad (display name) təsdiqlənmiş

**Yol:** WhatsApp Manager → Overview → nömrə → two-step verification →
Phone numbers → Profile → **Official business account** → Submit Request

Rədd cavabından sonra **30 gün** gözləmək lazımdır.

---

## Botun istifadəsi

### Müəllim üçün (admin nömrəsi)

Botun nömrəsinə **menyu** yazın:

| Əmr | Nə edir |
|---|---|
| `menyu` | Əsas menyu |
| `müraciətlər` | Yeni qeydiyyat müraciətləri → bax → qrupa yaz / rədd et |
| `bugün` | Bugünkü dərslər → davamiyyət / dərsi ləğv et |
| `ödənişlər` | Gecikmiş ödənişlər → təsdiqlə / xatırlatma göndər |
| `axtar Nicat` | Şagird axtarışı → kart → ödəniş, dərs sayı ± |
| `qruplar` | Qruplar və cədvəl |
| `hesabat` | Həftəlik xülasə |
| `stop` | Cari əməliyyatı ləğv edir |

**Davamiyyət qaydası dəyişməyib:** hamı iştirak etmiş sayılır, siz yalnız
**qayıb olanların nömrələrini** yazırsınız (məs: `2 5`), sonra üzrlü olub-
olmadığını seçirsiniz. Qayıb ödənişə **sayılmır**. Eyni dərsi iki dəfə qeyd
etmək mümkün deyil.

### Valideyn / şagird üçün

- `qeydiyyat` — 5 addımlıq yazılma (ad, soyad, doğum tarixi, səviyyə, uyğun vaxt)
  → müraciət CRM-ə düşür və müəllimə bildiriş gedir
- `vəziyyət` — öz övladının dərs sayı və ödəniş durumu
- `cədvəl` — qrupunun dərs cədvəli
- Sərbəst mesaj → müəllimə ötürülür

---

## Limitlər — nə qədər müştəri qəbul edə bilər

Meta limitləri yalnız **24 saatlıq pəncərədən kənarda** göndərilən mesajlara
tətbiq olunur:

> *"the maximum number of unique WhatsApp user phone numbers your business can
> deliver messages to, **outside of a customer service window**, within a
> moving 24-hour period"*

Praktiki nəticə:
- **Sizə yazan müştərilər (qeydiyyatlar) limitə düşmür.** Günə 10 nəfər də
  yazsa, 500 nəfər də — bot hamısına cavab verir.
- Limit yalnız **siz birinci yazanda** sayılır (ödəniş xatırlatmaları).

Pilləkən: **250 → 2 000 → 10 000 → 100 000 → Limitsiz**. Yüksəlmə avtomatikdir:
keyfiyyət reytinqi yaxşı olsa və son 7 gündə cari limitin **yarısı** istifadə
olunsa, **6 saat ərzində** bir pillə qalxır.

Saniyəlik sürət: adi nömrədə **80 mesaj/saniyə** (Coexistence nömrəsində 20).
Sistem bunu 8/saniyə ilə məhdudlaşdırır — keyfiyyət reytinqini qorumaq üçün.

---

## Yoxlama

```bash
# Bağlantı vəziyyəti (nömrə, keyfiyyət reytinqi, limit pilləsi)
curl -s https://cosmochess.az/api/whatsapp-cloud/status \
  -H "Authorization: Bearer <CRM token>" | python3 -m json.tool

# Test mesajı
curl -X POST https://cosmochess.az/api/whatsapp-cloud/send \
  -H "Authorization: Bearer <CRM token>" -H 'Content-Type: application/json' \
  -d '{"to":"994703900007","message":"Test"}'
```

`/status` cavabındakı `quality` (GREEN/YELLOW/RED) və `tier` sahələrinə
vaxtaşırı baxın — keyfiyyət düşərsə, limit yüksəlməsi dayanır.

---

## Problem həlli

| Simptom | Səbəb |
|---|---|
| Webhook "Verify and save" uğursuz | `WA_VERIFY_TOKEN` uyğun gəlmir, yaxud server işləmir |
| Webhook 403 qaytarır | `WA_APP_SECRET` yanlış və ya boşdur |
| `code 190` | Token etibarsız/vaxtı bitib — System User tokeni işlədin, müvəqqəti yox |
| `code 131030` | Qəbuledici test nömrələri siyahısında deyil (tətbiq hələ development rejimindədir) |
| `code 130429` | Sürət limiti — sistem avtomatik təkrar cəhd edir |
| Pəncərə bağlı xətası | Şablon təyin edilməyib (`wa_tpl_payment_reminder`) |
| Bot cavab vermir | `server.log`-da `[WA Webhook]` sətirlərinə baxın |
