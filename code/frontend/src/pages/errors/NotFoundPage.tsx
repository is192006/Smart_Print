import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { StateBlock } from '@/components/ui/StateBlock'

export function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <StateBlock
        icon="search"
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Link to="/">
            <Button>Back to home</Button>
          </Link>
        }
      />
    </div>
  )
}
