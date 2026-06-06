const $ = (id) => document.getElementById(id);
const fmtIDR = (n) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
const fmtUSD = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(n)||0);
const fmtCoin = (n) => new Intl.NumberFormat('en-US',{maximumFractionDigits:8}).format(Number(n)||0);
const now = () => new Date().toLocaleString('id-ID');
let prices = {bitcoin:{idr:0,usd:0}, ethereum:{idr:0,usd:0}, solana:{idr:0,usd:0}, tether:{idr:17790,usd:1}};
let history = JSON.parse(localStorage.getItem('zik_history')||'[]');
let holdings = JSON.parse(localStorage.getItem('zik_holdings')||'[]');

function save(){localStorage.setItem('zik_history',JSON.stringify(history));localStorage.setItem('zik_holdings',JSON.stringify(holdings));}
function metric(k,v,cls=''){return `<div class="metric"><span>${k}</span><strong class="${cls}">${v}</strong></div>`}
function addHistory(type, data){history.unshift({type,time:now(),data}); history=history.slice(0,80); save(); renderHistory();}

async function fetchJson(url, timeout=8000){
  const ctrl = new AbortController(); const t=setTimeout(()=>ctrl.abort(),timeout);
  try{const r=await fetch(url,{signal:ctrl.signal,cache:'no-store'}); if(!r.ok) throw new Error(r.status); return await r.json();}
  finally{clearTimeout(t)}
}
async function refreshPrices(){
  $('statusText').textContent='Mengambil data...';
  try{
    const cg = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether&vs_currencies=idr,usd');
    ['bitcoin','ethereum','solana','tether'].forEach(a=>{ if(cg[a]) prices[a]=cg[a]; });
    $('statusText').textContent='Live: CoinGecko';
  }catch(e){
    try{
      const b = await fetchJson('https://api.binance.com/api/v3/ticker/price?symbols=[%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22]');
      const er = await fetchJson('https://open.er-api.com/v6/latest/USD');
      const usdIdr = er.rates?.IDR || prices.tether.idr || 17790;
      const map = Object.fromEntries(b.map(x=>[x.symbol,Number(x.price)]));
      prices = {bitcoin:{usd:map.BTCUSDT,idr:map.BTCUSDT*usdIdr},ethereum:{usd:map.ETHUSDT,idr:map.ETHUSDT*usdIdr},solana:{usd:map.SOLUSDT,idr:map.SOLUSDT*usdIdr},tether:{usd:1,idr:usdIdr}};
      $('statusText').textContent='Live: Binance + FX';
    }catch(err){$('statusText').textContent='Offline / API limit. Pakai data terakhir.';}
  }
  $('btcPrice').textContent=fmtIDR(prices.bitcoin.idr); $('btcUsd').textContent=fmtUSD(prices.bitcoin.usd);
  $('solPrice').textContent=fmtIDR(prices.solana.idr); $('solUsd').textContent=fmtUSD(prices.solana.usd);
  $('ethPrice').textContent=fmtIDR(prices.ethereum.idr); $('ethUsd').textContent=fmtUSD(prices.ethereum.usd);
  $('usdtIdr').textContent=fmtIDR(prices.tether.idr);
  $('profitRate').value = Math.round(prices.tether.idr || $('profitRate').value);
  $('convRate').value = Math.round(prices.tether.idr || $('convRate').value);
  $('dcaPrice').value = Math.round(prices.bitcoin.idr || $('dcaPrice').value);
  calcProfit(false); calcPintu(false); calcUsdt(false); calcDca(false); renderPortfolio();
}

function calcProfit(store=false){
  const cap=+$('profitCapital').value, rate=+$('profitRate').value, buy=+$('profitBuy').value, sell=+$('profitSell').value, bf=+$('profitBuyFee').value/100, sf=+$('profitSellFee').value/100;
  const buyUsd=cap/rate, qty=(buyUsd*(1-bf))/buy, gross=qty*sell*rate, net=gross*(1-sf), profit=net-cap, pct=cap?profit/cap*100:0;
  $('profitResult').innerHTML=metric('Jumlah koin didapat',fmtCoin(qty))+metric('Nilai jual bersih',fmtIDR(net))+metric('Profit / Loss',`${fmtIDR(profit)} (${pct.toFixed(2)}%)`,profit>=0?'pos':'neg');
  if(store) addHistory('Profit Spot',{cap,rate,buy,sell,profit,net,pct});
}
function calcPintu(store=false){
  const cap=+$('pintuCapital').value, buy=+$('pintuBuy').value, sell=+$('pintuSell').value, cfx=+$('pintuCfx').value/100, tax=+$('pintuTax').value/100;
  const afterBuy=cap*(1-cfx), qty=afterBuy/buy, gross=qty*sell, net=gross*(1-tax), mid=(buy+sell)/2, portfolio=qty*mid, profit=net-cap, pct=cap?profit/cap*100:0, spread=sell-buy;
  $('pintuResult').innerHTML=metric('Aset didapat',fmtCoin(qty))+metric('Spread buy/sell',fmtIDR(spread))+metric('Portfolio mid price',fmtIDR(portfolio))+metric('Diterima setelah pajak',fmtIDR(net))+metric('Profit / Loss bersih',`${fmtIDR(profit)} (${pct.toFixed(2)}%)`,profit>=0?'pos':'neg');
  if(store) addHistory('Simulasi Pintu',{cap,buy,sell,qty,net,profit,pct});
}
function calcUsdt(store=false){
  const amount=+$('convAmount').value, rate=+$('convRate').value, fee=+$('convFee').value/100, dir=$('convDirection').value;
  const gross = dir==='usdt-idr' ? amount*rate : amount/rate; const net = gross*(1-fee);
  $('usdtResult').innerHTML=metric('Hasil kotor',dir==='usdt-idr'?fmtIDR(gross):`${fmtCoin(gross)} USDT`)+metric('Hasil bersih',dir==='usdt-idr'?fmtIDR(net):`${fmtCoin(net)} USDT`);
  if(store) addHistory('USDT Converter',{amount,rate,dir,net});
}
function calcDca(store=false){
  const amount=+$('dcaAmount').value, periods=+$('dcaPeriods').value, price=+$('dcaPrice').value, move=+$('dcaMove').value/100;
  const total=amount*periods, btc= price ? total/price : 0, future=price*(1+move), value=btc*future, pnl=value-total;
  $('dcaResult').innerHTML=metric('Total modal DCA',fmtIDR(total))+metric('Estimasi BTC terkumpul',`${fmtCoin(btc)} BTC`)+metric('Estimasi nilai akhir',fmtIDR(value))+metric('Estimasi profit/loss',fmtIDR(pnl),pnl>=0?'pos':'neg');
  if(store) addHistory('BTC DCA',{amount,periods,price,btc,value,pnl});
}
function addHolding(){holdings.push({asset:$('pfAsset').value,qty:+$('pfQty').value,cost:+$('pfCost').value,time:now()}); save(); addHistory('Tambah Holding',holdings[holdings.length-1]); renderPortfolio();}
function removeHolding(i){holdings.splice(i,1); save(); renderPortfolio();}
function renderPortfolio(){
  let totalCost=0,totalValue=0, html='';
  holdings.forEach((h,i)=>{const p=prices[h.asset]?.idr||0, val=h.qty*p, pnl=val-h.cost; totalCost+=h.cost; totalValue+=val; html += `<div class="item"><div class="item-row"><strong>${h.asset.toUpperCase()}</strong><span>${fmtCoin(h.qty)}</span></div><div class="small">Modal ${fmtIDR(h.cost)} • Value ${fmtIDR(val)} • P/L <span class="${pnl>=0?'pos':'neg'}">${fmtIDR(pnl)}</span></div><button class="remove" onclick="removeHolding(${i})">Hapus</button></div>`});
  const pnl=totalValue-totalCost;
  $('portfolioResult').innerHTML=metric('Total modal',fmtIDR(totalCost))+metric('Total value live',fmtIDR(totalValue))+metric('Total profit/loss',fmtIDR(pnl),pnl>=0?'pos':'neg');
  $('holdingList').innerHTML=html || '<p class="hint">Belum ada holding. Tambahkan aset pertamamu.</p>';
}
function renderHistory(){
  $('historyList').innerHTML = history.map(h=>`<div class="item"><div class="item-row"><strong>${h.type}</strong><span class="small">${h.time}</span></div><pre class="small">${JSON.stringify(h.data,null,2)}</pre></div>`).join('') || '<p class="hint">Belum ada riwayat.</p>';
}
function clearHistory(){ if(confirm('Hapus semua riwayat?')){history=[]; save(); renderHistory();} }

document.querySelectorAll('#tabs button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('#tabs button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active')); $(btn.dataset.tab).classList.add('active');}));
$('refreshBtn').addEventListener('click',refreshPrices);
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
renderHistory(); renderPortfolio(); refreshPrices(); setInterval(refreshPrices,60000);
