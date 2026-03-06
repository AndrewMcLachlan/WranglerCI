import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { DashboardProvider } from "./dashboard/-providers/DashboardProvider";
import { Filters } from "./dashboard/-components/Filters";
import { Icon } from "@andrewmclachlan/moo-ds";
import { Dashboard as b } from "@andrewmclachlan/moo-icons";
import { Dashboard, NestedList, List } from "../assets";


export const Route = createFileRoute("/dashboard")({
    component: () => (
        <DashboardProvider>
            <article>
                <section className="controls">
                    <Filters />
                    <div className="views">
                        <Link to="/dashboard/overview"><Icon icon={Dashboard} title="Card view" /></Link>
                        <Link to="/dashboard"><Icon icon={NestedList} title="Nested list view" /></Link>
                        <Link to="/dashboard/list"><Icon icon={List} title="List view" /></Link>
                    </div>
                </section>
                <section className="content">
                    <Outlet />
                </section>
            </article>
        </DashboardProvider>
    )
});
