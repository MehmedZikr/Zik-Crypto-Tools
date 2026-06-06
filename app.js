const cryptoList = {
  bitcoin:'BTC', ethereum:'ETH', solana:'SOL', tether:'USDT', binancecoin:'BNB', hyperliquid:'HYPE', 'usd-coin':'USDC', ripple:'XRP', cardano:'ADA', dogecoin:'DOGE'
};
const fiatList = ['IDR','USD','EUR','JPY','SGD','MYR','GBP','AUD','SAR','AED','TRY','CNY','KRW'];
let prices = {};
let fiatRates = {};
const fmtIDR = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
const fmt = (n,d=4)=> new Intl.NumberFormat('id-ID',{maximumFractionDigits:d}).format(Number(n)||0);
function fillSelects(){
  const ca=document.getElementById('cryptoAsset'), pa=document.getElementById('portfolioAsset');
  Object.entries(cryptoList).forEach(([id,s])=>{ ca.add(new Option(s,id)); pa.add(new Option(s,id)); });
  const ff=document.getElementById('fiatFrom'), ft=document.getElementById('fiatTo');
  fiatList.forEach(c=>{ff.add(new Option(c,c)); ft.add(new Option(c,c));}); ff.value='USD'; ft.value='IDR';
}
async function fetchJson(url){
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function fetchFiatRates(){
  // Primary: open.er-api.com supports IDR and many world currencies without API key.
  try{
    const data = await fetchJson('https://open.er-api.com/v6/latest/USD');
    if(data && data.rates && data.rates.IDR){
      fiatRates = { USD: 1, ...data.rates };
      return true;
    }
  }catch(e){}
  // Fallback: Frankfurter does not always include every currency, so keep IDR from USDT if needed.
  try{
    const data = await fetchJson('https://api.frankfurter.app/latest?from=USD');
    fiatRates = { USD: 1, ...data.rates };
    return true;
  }catch(e){}
  return false;
}
async function fetchCryptoFromCoinGecko(){
  const ids=Object.keys(cryptoList).join(',');
  const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=idr,usd,eur,jpy,sgd,myr&include_24hr_change=true`);
  if(!data || !data.bitcoin) throw new Error('CoinGecko empty');
  prices = data;
  return true;
}
async function fetchCryptoFromBinance(){
  const symbolMap = {
    bitcoin:'BTCUSDT', ethereum:'ETHUSDT', solana:'SOLUSDT', tether:'USDTUSDT',
    binancecoin:'BNBUSDT', 'usd-coin':'USDCUSDT', ripple:'XRPUSDT', cardano:'ADAUSDT', dogecoin:'DOGEUSDT'
  };
  const symbols = encodeURIComponent(JSON.stringify(Object.values(symbolMap).filter(s=>s!=='USDTUSDT')));
  const data = await fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`);
  const idr = fiatRates.IDR || 16000;
  const out = {};
  Object.entries(symbolMap).forEach(([id,sym])=>{
    if(sym==='USDTUSDT'){
      out[id] = { usd:1, idr:idr, eur:1/(fiatRates.EUR||1), jpy:fiatRates.JPY||0, sgd:fiatRates.SGD||0, myr:fiatRates.MYR||0, usd_24h_change:0 };
      return;
    }
    const row = data.find(x=>x.symbol===sym);
    if(row){
      const usd = Number(row.lastPrice);
      out[id] = {
        usd,
        idr: usd*idr,
        eur: usd*(fiatRates.EUR||0),
        jpy: usd*(fiatRates.JPY||0),
        sgd: usd*(fiatRates.SGD||0),
        myr: usd*(fiatRates.MYR||0),
        usd_24h_change: Number(row.priceChangePercent)
      };
    }
  });
  if(!out.bitcoin) throw new Error('Binance empty');
  prices = { ...prices, ...out };
  return true;
}
async function fetchRates(){
  const status = document.getElementById('rateStatus');
  try{
    status.textContent='Mengambil data market real-time...';
    const fiatOk = await fetchFiatRates();
    let cryptoOk = false;
    try{ cryptoOk = await fetchCryptoFromCoinGecko(); }catch(e){}
    if(!cryptoOk){ try{ cryptoOk = await fetchCryptoFromBinance(); }catch(e){} }
    if(prices.tether?.idr && !fiatRates.IDR) fiatRates.IDR = prices.tether.idr;
    const btcIdr=prices.bitcoin?.idr; if(btcIdr) document.getElementById('dcaBtcPrice').value=Math.round(btcIdr);
    document.getElementById('lastUpdated').textContent=new Date().toLocaleString('id-ID');
    if(cryptoOk && fiatOk) status.textContent='Data market aktif';
    else if(cryptoOk) status.textContent='Data crypto aktif, kurs fiat fallback';
    else if(fiatOk) status.textContent='Kurs fiat aktif, data crypto belum tersedia';
    else status.textContent='Gagal ambil data. Cek internet lalu refresh.';
  }catch(e){
    status.textContent='Gagal ambil data. Cek internet lalu refresh.';
  }
}
function show(html,id){document.getElementById(id).innerHTML=html;}
function calcProfit(){
  const capital=+profitCapital.value, fx=+profitFx.value, buy=+profitBuy.value, sell=+profitSell.value, bf=+profitBuyFee.value/100, sf=+profitSellFee.value/100;
  const usd=capital/fx; const coin=(usd*(1-bf))/buy; const gross=coin*sell*fx; const net=gross*(1-sf); const profit=net-capital; const pct=profit/capital*100;
  show(`Coin didapat: <b>${fmt(coin,8)}</b><br>Hasil jual bersih: <b>${fmtIDR(net)}</b><br>Profit/Loss: <b class='${profit>=0?'positive':'negative'}'>${fmtIDR(profit)} (${fmt(pct,2)}%)</b>`,'profitResult');
}
function convertCrypto(){
  const id=cryptoAsset.value, fiat=cryptoFiat.value.toLowerCase(), amount=+cryptoAmount.value; const price=prices[id]?.[fiat];
  show(price?`${fmt(amount,8)} ${cryptoList[id]} = <b>${fiat.toUpperCase()} ${fmt(amount*price, fiat==='idr'?0:2)}</b><br><small>Per 1 ${cryptoList[id]} ≈ ${fiat.toUpperCase()} ${fmt(price, fiat==='idr'?0:2)}</small>`:'Data belum tersedia, tekan refresh.','cryptoResult');
}
function convertFiat(){
  const amount=+fiatAmount.value, from=fiatFrom.value, to=fiatTo.value;
  const usd= amount / (fiatRates[from]||1); const result= usd * (fiatRates[to]||1);
  show(`${fmt(amount,2)} ${from} = <b>${fmt(result, to==='IDR'?0:2)} ${to}</b>`,'fiatResult');
}
function calcDca(){
  const m=+dcaMonthly.value, months=+dcaMonths.value, price=+dcaBtcPrice.value, growth=+dcaGrowth.value/100;
  const total=m*months, btc=total/price, futurePrice=price*(1+growth), future=btc*futurePrice, profit=future-total;
  show(`Total modal: <b>${fmtIDR(total)}</b><br>Estimasi BTC terkumpul: <b>${fmt(btc,8)} BTC</b><br>Nilai masa depan: <b>${fmtIDR(future)}</b><br>Estimasi hasil: <b class='${profit>=0?'positive':'negative'}'>${fmtIDR(profit)}</b>`,'dcaResult');
}
function calcPintu(){
  const cap=+pintuCapital.value,buy=+pintuBuy.value,sell=+pintuSell.value,mid=+pintuMid.value,cfx=+pintuCfx.value/100,tax=+pintuTax.value/100;
  const usdt=(cap*(1-cfx))/buy; const portfolio=usdt*mid; const netSell=usdt*sell*(1-tax); const profit=netSell-cap;
  show(`USDT didapat: <b>${fmt(usdt,8)}</b><br>Nilai portfolio harga tengah: <b>${fmtIDR(portfolio)}</b><br>Hasil jual bersih: <b>${fmtIDR(netSell)}</b><br>Untung/Rugi: <b class='${profit>=0?'positive':'negative'}'>${fmtIDR(profit)}</b>`,'pintuResult');
}
function calcPortfolio(){
  const id=portfolioAsset.value, qty=+portfolioQty.value, avg=+portfolioAvg.value, current=prices[id]?.idr;
  if(!current) return show('Data belum tersedia, tekan refresh.','portfolioResult');
  const modal=qty*avg, value=qty*current, pnl=value-modal;
  show(`Market price: <b>${fmtIDR(current)}</b><br>Modal: <b>${fmtIDR(modal)}</b><br>Nilai sekarang: <b>${fmtIDR(value)}</b><br>PNL: <b class='${pnl>=0?'positive':'negative'}'>${fmtIDR(pnl)} (${fmt(pnl/modal*100,2)}%)</b>`,'portfolioResult');
}
document.querySelectorAll('.bottom-nav button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.bottom-nav button,.panel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelector(`[data-panel="${btn.dataset.target}"]`).classList.add('active');}));
document.getElementById('refreshBtn').onclick=fetchRates;
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js');}
fillSelects(); fetchRates(); setTimeout(calcProfit,600);
