import React, { useState } from 'react';
import { Field, AutocompleteInput, PillSelect } from './Shared';
import { saveState } from '../storage';

export function ExpensesTab({state,setState,toast}){
  const today = new Date().toISOString().slice(0,10);
  const [date,setDate] = useState(today);
  const [description,setDescription] = useState('');
  const [accountType,setAccountType] = useState('');
  const [amount,setAmount] = useState('');
  const [notes,setNotes] = useState('');
  const [paymentStatus,setPaymentStatus] = useState('paid'); // 'paid' | 'unpaid'
  const [payeeName,setPayeeName] = useState('');

  function reset(keepDate){
    setDescription(''); setAccountType(''); setAmount(''); setNotes(''); setPaymentStatus('paid'); setPayeeName('');
    if(!keepDate) setDate(today);
  }

  function submit(){
    if(!description.trim()){ toast('Enter what this expense was for.','bad'); return; }
    if(!accountType){ toast('Choose an expense category.','bad'); return; }
    if(!amount || Number(amount)<=0){ toast('Enter an amount greater than 0.','bad'); return; }
    if(paymentStatus==='unpaid' && !payeeName.trim()){ toast('Enter who you owe for this expense.','bad'); return; }

    const expenseId = 'exp_'+Date.now();
    const newExpense = {
      id: expenseId, date, description:description.trim(),
      accountType, amount:Number(amount), notes:notes.trim(),
      paymentStatus
    };
    let nextLedger = state.ledger || [];
    if(paymentStatus==='unpaid'){
      nextLedger = [...nextLedger, {
        id:'ledger_'+Date.now(), date, type:'payable', name:payeeName.trim(),
        item: description.trim(), amount: Number(amount), status:'open', settledDate:null,
        linkedExpenseId: expenseId
      }];
    }
    const next = {...state, expenses:[...state.expenses, newExpense], ledger:nextLedger};
    setState(next);
    saveState(next);
    const paidNote = paymentStatus==='unpaid' ? ' (unpaid)' : '';
    toast(`Logged ${accountType} expense`+paidNote, 'good');
    reset(true);
  }

  const thisMonth = date.slice(0,7);
  const monthTotal = state.expenses
    .filter(e=>e.date.slice(0,7)===thisMonth)
    .reduce((a,e)=>a+e.amount,0);

  return (
    <div style={{padding:'0 20px 100px'}}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>

      <Field label="What was it for">
        <input style={inputStyle} value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Security, Base salary…" />
      </Field>

      <Field label="Category">
        <PillSelect value={accountType} onChange={setAccountType} options={EXPENSE_TYPES} />
      </Field>

      <Field label="Amount">
        <input type="number" inputMode="decimal" style={inputStyle} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" />
      </Field>

      <Field label="Payment">
        <PillSelect value={paymentStatus} onChange={setPaymentStatus} options={['paid','unpaid']} />
        <div style={{fontSize:12,color:'var(--concrete)',marginTop:6}}>
          {paymentStatus==='unpaid' ? 'Expense happened now, you\u2019ll pay it later \u2014 tracked in Owed.' : 'Paid now.'}
        </div>
      </Field>

      {paymentStatus==='unpaid' && (
        <Field label="Who you owe">
          <input style={inputStyle} value={payeeName} onChange={e=>setPayeeName(e.target.value)} placeholder="e.g. landlord, supplier name" />
        </Field>
      )}

      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. paid to Nason" />
      </Field>

      <button onClick={submit} style={{
        width:'100%', padding:'16px', borderRadius:12, border:'none',
        background:'var(--accent)', color:'#1c1b19', fontSize:16, fontWeight:700,
        cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
      }}>Log expense</button>

      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginTop:20,marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--concrete-light)'}}>This month\u2019s expenses</div>
        <div style={{fontSize:20,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"}}>{monthTotal.toFixed(2)}</div>
      </div>

      <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10,fontWeight:600}}>Recent</div>
      {[...state.expenses].reverse().slice(0,8).map(e=>(
        <div key={e.id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--line)',fontSize:14}}>
          <div>
            <div>{e.description}</div>
            <div style={{fontSize:12,color:'var(--concrete)'}}>{e.accountType} &middot; {e.date}</div>
          </div>
          <span style={{fontWeight:600}}>{e.amount.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

