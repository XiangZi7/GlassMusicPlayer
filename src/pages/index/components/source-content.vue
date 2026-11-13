<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import SlidingTabs from "@/components/ui/SlidingTabs.vue";
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <main class="main">
    <div class="main-top">
      <div>
        <h3>晚上好</h3>
        <p>继续听 Night Drive · 上次听到第 2 首</p>
      </div>
      <div class="main-top-right">
        <div class="main-chips">
          <BaseButton class="on">全部</BaseButton><BaseButton>专辑</BaseButton
          ><BaseButton>歌手</BaseButton>
        </div>
      </div>
    </div>
    <section class="banner" data-banner aria-label="今日主打横幅">
      <div class="banner-bg" data-banner-bg></div>
      <div class="banner-shade"></div>
      <div class="banner-content">
        <span class="banner-kicker">今日主打 · FEATURED</span>
        <h4 data-banner-title>Night Drive</h4>
        <p class="banner-sub" data-banner-sub>Midnight Drift — Neon Coast</p>
        <div class="banner-actions">
          <BaseButton class="banner-play" data-banner-play
            ><svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" /></svg
            >立即播放</BaseButton
          >
          <span class="banner-meta" data-banner-meta>FLAC · 24-BIT</span>
        </div>
      </div>
      <div class="banner-stage">
        <div class="banner-halo" data-banner-halo></div>
        <div class="banner-covers">
          <img class="bc bc-back" data-bc="2" alt="专辑封面" />
          <img class="bc bc-mid" data-bc="1" alt="专辑封面" />
          <img class="bc bc-front" data-bc="0" alt="本期主打专辑封面" />
        </div>
        <div class="banner-floor"></div>
        <img
          class="banner-girl"
          src="/images/featured-singer.webp"
          alt="二次元女主唱立绘"
        />
      </div>
      <div class="banner-mini">
        <img data-banner-mini-cover alt="专辑封面" />
        <div style="min-width: 0">
          今日主打 · <span data-banner-mini-title>Night Drive</span>
        </div>
        <BaseButton class="banner-play" data-banner-play>播放</BaseButton>
      </div>
    </section>
    <div class="feat-head">
      <h5>为你推荐</h5>
      <span>专辑 · 点击即播</span>
    </div>
    <div class="feat-grid" data-feat-grid></div>
    <div class="table-head">
      <span>#</span><span>标题</span><span>专辑</span
      ><span style="text-align: right">时长</span><span></span>
    </div>
    <div data-tracklist></div>
    <div class="pager" data-pager="home"></div>
    <p
      style="
        font-size: 12px;
        opacity: 0.5;
        line-height: 1.7;
        margin: 14px 2px 0;
      "
    >
      主区故意用不透明纯色：桌面一屏要放十几行歌，玻璃铺到这里文字就糊了。这是两版共同的底线，差别只在侧边栏、右栏和播放栏。
    </p>
    <div class="page-panel" data-panel="search">
      <div class="pg-head">
        <h3>搜索</h3>
        <p>在本地音乐库里找歌 — 输入歌名、歌手或专辑即可筛选，两窗口同步。</p>
      </div>
      <div class="search-box">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" /></svg
        ><input
          type="text"
          data-search-input
          placeholder="搜索歌曲、专辑、歌手…"
          aria-label="搜索歌曲、专辑、歌手"
        />
      </div>
      <div class="search-tags">
        <span>热门</span
        ><BaseButton data-tag="Night Drive">Night Drive</BaseButton
        ><BaseButton data-tag="June Harbor">June Harbor</BaseButton
        ><BaseButton data-tag="Chrome">Chrome</BaseButton
        ><BaseButton data-tag="Bauhaus">Bauhaus</BaseButton>
      </div>
      <div class="pg-secttl" data-search-label>全部歌曲</div>
      <div data-search-results></div>
      <div class="pager" data-pager="search"></div>
      <div class="empty-note" data-search-empty style="display: none">
        没有找到匹配的歌曲，换个关键词试试。
      </div>
      <div class="pg-secttl">歌手 · 点击按歌手筛选</div>
      <div class="artist-row" data-artist-row></div>
    </div>
    <div class="page-panel" data-panel="library">
      <div class="pg-head">
        <h3>音乐库</h3>
        <p>
          本地音乐库的全部内容 — 用上方标签在全部歌曲 / 专辑 / 歌手 / 我喜欢的 /
          最近播放之间切换，列表带分页，点任意一行即可播放。
        </p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="音乐库分类"
        hook="data-lib-tab"
        :options="[
          { label: '全部歌曲', value: 'library' },
          { label: '专辑', value: 'albums' },
          { label: '歌手', value: 'artists' },
          { label: '我喜欢的', value: 'liked' },
          { label: '最近播放', value: 'recent' },
        ]"
      />
      <div class="lib-stats">
        <div><b data-lib-nsongs>24</b><span>歌曲</span></div>
        <div><b data-lib-nalbums>4</b><span>专辑</span></div>
        <div><b data-lib-nartists>4</b><span>歌手</span></div>
        <div><b data-lib-total>0:00</b><span>总时长</span></div>
      </div>
      <div class="pg-secttl">全部歌曲</div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
          role="group"
          aria-label="列表排序"
          hook="data-sort"
          :options="[
            { label: '默认', value: 'lib:def' },
            { label: '歌名', value: 'lib:title' },
            { label: '歌手', value: 'lib:artist' },
            { label: '时长', value: 'lib:dur' },
          ]"
        />
      </div>
      <div class="table-head">
        <span>#</span><span>标题</span><span>专辑</span
        ><span style="text-align: right">时长</span><span></span>
      </div>
      <div data-lib-list></div>
      <div class="pager" data-pager="lib"></div>
      <div class="pg-secttl">我的收藏 · <span data-lib-liked>0</span> 首</div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
          role="group"
          aria-label="列表排序"
          hook="data-sort"
          :options="[
            { label: '默认', value: 'libLiked:def' },
            { label: '歌名', value: 'libLiked:title' },
            { label: '歌手', value: 'libLiked:artist' },
            { label: '时长', value: 'libLiked:dur' },
          ]"
        />
      </div>
      <div data-lib-liked-list></div>
      <div class="pager" data-pager="libLiked"></div>
      <div class="pg-secttl">智能歌单 · 按规则自动生成</div>
      <div class="smart-grid" data-smart-grid></div>
    </div>
    <div class="page-panel" data-panel="radio">
      <div class="pg-head">
        <h3>歌曲电台</h3>
        <p>
          以正在播放的这首歌为种子 —
          先排同专辑、再同歌手，其余按相似度排队续播；播到队尾不会停，电台会继续往后续。开启后队列头会亮起「电台续播中」，队列顺序就是电台的播放顺序，照样可以拖拽调整。
        </p>
      </div>
      <div class="radio-seed" data-radio-seed></div>
      <div class="pl-actions" style="margin-top: 12px">
        <BaseButton class="banner-play" data-radio-toggle>开始电台</BaseButton
        ><span data-radio-status></span>
      </div>
      <div class="pg-secttl">接下来 · 电台队列</div>
      <div
        data-radio-list
        style="display: flex; flex-direction: column; gap: 5px"
      ></div>
    </div>
    <div class="page-panel" data-panel="playlist">
      <div class="pl-head">
        <img data-pl-cover alt="歌单封面" />
        <div class="pl-info">
          <div class="pl-kicker">歌单 · PLAYLIST</div>
          <h3 data-pl-name></h3>
          <p data-pl-desc></p>
          <div class="pl-actions">
            <BaseButton class="banner-play" data-pl-play
              ><svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" /></svg
              >播放全部</BaseButton
            ><span data-pl-meta></span>
          </div>
        </div>
      </div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
          role="group"
          aria-label="列表排序"
          hook="data-sort"
          :options="[
            { label: '默认', value: 'pl:def' },
            { label: '歌名', value: 'pl:title' },
            { label: '歌手', value: 'pl:artist' },
            { label: '时长', value: 'pl:dur' },
          ]"
        />
      </div>
      <div class="table-head">
        <span>#</span><span>标题</span><span>专辑</span
        ><span style="text-align: right">时长</span><span></span>
      </div>
      <div data-pl-list></div>
      <div class="pager" data-pager="pl"></div>
    </div>
    <div class="page-panel" data-panel="albums">
      <div class="pg-head">
        <h3>专辑</h3>
        <p>音乐库里的全部专辑 — 点任意一张封面进入专辑详情。</p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="音乐库分类"
        hook="data-lib-tab"
        :options="[
          { label: '全部歌曲', value: 'library' },
          { label: '专辑', value: 'albums' },
          { label: '歌手', value: 'artists' },
          { label: '我喜欢的', value: 'liked' },
          { label: '最近播放', value: 'recent' },
        ]"
      />
      <div class="feat-grid" data-albums-grid style="margin-top: 16px"></div>
    </div>
    <div class="page-panel" data-panel="artists">
      <div class="pg-head">
        <h3>歌手</h3>
        <p>音乐库里的全部歌手 — 点任意一位进入歌手详情。</p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="音乐库分类"
        hook="data-lib-tab"
        :options="[
          { label: '全部歌曲', value: 'library' },
          { label: '专辑', value: 'albums' },
          { label: '歌手', value: 'artists' },
          { label: '我喜欢的', value: 'liked' },
          { label: '最近播放', value: 'recent' },
        ]"
      />
      <div class="artist-row" data-artists-grid style="margin-top: 16px"></div>
    </div>
    <div class="page-panel" data-panel="album">
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="音乐库分类"
        hook="data-lib-tab"
        :options="[
          { label: '全部歌曲', value: 'library' },
          { label: '专辑', value: 'albums' },
          { label: '歌手', value: 'artists' },
          { label: '我喜欢的', value: 'liked' },
          { label: '最近播放', value: 'recent' },
        ]"
      />
      <div class="pl-head">
        <img data-ad-cover alt="专辑封面" />
        <div class="pl-info">
          <div class="pl-kicker">专辑 · ALBUM</div>
          <h3 data-ad-name></h3>
          <p data-ad-desc></p>
          <div class="pl-actions">
            <BaseButton class="banner-play" data-ad-play
              ><svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" /></svg
              >播放全部</BaseButton
            ><span data-ad-meta></span>
          </div>
        </div>
      </div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
          role="group"
          aria-label="列表排序"
          hook="data-sort"
          :options="[
            { label: '默认', value: 'ad:def' },
            { label: '歌名', value: 'ad:title' },
            { label: '歌手', value: 'ad:artist' },
            { label: '时长', value: 'ad:dur' },
          ]"
        />
      </div>
      <div class="table-head">
        <span>#</span><span>标题</span><span>专辑</span
        ><span style="text-align: right">时长</span><span></span>
      </div>
      <div data-ad-list></div>
      <div class="pager" data-pager="ad"></div>
    </div>
    <div class="page-panel" data-panel="artist">
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="音乐库分类"
        hook="data-lib-tab"
        :options="[
          { label: '全部歌曲', value: 'library' },
          { label: '专辑', value: 'albums' },
          { label: '歌手', value: 'artists' },
          { label: '我喜欢的', value: 'liked' },
          { label: '最近播放', value: 'recent' },
        ]"
      />
      <div class="pl-head">
        <img data-ard-cover alt="歌手封面" />
        <div class="pl-info">
          <div class="pl-kicker">歌手 · ARTIST</div>
          <h3 data-ard-name></h3>
          <p data-ard-desc></p>
          <div class="pl-actions">
            <BaseButton class="banner-play" data-ard-play
              ><svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" /></svg
              >播放全部</BaseButton
            ><span data-ard-meta></span>
          </div>
        </div>
      </div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
          role="group"
          aria-label="列表排序"
          hook="data-sort"
          :options="[
            { label: '默认', value: 'ard:def' },
            { label: '歌名', value: 'ard:title' },
            { label: '歌手', value: 'ard:artist' },
            { label: '时长', value: 'ard:dur' },
          ]"
        />
      </div>
      <div class="table-head">
        <span>#</span><span>标题</span><span>专辑</span
        ><span style="text-align: right">时长</span><span></span>
      </div>
      <div data-ard-list></div>
      <div class="pager" data-pager="ard"></div>
    </div>
    <div class="page-panel" data-panel="liked">
      <div class="pg-head">
        <h3>我喜欢的</h3>
        <p>
          点过爱心的歌曲都在这里 — 共
          <span data-liked-total>0</span> 首，和音乐库的收藏列表同步。
        </p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="音乐库分类"
        hook="data-lib-tab"
        :options="[
          { label: '全部歌曲', value: 'library' },
          { label: '专辑', value: 'albums' },
          { label: '歌手', value: 'artists' },
          { label: '我喜欢的', value: 'liked' },
          { label: '最近播放', value: 'recent' },
        ]"
      />
      <div class="pg-secttl">收藏歌曲</div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
          role="group"
          aria-label="列表排序"
          hook="data-sort"
          :options="[
            { label: '默认', value: 'liked:def' },
            { label: '歌名', value: 'liked:title' },
            { label: '歌手', value: 'liked:artist' },
            { label: '时长', value: 'liked:dur' },
          ]"
        />
      </div>
      <div data-liked-list></div>
      <div class="pager" data-pager="liked"></div>
      <div class="empty-note" data-liked-empty style="display: none">
        还没有收藏的歌曲 — 在播放栏或全屏页点爱心，收藏的歌会出现在这里。
      </div>
    </div>
    <div class="page-panel" data-panel="recent">
      <div class="pg-head">
        <h3>最近播放</h3>
        <p>按最近一次播放的顺序排列 — 点任意一行继续听。</p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="音乐库分类"
        hook="data-lib-tab"
        :options="[
          { label: '全部歌曲', value: 'library' },
          { label: '专辑', value: 'albums' },
          { label: '歌手', value: 'artists' },
          { label: '我喜欢的', value: 'liked' },
          { label: '最近播放', value: 'recent' },
        ]"
      />
      <div class="secttl-row">
        <div class="pg-secttl">播放历史</div>
        <BaseButton class="clear-btn" data-clear-recent type="button"
          >清空历史</BaseButton
        >
      </div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
          role="group"
          aria-label="列表排序"
          hook="data-sort"
          :options="[
            { label: '默认', value: 'recent:def' },
            { label: '歌名', value: 'recent:title' },
            { label: '歌手', value: 'recent:artist' },
            { label: '时长', value: 'recent:dur' },
          ]"
        />
      </div>
      <div data-recent-list></div>
      <div class="pager" data-pager="recent"></div>
      <div class="empty-note" data-recent-empty style="display: none">
        还没有播放记录 — 点任意一首歌开始播放，历史会出现在这里。
      </div>
    </div>
    <div class="page-panel" data-panel="settings">
      <div class="pg-head">
        <h3>设置</h3>
        <p>播放、音质与界面偏好 — 修改即时生效，A、B 两窗口同步。</p>
      </div>
      <div class="pg-secttl">播放 · PLAYBACK</div>
      <div class="set-card">
        <div class="set-row">
          <div class="set-txt">
            <b>无缝播放</b><span>上一首淡出与下一首淡入衔接，不留静音间隙</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="gapless"
            role="switch"
            aria-checked="true"
            aria-label="无缝播放"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>交叉淡化</b><span>切歌时用交叉淡化过渡，而不是硬切</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="crossfadeOn"
            role="switch"
            aria-checked="true"
            aria-label="交叉淡化"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>淡化时长</b
            ><span
              >交叉淡化持续的秒数 · 当前
              <span data-set-val="crossfade">6 秒</span></span
            >
          </div>
          <div class="set-slider">
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value="6"
              data-set-range="crossfade"
              aria-label="交叉淡化时长"
            />
          </div>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>音量标准化</b><span>把不同专辑的响度拉到同一水平</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="normalize"
            role="switch"
            aria-checked="false"
            aria-label="音量标准化"
            ><i></i
          ></BaseButton>
        </div>
      </div>
      <div class="pg-secttl">音质 · AUDIO</div>
      <div class="set-card">
        <div class="set-row">
          <div class="set-txt">
            <b>默认音质</b><span>播放时首选的规格</span>
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="quality"
            hook="data-val"
            :options="[
              { label: '标准', value: '标准' },
              { label: 'FLAC 16', value: 'FLAC · 16-BIT' },
              { label: 'FLAC 24', value: 'FLAC · 24-BIT' },
              { label: 'DSD', value: 'DSD · 1-BIT' },
            ]"
          />
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>输出设备</b><span>当前输出走选定的设备</span>
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="output"
            hook="data-val"
            :options="[
              { label: '桌面音箱', value: '桌面音箱' },
              { label: '耳机', value: '耳机' },
            ]"
          />
        </div>
      </div>
      <div class="pg-secttl">界面 · INTERFACE</div>
      <div class="set-card">
        <div class="set-row">
          <div class="set-txt">
            <b>玻璃质感</b
            ><span
              >整个窗口的材质风格 —
              选毛玻璃或液态玻璃会同时应用到两个窗口；选跟随窗口恢复 A 毛玻璃、B
              液态玻璃</span
            >
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="glassStyle"
            hook="data-val"
            :options="[
              { label: '跟随窗口', value: 'match' },
              { label: '毛玻璃', value: 'frosted' },
              { label: '液态玻璃', value: 'liquid' },
            ]"
          />
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>天气胶囊</b
            ><span>在顶栏与全屏页右上角显示本地天气 — 关掉这里会立刻隐藏</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="weather"
            role="switch"
            aria-checked="true"
            aria-label="天气胶囊"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>界面动效</b><span>天气图标漂移、全屏背景巨字缓漂等动态效果</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="motion"
            role="switch"
            aria-checked="true"
            aria-label="界面动效"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>正在播放面板</b
            ><span
              >右侧大封面、歌词与播放队列面板 —
              关掉即收起，给中间列表腾出横向空间；也可以点主区与右栏接缝处的小箭头</span
            >
          </div>
          <BaseButton
            class="switch"
            data-np-switch
            role="switch"
            aria-checked="true"
            aria-label="正在播放面板"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>桌面歌词</b
            ><span
              >页面下方桌面区的悬浮歌词窗 —
              可拖动，字号与透明度在桌面区工具条里调</span
            >
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="deskLyrics"
            role="switch"
            aria-checked="true"
            aria-label="桌面歌词"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>桌面歌词锁定</b
            ><span
              >锁定后歌词窗点击穿透、不挡鼠标 — 在桌面区工具条或这里解锁</span
            >
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="deskLock"
            role="switch"
            aria-checked="false"
            aria-label="桌面歌词锁定"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>托盘迷你播放器</b
            ><span
              >桌面区任务栏右下角的 Aura 托盘图标 —
              关掉即隐藏，点开是迷你播放器</span
            >
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="trayMini"
            role="switch"
            aria-checked="true"
            aria-label="托盘迷你播放器"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>均衡器</b
            ><span>预设音效 — 影响播放的频段曲线（原型内切换状态）</span>
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="eq"
            hook="data-val"
            :options="[
              { label: '原声', value: '原声' },
              { label: '流行', value: '流行' },
              { label: '低音', value: '低音' },
              { label: '人声', value: '人声' },
            ]"
          />
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>睡眠定时器</b><span>到时自动暂停播放</span>
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="sleep"
            hook="data-val"
            :options="[
              { label: '关闭', value: '关闭' },
              { label: '15 分钟', value: '15 分钟' },
              { label: '30 分钟', value: '30 分钟' },
              { label: '60 分钟', value: '60 分钟' },
            ]"
          />
        </div>
      </div>
      <div class="pg-secttl">快捷键 · SHORTCUTS</div>
      <div class="set-card">
        <div class="key-row">
          <div class="set-txt">
            <b>播放 / 暂停</b
            ><span
              >焦点在按钮上时空格仍用于触发按钮，在输入框里打字时不触发</span
            >
          </div>
          <kbd>空格</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>快退 5 秒</b></div>
          <kbd>←</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>快进 5 秒</b></div>
          <kbd>→</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>音量增大</b><span>每次 +5</span></div>
          <kbd>↑</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>音量减小</b><span>每次 −5</span></div>
          <kbd>↓</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt">
            <b>静音 / 恢复音量</b><span>恢复到静音前的音量</span>
          </div>
          <kbd>M</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>关闭全屏播放 / 返回首页</b></div>
          <kbd>Esc</kbd>
        </div>
      </div>
      <div class="pg-secttl">关于 · ABOUT</div>
      <div class="set-card">
        <div class="set-row">
          <div class="set-txt">
            <b>Aura Player</b
            ><span
              >桌面端音乐播放器 — A · 传统毛玻璃与 B ·
              液态玻璃双方案设计原型</span
            >
          </div>
          <span class="about-val">DESKTOP</span>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>版本</b
            ><span>界面与交互原型，两个窗口共用同一套播放逻辑与状态</span>
          </div>
          <span class="about-val">v1.0.0</span>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>数据说明</b
            ><span
              >歌曲、歌词、封面与天气均为演示内容，不含真实音频；所有状态只保存在本页内，关掉即清空</span
            >
          </div>
          <span class="about-val">DEMO</span>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>正式版技术栈</b
            ><span
              >规划为 Vue 3 + Tauri，平台对接与真实音频引擎在正式版接入</span
            >
          </div>
          <span class="about-val">PLANNED</span>
        </div>
      </div>
    </div>
    <div class="page-panel" data-panel="connect">
      <div class="pg-head">
        <h3>平台对接</h3>
        <p>
          把你在其他平台的歌单、喜欢和收藏搬进来 —
          连接后可勾选要导入的歌单，导入的歌单会出现在左侧「我的歌单」下方，两窗口同步。本页为设计原型：连接与导入在本页内演示，不会真的登录你的第三方账号；正式版需各平台开放平台授权（OAuth）后接入。
        </p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="内容导入分类"
        hook="data-src-tab"
        :options="[
          { label: '平台对接', value: 'connect' },
          { label: '上传歌曲', value: 'upload' },
          { label: '下载管理', value: 'downloads' },
        ]"
      />
      <div class="lib-stats">
        <div><b data-stat-conn>0 / 3</b><span>已连接平台</span></div>
        <div><b data-stat-imp>0</b><span>已导入歌单</span></div>
        <div><b data-stat-impsongs>0</b><span>导入歌曲（演示）</span></div>
        <div><b data-stat-sync>—</b><span>最近同步</span></div>
      </div>
      <div class="plat-grid">
        <div class="plat-card" data-plat-card="netease">
          <div class="plat-top">
            <div class="plat-logo ne">云</div>
            <div><b>网易云音乐</b><span>歌单 · 我喜欢 · 每日推荐</span></div>
            <span class="plat-status" data-plat-status>未连接</span>
          </div>
          <p>同步你的网易云歌单与红心歌曲，封面、歌词与播放记录一并对齐。</p>
          <div class="plat-meta">
            <span>歌单 12</span><span>喜欢 486 首</span><span>等级 LV.8</span>
          </div>
          <BaseButton class="plat-btn" data-conn-btn="netease"
            >连接网易云</BaseButton
          >
          <div class="plat-detail">
            <div class="set-row">
              <div class="set-txt">
                <b>自动同步新歌单</b
                ><span>在网易云新建的歌单自动出现在这里</span>
              </div>
              <BaseButton
                class="switch on"
                data-src-toggle="neaseAuto"
                role="switch"
                aria-checked="true"
                aria-label="网易云自动同步"
                ><i></i
              ></BaseButton>
            </div>
            <div class="set-row">
              <div class="set-txt">
                <b>同步「我喜欢」</b><span>红心歌曲合并进「我喜欢的」</span>
              </div>
              <BaseButton
                class="switch on"
                data-src-toggle="neaseLiked"
                role="switch"
                aria-checked="true"
                aria-label="网易云同步喜欢"
                ><i></i
              ></BaseButton>
            </div>
          </div>
        </div>
        <div class="plat-card" data-plat-card="kugou">
          <div class="plat-top">
            <div class="plat-logo kg">狗</div>
            <div><b>酷狗音乐</b><span>歌单 · 收藏 · 本地歌曲</span></div>
            <span class="plat-status" data-plat-status>未连接</span>
          </div>
          <p>导入酷狗的自建歌单与收藏夹，蝰蛇音效等平台专属设置不迁移。</p>
          <div class="plat-meta">
            <span>歌单 6</span><span>收藏 213 首</span><span>本地 58 首</span>
          </div>
          <BaseButton class="plat-btn" data-conn-btn="kugou"
            >连接酷狗</BaseButton
          >
          <div class="plat-detail">
            <div class="set-row">
              <div class="set-txt">
                <b>自动同步新歌单</b><span>在酷狗新建的歌单自动出现在这里</span>
              </div>
              <BaseButton
                class="switch on"
                data-src-toggle="kgAuto"
                role="switch"
                aria-checked="true"
                aria-label="酷狗自动同步"
                ><i></i
              ></BaseButton>
            </div>
            <div class="set-row">
              <div class="set-txt">
                <b>同步收藏夹</b><span>收藏歌曲合并进音乐库</span>
              </div>
              <BaseButton
                class="switch"
                data-src-toggle="kgFav"
                role="switch"
                aria-checked="false"
                aria-label="酷狗同步收藏"
                ><i></i
              ></BaseButton>
            </div>
          </div>
        </div>
        <div class="plat-card" data-plat-card="kuwo">
          <div class="plat-top">
            <div class="plat-logo kw">我</div>
            <div><b>酷我音乐</b><span>歌单 · 无损专辑 · 电台</span></div>
            <span class="plat-status" data-plat-status>未连接</span>
          </div>
          <p>导入酷我歌单与已购无损专辑清单，方便和本地 FLAC 库对照去重。</p>
          <div class="plat-meta">
            <span>歌单 4</span><span>已购专辑 9</span><span>无损 121 首</span>
          </div>
          <BaseButton class="plat-btn" data-conn-btn="kuwo"
            >连接酷我</BaseButton
          >
          <div class="plat-detail">
            <div class="set-row">
              <div class="set-txt">
                <b>自动同步新歌单</b><span>在酷我新建的歌单自动出现在这里</span>
              </div>
              <BaseButton
                class="switch"
                data-src-toggle="kwAuto"
                role="switch"
                aria-checked="false"
                aria-label="酷我自动同步"
                ><i></i
              ></BaseButton>
            </div>
            <div class="set-row">
              <div class="set-txt">
                <b>同步已购专辑</b><span>已购无损专辑出现在专辑页</span>
              </div>
              <BaseButton
                class="switch on"
                data-src-toggle="kwBuy"
                role="switch"
                aria-checked="true"
                aria-label="酷我同步已购"
                ><i></i
              ></BaseButton>
            </div>
          </div>
        </div>
      </div>
      <div class="pg-secttl">
        选择要导入的歌单 · <span data-imp-picked>已选 0</span>
      </div>
      <div data-imp-list></div>
      <div class="pl-actions" style="margin-top: 6px">
        <BaseButton class="banner-play" data-import-go>导入所选歌单</BaseButton
        ><span data-imp-status>先连接任意平台，再勾选歌单导入</span>
      </div>
      <div class="pg-secttl">用链接导入 · 粘贴歌单分享链接</div>
      <div class="link-row">
        <input
          type="text"
          data-link-input
          placeholder="粘贴网易云 / 酷狗 / 酷我歌单链接，例如 music.163.com/playlist?id=…"
          aria-label="歌单分享链接"
        /><BaseButton class="up-add" data-link-parse>解析</BaseButton>
      </div>
      <div class="src-note" data-link-result></div>
      <div class="imp-row" style="margin-top: 16px">
        <span class="it"
          ><b>功能全景</b
          ><span>已有功能 · 本轮新增 · 正式版缺口，一页看清</span></span
        ><BaseButton class="imp-pick" data-goto="hub">查看</BaseButton>
      </div>
      <p class="src-note">
        版权说明：平台曲库歌曲受各平台版权与会员规则限制，导入的是歌单结构与元数据；正式版中，能否直接播放取决于对应平台的授权与你的会员状态，无版权歌曲会标注并给出本地文件匹配建议。
      </p>
    </div>
    <div class="page-panel" data-panel="upload">
      <div class="pg-head">
        <h3>上传歌曲</h3>
        <p>
          把你自己的歌带进来 —
          选文件、选整个文件夹，或手动填写信息直接进音乐库。原型里文件只在本页读取文件名与大小、不上传到任何服务器；正式版会写入本地音乐文件夹并自动补封面与歌词。
        </p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="内容导入分类"
        hook="data-src-tab"
        :options="[
          { label: '平台对接', value: 'connect' },
          { label: '上传歌曲', value: 'upload' },
          { label: '下载管理', value: 'downloads' },
        ]"
      />
      <div class="up-drop" data-drop>
        <b>把音频文件或整个文件夹拖到这里</b>
        <p>
          支持 FLAC · WAV · MP3 · M4A · OGG · APE — 单个文件建议 ≤ 200MB<br />选文件夹会连同子文件夹里的音频一起读进来，整个歌单文件夹一次搬完
        </p>
        <div class="up-pickrow">
          <BaseButton class="banner-play" data-pick-files>选择文件</BaseButton
          ><BaseButton class="up-ghostbtn" data-pick-dir>选择文件夹</BaseButton>
        </div>
        <input
          type="file"
          data-file-input
          accept="audio/*,.flac,.ape,.wav,.mp3,.m4a,.ogg"
          multiple
          hidden
        />
        <input type="file" data-dir-input webkitdirectory hidden />
      </div>
      <div class="lib-stats">
        <div><b data-up-stat-q>0</b><span>队列文件</span></div>
        <div><b data-up-stat-done>0</b><span>已加入曲库</span></div>
        <div><b>6 种</b><span>支持格式</span></div>
        <div><b>本地</b><span>存储位置</span></div>
      </div>
      <div class="pg-secttl">导入队列</div>
      <div data-file-list></div>
      <div class="empty-note" data-file-empty>
        队列还是空的 —
        选几首你自己的歌试试，文件名和大小会真实读出来，加入后能在音乐库和搜索里找到。
      </div>
      <div class="pg-secttl">手动添加一首 · 填写信息直接进曲库</div>
      <div class="up-form">
        <input
          type="text"
          data-up-title
          placeholder="歌名（必填）"
          aria-label="歌名"
        /><input
          type="text"
          data-up-artist
          placeholder="歌手"
          aria-label="歌手"
        /><input
          type="text"
          data-up-album
          placeholder="专辑"
          aria-label="专辑"
        /><BaseButton class="up-add" data-up-add>加入音乐库</BaseButton>
      </div>
      <div class="src-note" data-up-status></div>
      <div class="pg-secttl">我上传的歌 · <span data-up-mine>0</span> 首</div>
      <div data-up-list></div>
      <div class="pager" data-pager="up"></div>
      <div class="empty-note" data-up-empty>
        还没有上传的歌 —
        上面手动添加或从队列加入的第一首会出现在这里，也会同步进音乐库。
      </div>
    </div>
    <div class="page-panel" data-panel="downloads">
      <div class="pg-head">
        <h3>下载管理</h3>
        <p>
          离线下载的歌曲与队列 — 演示数据，可暂停 /
          继续单个任务，正式版会写入本地缓存并支持断点续传。
        </p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="内容导入分类"
        hook="data-src-tab"
        :options="[
          { label: '平台对接', value: 'connect' },
          { label: '上传歌曲', value: 'upload' },
          { label: '下载管理', value: 'downloads' },
        ]"
      />
      <div class="lib-stats">
        <div><b>3</b><span>已下载</span></div>
        <div><b data-dl-active>2</b><span>进行中</span></div>
        <div><b>FLAC</b><span>默认下载音质</span></div>
        <div><b>本地缓存</b><span>存储位置</span></div>
      </div>
      <div class="pg-secttl">下载队列</div>
      <div data-dl-list></div>
      <p class="src-note">
        提示：平台对接导入的歌曲能否下载，取决于该平台的版权与会员规则；本地与自上传歌曲不受限制。
      </p>
    </div>
    <div class="page-panel" data-panel="hub">
      <div class="pg-head">
        <h3>功能全景</h3>
        <p>这个播放器现在有什么、这一轮补了什么、正式版还差什么 — 一页看清。</p>
      </div>
      <div class="audit-grid">
        <div class="audit-col">
          <h6>已经能用的</h6>
          <ul>
            <li>播放 / 暂停 / 切歌 / 拖进度</li>
            <li>音量三态图标 + 点喇叭静音恢复</li>
            <li>随机、三态循环、播放队列</li>
            <li>全屏播放页 + 双层 Dock</li>
            <li>歌词滚动高亮、悬浮歌词胶囊</li>
            <li>首页 / 搜索 / 音乐库 / 专辑 / 歌手</li>
            <li>歌单详情、我喜欢的、最近播放</li>
            <li>设置：玻璃质感、天气、音质、输出</li>
            <li>迷你播放器、悬浮歌词窗、系统媒体控制（桌面）</li>
            <li>键盘快捷键（空格 / 方向键 / M）</li>
          </ul>
        </div>
        <div class="audit-col">
          <h6>这一轮新补的</h6>
          <ul>
            <li>歌曲电台：以当前歌为种子自动续播</li>
            <li>智能歌单：久未听的 / 循环最多 / 随机重温</li>
            <li>播放队列拖拽排序 + 下一首播放</li>
            <li>桌面歌词悬浮窗（拖动 / 锁定穿透 / 字号透明度）</li>
            <li>托盘迷你播放器（页面下方桌面区）</li>
            <li>系统媒体控制 UI 位（页面下方桌面区）</li>
            <li>右侧正在播放面板可折叠（接缝箭头 / 设置开关）</li>
            <li>标签条、分页、排序与设置分段控件改滑动胶囊高亮</li>
            <li>平台对接页：网易云 / 酷狗 / 酷我</li>
            <li>歌单勾选导入 + 链接解析导入</li>
            <li>导入歌单进侧边栏、可打开播放</li>
            <li>每平台同步开关（自动同步 / 喜欢）</li>
            <li>上传歌曲页：拖放 / 选文件进队列</li>
            <li>手动加歌：直接进曲库全站可搜可播</li>
            <li>新建歌单（侧边栏「我的歌单」）</li>
            <li>下载管理页：队列暂停 / 继续</li>
            <li>均衡器预设 + 睡眠定时器（设置）</li>
            <li>本页：功能全景与缺口清单</li>
            <li>侧边栏收纳：曲库 / 内容导入标签页</li>
            <li>平台卡改横排整行版式</li>
            <li>上传支持整个文件夹（选 / 拖）</li>
            <li>长列表全站分页 · 每页 10 首</li>
            <li>列表排序：默认 / 歌名 / 歌手 / 时长</li>
            <li>最近播放一键清空</li>
            <li>设置：快捷键一览 + 关于 / 版本</li>
            <li>自建歌单行内重命名 + 删除确认</li>
          </ul>
        </div>
        <div class="audit-col">
          <h6>正式版还需要的</h6>
          <ul>
            <li>三方平台官方授权登录（OAuth）</li>
            <li>真实音频引擎与本地文件夹扫描</li>
            <li>账号体系与多设备云同步</li>
            <li>版权曲库与会员音质的授权校验</li>
            <li>离线缓存加密与下载断点续传</li>
            <li>歌词 / 封面自动匹配与纠错</li>
            <li>评论、分享与关注歌手动态</li>
            <li>排行榜、每日推荐的真实数据源</li>
            <li>CarPlay / 车载与多房间输出</li>
            <li>数据备份、导入导出与隐私设置</li>
            <li>听歌统计与年度报告</li>
            <li>歌词翻译与发音对照显示</li>
            <li>歌曲信息编辑（标签 / 封面 / 歌词）</li>
            <li>播客、电台与有声内容频道</li>
            <li>多设备播放接力与远程控制</li>
            <li>重复歌曲检测与曲库智能整理</li>
          </ul>
        </div>
      </div>
      <p class="src-note">
        说明：左边两列在本原型里都可点可操作（状态仅保存在本页内）；右列涉及账号、版权与服务器，属于正式开发阶段的工作，原型里不做假装接通。
      </p>
    </div>
  </main>
</template>
