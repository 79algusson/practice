import { useState } from 'react';
import { Sparkles, AlertCircle, Image } from 'lucide-react';
import { useApiKey, generateGeminiImage } from '../utils/apiKey';
import styles from './GeminiVisualizer.module.css';

interface Props {
  prompt: string;
  label: string;
  onRequestApiKey: () => void;
}

export default function GeminiVisualizer({ prompt, label, onRequestApiKey }: Props) {
  const { apiKey } = useApiKey();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  async function handleGenerate() {
    if (!apiKey) {
      onRequestApiKey();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = await generateGeminiImage(prompt, apiKey);
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>
          <Sparkles size={14} className={styles.labelIcon} />
          {label}
        </span>
        <button className={styles.btn} onClick={handleGenerate} disabled={loading}>
          <Image size={14} />
          {imageUrl ? 'AI 이미지 재생성' : 'AI 이미지 생성'}
        </button>
      </div>
      <div className={styles.body}>
        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Gemini가 이미지를 생성하는 중...</span>
          </div>
        )}
        {!loading && error && (
          <div className={styles.error}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && imageUrl && (
          <img src={imageUrl} alt="AI 생성 이미지" className={styles.image} />
        )}
        {!loading && !error && !imageUrl && (
          <div className={styles.noKey}>
            <Sparkles size={24} color="var(--accent-purple)" />
            <p className={styles.noKeyText}>
              버튼을 클릭하면 현재 실험 상태를 AI가 시각화합니다.
              {!apiKey && <><br />Gemini API 키가 필요합니다.</>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
