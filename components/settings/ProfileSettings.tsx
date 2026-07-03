'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { toast } from 'sonner'

interface ProfileSettingsProps { profile: Profile | null; userId: string; userEmail: string }

export function ProfileSettings({ profile, userId, userEmail }: ProfileSettingsProps) {
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    display_name: profile?.display_name ?? '',
    phone: profile?.phone ?? '',
    pan_number: profile?.pan_number ?? '',
    financial_year: profile?.financial_year ?? '2025-26',
  })
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const router = useRouter()

  const save = () => {
    startTransition(async () => {
      const { error } = await supabase.from('profiles').update(form).eq('id', userId)
      if (error) toast.error(error.message)
      else { toast.success('Profile updated'); router.refresh() }
    })
  }

  const initials = form.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5">
      <SectionCard title="Personal Information" description="Your name and contact details">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url ?? ''} />
              <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <button className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors">
              <Camera className="h-3 w-3" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium">{form.full_name || 'Your Name'}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'full_name', label: 'Full Name', placeholder: 'Joshua Thomas' },
            { key: 'display_name', label: 'Display Name', placeholder: 'Josh' },
            { key: 'phone', label: 'Phone', placeholder: '+91 9876543210' },
            { key: 'pan_number', label: 'PAN Number', placeholder: 'ABCDE1234F' },
          ].map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs font-medium">{f.label}</Label>
              <Input value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} className="h-9 text-sm" />
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}