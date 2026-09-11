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
  Check
} from 'lucide-react';
import ChickenMascot from '../components/ChickenMascot';

const SERVICES = [
  {
    id: 'dbd-perks',
    badge: 'Gaming Overlay',
    badgeColor: '#A855F7',
    badgeBg: 'rgba(168, 85, 247, 0.12)',
    title: 'DBD Perk Roulette',
    subtitle: 'วงล้อสุ่ม Perk Dead by Daylight สตรีมเมอร์',
    icon: Dices,
    gradient: 'linear-gradient(135deg, #A855F7, #6366F1)',
    desc: 'ระบบสุ่ม Perk 4 ช่องสำหรับ Survivor และ Killer เพิ่มความท้าทายให้คนดูร่วมสนุก สุ่มผ่านคำสั่งแชทหรือ Channel Points พร้อมระบบแบล็คลิสต์ Perk',
    highlights: [
      'กรอง Perk ที่ไม่ต้องการเล่นได้อิสระ',
      'สุ่มผ่าน Channel Points หรือคำสั่งแชท Twitch',
      'อัปเดต Perk ล่าสุดจาก Official Wiki อัตโนมัติ',
      'ปรับแต่งสี ขนาด และแอนิเมชันได้อย่างอิสระ'
    ]
  },
  {
    id: 'random-killer',
    badge: 'Viewer Interactive',
    badgeColor: '#EF4444',
    badgeBg: 'rgba(239, 68, 68, 0.12)',
    title: 'DBD Killer Roulette',
    subtitle: 'วงล้อสุ่มฆาตกร Dead by Daylight',
    icon: Skull,
    gradient: 'linear-gradient(135deg, #EF4444, #B91C1C)',
    desc: 'ให้ผู้ชมหรือตัวคุณเองสุ่ม Killer สำหรับแต่ละแมตช์ มาพร้อมการ์ด Dossier รูปภาพ Portrait สวยงามคมชัด พร้อมเอฟเฟกต์เสียงสแกนและประวัติการสุ่ม',
    highlights: [
      'คัดกรอง Killer ที่ยังไม่ปลดล็อกหรือไม่อยากเล่นได้',
      'รูป Killer คมชัดพร้อมแอนิเมชันเปิดตัวการ์ด',
      'ประวัติการสุ่ม (Roll History) บันทึกเก็บไว้ดูย้อนหลังได้ทันที',
      'ปรับแต่งเวลาหมุนและเวลาแสดงผลได้อย่างละเอียด'
    ]
  },
  {
    id: 'twitch-shoutout',
    badge: 'Stream Engagement',
    badgeColor: '#0EA5E9',
    badgeBg: 'rgba(14, 165, 233, 0.12)',
    title: 'Twitch Shoutout Overlay',
    subtitle: 'ป้ายแนะนำและต้อนรับสตรีมเมอร์คนพิเศษ',
    icon: Megaphone,
    gradient: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
    desc: 'ป้ายแบนเนอร์แสดงโปรโมตสตรีมเมอร์คนโปรดหรือ VIP บนหน้าจออัตโนมัติเมื่อมีคำสั่ง /shoutout หรือเมื่อมีคน Raid เข้ามาในช่องสตรีม',
    highlights: [
      'ดึงรูป Avatar โปรไฟล์ และชื่อเกมล่าสุดที่สตรีมมาแสดงผลบนจอ',
      'แอนิเมชันสไลด์เข้าออกนุ่มนวล สวยงาม สบายตา',
      'ปรับแต่งเสียง Custom Sound, ระยะเวลาแสดง และสีธีมได้ 100%',
      'รองรับการทดสอบพรีวิวก่อนขึ้นไลฟ์จริง'
    ]
  },
  {
    id: 'loyalty-card',
    badge: 'Viewer Stamp System',
    badgeColor: '#F59E0B',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    title: 'Twitch Loyalty Card',
    subtitle: 'บัตรสะสมแต้มแสตมป์สำหรับผู้ชมในช่อง',
    icon: Award,
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    desc: 'ระบบการ์ดสะสมแต้มแสตมป์สไตล์สมุดโน้ต ช่วยกระตุ้นให้ผู้ชมมีส่วนร่วมและกลับมาดูสตรีมของคุณอย่างต่อเนื่อง พร้อมระบบตอบกลับในแชทอัตโนมัติ',
    highlights: [
      'การ์ดแสตมป์สไตล์สมุดโน้ตน่ารัก ปรับแต่งได้ทั้งสี ฟอนต์ และไอคอน',
      'Leaderboard จัดอันดับ Top Fan ผู้ชมที่แต้มสะสมสูงสุดในช่อง',
      'แจ้งเตือนแสตมป์ใหม่แบบ Real-Time บนจอ และพิมพ์คอนเฟิร์มลงแชท',
      'ผูกคำสั่งแชท !loyalty หรือ Channel Points เพื่อให้ผู้ชมเช็คอิน'
    ]
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
    title: 'คัดลอกลิงค์ลง OBS',
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
              <span>เข้าสู่แผงควบคุมสตรีมเมอร์</span>
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
              <span>ดูตัวอย่างวิดเจ็ต</span>
            </a>
          </div>

          {/* Micro Trust Indicators */}
          <div className="hero-trust-row">
            <div className="trust-item">
              <CheckCircle2 size={15} className="trust-icon" />
              <span>OBS Studio & Streamlabs</span>
            </div>
            <div className="trust-item">
              <CheckCircle2 size={15} className="trust-icon" />
              <span>Zero-Latency WebSockets</span>
            </div>
            <div className="trust-item">
              <CheckCircle2 size={15} className="trust-icon" />
              <span>ปลอดภัย ไม่ต้องลงโปรแกรมเพิ่ม</span>
            </div>
          </div>
        </div>

        {/* Mascot Interactive Stage */}
        <div className="hero-mascot-wrapper">
          <ChickenMascot />
        </div>
      </section>

      {/* 2. SERVICES & SPOTLIGHT SHOWCASE */}
      <section id="services" className="services-section">
        <div className="section-header text-center">
          <span className="eyebrow">SERVICES & OVERLAYS</span>
          <h2 className="section-title">วิดเจ็ตสตรีมเมอร์ระดับพรีเมียม</h2>
          <p className="section-subtitle">
            เลือกใช้วิดเจ็ตที่เหมาะกับช่องของคุณ ปรับแต่งได้ตามใจและเชื่อมต่อง่ายดาย
          </p>
        </div>

        {/* Services Tab Switcher */}
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
                  <Icon size={16} />
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Service Spotlight Showcase Card */}
        <div className="doppel-shell service-showcase-shell">
          <div className="doppel-core service-showcase-grid">
            {/* Left: Info */}
            <div className="service-info-col">
              <div
                className="service-badge"
                style={{ borderColor: activeService.badgeColor, color: activeService.badgeColor }}
              >
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
                <button
                  className="btn-island accent"
                  onClick={() => navigate(`/dashboard?widget=${activeService.id}`)}
                >
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
                  {/* 1. DBD Perks */}
                  {activeService.id === 'dbd-perks' && (
                    <div className="perk-image-showcase-container">
                      <img
                        src="/dbd-perks-showcase.png"
                        alt="Dead by Daylight Perks Roulette Display"
                        className="perk-showcase-real-img"
                        loading="lazy"
                        decoding="async"
                        width="420"
                        height="280"
                      />
                    </div>
                  )}

                  {/* 2. Killer Roulette */}
                  {activeService.id === 'random-killer' && (
                    <div className="killer-image-showcase-container">
                      <img
                        src="/random-killer-showcase.png"
                        alt="Dead by Daylight Random Killer Overlay"
                        className="killer-showcase-real-img"
                        loading="lazy"
                        decoding="async"
                        width="420"
                        height="280"
                      />
                    </div>
                  )}

                  {/* 3. Shoutout Banner */}
                  {activeService.id === 'twitch-shoutout' && (
                    <div className="shoutout-image-showcase-container">
                      <img
                        src="/twitch-shoutout-showcase.png"
                        alt="Twitch Shoutout Banner Overlay"
                        className="shoutout-showcase-real-img"
                        loading="lazy"
                        decoding="async"
                        width="420"
                        height="280"
                      />
                    </div>
                  )}

                  {/* 4. Loyalty Stamp Card */}
                  {activeService.id === 'loyalty-card' && (
                    <div className="loyalty-image-showcase-container">
                      <img
                        src="/loyalty-card-showcase.png"
                        alt="Twitch Loyalty Stamp Card Overlay"
                        className="loyalty-showcase-real-img"
                        loading="lazy"
                        decoding="async"
                        width="420"
                        height="280"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PLATFORM FEATURES GRID */}
      <section className="features-section">
        <div className="section-header text-center">
          <span className="eyebrow">FASTCHICK ADVANTAGES</span>
          <h2 className="section-title">ทำไมสตรีมเมอร์ถึงเลือกใช้ FastChick?</h2>
          <p className="section-subtitle">
            ออกแบบมาเพื่อประสิทธิภาพสูงสุดบน OBS ไร้ดีเลย์ ไม่ดึงสเปกเครื่องสตรีม
          </p>
        </div>

        <div className="features-grid">
          {PLATFORM_FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="feature-card">
                <div className="feature-icon-wrapper">
                  <Icon size={22} className="feature-icon" />
                </div>
                <h3 className="feature-title">{feat.title}</h3>
                <p className="feature-desc">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. HOW IT WORKS 3-STEP */}
      <section className="instructions-section doppel-shell">
        <div className="doppel-core">
          <div className="section-header">
            <span className="eyebrow">HOW TO USE</span>
            <h2 className="section-title">วิธีเริ่มต้นใช้งานใน 3 สเต็ปง่ายๆ</h2>
            <p className="section-subtitle">ไม่ต้องลงโปรแกรมเพิ่ม ไม่ต้องเขียนโค้ด รองรับ Browser Source</p>
          </div>

          <div className="steps-grid">
            {HOW_IT_WORKS.map((st, i) => (
              <div key={i} className="step-card">
                <span className="step-number">{st.step}</span>
                <h3 className="step-card-title">{st.title}</h3>
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
