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
async function fetchRates(){
  try{
    document.getElementById('rateStatus').textContent='Mengambil data market real-time...';
    const ids=Object.keys(cryptoList).join(',');
    const res=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=idr,usd,eur,jpy,sgd,myr&include_24hr_change=true`);
    prices=await res.json();
    const fres=await fetch('https://api.frankfurter.app/latest?from=USD');
    const fdata=await fres.json(); fiatRates={USD:1,...fdata.rates,IDR: (prices.tether?.idr || 16000)};
    const btcIdr=prices.bitcoin?.idr; if(btcIdr) document.getElementById('dcaBtcPrice').value=Math.round(btcIdr);
    document.getElementById('rateStatus').textContent='Data market aktif';
    document.getElementById('lastUpdated').textContent=new Date().toLocaleString('id-ID');
  }catch(e){
    document.getElementById('rateStatus').textContent='Gagal ambil data. Coba refresh.';
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
