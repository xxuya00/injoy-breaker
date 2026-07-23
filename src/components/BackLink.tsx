import styles from './BackLink.module.css';

export default function BackLink({ onClick, label = '여정으로' }: { onClick: () => void; label?: string }) {
  return (
    <button className={styles.back} onClick={onClick}>
      <svg viewBox="0 0 24 24">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {label}
    </button>
  );
}
