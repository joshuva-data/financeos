'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setError('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-2xl border border-border/50 bg-card">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">FinanceOS</h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        <div className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Please wait…' : isSignUp ? 'Sign Up' : 'Sign In'}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary underline underline-offset-2"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}