import { Icon } from "@andrewmclachlan/moo-ds";
import type { PropsWithChildren } from "react";

export const Collapsible: React.FC<PropsWithChildren<CollapsibleProps>> = ({ header, children, ...props }) => {
  return (
    <details {...props}>
      <summary>
        <span className="collapsible-icon"><Icon icon="chevron-right" /></span>
        {header}
      </summary>
      <div className="collapsible-content">
        {children}
      </div>
    </details>
  );
}

export interface CollapsibleProps extends React.DetailedHTMLProps<React.DetailsHTMLAttributes<HTMLDetailsElement>, HTMLDetailsElement> {
  header: React.ReactNode;
}
