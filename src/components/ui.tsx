import { House, Plus, X } from "lucide-react";
import React, { useEffect, useRef } from "react";
export function Brand() {
  return (
    <div className="brand">
      <span>
        <House size={22} strokeWidth={1.9} />
      </span>
      <strong>
        hotel<span>flow</span>
        <i />
      </strong>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Stat({
  label,
  value,
  icon: Icon,
  note,
  children,
}: {
  label: string;
  value: string;
  icon: typeof House;
  note: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="card stat">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong className="stat-value">{value}</strong>
      <p>{note}</p>
      {children}
    </section>
  );
}
export function Empty({
  icon: Icon,
  title,
  detail,
  action,
  label,
}: {
  icon: typeof House;
  title: string;
  detail: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty">
      <span>
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action && (
        <button className="text-btn" onClick={action}>
          <Plus size={15} />
          {label}
        </button>
      )}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null),
    previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement;
    const root = ref.current;
    const target = root?.querySelector<HTMLElement>("input,select,button");
    target?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab" && root) {
        const els = Array.from(
          root.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select,textarea,a[href]",
          ),
        );
        if (!els.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous.current?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-btn" aria-label="Mbyll" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
