import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import styles from './FormField.module.css';

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}

export function FormField({ label, required, error, hint, children }: FieldProps): JSX.Element {
  return (
    <label className={styles.field}>
      <span className={styles.label}>
        {label}
        {required ? (
          <span className={styles.required} aria-label="必須">
            *
          </span>
        ) : null}
      </span>
      {children}
      {error ? <span className={styles.error}>{error}</span> : null}
      {!error && hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  const cls = [styles.input, invalid ? styles.invalid : '', className].filter(Boolean).join(' ');
  return <input ref={ref} className={cls} {...rest} />;
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 3, ...rest },
  ref,
) {
  const cls = [styles.input, styles.textarea, invalid ? styles.invalid : '', className]
    .filter(Boolean)
    .join(' ');
  return <textarea ref={ref} rows={rows} className={cls} {...rest} />;
});
