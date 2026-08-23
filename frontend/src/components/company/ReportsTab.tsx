import { Card, CardContent } from '@/components/ui/card'
import { FileText, FileSpreadsheet } from 'lucide-react'

interface ReportsTabProps {
  companyId: string
}

export function ReportsTab({ companyId }: ReportsTabProps) {
  const base = `/api/v1/companies/${companyId}/report`

  return (
    <Card className="border bg-card/50">
      <CardContent className="p-5">
        <h3 className="font-semibold text-foreground mb-2">
          Отчёты для инвесторов
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Скачайте презентабельный PDF или аналитический Excel-отчёт по компании:
          сводка, юнит-экономика, P&amp;L, Cash Flow, оценка Гордона.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href={`${base}/pdf`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted/40 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Скачать PDF
          </a>
          <a
            href={`${base}/excel`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted/40 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Скачать Excel
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
