import { Icon, Nav, useLink, type IconProps } from "@andrewmclachlan/moo-ds";
import classNames from "classnames";
import { useTabs } from "./TabsProvider";

export type TabComponent = React.FC<React.PropsWithChildren<TabProps>>;

export const Tab: TabComponent = ({ children, to, value, label, icon, className, ...rest }) => {

    const { selectedTab, setSelectedTab } = useTabs();

    return (
                    <Nav.Item key={value} {...rest} className={classNames(className, value === selectedTab ? "active" : "")}>
                        <Nav.Link
                            active={value === selectedTab}
                            disabled={false}
                            onClick={() => setSelectedTab?.(value)}
                            role="tab"
                            href="#"
                        >
                {icon && <Icon icon={icon} />} {label}
                {children}
                        </Nav.Link>
                    </Nav.Item>
    );
}

export interface TabProps extends React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement> {
    label?: string | React.ReactNode;
    icon?: IconProps["icon"];
    value: string;
    to?: string;
    isActive?: boolean;
}
