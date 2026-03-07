import classNames from "classnames";
import { useTabs } from "./TabsProvider";

export type ContentComponent = React.FC<React.PropsWithChildren<ContentProps>>;

export const Content: ContentComponent = ({ children, value, className, ...rest }) => {

    const { selectedTab } = useTabs();

    if (value !== selectedTab) {
        return null;
    }

    return (
        <section className={classNames(className, "section tab-content")} {...rest}>
            {children}
        </section>
    );
}

export interface ContentProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    value: string;
}