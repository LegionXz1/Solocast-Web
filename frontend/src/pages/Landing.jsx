import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Palette,
  Sparkles,
  Dices,
  Skull,
  Megaphone,
  Award,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Headphones,
  Check,
  Star,
  Monitor
} from 'lucide-react';
import ChickenMascot from '../components/ChickenMascot';

const SERVICES = [
  {
    id: 'dbd-perks',
    badge: 'Gaming Overlay',
    badgeColor: '#A855F7',
    title: 'DBD Perk Roulette',
    subtitle: 'วงล้อสุ่ม Perk Dead by Daylight สตรีมเมอร์',
    icon: Dices,
    desc: 'ระบบสุ่ม Perk สำหรับผู้รอดชีวิต (Survivor) และฆาตกร (Killer) เพิ่มความท้าทายและสีสันให้คนดูร่วมสนุก สุ่ม Perk ท้าทายสตรีมเมอร์ได้ตลอดเวลา',
    highlights: [
      'กรอง Perk ที่ไม่ต้องการเล่นได้อิสระ',
      'สุ่มผ่าน Channel Points หรือคำสั่งแชท Twitch',
      'อัปเดต Perk ล่าสุด'
    ]
  },
  {
    id: 'random-killer',
    badge: 'Viewer Interactive',
    badgeColor: '#EF4444',
    title: 'DBD Killer Roulette',
    subtitle: 'วงล้อสุ่มฆาตกร Dead by Daylight',
    icon: Skull,
    desc: 'ให้ผู้ชมหรือตัวคุณเองสุ่ม Killer สำหรับแต่ละแมตช์ มาพร้อมรูปภาพ Portrait ประจำตัวฆาตกรครบทุกตัว พร้อมระบบตัดตัวละครที่ไม่ต้องการเล่น',
    highlights: [
      'คัดกรอง Killer ที่ยังไม่ปลดล็อกได้',
      'รูป Killer ความละเอียดสูง',
      'มีแอนิเมชันเปิดตัวการ์ด',
      'ประวัติการสุ่มบันทึกเก็บไว้ดูย้อนหลังได้ทันที'
    ],
    preview: {
      type: 'killer',
      name: 'The Trapper',
      alias: 'Evan MacMillan',
      badge: 'Selected Killer'
    }
  },
  {
    id: 'twitch-shoutout',
    badge: 'Stream Engagement',
    badgeColor: '#8B5CF6',
    title: 'Twitch Shoutout Overlay',
    subtitle: 'ป้ายแนะนำและต้อนรับสตรีมเมอร์คนพิเศษ',
    icon: Megaphone,
    desc: 'ป้ายแบนเนอร์แสดงโปรโมตสตรีมเมอร์คนโปรดหรือ VIP บนหน้าจอ  แบบอัตโนมัติเมื่อมีคำสั่ง /shoutout หรือ Raid เข้ามาในช่อง',
    highlights: [
      'ดึงรูป Avatar โปรไฟล์ และชื่อเกมล่าสุดที่สตรีมมาแสดงผล',
      'แอนิเมชันสไลด์เข้าออกนุ่มนวล',
      'ปรับแต่งเสียง Custom Sound, ระยะเวลาแสดง และสีธีมได้ 100%',
      'รองรับการทดสอบพรีวิวก่อนขึ้นไลฟ์จริง'
    ],
    preview: {
      type: 'shoutout',
      username: 'GamerGirl_Pro',
      game: 'Dead by Daylight',
      message: 'ฝากติดตามสตรีมเมอร์คนเก่งด้วยนะกุ๊ก!'
    }
  },
  {
    id: 'loyalty-card',
    badge: 'Viewer Stamp System',
    badgeColor: '#F59E0B',
    title: 'Stamp Card',
    subtitle: 'บัตรสะสมแต้มสำหรับผู้ชม',
    icon: Award,
    desc: 'ระบบการ์ดสะสมแต้ม ช่วยกระตุ้นให้ผู้ชมมีส่วนร่วมและกลับมาดูสตรีมของคุณอย่างต่อเนื่อง',
    highlights: [
      'การ์ดแสตมป์',
      'Leaderboard จัดอันดับ Top Fan ผู้ชมที่แต้มสะสมสูงสุด',
      'แจ้งเตือนแสตมป์ใหม่แบบ Real-Time บนจอ',
      'ผูกคำสั่งหรือ Channel Points สำหรับปั๊มแสตมป์'
    ],
    preview: {
      type: 'loyalty',
      stamps: 8,
      maxStamps: 10,
      fan: 'Viewer_No1'
    }
  }
];

const PLATFORM_FEATURES = [
  {
    icon: Zap,
    title: 'Zero Latency WebSockets',
    desc: 'เชื่อมต่อ Twitch EventSub โดยตรงผ่าน WebSockets บนเครื่องของคุณ คำสั่งและกิจกรรมแสดงบนหน้าจอทันทีแบบไร้ดีเลย์'
  },
  {
    icon: Palette,
    title: 'Live Customization Studio',
    desc: 'ปรับแต่งสี ฟอนต์ เสียงแจ้งเตือน และสเกลได้อิสระ พร้อมระบบ Live Preview ให้คุณเห็นผลลัพธ์ทันทีก่อนขึ้นไลฟ์'
  },
  {
    icon: ShieldCheck,
    title: '100% Secure & Privacy',
    desc: 'โทเคนและการตั้งค่าถูกเก็บรักษาอย่างปลอดภัยบนเครื่องของคุณ ไม่มีการส่งข้อมูลสำคัญออกไปยังเซิร์ฟเวอร์ภายนอก'
  },
  {
    icon: Sparkles,
    title: 'Auto-Wiki DB Synchronizer',
    desc: 'ระบบสแครปและอัปเดตข้อมูล Perks และ Killers จาก Official DBD Wiki มาเก็บไว้ในเครื่องอัตโนมัติ ไม่ต้องกรอกมือ'
  }
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'เชื่อมต่อบัญชี Twitch',
    desc: 'เข้าสู่ระบบด้วยบัญชีสตรีมเมอร์ของคุณ'
  },
  {
    step: '02',
    title: 'เลือกและปรับแต่ง Widget',
    desc: 'เลือก Widget ที่ต้องการใช้งาน ปรับแต่งสีสัน เสียง และอื่นๆ ตามสไตล์ช่องของคุณผ่านหน้าแผงควบคุม'
  },
  {
    step: '03',
    title: 'คัดลอกลิงค์',
    desc: 'คัดลอกลิงก์ Browser Source ไปวางในโปรแกรมสตรีมมิ่ง เพียงเท่านี้ก็พร้อมใช้งานแล้ว'
  }
];

export default function Landing() {
  const navigate = useNavigate();
  const [activeServiceTab, setActiveServiceTab] = useState('dbd-perks');

  const activeService = SERVICES.find((s) => s.id === activeServiceTab) || SERVICES[0];

  return (
    <div className="landing-container animate-fade-up">
      {/* 1. HERO SECTION */}
      <section className="hero-section hero-layout">
        <div className="hero-content">
          <div className="hero-badge-pill">
            <span className="pill-dot" />
            <span>FastChick STREAMER WIDGETS</span>
          </div>
          <h1 className="hero-title">
            ยกระดับไลฟ์สตรีมด้วย <span className="gradient-text">FastChick </span>
          </h1>
          <p className="hero-desc">
            แพลตฟอร์มรวมวิดเจ็ตและระบบสร้างสรรค์ความสนุกสำหรับสตรีมเมอร์ Twitch เชื่อมต่อง่าย ทำงานแบบเรียลไทม์ ไร้ดีเลย์ และสวยงามบนหน้าจอสตรีมมิ่ง
          </p>

          <div className="hero-actions">
            <button className="btn-island accent hero-btn" onClick={() => navigate('/dashboard')}>
              <span>เข้าสู่แผงควบคุม</span>
              <div className="btn-icon-wrapper">
                <ArrowRight size={14} strokeWidth={2.5} />
              </div>
            </button>

            <a
              href="#services"
              className="btn-island ghost"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById('services');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              <span>สำรวจบริการทั้งหมด</span>
            </a>
          </div>

          {/* Micro Trust Indicators */}
          <div className="hero-trust-row">
            <div className="trust-item">
              <CheckCircle2 size={15} className="trust-icon" />
              <span>OBS & Streamlabs</span>
            </div>
            <div className="trust-item">
              <CheckCircle2 size={15} className="trust-icon" />
              <span>Zero-Latency</span>
            </div>
            <div className="trust-item">
              <CheckCircle2 size={15} className="trust-icon" />
              <span>Easy Install</span>
            </div>
          </div>
        </div>

        {/* Mascot Interactive Stage */}
        <div className="hero-mascot-wrapper">
          <ChickenMascot />
        </div>
      </section>

      {/* 2. SERVICES & WIDGETS SHOWCASE SECTION */}
      <section id="services" className="services-section">
        <div className="section-header text-center">
          <span className="eyebrow">OUR SERVICES</span>
          <h2 className="section-title">บริการและวิดเจ็ตทั้งหมดของเรา</h2>
          <p className="section-subtitle">
            เลือกใช้งานได้ตามความต้องการของช่องคุณ ปรับแต่งได้อิสระ
          </p>
        </div>

        {/* Services Tabs */}
        <div className="services-tabs-container">
          <div className="services-tabs-pills">
            {SERVICES.map((s) => {
              const Icon = s.icon;
              const isActive = activeServiceTab === s.id;
              return (
                <button
                  key={s.id}
                  className={`service-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveServiceTab(s.id)}
                >
                  <Icon size={18} />
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Service Showcase Card */}
        <div className="doppel-shell service-showcase-shell">
          <div className="doppel-core service-showcase-grid">
            {/* Left: Info */}
            <div className="service-info-col">
              <div className="service-badge" style={{ borderColor: activeService.badgeColor, color: activeService.badgeColor }}>
                <span className="service-badge-dot" style={{ backgroundColor: activeService.badgeColor }} />
                {activeService.badge}
              </div>
              <h3 className="service-detail-title">{activeService.title}</h3>
              <p className="service-detail-subtitle">{activeService.subtitle}</p>
              <p className="service-detail-desc">{activeService.desc}</p>

              <div className="service-highlights-list">
                {activeService.highlights.map((h, i) => (
                  <div key={i} className="highlight-item">
                    <div className="highlight-check">
                      <Check size={13} strokeWidth={3} />
                    </div>
                    <span>{h}</span>
                  </div>
                ))}
              </div>

              <div className="service-cta-row">
                <button className="btn-island accent" onClick={() => navigate('/dashboard')}>
                  <span>เปิดใช้งานวิดเจ็ตนี้บนช่องคุณ</span>
                  <div className="btn-icon-wrapper">
                    <ArrowRight size={13} strokeWidth={2.5} />
                  </div>
                </button>
              </div>
            </div>

            {/* Right: Preview Showcase */}
            <div className="service-preview-col">
              <div className="mockup-frame">
                <div className="mockup-header">
                  <div className="mockup-header-left">
                    <div className="mockup-dots">
                      <span className="dot red" />
                      <span className="dot yellow" />
                      <span className="dot green" />
                    </div>
                    <span className="mockup-title">
                      {activeService.id === 'dbd-perks' && 'Dead by Daylight Perk Overlay'}
                      {activeService.id === 'random-killer' && 'DBD Killer Roulette Overlay'}
                      {activeService.id === 'twitch-shoutout' && 'Twitch Shoutout Banner'}
                      {activeService.id === 'loyalty-card' && 'Twitch Loyalty Stamp Card'}
                    </span>
                  </div>
                  <span className="mockup-tag">OBS 1080p</span>
                </div>

                <div
                  className="mockup-canvas"
                  style={{
                    padding: '0',
                    background: activeService.id === 'loyalty-card' ? 'var(--surface-1)' : '#000000'
                  }}
                >
                  {/* 1. DBD Perks: USER SUPPLIED REAL IMAGE */}
                  {activeService.id === 'dbd-perks' && (
                    <div className="perk-image-showcase-container">
                      <img
                        src="/dbd-perks-showcase.png"
                        alt="Dead by Daylight Perks Roulette Display (LegionXIZ Killer)"
                        className="perk-showcase-real-img"
                      />
                    </div>
                  )}

                  {/* 2. Killer Roulette: USER SUPPLIED REAL IMAGE */}
                  {activeService.id === 'random-killer' && (
                    <div className="killer-image-showcase-container">
                      <img
                        src="/random-killer-showcase.png"
                        alt="Dead by Daylight Random Killer Overlay (The Lich)"
                        className="killer-showcase-real-img"
                      />
                    </div>
                  )}

                  {/* 3. Shoutout Banner: USER SUPPLIED REAL IMAGE */}
                  {activeService.id === 'twitch-shoutout' && (
                    <div className="shoutout-image-showcase-container">
                      <img
                        src="/twitch-shoutout-showcase.png"
                        alt="Twitch Shoutout Banner Overlay (LegionXIZ)"
                        className="shoutout-showcase-real-img"
                      />
                    </div>
                  )}

                  {/* 4. Loyalty Stamp Card: USER SUPPLIED REAL IMAGE */}
                  {activeService.id === 'loyalty-card' && (
                    <div className="loyalty-image-showcase-container">
                      <img
                        src="/loyalty-card-showcase.png"
                        alt="Twitch Loyalty Stamp Card Overlay"
                        className="loyalty-showcase-real-img"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* 4. HOW IT WORKS 3-STEP */}
      <section className="instructions-section doppel-shell">
        <div className="doppel-core">
          <div className="section-header">
            <span className="eyebrow">How to use</span>
            <h2 className="section-title">วิธีเริ่มต้นใช้งานใน 3 สเต็ปง่ายๆ</h2>
            <p className="section-subtitle">ไม่ต้องลงโปรแกรมเพิ่ม ไม่ต้องเขียนโค้ด</p>
          </div>

          <div className="steps-grid">
            {HOW_IT_WORKS.map((st, i) => (
              <div key={i} className="step-card">
                <span className="step-number">{st.step}</span>
                <h4 className="step-card-title">{st.title}</h4>
                <p className="step-card-desc">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CALL TO ACTION BANNER */}
      <section className="cta-banner doppel-shell">
        <div className="doppel-core cta-content">
          <div className="cta-text-side">
            <h2 className="cta-title">พร้อมยกระดับไลฟ์สตรีมของคุณแล้วหรือยัง?</h2>
            <p className="cta-desc">
              เข้าสู่ระบบด้วยบัญชี Twitch ของคุณ แล้วเริ่มใช้งาน Widget และกิจกรรมบนหน้าจอไลฟ์ได้วันนี้
            </p>
          </div>
          <div className="cta-action-side">
            <button className="btn-island accent hero-btn" onClick={() => navigate('/dashboard')}>
              <span>เปิดแผงควบคุมสตรีมเมอร์</span>
              <div className="btn-icon-wrapper">
                <ArrowRight size={14} strokeWidth={2.5} />
              </div>
            </button>
            <button className="btn-island ghost" onClick={() => navigate('/faq')}>
              <span>คำถามที่พบบ่อย (FAQ)</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
