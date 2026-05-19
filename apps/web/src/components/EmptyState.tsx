import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: Props): JSX.Element {
  return (
    <div className={styles.empty} role="status">
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action}
    </div>
  );
}
