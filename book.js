(function(){
  const pages = [
    {id:"ch1", file:"ch1.html", section:"Part I · Innate Immunity", title:"1장 · Immunology의 기본 개념", sub:"Basic concepts of immunology"},
    {id:"ch2", file:"ch2.html", section:"Part I · Innate Immunity", title:"2장 · Innate Immunity", sub:"1차 방어선"},
    {id:"ch2ex", file:"ch2-exercises.html", section:"Part I · Innate Immunity", title:"2장 연습문제", sub:"Innate Immunity · 문제 & 해설"}
  ];
  const current = document.body.dataset.bookPage;
  const curIndex = pages.findIndex(p => p.id === current);

  const btn = document.createElement("button");
  btn.id="bookNavBtn"; btn.type="button"; btn.textContent="☰ 책 목차";
  btn.setAttribute("aria-label","책 전체 목차");
  const topInner=document.querySelector("header.top .top-inner");
  if(topInner){
    const brand=topInner.querySelector(".brand");
    if(brand) topInner.insertBefore(btn, brand);
    else topInner.prepend(btn);
  }

  const scrim=document.createElement("div"); scrim.id="bookScrim";
  const panel=document.createElement("aside"); panel.id="bookPanel";
  panel.setAttribute("aria-label","책 목차");

  const head=document.createElement("div"); head.className="book-head";
  const hwrap=document.createElement("div");
  hwrap.innerHTML='<h2>Janeway\'s Immunobiology</h2><p>학습용 웹 교재</p>';
  const close=document.createElement("button"); close.className="book-close"; close.type="button"; close.textContent="×"; close.setAttribute("aria-label","목차 닫기");
  head.append(hwrap,close);
  const list=document.createElement("nav"); list.className="book-list";

  let lastSection="";
  pages.forEach(p=>{
    if(p.section!==lastSection){
      const sec=document.createElement("div"); sec.className="book-section"; sec.textContent=p.section;
      list.appendChild(sec); lastSection=p.section;
    }
    const a=document.createElement("a"); a.className="book-link"; a.href=p.file;
    a.innerHTML='<span>'+p.title+'</span><span class="sub">'+p.sub+'</span>';
    if(p.id===current){a.classList.add("current");a.setAttribute("aria-current","page");}
    list.appendChild(a);
  });
  panel.append(head,list);
  document.body.append(scrim,panel);

  function open(){panel.classList.add("show");scrim.classList.add("show");}
  function closePanel(){panel.classList.remove("show");scrim.classList.remove("show");}
  btn.addEventListener("click",open); close.addEventListener("click",closePanel); scrim.addEventListener("click",closePanel);
  document.addEventListener("keydown",e=>{if(e.key==="Escape") closePanel();});

  if(curIndex>=0){
    const pager=document.createElement("nav"); pager.id="bookPager"; pager.setAttribute("aria-label","챕터 이동");
    const prev=pages[curIndex-1], next=pages[curIndex+1];
    if(prev){
      const a=document.createElement("a");a.className="book-page-link";a.href=prev.file;
      a.innerHTML='<span class="label">← Previous</span><span class="title">'+prev.title+'</span>';pager.appendChild(a);
    } else {
      const a=document.createElement("a");a.className="book-page-link";a.href="index.html";
      a.innerHTML='<span class="label">Home</span><span class="title">책 표지 / 목차</span>';pager.appendChild(a);
    }
    if(next){
      const a=document.createElement("a");a.className="book-page-link next";a.href=next.file;
      a.innerHTML='<span class="label">Next →</span><span class="title">'+next.title+'</span>';pager.appendChild(a);
    }
    const main=document.querySelector("main");
    if(main) main.insertAdjacentElement("afterend",pager);
  }
})();
