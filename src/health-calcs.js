// Health/reporting calculations shared across HealthTab panels
import { monthKey } from './utils';

export function calculateRetainedEarnings(state, month){
  let total = 0;
  const allMonths = new Set();
  state.sales.forEach(s=>allMonths.add(monthKey(s.date)));
  state.expenses.forEach(e=>allMonths.add(monthKey(e.date)));
  [...allMonths].filter(m=>m<=month).forEach(m=>{
    const mSales = state.sales.filter(s=>monthKey(s.date)===m);
    const sales = mSales.reduce((a,s)=>a+s.qty*s.price,0);
    const cogs = mSales.reduce((a,s)=>a+(s.fifoPrice*s.qty),0);
    const mExpenses = state.expenses.filter(e=>monthKey(e.date)===m).reduce((a,e)=>a+e.amount,0);
    total += (sales - cogs) - mExpenses;
  });
  return total;
}

export function totalDrawings(state, asOfMonth){
  return (state.drawings||[])
    .filter(d=> !asOfMonth || monthKey(d.date)<=asOfMonth)
    .reduce((a,d)=>a+d.amount,0);
}

export function computeClosingCash(state, month){
  const openingBalances = state.cashOpeningBalances || {};
  const ledger = state.ledger || [];
  // find the earliest month with data, walk forward month by month accumulating net cash flow,
  // so "closing cash" for any month reflects everything before it too - not just that month in isolation
  const allMonths = new Set();
  state.sales.forEach(s=>allMonths.add(monthKey(s.date)));
  state.batches.forEach(b=>allMonths.add(monthKey(b.date)));
  state.expenses.forEach(e=>allMonths.add(monthKey(e.date)));
  ledger.forEach(l=>{ if(l.settledDate) allMonths.add(monthKey(l.settledDate)); });
  (state.drawings||[]).forEach(d=>allMonths.add(monthKey(d.date)));
  Object.keys(openingBalances).forEach(m=>allMonths.add(m));
  const sorted = [...allMonths].filter(m=>m<=month).sort();
  if(sorted.length===0) return openingBalances[month] ?? 0;

  const firstMonth = sorted[0];
  let running = openingBalances[firstMonth] ?? 0;
  for(const m of sorted){
    if(m===firstMonth){
      // opening balance already set as starting point above; for firstMonth just add its net flow
    } else {
      // subsequent months start from where the previous one ended, unless a manual override was entered
      if(openingBalances[m] !== undefined) running = openingBalances[m];
    }
    // Only paid-in-cash transactions count directly; unpaid/credit ones don't move cash yet.
    const mSales = state.sales.filter(s=>monthKey(s.date)===m && (s.paymentStatus||'paid')==='paid').reduce((a,s)=>a+s.qty*s.price,0);
    const mPurchases = state.batches.filter(b=>monthKey(b.date)===m && (b.paymentStatus||'paid')==='paid').reduce((a,b)=>a+b.qty*b.price,0);
    const mExpenses = state.expenses.filter(e=>monthKey(e.date)===m && (e.paymentStatus||'paid')==='paid').reduce((a,e)=>a+e.amount,0);
    // Ledger settlements move cash in the month they're actually settled, not the original transaction date.
    const mReceipts = ledger.filter(l=>l.type==='receivable' && l.status==='settled' && l.settledDate && monthKey(l.settledDate)===m).reduce((a,l)=>a+l.amount,0);
    const mPayments = ledger.filter(l=>l.type==='payable' && l.status==='settled' && l.settledDate && monthKey(l.settledDate)===m).reduce((a,l)=>a+l.amount,0);
    const mDrawings = (state.drawings||[]).filter(d=>monthKey(d.date)===m).reduce((a,d)=>a+d.amount,0);
    running += (mSales + mReceipts) - (mPurchases + mExpenses + mPayments + mDrawings);
  }
  return running;
}

