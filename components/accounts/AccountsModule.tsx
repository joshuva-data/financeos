'use client'

import { useState, useEffect } from 'react'
import { Plus, Wallet, CreditCard, TrendingUp, Building2, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddAccountForm } from '@/components/forms/AddAccountForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface Account {
  id: string; name: string; account_type: string; bank_name?: string
  balance: number; credit_limit?: number; interest_rate?: number
  is_primary: boolean; account_number?: string; status: string
}
interface Transaction {
  id: string; description?: string; category: string; txn_date: string
  direction: string; amount: number
}

const TYPE_ICONS: Record<string, string> = {
  savings:'🏦',current:'🏢',salary:'💰',fd:'📈',rd:'📊',ppf:'🏛️',
  nps:'🏛️',wallet:'👛',cash:'💵',credit_card:'💳',loan:'⚠️',demat:'📉',other:'💼'
}

export function AccountsModule({ accounts: initial, recentTxns }: { accounts: Account[]; recentTxns: Transaction[] }) {
  const [accounts, setAccounts] = useState(initial)
  useEffect(() => { setAccounts(initial) }, [initial])
  const [tab, setTab]           = useState('all')
  const [showAdd, setShowAdd]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { setAccounts(prev => prev.filter(a => a.id !== id)); toast.success('Account deleted') }
    setDeleting(null)
  }

  const totalBalance = accounts.filter(a => !['credit_card','loan'].includes(a.account_type)).reduce((s,a) => s+a.balance, 0)
  const byType = accounts.reduce<Record<string,Account[]>>((acc,a) => {
    const g = ['savings','current','salary','cash','wallet'].includes(a.account_type) ? 'bank'
      : ['fd','rd','ppf','nps','demat'].includes(a.account_type) ? 'investments'
      : a.account_type === 'credit_card' ? 'credit' : 'loans'
    acc[g] = [...(acc[g]??[]), a]; return acc
  }, {})

  const renderAccount = (account: Account) => (
    <div key={account.id} className="glass-card rounded-xl px-5 py-4 flex items-center justify-between hover:border-blue-500/20 transition-all">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{TYPE_ICONS[account.account_type]??'💼'}</span>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{account.name}</p>
            {account.is_primary && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[10px]">{account.account_type.replace('_',' ')}</Badge>
            {account.bank_name && <span className="text-xs text-muted-foreground">{account.bank_name}</span>}
            {account.account_number && <span className="text-xs text-muted-foreground">····{account.account_number.slice(-4)}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={cn('text-base font-bold tabular-nums', account.account_type==='credit_card'?'text-red-400':'text-white')}>
            {fmtINR(account.balance)}
          </p>
          {account.account_type==='credit_card' && account.credit_limit && (
            <p className="text-xs text-muted-foreground">of {fmtINR(account.credit_limit)} limit</p>
          )}
          {account.interest_rate && <p className="text-xs text-muted-foreground">{account.interest_rate}% p.a.</p>}
        </div>
        <button onClick={() => handleDelete(account.id, account.name)} disabled={deleting===account.id}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div><h1 className="page-title">Accounts</h1><p className="text-xs text-muted-foreground mt-0.5">{accounts.length} linked accounts</p></div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" /> Add Account</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Balance', value:fmtINR(totalBalance), icon:Wallet, color:'text-blue-400' },
          { label:'Bank Accounts', value:String(byType.bank?.length??0), icon:Building2, color:'text-blue-400' },
          { label:'Credit Limit',  value:fmtINR(accounts.filter(a=>a.account_type==='credit_card').reduce((s,a)=>s+(a.credit_limit??0),0)), icon:CreditCard, color:'text-amber-400' },
          { label:'Active Loans',  value:fmtINR(accounts.filter(a=>a.account_type==='loan').reduce((s,a)=>s+a.balance,0)), icon:TrendingUp, color:'text-red-400' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between"><p className="metric-label">{item.label}</p><item.icon className={cn('h-4 w-4',item.color)} /></div>
            <p className="text-xl font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="bank">Bank</TabsTrigger><TabsTrigger value="investments">Investments</TabsTrigger><TabsTrigger value="credit">Credit</TabsTrigger><TabsTrigger value="recent">Recent</TabsTrigger></TabsList>
        {['all','bank','investments','credit','loans'].map(g => (
          <TabsContent key={g} value={g} className="mt-4 space-y-3">
            {(g==='all'?accounts:(byType[g]??[])).map(renderAccount)}
            {(g==='all'?accounts:(byType[g]??[])).length===0 && (
              <div className="glass-card rounded-xl flex flex-col items-center justify-center py-12 gap-3">
                <span className="text-3xl">🏦</span>
                <p className="text-sm text-muted-foreground">No {g} accounts yet</p>
                <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Account</Button>
              </div>
            )}
          </TabsContent>
        ))}
        <TabsContent value="recent" className="mt-4 space-y-2">
          {recentTxns.length===0
            ? <p className="text-center py-10 text-sm text-muted-foreground">No recent transactions</p>
            : recentTxns.map(txn => (
              <div key={txn.id} className="glass-card rounded-lg px-4 py-3 flex items-center justify-between">
                <div><p className="text-sm font-medium">{txn.description??txn.category}</p><p className="text-xs text-muted-foreground">{fmtDate(txn.txn_date)} · {txn.category}</p></div>
                <span className={cn('text-sm font-semibold tabular-nums', txn.direction==='credit'?'text-green-400':'text-red-400')}>{txn.direction==='credit'?'+':'−'}{fmtINR(txn.amount)}</span>
              </div>
            ))
          }
        </TabsContent>
      </Tabs>
      <AddAccountForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
