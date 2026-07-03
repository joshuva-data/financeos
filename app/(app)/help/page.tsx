import Link from 'next/link'
import { HelpCircle, MessageSquare, FileText, Mail, ExternalLink,
  ChevronRight, Bot, Zap, Wallet, Shield, CreditCard } from 'lucide-react'

const FAQS = [
  { q: 'How do I add a bank account?', a: 'Go to Accounts → click "+ Add Account" → fill in your bank details and current balance.', href: '/accounts' },
  { q: 'How does the AI Copilot work?', a: 'The AI Copilot uses Groq (free) to answer your finance questions. Go to AI Copilot and type any question about your finances.', href: '/ai-copilot' },
  { q: 'How do I track my EMIs?', a: 'Go to Debt → click "+ Add Loan" → enter your loan details including EMI amount and next EMI date. The dashboard will show upcoming EMIs.', href: '/debt' },
  { q: 'How do I upload financial documents?', a: 'Go to Documents → click "Upload" → select your PDF or image file → choose the document type and save.', href: '/documents' },
  { q: 'How do I import data from Excel?', a: 'Go to Automation → Import tab → drag and drop your Excel or CSV file. The system will process it.', href: '/automation' },
  { q: 'How is the Financial Health Score calculated?', a: 'The score is based on your emergency fund (3+ months of expenses), debt ratio (below 30%), investments, and active financial goals.', href: '/dashboard' },
  { q: 'How do I track my tithe?', a: 'Go to Tithe & Giving → click "Record Giving" → enter the recipient, amount, and whether it is tax deductible under 80G.', href: '/tithe' },
  { q: 'How do I set financial goals?', a: 'Go to Goals → click "+ Add Goal" → set your target amount, timeline, and monthly contribution. Track progress on the dashboard.', href: '/goals' },
]

const QUICK_LINKS = [
  { label: 'Accounts Guide',      href: '/accounts',    icon: Wallet   },
  { label: 'AI Copilot',          href: '/ai-copilot',  icon: Bot      },
  { label: 'Automation & Import', href: '/automation',  icon: Zap      },
  { label: 'Insurance',           href: '/insurance',   icon: Shield   },
  { label: 'Debt & EMIs',         href: '/debt',        icon: CreditCard },
  { label: 'Documents',           href: '/documents',   icon: FileText },
]

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Help & Support</h1>
        <p className="text-sm text-muted-foreground mt-1">Everything you need to get the most out of FinanceOS</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {QUICK_LINKS.map(link => (
          <Link key={link.href} href={link.href}
            className="glass-card rounded-xl p-4 flex items-center gap-3 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <link.icon className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">{link.label}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>

      {/* FAQs */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="glass-card rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-white">{faq.q}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">{faq.a}</p>
              <div className="pl-6">
                <Link href={faq.href} className="text-xs text-blue-400 hover:underline">
                  Go to {faq.href.replace('/','').replace('-',' ')} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact + Tech info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">AI Copilot Support</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Ask the AI Copilot any finance question — it's free and powered by Llama 3 via Groq.
          </p>
          <Link href="/ai-copilot"
            className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:underline">
            Open AI Copilot <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Tech Stack</h3>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• Next.js 15 + TypeScript</p>
            <p>• Supabase (PostgreSQL)</p>
            <p>• Groq AI — Llama 3 70B (Free)</p>
            <p>• Tailwind CSS + Recharts</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="glass-card rounded-xl p-5 text-center space-y-2">
        <p className="text-sm font-semibold text-white">FinanceOS v0.1.0</p>
        <p className="text-xs text-muted-foreground">Your personal finance OS — built for India 🇮🇳</p>
        <div className="flex items-center justify-center gap-4 pt-1">
          <Link href="/settings" className="text-xs text-blue-400 hover:underline">Settings</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/dashboard" className="text-xs text-blue-400 hover:underline">Dashboard</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/ai-copilot" className="text-xs text-blue-400 hover:underline">AI Copilot</Link>
        </div>
      </div>
    </div>
  )
}
