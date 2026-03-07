import React, { createContext, useEffect } from "react";
import { useContext } from "react";

export const TabsContext = createContext<TabsState>({});

export const TabsProvider: React.FC<React.PropsWithChildren<AppProviderProps>> = ({ defaultTab, children }) => {

    const [ selectedTab, setSelectedTab ] = React.useState<string | undefined>(defaultTab);

    return (
        <TabsContext.Provider value={{ selectedTab, setSelectedTab }}>
            {children}
        </TabsContext.Provider>
    );
}

export const useTabs = () => useContext(TabsContext);

export interface AppProviderProps  {
    defaultTab?: string;
}

TabsProvider.displayName = "AppProvider";

export interface TabsState  {
    selectedTab?: string;
    setSelectedTab?: (tab: string) => void;
}
