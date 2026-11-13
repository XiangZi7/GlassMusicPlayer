// 原稿桌面切歌动画直接复用；只将查询范围适配到独立窗口的根元素。
export function animateSourceDesktop(root, dir, oldTr, enabled = true) {
  if (!root || !enabled) return;
  const document = {
    body: root.ownerDocument.body,
    getElementById: id => id === 'desk' ? root : root.querySelector('[id="' + id + '"]'),
    createElement: tag => root.ownerDocument.createElement(tag),
  };
  const window = root.ownerDocument.defaultView;

  if(!oldTr)return;
  if(document.body.classList.contains("calm"))return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  var desk=document.getElementById("desk"); if(!desk||!desk.animate)return;
  var E="cubic-bezier(.22,1,.36,1)";
  if(desk._xAnims)desk._xAnims.forEach(function(a){try{a.cancel();}catch(e){}});
  desk.querySelectorAll(".desk-xghost").forEach(function(g){g.remove();});
  desk.querySelectorAll("[data-desk-cur],[data-desk-prev],[data-desk-next],[data-desk-title],[data-desk-artist],[data-desk-cover]").forEach(function(el){ if(el.getAnimations)el.getAnimations().forEach(function(a){try{a.cancel();}catch(e){}}); });
  var anims=[];
  function track(a,el){ if(!a)return null; anims.push(a); a.onfinish=function(){ try{a.cancel();}catch(e){} if(el&&el.classList&&el.classList.contains("desk-xghost"))el.remove(); }; return a; }
  function vis(el){ return !!(el&&el.getClientRects&&el.getClientRects().length); }
  function slide(el,dist,dur,delay,endOpacity,blur){
    if(!vis(el)||!el.animate)return null;
    var from={transform:"translateX("+(dir*dist)+"px)",opacity:0};
    if(blur)from.filter="blur("+blur+"px)";
    var to={transform:"translateX(0)",opacity:(endOpacity==null?1:endOpacity)};
    if(blur)to.filter="blur(0px)";
    return track(el.animate([from,to],{duration:dur,delay:delay||0,easing:E,fill:"both"}));
  }
  /* covers (SMTC + tray pop): old cover ghosts out while the new one slides in —
     overlapped from the same first frame, one continuous curve, landing exactly
     at the resting state so the handoff has zero step (same fix as the stage). */
  desk.querySelectorAll("[data-desk-cover]").forEach(function(img){
    if(!vis(img))return;
    var parent=img.parentNode;
    if(parent){
      var ghost=document.createElement("img");
      ghost.className="desk-xghost"; ghost.setAttribute("aria-hidden","true"); ghost.alt="";
      ghost.src=oldTr.cover; ghost.style.transition="none";
      ghost.style.left=img.offsetLeft+"px"; ghost.style.top=img.offsetTop+"px";
      ghost.style.width=img.offsetWidth+"px"; ghost.style.height=img.offsetHeight+"px";
      parent.appendChild(ghost);
      track(ghost.animate([
        {transform:"translateX(0) scale(1)",opacity:1,filter:"blur(0px)"},
        {transform:"translateX("+(-dir*18)+"px) scale(.93)",opacity:0,filter:"blur(4px)"}
      ],{duration:480,easing:E,fill:"both"}),ghost);
      setTimeout(function(){ghost.remove();},560);
    }
    track(img.animate([
      {transform:"translateX("+(dir*24)+"px) scale(.94)",opacity:0,filter:"blur(4px)"},
      {transform:"translateX(0) scale(1)",opacity:1,filter:"blur(0px)"}
    ],{duration:580,easing:E,fill:"both"}));
  });
  /* titles + artists on SMTC / tray pop / lyrics meta: staggered behind the cover */
  desk.querySelectorAll(".smtc-txt b,.tray-pop-txt b").forEach(function(el){ slide(el,22,540,100,1,6); });
  desk.querySelectorAll(".smtc-txt span,.tray-pop-txt span").forEach(function(el){ slide(el,15,500,165,.6); });
  /* play buttons settle like the fullscreen dock's mini cover */
  desk.querySelectorAll("[data-desk-play]").forEach(function(el){
    if(!vis(el)||!el.animate)return;
    track(el.animate([{transform:"scale(.88)",opacity:.3},{transform:"scale(1)",opacity:1}],{duration:420,delay:40,easing:E,fill:"both"}));
  });
  /* desktop lyrics window: the three lines trail in like the stage's lyrics
     column — previous/next keep their dim resting opacity, the current line is
     the lyric layer's baseline beat with the cover's own curve */
  var lyr=document.getElementById("deskLyr");
  if(lyr&&vis(lyr)){
    track(lyr.animate([{transform:"translateX("+(dir*7)+"px)"},{transform:"translateX(0)"}],{duration:900,easing:E,fill:"both"}));
    slide(lyr.querySelector("[data-desk-prev]"),16,500,60,.42);
    var cu=lyr.querySelector("[data-desk-cur]");
    if(vis(cu)&&cu.animate)track(cu.animate([
      {transform:"translateX("+(dir*28)+"px) scale(.97)",opacity:0,filter:"blur(5px)"},
      {transform:"translateX(0) scale(1)",opacity:1,filter:"blur(0px)"}
    ],{duration:580,delay:95,easing:E,fill:"both"}));
    slide(lyr.querySelector("[data-desk-next]"),20,540,150,.42);
    var meta=lyr.querySelector(".desk-lyr-meta");
    if(vis(meta)&&meta.animate)track(meta.animate([
      {transform:"translateY(6px)",opacity:0},{transform:"translateY(0)",opacity:.55}
    ],{duration:440,delay:210,easing:E,fill:"both"}));
  }
  /* card shells are the slowest, shortest-travel layer (the stage's backdrop role) */
  [["deskSmtc"],["trayPop"]].forEach(function(pair){
    var card=document.getElementById(pair[0]);
    if(card&&vis(card)&&card.animate)track(card.animate([
      {transform:"translateX("+(dir*6)+"px)"},{transform:"translateX(0)"}
    ],{duration:880,easing:E,fill:"both"}));
  });
  /* taskbar tray button: a quick pop so the taskbar itself acknowledges the skip */
  var tb=document.getElementById("trayBtn");
  if(tb&&vis(tb)&&tb.animate)track(tb.animate([
    {transform:"scale(.8)"},{transform:"scale(1.06)",offset:.55},{transform:"scale(1)"}
  ],{duration:380,easing:E,fill:"both"}));
  desk._xAnims=anims;

}

// 单首歌换句时沿用原稿歌词的上浮、去模糊动画。
export function animateSourceLyric(root, enabled = true) {
  if (!root || !enabled || root.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const line = root.querySelector('[data-desk-cur]');
  if (!line || !line.animate) return;
  line.getAnimations().forEach(animation => animation.cancel());
  const animation = line.animate([{ opacity: 0, transform: 'translateY(9px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }], { duration: 480, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
  animation.onfinish = () => animation.cancel();
}
