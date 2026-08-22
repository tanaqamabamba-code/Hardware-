import React, { useState, useMemo } from 'react';
import { Field, AutocompleteInput, PillSelect, inputStyle } from './Shared';
import { saveState } from '../storage';
import { downloadCSV } from '../utils';

export function NewstockTab({state,setState,toast}){
  const today = new Date().toISOString().slice(0,10);
  const [date,setDate] = useState(today);
  const [item,setItem] = useState('');
  const [qty,setQty] = useState('');
  const [price,setPrice] = useState('');
  const [paymentStatus,setPaymentStatus] = useState('paid');
  const [supplierName,setSupplierName] = useState('');

  const itemNames = useMemo(()=>state.items.map(i=>i.name),[state.items]);
  const isNewItem = item && !state.items.some(i=>i.name===item);

  function reset(keepDate){
    setItem(''); setQty(''); setPrice(''); setPaymentStatus('paid'); setSupplierName('');
    if(!keepDate) setDate(today);
  }

  function submit(){
    if(!item){ toast('Enter or choose an item.','bad'); return; }
    if(!qty || Number(qty)<=0){ toast('Enter a quantity greater than 0.','bad'); return; }
    if(!price || Number(price)<0){ toast('Enter a valid price.','bad'); return; }
    if(paymentStatus==='credit' && !supplierName.trim()){ toast('Enter the supplier’s name for a credit purchase.','bad'); return; }

    const q = Number(qty), p = Number(price);
    let nextItems = state.items;
    if(isNewItem){
      nextItems = [...state.items, { name:item, openingQty:0, openingPrice:p }];
    }

    const batchId = 'batch_'+Date.now();
    const newBatch = { id:batchId, date, item, qty:q, price:p, paymentStatus };
    let nextLedger = state.ledger || [];
    if(paymentStatus==='credit'){
      const total = Math.round(q*p*100)/100;
      nextLedger = [...nextLedger, {
        id:'ledger_'+Date.now(), date, type:'payable', name:supplierName.trim(),
        item: `${q}×${item}`, amount: total, status:'open', settledDate:null,
        linkedBatchId: batchId
      }];
    }
    const next = {...state, items:nextItems, batches:[...state.batches, newBatch], ledger:nextLedger};
    setState(next);
    saveState(next);
    const paidNote = paymentStatus==='credit' ? ' (on credit)' : '';
    toast(`Added ${q} × ${item} to stock`+paidNote, 'good');
    reset(true);
  }

  function downloadPurchaseHistory(){
    const headers = [
      {key:'date', label:'Date'},
      {key:'item', label:'Item'},
      {key:'qty', label:'Quantity'},
      {key:'price', label:'Price Paid (each)'},
      {key:'total', label:'Total'},
      {key:'status', label:'Payment Status'},
      {key:'supplier', label:'Supplier'},
    ];
    const rows = [...state.batches]
      .sort((a,b)=> a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      .map(b=>{
        const linkedLedger = (state.ledger||[]).find(l=>l.linkedBatchId===b.id);
        return {
          date: b.date,
          item: b.item,
          qty: b.qty,
          price: b.price.toFixed(2),
          total: (b.qty*b.price).toFixed(2),
          status: b.paymentStatus==='credit' ? (linkedLedger && linkedLedger.status==='settled' ? 'credit (settled)' : 'credit (open)') : 'paid',
          supplier: linkedLedger ? linkedLedger.name : '',
        };
      });
    if(rows.length===0){ toast('No purchases to download yet.','bad'); return; }
    downloadCSV(rows, headers, `purchase-history-${new Date().toISOString().slice(0,10)}.csv`);
  }

  return (
    <div style={{padding:'0 20px 100px'}}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>

      <Field label="Item">
        <AutocompleteInput value={item} onChange={setItem} options={itemNames} placeholder="Search or type a new item…" />
        {isNewItem && (
          <div style={{marginTop:8, fontSize:13, color:'var(--accent)'}}>
            New item — will be added to your item list
          </div>
        )}
      </Field>

      <div style={{display:'flex',gap:12}}>
        <div style={{flex:1}}>
          <Field label="Quantity bought">
            <input type="number" inputMode="decimal" style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div style={{flex:1}}>
          <Field label="Price paid (each)">
            <input type="number" inputMode="decimal" style={inputStyle} value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
      </div>

      {qty && price && (
        <div style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:16,fontSize:14,color:'var(--concrete-light)'}}>
          Total cost: <span style={{color:'var(--paper)',fontWeight:600}}>{(Number(qty)*Number(price)).toFixed(2)}</span>
        </div>
      )}

      <Field label="Payment">
        <PillSelect value={paymentStatus} onChange={setPaymentStatus} options={['paid','credit']} />
        <div style={{fontSize:12,color:'var(--concrete)',marginTop:6}}>
          {paymentStatus==='credit' ? 'Stock arrives now, you pay the supplier later — tracked in Owed.' : 'Paid the supplier now.'}
        </div>
      </Field>

      {paymentStatus==='credit' && (
        <Field label="Supplier name">
          <input style={inputStyle} value={supplierName} onChange={e=>setSupplierName(e.target.value)} placeholder="Who do you owe for this?" />
        </Field>
      )}

      <button onClick={submit} style={{
        width:'100%', padding:'16px', borderRadius:12, border:'none',
        background:'var(--accent)', color:'#1c1b19', fontSize:16, fontWeight:700,
        cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
      }}>Add stock</button>

      <div style={{marginTop:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>Recent purchases</div>
          <div onClick={downloadPurchaseHistory} style={{fontSize:12,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>Download all (CSV)</div>
        </div>
        {[...state.batches].reverse().slice(0,8).map((b,idx)=>(
          <div key={idx} style={{padding:'10px 0',borderBottom:'1px solid var(--line)',fontSize:14}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>{b.item}</span>
              <span style={{color:'var(--concrete-light)'}}>{b.qty} @ {b.price.toFixed(2)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:2,fontSize:11,color:'var(--concrete)'}}>
              <span>{b.date}</span>
              <span style={{color: b.paymentStatus==='credit' ? 'var(--accent)' : 'var(--good)'}}>{b.paymentStatus==='credit' ? 'On credit' : 'Paid'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}