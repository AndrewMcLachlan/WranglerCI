import type { PropsWithChildren } from "react";

export const Badge: React.FC<PropsWithChildren<{ className?: string }>> = ({ className, children }) => {
  return (
    <div className={`badge ${className || ''}`}>
      {children}
    </div>
  );
}
