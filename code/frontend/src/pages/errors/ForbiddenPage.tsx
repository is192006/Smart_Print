import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { StateBlock } from '@/components/ui/StateBlock'
import { useAuth } from '@/hooks/useAuth'
import { homeRouteForRole } from '@/routes/guards'

export function ForbiddenPage() {
  const { user } = useAuth()
  const homeTo = user ? homeRouteForRole(user.role) : '/login'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <StateBlock
        icon="xCircle"
        title="You don't have permission to view this"
        description="This page isn't available for your account type. If you think this is a mistake, contact an administrator."
        action={
          <Link to={homeTo}>
            <Button>Back to home</Button>
          </Link>
        }
      />
    </div>
  )
}
