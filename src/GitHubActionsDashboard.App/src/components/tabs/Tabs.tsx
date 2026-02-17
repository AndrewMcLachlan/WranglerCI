import type { ContentComponent } from "./Content";
import type { TabComponent } from "./Tab";
import { Content } from "./Content";
import { Tab } from "./Tab";
import { TabsProvider } from "./TabsProvider";
import { TabsList, type TabsListComponent } from "./List";

export type TabsComponent = React.FC<React.PropsWithChildren<TabsProps>> & {
    List: TabsListComponent;
    Tab: TabComponent;
    Content: ContentComponent;
}

export const Tabs: TabsComponent = ({ selectedTab, children }) => {

    console.log("Rendering Tabs", { selectedTab });

    return (
        <TabsProvider defaultTab={selectedTab}>
            {children}
        </TabsProvider>
    );
}
/*
<TabContext.Provider value={contextValue}>
            <Nav variant="tabs" role="tablist">
                {panes.map((pane) => (
                    <Nav.Item key={pane.eventKey}>
                        <Nav.Link
                            active={activeKey === pane.eventKey}
                            disabled={pane.disabled}
                            onClick={() => !pane.disabled && handleSelect(pane.eventKey)}
                            role="tab"
                        >
                            {pane.title}
                        </Nav.Link>
                    </Nav.Item>
                ))}
            </Nav>
            {children}
            */
Tabs.List = TabsList;
Tabs.Tab = Tab;
Tabs.Content = Content;

export interface TabsProps {
    selectedTab?: string;
}
