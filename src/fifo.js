// FIFO inventory costing + core state logic
import { SEED_ITEMS, SEED_BATCHES, SEED_AGENTS } from './seedData';

export function initialState(){
  return {
    items: SEED_ITEMS.map(i=>({...i})),
    batches: SEED_BATCHES.map(b=>({...b})),
    sales: [],       // {id, date, item, qty, price, agent, fifoPrice, grossProfit}
    agents: SEED_AGENTS.slice(),
    expenses: [],    // {id, date, description, accountType, amount, notes}
    capital: 0,      // owner's capital contributed - manual entry, like the Excel Balance Sheet
    cashOpeningBalances: {}, // {"2026-01": 500, ...}
    ledger: [],      // {id, date, type: 'payable'|'receivable', name, amount, status: 'open'|'settled', settledDate}
    staff: [],       // {id, name, role, wage, frequency: 'daily'|'weekly'|'monthly'|'variable'}
    payroll: [],     // {id, date, staffId, staffName, amount, notes, expenseId}
    stockAdjustments: [], // {id, date, item, qty, reason, notes, fifoPrice, fifoLayer, costValue}
    drawings: [],    // {id, date, amount, notes} - owner withdrawals, not an expense
  };
}

const EXPENSE_TYPES = ['Rent','Salaries','Utilities','Transport','Repairs','Stationery','Stock loss','Other'];

/* ============ FIFO ENGINE ============
   Mirrors the Excel logic: opening stock is consumed first (at openingPrice),
   then purchase batches in date order. Each sale looks at how much of that
   item has already been sold (including itself), and finds which layer(s)
   that quantity range falls into.
*/
// If an item has an openingAsOf date (set when its opening quantity was last
// manually corrected, e.g. after a physical recount), everything dated on or
// before that date is historical only - it must not be double-counted on top
// of the corrected opening quantity. Only activity strictly AFTER that date
// still stacks on top of the opening layer.
export function afterOpeningCutover(state, itemName, dateStr){
  const item = state.items.find(i=>i.name===itemName);
  const cutover = item ? item.openingAsOf : null;
  if(!cutover) return true; // no cutover set - include everything, same as before
  return dateStr > cutover;
}

export function computeFifoForSale(state, item, saleDate, qty, excludeSaleId){
  const openingQty = (state.items.find(i=>i.name===item) || {openingQty:0}).openingQty || 0;
  const openingPrice = (state.items.find(i=>i.name===item) || {openingPrice:0}).openingPrice || 0;

  // all prior sales of this item (cash register order = date then insertion order), excluding the one being computed
  const priorSales = state.sales
    .filter(s => s.item===item && s.id!==excludeSaleId)
    .filter(s => s.date < saleDate || (s.date===saleDate)) // same/earlier date
    .filter(s => afterOpeningCutover(state, item, s.date))
    .map(s => ({ date:s.date, seq:s.seq, qty:s.qty }));

  // stock losses (damage/theft/etc) also consume the same FIFO layers as sales,
  // so they must count toward "already consumed" or a sale after a loss would
  // incorrectly price from a cheaper/earlier layer than what's actually left.
  const priorLosses = (state.stockAdjustments||[])
    .filter(a => a.item===item)
    .filter(a => a.date <= saleDate)
    .filter(a => afterOpeningCutover(state, item, a.date))
    .map(a => ({ date:a.date, seq:a.seq||0, qty:a.qty }));

  const priorConsumption = [...priorSales, ...priorLosses]
    .sort((a,b)=> (a.date<b.date?-1:a.date>b.date?1:a.seq-b.seq));

  // cumulative consumed up to (not including) this sale
  let cumBefore = 0;
  for(const c of priorConsumption){ cumBefore += c.qty; }
  const cumAfter = cumBefore + qty;

  // batches for this item, sorted by date - only those after the opening cutover count
  const batches = state.batches
    .filter(b=>b.item===item)
    .filter(b=>afterOpeningCutover(state, item, b.date))
    .sort((a,b)=> a.date<b.date?-1:a.date>b.date?1:0);

  let running = openingQty;
  const layers = [{ label:'Opening stock', start:0, end:openingQty, price:openingPrice }];
  for(const b of batches){
    layers.push({ label:`Purchased ${b.date}`, start:running, end:running+b.qty, price:b.price });
    running += b.qty;
  }

  // find which layer the midpoint of [cumBefore, cumAfter) falls into (use start point, matching Excel's per-unit logic)
  let chosenLayer = null;
  for(const layer of layers){
    if(cumAfter > layer.start && cumAfter <= layer.end){ chosenLayer = layer; break; }
    if(layer.end === 0 && cumAfter <= 0){ chosenLayer = layer; break; }
  }
  if(!chosenLayer){
    // ran past all known layers -> fallback to last known price, or opening price
    chosenLayer = layers[layers.length-1] || {label:'Fallback', price: openingPrice};
  }

  return { price: chosenLayer.price, layerLabel: chosenLayer.label };
}

// Same FIFO layer logic as computeFifoForSale, but for stock losses (damage/theft/etc).
// Crucially, this must account for BOTH prior sales AND prior losses of the same item,
// since both consume stock from the same FIFO layers - a loss logged after a sale
// should price from whatever layer is next in line, not restart from the beginning.
export function computeFifoForLoss(state, item, lossDate, qty, excludeAdjustmentId){
  const openingQty = (state.items.find(i=>i.name===item) || {openingQty:0}).openingQty || 0;
  const openingPrice = (state.items.find(i=>i.name===item) || {openingPrice:0}).openingPrice || 0;

  const priorSales = state.sales
    .filter(s => s.item===item)
    .filter(s => s.date <= lossDate)
    .filter(s => afterOpeningCutover(state, item, s.date))
    .map(s => ({ date:s.date, seq:s.seq, qty:s.qty, kind:'sale' }));

  const priorLosses = (state.stockAdjustments||[])
    .filter(a => a.item===item && a.id!==excludeAdjustmentId)
    .filter(a => a.date <= lossDate)
    .filter(a => afterOpeningCutover(state, item, a.date))
    .map(a => ({ date:a.date, seq:a.seq||0, qty:a.qty, kind:'loss' }));

  const priorConsumption = [...priorSales, ...priorLosses]
    .sort((a,b)=> (a.date<b.date?-1:a.date>b.date?1:a.seq-b.seq));

  let cumBefore = 0;
  for(const c of priorConsumption){ cumBefore += c.qty; }
  const cumAfter = cumBefore + qty;

  const batches = state.batches
    .filter(b=>b.item===item)
    .filter(b=>afterOpeningCutover(state, item, b.date))
    .sort((a,b)=> a.date<b.date?-1:a.date>b.date?1:0);

  let running = openingQty;
  const layers = [{ label:'Opening stock', start:0, end:openingQty, price:openingPrice }];
  for(const b of batches){
    layers.push({ label:`Purchased ${b.date}`, start:running, end:running+b.qty, price:b.price });
    running += b.qty;
  }

  let chosenLayer = null;
  for(const layer of layers){
    if(cumAfter > layer.start && cumAfter <= layer.end){ chosenLayer = layer; break; }
    if(layer.end === 0 && cumAfter <= 0){ chosenLayer = layer; break; }
  }
  if(!chosenLayer){ chosenLayer = layers[layers.length-1] || {label:'Fallback', price: openingPrice}; }

  return { price: chosenLayer.price, layerLabel: chosenLayer.label };
}

export function remainingStock(state, itemName){
  const item = state.items.find(i=>i.name===itemName);
  const opening = item ? item.openingQty : 0;
  const purchased = state.batches.filter(b=>b.item===itemName).filter(b=>afterOpeningCutover(state,itemName,b.date)).reduce((a,b)=>a+b.qty,0);
  const sold = state.sales.filter(s=>s.item===itemName).filter(s=>afterOpeningCutover(state,itemName,s.date)).reduce((a,s)=>a+s.qty,0);
  const lost = (state.stockAdjustments||[]).filter(a=>a.item===itemName).filter(a=>afterOpeningCutover(state,itemName,a.date)).reduce((a,adj)=>a+adj.qty,0);
  return opening + purchased - sold - lost;
}

// After editing or deleting a sale, every other sale of the SAME item may now have
// a different FIFO cost basis, since FIFO depends on the order and quantity of
// everything sold before it. This recomputes fifoPrice/grossProfit for all sales
// of that item, in their correct date+seq order, so nothing is left stale.
export function recomputeItemFifo(state, itemName){
  const itemSales = state.sales
    .filter(s=>s.item===itemName)
    .sort((a,b)=> (a.date<b.date?-1:a.date>b.date?1:a.seq-b.seq));

  // build up a running state as if each sale were being added fresh, in order,
  // so computeFifoForSale sees only the sales that come "before" it
  let runningSales = [];
  const updates = {};
  for(const s of itemSales){
    const scopedState = {...state, sales: runningSales};
    const fifo = computeFifoForSale(scopedState, itemName, s.date, s.qty, null);
    const newFifoPrice = Math.round(fifo.price*100)/100;
    const newGrossProfit = Math.round((s.price - fifo.price) * s.qty * 100)/100;
    updates[s.id] = { fifoPrice:newFifoPrice, fifoLayer:fifo.layerLabel, grossProfit:newGrossProfit };
    runningSales = [...runningSales, s];
  }
  return state.sales.map(s => updates[s.id] ? {...s, ...updates[s.id]} : s);
}

// FIFO inventory value: walk through layers (opening stock, then purchase batches
// in date order) and figure out which units are still unsold, valuing each
// remaining unit at the price of the layer it belongs to.
export function fifoStockValue(state, itemName){
  const item = state.items.find(i=>i.name===itemName);
  const openingQty = item ? item.openingQty : 0;
  const openingPrice = item ? item.openingPrice : 0;
  const totalSold = state.sales.filter(s=>s.item===itemName).filter(s=>afterOpeningCutover(state,itemName,s.date)).reduce((a,s)=>a+s.qty,0);
  const totalLost = (state.stockAdjustments||[]).filter(a=>a.item===itemName).filter(a=>afterOpeningCutover(state,itemName,a.date)).reduce((a,adj)=>a+adj.qty,0);

  const batches = state.batches.filter(b=>b.item===itemName).filter(b=>afterOpeningCutover(state,itemName,b.date)).sort((a,b)=> a.date<b.date?-1:a.date>b.date?1:0);
  const layers = [{ qty: openingQty, price: openingPrice }, ...batches.map(b=>({qty:b.qty, price:b.price}))];

  // consume from the front (oldest first) using totalSold + totalLost combined,
  // since both sales and losses draw down the same FIFO layers
  let toConsume = totalSold + totalLost;
  let value = 0;
  let qtyLeft = 0;
  for(const layer of layers){
    const consumedHere = Math.min(toConsume, layer.qty);
    const remainingHere = layer.qty - consumedHere;
    value += remainingHere * layer.price;
    qtyLeft += remainingHere;
    toConsume -= consumedHere;
  }
  // if toConsume > 0 still, more was sold/lost than ever recorded as purchased (data gap / negative stock) - value floors at 0 for those excess units
  return { qty: qtyLeft, value: Math.round(value*100)/100 };
}
