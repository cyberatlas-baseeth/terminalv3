# Terminal 🖥️

**Terminal**, Farcaster platformunda çalışan, siber güvenlik temalı bir hafıza oyunudur. Oyuncular, sahte ağ düğümlerini tespit etmek için hafızalarını test ederler ve doğru tahminlerle **ASLR token** kazanırlar.

## 🎮 Oyun Açıklaması

Oyun, bir ağ güvenlik senaryosu üzerine kurulmuştur. Oyuncular, sistemde yetkisiz bir düğüm tespit edildiğinde hafıza doğrulama protokolünü başlatır. Amaç, gösterilen sayıları hatırlayarak sahte sayıyı bulmaktır.

### Oyun Akışı

1. **Başlangıç**: Sistem bağlantı kurar ve yetkisiz bir düğüm tespit eder
2. **Sayı Gösterimi**: Ekranda 6 adet 3 haneli sayı 10 saniye boyunca gösterilir
3. **Seçim Aşaması**: 3 sayı arasından sahte olanı bulmanız istenir
4. **Sonuç**: Doğru tahmin = 10 ASLR token kazanılır, yanlış tahmin = oyun biter

### Tur Sistemi

- Toplam **3 tur** bulunur
- Her tur başında yeni sayılar gösterilir
- Yanlış bir tahmin tüm oyunu bitirir
- Tüm turları tamamlayan oyuncu maksimum **30 ASLR token** kazanır

## 🏆 Liderlik Tablosu

Oyuncular toplam kazandıkları ASLR token sayısına göre sıralanır. En yüksek token'a sahip oyuncular liderlik tablosunda üst sıralarda yer alır.

## ⏱️ Bekleme Süresi (Cooldown)

- Oyuncular her **2 dakikada** bir yeni oyun başlatabilir
- Bu süre, oyunun adil ve dengeli kalmasını sağlar

## 🛠️ Teknik Detaylar

### Teknoloji Yığını

- **Framework**: Next.js 14 (App Router)
- **Dil**: TypeScript
- **Veritabanı**: PostgreSQL (Neon)
- **Platform**: Farcaster MiniApp
- **Stil**: CSS (Terminal teması)

### Proje Yapısı

```
src/
├── app/
│   ├── api/
│   │   ├── game/          # Oyun API'leri (start, answer)
│   │   ├── leaderboard/   # Liderlik tablosu API'si
│   │   └── player/        # Oyuncu istatistikleri
│   ├── page.tsx           # Ana oyun bileşeni
│   ├── layout.tsx         # Uygulama layout'u
│   └── globals.css        # Global stiller
└── lib/
    ├── db.ts              # Veritabanı bağlantısı
    ├── farcaster.ts       # Farcaster SDK entegrasyonu
    └── gameLogic.ts       # Oyun mantığı ve konfigürasyonu
```

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+
- PostgreSQL veritabanı
- Farcaster hesabı (test için)

### Adımlar

1. **Bağımlılıkları yükleyin**
   ```bash
   npm install
   ```

2. **Ortam değişkenlerini ayarlayın**
   ```bash
   cp .env.example .env.local
   ```
   
   `.env.local` dosyasını düzenleyin:
   ```
   DATABASE_URL=postgresql://...
   ```

3. **Veritabanı tablolarını oluşturun**
   ```sql
   CREATE TABLE players (
     fid INTEGER PRIMARY KEY,
     total_tokens INTEGER DEFAULT 0,
     total_sessions INTEGER DEFAULT 0,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE sessions (
     id UUID PRIMARY KEY,
     fid INTEGER REFERENCES players(fid),
     started_at TIMESTAMP DEFAULT NOW(),
     completed_at TIMESTAMP,
     tokens_earned INTEGER DEFAULT 0,
     rounds_completed INTEGER DEFAULT 0
   );
   ```

4. **Geliştirme sunucusunu başlatın**
   ```bash
   npm run dev
   ```

5. **Tarayıcıda açın**
   ```
   http://localhost:3000
   ```

## 📝 Oyun Konfigürasyonu

`src/lib/gameLogic.ts` dosyasından oyun ayarları değiştirilebilir:

| Ayar | Varsayılan | Açıklama |
|------|------------|----------|
| `TOTAL_ROUNDS` | 3 | Toplam tur sayısı |
| `COOLDOWN_MINUTES` | 2 | Bekleme süresi (dakika) |
| `TOKENS_PER_CORRECT` | 10 | Doğru tahmin başına token |
| `MAX_TOKENS_PER_SESSION` | 30 | Oturum başına maksimum token |

## 🎨 Tema

Oyun, retro terminal estetiğine sahiptir:
- Siyah arka plan
- Yeşil fosforlu yazılar
- Tarama çizgisi efekti
- Glitch animasyonları

## 📄 Lisans

MIT License

---

**Terminal** - Hafızanı test et, sahte düğümü bul! 🔍
