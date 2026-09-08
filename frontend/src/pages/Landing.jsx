import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Palette, Sparkles } from 'lucide-react';

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-container animate-fade-up">
      {/* Hero */}
      <div className="hero-section">
        <span className="eyebrow">แพลตฟอร์ม Solocast Powered by LegionX</span>
        <h1 className="hero-title">ยกระดับไลฟ์สตรีมด้วย Widget ระดับพรีเมียม</h1>
        <p className="hero-desc">เราออกแบบและสร้างสรรค์ Widget คุณภาพสูงไว้ให้คุณแล้ว เพียงแค่เข้าสู่ระบบด้วยบัญชี Twitch เลือก Widget ที่คุณชื่นชอบ ปรับแต่งตามสไตล์ และนำไปใช้งานในสตรีมได้ทันที!</p>
        <button className="btn-island accent hero-btn" onClick={() => navigate('/dashboard')}>
          <span>เข้าสู่แผงควบคุม</span>
          <div className="btn-icon-wrapper">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </div>
        </button>
      </div>

      {/* Features Bento */}
      <div className="features-bento">
        <div className="doppel-shell feature-card">
          <div className="doppel-core">
            <h3 className="feature-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} color="#F59E0B" /> ไร้ความหน่วง (Zero Latency)
            </h3>
            <p className="feature-text">ประมวลผล Event ทุกอย่างบนเครื่องของคุณเองผ่าน Twitch EventSub WebSockets โดยตรง ไม่มีดีเลย์จากเซิร์ฟเวอร์คนกลาง</p>
          </div>
        </div>
        <div className="doppel-shell feature-card">
          <div className="doppel-core">
            <h3 className="feature-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={20} color="#3B82F6" /> ปรับแต่งง่ายดาย (Easy Customization)
            </h3>
            <p className="feature-text">เลือก Widget ที่ต้องการแล้วระบบจะเตรียมหน้าจอการตั้งค่าให้ทันที ปรับแต่งสีและข้อความได้อย่างอิสระ</p>
          </div>
        </div>
        <div className="doppel-shell feature-card full-width">
          <div className="doppel-core">
            <h3 className="feature-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#A855F7" /> เอ็กซ์คลูซีฟดีไซน์โดยทีมงาน (Exclusive Designs)
            </h3>
            <p className="feature-text">Widget ทุกชิ้นถูกออกแบบและพัฒนาขึ้นมาเป็นพิเศษโดยทีมงานของเรา เพื่อรับประกันความสวยงามและเสถียรภาพสูงสุดในการใช้งาน</p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions-section doppel-shell">
        <div className="doppel-core">
          <span className="eyebrow">เริ่มต้นใช้งาน</span>
          <h2>วิธีใช้งาน Solocast Powered by LegionX</h2>
          <ol className="instruction-list">
            <li><strong>ยืนยันตัวตน:</strong> เชื่อมต่อบัญชี Twitch เพื่ออนุญาตให้ระบบดักจับ Event ต่างๆ</li>
            <li><strong>ตั้งค่า:</strong> เลือก Widget และปรับแต่งสี ข้อความ และการตั้งค่าผ่านหน้าจอ UI อัตโนมัติ</li>
            <li><strong>ใช้งานจริง:</strong> คัดลอกลิงก์ OBS Browser Source ที่ระบบสร้างให้ ไปวางในโปรแกรมสตรีมของคุณ</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default Landing;
