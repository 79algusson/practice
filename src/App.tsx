import { useState } from 'react';
import { Atom, TrendingUp, Key } from 'lucide-react';
import { useApiKey } from './utils/apiKey';
import ApiKeyModal from './components/ApiKeyModal';
import CharlesExperiment from './experiments/Charles';
import styles from './App.module.css';

export default function App() {
  const { apiKey } = useApiKey();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <Atom size={20} className={styles.logoIcon} />
          분자의 세계
        </div>
        <button
          className={`${styles.apiBtn} ${apiKey ? styles.apiBtnActive : ''}`}
          onClick={() => setShowModal(true)}
        >
          <Key size={13} />
          {apiKey ? 'API 키 설정됨' : 'API 키 설정'}
        </button>
      </header>

      {/* Banner */}
      <div className={styles.banner}>
        <div className={styles.bannerInner}>
          <TrendingUp size={32} className={styles.bannerIcon} />
          <div className={styles.bannerText}>
            <h1 className={styles.bannerTitle}>샤를의 법칙 시뮬레이터</h1>
            <p className={styles.bannerDesc}>
              온도 변인을 조작하며 기체 부피 변화를 직접 탐구하세요.
              분자 운동과 거시적 법칙을 동시에 관찰할 수 있습니다.
            </p>
          </div>
          <span className={styles.bannerBadge}>V / T = 일정</span>
        </div>
      </div>

      {/* Main */}
      <main className={styles.main}>
        <CharlesExperiment onRequestApiKey={() => setShowModal(true)} />
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        교육 목적으로 제작된 과학 시뮬레이터 &nbsp;|&nbsp; AI 시각화 powered by{' '}
        <a
          href="https://deepmind.google/gemini"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLink}
        >
          Google Gemini
        </a>
      </footer>

      {showModal && <ApiKeyModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
