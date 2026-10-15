import { describe, expect, it } from 'vitest'
import { budgetEntryErrors, budgetEntryPayload, cohortEntryErrors, cohortEntryPayload, duplicateEntryIds, emptyBudgetEntry, emptyMetricEntry, metricEntryErrors, metricEntryPayload, nextEntryMonth } from './dataEntryForm'

const metric = { ...emptyMetricEntry(1, '2026-10', 'fact'),values:{new_units:'0',arpu:'1.25',revenue:'0',marketing_spend:'0',retention_rate:'85'},comment:'note' }
const cohort = {period:'2026-10',type:'plan' as const,size:'1',marketing:'',retention:Array<string>(12).fill('')}

describe('wizard stored-source validation and payloads', () => {
  it('adds real calendar months across year boundaries and rejects invalid identities', () => {
    expect(nextEntryMonth('2026-10')).toBe('2026-11')
    expect(nextEntryMonth('2026-12')).toBe('2027-01')
    expect(nextEntryMonth('2026-13')).toBe('')
    expect(nextEntryMonth('9999-12')).toBe('')
    expect(metricEntryErrors({...metric,period:'',type:''})).toMatchObject({period:'company.unit.required',type:'company.unit.required'})
  })
  it.each([['new_units','1.5'],['arpu','0'],['revenue',''],['marketing_spend','-1'],['retention_rate','101']] as const)('rejects Metric %s=%s', (field,value) => {
    expect(metricEntryErrors({...metric,values:{...metric.values,[field]:value}})[field]).toBeTruthy()
  })
  it('sends only raw Metric inputs, percentage conversion and supported comment', () => {
    expect(metricEntryPayload(metric)).toEqual({period:'2026-10-01',type:'fact',new_units:0,arpu:1.25,revenue:0,marketing_spend:0,retention_rate:0.85,comment:'note'})
    expect(()=>metricEntryPayload(emptyMetricEntry(1,'2026-10','fact'))).toThrow()
  })
  it('blocks only duplicate period/type pairs, allowing Plan and Fact in the same month', () => {
    expect([...duplicateEntryIds([metric,{...metric,id:2}])]).toEqual([1,2])
    expect(duplicateEntryIds([metric,{...metric,id:2,type:'plan'}]).size).toBe(0)
  })
  it.each(['','0','1.5','Infinity'])('rejects Cohort size %s', (size) => {
    expect(cohortEntryErrors({...cohort,size}).size).toBeTruthy()
  })
  it('keeps unknown Cohort retention null and distinguishes actual zero; optional marketing omitted', () => {
    const payload=cohortEntryPayload({...cohort,retention:['85','0',...Array<string>(10).fill('')]})
    expect(payload).toMatchObject({retention_m1:0.85,retention_m2:0,retention_m3:null,retention_m12:null})
    expect(payload).not.toHaveProperty('marketing_spend')
    expect(cohortEntryPayload({...cohort,marketing:'0'}).marketing_spend).toBe(0)
    expect(cohortEntryErrors({...cohort,marketing:'-1'}).marketing).toBeTruthy()
    expect(cohortEntryErrors({...cohort,retention:['101',...Array<string>(11).fill('')]})).toHaveProperty('retention-1')
  })
  it('requires every Budget amount but accepts zero and decimal without derivations', () => {
    const row=emptyBudgetEntry(2,'2026-11','plan')
    expect(Object.keys(budgetEntryErrors(row))).toEqual(['cogs','marketing','development','fot','gna'])
    expect(()=>budgetEntryPayload(row)).toThrow()
    expect(budgetEntryPayload({...row,values:{cogs:'0',marketing:'0',development:'1.25',fot:'0',gna:'0'}})).toEqual({period:'2026-11-01',type:'plan',cogs:0,marketing:0,development:1.25,fot:0,gna:0})
  })
})
