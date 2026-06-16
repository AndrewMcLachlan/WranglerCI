import type { CSSProperties, PropsWithChildren } from "react";

export const Badge: React.FC<PropsWithChildren<{ className?: string; style?: CSSProperties }>> = ({ className, style, children }) => {
  return (
    <div className={`badge ${className || ''}`} style={style}>
      {children}
    </div>
  );
}
