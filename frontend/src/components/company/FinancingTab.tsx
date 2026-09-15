import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FinancingCreate, FinancingResponse, FinancingUpdate } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtRub } from '@/lib/format'
import { Plus, Pencil, Trash2, X } from 'lucide-react'

interface FinancingTabProps {
  data?: FinancingResponse[]
  isLoading?: boolean
  canEdit?: boolean
  onCreate?: (d: FinancingCreate) => void
  onUpdate?: (fid: string, d: FinancingUpdate) => void
  onDelete?: (fid: string) => void
}

interface FormState {
  type: 'investment' | 'loan'
  investor_type: 'founder' | 'fund'
  counterparty_name: string
  amount: string
  issued_date: string
  annual_rate: string
  term_months: string
}

const emptyForm: FormState = {
  type: 'investment',
  investor_type: 'founder',
  counterparty_name: '',
  amount: '',
  issued_date: '',
  annual_rate: '',
  term_months: '',
}

export function FinancingTab({ data, isLoading, canEdit, onCreate, onUpdate, onDelete }: FinancingTabProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const investments = (data ?? []).filter((f) => f.type === 'investment')
  const loans = (data ?? []).filter((f) => f.type === 'loan')

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setFormOpen(false)
  }

  const startAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setFormOpen(true)
  }

  const startEdit = (f: FinancingResponse) => {
    setForm({
      type: f.type,
      investor_type: (f.investorType as 'founder' | 'fund') ?? 'founder',
      counterparty_name: f.counterpartyName ?? '',
      amount: String(f.amount),
      issued_date: f.issuedDate ?? '',
      annual_rate: f.annualRate != null ? String(f.annualRate) : '',
      term_months: f.termMonths != null ? String(f.termMonths) : '',
    })
    setEditingId(f.id)
    setFormOpen(true)
  }

  const submit = () => {
    const amount = Number(form.amount)
    if (!amount || amount <= 0) return
    const base = {
      amount,
      counterparty_name: form.counterparty_name || undefined,
      issued_date: form.issued_date || undefined,
    }
    if (form.type === 'investment') {
      const payload: FinancingCreate = {
        type: 'investment',
        investor_type: form.investor_type,
        ...base,
      }
      if (editingId) onUpdate?.(editingId, payload)
      else onCreate?.(payload)
    } else {
      const payload: FinancingCreate = {
        type: 'loan',
        annual_rate: Number(form.annual_rate) || undefined,
        term_months: Number(form.term_months) || undefined,
        repayment_type: 'annuity',
        ...base,
      }
      if (editingId) onUpdate?.(editingId, payload)
      else onCreate?.(payload)
    }
    resetForm()
  }

  if (isLoading) {
    return (
      <Card className="border bg-card">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-56 mb-4" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  const renderRows = (rows: FinancingResponse[]) =>
    rows.map((f) => (
      <TableRow key={f.id}>
        <TableCell className="text-muted-foreground">
          {f.type === 'investment'
            ? (f.investorType === 'fund' ? t('company.financing.fund') : t('company.financing.founder'))
            : t('company.financing.typeLoan')}
        </TableCell>
        <TableCell className="font-medium text-foreground">{f.counterpartyName ?? '—'}</TableCell>
        <TableCell className="text-right tabular-nums text-foreground">{fmtRub(f.amount)}</TableCell>
        <TableCell className="text-muted-foreground">{f.issuedDate ?? '—'}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {f.type === 'loan'
            ? `${f.annualRate ?? 0}% / ${f.termMonths ?? 0} мес.`
            : '—'}
        </TableCell>
        {canEdit && (
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" aria-label={t('company.financing.edit')} onClick={() => startEdit(f)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label={t('company.financing.delete')} onClick={() => onDelete?.(f.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>
    ))

  const emptyRow = (colspan: number) => (
    <TableRow>
      <TableCell colSpan={colspan} className="py-6 text-center text-muted-foreground">
        {t('company.financing.empty')}
      </TableCell>
    </TableRow>
  )

  const cols = canEdit ? 6 : 5

  return (
    <div className="space-y-6">
      <Card className="border bg-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">{t('company.financing.title')}</h3>
            {canEdit && (
              <Button size="sm" onClick={startAdd}>
                <Plus className="w-4 h-4 mr-2" />
                {t('company.financing.add')}
              </Button>
            )}
          </div>

          {formOpen && canEdit && (
            <Card className="border bg-card mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">
                    {editingId ? t('company.financing.edit') : t('company.financing.add')}
                  </span>
                  <Button size="sm" variant="ghost" onClick={resetForm}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('company.financing.type')}</label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm({ ...form, type: v as 'investment' | 'loan' })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="investment">{t('company.financing.typeInvestment')}</SelectItem>
                        <SelectItem value="loan">{t('company.financing.typeLoan')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.type === 'investment' && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">{t('company.financing.investorType')}</label>
                      <Select
                        value={form.investor_type}
                        onValueChange={(v) => setForm({ ...form, investor_type: v as 'founder' | 'fund' })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="founder">{t('company.financing.founder')}</SelectItem>
                          <SelectItem value="fund">{t('company.financing.fund')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="fin-counterparty" className="block text-xs font-medium text-muted-foreground mb-1">{t('company.financing.counterpartyName')}</label>
                    <Input id="fin-counterparty" value={form.counterparty_name} onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="fin-amount" className="block text-xs font-medium text-muted-foreground mb-1">{t('company.financing.amount')}</label>
                    <Input id="fin-amount" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="fin-issued" className="block text-xs font-medium text-muted-foreground mb-1">{t('company.financing.issuedDate')}</label>
                    <Input id="fin-issued" type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} />
                  </div>
                  {form.type === 'loan' && (
                    <>
                      <div>
                        <label htmlFor="fin-rate" className="block text-xs font-medium text-muted-foreground mb-1">{t('company.financing.annualRate')}</label>
                        <Input id="fin-rate" type="number" min="0" value={form.annual_rate} onChange={(e) => setForm({ ...form, annual_rate: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor="fin-term" className="block text-xs font-medium text-muted-foreground mb-1">{t('company.financing.termMonths')}</label>
                        <Input id="fin-term" type="number" min="0" value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={submit}>{t('company.financing.save')}</Button>
                  <Button size="sm" variant="outline" onClick={resetForm}>{t('company.financing.cancel')}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">{t('company.financing.investments')}</h4>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('company.financing.type')}</TableHead>
                      <TableHead>{t('company.financing.counterpartyName')}</TableHead>
                      <TableHead className="text-right">{t('company.financing.amount')}</TableHead>
                      <TableHead>{t('company.financing.issuedDate')}</TableHead>
                      <TableHead className="text-right">{t('company.financing.terms')}</TableHead>
                      {canEdit && <TableHead className="text-right"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investments.length === 0 ? emptyRow(cols) : renderRows(investments)}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">{t('company.financing.loans')}</h4>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('company.financing.type')}</TableHead>
                      <TableHead>{t('company.financing.counterpartyName')}</TableHead>
                      <TableHead className="text-right">{t('company.financing.amount')}</TableHead>
                      <TableHead>{t('company.financing.issuedDate')}</TableHead>
                      <TableHead className="text-right">{t('company.financing.terms')}</TableHead>
                      {canEdit && <TableHead className="text-right"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.length === 0 ? emptyRow(cols) : renderRows(loans)}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
