import { Nav } from "@andrewmclachlan/moo-ds";

export type TabsListComponent = React.FC<React.PropsWithChildren<TabsListProps>>;

export const TabsList: TabsListComponent = ({ children, ...rest }) => {
    return (
        <Nav variant="tabs" role="tabslist">
            {children}
        </Nav>
    );
}

export interface TabsListProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement> {

}
