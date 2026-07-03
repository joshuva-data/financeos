'use client'

import { useState } from 'react'
import { Shield, Smartphone, Key, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function SecuritySettings({ userEmail }: { userEmail: string }) {
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [pending, setPending] = useState(false)
  const supabase = createClient()

  const changePassword = async () => {
    if (form.newPassword !== form.confirmPassword) { toast.error('Passwords do not match'); return }
    if (form.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setPending(true)
    const { error } = await supabase.auth.updateUser({ password: form.newPassword })
    setPending(false)
    if (error) toast.error(error.message)
    else { toast.success('Password updated'); setForm({ newPassword: '', confirmPassword: '' }) }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Password" description="Change your account password">
        <div className="space-y-3 max-w-sm">
          {['newPassword', 'confirmPassword'].map(k => (
            <div key={k} className="space-y-1.5">
              <Label className="text-xs font-medium">{k === 'newPassword' ? 'New Password' : 'Confirm Password'}</Label>
              <div className="relative">
                <Input type={showPass ? 'text' : 'password'} value={form[k as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  placeholder="••••••••" className="h-9 text-sm pr-10" />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          <Button size="sm" onClick={changePassword} disabled={pending || !form.newPassword}>
            {pending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Update Password
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Two-Factor Authentication" description="Add an extra layer of security">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Authenticator App</p>
              <p className="text-xs text-muted-foreground">Coming soon — 2FA via TOTP</p>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled>Enable 2FA</Button>
        </div>
      </SectionCard>

      <SectionCard title="Active Sessions" description="Devices signed into your account">
        <div className="flex items-center gap-3 py-2">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
            <Shield className="h-5 w-5 text-positive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Current Session</p>
            <p className="text-xs text-muted-foreground">{userEmail} · Active now</p>
          </div>
          <span className="text-xs text-positive font-medium">Current</span>
        </div>
      </SectionCard>
    </div>
  )
}