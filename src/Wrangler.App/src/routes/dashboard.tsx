import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { DashboardProvider } from "./dashboard/-providers/DashboardProvider";
import { Filters } from "./dashboard/-components/shared/Filters";
import { Icon } from "@andrewmclachlan/moo-ds";
import { Dashboard as b } from "@andrewmclachlan/moo-icons";
import { Dashboard, NestedList, List } from "../assets";
import { useSelectedRepositories } from "./settings/-hooks/useSelectedRepositories";
import { NoRepositories } from "../components/NoRepositories";
import { useDashboardView } from "./dashboard/-hooks/useDashboardView";


export const Route = createFileRoute("/dashboard")({
    component: () => {
        const { data: selectedRepositories } = useSelectedRepositories();
        const hasRepos = selectedRepositories && selectedRepositories.length > 0;
        const [, setView] = useDashboardView();

        return (
            <DashboardProvider>
                <article>
                    {hasRepos && (
                        <section className="controls">
                            <Filters />
                            <div className="views">
                                <Link to="/dashboard" onClick={() => setView("overview")}><Icon icon={Dashboard} title="Card view" /></Link>
                                <Link to="/dashboard/nested" onClick={() => setView("nested")}><Icon icon={NestedList} title="Nested list view" /></Link>
                                <Link to="/dashboard/list" onClick={() => setView("list")}><Icon icon={List} title="List view" /></Link>
                            </div>
                        </section>
                    )}
                    <section className="content">
                        {hasRepos ? <Outlet /> : <NoRepositories />}
                    </section>
                </article>
            </DashboardProvider>
        );
    }
});
