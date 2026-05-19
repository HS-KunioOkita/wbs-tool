import styles from './Loading.module.css';

interface Props {
  label?: string;
}

export function Loading({ label = '読み込み中…' }: Props): JSX.Element {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
