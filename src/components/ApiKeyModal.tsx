import { useState } from 'react';
import { Eye, EyeOff, Key } from 'lucide-react';
import { useApiKey } from '../utils/apiKey';
import styles from './ApiKeyModal.module.css';

interface Props {
  onClose: () => void;
}

export default function ApiKeyModal({ onClose }: Props) {
  const { apiKey, setApiKey, clearApiKey } = useApiKey();
  const [value, setValue] = useState(apiKey);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setApiKey(value.trim());
    setSaved(true);
    setTimeout(onClose, 800);
  }

  function handleDelete() {
    clearApiKey();
    setValue('');
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>
          <Key size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Gemini API 키 설정
        </h2>
        <p className={styles.subtitle}>
          API 키는 이 세션에서만 저장되며 서버로 전송되지 않습니다.{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            API 키 발급받기 →
          </a>
        </p>

        {saved ? (
          <div className={styles.saved}>✓ 저장 완료</div>
        ) : (
          <>
            <p className={styles.fieldLabel}>API KEY</p>
            <div className={styles.inputRow}>
              <input
                type={show ? 'text' : 'password'}
                className={styles.input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="AIza..."
                autoFocus
              />
              <button className={styles.eyeBtn} onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className={styles.actions}>
              <button className={styles.saveBtn} onClick={handleSave} disabled={!value.trim()}>
                저장
              </button>
              {apiKey && (
                <button className={styles.deleteBtn} onClick={handleDelete}>
                  삭제
                </button>
              )}
              <button className={styles.cancelBtn} onClick={onClose}>
                취소
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
