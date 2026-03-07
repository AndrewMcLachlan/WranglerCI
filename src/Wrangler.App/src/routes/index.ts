import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()

  // Redirect to the table view route
  navigate({ to: "/dashboard" })

  return null // This component does not render anything
}
