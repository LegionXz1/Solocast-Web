import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Tv,
  Radio,
  Dices,
  Skull,
  Award,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Zap
} from 'lucide-react';

const FAQ_CATEGORIES = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'general', label: 'ทั่วไป & เริ่มต้น', icon: Sparkles },
  { id: 'twitch', label: 'การเชื่อมต่อ Twitch', icon: Radio },
  { id: 'obs', label: 'OBS Studio', icon: Tv },
  { id: 'dbd', label: 'DBD Perks & Killer', icon: Skull },
  { id: 'loyalty', label: 'บัตรสะสมแต้ม (Loyalty)', icon: Award }
];

const FAQ_ITEMS = [
  {
    id: 1,
    category: 'general',
    question: 'FastChick Powered by LegionX คืออะไร?',
    answer: 'FastChick เป็นแพลตฟอร์ม Interactive Widgets สำหรับสตรีมเมอร์ Twitch ที่ต้องการยกระดับความสนุกในการไลฟ์สด เช่น การสุ่มเปิร์ก Dead by Daylight, วงล้อสุ่ม Killer, และระบบบัตรสะสมแต้ม'
  },
  {
    id: 2,
    category: 'obs',
    question: 'วิธีนำ Widget ไปใช้งานในโปรแกรม OBS ทำอย่างไร?',
    answer: '1. ไปที่หน้า "แผงควบคุม"\n2. เลือก Widget ที่ต้องการใช้งาน และปรับแต่งสี/ฟังก์ชันตามต้องการ\n3. คัดลอก "ลิงก์ Browser Source ของคุณ" ด้านล่างหน้าจอ\n4. ใน OBS Studio: กดเพิ่ม Source (+) > เลือก "Browser"\n5. วาง URL ที่คัดลอกมา กำหนดขนาด Width: 1920, Height: 1080 (หรือขนาดที่เหมาะสม) และติ๊กถูก "Shutdown source when not visible" กับ "Refresh browser when scene becomes active"'
  },
  {
    id: 3,
    category: 'dbd',
    question: 'ระบบสุ่มเปิร์ก Dead by Daylight ทำงานอย่างไร และมีเปิร์กครบหรือไม่?',
    answer: 'ระบบดึงข้อมูลและรูปภาพไอคอนเปิร์กจาก Dead by Daylight อย่างสมบูรณ์ รองรับทั้งฝั่ง Survivor และ Killer ผู้สตรีมสามารถกด "ตัดออก (Exclude)" เปิร์กที่ไม่ต้องการให้ระบบสุ่มได้ทีละเปิร์ก '
  },
  {
    id: 4,
    category: 'dbd',
    question: 'สามารถเลือกตัด Killer ที่ไม่ต้องการสุ่มใน Killer Roulette ได้ไหม?',
    answer: 'ได้! ในแถบ "สุ่ม Killer" จะมีส่วน "รายชื่อคิลเลอร์ที่ถูกตัดออก (Excluded Killers)" ให้คุณสามารถกดคลิกที่การ์ดคิลเลอร์ตัวไหนก็ได้เพื่อตัดออกจากการสุ่มได้ทันที โดยคิลเลอร์ที่ตัดออกจะแสดงป้ายสีแดงและจะไม่ถูกเลือกเมื่อมีการกดสุ่ม'
  },
  {
    id: 5,
    category: 'loyalty',
    question: 'ระบบบัตรสะสมแต้ม (Loyalty Card) ทำงานอย่างไร?',
    answer: 'บัตรสะสมแต้มช่วยสร้างความผูกพันกับผู้ชม เมื่อผู้ชมแลก Channel Points หรือพิมพ์คำสั่งเช็คอินในแชท ระบบจะทำการประทับตราดิจิทัลลงบนการ์ดในไลฟ์สตรีมแบบเรียลไทม์ พร้อมบันทึกประวัติสะสมแต้มและแสดงบน Leaderboard ในแดชบอร์ดของคุณ'
  },
];

export default function FAQ() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState({ 1: true, 2: true });

  const toggleItem = (id) => {
    setOpenItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredFaqs = FAQ_ITEMS.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="landing-container animate-fade-up">
      {/* Header Section */}
      <div className="hero-section" style={{ marginBottom: '1.5rem' }}>
        <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <HelpCircle size={13} /> ศูนย์ช่วยเหลือ & คำถามที่พบบ่อย
        </span>
        <h1 className="hero-title">คำถามที่พบบ่อย (FAQ)</h1>
        <p className="hero-desc">
          รวบรวมคำตอบและวิธีแก้ไขปัญหาเบื้องต้นเกี่ยวกับการใช้งาน FastChick, การติดตั้งลงในสตรีมมิ่งโปรแกรม และการเชื่อมต่อ Twitch
        </p>
      </div>

      {/* Search Bar */}
      <div className="dbd-search-bar" style={{ padding: '0.85rem 1.15rem', background: 'var(--surface-1)' }}>
        <Search size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="ค้นหาคำถาม เช่น OBS, Dead by Daylight, Channel Points, เปิร์ก..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="dbd-search-input"
          style={{ fontSize: '0.95rem' }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            ล้างค้นหา
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="widget-tab-nav" style={{ marginBottom: '1.75rem' }}>
        {FAQ_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            className={`widget-tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.icon && <cat.icon size={14} />}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* FAQ Accordion List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2.5rem' }}>
        {filteredFaqs.length === 0 ? (
          <div className="doppel-shell" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              ไม่พบคำถามที่ตรงกับ "{searchQuery}"
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="btn-island accent"
              style={{ marginTop: '1rem' }}
            >
              <span>แสดงคำถามทั้งหมด</span>
            </button>
          </div>
        ) : (
          filteredFaqs.map(item => {
            const isOpen = Boolean(openItems[item.id]);
            return (
              <div key={item.id} className="doppel-shell">
                <div
                  style={{
                    padding: '1.15rem 1.35rem',
                    background: 'var(--surface-1)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    transition: 'var(--transition-fast)'
                  }}
                  onClick={() => toggleItem(item.id)}
                >
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.question}
                  </h3>
                  <div style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{
                    padding: '1rem 1.35rem 1.35rem 1.35rem',
                    background: 'var(--surface-2)',
                    borderTop: '1px solid var(--border-primary)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-line'
                  }}>
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Support Banner */}
      <div className="doppel-shell" style={{ background: 'var(--surface-1)' }}>
        <div className="doppel-core" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-primary)', fontSize: '1.15rem' }}>
              ยังมีคำถามหรือพบปัญหาอื่นๆ?
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              ส่งข้อความแจ้งปัญหา หรือติดต่อทีมงานผู้พัฒนาโดยตรงได้ตลอดเวลา
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/support')}
              className="btn-island accent"
              style={{ padding: '0.65rem 1.25rem' }}
            >
              <span>ไปยังหน้าแจ้งปัญหา</span>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-island"
              style={{ padding: '0.65rem 1.25rem' }}
            >
              <span>เข้าสู่แผงควบคุม</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
