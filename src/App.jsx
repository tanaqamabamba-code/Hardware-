import React, { useState, useEffect } from 'react';
import { loadState, saveState } from './storage';
import { initialState } from './fifo';

import { TopBar, Toast, TabBar } from './components/Shared';
import { SalesTab } from './components/SalesTab';
import { HistoryTab } from './components/HistoryTab';
import { StockTab } from './components/StockTab';
import { NewstockTab } from './components/NewstockTab';
import { ExpensesTab } from './components/ExpensesTab';
import { DamageLossTab } from './components/DamageLossTab';
import { LedgerTab } from './components/LedgerTab';
import { HRTab } from './components/HRTab';
import { HealthTab } from './components/HealthTab';
import { DownloadsTab } from './components/DownloadsTab';
import { BackupPanel } from './components/BackupPanel';

export default function App(){
  const [state,setState] = useState(null);
  const [tab,setTab] = useState('sales');
  const [toastMsg,setToastMsg] = useState(null);
  const [showBackup,setShowBackup] = useState(false);

  useEffect(()=>{
    (async ()=>{
      const loaded = await loadState();
      setState(loaded || initialState());
    })();
  },[]);

  function toast(text,kind){
    setToastMsg({text,kind});
    setTimeout(()=>setToastMsg(null), 2200);
  }

  if(!state){
    return <div style={{padding:40,textAlign:'center',color:'var(--concrete-light)'}}>Loading…</div>;
  }

  return (
    <React.Fragment>
      <TabBar tab={tab} setTab={setTab} />
      <TopBar tab={tab} onBackupClick={()=>setShowBackup(true)} />
      {tab==='sales' && <SalesTab state={state} setState={setState} toast={toast} />}
      {tab==='history' && <HistoryTab state={state} setState={setState} toast={toast} />}
      {tab==='stock' && <StockTab state={state} setState={setState} toast={toast} />}
      {tab==='newstock' && <NewstockTab state={state} setState={setState} toast={toast} />}
      {tab==='expenses' && <ExpensesTab state={state} setState={setState} toast={toast} />}
      {tab==='loss' && <DamageLossTab state={state} setState={setState} toast={toast} />}
      {tab==='ledger' && <LedgerTab state={state} setState={setState} toast={toast} />}
      {tab==='hr' && <HRTab state={state} setState={setState} toast={toast} />}
      {tab==='health' && <HealthTab state={state} setState={setState} toast={toast} />}
      {tab==='downloads' && <DownloadsTab state={state} toast={toast} />}
      {showBackup && <BackupPanel state={state} setState={setState} toast={toast} onClose={()=>setShowBackup(false)} />}
      <Toast msg={toastMsg} />
    </React.Fragment>
  );
}