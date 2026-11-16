import classNames from "classnames";
import type { ReactNode } from "react";
import { toast } from "react-toastify";

export interface CopyTextProps {
  text: string;
  /** What to show; defaults to the text being copied. */
  children?: ReactNode;
  className?: string;
}

/** Inline text that copies `text` to the clipboard when clicked. */
export const CopyText: React.FC<CopyTextProps> = ({ text, children, className }) => (
  <button
    type="button"
    className={classNames("copy-text", className)}
    title={`Copy ${text}`}
    onClick={() => toast.promise(navigator.clipboard.writeText(text), { success: `Copied ${text}`, error: `Couldn't copy ${text}` })}
  >
    {children ?? text}
  </button>
);
