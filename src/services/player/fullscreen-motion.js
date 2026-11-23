// 为原稿全屏切歌注入宿主作用域和受控定时器，逐项保留动画参数与取消顺序。
export function createFullscreenMotion({
  players,
  state,
  tracks: TRACKS,
  document,
  window,
  setTimeout,
  queueNextTi,
}) {
  // 入场、切歌与关闭共用原稿的取消登记，快速操作时不遗留叠卡或动画。
  function cancelFsStageAnims(fs) {
    if (!fs) return
    if (fs._xAnims)
      fs._xAnims.forEach(function (a) {
        try {
          a.cancel()
        } catch (e) {}
      })
    fs._xAnims = []
    fs.querySelectorAll('.fs-xghost').forEach(function (g) {
      g.remove()
    })
    fs._xRun = (fs._xRun || 0) + 1
  }

  // 打开全屏时复用原稿约 1.1 秒的分层入场动画。
  function animateFsEntrance() {
    if (document.body.classList.contains('calm')) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    var E = 'cubic-bezier(.22,1,.36,1)'
    players().forEach(function (p) {
      var fs = p.querySelector('[data-fs]')
      if (!fs || !fs.animate) return
      cancelFsStageAnims(fs)
      var anims = []
      function track(a) {
        if (!a) return null
        anims.push(a)
        a.onfinish = function () {
          try {
            a.cancel()
          } catch (e) {}
        }
        return a
      }
      function go(el, from, to, dur, delay) {
        if (!el || !el.animate) return null
        return track(
          el.animate([from, to], {
            duration: dur,
            delay: delay || 0,
            easing: E,
            fill: 'both',
          })
        )
      }
      var fsbg = fs.querySelector('[data-fs-bg]')
      if (fsbg) {
        var bsc =
          p.classList.contains('liquid-win') || fs.closest('.liquid-win')
            ? 1.12
            : 1.16
        track(
          fsbg.animate(
            [
              {
                transform: 'scale(' + (bsc * 1.06).toFixed(3) + ')',
                opacity: 0,
              },
              { transform: 'scale(' + bsc + ')', opacity: 1 },
            ],
            { duration: 720, easing: E, fill: 'both' }
          )
        )
      }
      var amb = fs.querySelector('.fs-amb')
      if (amb)
        track(
          amb.animate(
            [
              { opacity: 0, transform: 'scale(1.06)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            { duration: 820, delay: 50, easing: E, fill: 'both' }
          )
        )
      var shade = fs.querySelector('.fs-shade')
      if (shade)
        track(
          shade.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 620,
            easing: 'ease-out',
            fill: 'both',
          })
        )
      var giant = fs.querySelector('[data-fs-giant]')
      if (giant)
        track(
          giant.animate(
            [
              { transform: 'translateX(-52px)', opacity: 0 },
              { transform: 'translateX(0)', opacity: 0.5 },
            ],
            { duration: 940, delay: 110, easing: E, fill: 'both' }
          )
        )
      var cover = fs.querySelector('.fs-main img.fs-cover[data-cover]')
      if (cover)
        track(
          cover.animate(
            [
              {
                transform: 'translateY(36px) scale(.92)',
                opacity: 0,
                filter: 'blur(9px)',
              },
              {
                transform: 'translateY(0) scale(1)',
                opacity: 1,
                filter: 'blur(0px)',
              },
            ],
            { duration: 700, delay: 170, easing: E, fill: 'both' }
          )
        )
      var refl = fs.querySelector('.fs-main .fs-reflect')
      if (refl)
        track(
          refl.animate([{ opacity: 0 }, { opacity: 0.26 }], {
            duration: 560,
            delay: 430,
            easing: 'ease-out',
            fill: 'both',
          })
        )
      var tb = fs.querySelector('.fs-titleblock')
      if (tb) {
        go(
          tb.querySelector('.fs-kicker'),
          { transform: 'translateY(10px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 0.62 },
          460,
          300
        )
        go(
          tb.querySelector('h4'),
          { transform: 'translateY(18px)', opacity: 0, filter: 'blur(7px)' },
          { transform: 'translateY(0)', opacity: 1, filter: 'blur(0px)' },
          580,
          375
        )
        go(
          tb.querySelector('p'),
          { transform: 'translateY(12px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 0.72 },
          500,
          460
        )
        go(
          tb.querySelector('.fs-titleactions'),
          { transform: 'translateY(9px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 },
          460,
          540
        )
      }
      go(
        fs.querySelector('.fs-lyrcol'),
        { transform: 'translateX(36px)', opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
        640,
        470
      )
      var side = fs.querySelector('.fs-side')
      if (side)
        track(
          side.animate([{ opacity: 0 }, { opacity: 0.5 }], {
            duration: 420,
            delay: 640,
            easing: 'ease-out',
            fill: 'both',
          })
        )
      var idxEl = fs.querySelector('[data-fsnum]')
      if (idxEl)
        track(
          idxEl.animate(
            [
              { opacity: 0, transform: 'translateY(10px)' },
              { opacity: 0.55, transform: 'translateY(0)' },
            ],
            { duration: 420, delay: 680, easing: E, fill: 'both' }
          )
        )
      fs.querySelectorAll('.fs-specmono,.fs-toptitle').forEach(function (el) {
        track(
          el.animate([{ opacity: 0 }, { opacity: 0.62 }], {
            duration: 400,
            delay: 660,
            easing: 'ease-out',
            fill: 'both',
          })
        )
      })
      var top = fs.querySelector('.fs-top')
      if (top)
        track(
          top.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 420,
            delay: 620,
            easing: 'ease-out',
            fill: 'both',
          })
        )
      // 主题胶囊随顶栏分层淡入，复用同一动画登记以响应快速关闭或切歌。
      var tbar = fs.querySelector('.fs-themebar')
      if (tbar)
        track(
          tbar.animate(
            [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 420, delay: 660, easing: 'ease-out', fill: 'both' }
          )
        )
      var dock = fs.querySelector('.fs-dock')
      if (dock)
        track(
          dock.animate(
            [
              { transform: 'translateY(32px)', opacity: 0 },
              { transform: 'translateY(0)', opacity: 1 },
            ],
            { duration: 540, delay: 560, easing: E, fill: 'both' }
          )
        )
      fs._xAnims = anims
    })
  }

  // 切歌后并行执行背景、巨字、封面、叠卡和歌词的原始分层过渡。
  function animateFsTrackChange(dir, oldTr) {
    if (!state.stage || !oldTr) return
    if (document.body.classList.contains('calm')) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    var E = 'cubic-bezier(.22,1,.36,1)'
    players().forEach(function (p) {
      var fs = p.querySelector('[data-fs]')
      if (!fs || !fs.animate) return
      cancelFsStageAnims(fs)
      var run = fs._xRun
      var anims = []
      function track(a, el) {
        anims.push(a)
        a.onfinish = function () {
          try {
            a.cancel()
          } catch (e) {}
          if (el && el.classList && el.classList.contains('fs-xghost'))
            el.remove()
        }
        return a
      }
      function slide(el, fromVars, toVars, dur, delay) {
        if (!el) return null
        return track(
          el.animate([fromVars, toVars], {
            duration: dur,
            delay: delay || 0,
            easing: E,
            fill: 'both',
          })
        )
      }
      /* blurred backdrop: old cover hangs as a ghost and crossfades into the new one
       (the ambience mesh crossfades its colours on the same beat inside render()) */
      var fsbg = fs.querySelector('[data-fs-bg]')
      if (fsbg) {
        var bgGhost = document.createElement('div')
        bgGhost.className = 'fs-bg fs-xghost'
        bgGhost.setAttribute('aria-hidden', 'true')
        bgGhost.style.backgroundImage = 'url(' + oldTr.cover + ')'
        bgGhost.style.transition = 'none'
        fsbg.parentNode.insertBefore(bgGhost, fsbg.nextSibling)
        track(
          bgGhost.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 680,
            easing: 'ease-out',
            fill: 'both',
          }),
          bgGhost
        )
        setTimeout(function () {
          bgGhost.remove()
        }, 760)
      }
      /* layered speeds, part of device 2: the NEW backdrop and the ambience mesh join
       the slide at the back of the pack — the backdrop barely travels (18px) over
       the longest glide, the mesh a touch less; their keyframes carry the resting
       backdrop scale so the handoff back to CSS is seamless. */
      if (fsbg) {
        var bsc = fs.closest('.liquid-win') ? 1.12 : 1.16
        track(
          fsbg.animate(
            [
              {
                transform: 'translateX(' + dir * 18 + 'px) scale(' + bsc + ')',
              },
              { transform: 'translateX(0px) scale(' + bsc + ')' },
            ],
            { duration: 920, easing: E, fill: 'both' }
          )
        )
      }
      var ambSlide = fs.querySelector('.fs-amb')
      if (ambSlide)
        track(
          ambSlide.animate(
            [
              { transform: 'translateX(' + dir * 10 + 'px)' },
              { transform: 'translateX(0px)' },
            ],
            { duration: 980, easing: E, fill: 'both' }
          )
        )
      // 新旧封面在固定画框内交叠过渡，动画结束后新图回到原位。
      var wrap = fs.querySelector('.fs-main .fs-coverwrap')
      var cover = wrap ? wrap.querySelector('img.fs-cover[data-cover]') : null
      if (wrap && cover) {
        var kb = wrap.querySelector('.fs-coverkb')
        var ghost = document.createElement('img')
        ghost.className = 'fs-cover fs-xghost'
        ghost.setAttribute('aria-hidden', 'true')
        ghost.alt = ''
        ghost.src = oldTr.cover
        ghost.style.transition = 'none'
        ;(kb || wrap).appendChild(ghost)
        track(
          ghost.animate(
            [
              {
                transform: 'translateX(0) scale(1)',
                opacity: 1,
                filter: 'blur(0px)',
              },
              {
                transform: 'translateX(' + -dir * 34 + 'px) scale(.94)',
                opacity: 0,
                filter: 'blur(6px)',
              },
            ],
            { duration: 500, easing: E, fill: 'both' }
          ),
          ghost
        )
        setTimeout(function () {
          ghost.remove()
        }, 580)
        track(
          cover.animate(
            [
              {
                transform: 'translateX(' + dir * 46 + 'px) scale(.96)',
                opacity: 0,
                filter: 'blur(6px)',
              },
              {
                transform: 'translateX(0) scale(1)',
                opacity: 1,
                filter: 'blur(0px)',
              },
            ],
            { duration: 580, easing: E, fill: 'both' }
          )
        )
        var refl = wrap.querySelector('.fs-reflect')
        if (refl)
          track(
            refl.animate([{ opacity: 0 }, { opacity: 0.26 }], {
              duration: 580,
              delay: 60,
              easing: 'ease-out',
              fill: 'both',
            })
          )
        /* card-stack peek (device 3): the next cover in the skip direction edges out
         from behind the incoming one while it is still travelling — far enough to
         read as a second card, with a slight fan rotation — then tucks back and
         fades as the new cover lands. It is an .fs-xghost, so a rapid re-skip
         cancels and removes it with everything else. */
        if (TRACKS.length > 1) {
          var nb = TRACKS[(state.idx + dir + TRACKS.length) % TRACKS.length]
          var peek = document.createElement('img')
          peek.className = 'fs-cover fs-peek fs-xghost'
          peek.setAttribute('aria-hidden', 'true')
          peek.alt = ''
          peek.src = nb.cover
          peek.style.transition = 'none'
          ;(kb || wrap).appendChild(peek)
          track(
            peek.animate(
              [
                {
                  transform:
                    'translateX(' + dir * 4 + 'px) scale(.962) rotate(0deg)',
                  opacity: 0,
                },
                {
                  transform:
                    'translateX(' +
                    dir * 19 +
                    'px) scale(.962) rotate(' +
                    dir * 0.8 +
                    'deg)',
                  opacity: 0.9,
                  offset: 0.4,
                },
                {
                  transform:
                    'translateX(' +
                    dir * 30 +
                    'px) scale(.965) rotate(' +
                    dir * 1.4 +
                    'deg)',
                  opacity: 0.92,
                  offset: 0.64,
                },
                {
                  transform:
                    'translateX(' +
                    dir * 11 +
                    'px) scale(.97) rotate(' +
                    dir * 0.4 +
                    'deg)',
                  opacity: 0,
                },
              ],
              { duration: 680, delay: 40, easing: E, fill: 'both' }
            ),
            peek
          )
          setTimeout(function () {
            peek.remove()
          }, 780)
        }
        /* light sweep (device 1): a bright band slashes diagonally across the cover
         glass on the change instant — cover only; the bottom player (dock) gets
         no sweep. */
        var shC = wrap.querySelector('.fs-sheen i')
        if (shC)
          track(
            shC.animate(
              [
                { transform: 'translateX(-190%) skewX(-16deg)', opacity: 0 },
                {
                  transform: 'translateX(-30%) skewX(-16deg)',
                  opacity: 1,
                  offset: 0.3,
                },
                {
                  transform: 'translateX(230%) skewX(-16deg)',
                  opacity: 0.85,
                  offset: 0.78,
                },
                { transform: 'translateX(380%) skewX(-16deg)', opacity: 0 },
              ],
              {
                duration: 700,
                delay: 60,
                easing: 'cubic-bezier(.4,0,.2,1)',
                fill: 'both',
              }
            )
          )
      }
      /* title block: staggered — kicker, then the big title, artist, actions */
      var tb = fs.querySelector('.fs-titleblock')
      if (tb) {
        slide(
          tb.querySelector('.fs-kicker'),
          { transform: 'translate(' + dir * 14 + 'px,4px)', opacity: 0 },
          { transform: 'translate(0,0)', opacity: 1 },
          460,
          50
        )
        slide(
          tb.querySelector('h4'),
          {
            transform: 'translate(' + dir * 24 + 'px,9px)',
            opacity: 0,
            filter: 'blur(8px)',
          },
          { transform: 'translate(0,0)', opacity: 1, filter: 'blur(0px)' },
          540,
          110
        )
        slide(
          tb.querySelector('p'),
          { transform: 'translate(' + dir * 18 + 'px,6px)', opacity: 0 },
          { transform: 'translate(0,0)', opacity: 1 },
          500,
          175
        )
        slide(
          tb.querySelector('.fs-titleactions'),
          { transform: 'translateY(7px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 },
          440,
          235
        )
      }
      /* giant outline artist drifts in from the opposite side, lyrics + index follow.
       The giant is the slowest layer on stage (device 4): it starts furthest out
       (-64px, opposite the cover's travel) and its 1180ms run is a full second
       longer than the cover's 580ms, so the cover is already home while the
       outline artist is still drifting in behind it. The lyrics column is its own
       layer too (device 2): it trails the cover, sliding in horizontally over
       700ms instead of the old vertical fade. */
      var giant = fs.querySelector('[data-fs-giant]')
      if (giant)
        track(
          giant.animate(
            [
              { transform: 'translateX(' + -dir * 64 + 'px)', opacity: 0 },
              { transform: 'translateX(0)', opacity: 0.5 },
            ],
            { duration: 1180, delay: 50, easing: E, fill: 'both' }
          )
        )
      slide(
        fs.querySelector('.fs-lyrcol'),
        { transform: 'translate(' + dir * 30 + 'px,6px)', opacity: 0.15 },
        { transform: 'translate(0,0)', opacity: 1 },
        700,
        130
      )
      var idxEl = fs.querySelector('[data-fsnum]')
      if (idxEl)
        track(
          idxEl.animate(
            [
              { transform: 'translateY(12px)', opacity: 0 },
              { transform: 'translateY(0)', opacity: 0.55 },
            ],
            { duration: 440, delay: 210, easing: E, fill: 'both' }
          )
        )
      /* dock mini cover: a quick settle so the dock agrees with the stage */
      var dc = fs.querySelector('.dock-cover')
      if (dc)
        track(
          dc.animate(
            [
              { transform: 'scale(.9)', opacity: 0.25 },
              { transform: 'scale(1)', opacity: 1 },
            ],
            { duration: 420, delay: 40, easing: E, fill: 'both' }
          )
        )
      fs._xAnims = anims
    })
  }
  return { animateFsTrackChange, animateFsEntrance, cancelFsStageAnims }
}
